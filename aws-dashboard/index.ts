import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {DashboardTitle, DashboardTitleSize} from "./templates/dashboardTitle";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require('org');

// Stack references
const usersApiStackReference = new pulumi.StackReference(`${org}/users-api/${stack}`);
const usersApiDbInstanceIdentifier = usersApiStackReference.getOutput('DbIdentifier').apply(v => v.toString());
const usersApiLambdaId = usersApiStackReference.getOutput('LambdaId').apply(v => v.toString());

const testbedApiStackReference = new pulumi.StackReference(`${org}/testbed-api/${stack}`);
const testbedApiLambdaId = testbedApiStackReference.getOutput('LambdaId').apply(v => v.toString());

const codesetsStackReference = new pulumi.StackReference(`${org}/codesets/${stack}`);
const codesetsLambdaId = codesetsStackReference.getOutput('lambdaId').apply(v => v.toString());
const codesetsDistributionId = codesetsStackReference.getOutput('cloudFrontDistributionId').apply(v => v.toString());

// Combine all resources to single output that we can use below on the dashboard
let resources = pulumi.all([
  usersApiDbInstanceIdentifier,
  usersApiLambdaId,
  testbedApiLambdaId,
  codesetsLambdaId,
  codesetsDistributionId
]);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(([usersApiDbInstanceIdentifier, usersApiLambdaId, testbedApiLambdaId, codesetsLambdaId, codesetsDistributionId]) =>
    JSON.stringify({
      widgets: [
        new DashboardTitle().withBody("Useful graphs and metrics for monitoring Virtual Finland services").create("Virtual Finland Development dashboard", 0, 0),
        new DashboardTitle().create("Users API stats", 0, 10, DashboardTitleSize.MEDIUM),
        {
          "height": 5,
          "width": 4,
          "y": 2,
          "x": 0,
          "type": "metric",
          "properties": {
            "view": "gauge",
            "metrics": [
              ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", usersApiDbInstanceIdentifier]
            ],
            "region": config.require('region'),
            "setPeriodToTimeRange": false,
            "sparkline": true,
            "trend": true,
            "yAxis": {
              "left": {
                "min": 0,
                "max": 100
              }
            }
          }
        },
        {
          "height": 8,
          "width": 15,
          "y": 15,
          "x": 0,
          "type": "log",
          "properties": {
            "query": `SOURCE '/aws/lambda/${usersApiLambdaId}' | fields @timestamp, @@x, StatusCode, Elapsed\n| filter StatusCode = 500\n| sort @timestamp desc\n| limit 20`,
            "region": "eu-north-1",
            "stacked": false,
            "title": "Users API errors",
            "view": "table"
          }
        },
        {
          "height": 6,
          "width": 7,
          "y": 2,
          "x": 7,
          "type": "metric",
          "properties": {
            "metrics": [
              [ "AWS/Lambda", "Duration", "FunctionName", usersApiLambdaId, { "id": "m1", "region": "eu-north-1", "color": "#3e82e5", "label": "Users API (Avg)", "stat": "Average" } ],
              [ "...", { "id": "m2", "region": "eu-north-1", "color": "#8cc8f3", "label": "Users API (Min)" } ],
              [ "...", { "id": "m3", "region": "eu-north-1", "color": "#38549a", "label": "Users API (Max)", "stat": "Maximum" } ],
              [ ".", ".", ".", testbedApiLambdaId, { "stat": "Average", "color": "#c5b0d5", "label": "Testbed API (Avg)" } ],
              [ "...", { "color": "#f7b6d2", "label": "Testbed API (Min)" } ],
              [ "...", { "stat": "Maximum", "color": "#d62728", "label": "Testbed API (Max)" } ]
            ],
            "view": "timeSeries",
            "stacked": false,
            "region": "eu-north-1",
            "stat": "Minimum",
            "period": 300
          }
        }
      ]
    }))
});

export const dashboardName = dashboard.dashboardName;
