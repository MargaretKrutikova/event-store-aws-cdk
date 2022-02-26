#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { EventStoreConstruct } from "../lib/constructs/event-store";
import { OtherServiceConstruct } from "../lib/constructs/other-service";
import { StatefulStack } from "../lib/stateful-stack";

const app = new cdk.App();

const statefulResources = new StatefulStack(app, "StatefulResources");

const eventStoreResources = new EventStoreConstruct(
  new Stack(app, "EventStore"),
  "EventStore",
  {
    fileSystem: statefulResources.fileSystem,
    vpc: statefulResources.vpc,
  }
);

new OtherServiceConstruct(new Stack(app, "OtherService"), "OtherService", {
  eventStoreConnections: eventStoreResources.connections,
  vpc: statefulResources.vpc,
});
