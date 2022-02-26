import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { FileSystem } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";

export type EventStoreProps = {
  fileSystem: FileSystem;
  vpc: ec2.IVpc;
};

export const EVENT_STORE_HTTP_PORT = 2113;
export const EVENT_STORE_EXTERNAL_TCP_PORT = 1113;

export class EventStoreConstruct extends Construct {
  connections: ec2.Connections;

  constructor(scope: Construct, id: string, props: EventStoreProps) {
    super(scope, id);

    const cluster = new ecs.Cluster(this, "EventStoreCluster", {
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

    const esVolumeCerts: ecs.Volume = {
      name: "eventstore-volume-certs",
      host: {},
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

    const genCertContainer = taskDefinition.addContainer("GenCertContainer", {
      image: ecs.ContainerImage.fromRegistry("eventstore/es-gencert-cli:1.0.2"),
      containerName: "EventStore-genCert",
      user: "root",
      entryPoint: ["bash"],
      essential: false,
      command: [
        "-c",
        "mkdir -p ./certs && cd /certs && es-gencert-cli create-ca && es-gencert-cli create-node -out ./node1 -dns-names localhost && find . -type f -print0 | xargs -0 chmod 666",
      ],
    });

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
        EVENTSTORE_TRUSTED_ROOT_CERTIFICATES_PATH: "/certs/ca",
        EVENTSTORE_CERTIFICATE_FILE: "/certs/node1/node.crt",
        EVENTSTORE_CERTIFICATE_PRIVATE_KEY_FILE: "/certs/node1/node.key",
      },
    });

    esContainer.addContainerDependencies({
      container: genCertContainer,
      condition: ecs.ContainerDependencyCondition.COMPLETE,
    });

    const fargateService = new ecs.FargateService(
      this,
      "EventStoreFargateService",
      {
        cluster,
        taskDefinition,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
        assignPublicIp: true,
      }
    );

    taskDefinition.addVolume(esVolumeLogs);
    taskDefinition.addVolume(esVolumeData);
    taskDefinition.addVolume(esVolumeCerts);

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

    esContainer.addMountPoints({
      containerPath: "/certs",
      sourceVolume: esVolumeCerts.name,
      readOnly: false,
    });

    genCertContainer.addMountPoints({
      containerPath: "/certs",
      sourceVolume: esVolumeCerts.name,
      readOnly: false,
    });

    props.fileSystem.connections.allowDefaultPortFrom(fargateService);

    this.connections = fargateService.connections;
  }
}
