import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import {DashboardTitle, DashboardTitleSize} from "./templates/dashboardTitle";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: JSON.stringify({
    widgets: [
      new DashboardTitle().create("Virtual Finland Development dashboard", 0, 0),
      new DashboardTitle().create("Users API stats", 0, 10, DashboardTitleSize.MEDIUM)
    ]
  })
});