import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {DashboardTitle, DashboardTitleSize} from "./templates/dashboardTitle";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require('org');

// Stack references
const usersApiDb = new pulumi.StackReference(`${org}/users-api/${stack}`);

const usersApiDbIdentifier = usersApiDb.getOutputDetails('DbIdentifier');

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: JSON.stringify({
    widgets: [
      new DashboardTitle().withBody("Useful graphs and metrics for monitoring Virtual Finland services").create("Virtual Finland Development dashboard", 0, 0),
      new DashboardTitle().create("Users API stats", 0, 10, DashboardTitleSize.MEDIUM)
    ]
  })
});