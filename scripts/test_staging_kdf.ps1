$ErrorActionPreference = 'Stop'

$BaseUrl = 'https://morningstar-ai-official-site-staging.morningstarkalis.workers.dev'
$Origin = $BaseUrl

# Read the staging-only bootstrap token without echoing it.
$SecureToken = Read-Host 'Enter the current STAGING ADMIN_BOOTSTRAP_TOKEN' -AsSecureString
$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)

try {
    $BootstrapToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)
    $Body = @{ password = 'MorningStar-KDF-Preflight-2026!' } | ConvertTo-Json -Compress
    $Headers = @{ 'X-Admin-Bootstrap' = $BootstrapToken; 'Origin' = $Origin }

    $Result = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/admin/bootstrap/preflight') -Headers $Headers -ContentType 'application/json' -Body $Body -TimeoutSec 90

    if (-not $Result.ok -or $Result.database_write -ne $false -or $Result.administrator_created -ne $false) {
        throw 'KDF preflight returned an unexpected result. Do not run Bootstrap.'
    }

    Write-Host ''
    Write-Host 'PASS: Cloudflare Staging password KDF round-trip completed.' -ForegroundColor Green
    Write-Host ('Algorithm: ' + $Result.kdf)
    Write-Host ('Format: ' + $Result.format)
    Write-Host ('Round-trip wall time: ' + $Result.round_trip_ms + ' ms')
    Write-Host 'D1 writes: none'
    Write-Host 'Administrator created: no'
    Write-Host ''
    Write-Host 'Bootstrap is still a separate, deliberate step.'
}
catch {
    Write-Host ''
    Write-Host 'FAIL: Staging KDF preflight did not complete.' -ForegroundColor Red
    Write-Host 'Do NOT submit the administrator Bootstrap form.'
    throw
}
finally {
    if ($TokenPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPtr) }
    if ($null -ne $BootstrapToken) { $BootstrapToken = $null }
    if ($null -ne $SecureToken) { $SecureToken.Dispose() }
    Remove-Variable BootstrapToken, SecureToken, TokenPtr, Headers, Body, Result -ErrorAction SilentlyContinue
}
