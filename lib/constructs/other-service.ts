import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Construct } from "constructs";
import * as path from "path";
import {
  EVENT_STORE_EXTERNAL_TCP_PORT,
  EVENT_STORE_HTTP_PORT,
} from "./event-store";

export type OtherServiceProps = {
  vpc: IVpc;
  eventStoreConnections: ec2.IConnectable;
};

export class OtherServiceConstruct extends Construct {
  constructor(scope: Construct, id: string, props: OtherServiceProps) {
    super(scope, id);

    const cluster = new ecs.Cluster(this, "OtherServiceCluster", {
      vpc: props.vpc,
    });

    const asset = new DockerImageAsset(this, "OtherServiceDockerImage", {
      directory: path.join(__dirname, "../../"),
      file: "./src/OtherService/Dockerfile",
    });

    const taskDefinition: ecs.TaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "OtherServiceTask",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        family: "OtherService",
      }
    );

    taskDefinition.addContainer("OtherServiceContainer", {
      image: ecs.ContainerImage.fromDockerImageAsset(asset),
      containerName: "OtherService",
    });

    const fargateService = new ecs.FargateService(
      this,
      "OtherServiceFargateService",
      {
        cluster: cluster,
        taskDefinition,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        assignPublicIp: true,
      }
    );

    fargateService.connections.allowTo(
      props.eventStoreConnections,
      ec2.Port.tcp(EVENT_STORE_HTTP_PORT),
      "Allow http connections from OtherService"
    );

    fargateService.connections.allowTo(
      props.eventStoreConnections,
      ec2.Port.tcp(EVENT_STORE_EXTERNAL_TCP_PORT),
      "Allow internal tcp connections from OtherService"
    );
  }
}
