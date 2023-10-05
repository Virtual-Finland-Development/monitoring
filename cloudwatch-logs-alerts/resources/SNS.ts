import * as aws from "@pulumi/aws";
import { ISetup } from "../utils/Setup";

export function createSnsTopicAndSubscriptions(setup: ISetup) {
  // SNS topic for email subs
  const snSTopicForEmail = new aws.sns.Topic(
    setup.getResourceName("SnsTopicForEmail")
  );

  // SNS topic for chatbot
  const snsTopicForChatbot = new aws.sns.Topic(
    setup.getResourceName("SnsTopicForChatbot")
  );

  // email subscribers
  const emailEndpoints = [""];

  // create sub for each subscriber
  emailEndpoints.forEach((email, i) => {
    new aws.sns.TopicSubscription(
      setup.getResourceName(`SnsEmailSub-${i + 1}`),
      {
        protocol: "email",
        endpoint: email,
        topic: snSTopicForEmail.arn,
      }
    );
  });

  return {
    snSTopicForEmail,
    snsTopicForChatbot,
  };
}
