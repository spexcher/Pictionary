@echo off
echo Starting Pictionary Application...

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

:: Start the application
echo Starting server and client...
npm run dev

pause