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

## cloudfront-log-forwarder

Utility function that combines the different CloudFront edge-level logs of the Codesets-service to an unified CloudWatch log group. That log group is then used by the accessfinland-dashboard to present the usage stats for the codesets service.

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

## health-checks

Route53 health checks for Virtual Finland applications. 

The health checks can be used to monitor and report the health metrics of the services in the [AWS Route53 console](https://us-east-1.console.aws.amazon.com/route53/healthchecks/home#/). The checks work by sending HTTP requests to the services and reporting the status of the service based on the response. The health checks are done every 30 seconds and the service is considered unhealthy if the response is not 2xx. The checks also measure the duration of the request. The checks are done from the recommended AWS health checker regions.

Note that the the health checks are deployed without specifying a name to the AWS Console, as the pulumi tooling lacks the option. After deployment, find out the name of the specific health check item by inspecting the `vfd:name`-tag value and then update the name manually to the AWS Console.
