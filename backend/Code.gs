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

const VERSION = '1.31.0';
const OLD_SHEET_ID = ''; // ID ของชีต "ตารางงานแบบ Jobshop" เดิม (ใช้กับ importJobshop เท่านั้น)
const DB_SHEET_ID = '';  // ใช้เมื่อสร้างสคริปต์แยกจากชีต (standalone): ID ของชีตฐานข้อมูล
// เรียลไทม์ (ไม่บังคับ): Supabase โปรเจกต์ฟรี — URL และ publishable/anon key (เป็นค่าสาธารณะ) เว้นว่าง = ใช้ Apps Script อย่างเดียว
const RT_URL = '';
const RT_KEY = '';
const ARCHIVE_MONTHS = 12;   // งานที่เสร็จนานกว่านี้ย้ายไปไฟล์เก็บถาวร (ทุกวันที่ 1)
const BACKUP_DAYS = 30;      // เก็บไฟล์สำรองย้อนหลังกี่วัน
const SESSION_DAYS = 30;
const MAX_PIN_FAILS = 5;

const SHEETS = {
  Jobs: ['id', 'code', 'title', 'group', 'taskType', 'qty', 'level', 'assignee', 'sale', 'priority', 'revision',
         'status', 'received', 'due', 'startedAt', 'finishedAt', 'minutes', 'note', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'helpers', 'checklist'],
  TimeLogs: ['id', 'jobId', 'member', 'start', 'end', 'minutes'],
  Activity: ['ts', 'jobId', 'who', 'action', 'detail'],
  Users: ['id', 'name', 'full', 'role', 'color', 'active', 'pinHash', 'salt', 'createdAt', 'photo', 'perms'],   // perms ว่าง = ใช้สิทธิ์เริ่มต้นของตำแหน่ง
  Settings: ['key', 'value'],
  Messages: ['id', 'ts', 'from', 'fromRole', 'to', 'kind', 'text', 'jobId', 'status', 'helper', 'readBy', 'img'],
  Images: ['id', 'jobId', 'createdBy', 'createdAt', 'thumb', 'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'fileId'],
  Files: ['id', 'jobId', 'name', 'mime', 'size', 'fileId', 'createdBy', 'createdAt'],
  Comments: ['id', 'jobId', 'ts', 'from', 'text'],
  // ฝ่ายผลิต: 1 แถว = 1 เลข Job ที่ออกแบบเสร็จแล้ว เดินต่อ รอผลิต → ลงเครื่อง → ทำสี → ประกอบติดตั้ง → แพ็ค → พร้อมส่ง → ส่งแล้ว (paint/assy = 'no' คือข้ามขั้นนั้น)
  Prod: ['id', 'code', 'title', 'sale', 'group', 'stage', 'machines', 'paint', 'note', 'enteredAt', 'startedAt', 'finishedAt', 'shippedAt', 'createdBy', 'updatedAt', 'updatedBy', 'history', 'assy', 'due', 'qc'],
  // คลังวัสดุ (ฝ่ายสต็อก): 1 แถว = 1 รายการวัสดุ · StockLog = ประวัติรับเข้า/เบิกออก/ปรับยอด
  Stock: ['id', 'name', 'cat', 'unit', 'qty', 'min', 'loc', 'note', 'updatedAt', 'updatedBy'],
  StockLog: ['id', 'ts', 'itemId', 'kind', 'qty', 'bal', 'job', 'who', 'note']
};
const FILE_MAX_MB = 30;
const IMG_PARTS = 8, IMG_CELL = 45000, IMG_MAX_PER_JOB = 8;
const STATUSES = ['queue', 'doing', 'review', 'fix', 'hold', 'done'];
const PROD_STAGES = ['wait', 'machine', 'paint', 'assemble', 'qc', 'pack', 'ready', 'shipped'];   // qc = ตรวจคุณภาพก่อนแพ็ค (ข้ามไม่ได้)
const PROD_SKIP_ = { paint: 'paint', assemble: 'assy' };   // ขั้นที่ข้ามได้ → ชื่อคอลัมน์ธง
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
    if (PUBLIC[req.action]) return reply_(req, { ok: true, data: PUBLIC[req.action](req.payload || {}) });
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + req.action);
    const user = auth_(req.token);
    const data = fn(req.payload || {}, user);
    if (DATA_ACTIONS_[req.action]) bump_('data');
    if (MSG_ACTIONS_[req.action]) bump_('msg');
    return reply_(req, { ok: true, data: data });
  } catch (err) {
    const msg = String(err && err.message || err);
    return reply_(req, { ok: false, error: msg, code: msg.indexOf('AUTH:') === 0 ? 'auth' : undefined });
  }
}

/** ตอบกลับ 2 ทาง: ทาง HTTP ปกติ + ส่งตรงถึงเครื่องที่ขอผ่าน Supabase Realtime (ถ้าเครื่องนั้นเปิด "กล่องรับ" ไว้)
 *  เหตุผล: ประตู googleusercontent ของ Google ชอบค้าง 5–30 วิ ทั้งที่โค้ดเราทำเสร็จใน ~1 วิ
 *  ชื่อกล่องรับสุ่ม 24 ตัว (เดาไม่ได้) และใช้ครั้งต่อการเปิดแอปหนึ่งครั้ง */
function reply_(req, obj) {
  const text = JSON.stringify(obj);
  if (req && req.ri && req.rid && RT_URL && RT_KEY && /^kn-i-[a-z0-9]{16,40}$/.test(String(req.ri))) {
    try { rtReply_(String(req.ri), String(req.rid).slice(0, 40), text); } catch (e) {}
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function rtReply_(topic, rid, text) {
  const size = 60000, n = Math.max(1, Math.ceil(text.length / size)), reqs = [];
  if (n > 40) return;   // ใหญ่มากผิดปกติ ใช้ทาง HTTP อย่างเดียว
  for (let i = 0; i < n; i++) {
    reqs.push({
      url: RT_URL + '/realtime/v1/api/broadcast', method: 'post', contentType: 'application/json',
      headers: { apikey: RT_KEY }, muteHttpExceptions: true,
      payload: JSON.stringify({ messages: [{ topic: topic, event: 'r', payload: { rid: rid, i: i, n: n, d: text.slice(i * size, (i + 1) * size) } }] })
    });
  }
  if (reqs.length === 1) UrlFetchApp.fetch(reqs[0].url, reqs[0]); else UrlFetchApp.fetchAll(reqs);
}

const PUBLIC = {
  ping: () => ({ version: VERSION, app: 'KiwNgan', brand: publicBrand_() }),
  // แอดมินไม่แสดงในรายชื่อหน้าเข้าสู่ระบบ (เข้าทางลิงก์ "ผู้ดูแลระบบ" ด้วยชื่อ + PIN)
  roster: () => ({ users: readAll_('Users').filter(u => u.active && u.role !== 'admin').map(publicUser_), brand: publicBrand_(), sale: !!PropertiesService.getScriptProperties().getProperty('SALE_PIN'), rt: RT_URL && RT_KEY ? { url: RT_URL, key: RT_KEY } : null }),
  // ไม่ล็อก: เข้าสู่ระบบแค่เขียน Script Property 1 ค่า · ส่งข้อมูลเริ่มต้นกลับไปด้วยเลย ไม่ต้องเรียก bootstrap อีกรอบ
  login: p => login_(p.userId, p.pin, p.name),
  // ลิงก์ให้ Sale ดูสถานะงาน (อ่านอย่างเดียว ไม่ต้องเข้าสู่ระบบ) — ต้องมีกุญแจที่แอดมินสร้าง
  saleView: p => saleView_(p.k, p.sale),
  // ปุ่ม Sale ที่หน้าเข้าสู่ระบบ: ใส่ PIN ของ Sale (แอดมินตั้งไว้) แล้วได้กุญแจเปิดหน้าสถานะงาน
  saleOpen: p => saleOpen_(p.pin)
};

const ACTIONS = {
  me: (p, u) => ({ user: publicUser_(readAll_('Users').find(x => x.id === u.id) || u) }),
  logout: (p, u) => { logout_(u.token); return {}; },
  bootstrap: (p, u) => bootstrap_(u, p.stamp),
  saveJob: (p, u) => withLock_(() => { const r = saveJob_(p.job, u); return { job: maskJob_(r.job, u) }; }),
  deleteJob: (p, u) => withLock_(() => deleteJob_(p.id, u)),
  startTimer: (p, u) => withLock_(() => { const r = startTimer_(p.jobId, u); return { log: maskLog_(r.log, u), job: maskJob_(r.job, u), closed: r.closed.map(l => maskLog_(l, u)) }; }),
  stopTimer: (p, u) => withLock_(() => { const r = stopTimer_(p.logId, u); return Object.assign(r, { log: maskLog_(r.log, u) }); }),
  deleteLog: (p, u) => withLock_(() => deleteLog_(p.logId, u)),
  activity: (p, u) => activityFor_(p.jobId).map(a => maskAct_(a, u)),
  changePin: (p, u) => withLock_(() => changePin_(u, p.oldPin, p.newPin)),
  setPhoto: (p, u) => withLock_(() => setPhoto_(p.userId || u.id, p.photo, u)),
  addImage: (p, u) => withLock_(() => addImage_(p, u)),
  messages: (p, u) => messages_(u, p.since, p.stamp),
  sendMessage: (p, u) => withLock_(() => sendMessage_(p, u)),
  markRead: (p, u) => withLock_(() => markRead_(p.ids, u)),
  helpUpdate: (p, u) => withLock_(() => helpUpdate_(p.id, p.status, u)),
  deleteMessages: (p, u) => withLock_(() => { admin_(u); return deleteMessages_(p.ids, u); }),
  rtcSend: (p, u) => { const r = withLock_(() => rtcSend_(p, u)); if (!r.dup) pushForSignal_(p, u); return r; },
  pushKey: () => ({ key: vapid_().pub }),
  pushSub: (p, u) => withLock_(() => pushSub_(p.sub, u)),
  pushUnsub: (p, u) => withLock_(() => pushUnsub_(p.endpoint, u)),
  pushInfo: (p, u) => ({ info: pushInfo_(u) }),
  rtcPoll: (p, u) => Object.assign(rtcPoll_(u, p.wait, p.ack), { room: roomView_(roomGet_(), u), ds: stamp_('data'), ms: stamp_('msg') }),
  room: (p, u) => room_(p, u),
  deleteImage: (p, u) => withLock_(() => deleteImage_(p.id, u)),
  copyImages: (p, u) => withLock_(() => copyImages_(p.from, p.to, u)),
  archive: (p, u) => archiveRead_(u),
  thumbs: (p, u) => thumbs_(p.ids),
  addFile: (p, u) => { const r = addFile_(p, u); bump_('data'); return r; },   // อัปโหลดไฟล์ใหญ่: ไม่ล็อกระหว่างเขียน Drive
  deleteFile: (p, u) => withLock_(() => deleteFile_(p.id, u)),
  comments: (p, u) => ({ comments: commentsOf_(p.jobId).map(c => Object.assign(c, { from: maskName_(c.from, u) })) }),
  addComment: (p, u) => withLock_(() => addComment_(p, u)),
  deleteComment: (p, u) => withLock_(() => deleteComment_(p.id, u)),
  saleLink: (p, u) => { admin_(u); return { key: saleKey_(!!p.reset) }; },
  salePin: (p, u) => withLock_(() => { admin_(u); return salePin_(p.pin); }),
  prodSave: (p, u) => withLock_(() => ({ prod: maskProd_(prodSave_(p.prod, u), u) })),
  prodDelete: (p, u) => withLock_(() => prodDelete_(p.id, u)),
  // คลังวัสดุ (ฝ่ายสต็อก)
  stockSave: (p, u) => withLock_(() => stockSave_(p.item, u)),
  stockMove: (p, u) => withLock_(() => stockMove_(p, u)),
  stockDelete: (p, u) => withLock_(() => stockDelete_(p.id, u)),
  image: (p, u) => imageFull_(p.id),
  // admin
  saveSettings: (p, u) => withLock_(() => { admin_(u); return saveSettings_(p.settings, u); }),
  saveUser: (p, u) => withLock_(() => { admin_(u); return saveUser_(p.user, u); }),
  deleteUser: (p, u) => withLock_(() => { admin_(u); return deleteUser_(p.userId, u); }),
  resetPin: (p, u) => withLock_(() => { admin_(u); return resetPin_(p.userId, u, p.pin); })
};

/* ===== ความเร็ว: ตัวบอกเวอร์ชันข้อมูล (stamp) ใน cache
   หน้าเว็บส่ง stamp ล่าสุดมาด้วย ถ้าไม่มีอะไรเปลี่ยนจะตอบกลับทันทีโดยไม่ต้องอ่านชีต ===== */
const DATA_ACTIONS_ = { stockSave: 1, stockMove: 1, stockDelete: 1, deleteFile: 1, addComment: 1, deleteComment: 1, copyImages: 1, saveJob: 1, deleteJob: 1, prodSave: 1, prodDelete: 1, startTimer: 1, stopTimer: 1, deleteLog: 1, setPhoto: 1, addImage: 1, deleteImage: 1, saveSettings: 1, saveUser: 1, deleteUser: 1, resetPin: 1 };
const MSG_ACTIONS_ = { sendMessage: 1, markRead: 1, helpUpdate: 1, deleteMessages: 1 };
function stamp_(kind) {
  const c = CacheService.getScriptCache(), k = 'stamp:' + kind;
  let v = c.get(k);
  if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); c.put(k, v, 21600); }
  return v;
}
function bump_(kind) { try { CacheService.getScriptCache().put('stamp:' + kind, Date.now().toString(36) + Math.random().toString(36).slice(2, 6), 21600); } catch (e) {} }
/* ผู้ใช้แบบย่อ (ไม่มีรูป/รหัส) เก็บใน cache — ทุกคำขอต้องตรวจผู้ใช้ จึงไม่ต้องอ่านชีต Users ทุกครั้ง */
function usersLite_() {
  const c = CacheService.getScriptCache();
  try { const hit = c.get('users:lite'); if (hit) return JSON.parse(hit); } catch (e) {}
  const list = readAll_('Users').map(u => ({ id: u.id, name: u.name, full: u.full, role: u.role, color: u.color, active: u.active, perms: u.perms || '' }));
  try { c.put('users:lite', JSON.stringify(list), 600); } catch (e) {}
  return list;
}
function usersBust_() { try { CacheService.getScriptCache().remove('users:lite'); } catch (e) {} ADMIN_NAMES_ = null; }

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
function publicUser_(u) { return { id: u.id, name: u.name, full: u.full, role: u.role, color: u.color, active: u.active, photo: u.photo || '', perms: u.perms || '' }; }

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
  const props = PropertiesService.getScriptProperties();   // ล้าง session หมดอายุทำทุกคืนใน nightly()
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  props.setProperty('S_' + token, JSON.stringify({ uid: u.id, exp: Date.now() + SESSION_DAYS * 864e5 }));
  log_('', u.name, 'login', '');
  let boot = null;
  try { boot = bootstrap_(Object.assign({}, u, { token: token })); } catch (e) {}
  return { token: token, user: publicUser_(u), boot: boot };
}

function auth_(token) {
  if (!token) throw new Error('AUTH:กรุณาเข้าสู่ระบบ');
  const raw = PropertiesService.getScriptProperties().getProperty('S_' + token);
  if (!raw) throw new Error('AUTH:หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) { PropertiesService.getScriptProperties().deleteProperty('S_' + token); throw new Error('AUTH:หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); }
  const u0 = usersLite_().find(x => x.id === s.uid);
  if (!u0 || !u0.active) throw new Error('AUTH:บัญชีนี้ถูกปิดใช้งาน');
  const u = Object.assign({}, u0);
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
const ROLE_ = r => ['admin', 'lead', 'prod', 'stock'].indexOf(r) >= 0 ? r : 'user'; // admin = ผู้ดูแลระบบ, lead = หัวหน้างาน, prod = ฝ่ายผลิต, stock = ฝ่ายสต็อก, user = พนักงาน
/* สิทธิ์แยกเรื่อง (แอดมินติ๊กเปิด/ปิดได้ทีละคน) — ช่อง perms ว่าง = ใช้ค่าเริ่มต้นของตำแหน่ง, "-" = ไม่มีสิทธิ์เพิ่มเติมเลย · แอดมินมีทุกสิทธิ์เสมอ */
const PERM_KEYS_ = ['design.add', 'design.edit', 'design.assign', 'design.delete', 'prod.edit', 'prod.ship', 'stock.view', 'stock.edit', 'team.all'];
const PERM_DEF_ = {
  user: ['design.add', 'stock.view'],
  lead: ['design.add', 'team.all', 'stock.view'],
  prod: ['prod.edit', 'stock.view'],
  stock: ['prod.ship', 'stock.view', 'stock.edit']
};
function permsOf_(u) {
  if (!u) return [];
  if (u.role === 'admin') return PERM_KEYS_.slice();
  const raw = String(u.perms || '').trim();
  if (!raw) return (PERM_DEF_[ROLE_(u.role)] || []).slice();
  return raw.split(',').map(x => x.trim()).filter(k => PERM_KEYS_.indexOf(k) >= 0);
}
const can_ = (u, k) => !!u && (u.role === 'admin' || permsOf_(u).indexOf(k) >= 0);
/** แปลงรายการสิทธิ์จากหน้าแอดมิน → ค่าที่เก็บในชีต (ตรงกับค่าเริ่มต้นของตำแหน่ง = เก็บว่าง เพื่อให้ตามค่าเริ่มต้นต่อไป) */
function permsStore_(list, role) {
  if (list === undefined || list === null) return undefined;
  const arr = (Array.isArray(list) ? list : String(list).split(',')).map(x => String(x).trim()).filter((k, i, a) => PERM_KEYS_.indexOf(k) >= 0 && a.indexOf(k) === i);
  const def = PERM_DEF_[ROLE_(role)] || [];
  if (arr.length === def.length && def.every(k => arr.indexOf(k) >= 0)) return '';
  return arr.length ? PERM_KEYS_.filter(k => arr.indexOf(k) >= 0).join(',') : '-';
}
const canProd_ = u => can_(u, 'prod.edit');   // บอร์ดผลิต: คนที่มีสิทธิ์ "อัปเดตบอร์ดผลิต" (ค่าเริ่มต้น = ฝ่ายผลิต) และแอดมิน · คนอื่นดูอย่างเดียว
/* ผู้ร่วมทำงาน: เก็บเป็นชื่อคั่นด้วยจุลภาค "หมี,อีฟ" — ทำงาน/จับเวลา/เปลี่ยนสถานะได้เหมือนผู้รับผิดชอบ */
const helpersOf_ = j => String((j && j.helpers) || '').split(',').map(x => x.trim()).filter(Boolean);
const leadsJob_ = (u, j) => isAdmin_(u) || j.assignee === u.name || j.createdBy === u.name;
const ownsJob_ = (u, j) => leadsJob_(u, j) || helpersOf_(j).indexOf(u.name) >= 0;

/* ซ่อนชื่อแอดมินจากผู้ใช้งานทั่วไป */
const ADMIN_LABEL = 'ผู้ดูแลระบบ';
let ADMIN_NAMES_ = null;
function adminNames_() {
  if (!ADMIN_NAMES_) ADMIN_NAMES_ = usersLite_().filter(x => x.role === 'admin').map(x => x.name);
  return ADMIN_NAMES_;
}
function maskName_(n, viewer) { return !isAdmin_(viewer) && n && adminNames_().indexOf(n) >= 0 ? ADMIN_LABEL : n; }
function maskJob_(j, viewer) {
  if (isAdmin_(viewer) || !j) return j;
  const o = Object.assign({}, j);
  ['assignee', 'createdBy', 'updatedBy'].forEach(k => { o[k] = maskName_(o[k], viewer); });
  if (o.helpers) o.helpers = helpersOf_(o).map(n => maskName_(n, viewer)).join(',');
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

const SH_ = {};
function sheet_(name) {
  if (SH_[name]) return SH_[name];
  return (SH_[name] = sheetOpen_(name));
}
function sheetOpen_(name) {
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
  if (name === 'Users') usersBust_();
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
  if (key === 'config') { try { CacheService.getScriptCache().remove('cfg'); } catch (e) {} }
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
  const c = CacheService.getScriptCache();
  let raw = c.get('cfg');
  if (raw == null) { raw = getSetting_('config') || ''; if (raw.length < 95000) try { c.put('cfg', raw, 600); } catch (e) {} }
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
  try { CacheService.getScriptCache().remove('cfg'); } catch (e) {}
  log_('', u.name, 'settings', 'แก้ไขการตั้งค่า');
  return { settings: settings };
}

function defaultSettings_() {
  return {
    company: 'บริษัทของคุณ', appName: 'KiwNgan คิวงาน', accent: '#0B6B70', logo: '',
    sales: [],
    groups: ['งาน 2D', 'งาน 2.5D', 'งาน 3D', 'งาน โครงการ', 'งาน ตัวอย่าง'],
    taskTypes: [{ name: 'ทำ CAD', cat: 'draw' }, { name: 'ทำ CAM', cat: 'cam' }, { name: 'ทำ CAD+CAM', cat: 'cadcam', prod: true },
                { name: 'ทำ แบบผลิต', cat: 'draw' }, { name: 'ทำ แบบติดตั้ง', cat: 'draw' }],
    levels: [{ level: 1, label: 'มีไฟล์ลูกค้า / แบบพร้อม' }, { level: 2, label: 'ดราฟลายเอง' }, { level: 3, label: 'ดราฟลาย + ขึ้น 3D' }],
    sla: {
      'งาน 2D': { cam: [1, 2], draw: [1, 3] }, 'งาน 2.5D': { cam: [1, 2], draw: [2, 3] },
      'งาน 3D': { cam: [1, 2], draw: [4, 5] }, 'งาน โครงการ': { cam: [1, 2], draw: [2, 2] },
      'งาน ตัวอย่าง': { cam: [1, 2], draw: [1, 2] }
    },
    skipWeekends: true,
    machines: ['Router', 'Laser', 'Punching', 'WaterJet']
  };
}

/* ======================= ไฟล์งาน (DWG, DXF, NC, PDF …) ======================= */
function addFile_(p, u) {
  const row = rowOf_('Jobs', p.jobId); if (row < 0) throw new Error('ไม่พบงานนี้');
  const job = readRow_('Jobs', row);
  if (!ownsJob_(u, job)) throw new Error('แนบไฟล์ได้เฉพาะงานของตัวเอง');
  const name = String(p.name || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120), b64 = String(p.data || '').replace(/^data:[^,]*,/, '');
  if (!b64) throw new Error('ไฟล์ว่าง');
  const bytes = Utilities.base64Decode(b64);
  if (bytes.length > FILE_MAX_MB * 1048576) throw new Error('ไฟล์ใหญ่เกิน ' + FILE_MAX_MB + ' MB');
  const f = subFolder_(driveFolder_('files'), safeName_(job.code)).createFile(Utilities.newBlob(bytes, p.mime || 'application/octet-stream', name));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const rec = { id: uid_('f_'), jobId: job.id, name: name, mime: String(p.mime || ''), size: String(bytes.length), fileId: f.getId(), createdBy: u.name, createdAt: nowIso_() };
  withLock_(() => writeRow_('Files', rec, -1));
  log_(job.id, u.name, 'file', 'แนบไฟล์ ' + name);
  return { file: rec };
}
function deleteFile_(id, u) {
  const row = rowOf_('Files', id); if (row < 0) throw new Error('ไม่พบไฟล์นี้');
  const f = readRow_('Files', row), jr = rowOf_('Jobs', f.jobId), job = jr > 0 ? readRow_('Jobs', jr) : null;
  if (!isAdmin_(u) && f.createdBy !== u.name && !(job && leadsJob_(u, job))) throw new Error('ลบได้เฉพาะไฟล์ที่ตัวเองแนบ หรือผู้รับผิดชอบงาน');
  sheet_('Files').deleteRow(row);
  try { DriveApp.getFileById(f.fileId).setTrashed(true); } catch (e) {}
  log_(f.jobId, u.name, 'file', 'ลบไฟล์ ' + f.name);
  return { id: id };
}

/* ======================= คอมเมนต์ในงาน ======================= */
function commentsOf_(jobId) { return readAll_('Comments').filter(c => c.jobId === jobId).sort((a, b) => String(a.ts).localeCompare(String(b.ts))); }
function commentCounts_() { const o = {}; readAll_('Comments').forEach(c => { o[c.jobId] = (o[c.jobId] || 0) + 1; }); return o; }
function addComment_(p, u) {
  const text = String(p.text || '').trim().slice(0, 2000); if (!text) throw new Error('พิมพ์ข้อความก่อน');
  const jr = rowOf_('Jobs', p.jobId); if (jr < 0) throw new Error('ไม่พบงานนี้');
  const job = readRow_('Jobs', jr);
  const c = { id: uid_('c_'), jobId: job.id, ts: nowIso_(), from: u.name, text: text };
  writeRow_('Comments', c, -1);
  try {
    const to = [job.assignee].concat(helpersOf_(job), [job.createdBy]).filter((n, i, a) => n && n !== u.name && a.indexOf(n) === i);
    if (to.length) pushTo_(to, { kind: 'cmt', from: maskName_(u.name, { role: 'user' }), code: job.code, title: text.slice(0, 80) });
  } catch (e) {}
  return { comment: Object.assign({}, c, { from: maskName_(c.from, u) }) };
}
function deleteComment_(id, u) {
  const row = rowOf_('Comments', id); if (row < 0) throw new Error('ไม่พบคอมเมนต์');
  const c = readRow_('Comments', row);
  if (!isAdmin_(u) && c.from !== u.name) throw new Error('ลบได้เฉพาะคอมเมนต์ของตัวเอง');
  sheet_('Comments').deleteRow(row);
  return { id: id, jobId: c.jobId };
}

/* ======================= ลิงก์ดูสถานะงานสำหรับ Sale ======================= */
function saleKey_(reset) {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('SALE_KEY');
  if (!k || reset) { k = Utilities.getUuid().replace(/-/g, '').slice(0, 24); props.setProperty('SALE_KEY', k); }
  return k;
}
function saleView_(k, sale) {
  const key = PropertiesService.getScriptProperties().getProperty('SALE_KEY');
  if (!key || !k || String(k) !== key) throw new Error('ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากแอดมิน');
  // แคชตามเวอร์ชันข้อมูล: ข้อมูลไม่เปลี่ยน = ตอบทันทีไม่ต้องอ่านชีต
  const cache = CacheService.getScriptCache(), ck = 'sale:' + VERSION + ':' + stamp_('data') + ':' + encodeURIComponent(String(sale || '')).slice(0, 120);
  try { const hit = cache.get(ck); if (hit) return JSON.parse(hit); } catch (e) {}
  const s = settings_(), since = Utilities.formatDate(new Date(Date.now() - 45 * 864e5), tz_(), 'yyyy-MM-dd');
  const prods = prodsRecent_().filter(x => !sale || x.sale === sale), live = {};
  prods.forEach(x => { if (x.stage !== 'shipped') live[x.code.toLowerCase()] = 1; });
  const im = {};   // รูปงานที่เก็บใน Drive (แชร์แบบมีลิงก์) ให้ Sale ดูในการ์ดลอยได้
  try { imageMeta_().forEach(m => { if (m.fileId) (im[m.jobId] = im[m.jobId] || []).push(m.fileId); }); } catch (e) {}
  const jobs = readAll_('Jobs').filter(j => (!sale || j.sale === sale) && (j.status !== 'done' || String(j.finishedAt).slice(0, 10) >= since || live[j.code.toLowerCase()]))
    .map(j => { let cl = []; try { cl = JSON.parse(j.checklist || '[]'); } catch (e) {}
      return { code: j.code, title: j.title, group: j.group, taskType: j.taskType, status: j.status, received: j.received, due: j.due, finishedAt: j.finishedAt, sale: j.sale, priority: j.priority, note: j.note || '', assignee: maskName_(j.assignee, { role: 'user' }) || '', helpers: helpersOf_(j).map(n => maskName_(n, { role: 'user' })).join(','),
               steps: cl.length ? cl.filter(x => x.d).length + '/' + cl.length : '', imgs: (im[j.id] || []).slice(-6) }; });
  const people = usersLite_().filter(x => x.active && x.role !== 'admin').map(x => ({ name: x.name, color: x.color }));
  const pv = prods.map(x => ({ code: x.code, title: x.title, sale: x.sale, group: x.group, stage: x.stage, machines: prodMachines_(x.machines), paint: x.paint, assy: x.assy, enteredAt: x.enteredAt, finishedAt: x.finishedAt, shippedAt: x.shippedAt, due: x.due || '', note: x.note || '', imgs: (im[x.id] || []).slice(-6), qc: (q => ({ res: q.res, at: q.at, fails: q.fails, ok: q.ok, ng: q.ng }))(prodQc_(x.qc)) }));
  const out = { brand: publicBrand_(), sales: s.sales || [], sale: sale || '', jobs: jobs, prods: pv, machines: s.machines || ['Router', 'Laser', 'Punching', 'WaterJet'], people: people, at: nowIso_(), rt: RT_URL && RT_KEY ? { url: RT_URL, key: RT_KEY } : null };
  try { const t = JSON.stringify(out); if (t.length < 95000) cache.put(ck, t, 600); } catch (e) {}
  return out;
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
    if (data.role !== 'admin' && u.role === 'admin' && users.filter(x => x.role === 'admin' && x.active).length <= 1) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
    Object.assign(u, { name: name, full: String(data.full || ''), role: ROLE_(data.role), color: data.color || u.color, active: data.active !== false });
    { const ps = permsStore_(data.perms, u.role); if (ps !== undefined) u.perms = ps; }
    writeRow_('Users', u, row);
    if (!u.active) dropSessionsOf_(u.id);
    if (oldName !== name) renameMember_(oldName, name);
    log_('', admin.name, 'user', 'แก้ไขผู้ใช้ ' + name);
  } else {
    pin = validPin_(data.pin) ? String(data.pin) : randomPin_();
    const salt = Utilities.getUuid();
    u = { id: uid_('u_'), name: name, full: String(data.full || ''), role: ROLE_(data.role),
          color: data.color || COLORS[users.length % COLORS.length], active: true, pinHash: hash_(salt, pin), salt: salt, createdAt: nowIso_() };
    u.perms = permsStore_(data.perms, u.role) || '';
    writeRow_('Users', u, -1);
    log_('', admin.name, 'user', 'เพิ่มผู้ใช้ ' + name);
  }
  return { user: publicUser_(u), pin: pin };
}

/** ลบบัญชีผู้ใช้ถาวร — งานและเวลาที่เคยทำยังอยู่ (เก็บเป็นชื่อ) จึงดูย้อนหลังและสรุปรายงานได้เหมือนเดิม */
function deleteUser_(userId, admin) {
  const row = rowOf_('Users', userId);
  if (row < 1) throw new Error('ไม่พบผู้ใช้นี้');
  const u = readRow_('Users', row);
  if (u.id === admin.id) throw new Error('ลบบัญชีตัวเองไม่ได้');
  if (u.role === 'admin' && readAll_('Users').filter(x => x.role === 'admin' && x.active && x.id !== u.id).length < 1) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
  sheet_('Users').deleteRow(row);
  dropSessionsOf_(u.id);
  usersBust_();
  log_('', admin.name, 'user', 'ลบผู้ใช้ ' + u.name);
  return { userId: u.id };
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
  // ผู้ร่วมทำงาน (รายชื่อคั่นจุลภาค)
  const jsh = sheet_('Jobs'), hcol = SHEETS.Jobs.indexOf('helpers') + 1, jl = jsh.getLastRow();
  if (jl >= 2) {
    const rng = jsh.getRange(2, hcol, jl - 1, 1), vals = rng.getValues(); let ch = false;
    vals.forEach(r => { const a = String(r[0] || '').split(',').map(x => x.trim()); if (a.indexOf(oldName) >= 0) { r[0] = a.map(x => x === oldName ? newName : x).join(','); ch = true; } });
    if (ch) rng.setValues(vals);
  }
}

function resetPin_(userId, admin, wanted) {
  const row = rowOf_('Users', userId);
  if (row < 0) throw new Error('ไม่พบผู้ใช้');
  const u = readRow_('Users', row);
  if (wanted && !validPin_(wanted)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
  const pin = wanted ? String(wanted) : randomPin_();
  u.salt = Utilities.getUuid(); u.pinHash = hash_(u.salt, pin);
  writeRow_('Users', u, row);
  dropSessionsOf_(u.id);
  CacheService.getScriptCache().remove('fail_' + u.id);
  log_('', admin.name, 'user', (wanted ? 'ตั้ง PIN ใหม่ให้ ' : 'รีเซ็ต PIN ของ ') + u.name);
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

function bootstrap_(u, stamp) {
  const st = stamp_('data');
  if (stamp && stamp === st) return { same: true, stamp: st, serverTime: nowIso_() };
  const cutoff = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), tz_(), 'yyyy-MM-dd');
  const logs = readAll_('TimeLogs').filter(l => !l.end || l.start >= cutoff);
  const allUsers = readAll_('Users'), meFull = allUsers.find(x => x.id === u.id) || u;
  return {
    stamp: st,
    settings: settings_(),
    users: allUsers.filter(x => isAdmin_(u) || x.role !== 'admin').map(publicUser_),
    jobs: readAll_('Jobs').map(j => maskJob_(j, u)), logs: logs.map(l => maskLog_(l, u)),
    images: imageMeta_().map(m => Object.assign(m, { createdBy: maskName_(m.createdBy, u) })),
    files: readAll_('Files').map(f => Object.assign(f, { createdBy: maskName_(f.createdBy, u) })),
    cmtCount: commentCounts_(),
    prods: prodsRecent_().map(x => maskProd_(x, u)),
    stock: can_(u, 'stock.view') ? stockView_(u) : null,
    salePin: isAdmin_(u) ? !!PropertiesService.getScriptProperties().getProperty('SALE_PIN') : undefined,
    me: publicUser_(meFull), serverTime: nowIso_(), version: VERSION,
    rt: RT_URL && RT_KEY ? { url: RT_URL, key: RT_KEY, secret: rtSecret_() } : null,
    archivedBefore: PropertiesService.getScriptProperties().getProperty('ARCHIVED_BEFORE') || ''
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
    if (!ownsJob_(u, before) && !can_(u, 'design.edit')) throw new Error('แก้ไขได้เฉพาะงานของตัวเอง งานนี้เป็นของ ' + (maskName_(before.assignee, u) || 'คนอื่น'));
    if (!can_(u, 'design.assign') && data.assignee !== undefined && data.assignee !== before.assignee && data.assignee !== u.name) {
      throw new Error('ไม่มีสิทธิ์มอบหมายงานให้คนอื่น (แอดมินเปิดสิทธิ์ได้ที่ ตั้งค่า > ผู้ใช้งานและสิทธิ์)');
    }
    if (data.helpers !== undefined) {
      // ผู้ใช้ทั่วไปเห็นชื่อแอดมินเป็น "ผู้ดูแลระบบ" → แปลงกลับเป็นชื่อเดิมก่อนบันทึก
      if (!isAdmin_(u)) { const adm = helpersOf_(before).filter(n => adminNames_().indexOf(n) >= 0); data.helpers = helpersOf_(data).map(n => n === ADMIN_LABEL ? adm.shift() || '' : n).filter(Boolean).join(','); }
      if (helpersOf_(data).join(',') !== helpersOf_(before).join(',') && !leadsJob_(u, before) && !can_(u, 'design.edit')) throw new Error('เพิ่ม/ลบผู้ร่วมทำงานได้เฉพาะผู้รับผิดชอบงานหรือแอดมิน');
    }
    if (job.baseUpdatedAt && before.updatedAt && job.baseUpdatedAt !== before.updatedAt) {
      throw new Error('งานนี้ถูกแก้โดย ' + (before.updatedBy || 'คนอื่น') + ' เมื่อสักครู่ กดรีเฟรชแล้วลองอีกครั้ง');
    }
  } else {
    if (!can_(u, 'design.add')) throw new Error('ไม่มีสิทธิ์ลงงานใหม่ของฝ่ายแบบ');
    // เลข Job ซ้ำ: ทุกงานจบที่ CAM → เพิ่มงาน CAM ของเลขเดิมได้ถ้ายังไม่มีงาน CAM ของเลขนั้น · รายละเอียดอื่นซ้ำไม่ได้
    const same = readAll_('Jobs').filter(x => x.code.toLowerCase() === data.code.toLowerCase());
    if (same.length) {
      const types = settings_().taskTypes || [];
      const cat = t => { const f = types.find(x => x.name === t); return f ? f.cat : (/CAM$/.test(t || '') ? 'cam' : 'draw'); };
      if (cat(data.taskType) !== 'cam') throw new Error('มีเลข Job ' + data.code + ' อยู่แล้ว — เพิ่มซ้ำได้เฉพาะงาน "ทำ CAM" ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1');
      if (same.some(x => ['cam', 'cadcam'].indexOf(cat(x.taskType)) >= 0)) throw new Error('เลข Job ' + data.code + ' มีงาน CAM' + (same.some(x => cat(x.taskType) === 'cadcam') ? ' (CAD+CAM)' : '') + ' อยู่แล้ว ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1');
    }
    data.id = uid_('j_');
    data.createdAt = now;
    data.createdBy = u.name;
    if (!can_(u, 'design.assign')) data.assignee = u.name; // ไม่มีสิทธิ์มอบหมาย = ลงงานให้ตัวเอง
  }

  const merged = Object.assign({}, before || { minutes: 0 }, data, { updatedAt: now, updatedBy: u.name });
  merged.helpers = helpersOf_(merged).filter((n, i, a) => n !== merged.assignee && a.indexOf(n) === i).join(',');
  if (merged.status === 'done' && !merged.finishedAt) merged.finishedAt = now.slice(0, 16);
  if (merged.status !== 'done') merged.finishedAt = '';
  if ((merged.status === 'doing' || merged.status === 'review' || merged.status === 'fix') && !merged.startedAt) merged.startedAt = now.slice(0, 16);
  writeRow_('Jobs', merged, row);
  notifyJob_(before, merged, u);
  if (merged.status === 'done' && (!before || before.status !== 'done') && toProd_(merged.taskType)) { try { ensureProd_(merged, u); } catch (e) {} }

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
  if (!can_(u, 'design.delete') && job.createdBy !== u.name) throw new Error('ลบได้เฉพาะงานที่ตัวเองสร้าง หรือให้แอดมินลบ');
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
    const jids = ish.getRange(2, 2, ilast - 1, 1).getDisplayValues(), fids = ish.getRange(2, IMG_FILE_COL_, ilast - 1, 1).getDisplayValues();
    const gone = [];
    for (let i = jids.length - 1; i >= 0; i--) if (jids[i][0] === id) { if (fids[i][0]) gone.push(fids[i][0]); ish.deleteRow(i + 2); }
    const still = imageMeta_().map(m => m.fileId);
    gone.filter(f => still.indexOf(f) < 0).forEach(f => { try { DriveApp.getFileById(f).setTrashed(true); } catch (e) {} });
  }
  // ลบไฟล์งานและคอมเมนต์ของงานนี้
  [['Files', true], ['Comments', false]].forEach(([nm, drive]) => {
    const sh2 = sheet_(nm), l2 = sh2.getLastRow(); if (l2 < 2) return;
    const H = SHEETS[nm], v = sh2.getRange(2, 1, l2 - 1, H.length).getDisplayValues();
    for (let i = v.length - 1; i >= 0; i--) if (v[i][1] === id) { if (drive) { try { DriveApp.getFileById(v[i][H.indexOf('fileId')]).setTrashed(true); } catch (e) {} } sh2.deleteRow(i + 2); }
  });
  log_(id, u.name, 'delete', job.code);
  return { id: id };
}

/* ======================= ฝ่ายผลิต =======================
   งานที่ออกแบบเสร็จ (งานประเภทที่ "ส่งเข้าผลิต" เช่น ทำ CAM) จะเข้า "รอผลิต" เอง 1 เลข Job = 1 แถว
   ขั้น: wait รอผลิต → machine ลงเครื่อง (เลือกได้หลายเครื่อง ครบทุกเครื่องแล้วไปต่อเอง) → paint ทำสี (ข้ามได้) → assemble ประกอบติดตั้ง (ข้ามได้) → pack แพ็ค → ready พร้อมส่ง → shipped ส่งแล้ว
   อัปเดตได้: ฝ่ายผลิต หัวหน้างาน แอดมิน · คนอื่นดูอย่างเดียว */
function toProd_(taskType) {
  const t = (settings_().taskTypes || []).find(x => x.name === taskType);
  if (t && t.prod !== undefined) return t.prod === true || t.prod === 'true';
  return /CAM/i.test(String(taskType || ''));
}
function prodMachines_(raw) {
  let a = raw;
  if (typeof a === 'string') { try { a = JSON.parse(a || '[]'); } catch (e) { a = []; } }
  if (!Array.isArray(a)) a = [];
  const seen = {};
  return a.map(x => ({ m: String((x && x.m) || '').trim().slice(0, 40), d: String((x && x.d) || '').slice(0, 16) }))
    .filter(x => x.m && !seen[x.m] && (seen[x.m] = 1)).slice(0, 12);
}
function prodsRecent_() {
  const since = Utilities.formatDate(new Date(Date.now() - 60 * 864e5), tz_(), 'yyyy-MM-dd');
  return readAll_('Prod').filter(x => x.stage !== 'shipped' || String(x.shippedAt).slice(0, 10) >= since);
}
function maskProd_(x, viewer) {
  if (!x || isAdmin_(viewer)) return x;
  const o = Object.assign({}, x);
  ['createdBy', 'updatedBy'].forEach(k => { o[k] = maskName_(o[k], viewer); });
  try { o.history = JSON.stringify(JSON.parse(o.history || '[]').map(h => Object.assign(h, { by: maskName_(h.by, viewer) }))); } catch (e) {}
  return o;
}
function prodFind_(code) {
  const c = String(code || '').trim().toLowerCase();
  return readAll_('Prod').filter(x => x.code.toLowerCase() === c && x.stage !== 'shipped')[0] || null;
}
/** งานออกแบบเสร็จ → สร้างงานรอผลิต (ถ้ายังไม่มีเลข Job นี้ในฝ่ายผลิต) */
function ensureProd_(job, u) {
  if (prodFind_(job.code)) return null;
  const now = nowIso_();
  const p = { id: uid_('p_'), code: job.code, title: job.title || '', sale: job.sale || '', group: job.group || '', stage: 'wait', machines: '[]', paint: '', assy: '', note: '',
              enteredAt: now.slice(0, 16), startedAt: '', finishedAt: '', shippedAt: '', createdBy: u.name, updatedAt: now, updatedBy: u.name,
              history: JSON.stringify([{ t: now.slice(0, 16), by: u.name, s: 'wait', x: 'ออกแบบเสร็จ ส่งเข้าผลิต' }]) };
  writeRow_('Prod', p, -1);
  log_(p.id, u.name, 'prod', p.code + ' → รอผลิต');
  return p;
}
function prodSave_(data, u) {
  if (!data || typeof data !== 'object') throw new Error('ข้อมูลไม่ถูกต้อง');
  const ship = can_(u, 'prod.ship'), edit = canProd_(u);
  if (!edit && !ship) throw new Error('อัปเดตงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน');
  if (!edit) {   // ฝ่ายสต็อก: กด "ส่งแล้ว" (หรือย้อนกลับเป็นพร้อมส่ง) ได้อย่างเดียว
    const r0 = data.id ? rowOf_('Prod', data.id) : -1, b0 = r0 > 0 ? readRow_('Prod', r0) : null;
    if (!b0 || ['ready', 'shipped'].indexOf(b0.stage) < 0 || ['ready', 'shipped'].indexOf(data.stage) < 0) throw new Error('ฝ่ายสต็อกกดได้เฉพาะ "ส่งแล้ว" ของงานที่พร้อมส่ง');
    data = { id: data.id, baseUpdatedAt: data.baseUpdatedAt, stage: data.stage, why: data.why };
  }
  const now = nowIso_(), row = data.id ? rowOf_('Prod', data.id) : -1;
  let before = null, cur;
  if (row > 0) {
    before = readRow_('Prod', row);
    if (data.baseUpdatedAt && before.updatedAt && data.baseUpdatedAt !== before.updatedAt) throw new Error('งานนี้ถูกอัปเดตโดย ' + maskName_(before.updatedBy, u) + ' เมื่อสักครู่ กดรีเฟรชแล้วลองอีกครั้ง');
    cur = Object.assign({}, before);
  } else {
    if (data.id) throw new Error('ไม่พบงานนี้ในฝ่ายผลิต อาจถูกลบไปแล้ว');
    const code = String(data.code || '').trim();
    if (!code) throw new Error('กรุณาใส่เลข Job');
    if (prodFind_(code)) throw new Error('เลข Job ' + code + ' อยู่ในฝ่ายผลิตแล้ว');
    const src = readAll_('Jobs').filter(j => j.code.toLowerCase() === code.toLowerCase());
    const pick = k => (src.find(j => j[k]) || {})[k] || '';
    cur = { id: uid_('p_'), code: code, title: pick('title'), sale: pick('sale'), group: pick('group'), stage: 'wait', machines: '[]', paint: '', assy: '', note: '',
            enteredAt: now.slice(0, 16), startedAt: '', finishedAt: '', shippedAt: '', createdBy: u.name, history: '[]' };
  }
  ['title', 'sale', 'group', 'note'].forEach(k => { if (data[k] !== undefined) cur[k] = String(data[k]).slice(0, k === 'note' ? 1000 : 200); });
  if (data.due !== undefined) { const dd = String(data.due || '').slice(0, 10); if (dd && !/^\d{4}-\d{2}-\d{2}$/.test(dd)) throw new Error('กำหนดส่งไม่ถูกต้อง'); cur.due = dd; }
  if (data.paint !== undefined) cur.paint = data.paint === 'no' ? 'no' : '';
  if (data.assy !== undefined) cur.assy = data.assy === 'no' ? 'no' : '';
  if (data.machines !== undefined) cur.machines = JSON.stringify(prodMachines_(data.machines));
  let qc = prodQc_(cur.qc);
  if (data.qc !== undefined) qc = Object.assign(prodQc_(data.qc), { fails: qc.fails, last: qc.last });
  if (data.stage !== undefined) { if (PROD_STAGES.indexOf(data.stage) < 0) throw new Error('ขั้นงานผลิตไม่ถูกต้อง'); cur.stage = data.stage; }
  if (!ship && (cur.stage === 'shipped') !== (!!before && before.stage === 'shipped')) throw new Error('ขั้น "ส่งแล้ว" ให้ฝ่ายสต็อกเป็นคนกด (ฝ่ายผลิตทำได้ถึง "พร้อมส่ง")');
  const ms = prodMachines_(cur.machines);
  if (cur.stage === 'machine' && !ms.length) throw new Error('เลือกเครื่องอย่างน้อย 1 เครื่องก่อนเริ่มลงเครื่อง');
  if (cur.stage === 'machine' && ms.every(x => x.d)) cur.stage = 'paint';   // ครบทุกเครื่อง → ไปขั้นต่อเอง
  for (let k = 0; k < 3; k++) {   // ข้ามขั้นที่ติ๊ก "ไม่ต้อง" ไว้ (ถ้าย้ายเข้ามาใหม่)
    const f = PROD_SKIP_[cur.stage];
    if (f && cur[f] === 'no' && (!before || before.stage !== cur.stage)) cur.stage = PROD_STAGES[PROD_STAGES.indexOf(cur.stage) + 1]; else break;
  }
  const iQ = PROD_STAGES.indexOf('qc'), bi = before ? PROD_STAGES.indexOf(before.stage) : 0, ni = PROD_STAGES.indexOf(cur.stage);
  if (ni > iQ && bi <= iQ && qc.res !== 'pass') throw new Error('งานต้องผ่าน QC ก่อนส่งไปแพ็ค');   // ผ่านด่าน QC ได้เมื่อผลเป็น "ผ่าน" เท่านั้น
  if (before && before.stage === 'qc' && ni < iQ && data.qc && data.qc.res === 'fail') {   // QC ไม่ผ่าน → ส่งกลับไปแก้ (ย้อนกลับเฉย ๆ ไม่นับ)
    qc.fails = (qc.fails || 0) + 1; qc.last = String(data.why || qc.note || '').slice(0, 300); qc.res = 'fail'; qc.by = u.name; qc.at = now.slice(0, 16);
  }
  if (cur.stage === 'qc' && (!before || before.stage !== 'qc')) { qc.res = ''; qc.by = ''; qc.at = ''; qc.it = qc.it.map(x => ({ t: x.t, d: '' })); }   // เข้า QC รอบใหม่ = ตรวจใหม่
  if (data.qc !== undefined && qc.res === 'pass' && !qc.by) { qc.by = u.name; qc.at = now.slice(0, 16); }
  cur.qc = JSON.stringify(qc);
  const si = PROD_STAGES.indexOf(cur.stage), iR = PROD_STAGES.indexOf('ready'), iS = PROD_STAGES.indexOf('shipped');
  if (si >= 1 && !cur.startedAt) cur.startedAt = now.slice(0, 16);
  if (si < 1) cur.startedAt = '';
  if (si >= iR && !cur.finishedAt) cur.finishedAt = now.slice(0, 16);
  if (si < iR) cur.finishedAt = '';
  if (si === iS && !cur.shippedAt) cur.shippedAt = now.slice(0, 16);
  if (si < iS) cur.shippedAt = '';
  let hist = []; try { hist = JSON.parse(cur.history || '[]'); } catch (e) {}
  const changed = !before || before.stage !== cur.stage || before.machines !== cur.machines;
  if (changed) { hist.push({ t: now.slice(0, 16), by: u.name, s: cur.stage, x: String(data.why || '').slice(0, 120) }); hist = hist.slice(-40); }
  cur.history = JSON.stringify(hist);
  cur.updatedAt = now; cur.updatedBy = u.name;
  writeRow_('Prod', cur, row);
  log_(cur.id, u.name, 'prod', cur.code + (before ? (before.stage !== cur.stage ? ' ' + before.stage + '→' + cur.stage : ' แก้ไข') : ' → ' + cur.stage));
  return toObj_('Prod', SHEETS.Prod, SHEETS.Prod.map(h => cur[h] === undefined ? '' : String(cur[h])));
}
/** ผล QC ของงานผลิต: it = หัวข้อตรวจ, res = pass/fail, ok/ng = จำนวนชิ้นผ่าน/เสีย, fails = ไม่ผ่านกี่รอบ */
function prodQc_(raw) {
  let q = raw; if (typeof q === 'string') { try { q = JSON.parse(q || '{}'); } catch (e) { q = {}; } }
  if (!q || typeof q !== 'object') q = {};
  const it = (Array.isArray(q.it) ? q.it : []).map(x => ({ t: String((x && x.t) || '').trim().slice(0, 120), d: String((x && x.d) || '').slice(0, 40) })).filter(x => x.t).slice(0, 25);
  const n = v => String(v === undefined || v === null ? '' : v).replace(/[^0-9]/g, '').slice(0, 6);
  return { it: it, res: q.res === 'pass' || q.res === 'fail' ? q.res : '', by: String(q.by || '').slice(0, 60), at: String(q.at || '').slice(0, 16), ok: n(q.ok), ng: n(q.ng),
           note: String(q.note || '').slice(0, 500), fails: Math.max(0, Math.min(99, +q.fails || 0)), last: String(q.last || '').slice(0, 300) };
}
function prodDelete_(id, u) {
  if (!canProd_(u)) throw new Error('ลบงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน');
  const row = rowOf_('Prod', id);
  if (row < 0) throw new Error('ไม่พบงานนี้ในฝ่ายผลิต');
  const p = readRow_('Prod', row);
  sheet_('Prod').deleteRow(row);
  log_(id, u.name, 'prod', p.code + ' ลบออกจากฝ่ายผลิต');
  return { id: id };
}
/* ======================= คลังวัสดุ (ฝ่ายสต็อก) =======================
   ดู: สิทธิ์ stock.view · รับเข้า/เบิกออก/ปรับยอด/เพิ่ม-แก้-ลบรายการ: สิทธิ์ stock.edit */
const STOCK_KINDS_ = { in: 'รับเข้า', out: 'เบิกออก', adj: 'ปรับยอด' };
const stockNum_ = v => { const n = Math.round(Number(String(v === undefined ? '' : v).replace(/,/g, '')) * 100) / 100; return isFinite(n) ? n : NaN; };
function stockView_(u) {
  const items = readAll_('Stock').map(x => Object.assign(x, { qty: stockNum_(x.qty) || 0, min: stockNum_(x.min) || 0 }));
  const logs = readAll_('StockLog').slice(-300).reverse().map(l => Object.assign(l, { qty: stockNum_(l.qty) || 0, bal: stockNum_(l.bal) || 0, who: maskName_(l.who, u) }));
  return { items: items.map(x => Object.assign(x, { updatedBy: maskName_(x.updatedBy, u) })), logs: logs };
}
function stockEdit_(u) { if (!can_(u, 'stock.edit')) throw new Error('ไม่มีสิทธิ์แก้คลังวัสดุ (แอดมินเปิดได้ที่ ตั้งค่า > ผู้ใช้งานและสิทธิ์)'); }
function stockSave_(item, u) {
  stockEdit_(u);
  if (!item || !String(item.name || '').trim()) throw new Error('กรุณาใส่ชื่อวัสดุ');
  const name = String(item.name).trim().slice(0, 120), all = readAll_('Stock');
  if (all.some(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== item.id)) throw new Error('มีวัสดุชื่อ ' + name + ' อยู่แล้ว');
  const min = stockNum_(item.min || 0); if (isNaN(min) || min < 0) throw new Error('จุดสั่งซื้อต้องเป็นตัวเลข 0 ขึ้นไป');
  const now = nowIso_(), row = item.id ? rowOf_('Stock', item.id) : -1;
  let cur;
  if (row > 0) cur = readRow_('Stock', row);
  else {
    if (item.id) throw new Error('ไม่พบวัสดุนี้ อาจถูกลบไปแล้ว');
    const q0 = stockNum_(item.qty || 0); if (isNaN(q0) || q0 < 0) throw new Error('ยอดเริ่มต้นต้องเป็นตัวเลข 0 ขึ้นไป');
    cur = { id: uid_('s_'), qty: q0 };
  }
  Object.assign(cur, { name: name, cat: String(item.cat || '').trim().slice(0, 60), unit: String(item.unit || '').trim().slice(0, 20) || 'ชิ้น', min: min,
    loc: String(item.loc || '').trim().slice(0, 60), note: String(item.note || '').slice(0, 300), updatedAt: now, updatedBy: u.name });
  writeRow_('Stock', cur, row);
  if (row < 0 && cur.qty) writeRow_('StockLog', { id: uid_('sl_'), ts: now, itemId: cur.id, kind: 'adj', qty: cur.qty, bal: cur.qty, job: '', who: u.name, note: 'ยอดเริ่มต้น' }, -1);
  log_(cur.id, u.name, 'stock', (row > 0 ? 'แก้ไขวัสดุ ' : 'เพิ่มวัสดุ ') + name);
  return stockView_(u);
}
function stockMove_(p, u) {
  stockEdit_(u);
  const row = rowOf_('Stock', p.itemId);
  if (row < 0) throw new Error('ไม่พบวัสดุนี้');
  const kind = STOCK_KINDS_[p.kind] ? p.kind : '', n = stockNum_(p.qty);
  if (!kind) throw new Error('เลือก รับเข้า / เบิกออก / ปรับยอด');
  if (isNaN(n) || (kind === 'adj' ? n < 0 : n <= 0)) throw new Error(kind === 'adj' ? 'ยอดคงเหลือจริงต้องเป็นตัวเลข 0 ขึ้นไป' : 'ใส่จำนวนมากกว่า 0');
  const it = readRow_('Stock', row), have = stockNum_(it.qty) || 0;
  const bal = kind === 'in' ? have + n : kind === 'out' ? have - n : n;
  if (bal < 0) throw new Error('เบิกเกินยอดคงเหลือ (เหลือ ' + have + ' ' + (it.unit || '') + ')');
  const now = nowIso_(), r2 = Math.round(bal * 100) / 100;
  it.qty = r2; it.updatedAt = now; it.updatedBy = u.name;
  writeRow_('Stock', it, row);
  writeRow_('StockLog', { id: uid_('sl_'), ts: now, itemId: it.id, kind: kind, qty: kind === 'adj' ? Math.round((r2 - have) * 100) / 100 : n, bal: r2,
    job: String(p.job || '').trim().slice(0, 60), who: u.name, note: String(p.note || '').slice(0, 200) }, -1);
  log_(it.id, u.name, 'stock', STOCK_KINDS_[kind] + ' ' + it.name + ' ' + n + ' ' + (it.unit || '') + ' (คงเหลือ ' + r2 + ')');
  return stockView_(u);
}
function stockDelete_(id, u) {
  stockEdit_(u);
  const row = rowOf_('Stock', id);
  if (row < 0) throw new Error('ไม่พบวัสดุนี้');
  const it = readRow_('Stock', row);
  sheet_('Stock').deleteRow(row);
  log_(id, u.name, 'stock', 'ลบวัสดุ ' + it.name);
  return stockView_(u);
}

/* PIN ของ Sale: เก็บเป็นค่าแฮชใน Script Properties (ไม่อยู่ในชีต ไม่ส่งไปให้ใคร) */
function salePin_(pin) {
  const pr = PropertiesService.getScriptProperties();
  if (!pin) { pr.deleteProperty('SALE_PIN'); return { on: false }; }
  if (!validPin_(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
  const salt = Utilities.getUuid();
  pr.setProperty('SALE_PIN', salt + ':' + hash_(salt, String(pin)));
  saleKey_(false);
  return { on: true };
}
function saleOpen_(pin) {
  const raw = PropertiesService.getScriptProperties().getProperty('SALE_PIN');
  if (!raw) throw new Error('แอดมินยังไม่ได้ตั้ง PIN สำหรับ Sale');
  const c = CacheService.getScriptCache(), fails = Number(c.get('salefail') || 0);
  if (fails >= 10) throw new Error('ใส่ PIN ผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่');
  const i = raw.indexOf(':'), salt = raw.slice(0, i);
  if (!validPin_(pin) || hash_(salt, String(pin)) !== raw.slice(i + 1)) { c.put('salefail', String(fails + 1), 600); throw new Error('PIN ไม่ถูกต้อง'); }
  return { key: saleKey_(false) };
}

/* ---------- รูปงาน (เก็บในชีต Images แบ่งเป็นช่วง ๆ เพราะ 1 ช่องเก็บได้ไม่เกิน 50,000 ตัวอักษร) ---------- */
const IMG_RE_ = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
function imageMeta_() {
  const sh = sheet_('Images'), last = sh.getLastRow();
  if (last < 2) return [];
  const meta = sh.getRange(2, 1, last - 1, 4).getDisplayValues(), fid = sh.getRange(2, IMG_FILE_COL_, last - 1, 1).getDisplayValues();
  return meta.map((r, i) => ({ id: r[0], jobId: r[1], createdBy: r[2], createdAt: r[3], fileId: fid[i][0] || '' })).filter(m => m.id);
}
const IMG_FILE_COL_ = SHEETS.Images.indexOf('fileId') + 1;
function addImage_(p, u) {
  let job;
  if (/^s_/.test(String(p.jobId || ''))) {   // รูปสินค้า/วัสดุในคลัง (ฝ่ายสต็อก)
    const sr = rowOf_('Stock', p.jobId);
    if (sr < 0) throw new Error('ไม่พบวัสดุนี้');
    if (!can_(u, 'stock.edit')) throw new Error('เพิ่มรูปวัสดุได้เฉพาะคนที่จัดการคลังวัสดุได้');
    job = { code: 'คลังวัสดุ' };
  } else if (/^p_/.test(String(p.jobId || ''))) {   // รูปของงานฝ่ายผลิต (งานที่ไม่ได้ผ่านฝ่ายแบบ)
    const pr = rowOf_('Prod', p.jobId);
    if (pr < 0) throw new Error('ไม่พบงานนี้ในฝ่ายผลิต');
    if (!canProd_(u)) throw new Error('เพิ่มรูปงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน');
    job = readRow_('Prod', pr);
  } else {
    const jr = rowOf_('Jobs', p.jobId);
    if (jr < 0) throw new Error('ไม่พบงานนี้');
    job = readRow_('Jobs', jr);
    if (!ownsJob_(u, job)) throw new Error('เพิ่มรูปได้เฉพาะงานของตัวเอง');
  }
  const thumb = String(p.thumb || ''), full = String(p.full || '');
  if (!IMG_RE_.test(thumb) || !IMG_RE_.test(full)) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (thumb.length > IMG_CELL) throw new Error('รูปย่อใหญ่เกินไป');
  if (full.length > IMG_CELL * IMG_PARTS) throw new Error('รูปใหญ่เกินไป');
  if (imageMeta_().filter(m => m.jobId === p.jobId).length >= IMG_MAX_PER_JOB) throw new Error('ใส่รูปได้สูงสุด ' + IMG_MAX_PER_JOB + ' รูปต่องาน');
  const img = { id: uid_('i_'), jobId: p.jobId, createdBy: u.name, createdAt: nowIso_(), thumb: thumb };
  let fileId = '';
  try { fileId = saveImageFile_(full, job.code, img.id); } catch (e) { fileId = ''; }
  if (fileId) { img.fileId = fileId; img.thumb = ''; }   // เก็บรูปใน Google Drive (โฟลเดอร์ รูปงาน/เลข Job) · ชีตเก็บแค่รหัสไฟล์
  else for (let i = 0; i < IMG_PARTS; i++) img['f' + i] = full.slice(i * IMG_CELL, (i + 1) * IMG_CELL);   // สำรอง: เก็บในชีตแบบเดิม
  writeRow_('Images', img, -1);
  log_(p.jobId, u.name, 'image', 'เพิ่มรูป');
  return { image: { id: img.id, jobId: img.jobId, createdBy: maskName_(img.createdBy, u), createdAt: img.createdAt, thumb: thumb, fileId: fileId } };
}
function deleteImage_(id, u) {
  const row = rowOf_('Images', id);
  if (row < 0) throw new Error('ไม่พบรูปนี้');
  const meta = sheet_('Images').getRange(row, 1, 1, 4).getDisplayValues()[0];
  const jr = rowOf_('Jobs', meta[1]), job = jr > 0 ? readRow_('Jobs', jr) : null;
  const isProdImg = (/^p_/.test(meta[1]) && canProd_(u)) || (/^s_/.test(meta[1]) && can_(u, 'stock.edit'));
  if (!isAdmin_(u) && meta[2] !== u.name && !isProdImg && !(job && ownsJob_(u, job))) throw new Error('ลบได้เฉพาะรูปของงานตัวเอง');
  const fid = sheet_('Images').getRange(row, IMG_FILE_COL_).getDisplayValue();
  sheet_('Images').deleteRow(row);
  if (fid && !imageMeta_().some(m => m.fileId === fid)) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} }   // ไฟล์ที่งานอื่นไม่ได้ใช้ร่วม → ถังขยะ (กู้คืนได้ 30 วัน)
  log_(meta[1], u.name, 'image', 'ลบรูป');
  return { id: id, jobId: meta[1] };
}
function thumbs_(ids) {
  ids = (ids || []).slice(0, 60).map(String);
  const out = {}, c = CacheService.getScriptCache();
  if (!ids.length) return { thumbs: out };
  const hit = c.getAll(ids.map(id => 'th:' + id));
  ids.forEach(id => { if (hit['th:' + id]) out[id] = hit['th:' + id]; });
  const need = ids.filter(id => !out[id]);
  if (!need.length) return { thumbs: out };
  const sh = sheet_('Images'), last = sh.getLastRow();
  if (last < 2) return { thumbs: out };
  const all = sh.getRange(2, 1, last - 1, 1).getValues(), rows = [];
  all.forEach((r, i) => { if (need.indexOf(String(r[0])) >= 0) rows.push(i + 2); });
  if (!rows.length) return { thumbs: out };
  const lo = Math.min.apply(null, rows), hi = Math.max.apply(null, rows), put = {};
  if (hi - lo + 1 <= rows.length * 3 + 10) {   // อ่านช่วงเดียวรวด แทนการอ่านทีละช่อง
    const vals = sh.getRange(lo, 1, hi - lo + 1, 5).getValues();
    vals.forEach(v => { const id = String(v[0]); if (need.indexOf(id) >= 0) { out[id] = String(v[4]); put['th:' + id] = out[id]; } });
  } else rows.forEach(r => { const v = sh.getRange(r, 1, 1, 5).getValues()[0]; out[String(v[0])] = String(v[4]); put['th:' + v[0]] = String(v[4]); });
  try { c.putAll(put, 21600); } catch (e) {}
  return { thumbs: out };
}
function imageFull_(id) {
  const c = CacheService.getScriptCache(), keys = []; for (let i = 0; i < IMG_PARTS; i++) keys.push('fi:' + id + ':' + i);
  const hit = c.getAll(keys.concat(['fi:' + id + ':n']));
  const n = Number(hit['fi:' + id + ':n'] || 0);
  if (n && keys.slice(0, n).every(k => hit[k] != null)) return { id: id, full: keys.slice(0, n).map(k => hit[k]).join('') };
  const row = rowOf_('Images', id);
  if (row < 0) throw new Error('ไม่พบรูปนี้');
  const parts = sheet_('Images').getRange(row, 6, 1, IMG_PARTS).getValues()[0].map(String);
  const full = parts.join(''), put = {}, used = parts.filter(x => x).length;
  parts.slice(0, used).forEach((x, i) => { put[keys[i]] = x; }); put['fi:' + id + ':n'] = String(used);
  try { c.putAll(put, 21600); } catch (e) {}
  return { id: id, full: full };
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
  // จับเวลาได้หลายงานพร้อมกัน (แต่ละ job แยกเวลากัน) — งานเดียวกันไม่เริ่มซ้ำ
  const closed = [];
  const already = readAll_('TimeLogs').find(l => !l.end && l.member === u.name && l.jobId === jobId);
  if (already) return { log: already, job: job, closed: closed };
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


/* ---------- ข้อความและขอความช่วยเหลือ ----------
   to = 'team' (ทุกคน) | 'admin' (ผู้ดูแลระบบทุกคน) | ชื่อผู้ใช้ (ข้อความส่วนตัว)
   kind = 'msg' | 'help'   status (help) = open | taken | done */
function msgVisible_(m, u) {
  if (m.to === 'team' || m.from === u.name || m.to === u.name) return true;
  return m.to === 'admin' && isAdmin_(u);
}
function maskMsg_(m, u) {
  const read = (',' + m.readBy + ',').indexOf(',' + u.name + ',') >= 0 || m.from === u.name;
  const o = { id: m.id, ts: m.ts, from: m.from, fromAdmin: m.fromRole === 'admin', to: m.to, kind: m.kind, text: m.text, jobId: m.jobId, status: m.status, helper: m.helper, read: read, img: m.img || '' };
  if (!isAdmin_(u)) { o.from = maskName_(o.from, u); o.helper = maskName_(o.helper, u); if (adminNames_().indexOf(o.to) >= 0) o.to = 'admin'; }
  return o;
}
function messages_(u, since, stamp) {
  const st = stamp_('msg');
  if (stamp && stamp === st) return { same: true, stamp: st, serverTime: nowIso_() };
  const cutoff = Utilities.formatDate(new Date(Date.now() - 45 * 864e5), tz_(), "yyyy-MM-dd'T'HH:mm:ss");
  const s = String(since || '');
  const vis = readAll_('Messages').filter(m => msgVisible_(m, u) && m.ts >= cutoff);
  const list = vis.filter(m => !s || m.ts > s || (m.kind === 'help' && m.status !== 'done'));
  return { messages: list.slice(-400).map(m => maskMsg_(m, u)), ids: vis.map(m => m.id), serverTime: nowIso_(), stamp: st };
}
function sendMessage_(p, u) {
  const text = String(p.text || '').trim().slice(0, 1000);
  let img = '';
  if (p.img) {   // รูปที่แปะ (Print Screen → Ctrl+V) หรือเลือกจากเครื่อง → เก็บใน Drive โฟลเดอร์ "รูปในแชท"
    const raw = String(p.img);
    if (!IMG_RE_.test(raw)) throw new Error('ไฟล์รูปไม่ถูกต้อง');
    if (raw.length > IMG_CELL * IMG_PARTS) throw new Error('รูปใหญ่เกินไป');
    const mm = raw.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    let f;
    try { f = driveFolder_('chat').createFile(Utilities.newBlob(Utilities.base64Decode(mm[2]), 'image/' + mm[1], 'chat_' + Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd_HHmmss') + '.' + (mm[1] === 'jpeg' ? 'jpg' : mm[1]))); } catch (e) { throw new Error('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง'); }
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    img = f.getId();
  }
  if (!text && !img) throw new Error('พิมพ์ข้อความก่อนส่ง');
  let to = String(p.to || 'team');
  if (to !== 'team' && to !== 'admin') {
    const target = usersLite_().find(x => x.name === to && x.active);
    if (!target) throw new Error('ไม่พบผู้รับ');
    if (target.role === 'admin' && !isAdmin_(u)) to = 'admin';
  }
  const kind = p.kind === 'help' ? 'help' : 'msg';
  const m = { id: uid_('m_'), ts: nowIso_(), from: u.name, fromRole: u.role, to: to, kind: kind, text: text, jobId: String(p.jobId || ''), status: kind === 'help' ? 'open' : '', helper: '', readBy: u.name, img: img };
  writeRow_('Messages', m, -1);
  try {   // แจ้งเตือนบนมือถือ/คอมแม้ปิดแอป (เครื่องที่เปิดแจ้งเตือนไว้)
    const act = usersLite_().filter(x => x.active && x.name !== u.name);
    const names = to === 'team' ? act.map(x => x.name) : to === 'admin' ? adminNames_().filter(n => n !== u.name) : [to];
    if (names.length) pushTo_(names, { kind: kind === 'help' ? 'sos' : 'msg', from: isAdmin_(u) ? ADMIN_LABEL : u.name, code: u.name, team: to === 'team', title: (text || (img ? '📷 ส่งรูปมา' : '')).slice(0, 100) });
  } catch (e) {}
  return { message: maskMsg_(m, u) };
}
function markRead_(ids, u) {
  ids = (ids || []).slice(0, 200).map(String);
  const sh = sheet_('Messages'), last = sh.getLastRow();
  if (last < 2 || !ids.length) return { ok: true };
  const head = SHEETS.Messages, col = head.indexOf('readBy') + 1;
  const idv = sh.getRange(2, 1, last - 1, 1).getDisplayValues(), rv = sh.getRange(2, col, last - 1, 1).getDisplayValues();
  let changed = false;
  for (let i = 0; i < idv.length; i++) {
    if (ids.indexOf(idv[i][0]) < 0) continue;
    const cur = rv[i][0] ? rv[i][0].split(',') : [];
    if (cur.indexOf(u.name) < 0) { cur.push(u.name); rv[i][0] = cur.join(','); changed = true; }
  }
  if (changed) sh.getRange(2, col, last - 1, 1).setNumberFormat('@').setValues(rv);
  return { ok: true };
}
function helpUpdate_(id, status, u) {
  const row = rowOf_('Messages', id);
  if (row < 0) throw new Error('ไม่พบคำขอนี้');
  const m = readRow_('Messages', row);
  if (m.kind !== 'help') throw new Error('ไม่ใช่คำขอความช่วยเหลือ');
  if (!msgVisible_(m, u)) throw new Error('ไม่มีสิทธิ์');
  if (status === 'taken') {
    if (m.from === u.name) throw new Error('รับช่วยคำขอของตัวเองไม่ได้');
    if (m.status !== 'open') throw new Error(m.status === 'taken' ? 'มีคนรับช่วยแล้ว' : 'คำขอนี้ปิดแล้ว');
    m.status = 'taken'; m.helper = u.name;
    writeRow_('Messages', m, row);
    const note = { id: uid_('m_'), ts: nowIso_(), from: u.name, fromRole: u.role, to: m.to === 'team' ? 'team' : m.from, kind: 'msg', text: '🙋 รับช่วยเรื่อง "' + m.text.slice(0, 60) + '" แล้ว', jobId: m.jobId, status: '', helper: '', readBy: u.name };
    if (m.to !== 'team' && !isAdmin_(u)) note.to = m.from;
    writeRow_('Messages', note, -1);
    return { message: maskMsg_(m, u), note: maskMsg_(note, u) };
  }
  if (status === 'done' || status === 'open') {
    if (m.from !== u.name && m.helper !== u.name && !isAdmin_(u)) throw new Error('ปิดได้เฉพาะคนขอ คนที่รับช่วย หรือแอดมิน');
    m.status = status; if (status === 'open') m.helper = '';
    writeRow_('Messages', m, row);
    return { message: maskMsg_(m, u) };
  }
  throw new Error('สถานะไม่ถูกต้อง');
}

function deleteMessages_(ids, u) {
  ids = (ids || []).slice(0, 2000).map(String);
  const sh = sheet_('Messages'), last = sh.getLastRow();
  if (last < 2 || !ids.length) return { deleted: 0 };
  const idv = sh.getRange(2, 1, last - 1, 1).getDisplayValues(), ic = SHEETS.Messages.indexOf('img') + 1;
  const imv = sh.getLastColumn() >= ic ? sh.getRange(2, ic, last - 1, 1).getDisplayValues() : [];
  let n = 0;
  for (let i = idv.length - 1; i >= 0; i--) if (ids.indexOf(idv[i][0]) >= 0) {
    const fid = imv[i] && imv[i][0]; if (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} }   // รูปในแชท → ถังขยะ (กู้คืนได้ 30 วัน)
    sh.deleteRow(i + 2); n++;
  }
  log_('', u.name, 'message', 'ลบข้อความ ' + n + ' รายการ');
  return { deleted: n };
}

/* ---------- แชร์หน้าจอ / รีโมท: ส่งสัญญาณ WebRTC ผ่าน CacheService (ไม่เขียนลงชีต)
   ภาพหน้าจอวิ่งตรงระหว่างเครื่อง (peer-to-peer) ไม่ผ่านเซิร์ฟเวอร์นี้ */
const RTC_TYPES_ = ['req', 'offer', 'answer', 'bye', 'deny', 'ctl', 'ctlcode', 'ctlno', 'roff', 'rans', 'rbye'];
function rtcBox_(name) { return 'rtc:' + name; }
function rtcSend_(p, u) {
  const type = String(p.type || '');
  if (RTC_TYPES_.indexOf(type) < 0) throw new Error('คำสั่งแชร์หน้าจอไม่ถูกต้อง');
  const to = String(p.to || ''), users = usersLite_().filter(x => x.active);
  let targets;
  if (to === 'admin' || to === ADMIN_LABEL) targets = adminNames_();
  else {
    const t = users.find(x => x.name === to);
    if (!t) throw new Error('ไม่พบผู้ใช้ปลายทาง');
    if (t.role === 'admin' && !isAdmin_(u)) throw new Error('ไม่มีสิทธิ์');
    targets = [t.name];
  }
  targets = targets.filter(n => n !== u.name);
  if (!targets.length) throw new Error('ไม่พบผู้ใช้ปลายทาง');
  const data = JSON.stringify(p.data == null ? '' : p.data);
  if (data.length > 60000) throw new Error('ข้อมูลใหญ่เกินไป');
  const cache = CacheService.getScriptCache();
  let dup = false;
  targets.forEach(n => {
    const ru = users.find(x => x.name === n) || { role: 'user' };
    const sid0 = /^[A-Za-z0-9_]{4,40}$/.test(String(p.id || '')) ? String(p.id) : uid_('r_');
    const sig = { id: sid0, sid: String(p.sid || '').slice(0, 40), type: type, from: maskName_(u.name, ru), fromAdmin: isAdmin_(u), data: data, ts: Date.now() };
    let box = [];
    try { box = JSON.parse(cache.get(rtcBox_(n)) || '[]'); } catch (e) { box = []; }
    box = box.filter(x => Date.now() - x.ts < 120000);
    if (box.some(x => x.id === sig.id)) { dup = true; return; }   // คำขอซ้ำ (ส่งสำรองตอนเน็ตช้า) ไม่ใส่ซ้ำ
    box.push(sig);
    let raw = JSON.stringify(box);
    while (raw.length > 90000 && box.length > 1) { box.shift(); raw = JSON.stringify(box); }
    cache.put(rtcBox_(n), raw, 180);
  });
  return { ok: true, dup: dup };
}
function rtcPoll_(u, wait, ack) {
  const cache = CacheService.getScriptCache(), key = rtcBox_(u.name);
  const read = () => { try { return JSON.parse(cache.get(key) || '[]'); } catch (e) { return []; } };
  const out = box => ({ signals: box.filter(x => Date.now() - x.ts < 120000).map(x => Object.assign({}, x, { data: x.data ? JSON.parse(x.data) : '' })) });
  if (!Array.isArray(ack)) {   // หน้าเว็บรุ่นเก่า: รับแล้วลบทันที
    if (!cache.get(key)) return { signals: [] };
    return withLock_(() => { const box = read(); cache.remove(key); return out(box); });
  }
  // รุ่นใหม่: สัญญาณอยู่จนกว่าหน้าเว็บยืนยันว่าได้รับแล้ว (ack) — คำขอที่ค้าง/ส่งซ้ำตอนเน็ตช้าจึงไม่ทำสัญญาณหาย
  const acked = ack.slice(0, 100).map(String);
  if (acked.length && cache.get(key)) withLock_(() => {
    const box = read(), keep = box.filter(x => acked.indexOf(x.id) < 0 && Date.now() - x.ts < 120000);
    if (keep.length !== box.length) { if (keep.length) cache.put(key, JSON.stringify(keep), 180); else cache.remove(key); }
  });
  // ระหว่างกำลังต่อสาย/แชร์จอ หน้าเว็บขอ "รอสัญญาณ" ได้สูงสุด ~6 วิ: ตอบทันทีที่อีกฝ่ายส่งมา
  const until = Date.now() + Math.min(6000, Math.max(0, Number(wait) || 0));
  let box = read();
  while (!box.length && Date.now() < until) { Utilities.sleep(200); box = read(); }
  return out(box);
}

/* =====================================================================
   Web Push — สายเรียกเข้า / คำขอดูจอ เด้งบนเครื่องแม้ปิดแอป
   ส่ง push แบบไม่มีเนื้อหา (ไม่ต้องเข้ารหัส) + ลงนาม VAPID (ES256 / P-256) ด้วย BigInt
   service worker ของแอปจะถาม pushInfo เองว่าใครโทรมา แล้วแสดงการแจ้งเตือน
   ===================================================================== */
const EC_ = (() => {
  const B = x => BigInt(x);
  return {
    p: B('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
    n: B('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    G: [B('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'), B('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')]
  };
})();
function ecMod_(a, m) { const r = a % m; return r < BigInt(0) ? r + m : r; }
function ecInv_(a, m) {
  let lm = BigInt(1), hm = BigInt(0), low = ecMod_(a, m), high = m;
  while (low > BigInt(1)) { const r = high / low; const nm = hm - lm * r, nw = high - low * r; hm = lm; high = low; lm = nm; low = nw; }
  return ecMod_(lm, m);
}
function ecAdd_(P, Q) {
  const p = EC_.p;
  if (!P) return Q; if (!Q) return P;
  if (P[0] === Q[0]) {
    if (ecMod_(P[1] + Q[1], p) === BigInt(0)) return null;
    const l = ecMod_((BigInt(3) * P[0] * P[0] - BigInt(3)) * ecInv_(BigInt(2) * P[1], p), p);
    const x = ecMod_(l * l - BigInt(2) * P[0], p); return [x, ecMod_(l * (P[0] - x) - P[1], p)];
  }
  const l = ecMod_((Q[1] - P[1]) * ecInv_(Q[0] - P[0], p), p);
  const x = ecMod_(l * l - P[0] - Q[0], p); return [x, ecMod_(l * (P[0] - x) - P[1], p)];
}
function ecMul_(k, P) { let R = null, A = P; while (k > BigInt(0)) { if (k & BigInt(1)) R = ecAdd_(R, A); A = ecAdd_(A, A); k >>= BigInt(1); } return R; }
function u8_(bytes) { return Array.prototype.map.call(bytes, b => b & 255); }
function s8_(bytes) { return bytes.map(b => (b > 127 ? b - 256 : b)); }
function big2b_(x) { const h = x.toString(16).padStart(64, '0'); const out = []; for (let i = 0; i < 64; i += 2) out.push(parseInt(h.substr(i, 2), 16)); return out; }
function b2big_(b) { return BigInt('0x' + (u8_(b).map(x => ('0' + x.toString(16)).slice(-2)).join('') || '0')); }
function sha_(bytes) { return u8_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s8_(bytes))); }
function utf8_(str) { return u8_(Utilities.newBlob(str).getBytes()); }
function b64u_(bytes) { return Utilities.base64EncodeWebSafe(s8_(bytes)).replace(/=+$/, ''); }
function rnd_() { return sha_(utf8_(Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random())); }
function vapid_() {
  const props = PropertiesService.getScriptProperties();
  let v = null; try { v = JSON.parse(props.getProperty('VAPID') || 'null'); } catch (e) { v = null; }
  if (v && v.d && v.pub) return v;
  const d = ecMod_(b2big_(rnd_()), EC_.n - BigInt(1)) + BigInt(1), Q = ecMul_(d, EC_.G);
  v = { d: d.toString(16), pub: b64u_([4].concat(big2b_(Q[0]), big2b_(Q[1]))) };
  props.setProperty('VAPID', JSON.stringify(v));
  return v;
}
function es256_(input, dHex) {
  const d = BigInt('0x' + dHex), n = EC_.n, e = b2big_(sha_(utf8_(input)));
  for (let i = 0; i < 8; i++) {
    const k = ecMod_(b2big_(sha_(big2b_(d).concat(big2b_(e), rnd_()))), n - BigInt(1)) + BigInt(1);
    const r = ecMod_(ecMul_(k, EC_.G)[0], n); if (r === BigInt(0)) continue;
    const s = ecMod_(ecInv_(k, n) * (e + r * d), n); if (s === BigInt(0)) continue;
    return b64u_(big2b_(r).concat(big2b_(s)));
  }
  throw new Error('sign failed');
}
function vapidAuth_(endpoint) {
  const aud = endpoint.match(/^https:\/\/[^/]+/)[0], cache = CacheService.getScriptCache(), ck = 'vj:' + aud;
  const hit = cache.get(ck); if (hit) return hit;
  const v = vapid_(), now = Math.floor(Date.now() / 1000);
  const h = b64u_(utf8_(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), c = b64u_(utf8_(JSON.stringify({ aud: aud, exp: now + 12 * 3600, sub: 'mailto:kiwngan@users.noreply.github.com' })));
  const jwt = h + '.' + c + '.' + es256_(h + '.' + c, v.d), auth = 'vapid t=' + jwt + ', k=' + v.pub;
  cache.put(ck, auth, 6 * 3600);
  return auth;
}
const PUSH_HOST_ = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com)\//i;
function pushKeyOf_(u) { return 'PUSH_' + u.id; }
function pushList_(u) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(pushKeyOf_(u)) || '[]'); } catch (e) { return []; } }
function pushSave_(u, list) { const pr = PropertiesService.getScriptProperties(); if (list.length) pr.setProperty(pushKeyOf_(u), JSON.stringify(list)); else pr.deleteProperty(pushKeyOf_(u)); }
function pushSub_(sub, u) {
  const ep = String(sub && sub.endpoint || '');
  if (!PUSH_HOST_.test(ep) || ep.length > 900) throw new Error('ลงทะเบียนการแจ้งเตือนไม่ได้');
  const list = pushList_(u).filter(x => x.e !== ep);
  list.push({ e: ep, t: Date.now() });
  pushSave_(u, list.slice(-6)); // สูงสุด 6 เครื่องต่อคน
  return { ok: true, devices: Math.min(list.length, 6) };
}
function pushUnsub_(ep, u) { pushSave_(u, pushList_(u).filter(x => x.e !== String(ep || ''))); return { ok: true }; }
function pushInfo_(u) { try { return JSON.parse(CacheService.getScriptCache().get('pinfo:' + u.name) || 'null'); } catch (e) { return null; } }
function pushTo_(names, info) {
  const users = usersLite_().filter(x => x.active), cache = CacheService.getScriptCache();
  names.forEach(n => {
    const ru = users.find(x => x.name === n); if (!ru) return;
    const list = pushList_(ru); if (!list.length) return;
    cache.put('pinfo:' + n, JSON.stringify(Object.assign({}, info, { ts: Date.now() })), 120);
    let res = [];
    try {
      res = UrlFetchApp.fetchAll(list.map(x => ({ url: x.e, method: 'post', muteHttpExceptions: true, payload: '', contentType: 'application/octet-stream',
        headers: { TTL: '60', Urgency: 'high', Authorization: vapidAuth_(x.e) } })));
    } catch (e) { return; }
    const dead = list.filter((x, i) => res[i] && [404, 410].indexOf(res[i].getResponseCode()) >= 0).map(x => x.e);
    if (dead.length) withLock_(() => pushSave_(ru, pushList_(ru).filter(x => dead.indexOf(x.e) < 0)));
  });
}
/* ส่ง push เฉพาะสัญญาณที่ต้องเรียกคนที่อาจปิดแอปอยู่: โทรหา และขอดูจอ/รีโมท */
function pushForSignal_(p, u) {
  const type = String(p.type || ''), d = p.data || {};
  const kind = type === 'offer' && d.src === 'voice' ? 'call' : type === 'req' ? (d.mode === 'remote' ? 'remote' : 'view') : type === 'offer' ? 'share' : '';
  if (!kind) return;
  try {
    const to = String(p.to || ''), names = (to === 'admin' || to === ADMIN_LABEL) ? adminNames_() : [to];
    const users = usersLite_();
    names.filter(n => n !== u.name).forEach(n => {
      const ru = users.find(x => x.name === n) || { role: 'user' };
      pushTo_([n], { kind: kind, from: maskName_(u.name, ru), sid: String(p.sid || '') });
    });
  } catch (e) { /* push เป็นของเสริม ห้ามทำให้การโทรล้ม */ }
}
/* เรียกใช้ครั้งเดียวในหน้าแก้ไข Apps Script เพื่ออนุญาตให้สคริปต์ส่งแจ้งเตือน (สิทธิ์ "เชื่อมต่อกับบริการภายนอก") */
function authorizePush() {
  UrlFetchApp.fetch('https://fcm.googleapis.com/', { muteHttpExceptions: true });
  Logger.log('อนุญาตการส่งแจ้งเตือนแล้ว · public key: ' + vapid_().pub);
}

/* =====================================================================
   ห้องเสียงทีม (แบบ Discord) — เก็บแค่รายชื่อคนในห้องไว้ใน cache
   เสียง/จอวิ่งตรงระหว่างเครื่อง (mesh WebRTC) ใช้ rtcSend ชนิด roff / rans / rbye
   ===================================================================== */
const ROOM_KEY_ = 'room:team';
function roomGet_() {
  let r = {};
  try { r = JSON.parse(CacheService.getScriptCache().get(ROOM_KEY_) || '{}'); } catch (e) { r = {}; }
  const now = Date.now(); Object.keys(r).forEach(k => { if (now - r[k].t > 35000) delete r[k]; }); // ไม่ส่งสัญญาณเกิน 35 วิ = หลุดจากห้อง
  return r;
}
function roomView_(r, u) {
  return Object.keys(r).sort((a, b) => r[a].j - r[b].j).map(n => ({ name: maskName_(n, u), admin: !!r[n].admin, mic: !!r[n].mic, share: r[n].share || '', since: r[n].j }));
}
function room_(p, u) {
  return withLock_(() => {
    const r = roomGet_(), op = String(p.op || 'beat');
    if (op === 'leave') delete r[u.name];
    else {
      const was = r[u.name];
      r[u.name] = { t: Date.now(), j: was ? was.j : Date.now(), admin: isAdmin_(u), mic: !!p.mic, share: ['screen', 'camera'].indexOf(p.share) >= 0 ? p.share : '' };
    }
    CacheService.getScriptCache().put(ROOM_KEY_, JSON.stringify(r), 900);
    return { room: roomView_(r, u) };
  });
}


/* =====================================================================
   v1.16 — โฟลเดอร์โปรเจกต์ใน Google Drive, รูปงานใน Drive, งานต่อ CAM,
   เก็บถาวรงานเก่า, สำรองข้อมูลทุกคืน, แจ้งเตือนงาน, เรียลไทม์ (Supabase)
   ===================================================================== */
const DF_ = { files: 'ไฟล์งาน', images: 'รูปงาน', chat: 'รูปในแชท', backup: 'สำรองข้อมูล (อัตโนมัติ)', archive: 'เก็บถาวร (งานเก่า)', docs: 'เอกสาร / ไฟล์งานอื่นๆ' };
/** โฟลเดอร์หลักของโปรเจกต์ = โฟลเดอร์ที่ชีตฐานข้อมูลอยู่ (ถ้าชีตอยู่หน้าแรกของไดรฟ์ จะสร้างโฟลเดอร์ใหม่แล้วย้ายชีตเข้าไป) */
function driveRoot_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('DRIVE_ROOT');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const file = DriveApp.getFileById(ss_().getId()), parents = file.getParents();
  let root = parents.hasNext() ? parents.next() : null;
  if (!root || root.getId() === DriveApp.getRootFolder().getId()) {
    root = DriveApp.createFolder('KiwNgan – ' + (settings_().company || 'คิวงาน'));
    file.moveTo(root);
  }
  props.setProperty('DRIVE_ROOT', root.getId());
  return root;
}
function driveFolder_(key) {
  const props = PropertiesService.getScriptProperties(), pk = 'DF_' + key, id = props.getProperty(pk);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const root = driveRoot_(), it = root.getFoldersByName(DF_[key]);
  const f = it.hasNext() ? it.next() : root.createFolder(DF_[key]);
  props.setProperty(pk, f.getId());
  return f;
}
function subFolder_(parent, name) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
const safeName_ = s => String(s || 'ไม่มีเลข').replace(/[\\/:*?"<>|#]+/g, '-').slice(0, 80);
/** บันทึกรูปลง Drive: รูปงาน/<เลข Job>/<รหัสรูป>.jpg — แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" เพื่อให้แอปโหลดรูปจาก Google โดยตรง (เร็ว ไม่ผ่าน Apps Script) */
function saveImageFile_(dataUrl, code, imgId) {
  const m = String(dataUrl).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/); if (!m) return '';
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), 'image/' + m[1], safeName_(code) + '_' + imgId + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
  const f = subFolder_(driveFolder_('images'), safeName_(code)).createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return f.getId();
}
/** งานต่อ CAM: ใช้รูปชุดเดียวกับงานเดิม (อ้างไฟล์ใน Drive เดิม ไม่สร้างซ้ำ) */
function copyImages_(from, to, u) {
  const tr = rowOf_('Jobs', to); if (tr < 0) throw new Error('ไม่พบงานปลายทาง');
  if (!ownsJob_(u, readRow_('Jobs', tr))) throw new Error('เพิ่มรูปได้เฉพาะงานของตัวเอง');
  const sh = sheet_('Images'), last = sh.getLastRow(); if (last < 2) return { images: [] };
  const head = SHEETS.Images, vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  const have = vals.filter(r => r[1] === to).length, out = [];
  vals.filter(r => r[1] === from).slice(0, Math.max(0, IMG_MAX_PER_JOB - have)).forEach(r => {
    const o = {}; head.forEach((h, i) => { o[h] = r[i]; });
    o.id = uid_('i_'); o.jobId = to; o.createdBy = u.name; o.createdAt = nowIso_();
    writeRow_('Images', o, -1);
    out.push({ id: o.id, jobId: to, createdBy: maskName_(u.name, u), createdAt: o.createdAt, fileId: String(o.fileId || '') });
  });
  if (out.length) log_(to, u.name, 'image', 'ใช้รูปจากงานเดิม ' + out.length + ' รูป');
  return { images: out };
}
/** ย้ายรูปเก่าที่เก็บในชีตไป Drive (เรียกซ้ำได้ ทำต่อจากที่ค้าง · จำกัดเวลา ~4.5 นาที/รอบ) */
function migrateImagesToDrive() {
  const sh = sheet_('Images'), head = SHEETS.Images, last = sh.getLastRow(), t0 = Date.now();
  if (last < 2) return Logger.log('ไม่มีรูปในชีต');
  const ids = sh.getRange(2, 1, last - 1, 2).getDisplayValues(), fids = sh.getRange(2, IMG_FILE_COL_, last - 1, 1).getDisplayValues();
  const jobs = {}; readAll_('Jobs').forEach(j => { jobs[j.id] = j.code; });
  let moved = 0, left = 0;
  for (let i = 0; i < ids.length; i++) {
    if (fids[i][0] || !ids[i][0]) continue;
    if (Date.now() - t0 > 270000) { left++; continue; }
    const row = i + 2, parts = sh.getRange(row, 6, 1, IMG_PARTS).getValues()[0].map(String).join('');
    if (!parts) continue;
    const fid = saveImageFile_(parts, jobs[ids[i][1]] || 'ไม่มีงาน', ids[i][0]);
    if (!fid) continue;
    sh.getRange(row, IMG_FILE_COL_).setNumberFormat('@').setValue(fid);
    sh.getRange(row, 6, 1, IMG_PARTS).clearContent();   // เอาข้อมูลรูปออกจากชีต → ชีตเล็กลง โหลดเร็วขึ้น
    moved++;
  }
  bump_('data');
  Logger.log('ย้ายรูปไป Drive แล้ว ' + moved + ' รูป' + (left ? ' · เหลืออีก ' + left + ' รูป กดเรียกใช้ซ้ำอีกครั้ง' : ' · ครบแล้ว'));
}

/* ---------- เก็บถาวรงานเก่า: ไฟล์แยกในโฟลเดอร์ "เก็บถาวร (งานเก่า)" ---------- */
function archiveSs_() {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty('ARCHIVE_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const folder = driveFolder_('archive'), name = 'KiwNgan – เก็บถาวร ' + (settings_().company || '');
  const it = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  let file = null; while (it.hasNext()) { const f = it.next(); if (/เก็บถาวร/.test(f.getName())) { file = f; break; } }
  const ss = file ? SpreadsheetApp.openById(file.getId()) : SpreadsheetApp.create(name);
  if (!file) DriveApp.getFileById(ss.getId()).moveTo(folder);
  props.setProperty('ARCHIVE_ID', ss.getId());
  return ss;
}
function archSheet_(ss, name) {
  const head = SHEETS[name]; let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
/** ย้ายแถวที่ keep() คืนค่า false ไปไฟล์เก็บถาวร แล้วเขียนแถวที่เหลือกลับ (เร็วกว่าลบทีละแถว) */
function moveRows_(name, aSs, isOld, cols) {
  const sh = sheet_(name), head = SHEETS[name], last = sh.getLastRow(); if (last < 2) return 0;
  const n = cols || head.length, rng = sh.getRange(2, 1, last - 1, n), vals = rng.getDisplayValues();   // ทุกช่องเป็นข้อความอยู่แล้ว
  const keep = [], old = [];
  vals.forEach(r => (r[0] !== '' && isOld(r) ? old : keep).push(r));
  if (!old.length) return 0;
  const ash = archSheet_(aSs, name);
  ash.getRange(ash.getLastRow() + 1, 1, old.length, n).setNumberFormat('@').setValues(old);
  rng.clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, n).setNumberFormat('@').setValues(keep);
  return old.length;
}
function archiveOld(months) {
  months = Number(months) || ARCHIVE_MONTHS;
  const cut = new Date(); cut.setMonth(cut.getMonth() - months);
  const cutoff = Utilities.formatDate(cut, tz_(), 'yyyy-MM-dd');
  return withLock_(() => {
    const aSs = archiveSs_(), H = SHEETS.Jobs, iSt = H.indexOf('status'), iFin = H.indexOf('finishedAt');
    const oldJobs = {};
    readAll_('Jobs').forEach(j => { if (j.status === 'done' && j.finishedAt && j.finishedAt.slice(0, 10) < cutoff) oldJobs[j.id] = 1; });
    const n = {
      jobs: moveRows_('Jobs', aSs, r => r[iSt] === 'done' && String(r[iFin]).slice(0, 10) < cutoff && String(r[iFin]) !== ''),
      logs: moveRows_('TimeLogs', aSs, r => oldJobs[r[1]]),
      images: moveRows_('Images', aSs, r => oldJobs[r[1]]),
      files: moveRows_('Files', aSs, r => oldJobs[r[1]]),
      comments: moveRows_('Comments', aSs, r => oldJobs[r[1]]),
      activity: moveRows_('Activity', aSs, r => String(r[0]).slice(0, 10) < cutoff),
      messages: moveRows_('Messages', aSs, r => String(r[1]).slice(0, 10) < cutoff)
    };
    const props = PropertiesService.getScriptProperties(), prev = props.getProperty('ARCHIVED_BEFORE') || '';
    if (n.jobs && cutoff > prev) props.setProperty('ARCHIVED_BEFORE', cutoff);
    bump_('data'); bump_('msg');
    Logger.log('เก็บถาวรงานที่เสร็จก่อน ' + cutoff + ': ' + JSON.stringify(n));
    return n;
  });
}
/** หน้ารายงานขอดูงานเก่า: งานและเวลาทำงานจากไฟล์เก็บถาวร */
function archiveRead_(u) {
  const id = PropertiesService.getScriptProperties().getProperty('ARCHIVE_ID'); if (!id) return { jobs: [], logs: [] };
  const ss = SpreadsheetApp.openById(id);
  const read = name => { const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return []; const head = SHEETS[name]; return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getDisplayValues().filter(r => r[0]).map(r => toObj_(name, head, r)); };
  return { jobs: read('Jobs').map(j => maskJob_(j, u)), logs: read('TimeLogs').map(l => maskLog_(l, u)) };
}

/* ---------- สำรองข้อมูลทุกคืน (เก็บย้อนหลัง BACKUP_DAYS วัน) ---------- */
function backupNow() {
  const folder = driveFolder_('backup'), stamp = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HHmm');
  DriveApp.getFileById(ss_().getId()).makeCopy('สำรอง KiwNgan ' + stamp, folder);
  const limit = Date.now() - BACKUP_DAYS * 864e5, it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getDateCreated().getTime() < limit) f.setTrashed(true); }
  Logger.log('สำรองข้อมูลแล้ว: สำรอง KiwNgan ' + stamp);
}

/* ---------- งานกลางคืน + แจ้งเตือนตอนเช้า (ตั้งเวลาด้วย installTriggers) ---------- */
function nightly() {
  try { backupNow(); } catch (e) { Logger.log('สำรองไม่สำเร็จ: ' + e); }
  try { rtKeepAlive_(); } catch (e) {}
  if (new Date().getDate() === 1) { try { archiveOld(); } catch (e) { Logger.log('เก็บถาวรไม่สำเร็จ: ' + e); } }
  try { cleanSessions_(PropertiesService.getScriptProperties()); } catch (e) {}
}
function morningReminders() {
  const d = new Date().getDay(); if (d === 0 || d === 6) return;   // ไม่เตือนเสาร์-อาทิตย์
  const today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'), tm = Utilities.formatDate(new Date(Date.now() + 864e5), tz_(), 'yyyy-MM-dd');
  const by = {};
  readAll_('Jobs').forEach(j => { if (j.status !== 'done' && j.assignee && j.due && j.due <= tm) (by[j.assignee] = by[j.assignee] || []).push(j); });
  Object.keys(by).forEach(n => {
    const js = by[n], late = js.filter(j => j.due < today).length;
    try { pushTo_([n], { kind: 'due', from: '', code: js.map(j => j.code).slice(0, 3).join(', '), count: js.length, late: late }); } catch (e) {}
  });
}
/** เรียกครั้งเดียวในหน้าแก้ไข Apps Script: ตั้งเวลาสำรองข้อมูลทุกคืน (02:00) และแจ้งเตือนงานใกล้กำหนดตอนเช้า (08:00) */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => { if (['nightly', 'morningReminders'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('nightly').timeBased().everyDays(1).atHour(2).inTimezone(tz_()).create();
  ScriptApp.newTrigger('morningReminders').timeBased().everyDays(1).atHour(8).inTimezone(tz_()).create();
  driveRoot_(); ['images', 'backup', 'archive', 'docs'].forEach(driveFolder_); archiveSs_();
  Logger.log('ตั้งเวลาแล้ว: สำรองข้อมูล 02:00 ทุกคืน · แจ้งเตือนงานใกล้กำหนด 08:00 (จ-ศ) · โฟลเดอร์: ' + driveRoot_().getUrl());
}
/** ตั้งค่าทั้งหมดในครั้งเดียว: โฟลเดอร์ Drive + ตั้งเวลา + สำรองครั้งแรก + ย้ายรูปเก่าไป Drive */
function setupAll() {
  installTriggers();
  backupNow();
  migrateImagesToDrive();
}

/* ---------- แจ้งเตือนงาน (push ถึงเครื่องแม้ปิดแอป) ---------- */
function notifyJob_(before, after, u) {
  try {
    if (after.assignee && after.assignee !== u.name && (!before || before.assignee !== after.assignee) && after.status !== 'done')
      pushTo_([after.assignee], { kind: 'assign', from: maskName_(u.name, { role: 'user' }), code: after.code, title: after.title || '' });
    else if (before && after.status === 'fix' && before.status !== 'fix' && after.assignee && after.assignee !== u.name)
      pushTo_([after.assignee], { kind: 'fix', from: maskName_(u.name, { role: 'user' }), code: after.code, title: after.title || '' });
    const added = helpersOf_(after).filter(n => n !== u.name && helpersOf_(before).indexOf(n) < 0);
    if (added.length && after.status !== 'done') pushTo_(added, { kind: 'help', from: maskName_(u.name, { role: 'user' }), code: after.code, title: after.title || '' });
  } catch (e) { /* แจ้งเตือนเป็นของเสริม */ }
}

/* ---------- เรียลไทม์ (Supabase) ---------- */
function rtSecret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('RT_SECRET');
  if (!s) { s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('RT_SECRET', s); }
  return s;
}
/** โปรเจกต์ Supabase ฟรีจะถูกพักถ้าไม่มีการใช้งาน 1 สัปดาห์ → เรียกเบา ๆ ทุกคืนกันไว้ */
function rtKeepAlive_() {
  if (!RT_URL || !RT_KEY) return;
  UrlFetchApp.fetch(RT_URL + '/rest/v1/', { headers: { apikey: RT_KEY }, muteHttpExceptions: true });
}
