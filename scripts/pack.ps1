# =============================================
#  EventosPOS - Empaquetado para Windows
#  Crea una carpeta autónoma con node.exe + app
# =============================================
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pkgJson = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$version = $pkgJson.version
$outDir = Join-Path $root "dist\EventosPOS-v$version"
$appCjs = Join-Path $root "dist\app.cjs"
$schema = Join-Path $root "dist\schema.sql"
$public = Join-Path $root "dist\public"

Write-Host "Empaquetando EventosPOS v$version..."

if (-not (Test-Path $appCjs)) { throw "Falta dist\app.cjs. Ejecutá 'npm run build' primero." }
if (-not (Test-Path $schema)) { throw "Falta dist\schema.sql. Ejecutá 'npm run build' primero." }
if (-not (Test-Path (Join-Path $public "index.html"))) { throw "Falta dist\public\index.html. Ejecutá 'npm run build' primero." }

# Limpiar carpeta anterior (si está bloqueada, se usa igualmente la versión nueva)
if (Test-Path $outDir) {
  try { Remove-Item -Recurse -Force $outDir -ErrorAction Stop } catch { Write-Host "Aviso: no se pudo limpiar la carpeta anterior, se sobrescribe." }
}
$nodePath = ""
if ($env:EVENTOS_NODE_EXE -and (Test-Path $env:EVENTOS_NODE_EXE)) {
  $nodePath = $env:EVENTOS_NODE_EXE
} else {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $nodePath = (Get-Command node).Source }
}
if (-not $nodePath -or -not (Test-Path $nodePath)) { throw "No se encontró node.exe. Instalá Node.js o definí EVENTOS_NODE_EXE." }

New-Item -ItemType Directory -Path $outDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "public") | Out-Null

Copy-Item $nodePath (Join-Path $outDir "node.exe") -Force
Copy-Item $appCjs (Join-Path $outDir "app.cjs") -Force
Copy-Item $schema (Join-Path $outDir "schema.sql") -Force
Copy-Item (Join-Path $public "*") (Join-Path $outDir "public") -Recurse -Force

$bat = @'
@echo off
chcp 65001 >nul
title EventosPOS
cd /d "%~dp0"

echo.
echo  ============================================
echo   EventosPOS - Sistema de eventos y ventas
echo  ============================================
echo.
echo  Iniciando servidor en http://localhost:4100
echo  (No cierres esta ventana mientras uses el sistema)
echo.

if not exist "data" mkdir "data"
if not exist "backups" mkdir "backups"
if not exist "logs" mkdir "logs"

start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:4100"
node.exe app.cjs

echo.
echo  El servidor se detuvo. Presioná una tecla para salir.
pause >nul
'@
Set-Content -Path (Join-Path $outDir "Iniciar.bat") -Value $bat -Encoding UTF8

$readme = @'
EVENTOSPOS - SISTEMA DE GESTION DE EVENTOS
==========================================

QUE ES
------
Sistema para administrar eventos: cajas, cajeros (entran con PIN),
venta de productos y entradas, cierres de caja y reportes.
Funciona SIN internet (toda la informacion queda en este equipo).

COMO INICIARLO
--------------
1) Doble clic en "Iniciar.bat".
2) Se abre el navegador en http://localhost:4100
3) La primera vez te pedira crear el superadministrador (email + contrasena).
4) Desde ahi creas: administradores, cajeros, eventos, cajas y productos.

COMO LO DETENGO
---------------
Cerra la ventana negra que quedo abierta (o presiona Ctrl+C).

DONDE ESTAN LOS DATOS
---------------------
- data\eventos.db  -> la base de datos completa
- backups\         -> copias de seguridad (se hacen solas todos los dias)
- logs\            -> registros de errores y actividad

COMO HAGO UNA COPIA DE SEGURIDAD
--------------------------------
Dentro del sistema, pantalla "Backups": podes crear y descargar copias.
Tambien podes copiar la carpeta "data" a un pendrive.

TIP
---
Para que "Iniciar.bat" abra en el arranque de Windows:
Win+R -> shell:startup -> arrastra un acceso directo a Iniciar.bat.
'@
Set-Content -Path (Join-Path $outDir "LEEME.txt") -Value $readme -Encoding UTF8

Write-Host ""
Write-Host "Listo! Tu sistema queda en: $outDir"
Write-Host "Copiá esa carpeta a cualquier PC con Windows y doble clic en Iniciar.bat"

if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
  $zip = Join-Path $root "dist\EventosPOS-v$version.zip"
  if (Test-Path $zip) { Remove-Item -Force $zip }
  Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zip
  Write-Host "También se creó el ZIP: $zip"
}