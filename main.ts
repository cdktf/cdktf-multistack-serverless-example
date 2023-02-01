/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { AwsProvider } from "@cdktf/provider-aws";
import { App, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { Frontend } from "./frontend";
import { Posts } from "./posts";
import { LocalProvider } from "@cdktf/provider-local";

interface EnvironmentOptions {
  environment: "development" | "staging" | "production";
  user?: string;
  region?: string;
}

const app = new App();

interface FrontendStackOptions extends EnvironmentOptions {
  apiEndpoint: string;
}

class FrontendStack extends TerraformStack {
  constructor(
    scope: Construct,
    name: string,
    public options: FrontendStackOptions
  ) {
    super(scope, name);

    new AwsProvider(this, "aws", { region: options.region || "eu-central-1" });
    new LocalProvider(this, "local");
    new Frontend(this, "frontend", {
      environment: options.environment,
      apiEndpoint: options.apiEndpoint,
    });
  }
}

class PostsStack extends TerraformStack {
  public posts: Posts;

  constructor(
    scope: Construct,
    name: string,
    public options: EnvironmentOptions
  ) {
    super(scope, name);
    new AwsProvider(this, "aws", { region: options.region || "eu-central-1" });

    this.posts = new Posts(this, "posts", {
      environment: options.environment,
      userSuffix: options.user,
      region: options.region,
    });
  }
}

// Our application consists of two stacks:
// The PostsStack serves the backend api and the FrontendStack serves the frontend.
// The posts stack exposes it's API endpoint to the frontend stack, creating a cross-stack dependency.
// As these two stacks can only work together, we create them together in a helper function.
function createMessageBoard(
  environment: "development" | "staging" | "production",
  region?: string
) {
  function getStackName(componentName: string) {
    if (region) {
      return `${environment}-${componentName}-${region}`;
    } else {
      return `${environment}-${componentName}`;
    }
  }

  // We want to allow our developers to create their own dev environment.
  // When they deploy the development stacks, they can specify their user name and get their own environment.

  const user =
    environment === "development" ? process.env.CDKTF_USER : undefined;

  const posts = new PostsStack(app, getStackName("posts"), {
    environment,
    user: user,
    region,
  });
  new FrontendStack(app, getStackName("frontend"), {
    environment,
    apiEndpoint: posts.posts.apiEndpoint,
    region,
  });
}

// Single region development environment
createMessageBoard("development");

// Small multi-region staging environment
createMessageBoard("staging", "eu-central-1");
createMessageBoard("staging", "us-east-1");

// Large multi-region production environment
createMessageBoard("production", "eu-central-1");
createMessageBoard("production", "us-east-1");
createMessageBoard("production", "us-west-2");
createMessageBoard("production", "sa-east-1");
createMessageBoard("production", "ap-northeast-2");

app.synth();
