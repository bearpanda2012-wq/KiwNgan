/**
 * KiwNgan คิวงาน — Backend (Google Apps Script)
 * ใช้ Google Sheet เป็นฐานข้อมูล และเปิดเป็น API ให้หน้าเว็บบน GitHub Pages เรียกใช้
 *
 * ติดตั้ง (ดู README.md ประกอบ)
 *   1) เปิด Google Sheet ที่จะใช้เป็นฐานข้อมูล > ส่วนขยาย > Apps Script > วางไฟล์นี้แทน Code.gs
 *   2) เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" > อนุญาตสิทธิ์
 *      ระบบจะสร้างชีตที่ต้องใช้ และบัญชีแอดมินคนแรกพร้อม PIN (ดูในบันทึกการดำเนินการ)
 *   3) ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป
 *        ดำเนินการในฐานะ: ฉัน   |   ผู้มีสิทธิ์เข้าถึง: ทุกคน
 *   4) คัดลอก URL ที่ลงท้าย /exec ไปใส่ในหน้าเว็บ (หน้าเข้าสู่ระบบ > ตั้งค่าการเชื่อมต่อ)
 *
 * สิทธิ์
 *   admin : แก้ไข/ลบทุกงาน มอบหมายงาน จัดการผู้ใช้ และการตั้งค่า
 *   user  : ดูงานทั้งทีม เพิ่มงานของตัวเอง แก้ไขงานที่ตัวเองรับผิดชอบหรือสร้าง จับเวลาของตัวเอง
 *
 * ย้ายข้อมูลจากชีตแบบเก่า (ตารางงานแบบ Jobshop): ใส่ ID ชีตเดิมใน OLD_SHEET_ID แล้วเรียกใช้ importJobshop()
 */

const VERSION = '1.4.0';
const OLD_SHEET_ID = ''; // ID ของชีต "ตารางงานแบบ Jobshop" เดิม (ใช้กับ importJobshop เท่านั้น)
const DB_SHEET_ID = '';  // ใช้เมื่อสร้างสคริปต์แยกจากชีต (standalone): ID ของชีตฐานข้อมูล
const SESSION_DAYS = 30;
const MAX_PIN_FAILS = 5;

const SHEETS = {
  Jobs: ['id', 'code', 'title', 'group', 'taskType', 'qty', 'level', 'assignee', 'sale', 'priority', 'revision',
         'status', 'received', 'due', 'startedAt', 'finishedAt', 'minutes', 'note', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
  TimeLogs: ['id', 'jobId', 'member', 'start', 'end', 'minutes'],
  Activity: ['ts', 'jobId', 'who', 'action', 'detail'],
  Users: ['id', 'name', 'full', 'role', 'color', 'active', 'pinHash', 'salt', 'createdAt', 'photo'],
  Settings: ['key', 'value'],
  Images: ['id', 'jobId', 'createdBy', 'createdAt', 'thumb', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']
};
const IMG_PARTS = 8, IMG_CELL = 45000, IMG_MAX_PER_JOB = 8;
const STATUSES = ['queue', 'doing', 'review', 'hold', 'done'];
const COLORS = ['#0B6B70', '#2D5FC4', '#B05A2A', '#7A4BB5', '#2B7F4A', '#B8435F', '#5B6B7A', '#A07A12'];

/* ======================= HTTP ======================= */

function doGet() {
  return json_({ ok: true, app: 'KiwNgan', version: VERSION });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData && e.postData.contents || '{}'); }
  catch (err) { return json_({ ok: false, error: 'คำขอไม่ถูกต้อง' }); }
  try {
    if (PUBLIC[req.action]) return json_({ ok: true, data: PUBLIC[req.action](req.payload || {}) });
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + req.action);
    const user = auth_(req.token);
    return json_({ ok: true, data: fn(req.payload || {}, user) });
  } catch (err) {
    const msg = String(err && err.message || err);
    return json_({ ok: false, error: msg, code: msg.indexOf('AUTH:') === 0 ? 'auth' : undefined });
  }
}

const PUBLIC = {
  ping: () => ({ version: VERSION, app: 'KiwNgan', brand: publicBrand_() }),
  // แอดมินไม่แสดงในรายชื่อหน้าเข้าสู่ระบบ (เข้าทางลิงก์ "ผู้ดูแลระบบ" ด้วยชื่อ + PIN)
  roster: () => ({ users: readAll_('Users').filter(u => u.active && u.role !== 'admin').map(publicUser_), brand: publicBrand_() }),
  login: p => withLock_(() => login_(p.userId, p.pin, p.name))
};

const ACTIONS = {
  me: (p, u) => ({ user: publicUser_(u) }),
  logout: (p, u) => { logout_(u.token); return {}; },
  bootstrap: (p, u) => bootstrap_(u),
  saveJob: (p, u) => withLock_(() => { const r = saveJob_(p.job, u); return { job: maskJob_(r.job, u) }; }),
  deleteJob: (p, u) => withLock_(() => deleteJob_(p.id, u)),
  startTimer: (p, u) => withLock_(() => { const r = startTimer_(p.jobId, u); return { log: maskLog_(r.log, u), job: maskJob_(r.job, u), closed: r.closed.map(l => maskLog_(l, u)) }; }),
  stopTimer: (p, u) => withLock_(() => { const r = stopTimer_(p.logId, u); return Object.assign(r, { log: maskLog_(r.log, u) }); }),
  deleteLog: (p, u) => withLock_(() => deleteLog_(p.logId, u)),
  activity: (p, u) => activityFor_(p.jobId).map(a => maskAct_(a, u)),
  changePin: (p, u) => withLock_(() => changePin_(u, p.oldPin, p.newPin)),
  setPhoto: (p, u) => withLock_(() => setPhoto_(p.userId || u.id, p.photo, u)),
  addImage: (p, u) => withLock_(() => addImage_(p, u)),
  deleteImage: (p, u) => withLock_(() => deleteImage_(p.id, u)),
  thumbs: (p, u) => thumbs_(p.ids),
  image: (p, u) => imageFull_(p.id),
  // admin
  saveSettings: (p, u) => withLock_(() => { admin_(u); return saveSettings_(p.settings, u); }),
  saveUser: (p, u) => withLock_(() => { admin_(u); return saveUser_(p.user, u); }),
  resetPin: (p, u) => withLock_(() => { admin_(u); return resetPin_(p.userId, u); })
};

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ======================= Auth ======================= */

function hash_(salt, pin) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(raw);
}
function validPin_(pin) { return /^\d{4,6}$/.test(String(pin || '')); }
function randomPin_() { return String(Math.floor(1000 + Math.random() * 9000)); }
function publicUser_(u) { return { id: u.id, name: u.name, full: u.full, role: u.role, color: u.color, active: u.active, photo: u.photo || '' }; }

function login_(userId, pin, name) {
  const users = readAll_('Users');
  const u = userId ? users.find(x => x.id === userId) : users.find(x => x.name === String(name || '').trim());
  if (!u || !u.active) throw new Error(name ? 'ชื่อหรือ PIN ไม่ถูกต้อง' : 'ไม่พบผู้ใช้นี้ หรือบัญชีถูกปิดใช้งาน');
  const cache = CacheService.getScriptCache();
  const fk = 'fail_' + u.id;
  const fails = Number(cache.get(fk) || 0);
  if (fails >= MAX_PIN_FAILS) throw new Error('ใส่ PIN ผิดหลายครั้ง ลองใหม่ใน 10 นาที หรือให้แอดมินรีเซ็ต PIN');
  if (!u.pinHash || hash_(u.salt, pin) !== u.pinHash) {
    cache.put(fk, String(fails + 1), 600);
    throw new Error('PIN ไม่ถูกต้อง' + (fails + 1 >= MAX_PIN_FAILS ? ' (ล็อก 10 นาที)' : ' (เหลือ ' + (MAX_PIN_FAILS - fails - 1) + ' ครั้ง)'));
  }
  cache.remove(fk);
  const props = PropertiesService.getScriptProperties();
  cleanSessions_(props);
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  props.setProperty('S_' + token, JSON.stringify({ uid: u.id, exp: Date.now() + SESSION_DAYS * 864e5 }));
  log_('', u.name, 'login', '');
  return { token: token, user: publicUser_(u) };
}

function auth_(token) {
  if (!token) throw new Error('AUTH:กรุณาเข้าสู่ระบบ');
  const raw = PropertiesService.getScriptProperties().getProperty('S_' + token);
  if (!raw) throw new Error('AUTH:หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) { PropertiesService.getScriptProperties().deleteProperty('S_' + token); throw new Error('AUTH:หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); }
  const u = readAll_('Users').find(x => x.id === s.uid);
  if (!u || !u.active) throw new Error('AUTH:บัญชีนี้ถูกปิดใช้งาน');
  u.token = token;
  return u;
}

function logout_(token) { if (token) PropertiesService.getScriptProperties().deleteProperty('S_' + token); }

function cleanSessions_(props) {
  const all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(k => {
    if (k.indexOf('S_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/** ลบ session ทั้งหมดของผู้ใช้คนหนึ่ง (เมื่อรีเซ็ต PIN หรือปิดบัญชี) */
function dropSessionsOf_(uid) {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  Object.keys(all).forEach(k => {
    if (k.indexOf('S_') === 0) { try { if (JSON.parse(all[k]).uid === uid) props.deleteProperty(k); } catch (e) {} }
  });
}

function admin_(u) { if (u.role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น'); }
const isAdmin_ = u => u.role === 'admin';
const ownsJob_ = (u, j) => isAdmin_(u) || j.assignee === u.name || j.createdBy === u.name;

/* ซ่อนชื่อแอดมินจากผู้ใช้งานทั่วไป */
const ADMIN_LABEL = 'ผู้ดูแลระบบ';
let ADMIN_NAMES_ = null;
function adminNames_() {
  if (!ADMIN_NAMES_) ADMIN_NAMES_ = readAll_('Users').filter(x => x.role === 'admin').map(x => x.name);
  return ADMIN_NAMES_;
}
function maskName_(n, viewer) { return !isAdmin_(viewer) && n && adminNames_().indexOf(n) >= 0 ? ADMIN_LABEL : n; }
function maskJob_(j, viewer) {
  if (isAdmin_(viewer) || !j) return j;
  const o = Object.assign({}, j);
  ['assignee', 'createdBy', 'updatedBy'].forEach(k => { o[k] = maskName_(o[k], viewer); });
  return o;
}
function maskLog_(l, viewer) { return isAdmin_(viewer) || !l ? l : Object.assign({}, l, { member: maskName_(l.member, viewer) }); }
function maskAct_(a, viewer) { return isAdmin_(viewer) ? a : Object.assign({}, a, { who: maskName_(a.who, viewer) }); }

/* ======================= Sheet helpers ======================= */

let SS_ = null;
function ss_() {
  if (SS_) return SS_;
  SS_ = SpreadsheetApp.getActiveSpreadsheet();
  if (SS_) return SS_;
  if (!DB_SHEET_ID) throw new Error('สคริปต์นี้ไม่ได้ผูกกับชีต ใส่ ID ของชีตฐานข้อมูลในตัวแปร DB_SHEET_ID');
  return (SS_ = SpreadsheetApp.openById(DB_SHEET_ID));
}
function tz_() { return ss_().getSpreadsheetTimeZone() || 'Asia/Bangkok'; }
function nowIso_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ss"); }
function uid_(p) { return (p || '') + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

function sheet_(name) {
  let sh = ss_().getSheetByName(name);
  const head = SHEETS[name];
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#E6EEF0');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); // เก็บเป็นข้อความทั้งหมด
    if (name === 'Users') sh.hideColumns(head.indexOf('pinHash') + 1, 2);
  } else if (sh.getLastColumn() < head.length) {
    // เพิ่มคอลัมน์ใหม่ที่เวอร์ชันใหม่ต้องใช้ (ตามลำดับชื่อหัวตาราง)
    const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (cur.join('|') !== head.slice(0, cur.length).join('|')) throw new Error('หัวตารางในชีต ' + name + ' ไม่ตรงกับระบบ');
    sh.getRange(1, cur.length + 1, 1, head.length - cur.length).setValues([head.slice(cur.length)]).setFontWeight('bold').setBackground('#E6EEF0');
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
  if (name === 'Users') o.active = !(o.active === 'FALSE' || o.active === 'false');
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

function readRow_(name, row) {
  const head = SHEETS[name];
  return toObj_(name, head, sheet_(name).getRange(row, 1, 1, head.length).getDisplayValues()[0]);
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

function settings_() {
  const raw = getSetting_('config');
  const s = raw ? JSON.parse(raw) : defaultSettings_();
  delete s.members;
  return s;
}

function publicBrand_() {
  const s = settings_();
  return { company: s.company, appName: s.appName, accent: s.accent, logo: s.logo };
}

function saveSettings_(settings, u) {
  if (!settings || typeof settings !== 'object') throw new Error('ข้อมูลตั้งค่าไม่ถูกต้อง');
  delete settings.members; delete settings.teamKey;
  setSetting_('config', JSON.stringify(settings));
  log_('', u.name, 'settings', 'แก้ไขการตั้งค่า');
  return { settings: settings };
}

function defaultSettings_() {
  return {
    company: 'บริษัทของคุณ', appName: 'KiwNgan คิวงาน', accent: '#0B6B70', logo: '',
    sales: [],
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

/* ======================= Users ======================= */

function saveUser_(data, admin) {
  if (!data || !String(data.name || '').trim()) throw new Error('กรุณาใส่ชื่อ');
  const users = readAll_('Users');
  const name = String(data.name).trim();
  if (users.some(x => x.name === name && x.id !== data.id)) throw new Error('มีชื่อ ' + name + ' อยู่แล้ว');
  let row = data.id ? rowOf_('Users', data.id) : -1;
  let u, pin = '';
  if (row > 0) {
    u = readRow_('Users', row);
    const oldName = u.name;
    if (u.id === admin.id && (data.role && data.role !== 'admin')) throw new Error('ลดสิทธิ์ตัวเองไม่ได้ ให้แอดมินคนอื่นทำแทน');
    if (u.id === admin.id && data.active === false) throw new Error('ปิดบัญชีตัวเองไม่ได้');
    if (data.role === 'user' && u.role === 'admin' && users.filter(x => x.role === 'admin' && x.active).length <= 1) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
    Object.assign(u, { name: name, full: String(data.full || ''), role: data.role === 'admin' ? 'admin' : 'user', color: data.color || u.color, active: data.active !== false });
    writeRow_('Users', u, row);
    if (!u.active) dropSessionsOf_(u.id);
    if (oldName !== name) renameMember_(oldName, name);
    log_('', admin.name, 'user', 'แก้ไขผู้ใช้ ' + name);
  } else {
    pin = validPin_(data.pin) ? String(data.pin) : randomPin_();
    const salt = Utilities.getUuid();
    u = { id: uid_('u_'), name: name, full: String(data.full || ''), role: data.role === 'admin' ? 'admin' : 'user',
          color: data.color || COLORS[users.length % COLORS.length], active: true, pinHash: hash_(salt, pin), salt: salt, createdAt: nowIso_() };
    writeRow_('Users', u, -1);
    log_('', admin.name, 'user', 'เพิ่มผู้ใช้ ' + name);
  }
  return { user: publicUser_(u), pin: pin };
}

function renameMember_(oldName, newName) {
  [['Jobs', ['assignee', 'createdBy', 'updatedBy']], ['TimeLogs', ['member']]].forEach(([name, cols]) => {
    const sh = sheet_(name), head = SHEETS[name], last = sh.getLastRow();
    if (last < 2) return;
    cols.forEach(c => {
      const col = head.indexOf(c) + 1;
      const rng = sh.getRange(2, col, last - 1, 1), vals = rng.getValues();
      let changed = false;
      vals.forEach(r => { if (r[0] === oldName) { r[0] = newName; changed = true; } });
      if (changed) rng.setValues(vals);
    });
  });
}

function resetPin_(userId, admin) {
  const row = rowOf_('Users', userId);
  if (row < 0) throw new Error('ไม่พบผู้ใช้');
  const u = readRow_('Users', row);
  const pin = randomPin_();
  u.salt = Utilities.getUuid(); u.pinHash = hash_(u.salt, pin);
  writeRow_('Users', u, row);
  dropSessionsOf_(u.id);
  CacheService.getScriptCache().remove('fail_' + u.id);
  log_('', admin.name, 'user', 'รีเซ็ต PIN ของ ' + u.name);
  return { userId: u.id, pin: pin };
}

/** รูปโปรไฟล์: data URL ขนาดเล็ก (ย่อจากหน้าเว็บแล้ว) ผู้ใช้เปลี่ยนรูปตัวเองได้ แอดมินเปลี่ยนให้ทุกคนได้ */
function setPhoto_(userId, photo, u) {
  if (userId !== u.id && !isAdmin_(u)) throw new Error('เปลี่ยนได้เฉพาะรูปของตัวเอง');
  photo = String(photo || '');
  if (photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(photo)) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (photo.length > 45000) throw new Error('รูปใหญ่เกินไป');
  const row = rowOf_('Users', userId);
  if (row < 0) throw new Error('ไม่พบผู้ใช้');
  const target = readRow_('Users', row);
  target.photo = photo;
  writeRow_('Users', target, row);
  log_('', u.name, 'user', (photo ? 'เปลี่ยนรูป ' : 'ลบรูป ') + target.name);
  return { user: publicUser_(target) };
}

function changePin_(u, oldPin, newPin) {
  if (!validPin_(newPin)) throw new Error('PIN ใหม่ต้องเป็นตัวเลข 4–6 หลัก');
  if (hash_(u.salt, oldPin) !== u.pinHash) throw new Error('PIN เดิมไม่ถูกต้อง');
  const row = rowOf_('Users', u.id);
  const fresh = readRow_('Users', row);
  fresh.salt = Utilities.getUuid(); fresh.pinHash = hash_(fresh.salt, newPin);
  writeRow_('Users', fresh, row);
  log_('', u.name, 'user', 'เปลี่ยน PIN');
  return {};
}

/* ======================= Jobs ======================= */

function bootstrap_(u) {
  const cutoff = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), tz_(), 'yyyy-MM-dd');
  const logs = readAll_('TimeLogs').filter(l => !l.end || l.start >= cutoff);
  return {
    settings: settings_(),
    users: readAll_('Users').filter(x => isAdmin_(u) || x.role !== 'admin').map(publicUser_),
    jobs: readAll_('Jobs').map(j => maskJob_(j, u)), logs: logs.map(l => maskLog_(l, u)),
    images: imageMeta_().map(m => Object.assign(m, { createdBy: maskName_(m.createdBy, u) })),
    me: publicUser_(u), serverTime: nowIso_(), version: VERSION
  };
}

function cleanJob_(j) {
  const out = {};
  SHEETS.Jobs.forEach(h => { if (j[h] !== undefined) out[h] = j[h]; });
  ['minutes', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'].forEach(k => delete out[k]); // ค่าที่ server เป็นคนกำหนด
  if (out.status && STATUSES.indexOf(out.status) < 0) out.status = 'queue';
  if (out.priority && ['normal', 'urgent'].indexOf(out.priority) < 0) out.priority = 'normal';
  return out;
}

function saveJob_(job, u) {
  if (!job || !String(job.code || '').trim()) throw new Error('กรุณาใส่เลข Job');
  const data = cleanJob_(job);
  data.code = String(data.code).trim();
  const now = nowIso_();
  const row = data.id ? rowOf_('Jobs', data.id) : -1;
  let before = null;

  if (row > 0) {
    before = readRow_('Jobs', row);
    if (!ownsJob_(u, before)) throw new Error('แก้ไขได้เฉพาะงานของตัวเอง งานนี้เป็นของ ' + (before.assignee || 'คนอื่น'));
    if (!isAdmin_(u) && data.assignee !== undefined && data.assignee !== before.assignee && data.assignee !== u.name) {
      throw new Error('มอบหมายงานให้คนอื่นได้เฉพาะแอดมิน');
    }
    if (job.baseUpdatedAt && before.updatedAt && job.baseUpdatedAt !== before.updatedAt) {
      throw new Error('งานนี้ถูกแก้โดย ' + (before.updatedBy || 'คนอื่น') + ' เมื่อสักครู่ กดรีเฟรชแล้วลองอีกครั้ง');
    }
  } else {
    if (readAll_('Jobs').some(x => x.code.toLowerCase() === data.code.toLowerCase())) throw new Error('มีเลข Job ' + data.code + ' อยู่แล้ว');
    data.id = uid_('j_');
    data.createdAt = now;
    data.createdBy = u.name;
    if (!isAdmin_(u)) data.assignee = u.name; // ผู้ใช้ทั่วไปลงงานให้ตัวเอง
  }

  const merged = Object.assign({}, before || { minutes: 0 }, data, { updatedAt: now, updatedBy: u.name });
  if (merged.status === 'done' && !merged.finishedAt) merged.finishedAt = now.slice(0, 16);
  if (merged.status !== 'done') merged.finishedAt = '';
  if ((merged.status === 'doing' || merged.status === 'review') && !merged.startedAt) merged.startedAt = now.slice(0, 16);
  writeRow_('Jobs', merged, row);

  if (!before) log_(merged.id, u.name, 'create', merged.code);
  else if (before.status !== merged.status) log_(merged.id, u.name, 'status', before.status + '→' + merged.status);
  else log_(merged.id, u.name, 'edit', diffText_(before, merged));
  return { job: toObj_('Jobs', SHEETS.Jobs, SHEETS.Jobs.map(h => merged[h] === undefined ? '' : String(merged[h]))) };
}

function diffText_(a, b) {
  const skip = ['updatedAt', 'updatedBy', 'minutes'];
  return SHEETS.Jobs.filter(h => skip.indexOf(h) < 0 && String(a[h] || '') !== String(b[h] || '')).join(', ');
}

function deleteJob_(id, u) {
  const row = rowOf_('Jobs', id);
  if (row < 0) throw new Error('ไม่พบงานนี้');
  const job = readRow_('Jobs', row);
  if (!isAdmin_(u) && job.createdBy !== u.name) throw new Error('ลบได้เฉพาะงานที่ตัวเองสร้าง หรือให้แอดมินลบ');
  sheet_('Jobs').deleteRow(row);
  // ลบเวลาทำงานของงานนี้
  const sh = sheet_('TimeLogs'), last = sh.getLastRow();
  if (last >= 2) {
    const ids = sh.getRange(2, 2, last - 1, 1).getDisplayValues();
    for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === id) sh.deleteRow(i + 2);
  }
  // ลบรูปของงานนี้
  const ish = sheet_('Images'), ilast = ish.getLastRow();
  if (ilast >= 2) {
    const jids = ish.getRange(2, 2, ilast - 1, 1).getDisplayValues();
    for (let i = jids.length - 1; i >= 0; i--) if (jids[i][0] === id) ish.deleteRow(i + 2);
  }
  log_(id, u.name, 'delete', job.code);
  return { id: id };
}

/* ---------- รูปงาน (เก็บในชีต Images แบ่งเป็นช่วง ๆ เพราะ 1 ช่องเก็บได้ไม่เกิน 50,000 ตัวอักษร) ---------- */
const IMG_RE_ = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
function imageMeta_() {
  const sh = sheet_('Images'), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getDisplayValues().filter(r => r[0]).map(r => ({ id: r[0], jobId: r[1], createdBy: r[2], createdAt: r[3] }));
}
function addImage_(p, u) {
  const jr = rowOf_('Jobs', p.jobId);
  if (jr < 0) throw new Error('ไม่พบงานนี้');
  const job = readRow_('Jobs', jr);
  if (!ownsJob_(u, job)) throw new Error('เพิ่มรูปได้เฉพาะงานของตัวเอง');
  const thumb = String(p.thumb || ''), full = String(p.full || '');
  if (!IMG_RE_.test(thumb) || !IMG_RE_.test(full)) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (thumb.length > IMG_CELL) throw new Error('รูปย่อใหญ่เกินไป');
  if (full.length > IMG_CELL * IMG_PARTS) throw new Error('รูปใหญ่เกินไป');
  if (imageMeta_().filter(m => m.jobId === p.jobId).length >= IMG_MAX_PER_JOB) throw new Error('ใส่รูปได้สูงสุด ' + IMG_MAX_PER_JOB + ' รูปต่องาน');
  const img = { id: uid_('i_'), jobId: p.jobId, createdBy: u.name, createdAt: nowIso_(), thumb: thumb };
  for (let i = 0; i < IMG_PARTS; i++) img['f' + i] = full.slice(i * IMG_CELL, (i + 1) * IMG_CELL);
  writeRow_('Images', img, -1);
  log_(p.jobId, u.name, 'image', 'เพิ่มรูป');
  return { image: { id: img.id, jobId: img.jobId, createdBy: maskName_(img.createdBy, u), createdAt: img.createdAt, thumb: thumb } };
}
function deleteImage_(id, u) {
  const row = rowOf_('Images', id);
  if (row < 0) throw new Error('ไม่พบรูปนี้');
  const meta = sheet_('Images').getRange(row, 1, 1, 4).getDisplayValues()[0];
  const jr = rowOf_('Jobs', meta[1]), job = jr > 0 ? readRow_('Jobs', jr) : null;
  if (!isAdmin_(u) && meta[2] !== u.name && !(job && ownsJob_(u, job))) throw new Error('ลบได้เฉพาะรูปของงานตัวเอง');
  sheet_('Images').deleteRow(row);
  log_(meta[1], u.name, 'image', 'ลบรูป');
  return { id: id, jobId: meta[1] };
}
function thumbs_(ids) {
  ids = (ids || []).slice(0, 60).map(String);
  const sh = sheet_('Images'), last = sh.getLastRow(), out = {};
  if (last < 2 || !ids.length) return { thumbs: out };
  const all = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  all.forEach((r, i) => { if (ids.indexOf(r[0]) >= 0) out[r[0]] = sh.getRange(i + 2, 5).getDisplayValue(); });
  return { thumbs: out };
}
function imageFull_(id) {
  const row = rowOf_('Images', id);
  if (row < 0) throw new Error('ไม่พบรูปนี้');
  const parts = sheet_('Images').getRange(row, 6, 1, IMG_PARTS).getDisplayValues()[0];
  return { id: id, full: parts.join('') };
}

function recalcMinutes_(jobId) {
  const total = readAll_('TimeLogs').filter(l => l.jobId === jobId && l.end).reduce((s, l) => s + (l.minutes || 0), 0);
  const row = rowOf_('Jobs', jobId);
  if (row > 0) sheet_('Jobs').getRange(row, SHEETS.Jobs.indexOf('minutes') + 1).setValue(String(total));
  return total;
}

function startTimer_(jobId, u) {
  const row = rowOf_('Jobs', jobId);
  if (row < 0) throw new Error('ไม่พบงานนี้');
  const job = readRow_('Jobs', row);
  if (!ownsJob_(u, job)) throw new Error('จับเวลาได้เฉพาะงานของตัวเอง');
  // คนหนึ่งจับเวลาได้ทีละงาน — ปิดตัวที่ค้างก่อน
  const closed = readAll_('TimeLogs').filter(l => !l.end && l.member === u.name).map(l => stopIn_(l.id, u).log);
  const log = { id: uid_('t_'), jobId: jobId, member: u.name, start: nowIso_().slice(0, 16), end: '', minutes: 0 };
  writeRow_('TimeLogs', log, -1);
  const fresh = readRow_('Jobs', row);
  if (fresh.status === 'queue' || fresh.status === 'hold') {
    log_(jobId, u.name, 'status', fresh.status + '→doing');
    fresh.status = 'doing';
    if (!fresh.startedAt) fresh.startedAt = log.start;
    fresh.updatedAt = nowIso_(); fresh.updatedBy = u.name;
    writeRow_('Jobs', fresh, row);
  }
  log_(jobId, u.name, 'timer', 'เริ่มจับเวลา');
  return { log: log, job: fresh, closed: closed };
}

function stopTimer_(logId, u) {
  const row = rowOf_('TimeLogs', logId);
  if (row < 0) throw new Error('ไม่พบรายการจับเวลา');
  const log = readRow_('TimeLogs', row);
  if (!isAdmin_(u) && log.member !== u.name) throw new Error('หยุดได้เฉพาะการจับเวลาของตัวเอง');
  return stopIn_(logId, u);
}

function stopIn_(logId, u) {
  const row = rowOf_('TimeLogs', logId);
  const log = readRow_('TimeLogs', row);
  if (!log.end) {
    log.end = nowIso_().slice(0, 16);
    log.minutes = Math.max(0, Math.round((parseLocal_(log.end) - parseLocal_(log.start)) / 60000));
    writeRow_('TimeLogs', log, row);
    log_(log.jobId, u.name, 'timer', 'หยุดจับเวลา ' + log.minutes + ' นาที');
  }
  return { log: log, jobId: log.jobId, minutes: recalcMinutes_(log.jobId) };
}

function deleteLog_(logId, u) {
  const row = rowOf_('TimeLogs', logId);
  if (row < 0) throw new Error('ไม่พบรายการจับเวลา');
  const log = readRow_('TimeLogs', row);
  if (!isAdmin_(u) && log.member !== u.name) throw new Error('ลบได้เฉพาะเวลาของตัวเอง');
  sheet_('TimeLogs').deleteRow(row);
  log_(log.jobId, u.name, 'timer', 'ลบรายการเวลา');
  return { logId: logId, jobId: log.jobId, minutes: recalcMinutes_(log.jobId) };
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
  ['Sheet1', 'แผ่นที่1', 'ชีต1'].forEach(n => {
    const def = ss_().getSheetByName(n);
    if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  });
  if (!getSetting_('config')) setSetting_('config', JSON.stringify(defaultSettings_()));
  const users = readAll_('Users');
  if (!users.some(u => u.role === 'admin')) {
    const pin = randomPin_(), salt = Utilities.getUuid();
    writeRow_('Users', { id: uid_('u_'), name: 'แอดมิน', full: '', role: 'admin', color: COLORS[0], active: true,
      pinHash: hash_(salt, pin), salt: salt, createdAt: nowIso_() }, -1);
    Logger.log('สร้างบัญชีแอดมินแล้ว  ชื่อ: แอดมิน  PIN: ' + pin + '  (เปลี่ยนชื่อและ PIN ได้ในหน้าตั้งค่า)');
    return pin;
  }
  Logger.log('ระบบพร้อมใช้งานแล้ว');
}

/** ใช้เมื่อแอดมินลืม PIN: เรียกจาก Apps Script แล้วดู PIN ใหม่ในบันทึกการดำเนินการ */
function resetAdminPin() {
  const admin = readAll_('Users').find(u => u.role === 'admin' && u.active);
  if (!admin) return setup();
  const r = resetPin_(admin.id, { name: 'script' });
  Logger.log('PIN ใหม่ของ ' + admin.name + ': ' + r.pin);
}

/** ออกจากระบบทุกเครื่อง */
function logoutEveryone() {
  const props = PropertiesService.getScriptProperties(), all = props.getProperties();
  Object.keys(all).forEach(k => { if (k.indexOf('S_') === 0) props.deleteProperty(k); });
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
    existing[code] = true;
    const done = v[i][17] === true;
    const sD = fd(v[i][7]), eD = fd(v[i][8]), sT = ft(d[i][9]), eT = ft(d[i][10]);
    const doneDate = fd(v[i][18]);
    const note = String(d[i][16]).trim();
    const assignee = nick(d[i][14]);
    const job = {
      id: uid_('j_'), code: code, title: '', group: String(d[i][12]).trim(), taskType: String(d[i][15]).trim(), qty: 'single',
      level: v[i][13] === '' ? '' : Number(v[i][13]), assignee: assignee, sale: String(d[i][11]).replace(/-\s*$/, '').trim(),
      priority: v[i][20] === true ? 'urgent' : 'normal', revision: /แก้ไข/.test(note) || /_re\d*/i.test(code),
      status: done ? 'done' : (sD ? 'doing' : 'queue'), received: fd(v[i][4]), due: fd(v[i][5]),
      startedAt: sD ? sD + 'T' + (sT || '08:00') : '', finishedAt: done ? (doneDate || eD || sD) + 'T' + (eT || '17:00') : '',
      minutes: 0, note: note, createdAt: now, createdBy: assignee, updatedAt: now, updatedBy: 'import'
    };
    if (sD && eD && sD === eD && sT && eT) {
      const start = sD + 'T' + sT, end = eD + 'T' + eT;
      const mins = Math.round((parseLocal_(end) - parseLocal_(start)) / 60000);
      if (mins > 0 && mins < 720) {
        writeRow_('TimeLogs', { id: uid_('t_'), jobId: job.id, member: assignee, start: start, end: end, minutes: mins }, -1);
        job.minutes = mins;
      }
    }
    writeRow_('Jobs', job, -1);
    added++;
    if (assignee) members[assignee] = String(d[i][14]).split('-')[1] || '';
    if (job.sale) sales[job.sale] = 1;
    if (job.group) groups[job.group] = 1;
    if (job.taskType) types[job.taskType] = 1;
  }

  // ทีมงานจากชีตเดิม (รวมชีต "ทีมงาน" ด้วย)
  const teamSh = old.getSheetByName('ทีมงาน');
  if (teamSh && teamSh.getLastRow() > 1) {
    teamSh.getRange(2, 2, teamSh.getLastRow() - 1, 2).getDisplayValues().forEach(r => { if (r[0]) members[r[0].trim()] = r[1].trim(); });
  }
  const saleSh = old.getSheetByName('sale');
  if (saleSh && saleSh.getLastRow() > 1) {
    saleSh.getRange(2, 2, saleSh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { if (r[0]) sales[r[0].trim()] = 1; });
  }

  const users = readAll_('Users');
  const pins = [];
  Object.keys(members).forEach(name => {
    if (users.some(u => u.name === name)) return;
    const pin = randomPin_(), salt = Utilities.getUuid();
    writeRow_('Users', { id: uid_('u_'), name: name, full: members[name], role: 'user', color: COLORS[(users.length + pins.length) % COLORS.length],
      active: true, pinHash: hash_(salt, pin), salt: salt, createdAt: now }, -1);
    pins.push(name + ' = ' + pin);
  });

  const s = settings_();
  Object.keys(sales).forEach(x => { if (s.sales.indexOf(x) < 0) s.sales.push(x); });
  Object.keys(groups).forEach(x => { if (s.groups.indexOf(x) < 0) s.groups.push(x); });
  Object.keys(types).forEach(x => { if (!s.taskTypes.some(t => t.name === x)) s.taskTypes.push({ name: x, cat: /CAM$/.test(x) ? 'cam' : 'draw' }); });
  if (s.groups.indexOf('งาน Walltiria') >= 0 && !s.sla['งาน Walltiria']) s.sla['งาน Walltiria'] = { cam: [1, 2], draw: [2, 3] };
  setSetting_('config', JSON.stringify(s));
  log_('', 'import', 'import', 'นำเข้า ' + added + ' งานจากชีตเดิม');
  Logger.log('นำเข้าเสร็จ ' + added + ' งาน');
  if (pins.length) Logger.log('PIN เริ่มต้นของทีมงาน (แจ้งแต่ละคน แล้วให้เปลี่ยนเองในหน้าตั้งค่า):\n' + pins.join('\n'));
  return added;
}
