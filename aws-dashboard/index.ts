import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

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
            markdown: "## Users API performance \nTechinal statistics of the users-api operations\n\n",
            background: "transparent",
          },
        },
        {
          height: 6,
          width: 6,
          y: 7,
          x: 0,
          type: "metric",
          properties: {
            metrics: [
              ["VirtualFinland.UsersAPI", "RequestsTotalPerAudience", "Audience", "6fa88191-477e-4082-a119-e1e3ad09b7be", { region: region, label: "Access Finland QA - Sinuna" }],
              ["...", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf", { region: region, label: "Testbed" }],
            ],
            view: "bar",
            region: region,
            period: 300,
            start: "-PT3H",
            stat: "Sum",
            end: "P0D",
          },
        },
        {
          height: 6,
          width: 12,
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
              position: "right",
            },
            period: 300,
            stat: "Average",
          },
        },
        {
          height: 3,
          width: 7,
          y: 2,
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
          y: 5,
          x: 0,
          type: "text",
          properties: {
            markdown: "## Users API usage\nSpecific usage statistics\n",
            background: "transparent",
          },
        },
        {
          height: 3,
          width: 8,
          y: 2,
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
          },
        },
        {
          type: "metric",
          x: 6,
          y: 7,
          width: 8,
          height: 6,
          properties: {
            metrics: [
              ["VirtualFinland.UsersAPI", "PersonsCountByAudience", "Audience", "6fa88191-477e-4082-a119-e1e3ad09b7be", { region: region, label: "Access Finland QA - Sinuna" }],
              ["...", "e6a5a645-0cf6-48a1-9f08-3d72be3aceaf", { region: region, label: "Testbed" }],
            ],
            view: "bar",
            region: region,
            period: 300,
            stat: "Average",
          },
        },
      ],
    })
  ),
});

export const dashboardName = dashboard.dashboardName;
