@echo off
cd /d "%~dp0"
echo Open http://localhost:5173 after the server starts.
call npm run dev
pause
