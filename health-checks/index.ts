import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const organization = pulumi.getOrganization();
const project = pulumi.getProject();
const stack = pulumi.getStack();
const tags = {
  "vfd:stack": stack,
  "vfd:project": project,
};
function getResourceName(name: string) {
  return `${project}-${name}-${stack}`;
}

function parseDomainFromUrl(url: string) {
  const urlObject = new URL(url);
  return urlObject.hostname;
}

const requestInterval = 30;
const referenceName = "health-checks";

const usersApi = new pulumi.StackReference(`${organization}/users-api/${stack}`).getOutput("ApplicationUrl");
const escoApi = new pulumi.StackReference(`${organization}/esco-api/${stack}`).getOutput("escoApiUrl");
const codesets = new pulumi.StackReference(`${organization}/codesets/${stack}`).getOutput("url");
const accessFinland = new pulumi.StackReference(`${organization}/access-finland/${stack == "dev" ? "mvp-dev" : stack}`).getOutput("url");

pulumi.all([usersApi, escoApi, codesets, accessFinland]).apply(async ([usersApi, escoApi, codesets, accessFinland]) => {
  new aws.route53.HealthCheck(getResourceName("users-api"), {
    referenceName,
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(usersApi),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags,
  });

  new aws.route53.HealthCheck(getResourceName("esco-api"), {
    referenceName,
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(escoApi),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags,
  });

  new aws.route53.HealthCheck(getResourceName("codesets"), {
    referenceName,
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(codesets),
    port: 443,
    requestInterval,
    resourcePath: "/health-check",
    type: "HTTPS",
    tags,
  });

  new aws.route53.HealthCheck(getResourceName("access-finland"), {
    referenceName,
    failureThreshold: 3,
    fqdn: parseDomainFromUrl(accessFinland),
    port: 443,
    requestInterval,
    resourcePath: "/api/health-check",
    type: "HTTPS",
    tags,
  });
});
