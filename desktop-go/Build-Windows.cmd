@echo off
setlocal
cd /d "%~dp0"
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
where go >nul 2>&1
if errorlevel 1 (
  echo A Go fordito nincs telepitve. https://go.dev/dl/
  exit /b 1
)
if not exist assets\bin mkdir assets\bin
if not exist assets\app mkdir assets\app
if not exist installer\assets mkdir installer\assets
if not exist ..\dist mkdir ..\dist
copy /Y ..\app\index.htm assets\app\index.htm >nul

rem Az eredeti, feltoltott Lapterv.ico ikon minden Windows EXE-be bekerul.
rem Nincs csendes visszaeses az alapikonra: a build leall, ha az ikon hianyzik.
if not exist "..\Lapterv.ico" (
  echo HIBA: Hianyzik a repository gyokerbol a Lapterv.ico ikon.
  exit /b 1
)
where python >nul 2>&1
if errorlevel 1 (
  echo HIBA: A Windows ikon beagyazasahoz Python 3 kell.
  exit /b 1
)
echo [ikon] Lapterv.ico beepitese mindharom EXE-be...
python ..\tools\embed_win_icon.py ..\Lapterv.ico launcher\rsrc_windows_amd64.syso
if errorlevel 1 exit /b 1
python ..\tools\embed_win_icon.py ..\Lapterv.ico uninstaller\rsrc_windows_amd64.syso
if errorlevel 1 exit /b 1
python ..\tools\embed_win_icon.py ..\Lapterv.ico installer\rsrc_windows_amd64.syso
if errorlevel 1 exit /b 1

echo [ikon] Lapterv ablak favicon beetese...
python ..\tools\prepare_app_icon.py ..\Lapterv.ico assets\app\index.htm
if errorlevel 1 exit /b 1

echo [1/3] Lapterv alkalmazas...
go build -trimpath -ldflags="-s -w -H=windowsgui" -o assets\bin\Lapterv.exe .\launcher
if errorlevel 1 exit /b 1

echo [2/3] Eltavolito...
go build -trimpath -ldflags="-s -w -H=windowsgui" -o assets\bin\Lapterv_Eltavolitas.exe .\uninstaller
if errorlevel 1 exit /b 1
copy /Y assets\bin\Lapterv.exe installer\assets\Lapterv.exe >nul
copy /Y assets\bin\Lapterv_Eltavolitas.exe installer\assets\Lapterv_Eltavolitas.exe >nul
copy /Y assets\app\index.htm installer\assets\index.htm >nul

echo [3/3] Saját Windows telepito...
go build -trimpath -ldflags="-s -w -H=windowsgui" -o ..\dist\Lapterv_Telepito_1.0.6_x64.exe .\installer
if errorlevel 1 exit /b 1
echo.
echo Keszen van: dist\Lapterv_Telepito_1.0.6_x64.exe
endlocal
