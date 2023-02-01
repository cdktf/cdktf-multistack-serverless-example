/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { Resource } from "cdktf";
import { Construct } from "constructs";

interface PostsGeneratorOptions {
  cronPattern: string;
  userSuffix?: string;
}

// adds sample posts at certain time (defined via CRON pattern)
export class PostsGenerator extends Resource {
  constructor(scope: Construct, id: string, options: PostsGeneratorOptions) {
    super(scope, id);

    // cron lambda tf resources
    options.cronPattern; // todo: pass to aws cloudwatch event
  }
}
