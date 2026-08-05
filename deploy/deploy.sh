#!/bin/bash
# LogSherlock Pro v3.0 - Single-click AWS Serverless Deployment
# Features: 455 patterns, streaming engine (3GB+), multi-file scan, Jira integration,
#           Ticket Advisor (iterative L4 troubleshooting), License key system
# Usage: ./deploy.sh [stack-name] [region] [api-key]
# Example: ./deploy.sh logsherlock-pro us-east-1

set -e

STACK_NAME="${1:-logsherlock-pro}"
REGION="${2:-us-east-1}"
API_KEY="${3:-logsherlock-hpe-2026}"
CLOUDFRONT_DIST_ID="E3V2MZ00F7WXY9"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        LogSherlock Pro v3.0 — AWS Serverless Deployment        ║"
echo "║   455 Patterns | Ticket Advisor | Streaming 3GB+ | Local AI    ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "[1/6] Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo "❌ ERROR: AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "❌ ERROR: SAM CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/"; exit 1; }
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || { echo "❌ ERROR: Python not found."; exit 1; }
echo "  ✅ AWS CLI, SAM CLI, Python — all present."

# Validate AWS credentials
echo ""
echo "[2/6] Validating AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --region "$REGION" --query 'Account' --output text 2>/dev/null) || {
    echo "❌ ERROR: AWS credentials not configured or expired."
    echo "   Run: aws configure"
    echo "   Or: export AWS_PROFILE=your-profile"
    exit 1
}
echo "  ✅ AWS Account: $AWS_ACCOUNT | Region: $REGION"

# Build
echo ""
echo "[3/6] Building SAM application..."
cd "$(dirname "$0")"

# Try container build first (more reliable), fall back to native
if sam build --template-file template.yaml --use-container 2>/dev/null; then
    echo "  ✅ Built with Docker container."
else
    echo "  ⚠️  Container build unavailable, trying native..."
    sam build --template-file template.yaml
    echo "  ✅ Built natively."
fi

# Deploy
echo ""
echo "[4/6] Deploying to AWS ($REGION)..."
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --resolve-s3

echo "  ✅ Stack deployed/updated successfully."

# Get outputs
echo ""
echo "[5/6] Retrieving deployment info..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
CF_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text 2>/dev/null || echo "https://d3tv1czat55yad.cloudfront.net")
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text 2>/dev/null || echo "")

# Invalidate CloudFront cache
echo ""
echo "[6/6] Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*" --region "$REGION" > /dev/null 2>&1 && \
    echo "  ✅ CloudFront cache invalidated (takes 30-60s to propagate)." || \
    echo "  ⚠️  CloudFront invalidation failed (non-critical, cache expires on its own)."

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETE!                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 CloudFront:  ${CF_URL}"
echo "  🔗 API URL:     ${API_URL}"
echo "  🪣 S3 Bucket:   ${S3_BUCKET}"
echo "  🔑 API Key:     ${API_KEY}"
echo "  📍 Region:      ${REGION}"
echo "  📦 Stack:       ${STACK_NAME}"
echo ""
echo "  ── Features Deployed ──"
echo "  • 455 detection patterns across 14 categories"
echo "  • 🎯 Ticket Advisor — iterative L4 troubleshooting (<10ms)"
echo "  • Streaming engine — handles 3GB+ files"
echo "  • Multi-file scan (30+ archives at once)"
echo "  • Local AI (Ollama) — streaming responses"
echo "  • Jira Integration — fetch/post with AI comment reply"
echo "  • License key activation system"
echo "  • Usage analytics dashboard"
echo ""
echo "  ── Quick Test ──"
echo "  curl ${API_URL}api/health"
echo "  curl -X POST ${API_URL}api/ticket/advisor/chat \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"messages\":[{\"role\":\"user\",\"content\":\"GFS2 withdraw on node2\"}]}'"
echo ""
echo "  ── Destroy ──"
echo "  sam delete --stack-name $STACK_NAME --region $REGION --no-prompts"
echo ""

# Save deployment info
cat > .deployment-info.json << EOF
{
    "cloudfront_url": "${CF_URL}",
    "api_url": "${API_URL}",
    "s3_bucket": "${S3_BUCKET}",
    "api_key": "${API_KEY}",
    "region": "${REGION}",
    "stack_name": "${STACK_NAME}",
    "cloudfront_dist_id": "${CLOUDFRONT_DIST_ID}",
    "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "3.0"
}
EOF
echo "  📄 Deployment info saved to .deployment-info.json"
echo ""
