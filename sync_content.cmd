@echo off
rem STARWROUGHT content loop (0.8.0): the spreadsheets to the web app, the viewer and the Foundry
rem pack sources, with Foundry left open. Then sync the open world from Settings: STARWROUGHT: Sync content.
rem The what and the why are in data\README.txt under ADDING CONTENT.
cd /d "%~dp0"
node assets\build_all.mjs --content
echo.
pause
