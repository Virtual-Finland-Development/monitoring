import { getSetup } from "./utils/Setup";
import { createChatbotSlackConfig } from "./resources/Chatbot";
import { createErrorSubLambdaFunction } from "./resources/ErrorSubLambdaFunction";
import { createSnsTopicAndSubscriptions } from "./resources/SNS";

const setup = getSetup();

// Flag to include chatbot slack config
const useChatbotSlackIntegration = true;
const includeChatbotSlackConfig =
  setup.isProductionLikeEnvironment() && useChatbotSlackIntegration;

// Create SNS topic and subscriptions
const { snSTopicForEmail, snsTopicForChatbot } = createSnsTopicAndSubscriptions(
  setup,
  includeChatbotSlackConfig
);

// Lambda function that will pass codesets errors to SNS
const errorSubLambdaFunction = createErrorSubLambdaFunction(
  setup,
  snSTopicForEmail,
  snsTopicForChatbot
);

// Create AWS Chatbot Slack configuration for alerting
if (includeChatbotSlackConfig) {
  createChatbotSlackConfig(setup, snsTopicForChatbot!);
}

// Outputs
export const errorSubLambdaFunctionArn = errorSubLambdaFunction.arn;
