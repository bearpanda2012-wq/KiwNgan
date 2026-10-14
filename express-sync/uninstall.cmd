@echo off
rem Remove KiwNgan Express sync from this computer (double-click). Express data is never touched.
schtasks /End /TN "KiwNgan Express Sync" >nul 2>&1
schtasks /Delete /TN "KiwNgan Express Sync" /F >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\KiwNgan Express Sync.lnk" >nul 2>&1
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*KiwNganExpressSync.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Done. You can delete %LOCALAPPDATA%\KiwNganExpressSync
pause
