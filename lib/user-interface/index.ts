import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import {
  ExecSyncOptionsWithBufferEncoding,
  execSync,
} from "node:child_process";
import * as path from "node:path";
import { Website } from "./generate-app"
import { Utils } from "../shared/utils"
import { CloudFrontWebDistribution } from "aws-cdk-lib/aws-cloudfront";

export class UserInterface extends Construct {
  public readonly cloudfrontDistribution: CloudFrontWebDistribution;
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const appPath = path.join(__dirname, "app");
    const buildPath = path.join(appPath, "dist");

    const uploadLogsBucket = new s3.Bucket(this, "WebsiteLogsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    this.websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      enforceSSL: true,
      serverAccessLogsBucket: uploadLogsBucket,
    });

    let distribution;

    const publicWebsite = new Website(this, "Website", { websiteBucket: this.websiteBucket });
    this.cloudfrontDistribution = publicWebsite.distribution;
    
    const asset = s3deploy.Source.asset(appPath, {
      bundling: {
        image: cdk.DockerImage.fromRegistry(
          "public.ecr.aws/sam/build-nodejs18.x:latest"
        ),
        command: [
          "sh",
          "-c",
          [
            "npm --cache /tmp/.npm install",
            `npm --cache /tmp/.npm run build`,
            "cp -aur /asset-input/dist/* /asset-output/",
          ].join(" && "),
        ],
        local: {
          tryBundle(outputDir: string) {
            try {
              const options: ExecSyncOptionsWithBufferEncoding = {
                stdio: "inherit",
                env: {
                  ...process.env,
                },
              };

              execSync(`npm --silent --prefix "${appPath}" ci`, options);
              execSync(`npm --silent --prefix "${appPath}" run build`, options);
              Utils.copyDirRecursive(buildPath, outputDir);
            } catch (e) {
              console.error(e);
              return false;
            }

            return true;
          },
        },
      },
    });

    new s3deploy.BucketDeployment(this, "UserInterfaceDeployment", {
      prune: false,
      retainOnDelete: false,
      sources: [asset],
      destinationBucket: this.websiteBucket,
      distribution: distribution
    });
  }
}
