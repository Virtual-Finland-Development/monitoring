import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
const org: string = config.require('org');
const region = new pulumi.Config('aws').require('region');

const escoApiLambdaId = new pulumi.StackReference(`${org}/escoApi/${stack}`).getOutput('escoApiLambdaId');

let resources = pulumi.all([escoApiLambdaId]);

const dashboard = new aws.cloudwatch.Dashboard(`${projectName}-${stack}`, {
  dashboardName: `${projectName}-${stack}`,
  dashboardBody: resources.apply(([escoApiLambdaId]) => JSON.stringify({
    widgets: [
      {
        type: 'text',
        x: 0,
        y: 24,
        width: 15,
        height: 2,
        properties: {
          markdown: '## ESCO API stats',
          background: 'transparent'
        }
      },
      {
        height: 6,
        width: 8,
        y: 26,
        x: 0,
        type: 'metric',
        properties: {
          metrics: [
            [ "AWS/Lambda", "Invocations", "FunctionName", escoApiLambdaId, { "id": "m1", "region": region, "color": "#3e82e5", "label": "ESCO API (Sum)" } ],
          ],
          view: 'timeSeries',
          stacked: false,
          region: region,
          stat: 'Sum',
          period: 300,
        }
      },
      {
        height: 6,
        width: 8,
        y: 26,
        x: 8,
        type: 'metric',
        properties: {
          metrics: [
            [ "AWS/Lambda", "Duration", "FunctionName", escoApiLambdaId, { "id": "m1", "region": region, "color": "#3e82e5", "label": "ESCO API (Avg)", "stat": "Average" } ],
            [ "...", { "id": "m2", "region": region, "color": "#8cc8f3", "label": "ESCO API (Min)" } ],
            [ "...", { "id": "m3", "region": region, "color": "#38549a", "label": "ESCO API (Max)", "stat": "Maximum" } ],
          ],
          view: 'timeSeries',
          stacked: false,
          region: region,
          stat: 'Minimum',
          period: 300
        }
      },
      {
        height: 6,
        width: 16,
        y: 32,
        x: 0,
        type: 'log',
        properties: {
          query: `SOURCE '/aws/lambda/${escoApiLambdaId}' | fields @timestamp, request.path, response.statusCode, errors.0.0.message\n| filter response.statusCode > 0 and response.statusCode != 200\n| sort @timestamp desc\n| limit 20`,
          region: region,
          stacked: false,
          title: 'ESCO API error logs',
          view: 'table'
        }
      },
    ]
  }))
});

export const dashboardName = dashboard.dashboardName;
