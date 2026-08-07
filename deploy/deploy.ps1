#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ONE-COMMAND deployment of LogSherlock Pro to AWS Lambda.
.DESCRIPTION
    Deploys the full app using AWS SAM CLI + CloudFront. Just run:
      .\deploy.ps1
    
    Requires (pre-configured on your machine):
    - AWS CLI configured (aws configure)
    - AWS SAM CLI installed
    - Python 3.11

    What gets created automatically:
    - Lambda (Python 3.11, 2GB RAM, 300s timeout)
    - API Gateway v2
    - CloudFront CDN
    - DynamoDB tables
    - S3 bucket for log uploads
    - IAM roles

    Features: 455 patterns | 120 known issues | 14 categories | Jira RCA | Local AI | Intelligence Layer | Incident Cinema | Root Cause Graph | Timeline Replay | Log Memory
.PARAMETER StackName
    CloudFormation stack name (default: logsherlock-pro)
.PARAMETER Region
    AWS region (default: us-east-1)
#>
param(
    [string]$StackName = "logsherlock-pro",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   LogSherlock Pro - One-Command AWS Deploy       ║" -ForegroundColor Cyan
Write-Host "  ║   455 Patterns | 120 Issues | 85+ Features       ║" -ForegroundColor Cyan
Write-Host "  ║   + Intelligence Layer | Incident Cinema         ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check prerequisites ──────────────────────────────────────────────
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

$missing = @()
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) { $missing += "AWS CLI (https://aws.amazon.com/cli/)" }
if (-not (Get-Command sam -ErrorAction SilentlyContinue)) { $missing += "SAM CLI (https://docs.aws.amazon.com/sam/latest/developerguide/install-sam-cli.html)" }

if ($missing.Count -gt 0) {
    Write-Host "  MISSING:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    exit 1
}

# Validate credentials
try {
    $identity = aws sts get-caller-identity --region $Region --output json | ConvertFrom-Json
    Write-Host "  AWS Account: $($identity.Account) | User: $($identity.Arn.Split('/')[-1])" -ForegroundColor Green
} catch {
    Write-Host "  AWS credentials not configured. Run: aws configure" -ForegroundColor Red
    exit 1
}

# ── Step 2: Build ────────────────────────────────────────────────────────────
Write-Host "`n[2/5] Building application..." -ForegroundColor Yellow
sam build --template-file template.yaml 2>&1 | ForEach-Object {
    if ($_ -match "Build Succeeded") { Write-Host "  Build successful!" -ForegroundColor Green }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Build failed!" -ForegroundColor Red
    exit 1
}

# ── Step 3: Deploy ───────────────────────────────────────────────────────────
Write-Host "`n[3/5] Deploying to AWS ($Region)..." -ForegroundColor Yellow
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Deployment failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Deployed!" -ForegroundColor Green

# ── Step 4: Get outputs & invalidate CloudFront ──────────────────────────────
Write-Host "`n[4/5] Configuring CDN..." -ForegroundColor Yellow
$outputs = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json

$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq 'ApiUrl' }).OutputValue
$cfUrl = ($outputs | Where-Object { $_.OutputKey -eq 'CloudFrontUrl' }).OutputValue
$s3Bucket = ($outputs | Where-Object { $_.OutputKey -eq 'S3BucketName' }).OutputValue
$cfDistId = ($outputs | Where-Object { $_.OutputKey -eq 'CloudFrontDistributionId' }).OutputValue

if ($cfDistId) {
    aws cloudfront create-invalidation --distribution-id $cfDistId --paths "/*" --region $Region 2>&1 | Out-Null
    Write-Host "  CloudFront cache cleared." -ForegroundColor Green
}

# ── Step 5: Verify ───────────────────────────────────────────────────────────
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 30
    Write-Host "  Health check: $($health.status) - $($health.app) v$($health.version)" -ForegroundColor Green
} catch {
    Write-Host "  Health check pending (Lambda cold start). Try in 10s." -ForegroundColor Yellow
}

# ── Done ─────────────────────────────────────────────────────────────────────
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         DEPLOYMENT COMPLETE!                     ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL:    $cfUrl" -ForegroundColor White
Write-Host "  API URL:    $apiUrl" -ForegroundColor White
Write-Host "  S3 Bucket:  $s3Bucket" -ForegroundColor White
Write-Host "  Region:     $Region" -ForegroundColor White
Write-Host "  Time:       $([math]::Round($elapsed.TotalSeconds))s" -ForegroundColor White
Write-Host ""
Write-Host "  Open in browser: $cfUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To destroy: sam delete --stack-name $StackName --region $Region --no-prompts" -ForegroundColor Gray
Write-Host ""
