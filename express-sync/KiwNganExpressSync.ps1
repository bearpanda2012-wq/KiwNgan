# KiwNgan ⇄ Express : ตัวซิงก์ข้อมูลสต็อก (อ่าน Express อย่างเดียว)
# -----------------------------------------------------------------------------
# - เปิดไฟล์ .DBF ของ Express แบบ "อ่านอย่างเดียว" และแชร์ให้ Express ใช้งานต่อได้ (FileShare.ReadWrite)
#   ไม่เขียน ไม่ล็อก ไม่สร้างไฟล์ใด ๆ ในโฟลเดอร์ Express
# - ทุก 30 วินาที ดูว่าไฟล์สต็อกเปลี่ยนหรือยัง ถ้าเปลี่ยน อ่านแล้วส่ง "เฉพาะแถวที่เปลี่ยน" ขึ้น Supabase
# - เก็บสถานะ (ว่าส่งอะไรไปแล้ว) ไว้ในโฟลเดอร์ของตัวเองเท่านั้น
# ใช้กับ Windows PowerShell 5.1 ขึ้นไป ไม่ต้องติดตั้งอะไรเพิ่ม
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot 'config.json'),
  [switch]$Once,          # รันรอบเดียวแล้วจบ (ใช้ทดสอบ)
  [switch]$DryRun         # อ่านและนับอย่างเดียว ไม่ส่งขึ้นเน็ต
)
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$src = @'
#pragma warning disable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;

namespace KiwNganEx {
  public class Field { public string Name; public char Type; public int Len; public int Off; }

  /* อ่าน dBase/FoxPro .DBF แบบอ่านอย่างเดียว */
  public class Dbf {
    public List<Field> Fields = new List<Field>();
    public int Count; public int HeaderLen; public int RecLen;
    byte[] data; Encoding enc;
    public Dbf(string path, Encoding enc) {
      this.enc = enc;
      using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
        data = new byte[fs.Length]; int got = 0;
        while (got < data.Length) { int n = fs.Read(data, got, data.Length - got); if (n <= 0) break; got += n; }
        if (got < 32) throw new Exception("ไฟล์สั้นผิดปกติ: " + path);
      }
      Count = BitConverter.ToInt32(data, 4); HeaderLen = BitConverter.ToUInt16(data, 8); RecLen = BitConverter.ToUInt16(data, 10);
      int p = 32, off = 1;
      while (p + 32 <= data.Length && data[p] != 0x0D) {
        Field f = new Field();
        int z = 0; while (z < 11 && data[p + z] != 0) z++;
        f.Name = Encoding.ASCII.GetString(data, p, z); f.Type = (char)data[p + 11]; f.Len = data[p + 16]; f.Off = off; off += f.Len;
        Fields.Add(f); p += 32;
      }
      // ไฟล์กำลังถูกเขียนต่อท้าย: นับเฉพาะเรคคอร์ดที่มีครบ
      long avail = (data.Length - HeaderLen) / Math.Max(1, RecLen);
      if (Count > avail) Count = (int)avail;
    }
    public Dictionary<string, Field> Map() { Dictionary<string, Field> m = new Dictionary<string, Field>(); foreach (Field f in Fields) m[f.Name] = f; return m; }
    public bool Deleted(int i) { return data[HeaderLen + (long)i * RecLen] == (byte)'*'; }
    public string S(int i, Field f) {
      if (f == null) return "";
      long b = HeaderLen + (long)i * RecLen + f.Off;
      string s = enc.GetString(data, (int)b, f.Len);
      int z = s.IndexOf('\0'); if (z >= 0) s = s.Substring(0, z);
      return s.Replace(' ', ' ').Trim();
    }
    public double D(int i, Field f) {
      if (f == null) return 0;
      long b = HeaderLen + (long)i * RecLen + f.Off;
      if (f.Type == 'B') return BitConverter.ToDouble(data, (int)b);
      if (f.Type == 'I') return BitConverter.ToInt32(data, (int)b);
      if (f.Type == 'Y') return BitConverter.ToInt64(data, (int)b) / 10000.0;
      double v; return double.TryParse(S(i, f), NumberStyles.Float, CultureInfo.InvariantCulture, out v) ? v : 0;
    }
  }

  public class Agent {
    public string Url, Key, Token, Root, Prefix, StateDir, DataDir = "";
    public bool DryRun;
    public Action<string> Log = delegate { };
    Encoding enc;
    Dictionary<string, string> sig = new Dictionary<string, string>();                 // ลายเซ็นไฟล์ (ขนาด+เวลา)
    Dictionary<string, Dictionary<string, string>> sent = new Dictionary<string, Dictionary<string, string>>(); // key -> hash ที่ส่งแล้ว

    public Agent() {
      try { enc = Encoding.GetEncoding(874); }
      catch {
        // .NET รุ่นใหม่ต้องลงทะเบียนโค้ดเพจไทยก่อน
        Type t = Type.GetType("System.Text.CodePagesEncodingProvider, System.Text.Encoding.CodePages");
        if (t != null) { object inst = t.GetProperty("Instance").GetValue(null, null); Encoding.RegisterProvider((EncodingProvider)inst); }
        enc = Encoding.GetEncoding(874);
      }
    }

    static string N(double d) { if (double.IsNaN(d) || double.IsInfinity(d)) return "0"; return Math.Round(d, 6).ToString("R", CultureInfo.InvariantCulture); }
    static string J(string s) {
      if (s == null) return "\"\"";
      StringBuilder b = new StringBuilder(s.Length + 2); b.Append('"');
      foreach (char c in s) {
        if (c == '"') b.Append("\\\""); else if (c == '\\') b.Append("\\\\");
        else if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4")); else b.Append(c);
      }
      return b.Append('"').ToString();
    }

    /* เลือกโฟลเดอร์ปีปัจจุบัน: โฟลเดอร์ ROYxx ที่ STMAS.DBF แก้ล่าสุด */
    public string PickDataDir() {
      string best = null; DateTime bt = DateTime.MinValue;
      foreach (string d in Directory.GetDirectories(Root)) {
        string name = Path.GetFileName(d);
        if (!name.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase)) continue;
        string rest = name.Substring(Prefix.Length); int dummy; if (rest.Length == 0 || !int.TryParse(rest, out dummy)) continue;
        string f = Path.Combine(d, "STMAS.DBF"); if (!File.Exists(f)) continue;
        DateTime t = File.GetLastWriteTimeUtc(f); if (t > bt) { bt = t; best = d; }
      }
      if (best == null) throw new Exception("ไม่พบโฟลเดอร์ข้อมูล " + Prefix + "xx ที่มี STMAS.DBF ใน " + Root);
      return best;
    }
    string Sig(string f) { FileInfo fi = new FileInfo(f); return fi.Exists ? fi.Length + ":" + fi.LastWriteTimeUtc.Ticks : "none"; }
    string F(string name) { return Path.Combine(DataDir, name); }

    /* ---------- สถานะของตัวซิงก์ (เก็บในโฟลเดอร์ของตัวเองเท่านั้น) ---------- */
    string StateFile() { return Path.Combine(StateDir, "state-" + Path.GetFileName(DataDir) + ".tsv"); }
    public void LoadState() {
      sent.Clear(); sig.Clear();
      string p = StateFile(); if (!File.Exists(p)) return;
      foreach (string line in File.ReadAllLines(p, Encoding.UTF8)) {
        string[] a = line.Split('\t'); if (a.Length < 3) continue;
        if (a[0] == "#sig") { sig[a[1]] = a[2]; continue; }
        Dictionary<string, string> d; if (!sent.TryGetValue(a[0], out d)) { d = new Dictionary<string, string>(); sent[a[0]] = d; }
        d[a[1]] = a[2];
      }
    }
    void SaveState() {
      Directory.CreateDirectory(StateDir);
      string tmp = StateFile() + ".tmp";
      using (StreamWriter w = new StreamWriter(tmp, false, new UTF8Encoding(false))) {
        foreach (KeyValuePair<string, string> s in sig) w.WriteLine("#sig\t" + s.Key + "\t" + s.Value);
        foreach (KeyValuePair<string, Dictionary<string, string>> t in sent) foreach (KeyValuePair<string, string> r in t.Value) w.WriteLine(t.Key + "\t" + r.Key + "\t" + r.Value);
      }
      if (File.Exists(StateFile())) File.Delete(StateFile());
      File.Move(tmp, StateFile());
    }
    Dictionary<string, string> Sent(string t) { Dictionary<string, string> d; if (!sent.TryGetValue(t, out d)) { d = new Dictionary<string, string>(); sent[t] = d; } return d; }
    static string H(string s) { using (System.Security.Cryptography.MD5 m = System.Security.Cryptography.MD5.Create()) return Convert.ToBase64String(m.ComputeHash(Encoding.UTF8.GetBytes(s))).Substring(0, 16); }

    /* ---------- อ่านแต่ละตาราง เป็น key -> json ---------- */
    Dictionary<string, string> ReadItems() {
      Dbf d = new Dbf(F("STMAS.DBF"), enc); Dictionary<string, Field> m = d.Map(); Dictionary<string, string> o = new Dictionary<string, string>();
      for (int i = 0; i < d.Count; i++) {
        if (d.Deleted(i)) continue; string cod = d.S(i, m["STKCOD"]); if (cod.Length == 0) continue;
        o[cod] = "{\"cod\":" + J(cod) + ",\"des\":" + J(d.S(i, m["STKDES"])) + ",\"des2\":" + J(d.S(i, Fd(m, "STKDES2"))) + ",\"grp\":" + J(d.S(i, Fd(m, "STKGRP"))) +
          ",\"typ\":" + J(d.S(i, Fd(m, "STKTYP"))) + ",\"unit\":" + J(d.S(i, Fd(m, "QUCOD"))) + ",\"bal\":" + N(d.D(i, Fd(m, "TOTBAL"))) + ",\"val\":" + N(d.D(i, Fd(m, "TOTVAL"))) +
          ",\"unitpr\":" + N(d.D(i, Fd(m, "UNITPR"))) + ",\"lpurdat\":" + J(d.S(i, Fd(m, "LPURDAT"))) + ",\"lpurpr\":" + N(d.D(i, Fd(m, "LPURPR"))) + ",\"supcod\":" + J(d.S(i, Fd(m, "SUPCOD"))) +
          ",\"remark\":" + J(d.S(i, Fd(m, "REMARK"))) + ",\"status\":" + J(d.S(i, Fd(m, "STATUS"))) + ",\"chgdat\":" + J(d.S(i, Fd(m, "CHGDAT"))) + "}";
      }
      return o;
    }
    Dictionary<string, string> ReadLocs() {   // เฉพาะที่มียอด (แถวที่ยอดกลายเป็น 0 จะถูกส่งเป็น "ลบ" = ยอด 0)
      Dbf d = new Dbf(F("STLOC.DBF"), enc); Dictionary<string, Field> m = d.Map(); Dictionary<string, string> o = new Dictionary<string, string>();
      for (int i = 0; i < d.Count; i++) {
        if (d.Deleted(i)) continue; string cod = d.S(i, m["STKCOD"]), loc = d.S(i, m["LOCCOD"]); double bal = d.D(i, Fd(m, "LOCBAL"));
        if (cod.Length == 0 || Math.Abs(bal) < 1e-9) continue;
        string k = cod + "|" + loc;
        o[k] = "{\"cod\":" + J(cod) + ",\"loc\":" + J(loc) + ",\"bal\":" + N(bal) + ",\"val\":" + N(d.D(i, Fd(m, "LOCVAL"))) + ",\"lmovdat\":" + J(d.S(i, Fd(m, "LMOVDAT"))) + "}";
      }
      return o;
    }
    Dictionary<string, string> ReadMoves() {  // สต็อกการ์ดของปีนี้ (ข้ามใบสั่งขาย/มัดจำที่ไม่ขยับสต็อก)
      Dbf d = new Dbf(F("STCRD.DBF"), enc); Dictionary<string, Field> m = d.Map(); Dictionary<string, string> o = new Dictionary<string, string>();
      string yr = Path.GetFileName(DataDir);
      for (int i = 0; i < d.Count; i++) {
        if (d.Deleted(i)) continue; string op = d.S(i, Fd(m, "POSOPR")); if (op.Length == 0 || op == ">") continue;
        string cod = d.S(i, m["STKCOD"]), doc = d.S(i, m["DOCNUM"]), seq = d.S(i, Fd(m, "SEQNUM")), loc = d.S(i, Fd(m, "LOCCOD"));
        string k = yr + "|" + doc + "|" + seq + "|" + cod + "|" + loc + "|" + op; string k0 = k; int n = 2; while (o.ContainsKey(k)) k = k0 + "#" + (n++);
        o[k] = "{\"k\":" + J(k) + ",\"yr\":" + J(yr) + ",\"doc\":" + J(doc) + ",\"seq\":" + J(seq) + ",\"dat\":" + J(d.S(i, Fd(m, "DOCDAT"))) + ",\"cod\":" + J(cod) + ",\"loc\":" + J(loc) +
          ",\"op\":" + J(op) + ",\"qty\":" + N(d.D(i, Fd(m, "TRNQTY"))) + ",\"unitpr\":" + N(d.D(i, Fd(m, "UNITPR"))) + ",\"val\":" + N(d.D(i, Fd(m, "TRNVAL"))) +
          ",\"people\":" + J(d.S(i, Fd(m, "PEOPLE"))) + ",\"dep\":" + J(d.S(i, Fd(m, "DEPCOD"))) + ",\"des\":" + J(d.S(i, Fd(m, "STKDES"))) + "}";
      }
      return o;
    }
    string ReadTabs() {   // ชื่อหน่วย ชื่อคลัง ชื่อกลุ่ม ชื่อแผนก จาก ISTAB
      string f = F("ISTAB.DBF"); if (!File.Exists(f)) return "{}";
      Dbf d = new Dbf(f, enc); Dictionary<string, Field> m = d.Map();
      string[][] want = new string[][] { new string[] { "20", "units" }, new string[] { "21", "locs" }, new string[] { "22", "groups" }, new string[] { "50", "deps" } };
      StringBuilder b = new StringBuilder("{"); bool first = true;
      foreach (string[] w in want) {
        StringBuilder g = new StringBuilder("{"); bool f1 = true; Dictionary<string, bool> seen = new Dictionary<string, bool>();
        for (int i = 0; i < d.Count; i++) {
          if (d.Deleted(i) || d.S(i, m["TABTYP"]) != w[0]) continue; string c = d.S(i, m["TYPCOD"]); if (c.Length == 0 || seen.ContainsKey(c)) continue; seen[c] = true;
          string nm = d.S(i, m["TYPDES"]); if (nm.Length == 0) nm = d.S(i, m["SHORTNAM"]);
          if (!f1) g.Append(','); f1 = false; g.Append(J(c)).Append(':').Append(J(nm));
        }
        if (!first) b.Append(','); first = false; b.Append(J(w[1])).Append(':').Append(g.Append('}'));
      }
      return b.Append('}').ToString();
    }
    static Field Fd(Dictionary<string, Field> m, string n) { Field f; return m.TryGetValue(n, out f) ? f : null; }

    /* ---------- ส่งขึ้น Supabase ---------- */
    string Post(string body) {
      HttpWebRequest r = (HttpWebRequest)WebRequest.Create(Url.TrimEnd('/') + "/rest/v1/rpc/ex_push");
      r.Method = "POST"; r.ContentType = "application/json; charset=utf-8"; r.Headers["apikey"] = Key; r.Headers["Authorization"] = "Bearer " + Key; r.Timeout = 120000;
      r.AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate;
      byte[] b = Encoding.UTF8.GetBytes(body); r.ContentLength = b.Length;
      using (Stream s = r.GetRequestStream()) s.Write(b, 0, b.Length);
      try { using (WebResponse resp = r.GetResponse()) using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) return sr.ReadToEnd(); }
      catch (WebException e) {
        string msg = e.Message;
        if (e.Response != null) using (StreamReader sr = new StreamReader(e.Response.GetResponseStream(), Encoding.UTF8)) msg += " " + sr.ReadToEnd();
        throw new Exception("ส่งขึ้น Supabase ไม่สำเร็จ: " + msg);
      }
    }
    string Info(string extra) {
      return "{\"host\":" + J(Environment.MachineName) + ",\"dir\":" + J(Path.GetFileName(DataDir)) + ",\"ver\":\"1.0\"" + extra + "}";
    }
    int SendTable(string table, string arg, Dictionary<string, string> cur) {
      Dictionary<string, string> done = Sent(table); List<string> upd = new List<string>(); List<string> updK = new List<string>(); List<string> gone = new List<string>();
      foreach (KeyValuePair<string, string> r in cur) { string h = H(r.Value); string old; if (!done.TryGetValue(r.Key, out old) || old != h) { upd.Add(r.Value); updK.Add(r.Key); } }
      foreach (string k in done.Keys) if (!cur.ContainsKey(k)) gone.Add(k);
      if (DryRun) { Log(table + ": ทั้งหมด " + cur.Count + " · จะส่ง " + upd.Count + " · หายไป " + gone.Count); return upd.Count + gone.Count; }
      const int B = 700;
      for (int i = 0; i < upd.Count; i += B) {
        int n = Math.Min(B, upd.Count - i);
        Post("{\"tok\":" + J(Token) + ",\"" + arg + "\":[" + string.Join(",", upd.GetRange(i, n).ToArray()) + "]}");
        for (int j = i; j < i + n; j++) done[updK[j]] = H(cur[updK[j]]);
        SaveState();
      }
      for (int i = 0; i < gone.Count; i += 2000) {
        int n = Math.Min(2000, gone.Count - i); List<string> part = gone.GetRange(i, n); StringBuilder b = new StringBuilder("[");
        for (int j = 0; j < part.Count; j++) { if (j > 0) b.Append(','); b.Append(J(part[j])); }
        Post("{\"tok\":" + J(Token) + ",\"dels\":{\"" + arg + "\":" + b.Append(']') + "}}");
        foreach (string k in part) done.Remove(k);
        SaveState();
      }
      if (upd.Count + gone.Count > 0) Log(table + ": ส่ง " + upd.Count + " แถว · ลบ " + gone.Count + " (ทั้งหมด " + cur.Count + ")");
      return upd.Count + gone.Count;
    }

    /* หนึ่งรอบ: ดูว่าไฟล์ไหนเปลี่ยน แล้วส่งเฉพาะส่วนนั้น */
    public int RunOnce(bool force) {
      string dir = PickDataDir();
      if (dir != DataDir) { DataDir = dir; LoadState(); Log("ใช้ข้อมูลจาก " + dir); }
      int n = 0; bool any = false;
      string[][] t = new string[][] { new string[] { "STMAS.DBF", "items" }, new string[] { "STLOC.DBF", "locs" }, new string[] { "STCRD.DBF", "moves" }, new string[] { "ISTAB.DBF", "tabs" } };
      foreach (string[] x in t) {
        string f = F(x[0]); string s = Sig(f); string old; sig.TryGetValue(x[0], out old);
        if (!force && old == s) continue;
        any = true;
        if (x[1] == "items") n += SendTable("items", "items", ReadItems());
        else if (x[1] == "locs") n += SendTable("locs", "locs", ReadLocs());
        else if (x[1] == "moves") n += SendTable("moves", "moves", ReadMoves());
        else if (!DryRun) { Post("{\"tok\":" + J(Token) + ",\"tabs\":" + ReadTabs() + "}"); n++; }
        // ถ้าไฟล์เปลี่ยนระหว่างอ่าน รอบหน้าจะอ่านใหม่อีกครั้ง
        if (Sig(f) == s) sig[x[0]] = s;
        if (!DryRun) SaveState();
      }
      if (!DryRun && (any || force)) Post("{\"tok\":" + J(Token) + ",\"info\":" + Info(",\"changed\":" + n) + "}");
      return n;
    }
    public void Heartbeat() { if (!DryRun) Post("{\"tok\":" + J(Token) + ",\"info\":" + Info(",\"changed\":0") + "}"); }
  }
}
'@
if (-not ('KiwNganEx.Agent' -as [type])) { Add-Type -TypeDefinition $src -Language CSharp }

$cfg = Get-Content -Raw -Encoding UTF8 $ConfigPath | ConvertFrom-Json
$stateDir = Join-Path $PSScriptRoot 'state'; New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$logFile = Join-Path $stateDir 'sync.log'
function Write-Log([string]$m) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m
  Write-Host $line
  try { if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 2MB) { Move-Item -Force $logFile ($logFile + '.old') }; Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch {}
}

# หาโฟลเดอร์ Express: ใช้ค่าจาก config หรือหาจากโฟลเดอร์ที่แชร์ชื่อ "Express" บนเครื่องนี้
$root = $cfg.expressRoot
if (-not $root) {
  try { $share = Get-SmbShare -Name 'Express' -ErrorAction Stop; $root = Join-Path $share.Path 'ExpressI' } catch {}
}
if (-not $root -or -not (Test-Path $root)) { Write-Log "ไม่พบโฟลเดอร์ Express ($root) — ใส่ expressRoot ใน config.json"; exit 2 }

$a = New-Object KiwNganEx.Agent
$a.Url = $cfg.url; $a.Key = $cfg.key; $a.Token = $cfg.token; $a.Root = $root; $a.Prefix = $(if ($cfg.prefix) { $cfg.prefix } else { 'ROY' })
$a.StateDir = $stateDir; $a.DryRun = [bool]$DryRun
$a.Log = [Action[string]] { param($m) Write-Log $m }

# กันรันซ้อน 2 ตัว
$mutex = New-Object System.Threading.Mutex($false, 'Global\KiwNganExpressSync')
if (-not $mutex.WaitOne(0)) { Write-Host 'มีตัวซิงก์รันอยู่แล้ว'; exit 0 }
try {
  Write-Log "เริ่มทำงาน · Express: $root"
  $first = $true; $lastBeat = Get-Date
  while ($true) {
    try {
      $n = $a.RunOnce($first); $first = $false
      if ($n -eq 0 -and ((Get-Date) - $lastBeat).TotalMinutes -ge 5) { $a.Heartbeat(); $lastBeat = Get-Date }
      elseif ($n -gt 0) { $lastBeat = Get-Date }
    } catch { Write-Log ("ผิดพลาด: " + $_.Exception.Message); Start-Sleep -Seconds 30 }
    if ($Once) { break }
    Start-Sleep -Seconds ([int]$(if ($cfg.intervalSec) { $cfg.intervalSec } else { 30 }))
  }
} finally { $mutex.ReleaseMutex() }
