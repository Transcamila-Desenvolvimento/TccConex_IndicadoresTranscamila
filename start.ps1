# TccConex ERP - Script de inicializacao do ambiente de desenvolvimento
# Uso: ./start.ps1

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# Prefer venv_local over venv
$PYTHON = "$ROOT\backend\venv_local\Scripts\python.exe"
if (-not (Test-Path $PYTHON)) {
    $PYTHON = "$ROOT\backend\venv\Scripts\python.exe"
}

$MANAGE = "$ROOT\backend\manage.py"
$FRONTEND = "$ROOT\frontend"

Write-Host ""
Write-Host "=== TccConex ERP - Iniciando servidores ===" -ForegroundColor Cyan
Write-Host ""

# Verifica se o venv existe
if (-not (Test-Path $PYTHON)) {
    Write-Host "[ERRO] Venv nao encontrado em backend\venv ou backend\venv_local" -ForegroundColor Red
    Write-Host "Execute primeiro: python -m virtualenv backend\venv_local" -ForegroundColor Yellow
    Write-Host "Depois: backend\venv_local\Scripts\pip install -r backend\requirements.txt" -ForegroundColor Yellow
    exit 1
}

# Verifica se node_modules existe
if (-not (Test-Path "$FRONTEND\node_modules")) {
    Write-Host "[AVISO] node_modules nao encontrado. Instalando dependencias..." -ForegroundColor Yellow
    Set-Location $FRONTEND
    npm.cmd install
    Set-Location $ROOT
}

# Inicia Django em nova janela (acessivel na rede local)
Write-Host "[1/2] Iniciando Django (rede: porta 8001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "& '$PYTHON' '$MANAGE' runserver 0.0.0.0:8001" -WindowStyle Normal

Start-Sleep -Milliseconds 1500

# Inicia Vite em nova janela (acessivel na rede local)
Write-Host "[2/2] Iniciando Vite (rede: porta 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-Command", "Set-Location '$FRONTEND'; npm.cmd run dev -- --host" -WindowStyle Normal

$lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)

Write-Host ""
Write-Host "Servidores iniciados!" -ForegroundColor Cyan
Write-Host "  Este PC:   http://localhost:5173" -ForegroundColor White
if ($lanIp) {
    Write-Host "  Na rede:   http://${lanIp}:5173" -ForegroundColor Yellow
}
Write-Host "  Backend:   http://localhost:8001 (API)" -ForegroundColor White
Write-Host ""
Write-Host "  Link externo (internet): rode .\start-external.ps1" -ForegroundColor Yellow
Write-Host ""
