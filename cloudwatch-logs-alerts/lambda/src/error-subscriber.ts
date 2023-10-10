import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { CloudWatchLogsEvent } from "aws-lambda";
import { gunzipSync } from "node:zlib";

const stage = process.env.STAGE;
const primaryRegion = process.env.PRIMARY_AWS_REGION;
const snsTopicEmailArn = process.env.SNS_TOPIC_EMAIL_ARN;
const snsTopicChatbotArn = process.env.SNS_TOPIC_CHATBOT_ARN;

// https://stackoverflow.com/questions/60796991/is-there-a-way-to-generate-the-aws-console-urls-for-cloudwatch-log-group-filters
function getLogEventsUrl(
  logGroupRegion: string,
  logGroup: string,
  logStream: string
) {
  return `https://console.aws.amazon.com/cloudwatch/home?region=${logGroupRegion}#logEventViewer:group=${logGroup};stream=${logStream}`;
}

// from lambda@edge cloudwatch log subscription filter events, there's no way to get the region from the event itself,
// so we parse it from the subscription filter name as the format is in *our* control and does include the region in the name
function resolveEventRegion(subscriptionFilters: string[] | undefined): string {
  let region = primaryRegion; // default to primary region

  if (subscriptionFilters?.length) {
    // Match the region from the subscription filter name, which is defined in the pulumi cloudwatch related definitions
    // Eg. codesets-EdgeRegion-CloudWatchLogSubFilter-eu-central-1-dev-c1c1724 -> eu-central-1
    const regexp = new RegExp(
      `codesets-EdgeRegion-CloudWatchLogSubFilter-(.*)-${stage}-(.*)`
    );
    const subscriptionFilter = subscriptionFilters[0];
    const match = subscriptionFilter.match(regexp);

    if (match?.length) {
      region = match[1];
    }
  }

  if (!region) throw new Error("Could not resolve event region.");

  return region;
}

function getSubject(logGroup: string) {
  if (logGroup.includes("codesets-LambdaAtEdge")) {
    return "Codesets";
  } else if (logGroup.includes("codesets-CacheUpdaterFunction")) {
    return "Codesets cache";
  } else if (logGroup.includes("escoApi")) {
    return "Esco API";
  } else {
    return "Unknown";
  }
}

function getDashboardUrl(subject: ReturnType<typeof getSubject>) {
  switch (subject) {
    case "Codesets":
    case "Esco API":
      return `https://${primaryRegion}.console.aws.amazon.com/cloudwatch/home?region=${primaryRegion}#dashboards/dashboard/codesets-dashboard-${stage}`;
    default:
      return undefined;
  }
}

function publishSnsMessage(topicArn: string, subject: string, message: string) {
  return snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: `${subject} Error!`,
      Message: message,
    })
  );
}

function transformTextToMarkdown(text: string) {
  // Newlines of the form \\n are escaped to \n
  text = text.replace(/\\\n/g, "\n");
  // Newlines of the form \\n are escaped to \n
  text = text.replace(/\\n/g, "\n");
  // Tabs of the form \\t are escaped to \t
  text = text.replace(/\\t/g, "\t");
  // Quotes of the form \\" are escaped to \"
  text = text.replace(/\\"/g, '"');
  // The first and last quote are removed
  text = text.replace(/^"/, "").replace(/"$/, "");
  return text;
}

const snsClient = new SNSClient({ region: primaryRegion });
// to prevent spamming per source, we keep track of the sources we're handling and clear the flag after a timeout, in the form of { sourceLogGroupName: true, ... }
const isHandlingTimeout = 1000 * 60; // 1 minute
const handlingSource: Record<string, boolean> = {};

// Logs that are sent to a receiving service through a subscription filter are base64 encoded and compressed with the gzip format.
// https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#LambdaFunctionExample
export const handler = async (event: CloudWatchLogsEvent) => {
  console.log("[Received Event]:", event);

  let uniqueServiceKey = "";

  try {
    if (!stage || !primaryRegion || !snsTopicEmailArn || !snsTopicChatbotArn) {
      throw new Error("Required environment variables are missing.");
    }

    const buffer = Buffer.from(event.awslogs.data, "base64");
    const decompressedData = gunzipSync(buffer).toString("utf-8");
    const parsed = JSON.parse(decompressedData);
    const logGroup = parsed?.logGroup;
    const logStream = parsed?.logStream;

    if (typeof logGroup !== "string" || typeof logStream !== "string") {
      throw new Error("Could not parse log group or log stream.");
    }

    if (!handlingSource[logGroup]) {
      uniqueServiceKey = logGroup;
      handlingSource[uniqueServiceKey] = true;

      console.log("[Parsed]:", parsed);
      const message =
        parsed?.logEvents[0]?.message ?? "Message could not be parsed.";
      const messageString = JSON.stringify(message, null, 2);
      console.log("[Message]:", messageString);

      const subject = getSubject(logGroup);
      const dashboardUrl = getDashboardUrl(subject);
      const logGroupRegion = resolveEventRegion(parsed?.subscriptionFilters);
      const logEventsUrl = getLogEventsUrl(logGroupRegion, logGroup, logStream);
      let emailMessage = `${messageString}\n\nView in AWS console: ${logEventsUrl}}`;

      if (dashboardUrl) {
        emailMessage += `\n\nView dashboard: ${dashboardUrl}`;
      }

      // for chatbot / slack integration, custom format needed
      // https://docs.aws.amazon.com/chatbot/latest/adminguide/custom-notifs.html
      const chatbotCustomFormat = {
        version: "1.0",
        source: "custom",
        content: {
          title: `:boom: ${subject} Error! :boom:`,
          description: transformTextToMarkdown(messageString),
          nextSteps: [
            // https://api.slack.com/reference/surfaces/formatting#links-in-retrieved-messages
            `<${logEventsUrl}|View in AWS console>`,
            ...(dashboardUrl ? [`<${dashboardUrl}|View dashboard>`] : []),
          ],
        },
      };

      // publish to sns topics
      await Promise.all([
        publishSnsMessage(snsTopicEmailArn, subject, emailMessage),
        publishSnsMessage(
          snsTopicChatbotArn,
          subject,
          JSON.stringify(chatbotCustomFormat)
        ),
      ]);

      // clear flag after timeout
      setTimeout(
        () => delete handlingSource[uniqueServiceKey],
        isHandlingTimeout
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `${subject} error passed to SNS topics`,
        }),
      };
    } else {
      console.log(`Already handling error for log group: ${logGroup}`);
    }
  } catch (err) {
    delete handlingSource[uniqueServiceKey];
    console.error("Error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
