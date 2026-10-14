# ติดตั้งตัวซิงก์ KiwNgan ⇄ Express บนเครื่องแม่ข่าย (รันครั้งเดียว ด้วยสิทธิ์ Administrator)
# - คัดลอกไฟล์ไปไว้ที่ C:\KiwNganExpressSync
# - ทดสอบอ่าน Express 1 รอบ (อ่านอย่างเดียว)
# - ตั้ง Task Scheduler ให้ทำงานเองทุกครั้งที่เปิดเครื่อง และเช็กทุก 5 นาทีว่ายังทำงานอยู่
$ErrorActionPreference = 'Stop'
$dest = 'C:\KiwNganExpressSync'
$here = $PSScriptRoot

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Host 'ต้องคลิกขวาที่ install.cmd แล้วเลือก "Run as administrator"' -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }
if (-not (Test-Path (Join-Path $here 'config.json'))) { Write-Host 'ไม่พบ config.json ในโฟลเดอร์เดียวกัน' -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force (Join-Path $here 'KiwNganExpressSync.ps1') $dest
Copy-Item -Force (Join-Path $here 'config.json') $dest

# หาโฟลเดอร์ Express บนเครื่องนี้ (จากโฟลเดอร์ที่แชร์ชื่อ Express)
$cfgPath = Join-Path $dest 'config.json'
$cfg = Get-Content -Raw -Encoding UTF8 $cfgPath | ConvertFrom-Json
if (-not $cfg.expressRoot) {
  $root = $null
  try { $root = Join-Path (Get-SmbShare -Name 'Express' -ErrorAction Stop).Path 'ExpressI' } catch {}
  if (-not $root -or -not (Test-Path $root)) {
    Write-Host 'หาโฟลเดอร์ Express อัตโนมัติไม่เจอ' -ForegroundColor Yellow
    $root = Read-Host 'พิมพ์ที่อยู่โฟลเดอร์ ExpressI บนเครื่องนี้ (เช่น D:\Express\ExpressI)'
  }
  if (-not (Test-Path (Join-Path $root 'ExpressI.exe'))) { Write-Host "ไม่พบ ExpressI.exe ใน $root" -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }
  $cfg | Add-Member -NotePropertyName expressRoot -NotePropertyValue $root -Force
  [IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
}
Write-Host ("โฟลเดอร์ Express: " + $cfg.expressRoot) -ForegroundColor Cyan

# ทดสอบ: อ่านอย่างเดียว ไม่ส่ง
Write-Host 'ทดสอบอ่านข้อมูล (อ่านอย่างเดียว)…' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'KiwNganExpressSync.ps1') -Once -DryRun
if ($LASTEXITCODE -ne 0) { Write-Host 'ทดสอบไม่ผ่าน ดูข้อความด้านบน' -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }

# ตั้งให้ทำงานเอง (บัญชี SYSTEM · เปิดเครื่องแล้วทำงานทันที · เช็กทุก 5 นาที ถ้าหยุดจะเปิดใหม่)
$name = 'KiwNgan Express Sync'
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $dest 'KiwNganExpressSync.ps1') + '"') -WorkingDirectory $dest
$t1 = New-ScheduledTaskTrigger -AtStartup
$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 3650) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$pr = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $name -Action $act -Trigger @($t1, $t2) -Settings $set -Principal $pr -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host ''
Write-Host 'ติดตั้งเสร็จแล้ว ✓  ตัวซิงก์กำลังทำงานเบื้องหลัง' -ForegroundColor Green
Write-Host "ดูบันทึกการทำงานได้ที่ $dest\state\sync.log"
Read-Host 'กด Enter เพื่อปิด'
