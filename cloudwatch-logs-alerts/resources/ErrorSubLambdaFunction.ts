import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ISetup } from "../utils/Setup";

export function createErrorSubLambdaFunction(
  setup: ISetup,
  snsTopicForEmail: aws.sns.Topic,
  snsTopicForChatbot: aws.sns.Topic | undefined
) {
  const execRoleConfig = setup.getResourceConfig("FunctionExecRole");

  const functionExecRole = new aws.iam.Role(execRoleConfig.name, {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Principal: {
            Service: ["lambda.amazonaws.com"],
          },
          Effect: "Allow",
        },
      ],
    }),
    tags: execRoleConfig.tags,
  });

  // Assign SNS publish policy
  new aws.iam.RolePolicy(
    setup.getResourceName("ErrorSubLambdaSnsPublishPolicy"),
    {
      role: functionExecRole.id,
      policy: pulumi.output({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "sns:Publish",
            Resource: [
              snsTopicForEmail.arn,
              ...(snsTopicForChatbot ? [snsTopicForChatbot.arn] : []),
            ],
          },
        ],
      }),
    }
  );

  // Attach basic lambda execution policy
  new aws.iam.RolePolicyAttachment(
    setup.getResourceName("ErrorSubLambdaFuncExecRolePolicyAttachment"),
    {
      role: functionExecRole,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }
  );

  const functionConfig = setup.getResourceConfig("ErrorSubLambdaFunc");

  const lambdaFunction = new aws.lambda.Function(functionConfig.name, {
    role: functionExecRole.arn,
    runtime: "nodejs18.x",
    handler: "error-subscriber.handler",
    timeout: 60,
    memorySize: 256,
    code: new pulumi.asset.FileArchive("./lambda/dist"),
    tags: functionConfig.tags,
    environment: {
      variables: {
        ORGANIZATION: setup.organizationName,
        STAGE: setup.stage,
        PRIMARY_AWS_REGION: new pulumi.Config("aws").require("region"),
        SNS_TOPIC_EMAIL_ARN: snsTopicForEmail.arn,
        ...(snsTopicForChatbot
          ? { SNS_TOPIC_CHATBOT_ARN: snsTopicForChatbot.arn }
          : {}),
      },
    },
  });

  return lambdaFunction;
}
