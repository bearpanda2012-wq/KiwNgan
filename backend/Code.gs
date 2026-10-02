/**
 * KiwNgan คิวงาน — Backend (Google Apps Script)
 * ใช้ Google Sheet เป็นฐานข้อมูล และเปิดเป็น API ให้หน้าเว็บบน GitHub Pages เรียกใช้
 *
 * ติดตั้ง (ดู README.md ประกอบ)
 *   1) สร้าง Google Sheet ใหม่ > ส่วนขยาย > Apps Script > วางไฟล์นี้แทน Code.gs
 *   2) เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" > อนุญาตสิทธิ์
 *      ระบบจะสร้างชีต Jobs / TimeLogs / Activity / Settings และสร้าง "รหัสทีม"
 *      (ดูรหัสได้ในบันทึกการดำเนินการ หรือชีต Settings แถว teamKey)
 *   3) ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป
 *        ดำเนินการในฐานะ: ฉัน   |   ผู้มีสิทธิ์เข้าถึง: ทุกคน
 *   4) คัดลอก URL ที่ลงท้าย /exec ไปใส่ในหน้า ตั้งค่า > เชื่อมต่อฐานข้อมูล พร้อมรหัสทีม
 *
 * ย้ายข้อมูลจากชีตแบบเก่า (ตารางงานแบบ Jobshop): เรียกใช้ importJobshop() หลังใส่ ID ชีตเดิมใน OLD_SHEET_ID
 */

const VERSION = '1.0.0';
const OLD_SHEET_ID = ''; // ID ของชีต "ตารางงานแบบ Jobshop" เดิม (ใช้กับ importJobshop เท่านั้น)

const SHEETS = {
  Jobs: ['id', 'code', 'title', 'group', 'taskType', 'qty', 'level', 'assignee', 'sale', 'priority', 'revision',
         'status', 'received', 'due', 'startedAt', 'finishedAt', 'minutes', 'note', 'createdAt', 'updatedAt', 'updatedBy'],
  TimeLogs: ['id', 'jobId', 'member', 'start', 'end', 'minutes'],
  Activity: ['ts', 'jobId', 'who', 'action', 'detail'],
  Settings: ['key', 'value']
};
const STATUSES = ['queue', 'doing', 'review', 'hold', 'done'];

/* ======================= HTTP ======================= */

function doGet(e) {
  return json_({ ok: true, app: 'KiwNgan', version: VERSION, hint: 'ส่งคำขอแบบ POST พร้อมรหัสทีม' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData && e.postData.contents || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'คำขอไม่ถูกต้อง' });
  }
  try {
    checkKey_(req.key);
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + req.action);
    return json_({ ok: true, data: fn(req.payload || {}, req.who || '') });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

const ACTIONS = {
  ping: () => ({ version: VERSION, now: nowIso_() }),
  bootstrap: () => bootstrap_(),
  saveJob: (p, who) => withLock_(() => saveJob_(p.job, who)),
  deleteJob: (p, who) => withLock_(() => deleteJob_(p.id, who)),
  startTimer: (p, who) => withLock_(() => startTimer_(p.jobId, p.member || who, who)),
  stopTimer: (p, who) => withLock_(() => stopTimer_(p.logId, who)),
  deleteLog: (p, who) => withLock_(() => deleteLog_(p.logId, who)),
  saveSettings: (p, who) => withLock_(() => saveSettings_(p.settings, who)),
  activity: (p) => activityFor_(p.jobId)
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(key) {
  const expected = getSetting_('teamKey');
  if (!expected) throw new Error('ยังไม่ได้ตั้งค่าระบบ ให้เรียกใช้ฟังก์ชัน setup ใน Apps Script ก่อน');
  if (String(key || '').trim() !== String(expected).trim()) throw new Error('รหัสทีมไม่ถูกต้อง');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ======================= Sheet helpers ======================= */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return ss_().getSpreadsheetTimeZone() || 'Asia/Bangkok'; }
function nowIso_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ss"); }
function uid_(p) { return (p || '') + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

function sheet_(name) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    const head = SHEETS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#E6EEF0');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); // เก็บเป็นข้อความทั้งหมด
  }
  return sh;
}

function readAll_(name) {
  const sh = sheet_(name);
  const head = SHEETS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, head.length).getDisplayValues();
  return vals.filter(r => r[0] !== '').map(r => toObj_(name, head, r));
}

function toObj_(name, head, r) {
  const o = {};
  head.forEach((h, i) => { o[h] = r[i]; });
  if (name === 'Jobs') {
    o.level = o.level === '' ? '' : Number(o.level);
    o.minutes = Number(o.minutes) || 0;
    o.revision = o.revision === 'TRUE' || o.revision === 'true';
  }
  if (name === 'TimeLogs') o.minutes = Number(o.minutes) || 0;
  return o;
}

function rowOf_(name, id) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === String(id)) return i + 2;
  return -1;
}

function writeRow_(name, obj, row) {
  const sh = sheet_(name);
  const head = SHEETS[name];
  const vals = [head.map(h => obj[h] === undefined || obj[h] === null ? '' : String(obj[h]))];
  const r = row > 0 ? row : sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, head.length).setNumberFormat('@').setValues(vals);
  return r;
}

function log_(jobId, who, action, detail) {
  writeRow_('Activity', { ts: nowIso_(), jobId: jobId, who: who, action: action, detail: detail || '' }, -1);
}

/* ======================= Settings ======================= */

function getSetting_(key) {
  const sh = sheet_('Settings');
  const last = sh.getLastRow();
  if (last < 2) return '';
  const vals = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === key) return vals[i][1];
  return '';
}

function setSetting_(key, value) {
  const sh = sheet_('Settings');
  const last = sh.getLastRow();
  if (last >= 2) {
    const keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) { sh.getRange(i + 2, 2).setValue(value); return; }
    }
  }
  sh.appendRow([key, value]);
}

function saveSettings_(settings, who) {
  if (!settings || typeof settings !== 'object') throw new Error('ข้อมูลตั้งค่าไม่ถูกต้อง');
  delete settings.teamKey;
  setSetting_('config', JSON.stringify(settings));
  log_('', who, 'settings', 'แก้ไขการตั้งค่า');
  return { settings: settings };
}

function defaultSettings_() {
  return {
    company: 'บริษัทของคุณ', appName: 'KiwNgan คิวงาน', accent: '#0B6B70', logo: '',
    members: [], sales: [],
    groups: ['งาน 2D', 'งาน 2.5D', 'งาน 3D', 'งาน โครงการ', 'งาน ตัวอย่าง'],
    taskTypes: [{ name: 'ทำ CAD', cat: 'draw' }, { name: 'ทำ CAM', cat: 'cam' }, { name: 'ทำ CAD+CAM', cat: 'draw' },
                { name: 'ทำ แบบผลิต', cat: 'draw' }, { name: 'ทำ แบบติดตั้ง', cat: 'draw' }],
    levels: [{ level: 1, label: 'มีไฟล์ลูกค้า / แบบพร้อม' }, { level: 2, label: 'ดราฟลายเอง' }, { level: 3, label: 'ดราฟลาย + ขึ้น 3D' }],
    sla: {
      'งาน 2D': { cam: [1, 2], draw: [1, 3] }, 'งาน 2.5D': { cam: [1, 2], draw: [2, 3] },
      'งาน 3D': { cam: [1, 2], draw: [4, 5] }, 'งาน โครงการ': { cam: [1, 2], draw: [2, 2] },
      'งาน ตัวอย่าง': { cam: [1, 2], draw: [1, 2] }
    },
    skipWeekends: true
  };
}

/* ======================= Data ======================= */

function bootstrap_() {
  const raw = getSetting_('config');
  let settings = raw ? JSON.parse(raw) : defaultSettings_();
  // ส่งเฉพาะ log 120 วันล่าสุด + log ที่ยังจับเวลาอยู่
  const cutoff = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), tz_(), 'yyyy-MM-dd');
  const logs = readAll_('TimeLogs').filter(l => !l.end || l.start >= cutoff);
  return { settings: settings, jobs: readAll_('Jobs'), logs: logs, serverTime: nowIso_(), version: VERSION };
}

function cleanJob_(j) {
  const out = {};
  SHEETS.Jobs.forEach(h => { if (j[h] !== undefined) out[h] = j[h]; });
  delete out.minutes; delete out.createdAt; delete out.updatedAt; delete out.updatedBy; // ค่าที่ server เป็นคนกำหนด
  if (out.status && STATUSES.indexOf(out.status) < 0) out.status = 'queue';
  if (out.priority && ['normal', 'urgent'].indexOf(out.priority) < 0) out.priority = 'normal';
  return out;
}

function saveJob_(job, who) {
  if (!job || !String(job.code || '').trim()) throw new Error('กรุณาใส่เลข Job');
  const data = cleanJob_(job);
  const now = nowIso_();
  let row = data.id ? rowOf_('Jobs', data.id) : -1;
  let before = null;
  if (row > 0) {
    const head = SHEETS.Jobs;
    before = toObj_('Jobs', head, sheet_('Jobs').getRange(row, 1, 1, head.length).getDisplayValues()[0]);
    if (job.baseUpdatedAt && before.updatedAt && job.baseUpdatedAt !== before.updatedAt) {
      throw new Error('งานนี้ถูกแก้โดยคนอื่นเมื่อสักครู่ กดรีเฟรชแล้วลองอีกครั้ง');
    }
  } else {
    data.id = data.id || uid_('j_');
    data.createdAt = now;
  }
  const merged = Object.assign({}, before || {}, data, { updatedAt: now, updatedBy: who || '' });
  if (merged.status === 'done' && !merged.finishedAt) merged.finishedAt = now.slice(0, 16);
  if (merged.status !== 'done') merged.finishedAt = '';
  if ((merged.status === 'doing' || merged.status === 'review') && !merged.startedAt) merged.startedAt = now.slice(0, 16);
  writeRow_('Jobs', merged, row);

  if (!before) log_(merged.id, who, 'create', merged.code);
  else if (before.status !== merged.status) log_(merged.id, who, 'status', before.status + '→' + merged.status);
  else log_(merged.id, who, 'edit', diffText_(before, merged));
  return { job: toObj_('Jobs', SHEETS.Jobs, SHEETS.Jobs.map(h => merged[h] === undefined ? '' : String(merged[h]))) };
}

function diffText_(a, b) {
  const skip = ['updatedAt', 'updatedBy', 'minutes'];
  return SHEETS.Jobs.filter(h => skip.indexOf(h) < 0 && String(a[h] || '') !== String(b[h] || '')).join(', ');
}

function deleteJob_(id, who) {
  const row = rowOf_('Jobs', id);
  if (row < 0) throw new Error('ไม่พบงานนี้');
  const code = sheet_('Jobs').getRange(row, 2).getDisplayValue();
  sheet_('Jobs').deleteRow(row);
  log_(id, who, 'delete', code);
  return { id: id };
}

function recalcMinutes_(jobId) {
  const total = readAll_('TimeLogs').filter(l => l.jobId === jobId && l.end).reduce((s, l) => s + (l.minutes || 0), 0);
  const row = rowOf_('Jobs', jobId);
  if (row > 0) sheet_('Jobs').getRange(row, SHEETS.Jobs.indexOf('minutes') + 1).setValue(String(total));
  return total;
}

function startTimer_(jobId, member, who) {
  if (rowOf_('Jobs', jobId) < 0) throw new Error('ไม่พบงานนี้');
  // ปิดตัวจับเวลาที่ค้างของคนนี้ก่อน (คนหนึ่งจับเวลาได้ทีละงาน)
  const open = readAll_('TimeLogs').filter(l => !l.end && l.member === member);
  const closed = open.map(l => stopTimer_(l.id, who));
  const log = { id: uid_('t_'), jobId: jobId, member: member, start: nowIso_().slice(0, 16), end: '', minutes: 0 };
  writeRow_('TimeLogs', log, -1);
  // เริ่มจับเวลา = งานเข้าสถานะกำลังทำ
  const row = rowOf_('Jobs', jobId);
  const head = SHEETS.Jobs;
  const job = toObj_('Jobs', head, sheet_('Jobs').getRange(row, 1, 1, head.length).getDisplayValues()[0]);
  if (job.status === 'queue' || job.status === 'hold') {
    job.status = 'doing';
    if (!job.startedAt) job.startedAt = log.start;
    job.updatedAt = nowIso_(); job.updatedBy = who;
    writeRow_('Jobs', job, row);
    log_(jobId, who, 'status', 'queue→doing');
  }
  log_(jobId, who, 'timer', 'เริ่มจับเวลา');
  return { log: log, job: job, closed: closed.map(c => c.log) };
}

function stopTimer_(logId, who) {
  const row = rowOf_('TimeLogs', logId);
  if (row < 0) throw new Error('ไม่พบรายการจับเวลา');
  const head = SHEETS.TimeLogs;
  const log = toObj_('TimeLogs', head, sheet_('TimeLogs').getRange(row, 1, 1, head.length).getDisplayValues()[0]);
  if (!log.end) {
    log.end = nowIso_().slice(0, 16);
    log.minutes = Math.max(0, Math.round((parseLocal_(log.end) - parseLocal_(log.start)) / 60000));
    writeRow_('TimeLogs', log, row);
    log_(log.jobId, who, 'timer', 'หยุดจับเวลา ' + log.minutes + ' นาที');
  }
  const total = recalcMinutes_(log.jobId);
  return { log: log, jobId: log.jobId, minutes: total };
}

function deleteLog_(logId, who) {
  const row = rowOf_('TimeLogs', logId);
  if (row < 0) throw new Error('ไม่พบรายการจับเวลา');
  const jobId = sheet_('TimeLogs').getRange(row, 2).getDisplayValue();
  sheet_('TimeLogs').deleteRow(row);
  log_(jobId, who, 'timer', 'ลบรายการเวลา');
  return { logId: logId, jobId: jobId, minutes: recalcMinutes_(jobId) };
}

function activityFor_(jobId) {
  return readAll_('Activity').filter(a => a.jobId === jobId).slice(-50).reverse();
}

function parseLocal_(s) {
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : 0;
}

/* ======================= Setup ======================= */

function setup() {
  Object.keys(SHEETS).forEach(sheet_);
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('แผ่นที่1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  let key = getSetting_('teamKey');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    setSetting_('teamKey', key);
  }
  if (!getSetting_('config')) setSetting_('config', JSON.stringify(defaultSettings_()));
  Logger.log('ตั้งค่าเสร็จแล้ว รหัสทีมของคุณคือ: ' + key);
  return key;
}

/** เปลี่ยนรหัสทีม (ทุกคนต้องใส่รหัสใหม่ในหน้าตั้งค่า) */
function resetTeamKey() {
  const key = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  setSetting_('teamKey', key);
  Logger.log('รหัสทีมใหม่: ' + key);
}

/* ======================= Import from old Jobshop sheet ======================= */

function importJobshop() {
  if (!OLD_SHEET_ID) throw new Error('ใส่ ID ชีตเดิมในตัวแปร OLD_SHEET_ID ก่อน');
  setup();
  const old = SpreadsheetApp.openById(OLD_SHEET_ID);
  const tz = old.getSpreadsheetTimeZone();
  const sh = old.getSheetByName('Task View');
  const n = Math.min(40, sh.getLastRow());
  const gcol = sh.getRange(1, 7, n, 1).getDisplayValues();
  let hr = -1;
  for (let i = 0; i < n; i++) if (String(gcol[i][0]).trim().toLowerCase() === 'job') { hr = i + 1; break; }
  if (hr < 0) throw new Error('ไม่พบหัวตาราง Job ในชีต Task View');

  const rng = sh.getRange(hr + 1, 1, sh.getLastRow() - hr, 21);
  const v = rng.getValues(), d = rng.getDisplayValues();
  const fd = x => x instanceof Date ? Utilities.formatDate(x, tz, 'yyyy-MM-dd') : '';
  const ft = s => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; };
  const nick = s => String(s || '').split('-')[0].trim();

  const existing = {};
  readAll_('Jobs').forEach(j => { existing[j.code] = true; });
  const members = {}, sales = {}, groups = {}, types = {};
  let added = 0;
  const now = nowIso_();

  for (let i = 0; i < v.length; i++) {
    const code = String(d[i][6]).trim();
    if (!code || existing[code]) continue;
    const done = v[i][17] === true;
    const sD = fd(v[i][7]), eD = fd(v[i][8]), sT = ft(d[i][9]), eT = ft(d[i][10]);
    const doneDate = fd(v[i][18]);
    const note = String(d[i][16]).trim();
    const job = {
      id: uid_('j_'), code: code, title: '', group: String(d[i][12]).trim(), taskType: String(d[i][15]).trim(), qty: 'single',
      level: v[i][13] === '' ? '' : Number(v[i][13]), assignee: nick(d[i][14]), sale: String(d[i][11]).replace(/-\s*$/, '').trim(),
      priority: v[i][20] === true ? 'urgent' : 'normal', revision: /แก้ไข/.test(note) || /_re\d*/i.test(code),
      status: done ? 'done' : (sD ? 'doing' : 'queue'), received: fd(v[i][4]), due: fd(v[i][5]),
      startedAt: sD ? sD + 'T' + (sT || '08:00') : '', finishedAt: done ? (doneDate || eD) + 'T' + (eT || '17:00') : '',
      minutes: 0, note: note, createdAt: now, updatedAt: now, updatedBy: 'import'
    };
    // เวลาทำงานจากเวลาเริ่ม-จบ (เฉพาะวันเดียวกัน)
    if (sD && eD && sD === eD && sT && eT) {
      const start = sD + 'T' + sT, end = eD + 'T' + eT;
      const mins = Math.round((parseLocal_(end) - parseLocal_(start)) / 60000);
      if (mins > 0 && mins < 720) {
        writeRow_('TimeLogs', { id: uid_('t_'), jobId: job.id, member: job.assignee, start: start, end: end, minutes: mins }, -1);
        job.minutes = mins;
      }
    }
    writeRow_('Jobs', job, -1);
    added++;
    if (job.assignee) members[job.assignee] = String(d[i][14]).split('-')[1] || '';
    if (job.sale) sales[job.sale] = 1;
    if (job.group) groups[job.group] = 1;
    if (job.taskType) types[job.taskType] = 1;
  }

  // รวมรายชื่อเข้า Settings
  const s = JSON.parse(getSetting_('config') || JSON.stringify(defaultSettings_()));
  const colors = ['#0B6B70', '#2D5FC4', '#B05A2A', '#7A4BB5', '#2B7F4A', '#B8435F'];
  Object.keys(members).forEach(name => {
    if (!s.members.some(m => m.name === name)) s.members.push({ id: uid_('m_'), name: name, full: members[name].trim(), color: colors[s.members.length % colors.length] });
  });
  Object.keys(sales).forEach(x => { if (s.sales.indexOf(x) < 0) s.sales.push(x); });
  Object.keys(groups).forEach(x => { if (s.groups.indexOf(x) < 0) s.groups.push(x); });
  Object.keys(types).forEach(x => { if (!s.taskTypes.some(t => t.name === x)) s.taskTypes.push({ name: x, cat: /CAM$/.test(x) ? 'cam' : 'draw' }); });
  setSetting_('config', JSON.stringify(s));
  log_('', 'import', 'import', 'นำเข้า ' + added + ' งานจากชีตเดิม');
  Logger.log('นำเข้าเสร็จ ' + added + ' งาน');
  return added;
}
