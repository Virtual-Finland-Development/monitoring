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

// Static references
const audienceLabels = new pulumi.Config("audienceLabels");

// Access Finland MVP references
const mvpStackReference = new pulumi.StackReference(`${org}/access-finland/${ensurePrefix("mvp-", stack)}`);
const mvpDistributionId = mvpStackReference.getOutput("CloudFrontDistributionId");
const mvpEcsServiceName = mvpStackReference.getOutput("FargateServiceName");
const mvpEcsClusterName = mvpStackReference.getOutput("FargateClusterName");

// Combine all resources to single output that we can use below on the dashboard
const resources = pulumi.all([usersApiDbInstanceIdentifier, usersApiLambdaId, mvpDistributionId, mvpEcsServiceName, mvpEcsClusterName]);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(([usersApiDbInstanceIdentifier, usersApiLambdaId, mvpDistributionId, mvpEcsServiceName, mvpEcsClusterName]) =>
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
          width: 5,
          y: 21,
          x: 0,
          type: "metric",
          properties: {
            view: "gauge",
            metrics: [["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", usersApiDbInstanceIdentifier]],
            region: region,
            setPeriodToTimeRange: false,
            sparkline: true,
            trend: true,
            yAxis: {
              left: {
                min: 0,
                max: 100,
              },
            },
            title: "Database connections",
          },
        },
        {
          height: 6,
          width: 8,
          y: 21,
          x: 5,
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
          y: 19,
          x: 0,
          type: "text",
          properties: {
            markdown: "## Users API - Performance \nTechinal statistics of the users-api operations\n",
            background: "transparent",
          },
        },
        {
          height: 6,
          width: 6,
          y: 7,
          x: 8,
          type: "metric",
          properties: {
            metrics: [
              [
                "VirtualFinland.UsersAPI",
                "RequestsTotalPerAudience",
                "Audience",
                "6fa88191-477e-4082-a119-e1e3ad09b7be",
                { region: region, label: audienceLabels.get("6fa88191-477e-4082-a119-e1e3ad09b7be") },
              ],
              ["...", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf", { region: region, label: audienceLabels.get("e6a5a645-0cf6-48a1-9f08-3d72be3aceaf") }],
            ],
            view: "bar",
            region: region,
            period: 300,
            stat: "Sum",
            title: "Requests total per audiences",
          },
        },
        {
          height: 6,
          width: 9,
          y: 13,
          x: 0,
          type: "metric",
          properties: {
            metrics: [
              ["VirtualFinland.UsersAPI", "PersonsCountByIssuer", "Issuer", "https://login.iam.qa.sinuna.fi", { region: region }],
              ["...", "https://login.testbed.fi", { region: region }],
            ],
            view: "bar",
            region: region,
            setPeriodToTimeRange: true,
            legend: {
              position: "bottom",
            },
            period: 300,
            stat: "Average",
            title: "Profiles count by auth issuer",
          },
        },
        {
          height: 3,
          width: 7,
          y: 4,
          x: 0,
          type: "metric",
          properties: {
            sparkline: false,
            view: "singleValue",
            metrics: [["VirtualFinland.UsersAPI", "PersonsCount", { region: region }]],
            region: region,
            title: "Profiles total",
            period: 300,
            liveData: true,
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
          height: 3,
          width: 8,
          y: 4,
          x: 7,
          type: "metric",
          properties: {
            sparkline: false,
            view: "singleValue",
            metrics: [["VirtualFinland.UsersAPI", "RequestsTotal", { region: region }]],
            region: region,
            liveData: true,
            title: "Requests total",
            period: 300,
            stat: "Sum",
          },
        },
        {
          height: 6,
          width: 8,
          y: 7,
          x: 0,
          type: "metric",
          properties: {
            metrics: [
              [
                "VirtualFinland.UsersAPI",
                "PersonsCountByAudience",
                "Audience",
                "6fa88191-477e-4082-a119-e1e3ad09b7be",
                { region: region, label: audienceLabels.get("6fa88191-477e-4082-a119-e1e3ad09b7be") },
              ],
              ["...", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf", { region: region, label: audienceLabels.get("e6a5a645-0cf6-48a1-9f08-3d72be3aceaf") }],
            ],
            view: "bar",
            region: region,
            period: 300,
            stat: "Sum",
            title: "Profiles count by audiences",
          },
        },
        {
          height: 6,
          width: 6,
          y: 39,
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
            title: "Access Finland MVP - Performance",
          },
        },
        {
          height: 8,
          width: 7,
          y: 29,
          x: 0,
          type: "metric",
          properties: {
            view: "timeSeries",
            stacked: false,
            metrics: [["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", mvpDistributionId]],
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
          },
        },
        {
          height: 8,
          width: 6,
          y: 29,
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
          height: 8,
          width: 8,
          y: 29,
          x: 13,
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
          y: 27,
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
          y: 37,
          x: 0,
          type: "text",
          properties: {
            markdown: "## Access Finland MVP - Performance\nStatistics of AF MVP application\n",
            background: "transparent",
          },
        },
      ],
    })
  ),
});

export const dashboardName = dashboard.dashboardName;
