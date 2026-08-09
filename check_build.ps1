$zip = "C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\LogSherlock-Pro.zip"
$temp = "C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\temp_check"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $temp -Force

$idx = Get-ChildItem $temp -Recurse -Filter "index.html" | Select-Object -First 1
Write-Host "Built index.html: $($idx.FullName)"
Write-Host "Size: $([math]::Round($idx.Length / 1024, 1)) KB"

$content = Get-Content $idx.FullName -Raw

Write-Host ""
Write-Host "=== Checking built index.html ==="
Write-Host "hashForStorage present: $($content -match 'hashForStorage')"
Write-Host "ls_license_key present: $($content -match 'ls_license_key')"
Write-Host "validateLicenseGate present: $($content -match 'validateLicenseGate')"

# Check the context around ls_license_key setItem
$lines = $content -split "`n"
Write-Host ""
Write-Host "=== Lines containing setItem + ls_license_key ==="
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "setItem.*ls_license_key") {
        Write-Host "Line $($i+1): $($lines[$i].Trim().Substring(0, [Math]::Min(120, $lines[$i].Trim().Length)))"
    }
}

Write-Host ""
Write-Host "=== Lines containing hashForStorage ==="
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "hashForStorage") {
        Write-Host "Line $($i+1): $($lines[$i].Trim().Substring(0, [Math]::Min(120, $lines[$i].Trim().Length)))"
    }
}

# Also check app.min.js
$appjs = Get-ChildItem $temp -Recurse -Filter "app.min.js" | Select-Object -First 1
if ($appjs) {
    $jsContent = Get-Content $appjs.FullName -Raw
    Write-Host ""
    Write-Host "=== Checking app.min.js (decoded from base64) ==="
    # The app.min.js wraps code in base64 - decode to check
    if ($jsContent -match 'atob\(_0x\[0\]\)') {
        # Extract base64 content
        if ($jsContent -match '"([A-Za-z0-9+/=]{100,})"') {
            $b64 = $Matches[1]
            $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
            Write-Host "app.min.js decoded size: $([math]::Round($decoded.Length / 1024, 1)) KB"
            Write-Host "hashForStorage in app.min.js: $($decoded -match 'hashForStorage')"
            Write-Host "ls_license_key in app.min.js: $($decoded -match 'ls_license_key')"
            
            # Check setItem calls
            $decodedLines = $decoded -split "`n"
            Write-Host ""
            Write-Host "=== app.min.js setItem ls_license_key ==="
            foreach ($line in $decodedLines) {
                if ($line -match "setItem.*ls_license_key") {
                    Write-Host $line.Trim().Substring(0, [Math]::Min(150, $line.Trim().Length))
                }
            }
        }
    }
}

# Cleanup
Remove-Item $temp -Recurse -Force
