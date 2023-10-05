import * as aws from "@pulumi/aws";
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

const resourcesRegion = new pulumi.Config("aws").require("region");
const resourcesRegionProvider = new aws.Provider(`region-${resourcesRegion}`, {
  region: resourcesRegion as pulumi.Input<aws.Region> | undefined,
});

const setup = {
  stage,
  projectName,
  organizationName,
  getResourceConfig,
  getResourceName,
  isProductionLikeEnvironment,
  regions: {
    resourcesRegion: {
      name: resourcesRegion,
      provider: resourcesRegionProvider,
    },
  },
};

type ISetup = typeof setup;
function getSetup() {
  return setup;
}

export { ISetup, getSetup };
