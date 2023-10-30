import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ensurePrefix } from "./string-helpers";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require("org");
const region = new pulumi.Config("aws").require("region");

// Users API references
const usersApiStackReference = new pulumi.StackReference(`${org}/users-api/${stack}`);
const usersApiDbInstanceIdentifier = usersApiStackReference.getOutput("DBIdentifier");
const usersApiLambdaId = usersApiStackReference.getOutput("LambdaId");
const usersApiElastiCacheClusterId = usersApiStackReference.getOutput("ElastiCacheClusterId");

// Static references
const audienceLabelsConfig = new pulumi.Config("audienceLabels");
function getAudienceLabelsHelperTextList() {
  return Object.keys(audienceLabelsConfig).map((key) => `- ${key}: ${audienceLabelsConfig.get(key)}`);
}

// Access Finland MVP references
const mvpStackReference = new pulumi.StackReference(`${org}/access-finland/${ensurePrefix("mvp-", stack)}`);
const mvpDistributionId = mvpStackReference.getOutput("CloudFrontDistributionId");
const mvpEcsServiceName = mvpStackReference.getOutput("FargateServiceName");
const mvpEcsClusterName = mvpStackReference.getOutput("EcsClusterName");
const mvpAlbName = mvpStackReference.getOutput("AppLoadBalancerName");

// Combine all resources to single output that we can use below on the dashboard
const resources = pulumi.all([usersApiDbInstanceIdentifier, usersApiLambdaId, mvpDistributionId, mvpEcsServiceName, mvpEcsClusterName, mvpAlbName, usersApiElastiCacheClusterId]);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(
    ([usersApiDbInstanceIdentifier, usersApiLambdaId, mvpDistributionId, mvpEcsServiceName, mvpEcsClusterName, mvpAlbName, usersApiElastiCacheClusterId]) =>
      JSON.stringify({
        widgets: [
          {
            height: 2,
            width: 24,
            y: 0,
            x: 0,
            type: "text",
            properties: {
              markdown: "# Virtual Finland Development dashboard\nUseful graphs and metrics for monitoring Virtual Finland services",
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 12,
            y: 22,
            x: 12,
            type: "metric",
            properties: {
              metrics: [
                ["AWS/Lambda", "Duration", "FunctionName", usersApiLambdaId, { id: "m1", region: region, color: "#3e82e5", label: "Users API (Avg)", stat: "Average" }],
                ["...", { id: "m2", region: region, color: "#8cc8f3", label: "Users API (Min)" }],
                ["...", { id: "m3", region: region, color: "#38549a", label: "Users API (Max)", stat: "Maximum" }],
              ],
              view: "timeSeries",
              stacked: false,
              region: region,
              stat: "Minimum",
              period: 300,
            },
          },
          {
            height: 2,
            width: 24,
            y: 20,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Users API - Performance \nTechinal statistics of the users-api operations\n",
              background: "transparent",
            },
          },
          {
            height: 7,
            width: 11,
            y: 4,
            x: 0,
            type: "metric",
            properties: {
              sparkline: true,
              view: "singleValue",
              metrics: [["VirtualFinland.UsersAPI", "PersonsCount", { region: region }]],
              region: region,
              title: "Profiles total",
              period: 300,
              stat: "Sum",
              liveData: false,
            },
          },
          {
            height: 2,
            width: 24,
            y: 2,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Users API - Usage\nUsage statistics\n",
              background: "transparent",
            },
          },
          {
            height: 7,
            width: 13,
            y: 4,
            x: 11,
            type: "metric",
            properties: {
              sparkline: false,
              view: "singleValue",
              metrics: [["VirtualFinland.UsersAPI", "RequestsTotal", { region: region }]],
              region: region,
              liveData: false,
              title: "Requests total",
              period: 300,
              stat: "Sum",
              setPeriodToTimeRange: true,
              trend: false,
            },
          },
          {
            height: 4,
            width: 12,
            y: 45,
            x: 0,
            type: "metric",
            properties: {
              metrics: [["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", mvpDistributionId, { region: "us-east-1" }]],
              view: "timeSeries",
              stacked: false,
              region: "us-east-1",
              title: "CloudFront - Requests (sum)",
              yAxis: {
                left: {
                  showUnits: false,
                },
                right: {
                  showUnits: false,
                },
              },
              stat: "Sum",
              period: 300,
            },
          },
          {
            height: 4,
            width: 12,
            y: 45,
            x: 12,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/CloudFront", "BytesUploaded", "Region", "Global", "DistributionId", mvpDistributionId],
                [".", "BytesDownloaded", ".", ".", ".", "."],
              ],
              region: "us-east-1",
              title: "CloudFront - Data transfer",
              yAxis: {
                left: {
                  showUnits: false,
                },
                right: {
                  showUnits: false,
                },
              },
              stat: "Sum",
            },
          },
          {
            height: 6,
            width: 12,
            y: 49,
            x: 0,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/CloudFront", "TotalErrorRate", "Region", "Global", "DistributionId", mvpDistributionId],
                [".", "4xxErrorRate", ".", ".", ".", ".", { label: "Total4xxErrors" }],
                [".", "5xxErrorRate", ".", ".", ".", ".", { label: "Total5xxErrors" }],
                [{ expression: "(m4+m5+m6)/m7*100", label: "5xxErrorByLambdaEdge", id: "e1" }],
                ["AWS/CloudFront", "LambdaExecutionError", "Region", "Global", "DistributionId", mvpDistributionId, { id: "m4", stat: "Sum", visible: false }],
                [".", "LambdaValidationError", ".", ".", ".", ".", { id: "m5", stat: "Sum", visible: false }],
                [".", "LambdaLimitExceededError", ".", ".", ".", ".", { id: "m6", stat: "Sum", visible: false }],
                [".", "Requests", ".", ".", ".", ".", { id: "m7", stat: "Sum", visible: false }],
              ],
              region: "us-east-1",
              title: "CloudFront - Error rate (as a percentage of total requests)",
              yAxis: {
                left: {
                  showUnits: false,
                },
                right: {
                  showUnits: false,
                },
              },
            },
          },
          {
            height: 2,
            width: 24,
            y: 43,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Access Finland MVP - Usage\nStatistics of AF MVP application\n",
              background: "transparent",
            },
          },
          {
            height: 2,
            width: 14,
            y: 55,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Access Finland MVP - Performance\nStatistics of Access Finland MVP application\n",
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 12,
            y: 22,
            x: 0,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/Lambda", "Invocations", "FunctionName", usersApiLambdaId, { region: region }],
                [".", "ConcurrentExecutions", ".", "."],
                [".", "Errors", ".", "."],
              ],
              region: region,
              period: 300,
            },
          },
          {
            height: 7,
            width: 12,
            y: 36,
            x: 0,
            type: "metric",
            properties: {
              metrics: [
                ["AWS/ElastiCache", "CacheMisses", "CacheClusterId", usersApiElastiCacheClusterId, "CacheNodeId", "0001", { region: region }],
                [".", "CPUCreditUsage", ".", ".", ".", ".", { region: region, visible: false }],
                [".", "CacheHits", ".", ".", ".", ".", { region: region }],
                [".", "CPUUtilization", ".", ".", ".", ".", { region: region, visible: false }],
                [".", "NewConnections", ".", ".", ".", ".", { region: region }],
              ],
              view: "timeSeries",
              stacked: false,
              region: region,
              title: "ElastiCache hits",
              period: 300,
              stat: "Average",
            },
          },
          {
            height: 6,
            width: 6,
            y: 14,
            x: 0,
            type: "metric",
            properties: {
              view: "pie",
              metrics: [
                ["VirtualFinland.UsersAPI", "PersonsCountByAudience", "Audience", "6fa88191-477e-4082-a119-e1e3ad09b7be"],
                ["...", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf"],
              ],
              region: region,
              setPeriodToTimeRange: true,
              sparkline: false,
              trend: false,
              title: "Profiles by audience",
            },
          },
          {
            height: 6,
            width: 6,
            y: 14,
            x: 12,
            type: "metric",
            properties: {
              metrics: [
                ["VirtualFinland.UsersAPI", "RequestsTotalPerAudience", "Audience", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf", { region: region }],
                ["...", "6fa88191-477e-4082-a119-e1e3ad09b7be", { region: region }],
              ],
              view: "pie",
              region: region,
              period: 300,
              stat: "Sum",
              title: "Requests per audience",
              setPeriodToTimeRange: true,
              sparkline: false,
              trend: false,
            },
          },
          {
            height: 3,
            width: 24,
            y: 11,
            x: 0,
            type: "text",
            properties: {
              markdown:
                "\n### Apps & Authentication issuers\nWhich application audiences and which authentication issuer were used in the requests\n\n- 6fa88191-477e-4082-a119-e1e3ad09b7be: Access Finland QA (Sinuna)\n- e6a5a645-0cf6-48a1-9f08-3d72be3aceaf: VF DemoApp (Tesbed) ",
              background: "transparent",
            },
          },
          {
            height: 7,
            width: 12,
            y: 36,
            x: 12,
            type: "metric",
            properties: {
              metrics: [
                ["AWS/ElastiCache", "CacheMisses", "CacheClusterId", usersApiElastiCacheClusterId, "CacheNodeId", "0001", { region: region, visible: false }],
                [".", "CPUCreditUsage", ".", ".", ".", ".", { region: region }],
                [".", "CacheHits", ".", ".", ".", ".", { region: region, visible: false }],
                [".", "CPUUtilization", ".", ".", ".", ".", { region: region }],
                [".", "NewConnections", ".", ".", ".", ".", { region: region, visible: false }],
                [".", "CurrConnections", ".", ".", ".", "."],
              ],
              view: "timeSeries",
              stacked: false,
              region: region,
              title: "ElastiCache utilization",
              period: 300,
              stat: "Average",
            },
          },
          {
            height: 8,
            width: 12,
            y: 28,
            x: 0,
            type: "metric",
            properties: {
              period: 300,
              metrics: [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", usersApiDbInstanceIdentifier, { label: usersApiDbInstanceIdentifier, region: region }]],
              region: region,
              stat: "Average",
              title: "Database CPUUtilization",
              yAxis: {
                left: {
                  min: 0,
                },
              },
              view: "timeSeries",
              stacked: false,
            },
          },
          {
            height: 8,
            width: 12,
            y: 28,
            x: 12,
            type: "metric",
            properties: {
              period: 300,
              metrics: [["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", usersApiDbInstanceIdentifier, { label: usersApiDbInstanceIdentifier, region: region }]],
              region: region,
              stat: "Average",
              title: "Database connections",
              yAxis: {
                left: {
                  min: 0,
                },
              },
              view: "timeSeries",
              stacked: false,
            },
          },
          {
            height: 6,
            width: 12,
            y: 57,
            x: 0,
            type: "metric",
            properties: {
              metrics: [
                ["AWS/ECS", "CPUUtilization", "ServiceName", mvpEcsServiceName, "ClusterName", mvpEcsClusterName, { stat: "Minimum" }],
                ["...", { stat: "Maximum" }],
                ["...", { stat: "Average" }],
              ],
              period: 300,
              region: region,
              stacked: false,
              title: "AF MVP - CPU utilization",
              view: "timeSeries",
            },
          },
          {
            height: 6,
            width: 12,
            y: 57,
            x: 12,
            type: "metric",
            properties: {
              metrics: [
                ["AWS/ECS", "MemoryUtilization", "ServiceName", mvpEcsServiceName, "ClusterName", mvpEcsClusterName, { stat: "Minimum" }],
                ["...", { stat: "Maximum" }],
                ["...", { stat: "Average" }],
              ],
              period: 300,
              region: region,
              stacked: false,
              title: "AF MVP - Memory utilization",
              view: "timeSeries",
            },
          },
          {
            height: 6,
            width: 6,
            y: 14,
            x: 18,
            type: "metric",
            properties: {
              view: "pie",
              metrics: [
                ["VirtualFinland.UsersAPI", "RequestsTotalPerIssuer", "Issuer", "https://login.iam.qa.sinuna.fi"],
                ["...", "https://login.testbed.fi"],
              ],
              region: region,
              title: "Requests per issuer",
            },
          },
          {
            height: 6,
            width: 6,
            y: 14,
            x: 6,
            type: "metric",
            properties: {
              view: "pie",
              metrics: [
                ["VirtualFinland.UsersAPI", "PersonsCountByIssuer", "Issuer", "https://login.iam.qa.sinuna.fi"],
                ["...", "https://login.testbed.fi"],
              ],
              region: region,
              title: "Profiles by issuer",
            },
          },
          {
            height: 6,
            width: 12,
            y: 49,
            x: 12,
            type: "metric",
            properties: {
              period: 60,
              metrics: [
                [
                  "AWS/ApplicationELB",
                  "RequestCount",
                  "TargetGroup",
                  "targetgroup/af-alb-tg-mvp-dev-173b693/fab0d0fa476846f7",
                  "LoadBalancer",
                  mvpAlbName,
                  { label: "af-alb-tg-mvp-dev-173b693", region: region },
                ],
              ],
              region: region,
              stat: "Sum",
              title: "Application Load Balancer - Requests",
              yAxis: {
                left: {
                  min: 0,
                },
              },
              view: "timeSeries",
              stacked: false,
            },
          },
          {
            height: 6,
            width: 12,
            y: 63,
            x: 0,
            type: "metric",
            properties: {
              period: 60,
              metrics: [
                [
                  "AWS/ApplicationELB",
                  "TargetResponseTime",
                  "TargetGroup",
                  "targetgroup/af-alb-tg-mvp-dev-173b693/fab0d0fa476846f7",
                  "LoadBalancer",
                  mvpAlbName,
                  { label: "af-alb-tg-mvp-dev-173b693", region: region },
                ],
              ],
              region: region,
              stat: "Average",
              title: "Application Load Balancer - Target Response Time",
              yAxis: {
                left: {
                  min: 0,
                },
              },
              view: "timeSeries",
              stacked: false,
            },
          },
        ],
      })
  ),
});

export const dashboardName = dashboard.dashboardName;
