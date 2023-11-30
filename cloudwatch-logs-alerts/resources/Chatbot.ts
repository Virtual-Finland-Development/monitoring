import * as aws from "@pulumi/aws";
import * as awsNative from "@pulumi/aws-native";
import * as pulumi from "@pulumi/pulumi";
import { ISetup } from "../utils/Setup";

const config = new pulumi.Config();

export function createChatbotSlackConfig(setup: ISetup, snsTopic: aws.sns.Topic) {
  const slackChannelId = config.require("slackChannelId");
  const slackWorkspaceId = config.require("slackWorkspaceId");

  // Create an IAM role for Chatbot configuration
  const chatbotRole = new aws.iam.Role(setup.getResourceName("ChatBotRole"), {
    description: "IAM role for AWS Chatbot",
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "chatbot.amazonaws.com",
          },
        },
      ],
    }),
  });

  const slackChannelConfig = new awsNative.chatbot.SlackChannelConfiguration(setup.getResourceName("SlackChannelConfig"), {
    configurationName: "SlackChannelAlertsConfig",
    iamRoleArn: chatbotRole.arn,
    slackChannelId,
    slackWorkspaceId,
    snsTopicArns: [snsTopic.arn],
    loggingLevel: "ERROR",
    userRoleRequired: false,
  });

  return slackChannelConfig;
}
