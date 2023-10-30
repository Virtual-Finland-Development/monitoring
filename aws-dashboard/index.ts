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
            width: 15,
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
            width: 8,
            y: 20,
            x: 6,
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
            width: 14,
            y: 18,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Users API - Performance \nTechinal statistics of the users-api operations\n",
              background: "transparent",
            },
          },
          {
            height: 5,
            width: 7,
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
            width: 14,
            y: 2,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Users API - Usage\nUsage statistics\n",
              background: "transparent",
            },
          },
          {
            height: 5,
            width: 7,
            y: 4,
            x: 7,
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
            height: 5,
            width: 13,
            y: 52,
            x: 0,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/ECS", "CPUUtilization", "ServiceName", mvpEcsServiceName, "ClusterName", mvpEcsClusterName],
                [".", "MemoryUtilization", ".", ".", ".", "."],
              ],
              region: region,
              title: "Access Finland MVP - ECS Performance",
            },
          },
          {
            height: 5,
            width: 7,
            y: 40,
            x: 0,
            type: "metric",
            properties: {
              metrics: [["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", mvpDistributionId, { region: "us-east-1" }]],
              view: "timeSeries",
              stacked: false,
              region: "us-east-1",
              title: "Requests (sum)",
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
            height: 5,
            width: 6,
            y: 40,
            x: 7,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/CloudFront", "BytesUploaded", "Region", "Global", "DistributionId", mvpDistributionId],
                [".", "BytesDownloaded", ".", ".", ".", "."],
              ],
              region: "us-east-1",
              title: "Data transfer",
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
            height: 5,
            width: 13,
            y: 45,
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
              title: "Error rate (as a percentage of total requests)",
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
            width: 14,
            y: 38,
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
            y: 50,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Access Finland MVP - Performance\nStatistics of Access Finland MVP application\n",
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 6,
            y: 20,
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
            height: 6,
            width: 6,
            y: 32,
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
            width: 7,
            y: 12,
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
            width: 7,
            y: 12,
            x: 7,
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
            width: 14,
            y: 9,
            x: 0,
            type: "text",
            properties: {
              markdown:
                "\n### Audiences\nWhich application was used in the request\n\n- 6fa88191-477e-4082-a119-e1e3ad09b7be: Access Finland QA (Sinuna)\n- e6a5a645-0cf6-48a1-9f08-3d72be3aceaf: VF DemoApp (Tesbed) ",
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 8,
            y: 32,
            x: 6,
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
            height: 6,
            width: 6,
            y: 26,
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
            height: 6,
            width: 8,
            y: 26,
            x: 6,
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
        ],
      })
  ),
});

export const dashboardName = dashboard.dashboardName;
