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
if "%~1"=="" (
  set "ATLAS_ACTION=start"
) else (
  set "ATLAS_ACTION=%~1"
)

if /I "%ATLAS_ACTION%"=="start" goto :start
if /I "%ATLAS_ACTION%"=="open" goto :open
if /I "%ATLAS_ACTION%"=="pause" goto :control
if /I "%ATLAS_ACTION%"=="resume" goto :control
if /I "%ATLAS_ACTION%"=="stop" goto :control
if /I "%ATLAS_ACTION%"=="archive" goto :control
goto :usage

:control
shift
call npm run atlas:ctl -- %ATLAS_ACTION% %*
set "ATLAS_EXIT=%ERRORLEVEL%"
popd >nul
exit /b %ATLAS_EXIT%

:start
echo [ATLAS] Launching the native ATLAS desktop shell...

:open
call npm run atlas:open

popd >nul
exit /b 0

:usage
echo [ATLAS] Usage:
echo [ATLAS]   ATLAS.cmd start
echo [ATLAS]   ATLAS.cmd open
echo [ATLAS]   ATLAS.cmd pause ^<role^>
echo [ATLAS]   ATLAS.cmd resume [role]
echo [ATLAS]   ATLAS.cmd stop
echo [ATLAS]   ATLAS.cmd archive ^<role^>
popd >nul
exit /b 1
