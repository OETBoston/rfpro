set -e
# export NODE_TLS_REJECT_UNAUTHORIZED=0
echo $"\n[INFO] Starting Redeployment Process..."
source $PWD/.env
printf '%.0s-' {1..100}
sh validate.sh
printf '%.0s-' {1..100}
echo $"\n[INFO] Rebuilding CDK Scripts & Assets\n"
npm run build --verbose
echo $"\n[INFO] Deploying to AWS Cloudfront...\n"
cdk deploy $CDK_STACK_NAME --profile $AWS_PROFILE --region CDK_DEFAULT_REGION