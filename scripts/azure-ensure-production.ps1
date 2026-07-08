# Garante configuracao estavel do App Service apos deploy (rode uma vez ou apos mudar portal).
# Uso: az login  ->  .\scripts\azure-ensure-production.ps1

$ErrorActionPreference = 'Stop'

$ResourceGroup = 'tccconex-erp'
$AppName = 'tccconex-erp'
$StartupFile = 'bash startup.sh'

function Assert-AzLogin {
    az account show 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Execute 'az login' antes de rodar este script."
    }
}

Assert-AzLogin

Write-Host "== TccConex ERP: garantindo producao estavel ==" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup | App: $AppName"
Write-Host ""

Write-Host "[1/5] Startup Command -> $StartupFile" -ForegroundColor Yellow
$current = az webapp config show --resource-group $ResourceGroup --name $AppName --query appCommandLine -o tsv
Write-Host "  Atual: $current"
if ($current -ne $StartupFile) {
    az webapp config set --resource-group $ResourceGroup --name $AppName --startup-file $StartupFile | Out-Null
    Write-Host "  Corrigido." -ForegroundColor Green
} else {
    Write-Host "  OK." -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/5] Always On" -ForegroundColor Yellow
az webapp config set --resource-group $ResourceGroup --name $AppName --always-on true | Out-Null
Write-Host "  OK." -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] App settings de boot/deploy" -ForegroundColor Yellow
az webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings `
    SCM_DO_BUILD_DURING_DEPLOYMENT=false `
    WEBSITES_PORT=8000 `
    WEBSITES_CONTAINER_START_TIME_LIMIT=900 | Out-Null
Write-Host "  OK (Oryx build off, porta 8000, timeout boot 900s)." -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Health check -> /health/" -ForegroundColor Yellow
az webapp config set --resource-group $ResourceGroup --name $AppName `
    --generic-configurations '{"healthCheckPath": "/health/"}' 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK." -ForegroundColor Green
} else {
    Write-Host "  Configure manualmente: Monitoring -> Health check -> /health/" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "[5/5] Restart" -ForegroundColor Yellow
az webapp restart --resource-group $ResourceGroup --name $AppName
Write-Host "  OK." -ForegroundColor Green

Write-Host ""
Write-Host "Pronto. No Log stream deve aparecer:" -ForegroundColor Green
Write-Host "  Site's appCommandLine: bash startup.sh"
Write-Host "  == TccConex ERP startup.sh v5 =="
Write-Host "  == TccConex ERP: deps em cache =="
Write-Host "  Listening at: http://0.0.0.0:8000"
Write-Host ""
Write-Host "NAO altere o Startup Command no portal para bash -c longo." -ForegroundColor DarkYellow
