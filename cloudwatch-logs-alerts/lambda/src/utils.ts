import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const stage = process.env.STAGE;
const primaryRegion = process.env.PRIMARY_AWS_REGION;

const snsClient = new SNSClient({ region: primaryRegion });

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
      `(.*)-EdgeRegion-CloudWatchLogSubFilter-(.*)-${stage}-(.*)`
    );
    const subscriptionFilter = subscriptionFilters[0];
    const match = subscriptionFilter.match(regexp);

    if (match?.length) {
      region = match[2];
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

// https://docs.aws.amazon.com/chatbot/latest/adminguide/custom-notifs.html
interface ChatbotCustomFormat {
  version: "1.0";
  source: "custom";
  content: {
    title: string;
    description: string;
    keywords?: string[];
    nextSteps?: string[];
  };
}

interface ChatbotCustomFormatParams {
  subject: ReturnType<typeof getSubject>;
  message: string;
  logEventsUrl: string;
  dashboardUrl?: string;
}

function getChatbotCustomFormat(
  params: ChatbotCustomFormatParams
): ChatbotCustomFormat {
  const { subject, message, logEventsUrl, dashboardUrl } = params;

  return {
    version: "1.0",
    source: "custom",
    content: {
      title: `:boom: ${subject} Error! :boom:`,
      description: `\`\`\`${transformTextToMarkdown(message)}`,
      keywords: [`Virtual Finland ${stage}`, subject],
      nextSteps: [
        // https://api.slack.com/reference/surfaces/formatting#links-in-retrieved-messages
        `<${logEventsUrl}|View in AWS console>`,
        ...(dashboardUrl ? [`<${dashboardUrl}|View dashboard>`] : []),
      ],
    },
  };
}

export {
  getLogEventsUrl,
  resolveEventRegion,
  getSubject,
  getDashboardUrl,
  publishSnsMessage,
  transformTextToMarkdown,
  getChatbotCustomFormat,
};
