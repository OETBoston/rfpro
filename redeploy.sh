set -e
echo $"\n[INFO] Starting Redeployment Process..."
source .env
printf '%.0s-' {1..100}
sh validate.sh
printf '%.0s-' {1..100}
echo $"\n[INFO] Rebuilding CDK Scripts & Assets\n"
npm run build --verbose
echo $"\n[INFO] Deploying to AWS Cloudfront...\n"
cdk deploy $CDK_STACK_NAME --profile $AWS_PROFILE