# Script de Sincronización y Despliegue a Producción (179.236.243.216)
# Mantiene intacta la base de datos de producción (PostgreSQL en puerto 5433)

param(
    [string]$Server = "root@179.236.243.216",
    [string]$BackendRemotePath = "/apps/backend",
    [string]$FrontendRemotePath = "/var/www/html/tiendajr"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== 1. Compilando Frontend (React + Vite) ===" -ForegroundColor Cyan
Push-Location "$RepoRoot\frontend"
npm.cmd run build
Remove-Item "$RepoRoot\frontend\tiendajr\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$RepoRoot\frontend\dist\*" "$RepoRoot\frontend\tiendajr\" -Recurse -Force
Pop-Location

Write-Host "=== 2. Subiendo Frontend a $Server`:$FrontendRemotePath ===" -ForegroundColor Cyan
scp -r "$RepoRoot\frontend\dist\*" "${Server}:${FrontendRemotePath}/"
ssh $Server "chown -R www-data:www-data $FrontendRemotePath"

Write-Host "=== 3. Subiendo código del Backend a $Server`:$BackendRemotePath (sin tocar BD) ===" -ForegroundColor Cyan
ssh $Server "mkdir -p $BackendRemotePath/chatbot/migrations"
scp "$RepoRoot\tienda_virtual\backend\requirements.txt" "${Server}:${BackendRemotePath}/requirements.txt"
scp "$RepoRoot\tienda_virtual\backend\config\settings.py" "${Server}:${BackendRemotePath}/config/settings.py"
scp "$RepoRoot\tienda_virtual\backend\config\urls.py" "${Server}:${BackendRemotePath}/config/urls.py"
scp "$RepoRoot\tienda_virtual\backend\chatbot\*.py" "${Server}:${BackendRemotePath}/chatbot/"
scp "$RepoRoot\tienda_virtual\backend\chatbot\migrations\*.py" "${Server}:${BackendRemotePath}/chatbot/migrations/"

Write-Host "=== 4. Instalando paquetes, aplicando migraciones y reiniciando tienda-backend.service ===" -ForegroundColor Cyan
$RemoteCmd = "cd $BackendRemotePath && ./venv/bin/python -m pip install -q google-genai python-decouple && ./venv/bin/python manage.py migrate --noinput && systemctl restart tienda-backend.service && systemctl is-active tienda-backend.service"
ssh $Server $RemoteCmd

Write-Host "=== Despliegue a Producción completado con éxito ===" -ForegroundColor Green
