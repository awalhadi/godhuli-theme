@echo off
REM ==========================================================
REM  Godhuli Shop - Windows developer setup
REM ==========================================================
setlocal EnableExtensions EnableDelayedExpansion

set "APP_NAME=Godhuli Shop"
set "NODE_MIN=20"
set "PORT=%~1"
if "%PORT%"=="" set "PORT=3000"
set /a RETRIES=0

echo Setting up %APP_NAME% on port %PORT%...

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node %NODE_MIN%+ first.
    goto :fail
)

for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_VER=%%v"
set "NODE_VER=%NODE_VER:v=%"
if %NODE_VER% LSS %NODE_MIN% (
    echo [WARN] Node %NODE_VER% detected, %NODE_MIN%+ recommended.
)

if not exist ".env" (
    copy /Y ".env.example" ".env" >nul
    echo Created .env from template.
)

:install
set /a RETRIES+=1
call pnpm install --frozen-lockfile
if %ERRORLEVEL% neq 0 (
    if !RETRIES! lss 3 (
        echo Retry !RETRIES!/3...
        timeout /t 5 /nobreak >nul
        goto :install
    )
    goto :fail
)

for %%d in (logs uploads tmp) do (
    if not exist "%%d\" mkdir "%%d"
)

echo.
echo %APP_NAME% is ready. Run "pnpm dev" to start.
endlocal
exit /b 0

:fail
echo Setup failed. See output above.
endlocal
exit /b 1
