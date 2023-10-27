import { CloudWatchLogsEvent } from "aws-lambda";
import { gunzipSync } from "node:zlib";
import {
  getSubject,
  getDashboardUrl,
  resolveEventRegion,
  getLogEventsUrl,
  publishSnsMessage,
  transformTextToMarkdown,
  getChatbotCustomFormat,
} from "./utils";

const organization = process.env.ORGANIZATION;
const stage = process.env.STAGE;
const primaryRegion = process.env.PRIMARY_AWS_REGION;
const snsTopicEmailArn = process.env.SNS_TOPIC_EMAIL_ARN;
const snsTopicChatbotArn = process.env.SNS_TOPIC_CHATBOT_ARN;

// to prevent spamming per source, we keep track of the sources we're handling and clear the flag after a timeout, in the form of { sourceLogGroupName: true, ... }
const isHandlingTimeout = 1000 * 60; // 1 minute
const handlingSource: Record<string, boolean> = {};

// Logs that are sent to a receiving service through a subscription filter are base64 encoded and compressed with the gzip format.
// https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#LambdaFunctionExample
export const handler = async (event: CloudWatchLogsEvent) => {
  console.log("[Received Event]:", event);

  let uniqueServiceKey = "";

  try {
    if (!organization || !stage || !primaryRegion || !snsTopicEmailArn) {
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
      let emailMessage = `${transformTextToMarkdown(
        messageString
      )}\n\nView in AWS console: ${logEventsUrl}`;

      if (dashboardUrl) {
        emailMessage += `\n\nView dashboard: ${dashboardUrl}`;
      }

      // for chatbot / slack integration, custom format needed
      const chatbotCustomFormat = getChatbotCustomFormat({
        subject,
        message: messageString,
        logEventsUrl,
        dashboardUrl,
      });

      // sns promises, include chatbot sns topic if configured
      const snsPromises = [
        publishSnsMessage(snsTopicEmailArn, subject, emailMessage, true),
        ...(snsTopicChatbotArn
          ? [
              publishSnsMessage(
                snsTopicChatbotArn,
                subject,
                JSON.stringify(chatbotCustomFormat)
              ),
            ]
          : []),
      ];

      // publish to sns topics
      await Promise.all(snsPromises);

      // clear flag after timeout
      setTimeout(
        () => delete handlingSource[uniqueServiceKey],
        isHandlingTimeout
      );
    } else {
      console.log(`Already handling error for log group: ${logGroup}`);
    }
  } catch (err) {
    delete handlingSource[uniqueServiceKey];
    throw err;
  }
};
