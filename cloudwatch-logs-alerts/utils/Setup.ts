import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();
const projectName = pulumi.getProject();
const organizationName = pulumi.getOrganization();

function getResourceConfig(name: string) {
  return {
    name: getResourceName(name),
    tags: {
      "vfd:stack": stage,
      "vfd:project": projectName,
    },
  };
}

function getResourceName(name: string) {
  return `${projectName}-${name}-${stage}`;
}

function isProductionLikeEnvironment() {
  return stage.endsWith("production") || stage.endsWith("staging");
}

const setup = {
  stage,
  projectName,
  organizationName,
  getResourceConfig,
  getResourceName,
  isProductionLikeEnvironment,
};

type ISetup = typeof setup;

function getSetup() {
  return setup;
}

export { ISetup, getSetup };
