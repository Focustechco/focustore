[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONIOENCODING = 'utf-8'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$validator = Join-Path $PSScriptRoot 'validate_local_postgres.py'
$orderTest = Join-Path $PSScriptRoot 'validate_local_orders.py'

if (-not (Test-Path -LiteralPath $python)) { throw "Python do backend nao encontrado: $python" }

$secure = Read-Host 'Senha do PostgreSQL local focusstore_test' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $secure).Password
$testSecure = Read-Host 'Senha da conta ficticia orders-validation@example.test' -AsSecureString
$testPlain = [System.Net.NetworkCredential]::new('', $testSecure).Password
$encoded = $null
try {
    $encoded = [Uri]::EscapeDataString($plain)
    $localUrl = "postgresql+psycopg://postgres:$encoded@127.0.0.1:5432/focusstore_test"
    $env:FOCUS_BACKEND_DATABASE_URL = $localUrl

    Write-Host 'Validando identidade efetiva do PostgreSQL local antes do teste...' -ForegroundColor Yellow
    & $python $validator
    if ($LASTEXITCODE -ne 0) { throw 'A validacao do destino falhou; nenhuma escrita foi realizada.' }

    $env:DATABASE_URL = $localUrl
    $env:FOCUS_TEST_ACCOUNT_EMAIL = 'orders-validation@example.test'
    $env:FOCUS_TEST_ACCOUNT_PASSWORD = $testPlain
    Write-Host 'Executando validacao de migration, pedido, idempotencia, historico e estoque...' -ForegroundColor Yellow
    & $python $orderTest
    if ($LASTEXITCODE -ne 0) { throw 'A validacao do fluxo de pedidos falhou.' }
}
finally {
    Remove-Item Env:FOCUS_BACKEND_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:FOCUS_TEST_ACCOUNT_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:FOCUS_TEST_ACCOUNT_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue
    $plain = $null
    $testPlain = $null
    $encoded = $null
    if ($secure) { $secure.Dispose() }
    if ($testSecure) { $testSecure.Dispose() }
}
