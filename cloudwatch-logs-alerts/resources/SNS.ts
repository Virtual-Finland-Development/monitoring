import * as aws from "@pulumi/aws";
import { ISetup } from "../utils/Setup";

export function createSnsTopicAndSubscriptions(
  setup: ISetup,
  includeChatbotSlackConfig: boolean
) {
  // SNS topic for email subs
  const snSTopicForEmail = new aws.sns.Topic(
    setup.getResourceName("SnsTopicForEmail")
  );

  // SNS topic for chatbot
  let snsTopicForChatbot: aws.sns.Topic | undefined = undefined;

  if (includeChatbotSlackConfig) {
    snsTopicForChatbot = new aws.sns.Topic(
      setup.getResourceName("SnsTopicForChatbot")
    );
  }

  return {
    snSTopicForEmail,
    snsTopicForChatbot,
  };
}
