set -e
# export NODE_TLS_REJECT_UNAUTHORIZED=0
echo "\n[INFO] Starting Redeployment Process..."
if [ -f "$PWD/.env" ]; then
    source "$PWD/.env"
else
    echo "[ERROR] .env file not found in $PWD"
    exit 1
fi
if [ -z "$CDK_STACK_NAME" ] || [ -z "$AWS_PROFILE" ] || [ -z "$CDK_DEFAULT_REGION" ]; then
    echo "[ERROR] Missing required environment variables (CDK_STACK_NAME, AWS_PROFILE, CDK_DEFAULT_REGION)"
    exit 1
fi
printf '%100s\n' | tr ' ' '-'
sh validate.sh
printf '%100s\n' | tr ' ' '-'
echo "\n[INFO] Rebuilding CDK Scripts & Assets\n"
npm run build --verbose
echo "\n[INFO] Deploying to AWS Cloudfront...\n"
cdk deploy $CDK_STACK_NAME --profile $AWS_PROFILE --region $CDK_DEFAULT_REGION --verbose