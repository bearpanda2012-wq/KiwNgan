# KiwNgan → Express : โปรแกรมช่วยคีย์ (พิมพ์ลงหน้าจอ Express แทนคน)
# -----------------------------------------------------------------------------
# - แอป KiwNgan ส่งรายการที่ผ่านการตรวจแล้วมาทางลิงก์ kiwngan-express:...
# - โปรแกรมนี้ "ตรวจซ้ำ" กับไฟล์ Express จริง (อ่านอย่างเดียว) → รายการไม่ผ่านจะแจ้งเตือนและไม่คีย์
# - พิมพ์ลงหน้าจอ OU – จ่ายสินค้าใช้ภายใน ของ Express ที่เปิดอยู่ ทีละใบ
# - ไม่กดบันทึกให้: คนตรวจหน้าจอแล้วกดบันทึกใน Express เอง
# - ไม่เขียนไฟล์ใด ๆ ของ Express
# หยุดกลางคัน: ขยับเมาส์ หรือสลับไปหน้าต่างอื่น โปรแกรมจะหยุดพิมพ์ทันที
param(
  [string]$Url = '',
  [string]$File = '',          # ทดสอบ: อ่านรายการจากไฟล์ JSON แทนลิงก์
  [switch]$CheckOnly,          # ตรวจอย่างเดียว พิมพ์ผลแล้วจบ (ไม่เปิดหน้าต่าง ไม่พิมพ์)
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json')
)
$ErrorActionPreference = 'Stop'

$src = @'
#pragma warning disable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace KiwNganKey {
  public class Field { public string Name; public char Type; public int Len; public int Off; }
  /* อ่าน .DBF แบบอ่านอย่างเดียว (แชร์ให้ Express ใช้ต่อได้) */
  public class Dbf {
    public List<Field> Fields = new List<Field>(); public int Count, HeaderLen, RecLen; byte[] data; Encoding enc;
    public Dbf(string path, Encoding enc) {
      this.enc = enc;
      using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
        data = new byte[fs.Length]; int got = 0; while (got < data.Length) { int n = fs.Read(data, got, data.Length - got); if (n <= 0) break; got += n; }
      }
      Count = BitConverter.ToInt32(data, 4); HeaderLen = BitConverter.ToUInt16(data, 8); RecLen = BitConverter.ToUInt16(data, 10);
      int p = 32, off = 1;
      while (p + 32 <= data.Length && data[p] != 0x0D) { Field f = new Field(); int z = 0; while (z < 11 && data[p + z] != 0) z++;
        f.Name = Encoding.ASCII.GetString(data, p, z); f.Type = (char)data[p + 11]; f.Len = data[p + 16]; f.Off = off; off += f.Len; Fields.Add(f); p += 32; }
      long avail = (data.Length - HeaderLen) / Math.Max(1, RecLen); if (Count > avail) Count = (int)avail;
    }
    public Field F(string n) { foreach (Field f in Fields) if (f.Name == n) return f; return null; }
    public bool Deleted(int i) { return data[HeaderLen + (long)i * RecLen] == (byte)'*'; }
    public string S(int i, Field f) { if (f == null) return ""; long b = HeaderLen + (long)i * RecLen + f.Off; string s = enc.GetString(data, (int)b, f.Len); int z = s.IndexOf('\0'); if (z >= 0) s = s.Substring(0, z); return s.Trim(); }
    public double D(int i, Field f) {
      if (f == null) return 0; long b = HeaderLen + (long)i * RecLen + f.Off;
      if (f.Type == 'B') return BitConverter.ToDouble(data, (int)b); if (f.Type == 'I') return BitConverter.ToInt32(data, (int)b); if (f.Type == 'Y') return BitConverter.ToInt64(data, (int)b) / 10000.0;
      double v; return double.TryParse(S(i, f), NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : 0;
    }
  }
  public static class Th {
    public static Encoding Enc() {
      try { return Encoding.GetEncoding(874); } catch {
        Type t = Type.GetType("System.Text.CodePagesEncodingProvider, System.Text.Encoding.CodePages");
        if (t != null) { object inst = t.GetProperty("Instance").GetValue(null, null); typeof(Encoding).GetMethod("RegisterProvider").Invoke(null, new object[] { inst }); }
        return Encoding.GetEncoding(874);
      }
    }
  }

  /* ส่งปุ่มกด: ตัวอักษรส่งแบบ Unicode (ไม่ขึ้นกับภาษาแป้นพิมพ์ที่เปิดอยู่ ไทย/อังกฤษ) */
  public static class Kb {
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] i, int size);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    const uint KEYUP = 2, UNICODE = 4;
    static void Send(ushort vk, ushort scan, uint flags) {
      INPUT[] a = new INPUT[1]; a[0].type = 1; a[0].u.ki.wVk = vk; a[0].u.ki.wScan = scan; a[0].u.ki.dwFlags = flags;
      if (SendInput(1, a, Marshal.SizeOf(typeof(INPUT))) != 1) throw new Exception("ส่งปุ่มกดไม่สำเร็จ (Windows ไม่อนุญาต)");
    }
    public static void Key(ushort vk) { Send(vk, 0, 0); System.Threading.Thread.Sleep(15); Send(vk, 0, KEYUP); }
    public static void Combo(ushort mod, ushort vk) { Send(mod, 0, 0); System.Threading.Thread.Sleep(15); Key(vk); Send(mod, 0, KEYUP); }
    public static void Text(string s, int gap) { foreach (char c in s) { Send(0, c, UNICODE); Send(0, c, UNICODE | KEYUP); System.Threading.Thread.Sleep(gap); } }
    public static IntPtr Top(IntPtr h) { return GetAncestor(h, 2); }
  }
}
'@
if (-not ('KiwNganKey.Kb' -as [type])) { Add-Type -TypeDefinition $src -Language CSharp }

$logDir = Join-Path $PSScriptRoot 'state'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
function Log([string]$m) { try { Add-Content -Path (Join-Path $logDir 'key.log') -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m) -Encoding UTF8 } catch {} }

# ---------- ลำดับการกดปุ่มในหน้าจอ OU (ปรับได้ใน config.json → "keyRecipe") ----------
$defaultRecipe = [ordered]@{
  confirmed = $false                                   # true = ยืนยันลำดับกับหน้าจอจริงแล้ว
  start     = @('WAIT 300')                            # ก่อนเริ่มใบ: หน้า OU ว่าง เคอร์เซอร์อยู่ที่เลขที่เอกสาร
  head      = @('ENTER', 'ENTER', '{DEP}', 'ENTER', '{REM}', 'ENTER')   # เลขที่(ปล่อยตามระบบ) → วันที่(วันนี้) → แผนก → หมายเหตุ → ตาราง
  line      = @('{COD}', 'ENTER', 'WAIT 250', '{LOC}', 'ENTER', '{QTY}', 'ENTER', 'ENTER', 'ENTER')
  done      = @()                                      # หลังบรรทัดสุดท้าย (ไม่กดบันทึก)
  charGapMs = 12; stepGapMs = 120
}

# ---------- อ่านรายการจากแอป ----------
function Fail([string]$m) {
  Log ('หยุด: ' + $m)
  if ($CheckOnly) { Write-Host $m; exit 1 }
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show($m, 'KiwNgan → Express', 'OK', 'Warning'); exit 1
}
try {
  if ($File) { $raw = Get-Content -Raw -Encoding UTF8 $File }
  else {
    $b = ($Url -replace '^kiwngan-express:/*', '').Trim().TrimEnd('/') -replace '-', '+' -replace '_', '/'
    switch ($b.Length % 4) { 2 { $b += '==' } 3 { $b += '=' } }
    $raw = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b))
  }
  $job = $raw | ConvertFrom-Json
} catch { Fail 'อ่านรายการจากแอปไม่ได้ (ลิงก์ไม่สมบูรณ์) — กดส่งจากแอปใหม่อีกครั้ง' }
if ($job.v -ne 1 -or -not $job.docs) { Fail 'รูปแบบรายการไม่ถูกต้อง — อัปเดตแอปแล้วลองใหม่' }

$cfg = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$R = $defaultRecipe
if ($cfg.keyRecipe) { foreach ($p in $cfg.keyRecipe.PSObject.Properties) { $R[$p.Name] = $p.Value } }

# ---------- ตรวจรูปแบบข้อมูลแบบเข้ม (กันลิงก์แปลกปลอมพิมพ์ข้อความอื่นลง Express) ----------
$docs = @($job.docs); if ($docs.Count -lt 1 -or $docs.Count -gt 20) { Fail 'จำนวนใบต้องอยู่ระหว่าง 1–20' }
$rxCod = '^[A-Za-z0-9][A-Za-z0-9\-\._/ ]{0,24}$'; $rxLoc = '^[A-Za-z0-9\-_]{1,10}$'; $rxDep = '^[A-Za-z0-9\-_]{0,10}$'
$rows = New-Object System.Collections.ArrayList
$di = 0
foreach ($d in $docs) {
  $di++
  $dep = [string]$d.dep; $rem = ([string]$d.rem -replace '[\x00-\x1F{}~^%+()\[\]]', ' ').Trim(); if ($rem.Length -gt 60) { $rem = $rem.Substring(0, 60) }
  $lines = @($d.lines); if ($lines.Count -lt 1 -or $lines.Count -gt 25) { Fail "ใบที่ $di ต้องมี 1–25 บรรทัด" }
  foreach ($l in $lines) {
    $q = 0.0; $okq = [double]::TryParse([string]$l.qty, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$q)
    [void]$rows.Add([pscustomobject]@{ doc = $di; dep = $dep; rem = $rem; id = [string]$l.id; cod = ([string]$l.cod).Trim(); loc = ([string]$l.loc).Trim(); qty = $q; des = [string]$l.des; bal = $null; ok = $true; why = New-Object System.Collections.ArrayList; okq = $okq })
  }
}

# ---------- ตรวจซ้ำกับไฟล์ Express จริง (อ่านอย่างเดียว) ----------
$root = $cfg.expressRoot; $prefix = $(if ($cfg.prefix) { $cfg.prefix } else { 'ROY' })
if (-not $root -or -not (Test-Path $root)) { Fail "ไม่พบโฟลเดอร์ Express ($root)" }
$dir = Get-ChildItem -Path $root -Directory | Where-Object { $_.Name -match ('^' + [regex]::Escape($prefix) + '\d+$') -and (Test-Path (Join-Path $_.FullName 'STMAS.DBF')) } |
  Sort-Object { (Get-Item (Join-Path $_.FullName 'STMAS.DBF')).LastWriteTimeUtc } -Descending | Select-Object -First 1
if (-not $dir) { Fail "ไม่พบข้อมูล $prefix xx ใน $root" }
$enc = [KiwNganKey.Th]::Enc()
$items = @{}; $d = New-Object KiwNganKey.Dbf((Join-Path $dir.FullName 'STMAS.DBF'), $enc); $fc = $d.F('STKCOD'); $fd = $d.F('STKDES')
for ($i = 0; $i -lt $d.Count; $i++) { if (-not $d.Deleted($i)) { $c = $d.S($i, $fc); if ($c) { $items[$c] = $d.S($i, $fd) } } }
$locs = @{}; $d = New-Object KiwNganKey.Dbf((Join-Path $dir.FullName 'STLOC.DBF'), $enc); $fc = $d.F('STKCOD'); $fl = $d.F('LOCCOD'); $fb = $d.F('LOCBAL')
for ($i = 0; $i -lt $d.Count; $i++) { if (-not $d.Deleted($i)) { $locs[$d.S($i, $fc) + '|' + $d.S($i, $fl)] = $d.D($i, $fb) } }
$deps = @{}; $tf = Join-Path $dir.FullName 'ISTAB.DBF'
if (Test-Path $tf) { $d = New-Object KiwNganKey.Dbf($tf, $enc); $ft = $d.F('TABTYP'); $fy = $d.F('TYPCOD'); for ($i = 0; $i -lt $d.Count; $i++) { if (-not $d.Deleted($i) -and $d.S($i, $ft) -eq '50') { $deps[$d.S($i, $fy)] = 1 } } }

$need = @{}
foreach ($r in $rows) {
  if ($r.cod -notmatch $rxCod) { [void]$r.why.Add('รหัสสินค้ารูปแบบไม่ถูกต้อง') }
  elseif (-not $items.ContainsKey($r.cod)) { [void]$r.why.Add('ไม่มีรหัสนี้ใน Express') } else { if (-not $r.des) { $r.des = $items[$r.cod] } }
  if ($r.loc -notmatch $rxLoc) { [void]$r.why.Add('คลังไม่ถูกต้อง') }
  if (-not $r.okq -or $r.qty -le 0 -or $r.qty -gt 1000000) { [void]$r.why.Add('จำนวนไม่ถูกต้อง') }
  if ($r.dep -notmatch $rxDep) { [void]$r.why.Add('รหัสแผนกไม่ถูกต้อง') } elseif ($r.dep -and $deps.Count -and -not $deps.ContainsKey($r.dep)) { [void]$r.why.Add('ไม่มีรหัสแผนก ' + $r.dep + ' ใน Express') }
  $k = $r.cod + '|' + $r.loc; $bal = 0.0; if ($locs.ContainsKey($k)) { $bal = [double]$locs[$k] }; $r.bal = $bal
  if ($r.why.Count -eq 0) { $need[$k] = [double]$need[$k] + $r.qty }   # รายการที่ไม่ผ่านไม่กินยอด
  if ($r.why.Count -eq 0 -and $need[$k] -gt $bal + 1e-9) { [void]$r.why.Add(('ยอดในคลัง {0} ไม่พอ: มี {1} ต้องการ {2}' -f $r.loc, $bal, $need[$k])) }
  $r.ok = ($r.why.Count -eq 0)
}
$okRows = @($rows | Where-Object { $_.ok }); $badRows = @($rows | Where-Object { -not $_.ok })
Log ("รับ {0} ใบ {1} บรรทัด · ผ่าน {2} · ไม่ผ่าน {3} · ข้อมูล {4} · จาก {5}" -f $docs.Count, $rows.Count, $okRows.Count, $badRows.Count, $dir.Name, $job.by)
if ($CheckOnly) {
  foreach ($r in $rows) { Write-Host ('{0} ใบ{1} {2} {3} x{4} มี {5} {6}' -f $(if ($r.ok) { 'OK ' } else { 'BAD' }), $r.doc, $r.cod, $r.loc, $r.qty, $r.bal, ($r.why -join ', ')) }
  exit 0
}

# ---------- หน้าต่างยืนยัน ----------
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$font = New-Object System.Drawing.Font('Tahoma', 10)
function New-Form([string]$title, [int]$w, [int]$h) {
  $f = New-Object System.Windows.Forms.Form; $f.Text = $title; $f.Width = $w; $f.Height = $h; $f.StartPosition = 'CenterScreen'; $f.Font = $font; $f.TopMost = $true; $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false; return $f
}
$form = New-Form 'KiwNgan → Express : ตรวจสอบก่อนคีย์' 900 560
$lab = New-Object System.Windows.Forms.Label; $lab.Left = 14; $lab.Top = 10; $lab.Width = 860; $lab.Height = 44
$lab.Text = ("ตรวจกับไฟล์ Express ({0}) แล้ว:  ผ่าน {1} บรรทัด  ·  ไม่ผ่าน {2} บรรทัด (จะไม่ถูกคีย์)`r`nจะคีย์ลงหน้าจอ OU – จ่ายสินค้าใช้ภายใน ทีละใบ · โปรแกรมไม่กดบันทึกให้ ต้องตรวจแล้วกดบันทึกใน Express เอง" -f $dir.Name, $okRows.Count, $badRows.Count)
$form.Controls.Add($lab)
$grid = New-Object System.Windows.Forms.DataGridView; $grid.Left = 14; $grid.Top = 58; $grid.Width = 860; $grid.Height = 360; $grid.ReadOnly = $true; $grid.AllowUserToAddRows = $false; $grid.RowHeadersVisible = $false; $grid.SelectionMode = 'FullRowSelect'; $grid.AutoSizeColumnsMode = 'Fill'
foreach ($c in @('ผล', 'ใบ', 'รหัส', 'ชื่อสินค้า', 'คลัง', 'จำนวน', 'มีในคลัง', 'แผนก', 'หมายเหตุ / เหตุผล')) { [void]$grid.Columns.Add($c, $c) }
$grid.Columns[0].FillWeight = 30; $grid.Columns[1].FillWeight = 25; $grid.Columns[4].FillWeight = 35; $grid.Columns[5].FillWeight = 45; $grid.Columns[6].FillWeight = 45; $grid.Columns[7].FillWeight = 35
foreach ($r in ($badRows + $okRows)) {
  $i = $grid.Rows.Add($(if ($r.ok) { '✓' } else { '✕' }), $(if ($r.ok) { [string]$r.doc } else { '–' }), $r.cod, $r.des, $r.loc, $r.qty, $r.bal, $r.dep, $(if ($r.ok) { $r.rem } else { $r.why -join ' · ' }))
  if (-not $r.ok) { $grid.Rows[$i].DefaultCellStyle.BackColor = [System.Drawing.Color]::FromArgb(255, 228, 228); $grid.Rows[$i].DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(160, 20, 20) }
}
$form.Controls.Add($grid)
$warn = New-Object System.Windows.Forms.Label; $warn.Left = 14; $warn.Top = 424; $warn.Width = 860; $warn.Height = 44; $warn.ForeColor = [System.Drawing.Color]::FromArgb(150, 70, 0)
$warn.Text = "ก่อนเริ่ม: เปิด Express หน้า OU – จ่ายสินค้าใช้ภายใน ให้เป็นหน้าว่าง (กดสร้างเอกสารใหม่แล้ว)`r`nระหว่างพิมพ์ห้ามแตะเมาส์/คีย์บอร์ด · ถ้าขยับเมาส์หรือสลับหน้าต่าง โปรแกรมจะหยุดทันที" + $(if (-not $R.confirmed) { "`r`n(ลำดับปุ่มยังไม่ได้ยืนยันกับหน้าจอจริง แนะนำโหมด 'ทีละช่อง')" } else { '' })
$form.Controls.Add($warn)
$step = New-Object System.Windows.Forms.CheckBox; $step.Text = 'ทีละช่อง (กดต่อไปทุกครั้ง)'; $step.Left = 14; $step.Top = 478; $step.Width = 260; $step.Checked = (-not $R.confirmed); $form.Controls.Add($step)
$go = New-Object System.Windows.Forms.Button; $go.Text = ('เริ่มคีย์ {0} บรรทัด' -f $okRows.Count); $go.Left = 600; $go.Top = 474; $go.Width = 160; $go.Height = 34; $go.DialogResult = 'OK'; $go.Enabled = ($okRows.Count -gt 0); $form.Controls.Add($go)
$no = New-Object System.Windows.Forms.Button; $no.Text = 'ยกเลิก'; $no.Left = 770; $no.Top = 474; $no.Width = 104; $no.Height = 34; $no.DialogResult = 'Cancel'; $form.Controls.Add($no)
$form.AcceptButton = $go; $form.CancelButton = $no
if ($form.ShowDialog() -ne 'OK') { Log 'ผู้ใช้ยกเลิก'; exit 0 }
$stepMode = $step.Checked

# ---------- หาหน้าต่าง Express หน้า OU ----------
function Find-Express {
  $p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like '*Express*' -and $_.MainWindowTitle -match '\bOU\b' } | Select-Object -First 1
  return $p
}
$ex = Find-Express
if (-not $ex) { Fail 'ไม่พบหน้าต่าง Express ที่เปิดหน้า OU – จ่ายสินค้าใช้ภายใน`r`nเปิดหน้านั้นใน Express ก่อน แล้วกดส่งจากแอปอีกครั้ง' }
$h = $ex.MainWindowHandle

function Focus-Express {
  if ([KiwNganKey.Kb]::IsIconic($h)) { [void][KiwNganKey.Kb]::ShowWindow($h, 9) }
  [void][KiwNganKey.Kb]::SetForegroundWindow($h); Start-Sleep -Milliseconds 250
  return ([KiwNganKey.Kb]::Top([KiwNganKey.Kb]::GetForegroundWindow()) -eq [KiwNganKey.Kb]::Top($h))
}
$script:mouse = $null
function Guard {   # หยุดถ้าผู้ใช้ขยับเมาส์หรือหน้าต่างอื่นขึ้นมาอยู่หน้า
  $p = New-Object KiwNganKey.Kb+POINT; [void][KiwNganKey.Kb]::GetCursorPos([ref]$p)
  if ($script:mouse -and ([math]::Abs($p.X - $script:mouse.X) + [math]::Abs($p.Y - $script:mouse.Y)) -gt 25) { throw 'หยุดแล้ว: มีการขยับเมาส์' }
  $script:mouse = $p
  if ([KiwNganKey.Kb]::Top([KiwNganKey.Kb]::GetForegroundWindow()) -ne [KiwNganKey.Kb]::Top($h)) { throw 'หยุดแล้ว: หน้าต่าง Express ไม่ได้อยู่ด้านหน้า' }
}
$VK = @{ ENTER = 0x0D; TAB = 0x09; DOWN = 0x28; UP = 0x26; LEFT = 0x25; RIGHT = 0x27; HOME = 0x24; END = 0x23; DELETE = 0x2E; BACK = 0x08; F2 = 0x71; F3 = 0x72; F4 = 0x73; F5 = 0x74; F6 = 0x75; F7 = 0x76; F8 = 0x77 }
function Fmt([double]$n) { return $n.ToString('0.######', [Globalization.CultureInfo]::InvariantCulture) }
function Ask-Next([string]$msg, [string]$btn) {
  $f = New-Form 'KiwNgan → Express' 520 190; $l = New-Object System.Windows.Forms.Label; $l.Left = 14; $l.Top = 12; $l.Width = 480; $l.Height = 90; $l.Text = $msg; $f.Controls.Add($l)
  $b1 = New-Object System.Windows.Forms.Button; $b1.Text = $btn; $b1.Left = 250; $b1.Top = 108; $b1.Width = 140; $b1.Height = 32; $b1.DialogResult = 'OK'; $f.Controls.Add($b1)
  $b2 = New-Object System.Windows.Forms.Button; $b2.Text = 'หยุด'; $b2.Left = 396; $b2.Top = 108; $b2.Width = 96; $b2.Height = 32; $b2.DialogResult = 'Cancel'; $f.Controls.Add($b2)
  $f.AcceptButton = $b1; $f.CancelButton = $b2; $f.StartPosition = 'Manual'; $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; $f.Left = $wa.Right - 540; $f.Top = $wa.Bottom - 210
  return ($f.ShowDialog() -eq 'OK')
}
function Run-Steps($steps, $vals, [string]$what) {
  foreach ($s in @($steps)) {
    $s = [string]$s; $show = $s
    foreach ($k in $vals.Keys) { $show = $show.Replace('{' + $k + '}', [string]$vals[$k]) }
    if ($stepMode -and $s -notmatch '^WAIT') { if (-not (Ask-Next ("$what`r`nขั้นต่อไป: $show") 'ต่อไป')) { throw 'หยุดตามที่ผู้ใช้สั่ง' } ; if (-not (Focus-Express)) { throw 'สลับไปหน้าต่าง Express ไม่ได้' }; $script:mouse = $null }
    Guard
    if ($s -match '^WAIT\s+(\d+)$') { Start-Sleep -Milliseconds ([int]$Matches[1]); continue }
    if ($s -match '^\{(\w+)\}$') { $v = [string]$vals[$Matches[1]]; if ($v) { [KiwNganKey.Kb]::Text($v, [int]$R.charGapMs) } }
    elseif ($s -match '^CTRL\+(\w)$') { [KiwNganKey.Kb]::Combo(0x11, [uint16][char]$Matches[1].ToUpper()) }
    elseif ($VK.ContainsKey($s.ToUpper())) { [KiwNganKey.Kb]::Key([uint16]$VK[$s.ToUpper()]) }
    else { throw "คำสั่งใน keyRecipe ไม่รู้จัก: $s" }
    Start-Sleep -Milliseconds ([int]$R.stepGapMs)
  }
}

# ---------- พิมพ์ทีละใบ ----------
$docNos = @($okRows | ForEach-Object { $_.doc } | Sort-Object -Unique); $n = 0
try {
  foreach ($dn in $docNos) {
    $n++; $lines = @($okRows | Where-Object { $_.doc -eq $dn })
    $first = $lines[0]
    if ($n -gt 1) { if (-not (Ask-Next ("ใบที่ {0}/{1} ({2} บรรทัด)`r`nบันทึกใบก่อนหน้าใน Express แล้วใช่ไหม? ถ้าใช่ กดสร้างเอกสาร OU ใหม่ให้หน้าว่าง แล้วกด 'เริ่มใบนี้'" -f $n, $docNos.Count, $lines.Count) 'เริ่มใบนี้')) { throw 'หยุดตามที่ผู้ใช้สั่ง' } }
    if (-not (Focus-Express)) { throw 'สลับไปหน้าต่าง Express ไม่ได้ — คลิกที่ Express หนึ่งครั้งแล้วลองใหม่' }
    $script:mouse = $null
    Log ("เริ่มใบ {0}: แผนก {1} · {2} บรรทัด" -f $n, $first.dep, $lines.Count)
    Run-Steps $R.start @{} ("ใบ {0}/{1}: เริ่ม" -f $n, $docNos.Count)
    Run-Steps $R.head @{ DEP = $first.dep; REM = $first.rem } ("ใบ {0}/{1}: หัวเอกสาร" -f $n, $docNos.Count)
    $li = 0
    foreach ($l in $lines) { $li++; Run-Steps $R.line @{ COD = $l.cod; LOC = $l.loc; QTY = (Fmt $l.qty) } ("ใบ {0}/{1} บรรทัด {2}/{3}: {4}" -f $n, $docNos.Count, $li, $lines.Count, $l.cod) }
    Run-Steps $R.done @{} 'จบใบ'
    Log ("คีย์ใบ {0} ครบ (ยังไม่บันทึก)" -f $n)
    if ($n -eq $docNos.Count) { [void](Ask-Next ("คีย์ครบ {0} ใบแล้ว`r`nตรวจหน้าจอให้ถูกต้อง แล้วกดบันทึกใน Express เอง`r`nแอป KiwNgan จะขึ้น 'ลงแล้ว ✓' พร้อมเลขเอกสารภายใน 1 นาที" -f $docNos.Count) 'ปิด') }
  }
} catch {
  Log ('หยุดกลางคัน: ' + $_.Exception.Message)
  [void][System.Windows.Forms.MessageBox]::Show(($_.Exception.Message + "`r`n`r`nข้อมูลที่พิมพ์ไปแล้วยังไม่ถูกบันทึก — ตรวจหน้าจอ Express แล้วแก้ หรือกดยกเลิกเอกสาร (✕ สีแดง)"), 'KiwNgan → Express', 'OK', 'Warning')
  exit 1
}
