/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  S3Bucket,
  S3BucketPolicy,
  S3BucketWebsiteConfiguration,
  S3Object,
} from "@cdktf/provider-aws/lib/s3";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront";
import { Fn, Resource, TerraformOutput } from "cdktf";
import { Construct } from "constructs";
import * as path from "path";
import { sync as glob } from "glob";
import { lookup as mime } from "mime-types";

const S3_ORIGIN_ID = "s3Origin";
const API_ORIGIN_ID = "apiOrigin";

interface FrontendOptions {
  environment: string;
  apiEndpoint: string;
}

export class Frontend extends Resource {
  constructor(scope: Construct, id: string, options: FrontendOptions) {
    super(scope, id);

    const bucket = new S3Bucket(this, "bucket", {
      bucketPrefix: `cdktf-multistack-sls-${options.environment}`,
      tags: {
        "hc-internet-facing": "true", // this is only needed for HashiCorp internal security auditing
      },
    });

    // Enable website delivery
    const bucketWebsite = new S3BucketWebsiteConfiguration(
      this,
      "website-configuration",
      {
        bucket: bucket.bucket,

        indexDocument: {
          suffix: "index.html",
        },

        errorDocument: {
          key: "index.html", // we could put a static error page here
        },
      }
    );

    new S3BucketPolicy(this, "s3_policy", {
      bucket: bucket.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Id: "PolicyForWebsiteEndpointsPublicContent",
        Statement: [
          {
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`${bucket.arn}/*`, `${bucket.arn}`],
          },
        ],
      }),
    });

    const cf = new CloudfrontDistribution(this, "cf", {
      comment: `Serverless example frontend for env=${options.environment}`,
      enabled: true,
      defaultCacheBehavior: {
        allowedMethods: [
          "DELETE",
          "GET",
          "HEAD",
          "OPTIONS",
          "PATCH",
          "POST",
          "PUT",
        ],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: S3_ORIGIN_ID,
        viewerProtocolPolicy: "redirect-to-https",
        forwardedValues: { queryString: false, cookies: { forward: "none" } },
      },
      origin: [
        {
          originId: S3_ORIGIN_ID,
          domainName: bucketWebsite.websiteEndpoint,
          customOriginConfig: {
            originProtocolPolicy: "http-only",
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ["TLSv1.2", "TLSv1.1", "TLSv1"],
          },
        },
        {
          originId: API_ORIGIN_ID,
          domainName: Fn.replace(options.apiEndpoint, "https://", ""),
          customOriginConfig: {
            originProtocolPolicy: "https-only",
            httpPort: 80,
            httpsPort: 443,
            originSslProtocols: ["TLSv1.2", "TLSv1.1", "TLSv1"],
          },
        },
      ],
      orderedCacheBehavior: [
        {
          pathPattern: "/posts",
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
          ],
          cachedMethods: ["HEAD", "GET", "OPTIONS"],
          forwardedValues: { queryString: true, cookies: { forward: "none" } },
          targetOriginId: API_ORIGIN_ID,
          viewerProtocolPolicy: "redirect-to-https",
        },
        {
          pathPattern: "/*",
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
          ],
          cachedMethods: ["HEAD", "GET", "OPTIONS"],
          forwardedValues: { queryString: true, cookies: { forward: "none" } },
          targetOriginId: S3_ORIGIN_ID,
          viewerProtocolPolicy: "redirect-to-https",
        },
      ],
      defaultRootObject: "index.html",
      restrictions: { geoRestriction: { restrictionType: "none" } },
      viewerCertificate: { cloudfrontDefaultCertificate: true },
    });

    // TODO: use an asset here
    // This is a change from the original serverless example since managing the script to deploy the frontend is quite cumbersome
    // Get all build files synchronously
    const buildFiles = path.join("code", "build");
    const files = glob("**/*.{json,js,html,png,ico,txt,map,css}", {
      cwd: path.join(__dirname, buildFiles),
    });

    files.forEach((f) => {
      // Construct the local path to the file
      const filePath = path.join(buildFiles, f);

      // Creates all the files in the bucket
      new S3Object(this, `frontend/${f}`, {
        bucket: bucket.id,
        key: f,
        source: path.join(__dirname, filePath),
        // mime is an open source node.js tool to get mime types per extension
        contentType: mime(path.extname(f)) || "text/html",
        etag: Fn.filemd5(path.join(__dirname, filePath)),
      });
    });

    // TODO: check if we need this override
    new TerraformOutput(this, "frontend_domainname", {
      value: cf.domainName,
    }).addOverride("value", `https://${cf.domainName}`);
  }
}
