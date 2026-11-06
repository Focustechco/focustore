[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONIOENCODING = 'utf-8'
$root = Split-Path -Parent $PSScriptRoot
$backendPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
$validatorScript = Join-Path $PSScriptRoot 'validate_local_postgres.py'

if (-not (Test-Path -LiteralPath $backendPython)) {
    throw "Python do backend não encontrado: $backendPython"
}
if (-not (Test-Path -LiteralPath $validatorScript)) {
    throw "Validador PostgreSQL não encontrado: $validatorScript"
}

$validated = $false

function Test-PortAvailable([int]$Port, [string]$ServiceName) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { return }
    $owners = $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($process) { "$($process.ProcessName) (PID $($_))" } else { "PID $($_)" }
    }
    throw "A porta $Port do $ServiceName já está ocupada por $($owners -join ', '). Nenhum processo foi encerrado automaticamente."
}

Test-PortAvailable 3000 'Next.js'
Test-PortAvailable 8000 'FastAPI'
$securePassword = $null
$plainPassword = $null
$encodedPassword = $null

try {
    while (-not $validated) {
        Write-Host 'Digite a senha do PostgreSQL local (focusstore_test):' -ForegroundColor Yellow
        $securePassword = Read-Host -AsSecureString
        if ($securePassword.Length -eq 0) {
            Write-Warning 'A senha não pode ser vazia.'
            $securePassword.Dispose()
            $securePassword = $null
            continue
        }

        $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
        $encodedPassword = [Uri]::EscapeDataString($plainPassword)
        $env:FOCUS_BACKEND_DATABASE_URL = "postgresql+psycopg://postgres:$encodedPassword@127.0.0.1:5432/focusstore_test"

        & $backendPython $validatorScript
        if ($LASTEXITCODE -eq 0) {
            $validated = $true
        } else {
            Write-Warning 'A validação falhou. Corrija o motivo indicado e tente novamente.'
            Remove-Item Env:FOCUS_BACKEND_DATABASE_URL -ErrorAction SilentlyContinue
        }

        $plainPassword = $null
        $encodedPassword = $null
        $securePassword.Dispose()
        $securePassword = $null
    }

    $env:FRONTEND_ORIGIN = 'http://127.0.0.1:3000'
    $env:AUTH_COOKIE_SECURE = 'false'
    $env:NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000'
    $env:FOCUS_FRONTEND_PORT = '3000'
    $env:FOCUS_BACKEND_PORT = '8000'

    Write-Host 'Destino validado. Iniciando Next.js e FastAPI sem migrations ou seeds.' -ForegroundColor Green
    Push-Location $root
    try {
        & npx.cmd tsx scripts/dev-fullstack.ts
        if ($LASTEXITCODE -ne 0) {
            throw "O stack local encerrou com código $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:FOCUS_BACKEND_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:FRONTEND_ORIGIN -ErrorAction SilentlyContinue
    Remove-Item Env:AUTH_COOKIE_SECURE -ErrorAction SilentlyContinue
    Remove-Item Env:NEXT_PUBLIC_APP_URL -ErrorAction SilentlyContinue
    Remove-Item Env:FOCUS_FRONTEND_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:FOCUS_BACKEND_PORT -ErrorAction SilentlyContinue
    $plainPassword = $null
    $encodedPassword = $null
    if ($securePassword) {
        $securePassword.Dispose()
    }
}
