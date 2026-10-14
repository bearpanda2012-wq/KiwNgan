# ติดตั้งตัวซิงก์ KiwNgan ⇄ Express บนคอม Windows เครื่องไหนก็ได้ในออฟฟิศ (ไม่ต้องใช้สิทธิ์ Administrator)
# - อ่าน Express ผ่านแชร์ \\192.168.0.5\Express (อ่านอย่างเดียว ไม่แก้อะไรใน Express)
# - คัดลอกไฟล์ไปไว้ที่ %LOCALAPPDATA%\KiwNganExpressSync ของผู้ใช้คนนี้
# - ตั้งให้เริ่มทำงานเองทุกครั้งที่ผู้ใช้คนนี้ล็อกอิน และเช็กทุก 5 นาทีว่ายังทำงานอยู่
# ติดได้หลายเครื่อง: ทุกเครื่องส่งค่าเดียวกัน ข้อมูลไม่ซ้ำไม่เพี้ยน (เครื่องหนึ่งปิด อีกเครื่องยังส่งต่อ)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA 'KiwNganExpressSync'
$name = 'KiwNgan Express Sync'
function Fail([string]$m) { Write-Host $m -ForegroundColor Red; Read-Host 'กด Enter เพื่อปิด'; exit 1 }

if (-not (Test-Path (Join-Path $here 'config.json'))) { Fail 'ไม่พบ config.json ในโฟลเดอร์เดียวกัน' }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Force (Join-Path $here 'KiwNganExpressSync.ps1') $dest
$cfgPath = Join-Path $dest 'config.json'
$cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $here 'config.json') | ConvertFrom-Json

# หาโฟลเดอร์ ExpressI: ค่าใน config → แชร์ \\192.168.0.5\Express → ไดรฟ์ Y: → ถาม
$cands = @()
if ($cfg.expressRoot) { $cands += $cfg.expressRoot }
$cands += '\\192.168.0.5\Express\ExpressI', 'Y:\ExpressI'
$root = $null
foreach ($c in $cands) { try { if (Test-Path (Join-Path $c 'ExpressI.exe')) { $root = $c; break } } catch {} }
if (-not $root) {
  Write-Host 'หาโฟลเดอร์ Express ไม่เจอ (เครื่องนี้เข้า \\192.168.0.5\Express ได้ไหม?)' -ForegroundColor Yellow
  $root = Read-Host 'พิมพ์ที่อยู่โฟลเดอร์ ExpressI (เช่น \\192.168.0.5\Express\ExpressI)'
  if (-not (Test-Path (Join-Path $root 'ExpressI.exe'))) { Fail "ไม่พบ ExpressI.exe ใน $root" }
}
$cfg | Add-Member -NotePropertyName expressRoot -NotePropertyValue $root -Force
[IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
Write-Host "โฟลเดอร์ Express: $root" -ForegroundColor Cyan

# ทดสอบ: อ่านอย่างเดียว ไม่ส่ง
Write-Host 'ทดสอบอ่านข้อมูล (อ่านอย่างเดียว)…' -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'KiwNganExpressSync.ps1') -Once -DryRun
if ($LASTEXITCODE -ne 0) { Fail 'ทดสอบไม่ผ่าน ดูข้อความด้านบน แล้วถ่ายภาพส่งให้ผู้ดูแลระบบ' }

# ตั้งให้ทำงานเองตอนล็อกอิน (ผู้ใช้คนนี้ · ไม่ใช้สิทธิ์ผู้ดูแล) + เช็กทุก 5 นาที ถ้าหยุดจะเปิดใหม่
$me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $dest 'KiwNganExpressSync.ps1') + '"') -WorkingDirectory $dest
$t1 = New-ScheduledTaskTrigger -AtLogOn -User $me
$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$pr = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
try {
  Register-ScheduledTask -TaskName $name -Action $act -Trigger @($t1, $t2) -Settings $set -Principal $pr -Force | Out-Null
  Start-ScheduledTask -TaskName $name
} catch {
  # บางเครื่องไม่ให้ผู้ใช้ทั่วไปสร้าง Task → ใช้ทางสำรอง: ทางลัดในโฟลเดอร์ Startup
  $lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'KiwNgan Express Sync.lnk'
  $sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($lnk)
  $s.TargetPath = 'powershell.exe'; $s.Arguments = $act.Arguments; $s.WorkingDirectory = $dest; $s.WindowStyle = 7; $s.Save()
  Start-Process powershell.exe -ArgumentList $act.Arguments -WindowStyle Hidden -WorkingDirectory $dest
  Write-Host 'ใช้ทางลัดใน Startup แทน Task Scheduler' -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'ติดตั้งเสร็จแล้ว ✓  ตัวซิงก์กำลังทำงานเบื้องหลัง (เริ่มเองทุกครั้งที่ล็อกอินเครื่องนี้)' -ForegroundColor Green
Write-Host "บันทึกการทำงาน: $dest\state\sync.log"
Write-Host 'เปิดแอป KiwNgan > คลังวัสดุ > ยอดจาก Express ไฟจะเป็นสีเขียวภายใน 1-2 นาที'
Read-Host 'กด Enter เพื่อปิด'
