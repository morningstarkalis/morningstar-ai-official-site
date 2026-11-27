$ErrorActionPreference = 'Stop'

$BaseUrl = 'https://morningstar-ai-official-site-staging.morningstarkalis.workers.dev'
$Origin = $BaseUrl

# Read the staging-only bootstrap token without echoing it.
$SecureToken = Read-Host 'Enter the current STAGING ADMIN_BOOTSTRAP_TOKEN' -AsSecureString
$TokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)

try {
    $BootstrapToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPtr)
    $BaseHeaders = @{ 'X-Admin-Bootstrap' = $BootstrapToken; 'Origin' = $Origin }

    # Each request runs exactly one scrypt operation, matching the real
    # Bootstrap hash and subsequent login verification CPU envelope.
    $HashBody = @{ mode = 'hash'; password = 'MorningStar-KDF-Preflight-2026!' } | ConvertTo-Json -Compress
    $HashResult = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/admin/bootstrap/preflight') -Headers $BaseHeaders -ContentType 'application/json' -Body $HashBody -TimeoutSec 90

    if (-not $HashResult.ok -or $HashResult.mode -ne 'hash' -or $HashResult.database_write -ne $false -or $HashResult.administrator_created -ne $false) {
        throw 'KDF hash preflight returned an unexpected result. Do not run Bootstrap.'
    }

    $VerifyBody = @{
        mode = 'verify'
        password = 'MorningStar-KDF-Preflight-2026!'
        salt = $HashResult.salt
        hash = $HashResult.hash
    } | ConvertTo-Json -Compress
    $VerifyResult = Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/admin/bootstrap/preflight') -Headers $BaseHeaders -ContentType 'application/json' -Body $VerifyBody -TimeoutSec 90

    if (-not $VerifyResult.ok -or $VerifyResult.mode -ne 'verify' -or $VerifyResult.database_write -ne $false -or $VerifyResult.administrator_created -ne $false) {
        throw 'KDF verification preflight returned an unexpected result. Do not run Bootstrap.'
    }


    Write-Host ''
    Write-Host 'PASS: Cloudflare Staging password KDF round-trip completed.' -ForegroundColor Green
    Write-Host ('Algorithm: ' + $Result.kdf)
    Write-Host ('Format: ' + $Result.format)
    Write-Host ('Hash operation wall time: ' + $HashResult.round_trip_ms + ' ms')
    Write-Host ('Verify operation wall time: ' + $VerifyResult.round_trip_ms + ' ms')
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
    Remove-Variable BootstrapToken, SecureToken, TokenPtr, BaseHeaders, HashBody, HashResult, VerifyBody, VerifyResult -ErrorAction SilentlyContinue
}
