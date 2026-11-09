$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'diagnose-focusstore-auth.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

$preflightIndex = $source.IndexOf('$preflightOk')
$credentialIndex = $source.IndexOf('Read-Host -AsSecureString')
$postIndex = $source.IndexOf("Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/register' 'POST'", $credentialIndex)
$earlyExitIndex = $source.IndexOf("exit 2", $preflightIndex)

Assert-True ($preflightIndex -ge 0) 'preflight gate exists'
Assert-True ($earlyExitIndex -gt $preflightIndex) 'failed preflight exits before auth flow'
Assert-True ($credentialIndex -gt $earlyExitIndex) 'credentials are requested after the preflight gate'
Assert-True ($postIndex -gt $credentialIndex) 'registration POST is after credentials and preflight'
Assert-True ($source.Contains("return 'No HTTP response'")) 'diagnostic has a non-empty no-response result'
Assert-True ($source.Contains('PRECHECK FAILED: auth flow stopped before credentials and POST.')) 'early-stop message is explicit'
Assert-True ($source.Contains('x-focus-error-type')) 'diagnostic captures sanitized error type'
Assert-True ($source.Contains('x-focus-failure-stage')) 'diagnostic captures failure stage'
Assert-True ($source.Contains('x-focus-error-code')) 'diagnostic captures error code'

Write-Host 'DIAGNOSE_SCRIPT_REGRESSION=0'
