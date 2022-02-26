import { Stack, StackProps } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { FileSystem } from "aws-cdk-lib/aws-efs";
import { Construct } from "constructs";
import { FileSystemConstruct } from "./constructs/file-system";
import { VpcConstruct } from "./constructs/vpc";

export class StatefulStack extends Stack {
  fileSystem: FileSystem;
  vpc: IVpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpcResources = new VpcConstruct(this, "Vpc", {
      vpcCidr: "20.10.0.0/16",
    });
    const fileSystemResources = new FileSystemConstruct(this, "FileSystem", {
      vpc: vpcResources.vpc,
    });

    this.vpc = vpcResources.vpc;
    this.fileSystem = fileSystemResources.fileSystem;
  }
}
