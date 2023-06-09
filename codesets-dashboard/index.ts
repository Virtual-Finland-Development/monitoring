import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require('org');

const codesetsStackReference = new pulumi.StackReference(`${org}/codesets/${stack}`);
const codesetsLambdaId = codesetsStackReference.getOutput('lambdaId').apply(v => v.toString());
const codesetsDistributionId = codesetsStackReference.getOutput('cloudFrontDistributionId').apply(v => v.toString());

const cloudfrontLogForwarderStackReference = new pulumi.StackReference(`${org}/cloudfront-log-forwarder/${stack}`);
const forwarderLogGroupName = cloudfrontLogForwarderStackReference.getOutput('logGroupName').apply(v => v.toString());

let resources = pulumi.all([codesetsLambdaId, codesetsDistributionId, forwarderLogGroupName]);

const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(([codesetsLambdaId, codesetsDistributionId, forwarderLogGroupName]) => JSON.stringify({
    widgets: [
      {
        type: 'text',
        x: 0,
        y: 0,
        width: 15,
        height: 2,
        properties: {
          markdown: '## Codesets API monitoring',
          background: 'transparent'
        }
      },
      {
        type: "metric",
        x: 0,
        y: 2,
        width: 8,
        height: 8,
        properties: {
          view: "timeSeries",
          stacked: false,
          metrics: [
            ["AWS/CloudFront", "Requests", "Region", "Global", "DistributionId", codesetsDistributionId]
          ],
          region: "us-east-1",
          title: "Requests (sum)",
          yAxis: {
            left: {
              showUnits: false
            },
            right: {
              showUnits: false
            }
          },
          stat: "Sum"
        }
      },
      {
        type: "metric",
        x: 8,
        y: 2,
        width: 8,
        height: 8,
        properties: {
          view: "timeSeries",
          stacked: false,
          metrics: [
            ["AWS/Lambda", "Invocations", "FunctionName", `us-east-1.${codesetsLambdaId.split(":")[0]}`, "Resource", `us-east-1.${codesetsLambdaId}`, {
              id: "m1",
              visible: true,
              label: "US-East (N. Virginia)"
            }],
            ["...", {region: "us-east-2", id: "m2", visible: true, label: "US-East (Ohio)"}],
            ["...", {region: "us-west-1", id: "m3", visible: true, label: "US-West (N. California)"}],
            ["...", {region: "us-west-2", id: "m4", visible: true, label: "US-West (Oregon)"}],
            ["...", {region: "ap-south-1", id: "m5", visible: true, label: "Asia Pacific (Mumbai)"}],
            ["...", {region: "ap-northeast-1", id: "m6", visible: true, label: "Asia Pacific (Tokyo)"}],
            ["...", {region: "ap-northeast-2", id: "m7", visible: true, label: "Asia Pacific (Seoul)"}],
            ["...", {region: "ap-southeast-1", id: "m8", visible: true, label: "Asia Pacific (Singapore)"}],
            ["...", {region: "ap-southeast-2", id: "m9", visible: true, label: "Asia Pacific (Sydney)"}],
            ["...", {region: "eu-west-1", id: "m10", visible: true, label: "EU (Ireland)"}],
            ["...", {region: "eu-west-2", id: "m11", visible: true, label: "EU (London)"}],
            ["...", {region: "eu-central-1", id: "m12", visible: true, label: "EU (Frankfurt)"}],
            ["...", {region: "sa-east-1", id: "m13", visible: true, label: "South America (Sao Paulo)"}],
            [{expression: "(m1+m2+m3+m4+m5+m6+m7+m8+m9+m10+m11+m12+m13)", label: "Global (sum)"}]
          ],
          region: "us-east-1",
          title: "Invocations (sum)",
          period: 300,
          yAxis: {
            left: {
              showUnits: false
            },
            right: {
              showUnits: false
            }
          },
          stat: "Sum"
        }
      },
      {
        height: 8,
        width: 8,
        y: 10,
        x: 0,
        type: "metric",
        properties: {
          view: "timeSeries",
          stacked: false,
          metrics: [
            [ "AWS/CloudFront", "TotalErrorRate", "Region", "Global", "DistributionId", codesetsDistributionId ],
            [ ".", "4xxErrorRate", ".", ".", ".", ".", { label: "Total4xxErrors" } ],
            [ ".", "5xxErrorRate", ".", ".", ".", ".", { label: "Total5xxErrors" } ],
            [ { expression: "(m4+m5+m6)/m7*100", label: "5xxErrorByLambdaEdge", id: "e1" } ],
            [ "AWS/CloudFront", "LambdaExecutionError", "Region", "Global", "DistributionId", codesetsDistributionId, { id: "m4", stat: "Sum", visible: false } ],
            [ ".", "LambdaValidationError", ".", ".", ".", ".", { id: "m5", stat: "Sum", visible: false } ],
            [ ".", "LambdaLimitExceededError", ".", ".", ".", ".", { id: "m6", stat: "Sum", visible: false } ],
            [ ".", "Requests", ".", ".", ".", ".", { id: "m7", stat: "Sum", visible: false } ]
          ],
          region: "us-east-1",
          title: "Error rate (as a percentage of total requests)",
          yAxis: {
            left: {
              showUnits: false
            },
            right: {
              showUnits: false
            }
          }
        }
      },
      {
        height: 6,
        width: 8,
        y: 18,
        x: 0,
        type: "log",
        properties: {
          query: "SOURCE '" + forwarderLogGroupName + "' | #fields `x-edge-detailed-result-type` | stats count() by `x-edge-detailed-result-type`\nfields `x-edge-location` as x_edge_location | stats count() by x_edge_location ",
          region: "eu-north-1",
          title: "CloudFront distribution edge locations hit",
          view: "pie"
        }
      },
      {
        height: 6,
        width: 8,
        y: 18,
        x: 8,
        type: "log",
        properties: {
          query: "SOURCE '" + forwarderLogGroupName + "' | fields `x-edge-detailed-result-type` | stats count() by `x-edge-detailed-result-type`",
          region: "eu-north-1",
          title: "CloudFront distribution hit results",
          view: "pie"
        }
      }
    ]
  }))
});

export const dashboardName = dashboard.dashboardName;
