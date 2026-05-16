#Requires -Version 7.0
<#
.SYNOPSIS
    Set Firebase custom admin claim for arh.homelab@gmail.com on ash-2026-photobook.
    Uses gcloud auth + Firebase Auth REST API. No browser needed.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJECT_ID  = "ash-2026-photobook"
$ADMIN_EMAIL = "arh.homelab@gmail.com"

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK([string]$msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "    FAIL: $msg" -ForegroundColor Red; exit 1 }

# ── Get gcloud access token ───────────────────────────────────────────────────

Write-Step "Getting gcloud access token..."
$token = gcloud auth print-access-token 2>$null
if (-not $token) { Write-Fail "gcloud not authenticated. Run: gcloud auth login" }
Write-OK "Token obtained"

$headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
}

# ── Look up UID for admin email ───────────────────────────────────────────────

Write-Step "Looking up UID for $ADMIN_EMAIL..."
$lookupBody = @{ email = $ADMIN_EMAIL } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod `
        -Uri "https://identitytoolkit.googleapis.com/v1/projects/$PROJECT_ID/accounts:lookup" `
        -Method POST -Headers $headers -Body $lookupBody
    $uid = $resp.users[0].localId
    if (-not $uid) { Write-Fail "User not found in Firebase Auth — they need to sign in at least once first" }
    Write-OK "UID: $uid"
} catch {
    Write-Fail "Lookup failed: $_"
}

# ── Set custom claims ─────────────────────────────────────────────────────────

Write-Step "Setting admin custom claim..."
$claimBody = @{
    localId      = $uid
    customAttributes = '{"admin":true}'
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod `
        -Uri "https://identitytoolkit.googleapis.com/v1/projects/$PROJECT_ID/accounts:update" `
        -Method POST -Headers $headers -Body $claimBody
    Write-OK "Custom claim set — localId: $($result.localId)"
} catch {
    Write-Fail "Failed to set claim: $_"
}

Write-Host ""
Write-Host "Done. arh.homelab@gmail.com now has {admin: true} on $PROJECT_ID." -ForegroundColor Green
Write-Host "They must sign out and back in for the claim to take effect." -ForegroundColor Yellow
