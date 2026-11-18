@echo off
rem STARWROUGHT equipment build (0.30.0): data\equipment.xlsx ALONE to the web app and the Foundry
rem pack sources. No other workbook is converted, so it runs while the talent and action workbooks
rem are still being authored (the build report at the end reads them all, read-only). Then sync the
rem open world from Settings: STARWROUGHT: Sync content. After a system update, restart Foundry
rem first. The what and the why are in data\README.txt under ADDING CONTENT.
cd /d "%~dp0"
node assets\build_all.mjs --equipment
echo.
pause
