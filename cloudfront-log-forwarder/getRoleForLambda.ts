import * as aws from "@pulumi/aws";
import {ManagedPolicies} from "@pulumi/aws/iam";
import AWSLambdaBasicExecutionRole = ManagedPolicies.AWSLambdaBasicExecutionRole;

export function getRoleForLambda(projectName: string, stack: string, tags: any): aws.iam.Role {

    const assumeRolePolicy = aws.iam.getPolicyDocument({
        statements: [
            {
                effect: 'Allow',
                principals: [{type: 'Service', identifiers: ['lambda.amazonaws.com']}],
                actions: ['sts:AssumeRole']
            }]
    });

    const role = new aws.iam.Role(`${projectName}-lambda-role-${stack}`, {
        assumeRolePolicy: assumeRolePolicy.then(assumeRole => assumeRole.json),
        tags: tags
    })

    new aws.iam.RolePolicyAttachment(`${projectName}-lambdaBasicExecutionRolePolicy-${stack}`, {
        role: role,
        policyArn: AWSLambdaBasicExecutionRole
    });

    let policy = new aws.iam.RolePolicy(`${projectName}-allowLambdaAccessToS3AndCloudWatch-${stack}`, {
        role: role,
        policy: JSON.stringify({
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject"
                    ],
                    "Resource": "*"
                },
                {
                    "Effect": "Allow",
                    "Action": [
                        "logs:CreateLogGroup",
                        "logs:CreateLogStream",
                        "logs:DescribeLogGroups",
                        "logs:DescribeLogStreams",
                        "logs:PutLogEvents",
                        "logs:GetLogEvents",
                        "logs:FilterLogEvents"
                    ],
                    "Resource": ["*"]
                }
            ]
        })
    })
    
    return role;
}
