# ═══════════════════════════════════════════════════════════════════
# LogSherlock Pro — License Key Generator
# Created by: Krishna Yada
# Usage: .\Generate-License.ps1 -Days 30 -Name "John Doe"
# ═══════════════════════════════════════════════════════════════════

param(
    [Parameter(Mandatory=$false)]
    [int]$Days = 7,
    
    [Parameter(Mandatory=$false)]
    [string]$Name = "User",

    [Parameter(Mandatory=$false)]
    [switch]$Lifetime,

    [Parameter(Mandatory=$false)]
    [int]$Count = 1
)

# Secret salt for key generation (must match the one in index.html)
$SECRET = "LSPRO2026KRISHNA"

function Generate-LicenseKey {
    param([int]$ExpiryDays, [string]$UserName)
    
    # Encode days into the key
    # Format: XXXX-DDDD-SSSS-CCCC
    # XXXX = random prefix
    # DDDD = encoded days (obfuscated)
    # SSSS = signature based on days + secret
    # CCCC = random suffix + checksum
    
    $prefix = -join ((65..90) + (48..57) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
    
    # Encode days: multiply by 7, add 100, convert to base36-ish
    if ($Lifetime) {
        $encodedDays = 9999
    } else {
        $encodedDays = $ExpiryDays
    }
    
    # Days block: pad to 4 chars using hex-like encoding
    $daysHex = [Convert]::ToString(($encodedDays * 7 + 42), 16).ToUpper().PadLeft(4, '0').Substring(0, 4)
    
    # Signature: simple hash of days + secret
    $sigInput = "$encodedDays$SECRET"
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($sigInput)
    $hash = $md5.ComputeHash($bytes)
    $sig = ([BitConverter]::ToString($hash) -replace '-','').Substring(0, 4)
    
    # Checksum: XOR of all previous chars
    $allChars = "$prefix$daysHex$sig"
    $xorVal = 0
    foreach ($c in $allChars.ToCharArray()) {
        $xorVal = $xorVal -bxor [int][char]$c
    }
    $checksum = [Convert]::ToString($xorVal, 16).ToUpper().PadLeft(2, '0')
    $suffix = -join ((65..90) + (48..57) | Get-Random -Count 2 | ForEach-Object { [char]$_ })
    $lastBlock = "$checksum$suffix"
    
    return "$prefix-$daysHex-$sig-$lastBlock"
}

# ═══ MAIN ═══

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  LogSherlock Pro - License Key Generator" -ForegroundColor Cyan
Write-Host "  Created by Krishna Yada" -ForegroundColor DarkGray
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

if ($Lifetime) {
    Write-Host '  Type:     LIFETIME - no expiry' -ForegroundColor Green
} else {
    Write-Host "  Type:     $Days-day license" -ForegroundColor Yellow
}
Write-Host "  For:      $Name" -ForegroundColor White
Write-Host "  Count:    $Count keys" -ForegroundColor White
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

$keys = @()
for ($i = 1; $i -le $Count; $i++) {
    $key = Generate-LicenseKey -ExpiryDays $Days -UserName $Name
    $keys += $key
    if ($Lifetime) {
        Write-Host "  Key ${i}:  $key  LIFETIME" -ForegroundColor Green
    } else {
        Write-Host "  Key ${i}:  $key  [$Days days]" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Share these keys with your team members." -ForegroundColor DarkGray
Write-Host "  Keys are validated client-side in LogSherlock Pro." -ForegroundColor DarkGray
Write-Host ""

# Copy to clipboard if single key
if ($Count -eq 1) {
    $keys[0] | Set-Clipboard
    Write-Host "  ✅ Key copied to clipboard!" -ForegroundColor Green
    Write-Host ""
}

# Examples
Write-Host '--- USAGE EXAMPLES ---' -ForegroundColor DarkGray
Write-Host '  .\Generate-License.ps1 -Days 7' -ForegroundColor DarkGray
Write-Host '  .\Generate-License.ps1 -Days 30' -ForegroundColor DarkGray
Write-Host '  .\Generate-License.ps1 -Days 365' -ForegroundColor DarkGray
Write-Host '  .\Generate-License.ps1 -Lifetime' -ForegroundColor DarkGray
Write-Host '  .\Generate-License.ps1 -Days 90 -Count 5' -ForegroundColor DarkGray
Write-Host ""
