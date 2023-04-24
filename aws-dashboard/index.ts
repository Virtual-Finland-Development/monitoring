import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {DashboardTitle, DashboardTitleSize} from "./templates/dashboardTitle";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require('org');

// Stack references
const usersApiDb = new pulumi.StackReference(`${org}/users-api/${stack}`);

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: JSON.stringify({
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
            [ "AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", usersApiDb.getOutput('dbIdentifier') ]
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
      }
    ]
  })
});