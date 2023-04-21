import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();

// noinspection JSUnusedLocalSymbols
const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: JSON.stringify({
    widgets: [
      {
        type: "text",
        x: 0,
        y: 7,
        width: 3,
        height: 3,
        properties: {
          markdown: "Users API dashboard",
        },
      }
    ]
  })
});