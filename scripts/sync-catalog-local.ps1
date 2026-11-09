[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$Source = 'prisma/dev.backup.db'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONIOENCODING = 'utf-8'

$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$audit = Join-Path $PSScriptRoot 'audit_catalog_sync.py'
if (-not (Test-Path -LiteralPath $python)) { throw "Python nao encontrado: $python" }
if (-not (Test-Path -LiteralPath (Join-Path $root $Source))) { throw "Fonte nao encontrada: $(Join-Path $root $Source)" }

$secure = Read-Host 'Senha do PostgreSQL local focusstore_test' -AsSecureString
$plain = [System.Net.NetworkCredential]::new('', $secure).Password
$encoded = [Uri]::EscapeDataString($plain)
try {
    $env:FOCUS_CATALOG_DATABASE_URL = "postgresql+psycopg://postgres:$encoded@127.0.0.1:5432/focusstore_test"
    $args = @($audit, '--source', (Join-Path $root $Source))
    if ($Apply) { $args += '--apply' }
    & $python @args
    if ($LASTEXITCODE -ne 0) { throw 'A auditoria/sincronizacao foi interrompida; verifique o relatorio acima.' }
} finally {
    Remove-Item Env:FOCUS_CATALOG_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue
    $plain = $null
    $encoded = $null
    if ($secure) { $secure.Dispose() }
}
