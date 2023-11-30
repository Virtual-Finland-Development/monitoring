import { Config } from "@pulumi/pulumi";
import { createChatbotSlackConfig } from "./resources/Chatbot";
import { createErrorSubLambdaFunction } from "./resources/ErrorSubLambdaFunction";
import { createSnsTopicAndSubscriptions } from "./resources/SNS";
import { getSetup } from "./utils/Setup";

const setup = getSetup();

// Flag to include chatbot slack config
const useChatbotSlackIntegration = new Config().requireBoolean("useChatbotSlackIntegration");
const includeChatbotSlackConfig = setup.isMvpEnvironment() && useChatbotSlackIntegration;

// Create SNS topic and subscriptions
const { snSTopicForEmail, snsTopicForChatbot } = createSnsTopicAndSubscriptions(setup, includeChatbotSlackConfig);

// Lambda function that will pass codesets errors to SNS
const errorSubLambdaFunction = createErrorSubLambdaFunction(setup, snSTopicForEmail, snsTopicForChatbot);

// Create AWS Chatbot Slack configuration for alerting
if (includeChatbotSlackConfig) {
  createChatbotSlackConfig(setup, snsTopicForChatbot!);
}

// Outputs
export const errorSubLambdaFunctionArn = errorSubLambdaFunction.arn;
