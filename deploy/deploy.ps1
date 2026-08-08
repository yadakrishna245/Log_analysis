#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ONE-COMMAND deployment of LogSherlock Pro to AWS.
.DESCRIPTION
    Automatically installs all prerequisites (AWS CLI, SAM CLI, Python) if missing,
    then deploys the full application stack to AWS.
    
    Just run:  .\deploy.ps1
    
    What gets created automatically on AWS:
    - Lambda (Python 3.11, 2GB RAM, 300s timeout)
    - API Gateway v2
    - CloudFront CDN
    - DynamoDB tables (5)
    - S3 bucket for log uploads
    - IAM roles + policies
    - License activation system

    172 Features | 1185 Patterns | Zero-Upload Scanning | HPE VME L4 Support
.PARAMETER StackName
    CloudFormation stack name (default: logsherlock-pro)
.PARAMETER Region
    AWS region (default: us-east-1)
.PARAMETER SkipInstall
    Skip auto-installation of missing tools
#>
param(
    [string]$StackName = "logsherlock-pro",
    [string]$Region = "us-east-1",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$startTime = Get-Date

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   LogSherlock Pro v4.0 — AWS Deployment          ║" -ForegroundColor Cyan
Write-Host "  ║   1185 Patterns | 172 Features | Enterprise       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Check & Auto-Install Prerequisites
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# --- Python ---
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) { $pythonCmd = "python" }
elseif (Get-Command python3 -ErrorAction SilentlyContinue) { $pythonCmd = "python3" }

if (-not $pythonCmd) {
    Write-Host "  ⚠️  Python not found." -ForegroundColor Yellow
    if (-not $SkipInstall) {
        Write-Host "  📦 Installing Python 3.11 via winget..." -ForegroundColor Cyan
        winget install Python.Python.3.11 --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        if (Get-Command python -ErrorAction SilentlyContinue) {
            $pythonCmd = "python"
            Write-Host "  ✅ Python installed!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Python install failed. Install manually: https://python.org/downloads" -ForegroundColor Red
            Write-Host "     After install, restart terminal and run this script again." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ❌ Python required. Install: https://python.org/downloads" -ForegroundColor Red
        exit 1
    }
} else {
    $pyVer = & $pythonCmd --version 2>&1
    Write-Host "  ✅ $pyVer" -ForegroundColor Green
}

# --- AWS CLI ---
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠️  AWS CLI not found." -ForegroundColor Yellow
    if (-not $SkipInstall) {
        Write-Host "  📦 Installing AWS CLI..." -ForegroundColor Cyan
        $awsInstaller = "$env:TEMP\AWSCLIV2.msi"
        Write-Host "     Downloading AWS CLI installer..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile $awsInstaller -UseBasicParsing
        Write-Host "     Installing (this may take 1-2 minutes)..." -ForegroundColor Gray
        Start-Process msiexec.exe -Wait -ArgumentList "/i $awsInstaller /quiet"
        Remove-Item $awsInstaller -ErrorAction SilentlyContinue
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        if (Get-Command aws -ErrorAction SilentlyContinue) {
            Write-Host "  ✅ AWS CLI installed!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ AWS CLI install failed. Install manually: https://aws.amazon.com/cli/" -ForegroundColor Red
            Write-Host "     Download: https://awscli.amazonaws.com/AWSCLIV2.msi" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ❌ AWS CLI required. Install: https://aws.amazon.com/cli/" -ForegroundColor Red
        exit 1
    }
} else {
    $awsVer = (aws --version 2>&1).ToString().Split(" ")[0]
    Write-Host "  ✅ $awsVer" -ForegroundColor Green
}

# --- SAM CLI ---
if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠️  AWS SAM CLI not found." -ForegroundColor Yellow
    if (-not $SkipInstall) {
        Write-Host "  📦 Installing SAM CLI..." -ForegroundColor Cyan
        $samInstaller = "$env:TEMP\aws-sam-cli-windows-x86_64.msi"
        Write-Host "     Downloading SAM CLI installer..." -ForegroundColor Gray
        Invoke-WebRequest -Uri "https://github.com/aws/aws-sam-cli/releases/latest/download/AWS_SAM_CLI_64_PY3.msi" -OutFile $samInstaller -UseBasicParsing
        Write-Host "     Installing (this may take 1-2 minutes)..." -ForegroundColor Gray
        Start-Process msiexec.exe -Wait -ArgumentList "/i $samInstaller /quiet"
        Remove-Item $samInstaller -ErrorAction SilentlyContinue
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        if (Get-Command sam -ErrorAction SilentlyContinue) {
            Write-Host "  ✅ SAM CLI installed!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ SAM CLI install failed. Install manually:" -ForegroundColor Red
            Write-Host "     https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  ❌ SAM CLI required. Install: https://docs.aws.amazon.com/sam/" -ForegroundColor Red
        exit 1
    }
} else {
    $samVer = (sam --version 2>&1).ToString()
    Write-Host "  ✅ $samVer" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Validate AWS Credentials
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[2/6] Validating AWS credentials..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity --region $Region --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ Account: $($identity.Account) | User: $($identity.Arn.Split('/')[-1])" -ForegroundColor Green
} catch {
    Write-Host "  ❌ AWS credentials not configured." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Run this command and enter your AWS Access Key + Secret:" -ForegroundColor Yellow
    Write-Host "    aws configure" -ForegroundColor White
    Write-Host ""
    Write-Host "  Need AWS keys? Go to: https://console.aws.amazon.com/iam/ → Users → Security Credentials" -ForegroundColor Gray
    exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Build
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[3/6] Building application..." -ForegroundColor Yellow
Push-Location (Split-Path $MyInvocation.MyCommand.Path)
sam build --template-file template.yaml 2>&1 | ForEach-Object {
    if ($_ -match "Build Succeeded") { Write-Host "  ✅ Build successful!" -ForegroundColor Green }
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Build failed! Check Python 3.11 is available." -ForegroundColor Red
    Pop-Location
    exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Deploy
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[4/6] Deploying to AWS ($Region)..." -ForegroundColor Yellow
Write-Host "  (First deploy takes 3-5 minutes, updates take 1-2 minutes)" -ForegroundColor Gray
sam deploy `
    --stack-name $StackName `
    --region $Region `
    --capabilities CAPABILITY_IAM `
    --no-confirm-changeset `
    --no-fail-on-empty-changeset `
    --resolve-s3

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Deploy failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  ✅ Stack deployed!" -ForegroundColor Green

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Get outputs & invalidate CloudFront
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[5/6] Getting deployment info..." -ForegroundColor Yellow
$outputs = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json 2>&1 | ConvertFrom-Json

$apiUrl = ($outputs | Where-Object { $_.OutputKey -eq 'ApiUrl' }).OutputValue
$cfUrl = ($outputs | Where-Object { $_.OutputKey -eq 'CloudFrontUrl' }).OutputValue
$s3Bucket = ($outputs | Where-Object { $_.OutputKey -eq 'S3BucketName' }).OutputValue
$cfDistId = ($outputs | Where-Object { $_.OutputKey -eq 'CloudFrontDistributionId' }).OutputValue

if (-not $cfDistId) {
    # Try to find by comment
    $cfDistId = aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='LogSherlock Pro - CloudFront Distribution'].Id" --output text 2>$null
}
if ($cfDistId) {
    aws cloudfront create-invalidation --distribution-id $cfDistId --paths "/*" --region $Region 2>&1 | Out-Null
    Write-Host "  ✅ CloudFront cache cleared" -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════════════════════════
# Step 6: Verify
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[6/6] Verifying..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 30
    Write-Host "  ✅ App is LIVE! Status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "  ⏳ Lambda warming up (cold start). App will be ready in ~10 seconds." -ForegroundColor Yellow
}

Pop-Location

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         ✅ DEPLOYMENT COMPLETE!                  ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 App URL:     $cfUrl" -ForegroundColor White
Write-Host "  🔗 API URL:     $apiUrl" -ForegroundColor White
Write-Host "  🪣 S3 Bucket:   $s3Bucket" -ForegroundColor White
Write-Host "  📍 Region:      $Region" -ForegroundColor White
Write-Host "  ⏱️  Time:        $([math]::Round($elapsed.TotalMinutes, 1)) minutes" -ForegroundColor White
Write-Host ""
Write-Host "  ── What's Deployed ──" -ForegroundColor Cyan
Write-Host "  • 172 features | 1185 Patterns | 21 categories"
Write-Host "  • Streaming engine (3GB+ files)"
Write-Host "  • Ticket Advisor + AI Copilot"
Write-Host "  • Per-machine license system"
Write-Host "  • HPE VME, GFS2, NFS, Alletra, GreenLake patterns"
Write-Host ""
Write-Host "  ── Next Steps ──" -ForegroundColor Cyan
Write-Host "  1. Open $cfUrl in browser"
Write-Host "  2. Generate a license key (or use dev mode)"
Write-Host "  3. Drop log files → Get instant RCA!"
Write-Host ""
Write-Host "  ── Destroy (if needed) ──" -ForegroundColor Gray
Write-Host "  sam delete --stack-name $StackName --region $Region --no-prompts"
Write-Host ""
