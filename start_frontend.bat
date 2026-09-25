@echo off
echo ============================================
echo  Self-Evolving AI — Frontend Startup
echo ============================================
cd /d "%~dp0frontend"

echo Installing npm packages...
npm install

echo.
echo Starting React app on http://localhost:3000
echo.
npm start
pause
