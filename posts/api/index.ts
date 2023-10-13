/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";
import { NodejsFunction } from "../../lib/nodejs-function";
import { Construct } from "constructs";
import path = require("path");
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2-api";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";

const lambdaRolePolicy = {
  Version: "2012-10-17",
  Statement: [
    {
      Action: "sts:AssumeRole",
      Principal: {
        Service: "lambda.amazonaws.com",
      },
      Effect: "Allow",
      Sid: "",
    },
  ],
};

interface PostsApiOptions {
  environment: string;
  table: DynamodbTable;
  userSuffix?: string;
  region?: string;
}

export class PostsApi extends Construct {
  /**
   * base url on which the methods of the posts api can be invoked
   * e.g. GET <endpoint>/posts
   */
  endpoint: string;

  constructor(scope: Construct, id: string, options: PostsApiOptions) {
    super(scope, id);

    // api lambda tf resources
    const code = new NodejsFunction(this, "code", {
      path: path.join(__dirname, "lambda/index.ts"),
    });

    // Create Lambda role
    const role = new IamRole(this, "lambda-exec", {
      name: `cdktf-multistack-serverless-${
        options.environment + (options.region || options.userSuffix || "")
      }`,
      assumeRolePolicy: JSON.stringify(lambdaRolePolicy),
      inlinePolicy: [
        {
          name: "AllowDynamoDB",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Action: [
                  "dynamodb:Scan",
                  "dynamodb:Query",
                  "dynamodb:BatchGetItem",
                  "dynamodb:GetItem",
                  "dynamodb:PutItem",
                ],
                Resource: options.table.arn,
                Effect: "Allow",
              },
            ],
          }),
        },
      ],
    });

    // Add execution role for lambda to write to CloudWatch logs
    new IamRolePolicyAttachment(this, "lambda-managed-policy", {
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    });

    // Create Lambda function
    const lambda = new LambdaFunction(this, "api", {
      functionName: `cdktf-multistack-serverless-post-api${
        options.environment + (options.region || options.userSuffix || "")
      }`,
      handler: "index.handler",
      runtime: "nodejs14.x",
      role: role.arn,
      filename: code.asset.path,
      sourceCodeHash: code.asset.assetHash,
      environment: {
        variables: {
          DYNAMODB_TABLE_NAME: options.table.name,
        },
      },
    });

    // Create and configure API gateway
    const api = new Apigatewayv2Api(this, "api-gw", {
      name: `cdktf-multistack-serverless-posts-${
        options.environment + (options.region || options.userSuffix || "")
      }`,
      protocolType: "HTTP",
      target: lambda.arn,
      corsConfiguration: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["content-type"],
      },
    });

    new LambdaPermission(this, "apigw-lambda", {
      functionName: lambda.functionName,
      action: "lambda:InvokeFunction",
      principal: "apigateway.amazonaws.com",
      sourceArn: `${api.executionArn}/*/*`,
    });

    this.endpoint = api.apiEndpoint;
  }
}
