#!/bin/bash
# LogSherlock Pro - Single-click AWS Serverless Deployment
# Usage: ./deploy.sh [stack-name] [region] [api-key]

set -e

STACK_NAME="${1:-logsherlock-pro}"
REGION="${2:-us-east-1}"
API_KEY="${3:-$(openssl rand -base64 24 | tr -d '/+=')}"

echo ""
echo "=== LogSherlock Pro - AWS Serverless Deployment ==="
echo ""

# Check prerequisites
echo "[1/6] Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "ERROR: AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "ERROR: SAM CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/"; exit 1; }
echo "  ✓ All prerequisites met."

# Generate/show API key
echo ""
echo "[2/6] Validating AWS credentials..."
aws sts get-caller-identity --region "$REGION" > /dev/null 2>&1 || { echo "ERROR: AWS credentials not configured. Run: aws configure"; exit 1; }
echo "  ✓ AWS credentials valid."
echo "  API Key: $API_KEY"
echo "  ⚠️  SAVE THIS KEY - you need it to access the API"

# Build
echo ""
echo "[3/6] Building SAM application..."
sam build --template-file template.yaml --use-container 2>/dev/null || sam build --template-file template.yaml

# Deploy
echo ""
echo "[4/6] Deploying to AWS ($REGION)..."
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides "ApiKey=$API_KEY" \
    --resolve-s3

# Get outputs
echo ""
echo "[5/6] Retrieving deployment info..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text)

# Summary
echo ""
echo "[6/6] ✅ Deployment Complete!"
echo ""
echo "================================================="
echo "  LogSherlock Pro - Deployed Successfully!"
echo "================================================="
echo ""
echo "  API URL:     $API_URL"
echo "  S3 Bucket:   $S3_BUCKET"
echo "  API Key:     $API_KEY"
echo "  Region:      $REGION"
echo "  Stack:       $STACK_NAME"
echo ""
echo "  Test it:"
echo "    curl -H 'X-API-Key: $API_KEY' $API_URL/api/health"
echo ""
echo "  Destroy it:"
echo "    sam delete --stack-name $STACK_NAME --region $REGION --no-prompts"
echo ""

# Save deployment info
cat > .deployment-info.json << EOF
{
    "api_url": "$API_URL",
    "s3_bucket": "$S3_BUCKET",
    "api_key": "$API_KEY",
    "region": "$REGION",
    "stack_name": "$STACK_NAME",
    "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "  Deployment info saved to .deployment-info.json"
