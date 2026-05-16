#Requires -Version 7.0
<#
.SYNOPSIS
    One-shot deploy for malik-sabrina-wedding Cloudflare Worker.
    Prompts for 2 Cloudinary secrets; Cloudflare Global API key read from vault automatically.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$VAULT_PATH  = "D:\00_ARH\.ARH-AGENT-ENV\_env-mgmt\env\state\keys_vault\_api-keys\arh-vault.json"
$PROJECT_DIR = $PSScriptRoot
$GH_REPO     = "arhsmoque/malik-sabrina-wedding-timeline"
$CF_EMAIL    = "arh.homelab@gmail.com"
$WORKER_URL  = "https://malik-sabrina-wedding-upload-worker.arh-homelab.workers.dev"

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "    FAIL: $msg" -ForegroundColor Red; exit 1 }

# ── Step 1: Load Cloudflare key from vault ───────────────────────────────────

Write-Step "Loading Cloudflare Global API key from vault..."
$vault = Get-Content $VAULT_PATH -Raw | ConvertFrom-Json
$cfKey = ($vault.keys | Where-Object { $_.name -eq "cloudflare_global_api_key" }).value
if (-not $cfKey) { Write-Fail "cloudflare_global_api_key not found in vault" }
Write-OK "Key loaded"

# ── Step 2: Collect Cloudinary secrets ───────────────────────────────────────

Write-Host ""
Write-Host "Malik-Sabrina Wedding Timeline — Worker Secrets" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Cloudinary: console.cloudinary.com → Settings → API Keys"
Write-Host "  Cloud name: dl5oqxuo1"
Write-Host ""

$cldKey    = Read-Host "Paste Cloudinary API Key"
$cldSecret = Read-Host "Paste Cloudinary API Secret"

# ── Step 3: Deploy worker ────────────────────────────────────────────────────

Write-Step "Deploying Cloudflare Worker..."
$env:CLOUDFLARE_API_KEY = $cfKey
$env:CLOUDFLARE_EMAIL   = $CF_EMAIL
Push-Location $PROJECT_DIR
try {
    $output = wrangler.cmd deploy 2>&1
    $output | Write-Host
    if ($LASTEXITCODE -ne 0) { Write-Fail "wrangler deploy failed (exit $LASTEXITCODE)" }
    Write-OK "Worker deployed: $WORKER_URL"
} finally {
    Pop-Location
    Remove-Item Env:\CLOUDFLARE_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\CLOUDFLARE_EMAIL   -ErrorAction SilentlyContinue
}

# ── Step 4: Set Cloudinary secrets on worker ─────────────────────────────────

Write-Step "Setting Cloudinary secrets on worker..."
$env:CLOUDFLARE_API_KEY = $cfKey
$env:CLOUDFLARE_EMAIL   = $CF_EMAIL
Push-Location $PROJECT_DIR
try {
    $cldKey    | wrangler.cmd secret put CLOUDINARY_API_KEY    2>&1 | Write-Host
    $cldSecret | wrangler.cmd secret put CLOUDINARY_API_SECRET 2>&1 | Write-Host
    Write-OK "Cloudinary secrets set"
} finally {
    Pop-Location
    Remove-Item Env:\CLOUDFLARE_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\CLOUDFLARE_EMAIL   -ErrorAction SilentlyContinue
}

# ── Step 5: Trigger Pages rebuild ────────────────────────────────────────────

Write-Step "Triggering GitHub Pages rebuild..."
gh workflow run pages.yml --repo $GH_REPO --ref main
Write-OK "Rebuild triggered — https://github.com/$GH_REPO/actions"

# ── Done ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "Done. Site: https://arhsmoque.github.io/malik-sabrina-wedding-timeline/" -ForegroundColor Green
Write-Host "Worker: $WORKER_URL" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
