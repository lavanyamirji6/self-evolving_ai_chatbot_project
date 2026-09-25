@echo off
echo ============================================
echo  Self-Evolving AI — Backend on port 5000
echo ============================================
cd /d "%~dp0backend"
if exist .venv\Scripts\python.exe (
    echo [INFO] Activating virtual environment (.venv)...
    .venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
) else (
    echo [WARNING] .venv not found. Running with global python...
    python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload
)
pause

