# monitoring

Monitoring tools

## cloudwatch-logs-alerts

Centralized admin alerts system for Virtual Finland applications.

Lambda function receives error logs from CloudWatch Logs, via log subscription filters. Subscriptions are registered per service basis (pulumi), configured in each service respectively. Some of the configured services include, for example, Codetsets and Esco API.

Lambda function routes received error messages to SNS topics. The following topics are configured:

- `SnsTopicForEmail`: topic for admin email subscribers. Receiving email endpoints can be configured in AWS SNS.
- `SnsTopicForChatbot` (optional): topic for AWS Chatbot. Chatbot passes errors to Slack.
  - Slack workspace and channel needs to be configured
  - AWS Chatbot needs to be added and configured for workspace, see https://docs.aws.amazon.com/chatbot/latest/adminguide/slack-setup.html#slack-client-setup
  - Only one channel can be registered per environment, meaning for each possible environments (dev, staging, prod, etc.) a different channel needs to configured
  - Opt in: set `useChatbotSlackIntegration` flag to true in pulumi config and configure `slackChannelId` and `slackWorkspaceId` secrets accordingly:
    - pulumi config set cloudwatch-logs-alerts:useChatbotSlackIntegration true
    - pulumi config set --secret cloudwatch-logs-alerts:slackChannelId \<slackChannelId\>
    - pulumi config set --secret cloudwatch-logs-alerts:slackWorkspaceId \<slackWorkspaceId\>

## health-checks

Route53 health checks for Virtual Finland applications. 

The health checks can be used to monitor and report the health metrics of the services in the [AWS Route53 console](https://us-east-1.console.aws.amazon.com/route53/healthchecks/home#/). Note that the the health checks are deployed without a name, as the pulumi tooling lacks the option. Find out the name of the health by inspecting the tags (`vfd:name`) of the health check in the AWS console.
