import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { DashboardTitle, DashboardTitleSize } from "./templates/dashboardTitle";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require("org");
const region = new pulumi.Config("aws").require("region");

// Stack references
const usersApiStackReference = new pulumi.StackReference(`${org}/users-api/${stack}`);
const usersApiDbInstanceIdentifier = usersApiStackReference.getOutput("DBIdentifier").apply((v) => v.toString());
const usersApiLambdaId = usersApiStackReference.getOutput("LambdaId").apply((v) => v.toString());

// Combine all resources to single output that we can use below on the dashboard
const resources = pulumi.all([usersApiDbInstanceIdentifier, usersApiLambdaId]);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(([usersApiDbInstanceIdentifier, usersApiLambdaId]) =>
    JSON.stringify({
      widgets: [
        new DashboardTitle().withBody("Useful graphs and metrics for monitoring Virtual Finland services").create("Virtual Finland Development dashboard", 0, 0),
        new DashboardTitle().create("Users API stats", 0, 10, DashboardTitleSize.MEDIUM),
        {
          height: 5,
          width: 4,
          y: 2,
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
          },
        },
        {
          height: 8,
          width: 15,
          y: 15,
          x: 0,
          type: "log",
          properties: {
            query: `SOURCE '/aws/lambda/${usersApiLambdaId}' | fields @timestamp, @@x, StatusCode, Elapsed\n| filter StatusCode = 500\n| sort @timestamp desc\n| limit 20`,
            region: region,
            stacked: false,
            title: "Users API errors",
            view: "table",
          },
        },
        {
          height: 6,
          width: 7,
          y: 2,
          x: 7,
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
      ],
    })
  ),
});

export const dashboardName = dashboard.dashboardName;
