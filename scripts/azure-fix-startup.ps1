# Força o Startup Command correto no App Service (evita o bash -c longo no portal).
# Uso: az login  (uma vez)  →  .\scripts\azure-fix-startup.ps1

$ErrorActionPreference = 'Stop'

$ResourceGroup = 'rg-tccconex-erp'
$AppName = 'tccconex-erp'
$StartupFile = 'bash startup.sh'

Write-Host "Verificando startup atual..." -ForegroundColor Cyan
$current = az webapp config show --resource-group $ResourceGroup --name $AppName --query appCommandLine -o tsv
Write-Host "  Atual: $current"

if ($current -eq $StartupFile) {
    Write-Host "Startup Command ja esta correto." -ForegroundColor Green
} else {
    Write-Host "Corrigindo para: $StartupFile" -ForegroundColor Yellow
    az webapp config set --resource-group $ResourceGroup --name $AppName --startup-file $StartupFile | Out-Null
    $new = az webapp config show --resource-group $ResourceGroup --name $AppName --query appCommandLine -o tsv
    Write-Host "  Novo:  $new" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configurando health check em /health/ ..." -ForegroundColor Cyan
az webapp config set --resource-group $ResourceGroup --name $AppName `
    --generic-configurations '{"healthCheckPath": "/health/"}' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  (health check: configure manualmente em Health check -> /health/)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "Reiniciando App Service..." -ForegroundColor Cyan
az webapp restart --resource-group $ResourceGroup --name $AppName
Write-Host "Pronto. No Log stream procure:" -ForegroundColor Green
Write-Host "  Site's appCommandLine: bash startup.sh"
Write-Host "  == TccConex ERP startup.sh v3 (vendor, sem pip/migrate no boot) =="
