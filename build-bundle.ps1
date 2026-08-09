# build-bundle.ps1
# Combines all JS files into a single obfuscated app.min.js
# Then creates a clean ZIP with just: index.html + app.min.js + README.txt

$ErrorActionPreference = "Stop"
$srcDir = "C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\LogSherlock-Pro-Local"
$buildDir = "C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\build"
$zipOutput = "C:\Gemini-Krishna-Data-june-2026\Gemini-Krishna-Data-june-2026\Videos\HPE-Log_analysis\LogSherlock-Pro.zip"

Write-Host "=== LogSherlock Pro Build Script ===" -ForegroundColor Cyan
Write-Host ""

# Clean build dir
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
$distDir = Join-Path $buildDir "LogSherlock-Pro"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# ═══════════════════════════════════════════════════════
# STEP 1: Read index.html and extract the inline script
# ═══════════════════════════════════════════════════════
Write-Host "[1/5] Reading index.html and extracting scripts..." -ForegroundColor Yellow

$htmlLines = Get-Content (Join-Path $srcDir "index.html") -Encoding UTF8
$totalLines = $htmlLines.Count
Write-Host "  index.html: $totalLines lines"

# Find the external JS file references (order matters!)
$externalScripts = @()
$scriptLineNumbers = @()
for ($i = 0; $i -lt $totalLines; $i++) {
    $line = $htmlLines[$i]
    if ($line -match '<script\s+src="([^"]+)"') {
        $src = $Matches[1]
        # Skip CDN scripts (pako)
        if ($src -notmatch "cdn\.jsdelivr|http") {
            $externalScripts += $src
            $scriptLineNumbers += $i
        }
    }
}

Write-Host "  External JS files found: $($externalScripts.Count)"

# ═══════════════════════════════════════════════════════
# STEP 2: Concatenate all external JS into one bundle
# ═══════════════════════════════════════════════════════
Write-Host "[2/5] Bundling $($externalScripts.Count) JS files..." -ForegroundColor Yellow

$bundleContent = @()
$bundleContent += "/* LogSherlock Pro v4.0 - Proprietary Software */"
$bundleContent += "/* Copyright (c) 2026 Krishna Yada. All Rights Reserved. */"
$bundleContent += "/* Unauthorized copying, reverse engineering, or distribution prohibited. */"
$bundleContent += ""

# Track which files were actually found
$foundCount = 0
$missingFiles = @()

foreach ($scriptFile in $externalScripts) {
    $filePath = Join-Path $srcDir $scriptFile
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        $bundleContent += "// --- Module: $scriptFile ---"
        $bundleContent += $content
        $bundleContent += ""
        $foundCount++
    } else {
        $missingFiles += $scriptFile
    }
}

Write-Host "  Bundled: $foundCount files"
if ($missingFiles.Count -gt 0) {
    Write-Host "  Missing: $($missingFiles.Count) files (skipped)" -ForegroundColor DarkYellow
}

# ═══════════════════════════════════════════════════════
# STEP 3: Obfuscate the bundle
# ═══════════════════════════════════════════════════════
Write-Host "[3/5] Obfuscating code..." -ForegroundColor Yellow

$rawBundle = $bundleContent -join "`n"

# --- Obfuscation layers ---
# Layer 1: Remove comments (single-line // but not URLs)
$obfuscated = $rawBundle -replace '(?m)^\s*//(?!.*https?://).*$', ''
# Layer 2: Remove multi-line comments (but keep license header)
$obfuscated = [regex]::Replace($obfuscated, '/\*(?!\s*LogSherlock|\s*Copyright|\s*Unauthorized)[\s\S]*?\*/', '')
# Layer 3: Remove excessive whitespace/blank lines
$obfuscated = [regex]::Replace($obfuscated, '(\r?\n){3,}', "`n`n")
# Layer 4: Minify - remove leading whitespace on each line
$lines = $obfuscated -split "`n"
$minified = ($lines | ForEach-Object { $_.TrimStart() }) -join "`n"
# Layer 5: Remove blank lines entirely
$minified = ($minified -split "`n" | Where-Object { $_.Trim() -ne '' }) -join "`n"

# Layer 6: Encode strings to make it harder to read
# Wrap the entire code in an eval with base64 (basic obfuscation)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($minified)
$b64 = [Convert]::ToBase64String($bytes)

# Create self-executing decoder
$finalJS = @"
/* LogSherlock Pro v4.0 - Proprietary Software */
/* Copyright (c) 2026 Krishna Yada. All Rights Reserved. */
/* Unauthorized copying, reverse engineering, or distribution is strictly prohibited. */
/* This code is protected under intellectual property law. */
(function(){var _0x=[`"$b64`"];var _s=atob(_0x[0]);var _e=document.createElement('script');_e.textContent=_s;document.head.appendChild(_e);})();
"@

$finalJSSize = [math]::Round($finalJS.Length / 1024, 0)
Write-Host "  Bundle size: ${finalJSSize} KB (obfuscated)"

# Write app.min.js
$appMinPath = Join-Path $distDir "app.min.js"
[System.IO.File]::WriteAllText($appMinPath, $finalJS, [System.Text.Encoding]::UTF8)

# ═══════════════════════════════════════════════════════
# STEP 4: Create clean index.html (no individual script tags)
# ═══════════════════════════════════════════════════════
Write-Host "[4/5] Creating clean index.html..." -ForegroundColor Yellow

# Build new HTML: keep everything except individual external <script src="*.js"> tags
# Replace them with a single <script src="app.min.js"></script> at the end
$newHtml = @()
$insertedBundle = $false
$skipLine = $false

for ($i = 0; $i -lt $totalLines; $i++) {
    $line = $htmlLines[$i]
    
    # Skip external JS script tags (non-CDN)
    if ($line -match '<script\s+src="([^"]+)"' -and $line -notmatch "cdn\.jsdelivr|http") {
        # Skip this line - but insert bundle reference at the first occurrence
        if (-not $insertedBundle) {
            # Don't insert yet - we'll add it before </body>
        }
        continue
    }
    
    # Skip HTML comments related to script sections
    if ($line -match '<!--.*(?:Enterprise|Workflow|Advanced|HPE VME|patterns).*-->') {
        continue
    }
    
    # Before </body>, insert the single bundle script
    if ($line -match '</body>') {
        if (-not $insertedBundle) {
            $newHtml += '<script src="app.min.js"></script>'
            $insertedBundle = $true
        }
        $newHtml += $line
        continue
    }
    
    $newHtml += $line
}

$cleanHtml = $newHtml -join "`n"
$indexPath = Join-Path $distDir "index.html"
[System.IO.File]::WriteAllText($indexPath, $cleanHtml, [System.Text.Encoding]::UTF8)

$htmlSize = [math]::Round((Get-Item $indexPath).Length / 1024, 0)
Write-Host "  index.html: ${htmlSize} KB"

# ═══════════════════════════════════════════════════════
# STEP 5: Create README.txt and ZIP
# ═══════════════════════════════════════════════════════
Write-Host "[5/5] Creating README.txt and ZIP..." -ForegroundColor Yellow

$readme = @"
=====================================
  LogSherlock Pro v4.0 - Quick Start
=====================================

STEP 1: Extract this folder anywhere.

STEP 2: Open a terminal in this folder and run:

    python serve.py

STEP 3: Open your browser to:

    http://localhost:5555

STEP 4: Enter your Name and License Key.
    - Get your key from your team admin (Krishna Yada)
    - Format: LS-MASTER-XXXX-XXXX or LS-XXXX-XXXX-XXXX-XXXX

STEP 5: Start scanning! Drop .tar.gz or .zip log files.

-------------------------------------
WHY serve.py?
  - Enables GitHub Copilot One-Click Sign In (OAuth)
  - Proxies GitHub API calls (browser CORS blocks direct calls)
  - If you don't need Copilot AI, you can use:
      python -m http.server 5555

GITHUB COPILOT SETUP:
  1. Run: python serve.py
  2. Open: http://localhost:5555
  3. Go to Settings (gear icon)
  4. Click "Sign in with GitHub Copilot"
  5. Enter the code shown on GitHub
  6. Done! All AI models available.

REQUIREMENTS:
  - Python 3.x (standard library only, no pip install)
  - Modern browser (Chrome, Edge, Firefox)

TROUBLESHOOTING:
  - 'python' not found? Try: python3 serve.py
  - Port in use? Edit PORT in serve.py
  - Blank page? Clear browser cache (Ctrl+Shift+Delete)

SUPPORT: Contact Krishna Yada for license keys
-------------------------------------
(c) 2026 Krishna Yada. All Rights Reserved.
Proprietary Software - Do not redistribute.
"@

$readmePath = Join-Path $distDir "README.txt"
[System.IO.File]::WriteAllText($readmePath, $readme)

# Copy serve.py (local server with GitHub OAuth proxy)
$servePySrc = Join-Path $srcDir "serve.py"
if (Test-Path $servePySrc) {
    Copy-Item $servePySrc (Join-Path $distDir "serve.py")
}

# Copy scan-worker.js (Web Worker - MUST be separate file, cannot be bundled)
$workerSrc = Join-Path $srcDir "scan-worker.js"
if (Test-Path $workerSrc) {
    Copy-Item $workerSrc (Join-Path $distDir "scan-worker.js")
}

# Create ZIP
if (Test-Path $zipOutput) { Remove-Item $zipOutput -Force }
Compress-Archive -Path $distDir -DestinationPath $zipOutput -CompressionLevel Optimal

$zipSize = [math]::Round((Get-Item $zipOutput).Length / 1MB, 2)
$fileCount = (Get-ChildItem $distDir -File).Count

Write-Host ""
Write-Host "=== BUILD COMPLETE ===" -ForegroundColor Green
Write-Host "  ZIP: $zipOutput"
Write-Host "  Size: $zipSize MB"
Write-Host "  Files inside ZIP:" -ForegroundColor Cyan
Get-ChildItem $distDir -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1024, 0)
    Write-Host "    $($_.Name) ($size KB)"
}
Write-Host ""
Write-Host "  User sees only $fileCount files when they extract!" -ForegroundColor Green
Write-Host ""
