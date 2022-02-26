import * as ec2 from "aws-cdk-lib/aws-ec2";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

type VpcProps = {
  vpcCidr: string;
};

export class VpcConstruct extends Construct {
  vpc: IVpc;

  constructor(scope: Construct, id: string, props: VpcProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "app/vpc", {
      cidr: props.vpcCidr,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
