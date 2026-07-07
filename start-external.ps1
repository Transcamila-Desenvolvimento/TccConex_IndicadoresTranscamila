# TccConex ERP - Expõe o frontend na internet via Cloudflare Tunnel (link público temporário)
# Uso:
#   1. Rode ./start.ps1 primeiro (Django + Vite na rede local)
#   2. Rode ./start-external.ps1 nesta janela
#
# O link gerado (https://....trycloudflare.com) funciona de qualquer lugar.
# A API continua passando pelo proxy do Vite — não é preciso expor a porta 8001.

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$FRONTEND_PORT = 5173

function Test-PortListening([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Resolve-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $local = Join-Path $ROOT 'tools\cloudflared.exe'
    if (Test-Path $local) { return $local }

    return $null
}

function Install-Cloudflared {
  $toolsDir = Join-Path $ROOT 'tools'
  New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
  $zipPath = Join-Path $toolsDir 'cloudflared.zip'
  $exePath = Join-Path $toolsDir 'cloudflared.exe'
  $url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

  Write-Host "Baixando cloudflared..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri $url -OutFile $exePath -UseBasicParsing
  return $exePath
}

Write-Host ""
Write-Host "=== TccConex ERP - Link externo ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-PortListening $FRONTEND_PORT)) {
    Write-Host "[AVISO] Vite nao esta rodando na porta $FRONTEND_PORT." -ForegroundColor Yellow
    Write-Host "Execute primeiro: .\start.ps1" -ForegroundColor Yellow
    Write-Host ""
    $startNow = Read-Host "Deseja iniciar os servidores agora? (s/N)"
    if ($startNow -match '^[sS]') {
        & (Join-Path $ROOT 'start.ps1')
        Write-Host "Aguardando Vite subir..." -ForegroundColor Yellow
        Start-Sleep -Seconds 6
    } else {
        exit 1
    }
}

if (-not (Test-PortListening $FRONTEND_PORT)) {
    Write-Host "[ERRO] Vite ainda nao esta acessivel na porta $FRONTEND_PORT." -ForegroundColor Red
    exit 1
}

$cloudflared = Resolve-Cloudflared
if (-not $cloudflared) {
    try {
        $cloudflared = Install-Cloudflared
    } catch {
        Write-Host "[ERRO] Nao foi possivel baixar o cloudflared: $_" -ForegroundColor Red
        Write-Host "Instale manualmente: winget install Cloudflare.cloudflared" -ForegroundColor Yellow
        exit 1
    }
}

$lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)

Write-Host "Rede local (mesma Wi-Fi/LAN):" -ForegroundColor White
Write-Host "  http://localhost:$FRONTEND_PORT" -ForegroundColor Gray
if ($lanIp) {
    Write-Host "  http://${lanIp}:$FRONTEND_PORT" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Gerando link publico (Cloudflare Tunnel)..." -ForegroundColor Green
Write-Host "Mantenha esta janela aberta. O link aparece abaixo em alguns segundos." -ForegroundColor Yellow
Write-Host ""

& $cloudflared tunnel --url "http://127.0.0.1:$FRONTEND_PORT"
