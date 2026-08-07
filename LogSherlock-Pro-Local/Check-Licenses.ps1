# ═══════════════════════════════════════════════════════════════════
# LogSherlock Pro — License Tracking Dashboard
# Created by: Krishna Yada
# Usage: .\Check-Licenses.ps1
# Shows ALL activated licenses, users, expiry dates, activity
# ═══════════════════════════════════════════════════════════════════

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "list",  # list, status, reset

    [Parameter(Mandatory=$false)]
    [string]$Key = ""
)

$API_URL = "https://5bruz4e6hj.execute-api.us-east-1.amazonaws.com/prod"
$ADMIN_SECRET = "LSPRO2026KRISHNA"

function Show-AllLicenses {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  LogSherlock Pro — License Dashboard" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""

    try {
        $body = @{ admin_secret = $ADMIN_SECRET } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$API_URL/api/license/list-all" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10

        Write-Host "  📊 Total Activated:  $($resp.total_licenses)" -ForegroundColor White
        Write-Host "  ✅ Active:           $($resp.active_count)" -ForegroundColor Green
        Write-Host "  ❌ Expired:          $($resp.expired_count)" -ForegroundColor Red
        Write-Host ""
        Write-Host "───────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

        if ($resp.licenses.Count -eq 0) {
            Write-Host ""
            Write-Host "  No licenses activated yet." -ForegroundColor Yellow
            Write-Host "  (Users need internet for first-time activation)" -ForegroundColor DarkGray
            Write-Host ""
        } else {
            Write-Host ""
            $i = 1
            foreach ($lic in $resp.licenses) {
                $status = if ($lic.is_expired) { "❌ EXPIRED" } elseif ($lic.is_lifetime) { "♾️ LIFETIME" } else { "✅ ACTIVE" }
                $statusColor = if ($lic.is_expired) { "Red" } elseif ($lic.is_lifetime) { "Magenta" } else { "Green" }
                $remaining = if ($lic.is_lifetime -or $lic.days_remaining -eq "LIFETIME") { "LIFETIME" } else { "$($lic.days_remaining) days left" }

                Write-Host "  [$i] $status" -ForegroundColor $statusColor -NoNewline
                Write-Host ""
                Write-Host "      User:       $($lic.user_name)" -ForegroundColor White
                Write-Host "      Key:        $($lic.license_key)" -ForegroundColor Yellow
                Write-Host "      Activated:  $($lic.activated_at)" -ForegroundColor DarkGray
                Write-Host "      Last Seen:  $($lic.last_seen)" -ForegroundColor DarkGray
                Write-Host "      Expiry:     $remaining" -ForegroundColor $(if($lic.is_expired){"Red"}else{"White"})
                Write-Host "      Device:     $($lic.user_agent)" -ForegroundColor DarkGray
                Write-Host ""
                $i++
            }
        }

        Write-Host "───────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
        Write-Host ""
    } catch {
        Write-Host "  ❌ Error: Could not reach license server." -ForegroundColor Red
        Write-Host "  Check internet connection." -ForegroundColor DarkGray
        Write-Host "  Error: $_" -ForegroundColor DarkGray
        Write-Host ""
    }
}

function Show-KeyStatus {
    param([string]$LicenseKey)
    
    if (-not $LicenseKey) {
        $LicenseKey = Read-Host "  Enter license key"
    }

    Write-Host ""
    Write-Host "  Checking key: $LicenseKey" -ForegroundColor Yellow
    Write-Host ""

    try {
        $body = @{ license_key = $LicenseKey.ToUpper(); admin_secret = $ADMIN_SECRET } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$API_URL/api/license/status" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10

        if ($resp.activated) {
            Write-Host "  ✅ ACTIVATED" -ForegroundColor Green
            Write-Host "      User:       $($resp.user_name)" -ForegroundColor White
            Write-Host "      Activated:  $($resp.activated_at)" -ForegroundColor DarkGray
            Write-Host "      Last Seen:  $($resp.last_seen)" -ForegroundColor DarkGray
            Write-Host "      Device:     $($resp.user_agent)" -ForegroundColor DarkGray
        } else {
            Write-Host "  ⚪ Not activated yet" -ForegroundColor Yellow
            Write-Host "      $($resp.message)" -ForegroundColor DarkGray
        }
        Write-Host ""
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        Write-Host ""
    }
}

function Reset-Key {
    param([string]$LicenseKey)
    
    if (-not $LicenseKey) {
        $LicenseKey = Read-Host "  Enter license key to reset"
    }

    Write-Host ""
    Write-Host "  ⚠️  Resetting key: $LicenseKey" -ForegroundColor Yellow
    $confirm = Read-Host "  Are you sure? This will allow the key to be activated on a new device (y/n)"
    
    if ($confirm -ne "y") {
        Write-Host "  Cancelled." -ForegroundColor DarkGray
        return
    }

    try {
        $body = @{ license_key = $LicenseKey.ToUpper(); admin_secret = $ADMIN_SECRET } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$API_URL/api/license/reset" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10

        if ($resp.reset) {
            Write-Host "  ✅ Key reset successfully!" -ForegroundColor Green
            Write-Host "      Previous user: $($resp.previous_user)" -ForegroundColor DarkGray
            Write-Host "      Was activated: $($resp.was_activated_at)" -ForegroundColor DarkGray
            Write-Host "      Key can now be used on a new device." -ForegroundColor White
        } else {
            Write-Host "  ❌ $($resp.error)" -ForegroundColor Red
        }
        Write-Host ""
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
        Write-Host ""
    }
}

# ═══ MAIN ═══

switch ($Action.ToLower()) {
    "list" { Show-AllLicenses }
    "status" { Show-KeyStatus -LicenseKey $Key }
    "reset" { Reset-Key -LicenseKey $Key }
    default {
        Write-Host ""
        Write-Host "  Usage:" -ForegroundColor Cyan
        Write-Host "    .\Check-Licenses.ps1                    # List all licenses" -ForegroundColor White
        Write-Host "    .\Check-Licenses.ps1 -Action status -Key XXXX-XXXX-XXXX-XXXX" -ForegroundColor White
        Write-Host "    .\Check-Licenses.ps1 -Action reset -Key XXXX-XXXX-XXXX-XXXX" -ForegroundColor White
        Write-Host ""
    }
}
