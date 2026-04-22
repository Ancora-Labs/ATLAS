@echo off
setlocal

pushd "%~dp0" >nul

where node >nul 2>nul
if errorlevel 1 (
  echo [ATLAS] Node.js was not found on PATH.
  echo [ATLAS] Install Node.js 20 or newer, reopen this launcher, and try again.
  popd >nul
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ATLAS] npm is not available on PATH.
  echo [ATLAS] Repair the Node.js installation, reopen this launcher, and try again.
  popd >nul
  exit /b 1
)

if "%ATLAS_PORT%"=="" set "ATLAS_PORT=8788"

echo [ATLAS] Starting the dedicated ATLAS server on port %ATLAS_PORT%...
start "ATLAS Server" cmd /c npm run atlas:start
timeout /t 2 /nobreak >nul
call npm run atlas:open

popd >nul
exit /b 0
