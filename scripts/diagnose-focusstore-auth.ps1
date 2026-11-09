[CmdletBinding()]
param([switch]$RunAuthFlow)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$validator = Join-Path $PSScriptRoot 'validate_local_postgres.py'

function Write-Step([string]$Name, [string]$Result, [string]$Detail = '') {
    if ([string]::IsNullOrWhiteSpace($Detail)) { Write-Host "[$Result] $Name" }
    else { Write-Host "[$Result] $Name - $Detail" }
}

function Get-SafeExceptionMessage([System.Management.Automation.ErrorRecord]$Record) {
    $message = [string]$Record.Exception.Message
    if ([string]::IsNullOrWhiteSpace($message)) { $message = $Record.Exception.GetType().Name }
    $message = $message -replace '(?i)(password|pwd|token|authorization|cookie)\s*[:=]\s*[^\s;]+', '$1=[redacted]'
    $message = $message -replace '(?i)(https?://)([^/\s@]+):([^@\s]+)@', '$1[redacted]@'
    return $message
}

function Get-ResultDetail($Result) {
    if ($null -ne $Result.Status) { return "HTTP $($Result.Status)" }
    if (-not [string]::IsNullOrWhiteSpace($Result.Error)) { return $Result.Error }
    return 'No HTTP response'
}

function Get-SafeResponseMessage($Result) {
    if ([string]::IsNullOrWhiteSpace($Result.Body)) { return 'No response body' }
    try {
        $json = $Result.Body | ConvertFrom-Json
        $message = if ($json.detail) { [string]$json.detail } elseif ($json.error) { [string]$json.error } else { 'JSON error without detail' }
    } catch { $message = 'Non-JSON response body' }
    if ($message.Length -gt 200) { $message = $message.Substring(0, 200) }
    return ($message -replace '(?i)(password|pwd|token|authorization|cookie)\s*[:=]\s*[^\s;]+', '$1=[redacted]')
}

function Get-DisplayValue($Value, [string]$Fallback = 'unknown') {
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return $Fallback }
    return [string]$Value
}

function Invoke-SafeHttp {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [ValidateSet('GET', 'POST', 'DELETE')][string]$Method = 'GET',
        [hashtable]$Headers = @{},
        [string]$Body,
        [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
    )
    try {
        $params = @{ Uri = $Uri; Method = $Method; UseBasicParsing = $true; TimeoutSec = 10 }
        if ($null -ne $Headers -and $Headers.Count -gt 0) { $params.Headers = $Headers }
        if (-not [string]::IsNullOrEmpty($Body)) { $params.Body = $Body; $params.ContentType = 'application/json; charset=utf-8' }
        if ($null -ne $WebSession) { $params.WebSession = $WebSession }
        $response = Invoke-WebRequest @params
        return [pscustomobject]@{
            Ok = $true; Status = [int]$response.StatusCode; Body = $response.Content; Response = $response; Error = $null
            CorrelationId = $response.Headers['x-focus-correlation-id']; FailureSource = $response.Headers['x-focus-failure-source']
            ErrorType = $response.Headers['x-focus-error-type']; FailureStage = $response.Headers['x-focus-failure-stage']
            ErrorCode = $response.Headers['x-focus-error-code']; Target = $response.Headers['x-focus-target']
            ReceivedOrigin = $response.Headers['x-focus-received-origin']; RequestOrigin = $response.Headers['x-focus-request-origin']; ExpectedOrigin = $response.Headers['x-focus-expected-origin']
        }
    } catch {
        $response = $_.Exception.Response
        if ($null -ne $response) {
            $body = ''
            try {
                $reader = [IO.StreamReader]::new($response.GetResponseStream())
                try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
            } catch { $body = '' }
            return [pscustomobject]@{
                Ok = $false; Status = [int]$response.StatusCode; Body = $body; Response = $response; Error = "HTTP $([int]$response.StatusCode)"
                CorrelationId = $response.Headers['x-focus-correlation-id']; FailureSource = $response.Headers['x-focus-failure-source']
                ErrorType = $response.Headers['x-focus-error-type']; FailureStage = $response.Headers['x-focus-failure-stage']
                ErrorCode = $response.Headers['x-focus-error-code']; Target = $response.Headers['x-focus-target']
                ReceivedOrigin = $response.Headers['x-focus-received-origin']; RequestOrigin = $response.Headers['x-focus-request-origin']; ExpectedOrigin = $response.Headers['x-focus-expected-origin']
            }
        }
        return [pscustomobject]@{ Ok = $false; Status = $null; Body = ''; Response = $null; Error = (Get-SafeExceptionMessage $_); CorrelationId = $null; FailureSource = $null; ErrorType = $null; FailureStage = $null; ErrorCode = $null; Target = $null; ReceivedOrigin = $null; RequestOrigin = $null; ExpectedOrigin = $null }
    }
}

Write-Host 'FocusStore - local auth diagnostic'
Write-Host 'Read-only preflight runs before credentials or auth writes.'

$health = Invoke-SafeHttp 'http://127.0.0.1:8000/health'
if ($health.Ok -and $health.Status -eq 200) { Write-Step 'FastAPI health' 'OK' 'HTTP 200' }
else { Write-Step 'FastAPI health' 'FAIL' (Get-ResultDetail $health) }

$frontend = Invoke-SafeHttp 'http://127.0.0.1:3000'
if ($frontend.Ok -and $frontend.Status -eq 200) { Write-Step 'Next.js root' 'OK' 'HTTP 200' }
else { Write-Step 'Next.js root' 'FAIL' (Get-ResultDetail $frontend) }

$openapi = Invoke-SafeHttp 'http://127.0.0.1:8000/openapi.json'
$openapiOk = $false
if ($openapi.Ok -and $openapi.Status -eq 200) {
    try {
        $document = $openapi.Body | ConvertFrom-Json
        $required = @('/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/users/me')
        $missing = @($required | Where-Object { -not ($document.paths.PSObject.Properties.Name -contains $_) })
        if ($missing.Count -eq 0) { $openapiOk = $true; Write-Step 'FastAPI OpenAPI auth routes' 'OK' 'routes present' }
        else { Write-Step 'FastAPI OpenAPI auth routes' 'FAIL' ("missing: " + ($missing -join ', ')) }
    } catch { Write-Step 'FastAPI OpenAPI auth routes' 'FAIL' (Get-SafeExceptionMessage $_) }
} else { Write-Step 'FastAPI OpenAPI auth routes' 'FAIL' (Get-ResultDetail $openapi) }

$identity = Invoke-SafeHttp 'http://127.0.0.1:8000/api/v1/users/me' 'GET' @{ Origin = 'http://127.0.0.1:3000' }
if ($identity.Status -eq 401) { Write-Step 'FastAPI identity boundary' 'OK' 'HTTP 401 without a session' }
else { Write-Step 'FastAPI identity boundary' 'FAIL' (Get-ResultDetail $identity) }

$preflightOk = ($health.Ok -and $health.Status -eq 200) -and ($frontend.Ok -and $frontend.Status -eq 200) -and $openapiOk -and ($identity.Status -eq 401)
if (-not $preflightOk) {
    Write-Host 'PRECHECK FAILED: auth flow stopped before credentials and POST.'
    exit 2
}

$originHeaders = @{ Origin = 'http://127.0.0.1:3000'; 'Sec-Fetch-Site' = 'same-site' }
$proxyValidation = Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/register' 'POST' $originHeaders '{}'
if ($proxyValidation.Status -eq 400) { Write-Step 'Next.js register validation' 'OK' 'HTTP 400 without a write' }
else { Write-Step 'Next.js register validation' 'INFO' (Get-ResultDetail $proxyValidation) }

if (-not $RunAuthFlow) {
    Write-Host 'PRECHECK PASSED: no auth write was executed.'
    Write-Host 'Run authorized flow with: .\scripts\diagnose-focusstore-auth.ps1 -RunAuthFlow'
    exit 0
}

if (-not (Test-Path -LiteralPath $python)) { throw "Backend Python not found: $python" }
if (-not (Test-Path -LiteralPath $validator)) { throw "PostgreSQL validator not found: $validator" }

$securePassword = $null
$plainPassword = $null
$encodedPassword = $null
$secureTestPassword = $null
$testPassword = $null
$webSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$email = "focusstore.diagnostic.$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))@example.test"

try {
    Write-Host 'Enter local PostgreSQL password in this window:' -ForegroundColor Yellow
    $securePassword = Read-Host -AsSecureString
    $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $env:FOCUS_BACKEND_DATABASE_URL = "postgresql+psycopg://postgres:$encodedPassword@127.0.0.1:5432/focusstore_test"
    & $python $validator
    if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL identity was not validated; auth flow stopped.' }
    Write-Step 'Local PostgreSQL identity' 'OK' 'local target accepted'

    Write-Host 'Enter disposable test-account password in this window:' -ForegroundColor Yellow
    $secureTestPassword = Read-Host -AsSecureString
    $testPassword = [System.Net.NetworkCredential]::new('', $secureTestPassword).Password
    if ([string]::IsNullOrEmpty($testPassword) -or $testPassword.Length -lt 12) { throw 'Test password must contain at least 12 characters.' }

    $headers = @{ Origin = 'http://127.0.0.1:3000'; 'Sec-Fetch-Site' = 'same-site' }
    $registerBody = @{ name = 'FocusStore Diagnostic'; email = $email; password = $testPassword } | ConvertTo-Json
    $registered = Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/register' 'POST' $headers $registerBody $webSession
    if (-not $registered.Ok -or $registered.Status -ne 201) {
        Write-Step 'Registration through Next.js' 'FAIL' (Get-ResultDetail $registered)
        Write-Host "  source=$(Get-DisplayValue $registered.FailureSource) correlation=$(Get-DisplayValue $registered.CorrelationId 'not returned') type=$(Get-DisplayValue $registered.ErrorType (Get-DisplayValue $registered.Error 'HTTP error'))"
        Write-Host "  stage=$(Get-DisplayValue $registered.FailureStage) code=$(Get-DisplayValue $registered.ErrorCode) target=$(Get-DisplayValue $registered.Target)"
        if ($registered.ReceivedOrigin -or $registered.RequestOrigin -or $registered.ExpectedOrigin) {
            Write-Host "  received_origin=$(Get-DisplayValue $registered.ReceivedOrigin) request_origin=$(Get-DisplayValue $registered.RequestOrigin) expected_origin=$(Get-DisplayValue $registered.ExpectedOrigin)"
        }
        Write-Host "  message=$(Get-SafeResponseMessage $registered)"
        throw 'Registration failed; see sanitized diagnostic details above.'
    }
    Write-Step 'Registration through Next.js' 'OK' 'HTTP 201'

    $env:FOCUS_DIAGNOSTIC_EMAIL = $email
    $sql = @'
import json, os, psycopg
with psycopg.connect(os.environ['FOCUS_BACKEND_DATABASE_URL'].replace('postgresql+psycopg://', 'postgresql://', 1)) as c:
    with c.cursor() as cur:
        cur.execute("""SELECT u.role, count(s.id), count(s.revoked_at)
                       FROM public.users u LEFT JOIN public.user_sessions s ON s.user_id = u.id
                       WHERE u.email = %s GROUP BY u.role""", (os.environ['FOCUS_DIAGNOSTIC_EMAIL'],))
        print(json.dumps(cur.fetchone(), default=str))
'@
        $tempSqlScript = Join-Path ([System.IO.Path]::GetTempPath()) (
        "focusstore_sql_" + [guid]::NewGuid().ToString("N") + ".py"
    )

    try {
        [System.IO.File]::WriteAllText(
            $tempSqlScript,
            $sql,
            [System.Text.UTF8Encoding]::new($false)
        )

        $persisted = (& $python $tempSqlScript | Out-String).Trim()
        $sqlExitCode = $LASTEXITCODE
    }
    finally {
        Remove-Item -LiteralPath $tempSqlScript -ErrorAction SilentlyContinue
    }

    if ($sqlExitCode -ne 0) {
        throw "PostgreSQL query failed with exit code $sqlExitCode."
    }
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($persisted) -or $persisted -eq 'null') { throw 'PostgreSQL query did not confirm the account.' }
    Write-Step 'PostgreSQL persistence' 'OK' 'public users and sessions confirmed'

    $loginBody = @{ identifier = $email; password = $testPassword } | ConvertTo-Json
    $loggedIn = Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/login' 'POST' $headers $loginBody $webSession
    if (-not $loggedIn.Ok -or $loggedIn.Status -ne 200) { throw "Login failed with $(Get-ResultDetail $loggedIn)." }
    Write-Step 'Login through Next.js' 'OK' 'HTTP 200'

    $cookie = $webSession.Cookies.GetCookies('http://127.0.0.1:3000') | Where-Object Name -eq 'focus_session' | Select-Object -First 1
    if ($null -eq $cookie) { throw 'focus_session cookie was not stored.' }
    $staleToken = $cookie.Value
    $session = Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/session' 'GET' $headers $null $webSession
    if (-not $session.Ok -or $session.Status -ne 200) { throw "Session lookup failed with $(Get-ResultDetail $session)." }
    Write-Step 'Session lookup' 'OK' 'HTTP 200'

    $logout = Invoke-SafeHttp 'http://127.0.0.1:3000/api/auth/session' 'DELETE' $headers $null $webSession
    if (-not $logout.Ok -or $logout.Status -ne 200) { throw "Logout failed with $(Get-ResultDetail $logout)." }
    Write-Step 'Logout' 'OK' 'HTTP 200'

    $revoked = Invoke-SafeHttp 'http://127.0.0.1:8000/api/v1/users/me' 'GET' @{ Origin = 'http://127.0.0.1:3000'; Cookie = "focus_session=$staleToken" }
    if ($revoked.Status -eq 401) { Write-Step 'Revoked-session reuse' 'OK' 'HTTP 401' }
    else { Write-Step 'Revoked-session reuse' 'FAIL' (Get-ResultDetail $revoked) }
} finally {
    Remove-Item Env:FOCUS_BACKEND_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:FOCUS_DIAGNOSTIC_EMAIL -ErrorAction SilentlyContinue
    $plainPassword = $null
    $encodedPassword = $null
    $testPassword = $null
    if ($securePassword) { $securePassword.Dispose() }
    if ($secureTestPassword) { $secureTestPassword.Dispose() }
}
