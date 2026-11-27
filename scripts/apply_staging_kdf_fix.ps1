$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $RepoRoot

$ExpectedBranch = 'feature/two-product-lines-public-nc'
$CurrentBranch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $CurrentBranch -ne $ExpectedBranch) {
    throw "Open the existing $ExpectedBranch branch before running this script. Current branch: $CurrentBranch"
}

$StatusLines = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git working-tree status.' }
$UnexpectedChanges = @($StatusLines | Where-Object { $_ -notmatch '^ M\s+wrangler\.staging\.jsonc$' })
if ($UnexpectedChanges.Count -gt 0) {
    Write-Host 'The working tree contains changes other than the known local Staging config edit:' -ForegroundColor Yellow
    $UnexpectedChanges | ForEach-Object { Write-Host $_ }
    throw 'Stop here. This script will not overwrite or stash unrelated local changes.'
}

$ConfigPath = Join-Path $RepoRoot 'wrangler.staging.jsonc'
$OriginalConfig = [System.IO.File]::ReadAllText($ConfigPath)
$ConfigObject = $OriginalConfig | ConvertFrom-Json
if ($ConfigObject.name -ne 'morningstar-ai-official-site-staging' -or
    $ConfigObject.d1_databases[0].database_id -ne '74cd1491-8d8b-4e56-8ab8-69839ccc60e8' -or
    $ConfigObject.observability.logs.invocation_logs -ne $false) {
    throw 'Staging config safety check failed. Worker name, D1 ID or invocation_logs setting is not the expected Staging value.'
}
$ConfigBackupPath = Join-Path $env:TEMP ('morningstar-staging-config-' + [guid]::NewGuid().ToString('N') + '.jsonc')
Copy-Item -LiteralPath $ConfigPath -Destination $ConfigBackupPath -Force

try {
    Write-Host 'Fetching the reviewed MorningStar Staging fix...' -ForegroundColor Cyan
    git fetch origin "refs/heads/$ExpectedBranch:refs/remotes/origin/$ExpectedBranch"
    if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }

    git merge --ff-only "origin/$ExpectedBranch"
    if ($LASTEXITCODE -ne 0) { throw 'Fast-forward update failed. No reset or force operation will be attempted.' }
}
finally {
    # Preserve the locally verified invocation_logs=false setting.
    Copy-Item -LiteralPath $ConfigBackupPath -Destination $ConfigPath -Force
    Remove-Item -LiteralPath $ConfigBackupPath -Force -ErrorAction SilentlyContinue
}

$ConfigAfterUpdate = ([System.IO.File]::ReadAllText($ConfigPath) | ConvertFrom-Json)
if ($ConfigAfterUpdate.observability.logs.invocation_logs -ne $false -or
    $ConfigAfterUpdate.d1_databases[0].database_id -ne '74cd1491-8d8b-4e56-8ab8-69839ccc60e8') {
    throw 'Staging safety config was not preserved. Deployment stopped.'
}

Write-Host ''
Write-Host '1/4 Checking Worker syntax...' -ForegroundColor Cyan
node --check .\src\worker.js
if ($LASTEXITCODE -ne 0) { throw 'Worker syntax validation failed.' }

Write-Host '2/4 Running password KDF regression tests...' -ForegroundColor Cyan
node .\scripts\test_password_kdf.mjs
if ($LASTEXITCODE -ne 0) { throw 'Password KDF regression tests failed.' }

Write-Host '3/4 Deploying to the isolated Staging Worker only...' -ForegroundColor Cyan
npx.cmd --yes wrangler@4 deploy --config .\wrangler.staging.jsonc
if ($LASTEXITCODE -ne 0) { throw 'Staging deployment failed. No Bootstrap request was sent.' }

$BaseUrl = 'https://morningstar-ai-official-site-staging.morningstarkalis.workers.dev'
$Health = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/health') -TimeoutSec 30
if (-not $Health.ok -or $Health.database -ne 'connected') {
    throw 'Staging health check failed. Do not run Bootstrap.'
}
$Setup = Invoke-RestMethod -Method Get -Uri ($BaseUrl + '/api/setup-status') -TimeoutSec 30
if ($Setup.needs_admin -ne $true -or $Setup.bootstrap_configured -ne $true) {
    throw 'Staging bootstrap state is not the expected first-admin state. Do not run Bootstrap.'
}

Write-Host '4/4 Testing the real Cloudflare Worker KDF without creating an account...' -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'test_staging_kdf.ps1')

Write-Host ''
Write-Host 'STAGING KDF FIX VERIFIED.' -ForegroundColor Green
Write-Host 'Worker syntax: PASS'
Write-Host 'Local password KDF regression tests: PASS'
Write-Host 'Staging deployment and health: PASS'
Write-Host 'Cloudflare runtime hash + verify preflight: PASS'
Write-Host 'D1 user/admin/session records: unchanged by the preflight'
Write-Host 'Production Worker and Production D1: untouched'
Write-Host ''
Write-Host 'The administrator Bootstrap action remains separate and has not been submitted.'
