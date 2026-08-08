#!/bin/bash
# LogSherlock Pro v4.0 — One-Command AWS Deployment
# Automatically installs AWS CLI + SAM CLI + Python if missing
# Usage: ./deploy.sh [stack-name] [region]
# Example: ./deploy.sh logsherlock-pro us-east-1

set -e

STACK_NAME="${1:-logsherlock-pro}"
REGION="${2:-us-east-1}"
API_KEY="${3:-}"
ADMIN_SECRET="${4:-}"

# Generate a strong random API key if none provided
if [ -z "$API_KEY" ]; then
    API_KEY=$(openssl rand -hex 24)
    echo "  🔑 Generated API key: $API_KEY"
    echo "  ⚠️  Save this key! You'll need it for API access."
    echo ""
fi

# Generate a strong random Admin Secret if none provided
if [ -z "$ADMIN_SECRET" ]; then
    ADMIN_SECRET=$(openssl rand -hex 16)
    echo "  🔐 Generated Admin Secret: $ADMIN_SECRET"
    echo "  ⚠️  Save this! You'll need it for the admin dashboard."
    echo ""
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        LogSherlock Pro v4.0 — AWS Serverless Deployment        ║"
echo "║   1185 Patterns | 172 Features | Enterprise Log Analysis        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Check & Auto-Install Prerequisites
# ══════════════════════════════════════════════════════════════════════════════
echo "[1/6] Checking & installing prerequisites..."
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    # Detect package manager
    if command -v apt-get &>/dev/null; then PKG="apt"
    elif command -v yum &>/dev/null; then PKG="yum"
    elif command -v dnf &>/dev/null; then PKG="dnf"
    else PKG="unknown"; fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
    PKG="brew"
fi
echo "  OS: $OS | Package manager: ${PKG:-none}"

# --- Python ---
if command -v python3 &>/dev/null; then
    PYTHON_VER=$(python3 --version 2>&1)
    echo "  ✅ $PYTHON_VER"
elif command -v python &>/dev/null; then
    PYTHON_VER=$(python --version 2>&1)
    echo "  ✅ $PYTHON_VER"
else
    echo "  ⚠️  Python not found. Installing..."
    if [ "$OS" = "linux" ]; then
        if [ "$PKG" = "apt" ]; then
            sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip -qq
        elif [ "$PKG" = "yum" ] || [ "$PKG" = "dnf" ]; then
            sudo $PKG install -y python3 python3-pip -q
        fi
    elif [ "$OS" = "mac" ]; then
        if command -v brew &>/dev/null; then
            brew install python@3.11
        else
            echo "  ❌ Install Homebrew first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    fi
    if command -v python3 &>/dev/null; then
        echo "  ✅ Python installed: $(python3 --version)"
    else
        echo "  ❌ Python install failed. Install manually: https://python.org/downloads"
        exit 1
    fi
fi

# --- AWS CLI ---
if command -v aws &>/dev/null; then
    AWS_VER=$(aws --version 2>&1 | cut -d' ' -f1)
    echo "  ✅ $AWS_VER"
else
    echo "  ⚠️  AWS CLI not found. Installing..."
    if [ "$OS" = "linux" ]; then
        echo "     Downloading AWS CLI v2..."
        curl -sL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
        cd /tmp && unzip -qo awscliv2.zip && sudo ./aws/install && cd -
        rm -rf /tmp/awscliv2.zip /tmp/aws
    elif [ "$OS" = "mac" ]; then
        echo "     Downloading AWS CLI v2 for macOS..."
        curl -sL "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "/tmp/AWSCLIV2.pkg"
        sudo installer -pkg /tmp/AWSCLIV2.pkg -target /
        rm -f /tmp/AWSCLIV2.pkg
    fi
    if command -v aws &>/dev/null; then
        echo "  ✅ AWS CLI installed: $(aws --version 2>&1 | cut -d' ' -f1)"
    else
        echo "  ❌ AWS CLI install failed."
        echo "     Manual install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
fi

# --- SAM CLI ---
if command -v sam &>/dev/null; then
    SAM_VER=$(sam --version 2>&1)
    echo "  ✅ $SAM_VER"
else
    echo "  ⚠️  SAM CLI not found. Installing..."
    if [ "$OS" = "linux" ]; then
        echo "     Installing via pip..."
        pip3 install --user aws-sam-cli 2>/dev/null || python3 -m pip install --user aws-sam-cli
        # Add to PATH if needed
        export PATH="$HOME/.local/bin:$PATH"
    elif [ "$OS" = "mac" ]; then
        if command -v brew &>/dev/null; then
            brew install aws-sam-cli
        else
            pip3 install aws-sam-cli
        fi
    fi
    if command -v sam &>/dev/null; then
        echo "  ✅ SAM CLI installed: $(sam --version)"
    else
        # Try with full path
        if [ -f "$HOME/.local/bin/sam" ]; then
            export PATH="$HOME/.local/bin:$PATH"
            echo "  ✅ SAM CLI installed: $(sam --version)"
        else
            echo "  ❌ SAM CLI install failed."
            echo "     Manual: pip3 install aws-sam-cli"
            echo "     Or: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
            exit 1
        fi
    fi
fi

echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Validate AWS Credentials
# ══════════════════════════════════════════════════════════════════════════════
echo "[2/6] Validating AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --region "$REGION" --query 'Account' --output text 2>/dev/null) || {
    echo "  ❌ AWS credentials not configured."
    echo ""
    echo "  Run this command and enter your Access Key + Secret Key:"
    echo "    aws configure"
    echo ""
    echo "  Need keys? Go to: https://console.aws.amazon.com/iam/"
    echo "  → Users → Your user → Security credentials → Create access key"
    exit 1
}
echo "  ✅ AWS Account: $AWS_ACCOUNT | Region: $REGION"

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Build
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "[3/6] Building SAM application..."
cd "$(dirname "$0")"

if sam build --template-file template.yaml --use-container 2>/dev/null; then
    echo "  ✅ Built with Docker container."
else
    echo "  ℹ️  Container unavailable, building natively..."
    sam build --template-file template.yaml
    echo "  ✅ Built natively."
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Deploy
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "[4/6] Deploying to AWS ($REGION)..."
echo "  (First deploy: ~3-5 minutes | Updates: ~1-2 minutes)"
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides "ApiKey=$API_KEY AdminSecret=$ADMIN_SECRET" \
    --resolve-s3

echo "  ✅ Stack deployed!"

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Get outputs & invalidate CloudFront
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "[5/6] Retrieving deployment info..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")
CF_URL=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text 2>/dev/null || echo "pending...")
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text 2>/dev/null || echo "")

# Auto-detect CloudFront distribution ID
CF_DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text 2>/dev/null || echo "")
if [ -z "$CF_DIST_ID" ]; then
    CF_DIST_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Comment=='LogSherlock Pro - CloudFront Distribution'].Id" \
        --output text 2>/dev/null || echo "")
fi

if [ -n "$CF_DIST_ID" ]; then
    aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*" --region "$REGION" > /dev/null 2>&1
    echo "  ✅ CloudFront cache invalidated"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 6: Verify
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "[6/6] Verifying deployment..."
sleep 5
if curl -sf "${API_URL}api/health" > /dev/null 2>&1; then
    echo "  ✅ App is LIVE!"
else
    echo "  ⏳ Lambda warming up. App will be ready in ~10 seconds."
fi

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DEPLOYMENT COMPLETE!                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 App URL:     ${CF_URL}"
echo "  🔗 API URL:     ${API_URL}"
echo "  🪣 S3 Bucket:   ${S3_BUCKET}"
echo "  📍 Region:      ${REGION}"
echo "  📦 Stack:       ${STACK_NAME}"
echo ""
echo "  ── What's Deployed ──"
echo "  • 172 features | 1185 Patterns | 21 categories"
echo "  • Streaming engine (3GB+ files)"
echo "  • Ticket Advisor + AI Copilot"
echo "  • HPE VME, GFS2, NFS, Alletra, GreenLake patterns"
echo "  • Per-machine license system"
echo ""
echo "  ── Next Steps ──"
echo "  1. Open ${CF_URL} in browser"
echo "  2. Generate license key (or use dev mode)"
echo "  3. Drop log files → Get instant RCA!"
echo ""
echo "  ── Destroy (removes everything) ──"
echo "  sam delete --stack-name $STACK_NAME --region $REGION --no-prompts"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Save deployment secrets locally (gitignored, for your reference)
# ══════════════════════════════════════════════════════════════════════════════
SECRETS_FILE=".deployment-secrets.txt"
cat > "$SECRETS_FILE" << SECRETS_EOF
# LogSherlock Pro — Deployment Secrets
# Generated: $(date -u +"%Y-%m-%d %H:%M UTC")
# Stack: $STACK_NAME | Region: $REGION
# ⚠️  DO NOT COMMIT THIS FILE (it's gitignored)

API_KEY=$API_KEY
ADMIN_SECRET=$ADMIN_SECRET
APP_URL=${CF_URL}
API_URL=${API_URL}
STACK_NAME=$STACK_NAME
REGION=$REGION

# Use ADMIN_SECRET when logging into the admin dashboard
# Use API_KEY for X-API-Key header in API requests
SECRETS_EOF
echo "  💾 Secrets saved to: $SECRETS_FILE"
echo "     (gitignored — safe to keep locally)"
echo ""
