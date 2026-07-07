@echo off
REM Automatic development loop — watches 00_input/ and discovered tickets,
REM runs the pipeline on the local Ollama, and redeploys on green.
REM Started at logon (Startup folder) and runnable by hand.
cd /d "%~dp0.."
start "asdlc-auto-dev" /min "%~dp0..\.venv\Scripts\pythonw.exe" "%~dp0..\run-pipeline.py" watch --interval 300 --deploy
