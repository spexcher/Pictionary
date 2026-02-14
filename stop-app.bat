@echo off
echo Stopping Pictionary application...

:: Kill Node.js processes on the required ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3007"') do (
    echo Killing process %%a on port 3007
    taskkill /PID %%a /F
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8087"') do (
    echo Killing process %%a on port 8087
    taskkill /PID %%a /F
)

:: Also kill any remaining Node.js processes
taskkill /IM node.exe /F 2>nul

echo Application stopped successfully!
pause