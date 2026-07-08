<#
.SYNOPSIS
  Exporta dados do SQLite local e importa no Postgres Azure via App Service (VNet).

.DESCRIPTION
  Fluxo confiável para Postgres PRIVADO:
  1) dumpdata local (SQLite, UTF-8 sem BOM)
  2) upload dump.json via Kudu (publish profile)
  3) loaddata manualmente no SSH do App Service (Linux não suporta /api/command)
  4) remove dump.json remoto

.PARAMETER PublishProfilePath
  Caminho do arquivo .PublishSettings baixado do App Service.

.PARAMETER SkipExport
  Usa backend/dump.json existente sem gerar novo dump.

.EXAMPLE
  .\scripts\azure-migrate-data.ps1 -PublishProfilePath "C:\Users\voce\Downloads\tccconex-erp.PublishSettings"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PublishProfilePath,

    [switch]$SkipExport
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$BackendDir = Join-Path $RepoRoot 'backend'
$DumpPath = Join-Path $BackendDir 'dump.json'
$Python = Join-Path $BackendDir 'venv_local\Scripts\python.exe'
$ScmHost = 'tccconex-erp-dqfccjfpfuejhffu.scm.brazilsouth-01.azurewebsites.net'
$RemoteDump = '/home/site/wwwroot/dump.json'

function Get-PublishCredentials {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Publish profile não encontrado: $Path"
    }
    [xml]$xml = Get-Content -Path $Path -Raw
    $profile = $xml.publishData.publishProfile |
        Where-Object { $_.publishMethod -eq 'ZipDeploy' } |
        Select-Object -First 1
    if (-not $profile) {
        throw 'Perfil ZipDeploy não encontrado no arquivo .PublishSettings'
    }
    return [PSCustomObject]@{
        User = $profile.userName
        Password = $profile.userPWD
        ScmUrl = "https://$ScmHost"
    }
}

function Invoke-Kudu {
    param(
        [string]$Method,
        [string]$Path,
        $Cred,
        [byte[]]$Body = $null,
        [string]$ContentType = $null
    )
    $uri = "$($Cred.ScmUrl)$Path"
    $pair = "{0}:{1}" -f $Cred.User, $Cred.Password
    $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
    $headers = @{ Authorization = "Basic $token" }
    if ($ContentType) { $headers['Content-Type'] = $ContentType }

    if ($Body) {
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Body
    }
    if ($Method -eq 'PUT' -and $ContentType -eq 'application/octet-stream') {
        return Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -InFile $DumpPath -UseBasicParsing
    }
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
}

function Show-SshInstructions {
    Write-Host ''
    Write-Host '>> Próximo passo: SSH no Portal Azure (App Service > SSH)' -ForegroundColor Yellow
    Write-Host '   Cole estes comandos:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '   cd /home/site/wwwroot'
    Write-Host '   export PYTHONPATH=/home/site/wwwroot/.python_packages/lib/site-packages'
    Write-Host '   python manage.py loaddata dump.json'
    Write-Host '   rm dump.json'
    Write-Host ''
}

Write-Host '== TccConex ERP: migração SQLite -> Postgres Azure ==' -ForegroundColor Cyan

if (-not $SkipExport) {
    if (-not (Test-Path $Python)) {
        throw "Python local não encontrado: $Python"
    }
    if (-not (Test-Path (Join-Path $BackendDir 'db.sqlite3'))) {
        throw "SQLite local não encontrado: backend/db.sqlite3"
    }
    Write-Host '>> Gerando dump.json do SQLite...'
    Push-Location $BackendDir
    $stripBom = @'
import os, subprocess, sys
from pathlib import Path
env = os.environ.copy()
env['PYTHONIOENCODING'] = 'utf-8'
env['PYTHONUTF8'] = '1'
result = subprocess.run(
    [sys.executable, 'manage.py', 'dumpdata',
     '--natural-foreign', '--natural-primary',
     '-e', 'contenttypes', '-e', 'auth.permission',
     '-e', 'admin.logentry', '-e', 'sessions.session',
     '--indent', '2'],
    capture_output=True, env=env
)
if result.returncode != 0:
    sys.stderr.buffer.write(result.stderr)
    sys.exit(result.returncode)
Path('dump.json').write_bytes(result.stdout)
'@
    & $Python -c $stripBom
    if ($LASTEXITCODE -ne 0) { throw 'dumpdata falhou' }
    Pop-Location
}

if (-not (Test-Path $DumpPath)) {
    throw "dump.json não encontrado em $DumpPath"
}

$sizeMb = [math]::Round((Get-Item $DumpPath).Length / 1MB, 2)
Write-Host ">> dump.json OK ($sizeMb MB)"

$cred = Get-PublishCredentials -Path $PublishProfilePath

Write-Host '>> Removendo dump.json antigo no servidor (se existir)...'
try {
    Invoke-Kudu -Method DELETE -Path '/api/vfs/site/wwwroot/dump.json' -Cred $cred | Out-Null
} catch {
    Write-Host '   (nenhum arquivo remoto anterior)'
}

Write-Host '>> Enviando dump.json para o App Service...'
$uploadHeaders = @{
    Authorization = "Basic $([Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($cred.User):$($cred.Password)")))"
    'If-Match' = '*'
}
$null = Invoke-WebRequest `
    -Uri "$($cred.ScmUrl)/api/vfs/site/wwwroot/dump.json" `
    -Method PUT `
    -InFile $DumpPath `
    -Headers $uploadHeaders `
    -ContentType 'application/octet-stream' `
    -UseBasicParsing
Write-Host '   upload concluído'

Show-SshInstructions

Write-Host 'Upload concluído. Execute o loaddata no SSH e teste o login:' -ForegroundColor Green
Write-Host 'https://tccconex-erp-dqfccjfpfuejhffu.brazilsouth-01.azurewebsites.net'
Write-Host 'Apague backend/dump.json local quando confirmar o login.'
