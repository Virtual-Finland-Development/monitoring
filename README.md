# monitoring

Monitoring tools

## accessfinland-dashboard

CloudWatch dashboard for the Access Finland application and related services metrics and stats.

- Apps & Authentication issuers - which application audiences and which authentication issuer were used in the requests
- Users API:
  - Usage statistics
  - Techinal statistics of the users-api operations, performance
- Codesets API:
  - Requests metrics
- Access Finland MVP application:
  - Statistics of the application usage, such as requests, error rate, cognito usage
  - Performance, CPU and memory metrics of the server

## cloudfront-log-forwared

???

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

## esco-api-dashboard

CloudWatch dashboard for the ESCO API. Includes basic overview of API usage and error logs.
