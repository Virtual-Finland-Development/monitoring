import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const organization = pulumi.getOrganization();
const project = pulumi.getProject();
const stack = pulumi.getStack();

function getTags(resourceName: string) {
  return {
    "vfd:stack": stack,
    "vfd:project": project,
    "vfd:name": resourceName,
  };
}

function getResourceName(name: string) {
  return `${project}-${name}-${stack}`;
}

function parseDomainFromUrl(url: string) {
  const urlObject = new URL(url);
  return urlObject.hostname;
}

const requestInterval = 30;

const usersApi = new pulumi.StackReference(`${organization}/users-api/${stack}`).getOutput("ApplicationUrl");
const escoApi = new pulumi.StackReference(`${organization}/esco-api/${stack}`).getOutput("escoApiUrl");
const codesets = new pulumi.StackReference(`${organization}/codesets/${stack}`).getOutput("url");
const accessFinland = new pulumi.StackReference(`${organization}/access-finland/${stack == "dev" ? "mvp-dev" : stack}`).getOutput("url");

pulumi.all([usersApi, escoApi, codesets, accessFinland]).apply(async ([usersApi, escoApi, codesets, accessFinland]) => {
  new aws.route53.HealthCheck(getResourceName("users-api"), {
    referenceName: "users-api",
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(usersApi),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags: getTags("users-api"),
    measureLatency: true,
  });

  new aws.route53.HealthCheck(getResourceName("esco-api"), {
    referenceName: "esco-api",
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(escoApi),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags: getTags("esco-api"),
    measureLatency: true,
  });

  new aws.route53.HealthCheck(getResourceName("codesets"), {
    referenceName: "codesets",
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(codesets),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags: getTags("codesets"),
    measureLatency: true,
  });

  new aws.route53.HealthCheck(getResourceName("access-finland"), {
    referenceName: "access-finland",
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(accessFinland),
    port: 443,
    requestInterval,
    resourcePath: "/api/health-check",
    type: "HTTPS",
    tags: getTags("access-finland"),
    measureLatency: true,
  });
});
