@echo off
rem Remove the KiwNgan Express sync task (Right-click > Run as administrator). Express data is never touched.
schtasks /End /TN "KiwNgan Express Sync" >nul 2>&1
schtasks /Delete /TN "KiwNgan Express Sync" /F
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*KiwNganExpressSync.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Done. You can delete C:\KiwNganExpressSync
pause
