#Requires -Version 7.0
<#
.SYNOPSIS
    One-shot deploy for malik-sabrina-wedding Cloudflare Worker.
    Prompts for 3 secrets, handles everything else automatically.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$VAULT_PATH  = "D:\00_ARH\.ARH-AGENT-ENV\_env-mgmt\env\state\keys_vault\_api-keys\arh-vault.json"
$VAULT_MD    = "D:\00_ARH\.ARH-AGENT-ENV\_env-mgmt\env\state\keys_vault\_api-keys\VAULT.md"
$PROJECT_DIR = $PSScriptRoot
$GH_REPO     = "arhsmoque/malik-sabrina-wedding-timeline"

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "    FAIL: $msg" -ForegroundColor Red; exit 1 }

# ── Step 1: Collect secrets ──────────────────────────────────────────────────

Write-Host ""
Write-Host "Malik-Sabrina Wedding Timeline — Worker Deploy" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "You need 3 values. Steps:"
Write-Host "  1. Cloudflare token: dash.cloudflare.com → My Profile → API Tokens"
Write-Host "     → Create Token → 'Edit Cloudflare Workers' template"
Write-Host "     → Set Account: arh.homelab@gmail.com → Create Token → Copy"
Write-Host ""
Write-Host "  2. Cloudinary: console.cloudinary.com → Settings → API Keys"
Write-Host "     → Copy API Key and API Secret for cloud 'dl5oqxuo1'"
Write-Host ""

$cfToken = Read-Host "Paste Cloudflare API Token (cfk_...)"
if (-not $cfToken.StartsWith("cfk_") -and -not $cfToken.StartsWith("v1.0")) {
    Write-Host "    WARNING: token doesn't look like a Cloudflare API token — continuing anyway" -ForegroundColor Yellow
}

$cldKey    = Read-Host "Paste Cloudinary API Key"
$cldSecret = Read-Host "Paste Cloudinary API Secret"

# ── Step 2: Verify Cloudflare token ─────────────────────────────────────────

Write-Step "Verifying Cloudflare token..."
$headers = @{ Authorization = "Bearer $cfToken" }
try {
    $verify = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/user/tokens/verify" -Headers $headers
    if ($verify.success) {
        Write-OK "Token valid: $($verify.result.status)"
    } else {
        Write-Fail "Token rejected: $($verify.errors | ConvertTo-Json -Compress)"
    }
} catch {
    Write-Fail "Token verification failed: $_"
}

# ── Step 3: Store token in vault ─────────────────────────────────────────────

Write-Step "Storing Cloudflare token in vault..."
$vault = Get-Content $VAULT_PATH -Raw | ConvertFrom-Json

# Update or add cloudflare_api_token
$existing = $vault.keys | Where-Object { $_.name -eq "cloudflare_api_token" }
if ($existing) {
    $existing.value        = $cfToken
    $existing.last_rotated = (Get-Date -Format "yyyy-MM-dd")
} else {
    $entry = [PSCustomObject]@{
        name            = "cloudflare_api_token"
        service         = "Cloudflare"
        type            = "api_token"
        value           = $cfToken
        description     = "Cloudflare API token — Edit Cloudflare Workers scope, arh.homelab@gmail.com"
        last_rotated    = (Get-Date -Format "yyyy-MM-dd")
        injector        = $null
        proxy_available = $false
        proxy           = $null
    }
    $vault.keys += $entry
}
$vault | ConvertTo-Json -Depth 10 | Set-Content $VAULT_PATH -Encoding UTF8
Write-OK "Vault updated"

# Also update VAULT.md
$vaultMd = Get-Content $VAULT_MD -Raw
if ($vaultMd -match "cloudflare_api_token") {
    $vaultMd = $vaultMd -replace "(?m)^(cloudflare_api_token\r?\n).*", "`${1}$cfToken"
    Set-Content $VAULT_MD $vaultMd -Encoding UTF8
} else {
    Add-Content $VAULT_MD "`ncloudflare_api_token`n$cfToken" -Encoding UTF8
}
Write-OK "VAULT.md updated"

# ── Step 4: Deploy worker ────────────────────────────────────────────────────

Write-Step "Deploying Cloudflare Worker..."
$env:CLOUDFLARE_API_TOKEN = $cfToken
Push-Location $PROJECT_DIR
try {
    $result = wrangler.cmd deploy 2>&1
    $resultStr = $result -join "`n"
    Write-Host $resultStr
    if ($LASTEXITCODE -ne 0) { Write-Fail "wrangler deploy failed (exit $LASTEXITCODE)" }
    Write-OK "Worker deployed"
} finally {
    Pop-Location
    Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
}

# Extract worker URL
$workerUrl = ""
if ($resultStr -match "https://[\w\-]+\.[\w\-]+\.workers\.dev") {
    $workerUrl = $Matches[0]
    Write-OK "Worker URL: $workerUrl"
} else {
    # Construct from known pattern
    # Get account subdomain via API
    try {
        $acct = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/dc3bfa957bdf216b7cc45214455aaa72" `
            -Headers @{ Authorization = "Bearer $cfToken" }
        $subdomain = $acct.result.subdomain
        if ($subdomain) {
            $workerUrl = "https://malik-sabrina-wedding-upload-worker.$subdomain.workers.dev"
            Write-OK "Worker URL (constructed): $workerUrl"
        }
    } catch {}
}

# ── Step 5: Set wrangler secrets ─────────────────────────────────────────────

Write-Step "Setting Cloudinary secrets on worker..."
$env:CLOUDFLARE_API_TOKEN = $cfToken
Push-Location $PROJECT_DIR
try {
    echo $cldKey    | wrangler.cmd secret put CLOUDINARY_API_KEY    2>&1 | Write-Host
    echo $cldSecret | wrangler.cmd secret put CLOUDINARY_API_SECRET 2>&1 | Write-Host
    if ($LASTEXITCODE -ne 0) { Write-Host "    WARNING: secret put may have had issues — check above" -ForegroundColor Yellow }
    else { Write-OK "Cloudinary secrets set" }
} finally {
    Pop-Location
    Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
}

# ── Step 6: Update GitHub secret VITE_UPLOAD_WORKER_URL ──────────────────────

if ($workerUrl) {
    Write-Step "Updating GitHub secret VITE_UPLOAD_WORKER_URL..."
    $workerUrl | gh secret set VITE_UPLOAD_WORKER_URL --repo $GH_REPO
    Write-OK "GitHub secret updated: $workerUrl"
} else {
    Write-Host "    SKIP: Could not determine worker URL — set VITE_UPLOAD_WORKER_URL manually" -ForegroundColor Yellow
}

# ── Step 7: Trigger GitHub Pages rebuild ─────────────────────────────────────

Write-Step "Triggering GitHub Pages rebuild..."
gh workflow run pages.yml --repo $GH_REPO --ref main
Write-OK "Rebuild triggered — https://github.com/$GH_REPO/actions"

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "All done. Site: https://arhsmoque.github.io/malik-sabrina-wedding-timeline/" -ForegroundColor Green
if ($workerUrl) {
    Write-Host "Worker: $workerUrl" -ForegroundColor Green
}
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
