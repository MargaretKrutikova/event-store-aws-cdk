import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { FileSystem } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";

export type EventStoreProps = {
  fileSystem: FileSystem;
  vpc: IVpc;
};

export const EVENT_STORE_HTTP_PORT = 2113;
export const EVENT_STORE_EXTERNAL_TCP_PORT = 1113;

export class EventStoreConstruct extends Construct {
  connections: ec2.Connections;

  constructor(scope: Construct, id: string, props: EventStoreProps) {
    super(scope, id);

    const cluster = new Cluster(this, "EventStoreCluster", {
      vpc: props.vpc,
      clusterName: "EventStoreCluster",
    });

    const esVolumeLogs: ecs.Volume = {
      name: "eventstore-volume-logs",
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
      },
    };

    const esVolumeData: ecs.Volume = {
      name: "eventstore-volume-data",
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
      },
    };

    const taskDefinition: ecs.TaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "EventStoreTask",
      {
        memoryLimitMiB: 512,
        cpu: 256,
        family: "EventStore",
      }
    );

    const esContainer = taskDefinition.addContainer("EventStoreContainer", {
      image: ecs.ContainerImage.fromRegistry(
        "eventstore/eventstore:21.10.0-buster-slim"
      ),
      containerName: "EventStore",
      portMappings: [
        { containerPort: EVENT_STORE_HTTP_PORT },
        { containerPort: EVENT_STORE_EXTERNAL_TCP_PORT },
      ],
      user: "root",
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl --fail --insecure https://localhost:2113/health/live || exit 1",
        ],
        interval: Duration.seconds(5),
        timeout: Duration.seconds(5),
        retries: 10,
        startPeriod: Duration.minutes(1),
      },
      environment: {
        EVENTSTORE_CLUSTER_SIZE: "1",
        EVENTSTORE_RUN_PROJECTIONS: "All",
        EVENTSTORE_START_STANDARD_PROJECTIONS: "true",
        EVENTSTORE_EXT_TCP_PORT: EVENT_STORE_EXTERNAL_TCP_PORT.toString(),
        EVENTSTORE_HTTP_PORT: EVENT_STORE_HTTP_PORT.toString(),
        EVENTSTORE_ENABLE_EXTERNAL_TCP: "true",
        EVENTSTORE_ENABLE_ATOM_PUB_OVER_HTTP: "true",
        EVENTSTORE_LOG_CONSOLE_FORMAT: "Json",
        EVENTSTORE_INSECURE: "true",
      },
    });

    const fargateService = new ecs.FargateService(
      this,
      "EventStoreFargateService",
      {
        cluster,
        taskDefinition,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        vpcSubnets: { subnetType: SubnetType.PUBLIC },
        assignPublicIp: true,
      }
    );

    taskDefinition.addVolume(esVolumeLogs);
    taskDefinition.addVolume(esVolumeData);

    esContainer.addMountPoints({
      containerPath: "/var/log/eventstore",
      sourceVolume: esVolumeLogs.name,
      readOnly: false,
    });

    esContainer.addMountPoints({
      containerPath: "/var/lib/eventstore",
      sourceVolume: esVolumeData.name,
      readOnly: false,
    });

    props.fileSystem.connections.allowDefaultPortFrom(fargateService);

    this.connections = fargateService.connections;
  }
}
