# Configura variaveis Google OAuth no App Service a partir de backend/.env
# Uso: az login  ->  .\scripts\azure-set-google-oauth.ps1

$ErrorActionPreference = 'Stop'

$ResourceGroup = 'tccconex-erp'
$AppName = 'tccconex-erp'
$EnvFile = Join-Path $PSScriptRoot '..\backend\.env'
$ProductionUrl = 'https://tccconex-erp-dqfccjfpfuejhffu.brazilsouth-01.azurewebsites.net'
$RedirectUri = "$ProductionUrl/auth/google/callback"

function Read-DotEnvValue([string]$Key) {
    if (-not (Test-Path $EnvFile)) {
        throw "Arquivo nao encontrado: $EnvFile"
    }
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line -split '=', 2)[1].Trim()
    $value.Trim('"').Trim("'")
}

az account show 1>$null 2>$null
if ($LASTEXITCODE -ne 0) { throw "Execute 'az login' antes." }

$clientId = Read-DotEnvValue 'GOOGLE_OAUTH_CLIENT_ID'
$clientSecret = Read-DotEnvValue 'GOOGLE_OAUTH_CLIENT_SECRET'
$hd = Read-DotEnvValue 'GOOGLE_OAUTH_HD'
if (-not $hd) { $hd = 'transcamila.com.br' }

if (-not $clientId -or -not $clientSecret) {
    throw "Defina GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET em backend/.env"
}

Write-Host "Configurando Google OAuth no App Service $AppName ..." -ForegroundColor Cyan
Write-Host "  REDIRECT_URI = $RedirectUri"

az webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings `
    GOOGLE_OAUTH_CLIENT_ID=$clientId `
    GOOGLE_OAUTH_CLIENT_SECRET=$clientSecret `
    GOOGLE_OAUTH_REDIRECT_URI=$RedirectUri `
    GOOGLE_OAUTH_HD=$hd `
    FRONTEND_BASE_URL=$ProductionUrl | Out-Null

Write-Host "OK. Reiniciando app ..." -ForegroundColor Green
az webapp restart --resource-group $ResourceGroup --name $AppName | Out-Null

Write-Host ""
Write-Host "No Google Cloud Console, confirme:" -ForegroundColor Yellow
Write-Host "  Origem JS:      $ProductionUrl"
Write-Host "  Redirect URI:   $RedirectUri"
Write-Host "  APIs ativas:    People API (contatos)"
Write-Host ""
Write-Host "Teste: login ERP -> Selecionar ambiente -> Meu Perfil -> Vincular Google"
