
import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import {getRoleForLambda} from "./getRoleForLambda";

// General setup
const stack = pulumi.getStack();
const projectName = pulumi.getProject();
const config = new pulumi.Config();
let artifactPath = config.get('applicationArtifactPath') ?? 'src/bin/Release/net6.0/src.zip'

let tags = {
    'vfd:stack': stack,
    'vfd:project': projectName,
};


let iamForLambda = getRoleForLambda(projectName, stack, tags);

// Create CloudWatch log group where logs will be saved
const logGroup = new aws.cloudwatch.LogGroup(`/aws/cloudfront/${projectName}-${stack}`, {
    tags: tags
})

// Create Lambda function for forwarding logs 
const lambdaFunction = new aws.lambda.Function(`${projectName}-${stack}`, {
    code: new pulumi.asset.FileArchive(artifactPath),
    role: iamForLambda.arn,
    handler: 'cloudfront-log-forwarder::CloudFrontLogForwarder.Functions::FunctionHandler',
    runtime: 'dotnet6',
    environment: {
        variables: {
            logGroupName: logGroup.name,
            logStreamName: `${projectName}-log-stream-${stack}`
        }
    },
    memorySize: 128,
    timeout: 10,
    tags: tags
});

let org: string = 'virtualfinland';
const codesetsStackReference = new pulumi.StackReference(`${org}/codesets/${stack}`);
const standardLogsBucketDetails = codesetsStackReference.getOutput('standardLogsBucketDetails');

// Create Role and policies required by Lambda function
const lambdaBucketPermission = new aws.lambda.Permission(`${projectName}-lambda-permission-${stack}`, {
    action: 'lambda:InvokeFunction',
    function: lambdaFunction.arn,
    principal: 's3.amazonaws.com',
    sourceArn: standardLogsBucketDetails.apply(o => o.arn.toString())
}, {
    dependsOn: [codesetsStackReference]
})

new aws.s3.BucketNotification(`${projectName}-notification-${stack}`, {
    bucket: standardLogsBucketDetails.apply(o => o.id.toString()),
    lambdaFunctions: [{
        lambdaFunctionArn: lambdaFunction.arn,
        events: ['s3:ObjectCreated:Put'],
        filterSuffix: '.gz'
    }]
}, {
    dependsOn: [lambdaBucketPermission, codesetsStackReference]
});

// noinspection JSUnusedGlobalSymbols
export const logGroupName = logGroup.name;
