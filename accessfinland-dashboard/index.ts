import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
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

// Codesets
const codesetsStackReference = new pulumi.StackReference(`${org}/codesets/${stack}`);
const codesetsLambdaId = codesetsStackReference.getOutput("lambdaId");
const codesetsDistributionId = codesetsStackReference.getOutput("cloudFrontDistributionId");
const forwarderLogGroupName = new pulumi.StackReference(`${org}/cloudfront-log-forwarder/${stack}`).getOutput("logGroupName");

// Static references
const audiences = JSON.parse(fs.readFileSync("./data/audiences.json", "utf8")) as Array<{ audience: string; description: string }>;
function constructMetricsFor(metricName: string, dimensionName: string, dimensionValue: string) {
  return ["VirtualFinland.UsersAPI", metricName, dimensionName, dimensionValue, { region: region }];
}

// Access Finland MVP references
const mvpStackReference = new pulumi.StackReference(`${org}/access-finland/${ensurePrefix("mvp-", stack)}`);
const mvpDistributionId = mvpStackReference.getOutput("CloudFrontDistributionId");
const mvpEcsServiceName = mvpStackReference.getOutput("FargateServiceName");
const mvpEcsClusterName = mvpStackReference.getOutput("EcsClusterName");
const mvpAlbArn = mvpStackReference.getOutput("AppLoadBalancerArn");
const mvpCognitoPoolId = mvpStackReference.getOutput("CognitoUserPoolId");
const mvpCognitoPoolClientId = mvpStackReference.getOutput("CongitoUserPoolClientId");

// Combine all resources to single output that we can use below on the dashboard
const resources = pulumi.all([
  usersApiDbInstanceIdentifier,
  usersApiLambdaId,
  mvpDistributionId,
  mvpEcsServiceName,
  mvpEcsClusterName,
  mvpAlbArn,
  usersApiElastiCacheClusterId,
  mvpCognitoPoolId,
  mvpCognitoPoolClientId,
  codesetsLambdaId,
  codesetsDistributionId,
  forwarderLogGroupName,
]);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(
    ([
      usersApiDbInstanceIdentifier,
      usersApiLambdaId,
      mvpDistributionId,
      mvpEcsServiceName,
      mvpEcsClusterName,
      mvpAlbArn,
      usersApiElastiCacheClusterId,
      mvpCognitoPoolId,
      mvpCognitoPoolClientId,
      codesetsLambdaId,
      codesetsDistributionId,
      forwarderLogGroupName,
    ]) => {
      // Extract the resource ID from the ARN
      const mvpAlbId = mvpAlbArn.substring(mvpAlbArn.indexOf("/") + 1);

      // Prep metrics by the static ref data
      const requestTotalByAudienceMetrics = audiences.map((audience) => constructMetricsFor("RequestsTotalPerAudience", "Audience", audience.audience));
      const personsCountByAudienceMetrics = audiences.map((audience) => constructMetricsFor("PersonsCountByAudience", "Audience", audience.audience));

      // Form up the disclaimer table
      const disclaimerTableAudiences = audiences.map((a) => `\`${a.audience}\` | ${a.description}`).join("\n");
      const disclaimerTable = `Audience | Name\n----|-----\n${disclaimerTableAudiences}`;

      return JSON.stringify({
        widgets: [
          {
            height: 2,
            width: 24,
            y: 0,
            x: 0,
            type: "text",
            properties: {
              markdown: "# Access Finland dashboard\nUseful graphs and metrics for monitoring Access Finland services",
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 12,
            y: 25,
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
            y: 23,
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
            y: 48,
            x: 0,
            type: "metric",
            properties: {
              metrics: [["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", mvpDistributionId, { region: region }]],
              view: "timeSeries",
              stacked: false,
              region: region,
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
            y: 48,
            x: 12,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/CloudFront", "BytesUploaded", "Region", "Global", "DistributionId", mvpDistributionId],
                [".", "BytesDownloaded", ".", ".", ".", "."],
              ],
              region: region,
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
            y: 52,
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
              region: region,
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
            y: 46,
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
            y: 64,
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
            y: 25,
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
            y: 39,
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
            y: 13,
            x: 0,
            type: "metric",
            properties: {
              view: "pie",
              metrics: personsCountByAudienceMetrics,
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
            y: 13,
            x: 6,
            type: "metric",
            properties: {
              metrics: requestTotalByAudienceMetrics,
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
            height: 2,
            width: 24,
            y: 11,
            x: 0,
            type: "text",
            properties: {
              markdown: "### Apps & Authentication issuers\nWhich application audiences and which authentication issuer were used in the requests.\n",
              background: "transparent",
            },
          },
          {
            height: 7,
            width: 12,
            y: 39,
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
            y: 31,
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
            y: 31,
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
            y: 66,
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
            y: 66,
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
            width: 12,
            y: 72,
            x: 0,
            type: "metric",
            properties: {
              metrics: [["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", mvpAlbId, { region: region }]],
              period: 60,
              region: region,
              stat: "Sum",
              title: "ELB - Target response time",
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
            y: 58,
            x: 0,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [["AWS/Cognito", "SignInSuccesses", "UserPool", mvpCognitoPoolId, "UserPoolClient", mvpCognitoPoolClientId]],
              region: region,
              title: "Cognito - SignInSuccesses",
            },
          },
          {
            height: 6,
            width: 12,
            y: 52,
            x: 12,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", mvpAlbId]],
              region: region,
              title: "ELB - RequestCount",
            },
          },
          {
            height: 6,
            width: 12,
            y: 58,
            x: 12,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [["AWS/ApplicationELB", "ProcessedBytes", "LoadBalancer", mvpAlbId]],
              region: region,
              title: "ELB - ProcessedBytes",
            },
          },
          {
            height: 4,
            width: 12,
            y: 19,
            x: 0,
            type: "text",
            properties: {
              markdown: disclaimerTable,
              background: "transparent",
            },
          },
          {
            height: 6,
            width: 12,
            y: 13,
            x: 12,
            type: "metric",
            properties: {
              view: "pie",
              metrics: [[{ expression: 'SELECT SUM(RequestsPerContext) FROM SCHEMA("VirtualFinland.UsersAPI", Context) GROUP BY Context', label: "", id: "q1" }]],
              region: region,
              stat: "Average",
              period: 300,
              legend: {
                position: "right",
              },
              title: "Requests by context",
            },
          },
          {
            height: 2,
            width: 24,
            y: 78,
            x: 0,
            type: "text",
            properties: {
              markdown: "## Codesets API monitoring",
              background: "transparent",
            },
          },
          {
            height: 8,
            width: 8,
            y: 80,
            x: 0,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", codesetsDistributionId]],
              region: region,
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
            },
          },
          {
            height: 8,
            width: 8,
            y: 80,
            x: 8,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                [
                  "AWS/Lambda",
                  "Invocations",
                  "FunctionName",
                  `us-east-1.${codesetsLambdaId.split(":")[0]}`,
                  "Resource",
                  `us-east-1.${codesetsLambdaId}`,
                  { id: "m1", visible: true, label: "US-East (N. Virginia)" },
                ],
                ["...", { region: "us-east-2", id: "m2", visible: true, label: "US-East (Ohio)" }],
                ["...", { region: "us-west-1", id: "m3", visible: true, label: "US-West (N. California)" }],
                ["...", { region: "us-west-2", id: "m4", visible: true, label: "US-West (Oregon)" }],
                ["...", { region: "ap-south-1", id: "m5", visible: true, label: "Asia Pacific (Mumbai)" }],
                ["...", { region: "ap-northeast-1", id: "m6", visible: true, label: "Asia Pacific (Tokyo)" }],
                ["...", { region: "ap-northeast-2", id: "m7", visible: true, label: "Asia Pacific (Seoul)" }],
                ["...", { region: "ap-southeast-1", id: "m8", visible: true, label: "Asia Pacific (Singapore)" }],
                ["...", { region: "ap-southeast-2", id: "m9", visible: true, label: "Asia Pacific (Sydney)" }],
                ["...", { region: "eu-west-1", id: "m10", visible: true, label: "EU (Ireland)" }],
                ["...", { region: "eu-west-2", id: "m11", visible: true, label: "EU (London)" }],
                ["...", { region: "eu-central-1", id: "m12", visible: true, label: "EU (Frankfurt)" }],
                ["...", { region: "sa-east-1", id: "m13", visible: true, label: "South America (Sao Paulo)" }],
                [{ expression: "(m1+m2+m3+m4+m5+m6+m7+m8+m9+m10+m11+m12+m13)", label: "Global (sum)" }],
              ],
              region: region,
              title: "Invocations (sum)",
              period: 300,
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
            height: 8,
            width: 8,
            y: 80,
            x: 16,
            type: "metric",
            properties: {
              view: "timeSeries",
              stacked: false,
              metrics: [
                ["AWS/CloudFront", "TotalErrorRate", "Region", "Global", "DistributionId", codesetsDistributionId],
                [".", "4xxErrorRate", ".", ".", ".", ".", { label: "Total4xxErrors" }],
                [".", "5xxErrorRate", ".", ".", ".", ".", { label: "Total5xxErrors" }],
                [{ expression: "(m4+m5+m6)/m7*100", label: "5xxErrorByLambdaEdge", id: "e1" }],
                ["AWS/CloudFront", "LambdaExecutionError", "Region", "Global", "DistributionId", codesetsDistributionId, { id: "m4", stat: "Sum", visible: false }],
                [".", "LambdaValidationError", ".", ".", ".", ".", { id: "m5", stat: "Sum", visible: false }],
                [".", "LambdaLimitExceededError", ".", ".", ".", ".", { id: "m6", stat: "Sum", visible: false }],
                [".", "Requests", ".", ".", ".", ".", { id: "m7", stat: "Sum", visible: false }],
              ],
              region: region,
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
            height: 6,
            width: 8,
            y: 88,
            x: 8,
            type: "log",
            properties: {
              query:
                "SOURCE '" +
                forwarderLogGroupName +
                "' | #fields `x-edge-detailed-result-type` | stats count() by `x-edge-detailed-result-type`\nfields `x-edge-location` as x_edge_location | stats count() by x_edge_location ",
              region: region,
              title: "CloudFront distribution edge locations hit",
              view: "pie",
            },
          },
          {
            height: 6,
            width: 8,
            y: 88,
            x: 0,
            type: "log",
            properties: {
              query: "SOURCE '" + forwarderLogGroupName + "' | fields `x-edge-detailed-result-type` | stats count() by `x-edge-detailed-result-type`",
              region: region,
              title: "CloudFront distribution hit results",
              view: "pie",
            },
          },
        ],
      });
    }
  ),
});

export const dashboardName = dashboard.dashboardName;
