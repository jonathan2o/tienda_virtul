# Script de Sincronización y Despliegue a Producción (179.236.243.216)
# Mantiene intacta la base de datos de producción (PostgreSQL)

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

Write-Host "=== 3. Subiendo código del Backend a $Server`:$BackendRemotePath (sin tocar BD) ===" -ForegroundColor Cyan
scp "$RepoRoot\tienda_virtual\backend\requirements.txt" "${Server}:${BackendRemotePath}/requirements.txt"
scp "$RepoRoot\tienda_virtual\backend\config\settings.py" "${Server}:${BackendRemotePath}/config/settings.py"
scp "$RepoRoot\tienda_virtual\backend\chatbot\gemini_service.py" "${Server}:${BackendRemotePath}/chatbot/gemini_service.py"
scp "$RepoRoot\tienda_virtual\backend\chatbot\engine.py" "${Server}:${BackendRemotePath}/chatbot/engine.py"
scp "$RepoRoot\tienda_virtual\backend\chatbot\views.py" "${Server}:${BackendRemotePath}/chatbot/views.py"
scp "$RepoRoot\tienda_virtual\backend\chatbot\urls.py" "${Server}:${BackendRemotePath}/chatbot/urls.py"

Write-Host "=== 4. Instalando paquetes, aplicando migraciones y reiniciando Backend en VPS ===" -ForegroundColor Cyan
$RemoteCmd = @"
cd $BackendRemotePath && \
if [ -d venv ]; then VENV_PY=./venv/bin/python; elif [ -d .venv ]; then VENV_PY=./.venv/bin/python; else VENV_PY=python3; fi && \
`$VENV_PY -m pip install -q google-genai python-decouple && \
`$VENV_PY manage.py migrate --noinput && \
systemctl restart gunicorn 2>/dev/null || systemctl restart tienda_virtual 2>/dev/null || true
"@
ssh $Server $RemoteCmd

Write-Host "=== Despliegue a Producción completado con éxito ===" -ForegroundColor Green
