@echo off
chcp 65001 > nul
cd /d "%~dp0"
call .\node_modules\.bin\electron.cmd .