# CDK for Terraform Serverless Multi-Stack example

This repo contains a version of [the serverless e2e example](https://github.com/hashicorp/cdktf-integration-serverless-example) that only focuses on multi-stack deployments. You can find the documentation about the initial example here: [cdktf-integration-serverless-example](https://github.com/hashicorp/terraform-cdk/blob/main/docs/full-guide/serverless-application-typescript.md).

## What is this?

This shows how one could use CDK to deploy a multi-stack application. We deploy a simple message board with a React frontend and a Node.js lambda backend across multiple stages (development, staging, production) and multiple regions (production-us, production-eu, production-asia).

The application itself is structured in two stacks, one for the backend and one for the frontend. A cross-stack reference is used to tell the frontend stack about the location of the backend API.

There is a seperate npm script for each of the stages, deploying all stacks needed for each stage.

We will use the local backend for demonstation purposes, but you can use any backend that you like.
