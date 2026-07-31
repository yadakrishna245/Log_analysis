#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Single-click deployment of LogSherlock Pro to AWS Lambda.
.DESCRIPTION
    Deploys the app using AWS SAM CLI. Requires:
    - AWS CLI configured with credentials
    - AWS SAM CLI installed
    - Python 3.11
.PARAMETER StackName
    CloudFormation stack name (default: logsherlock-pro)
.PARAMETER Region
    AWS region (default: us-east-1)
.PARAMETER ApiKey
    API key for authentication (auto-generated if not provided)
#>
param(
    [string]$StackName = "logsherlock-pro",
    [string]$Region = "us-east-1",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== LogSherlock Pro - AWS Serverless Deployment ===`n" -ForegroundColor Cyan

# Check prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error "AWS CLI not found. Install: https://aws.amazon.com/cli/"
    exit 1
}

if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Error "AWS SAM CLI not found. Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
}

# Generate API key if not provided
if (-not $ApiKey) {
    $ApiKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Write-Host "  Generated API Key: $ApiKey" -ForegroundColor Green
    Write-Host "  SAVE THIS KEY - you'll need it to access the API" -ForegroundColor Red
}

# Validate AWS credentials
Write-Host "`n[2/6] Validating AWS credentials..." -ForegroundColor Yellow
try {
    aws sts get-caller-identity --region $Region | Out-Null
    Write-Host "  AWS credentials valid." -ForegroundColor Green
} catch {
    Write-Error "AWS credentials not configured. Run: aws configure"
    exit 1
}

# Build
Write-Host "`n[3/6] Building SAM application..." -ForegroundColor Yellow
sam build --template-file template.yaml --use-container 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Container build failed, trying without container..." -ForegroundColor Yellow
    sam build --template-file template.yaml 2>&1 | Out-Host
}

# Deploy
Write-Host "`n[4/6] Deploying to AWS ($Region)..." -ForegroundColor Yellow
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset `
    --parameter-overrides "ApiKey=$ApiKey" `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed!"
    exit 1
}

# Get outputs
Write-Host "`n[5/6] Retrieving deployment info..." -ForegroundColor Yellow
$outputs = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json | ConvertFrom-Json

$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq 'ApiUrl' }).OutputValue
$s3Bucket = ($outputs | Where-Object { $_.OutputKey -eq 'S3BucketName' }).OutputValue

# Summary
Write-Host "`n[6/6] Deployment Complete!" -ForegroundColor Green
Write-Host "`n$('='*50)" -ForegroundColor Cyan
Write-Host "  LogSherlock Pro - Deployed Successfully!" -ForegroundColor Cyan
Write-Host "$('='*50)" -ForegroundColor Cyan
Write-Host "`n  API URL:     $apiUrl" -ForegroundColor White
Write-Host "  S3 Bucket:   $s3Bucket" -ForegroundColor White
Write-Host "  API Key:     $ApiKey" -ForegroundColor White
Write-Host "  Region:      $Region" -ForegroundColor White
Write-Host "  Stack:       $StackName" -ForegroundColor White
Write-Host "`n  Test it:" -ForegroundColor Yellow
Write-Host "    curl -H 'X-API-Key: $ApiKey' $apiUrl/api/health"
Write-Host "`n  Destroy it:" -ForegroundColor Yellow
Write-Host "    sam delete --stack-name $StackName --region $Region --no-prompts"
Write-Host ""

# Save deployment info
@"
{
    "api_url": "$apiUrl",
    "s3_bucket": "$s3Bucket",
    "api_key": "$ApiKey",
    "region": "$Region",
    "stack_name": "$StackName",
    "deployed_at": "$(Get-Date -Format o)"
}
"@ | Out-File -FilePath ".deployment-info.json" -Encoding utf8

Write-Host "  Deployment info saved to .deployment-info.json" -ForegroundColor Gray
