import { RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import * as efs from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";

type FileSystemProps = {
  vpc: IVpc;
};

export class FileSystemConstruct extends Construct {
  fileSystem: efs.FileSystem;

  constructor(scope: Construct, id: string, props: FileSystemProps) {
    super(scope, id);

    this.fileSystem = new efs.FileSystem(this, "AppFileSystem", {
      vpc: props.vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      removalPolicy: RemovalPolicy.RETAIN,
      fileSystemName: "AppFileSystem",
      enableAutomaticBackups: true,
    });
  }
}
