@echo off
rem STARWROUGHT Conditions build (0.33.0): data\conditions.xlsx ALONE to the web app and the Foundry
rem system. No other workbook is converted, so it runs while the talent and action workbooks are
rem still being authored (the build report at the end reads them all, read-only). Then sync the
rem open world from Settings: STARWROUGHT: Sync content, which reloads the Conditions on every
rem connected client. After a system update, restart Foundry first. The what and the why are in
rem data\README.txt under THE CONDITIONS WORKBOOK.
cd /d "%~dp0"
node assets\build_all.mjs --conditions
echo.
pause
