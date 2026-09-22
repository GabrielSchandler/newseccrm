@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0copiar-schema-producao.ps1"
echo.
echo (Essa janela fica aberta de proposito. Pode fechar quando quiser.)
pause
