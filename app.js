/* KiwNgan คิวงาน — frontend
 * Works in two modes:
 *   demo  : data kept in this browser (localStorage) — for trying the app / sales demo
 *   sheet : data in the team's Google Sheet through the Apps Script API (backend/Code.gs)
 */
(function () {
'use strict';

const APP_VERSION = '1.4.1';
const NS = 'kiwngan:';
const LS = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
};

/* ============ constants ============ */
const ST = {
  queue: { label: 'รอคิว', cls: 's-queue' },
  doing: { label: 'กำลังทำ', cls: 's-doing' },
  review: { label: 'รอตรวจ/แก้', cls: 's-review' },
  hold: { label: 'พักไว้', cls: 's-hold' },
  done: { label: 'เสร็จแล้ว', cls: 's-done' }
};
const FLOW = ['queue', 'doing', 'review', 'done'];
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const COLORS = ['#0B6B70', '#2D5FC4', '#B05A2A', '#7A4BB5', '#2B7F4A', '#B8435F', '#5B6B7A', '#A07A12'];
const BRAND_PRESETS = ['#0B6B70', '#1F4E9C', '#9A3D1F', '#5B3FA0', '#1E7A4C', '#2B2F36', '#B0402F'];

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17 14.3c2.4.2 4 1.8 4.6 4.7"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 17v-3M13 17v-6M16 17v-2"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
};
const VIEWS = [
  { id: 'home', label: 'ภาพรวม' }, { id: 'board', label: 'บอร์ดงาน' }, { id: 'list', label: 'รายการงาน' },
  { id: 'team', label: 'ทีมงาน' }, { id: 'report', label: 'รายงาน' }, { id: 'settings', label: 'ตั้งค่า' }
];

/* ============ state ============ */
const S = {
  settings: null, jobs: [], logs: [],
  view: LS.get('view', 'home'),
  me: '', user: null, users: [], screen: 'boot', login: { userId: '', pin: '', err: '', busy: false, roster: null, brand: null, showConn: false },
  conn: LS.get('conn', null),            // {url, key} when connected to a sheet
  f: { q: '', member: LS.get('fMember', 'all'), status: 'open', group: 'all', month: '' },
  edit: null, draft: null, draftDirty: false,
  sync: 'idle', syncErr: '', lastSync: 0, loaded: false
};
const mode = () => (S.conn && S.conn.url ? 'sheet' : 'demo');
const tokenKey = () => 'token:' + (mode() === 'sheet' ? S.conn.url : 'demo');

/* permissions — the same rules are enforced by the backend */
const P = {
  admin: u => !!u && u.role === 'admin',
  owns: (u, j) => !!u && (u.role === 'admin' || j.assignee === u.name || j.createdBy === u.name),
  del: (u, j) => !!u && (u.role === 'admin' || j.createdBy === u.name)
};
const isAdmin = () => P.admin(S.user);
const ADMIN_LABEL = 'ผู้ดูแลระบบ';
const canEdit = j => P.owns(S.user, j);

/* ============ utils ============ */
const $ = (s, el) => (el || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => ('0' + n).slice(-2);
const clone = o => JSON.parse(JSON.stringify(o));
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => isoOf(new Date());
const nowLocal = () => { const d = new Date(); return isoOf(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const parseLocal = s => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
const daysBetween = (a, b) => Math.round((parseLocal(b) - parseLocal(a)) / 864e5);
function addDays(iso, n) { const d = parseLocal(iso); d.setDate(d.getDate() + n); return isoOf(d); }
function addWorkDays(iso, n, skipWeekends) {
  const d = parseLocal(iso); let left = n;
  while (left > 0) { d.setDate(d.getDate() + 1); if (!skipWeekends || (d.getDay() !== 0 && d.getDay() !== 6)) left--; }
  return isoOf(d);
}
function fd(iso) { if (!iso) return '–'; const d = parseLocal(iso); return d.getDate() + ' ' + TH_M[d.getMonth()]; }
function fdY(iso) { if (!iso) return '–'; const d = parseLocal(iso); return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2); }
function fdt(s) { if (!s) return '–'; return fd(s) + (s.length > 10 ? ' ' + s.slice(11, 16) : ''); }
function fdur(min) {
  min = Math.round(min || 0); if (!min) return '0 นาที';
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + ' ชม.' : '') + (h && m ? ' ' : '') + (m ? m + ' นาที' : '');
}
function clock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); }
function uid(p) { return (p || '') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
function monthLabel(m) { const p = m.split('-'); return TH_MF[+p[1] - 1] + ' ' + (+p[0] + 543); }
function initial(name) { return (String(name || '?').trim().charAt(0) || '?').toUpperCase(); }

let toastT;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 4200 : 2600);
}

/* ============ domain helpers ============ */
const members = () => (S.users || []).filter(u => u.active);
const memberBy = name => (S.users || []).find(m => m.name === name);
function avUser(u, cls, name) {
  name = name || (u && u.name) || '';
  const photo = u && u.photo;
  return '<span class="av ' + (cls || '') + (photo ? ' ph' : '') + '" style="--c:' + esc(u && u.color ? u.color : '#5B6B7A') + '" title="' + esc(name) + '">' +
    (photo ? '<img src="' + esc(photo) + '" alt="">' : esc(initial(name))) + '</span>';
}
function av(name, cls) {
  if (!name) return '<span class="av empty ' + (cls || '') + '" title="ยังไม่มอบหมาย">–</span>';
  return avUser(memberBy(name), cls, name);
}
const isOpen = j => j.status !== 'done';
const isLate = j => isOpen(j) && j.due && j.due < today();
const finDate = j => (j.finishedAt || '').slice(0, 10);
const onTime = j => j.status === 'done' && (!j.due || !finDate(j) || finDate(j) <= j.due);
const runningLogs = () => S.logs.filter(l => !l.end);
const runningOf = jobId => S.logs.find(l => !l.end && l.jobId === jobId);
const myRunning = () => S.me ? S.logs.find(l => !l.end && l.member === S.me) : null;
const jobById = id => S.jobs.find(j => j.id === id);
function totalMinutes(j) {
  const r = S.logs.filter(l => !l.end && l.jobId === j.id).reduce((s, l) => s + (Date.now() - parseLocal(l.start)) / 60000, 0);
  return (j.minutes || 0) + r;
}
function stPill(j) {
  if (isLate(j)) return '<span class="pill s-late">เลยกำหนด</span>';
  const s = ST[j.status] || ST.queue; return '<span class="pill ' + s.cls + '">' + s.label + '</span>';
}
function lvBars(n) { n = +n || 0; let h = '<span class="lv" title="ระดับความยาก ' + (n || '-') + '">'; for (let i = 1; i <= 3; i++) h += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return h + '</span>'; }
const groupShort = g => String(g || '').replace(/^งาน\s*/, '');
function dueInfo(j) {
  if (j.status === 'done') return { cls: '', text: 'เสร็จ ' + fd(finDate(j)) + (onTime(j) ? '' : ' · ช้า') };
  if (!j.due) return { cls: '', text: 'ไม่มีกำหนด' };
  const d = daysBetween(today(), j.due);
  if (d < 0) return { cls: 'late', text: 'เลย ' + (-d) + ' วัน' };
  if (d === 0) return { cls: 'soon', text: 'ส่งวันนี้' };
  if (d === 1) return { cls: 'soon', text: 'ส่งพรุ่งนี้' };
  return { cls: '', text: 'ส่ง ' + fd(j.due) };
}
function taskCat(name) { const t = (S.settings.taskTypes || []).find(x => x.name === name); return t ? t.cat : (/CAM$/.test(name || '') ? 'cam' : 'draw'); }
function suggestDue(j) {
  if (!j.received || !j.group || !j.taskType) return null;
  const row = (S.settings.sla || {})[j.group]; if (!row) return null;
  const cat = taskCat(j.taskType); const pair = row[cat]; if (!pair) return null;
  const days = +pair[j.qty === 'multi' ? 1 : 0]; if (!(days >= 0)) return null;
  return { date: addWorkDays(j.received, days, S.settings.skipWeekends !== false), days: days, cat: cat };
}
function sortOpen(a, b) {
  const la = isLate(a) ? 0 : 1, lb = isLate(b) ? 0 : 1;
  if (la !== lb) return la - lb;
  const ua = a.priority === 'urgent' ? 0 : 1, ub = b.priority === 'urgent' ? 0 : 1;
  if (ua !== ub) return ua - ub;
  return String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.received).localeCompare(String(b.received));
}

/* ============ default settings ============ */
function defaultSettings() {
  return {
    company: 'บริษัทของคุณ', appName: 'KiwNgan คิวงาน', accent: '#0B6B70', logo: '',
    members: [], sales: [],
    groups: ['งาน 2D', 'งาน 2.5D', 'งาน 3D', 'งาน โครงการ', 'งาน ตัวอย่าง'],
    taskTypes: [{ name: 'ทำ CAD', cat: 'draw' }, { name: 'ทำ CAM', cat: 'cam' }, { name: 'ทำ CAD+CAM', cat: 'draw' }, { name: 'ทำ แบบผลิต', cat: 'draw' }, { name: 'ทำ แบบติดตั้ง', cat: 'draw' }],
    levels: [{ level: 1, label: 'มีไฟล์ลูกค้า / แบบพร้อม' }, { level: 2, label: 'ดราฟลายเอง' }, { level: 3, label: 'ดราฟลาย + ขึ้น 3D' }],
    sla: {
      'งาน 2D': { cam: [1, 2], draw: [1, 3] }, 'งาน 2.5D': { cam: [1, 2], draw: [2, 3] }, 'งาน 3D': { cam: [1, 2], draw: [4, 5] },
      'งาน โครงการ': { cam: [1, 2], draw: [2, 2] }, 'งาน ตัวอย่าง': { cam: [1, 2], draw: [1, 2] }
    },
    skipWeekends: true
  };
}
function normalizeSettings(s) {
  const d = defaultSettings(); s = Object.assign({}, d, s || {});
  ['members', 'sales', 'groups', 'taskTypes', 'levels'].forEach(k => { if (!Array.isArray(s[k])) s[k] = d[k]; });
  if (!s.sla || typeof s.sla !== 'object') s.sla = d.sla;
  return s;
}

/* ============ demo data ============ */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedDemo() {
  const R = mulberry32(20261002), pick = a => a[Math.floor(R() * a.length)];
  const s = defaultSettings();
  s.company = 'บริษัทตัวอย่าง จำกัด';
  const users = [{ id: 'u0', name: 'แอดมิน', full: '', role: 'admin', color: '#2B2F36', active: true, pin: '1234' }, { id: 'u1', name: 'ต้น', full: 'ธนพล', role: 'user', color: '#0B6B70', active: true, pin: '1234' }, { id: 'u2', name: 'ฝน', full: 'ปภาวรินทร์', role: 'user', color: '#2D5FC4', active: true, pin: '1234' }, { id: 'u3', name: 'บอส', full: 'ณัฐวุฒิ', role: 'user', color: '#B05A2A', active: true, pin: '1234' }];
  s.sales = ['เอ', 'บี', 'ซี', 'ดี'];
  const titles = ['ฉากกั้นห้อง ลายใบไม้', 'ฟาซาด อาคารสำนักงาน', 'แผงระแนงลายคลื่น', 'ป้ายโลโก้ร้านกาแฟ', 'ผนังโชว์รูมรถยนต์', 'ฝ้าเพดานลายเรขาคณิต', 'ประตูบานเลื่อนลายไทย', 'ผนังคลินิกทันตกรรม', 'ล็อบบี้โรงแรม', 'รั้วบ้านลายฉลุ', 'ผนังห้องประชุม', 'ช่องลมลายดอกพิกุล'];
  const groupsW = ['งาน 2D', 'งาน 2D', 'งาน 2D', 'งาน 3D', 'งาน 3D', 'งาน โครงการ', 'งาน โครงการ', 'งาน 2.5D', 'งาน ตัวอย่าง'];
  const typesW = ['ทำ CAM', 'ทำ CAM', 'ทำ CAM', 'ทำ CAD', 'ทำ CAD', 'ทำ CAD', 'ทำ CAD+CAM', 'ทำ แบบผลิต'];
  const jobs = [], logs = [], t0 = today(), yy = String((new Date().getFullYear() + 543) % 100);
  const N = 62; let seq = 12;
  for (let k = 0; k < N; k++) {
    const ago = Math.max(0, 46 - Math.floor(k * 47 / N));
    let received = addDays(t0, -ago);
    const rd = parseLocal(received).getDay(); if (rd === 0) received = addDays(received, 1); if (rd === 6) received = addDays(received, 2);
    if (received > t0) received = t0;
    const group = pick(groupsW), taskType = pick(typesW), qty = R() < .8 ? 'single' : 'multi';
    const mm = pad(parseLocal(received).getMonth() + 1);
    const rev = R() < .1;
    const code = (R() < .45 ? 'R' : '') + yy + '-' + mm + String(seq++).padStart(3, '0') + pick(['', '', 'S', 'N', 'C', '-1']) + (rev ? '_re1' : '');
    const j = {
      id: 'j' + k, code: code, title: pick(titles), group: group, taskType: taskType, qty: qty, level: 1 + Math.floor(R() * 3),
      assignee: pick(users.filter(u => u.role !== 'admin')).name, sale: pick(s.sales), priority: R() < .15 ? 'urgent' : 'normal', revision: rev,
      status: 'queue', received: received, due: '', startedAt: '', finishedAt: '', minutes: 0, note: rev ? 'งานแก้ไขตามคอมเมนต์ลูกค้า' : '',
      createdAt: received + 'T08:30:00', updatedAt: received + 'T08:30:00', updatedBy: ''
    };
    j.createdBy = j.assignee;
    S.settings = s; const sg = suggestDue(j); j.due = sg ? sg.date : addDays(received, 2);
    const age = daysBetween(received, t0);
    if (age > 4 || (age > 1 && R() < .5)) {
      const late = R() < .18;
      const fin = late ? addWorkDays(j.due, 1 + Math.floor(R() * 2), true) : (R() < .5 ? j.due : received);
      const finDay = fin > t0 ? t0 : fin;
      const startH = 8 + Math.floor(R() * 7), dur = 25 + Math.floor(R() * (j.level * 110));
      const start = finDay + 'T' + pad(startH) + ':' + pad(Math.floor(R() * 60));
      const endD = new Date(parseLocal(start).getTime() + dur * 60000);
      const end = isoOf(endD) + 'T' + pad(endD.getHours()) + ':' + pad(endD.getMinutes());
      Object.assign(j, { status: 'done', startedAt: start, finishedAt: end, minutes: dur });
      logs.push({ id: 'l' + k, jobId: j.id, member: j.assignee, start: start, end: end, minutes: dur });
    }
    jobs.push(j);
  }
  // open-job states that show what the app does
  const open = jobs.filter(isOpen);
  open.forEach(j => { if (j.due < t0) j.due = addWorkDays(t0, 1 + Math.floor(R() * 3), true); });
  const setSt = (j, st, extra) => Object.assign(j, { status: st }, extra || {});
  open.forEach((j, i) => {
    if (i % 4 === 0) setSt(j, 'doing', { startedAt: j.received + 'T09:10' });
    else if (i % 7 === 1) setSt(j, 'review', { startedAt: j.received + 'T10:00', minutes: 95, note: j.note || 'ส่งให้ sale ตรวจแบบแล้ว รอคอนเฟิร์ม' });
  });
  // two overdue jobs and one on hold
  const o1 = jobs[N - 18], o2 = jobs[N - 15], h1 = jobs[N - 12];
  [o1, o2].forEach((j, i) => Object.assign(j, { status: i ? 'queue' : 'doing', received: addDays(t0, -8 - i), due: addDays(t0, -3 + i), startedAt: i ? '' : addDays(t0, -6) + 'T13:20', finishedAt: '', minutes: i ? 0 : 140, priority: i ? 'urgent' : j.priority }));
  Object.assign(h1, { status: 'hold', finishedAt: '', minutes: 0, startedAt: '', note: 'รอลูกค้าส่งไฟล์ลายใหม่' });
  [o1, o2, h1].forEach(j => { for (let i = logs.length - 1; i >= 0; i--) if (logs[i].jobId === j.id) logs.splice(i, 1); });
  // a running timer for ฝน
  const runJob = jobs.filter(j => j.status === 'doing' && j !== o1).slice(-1)[0];
  if (runJob) {
    runJob.assignee = 'ฝน'; runJob.createdBy = 'ฝน';
    const st = new Date(Date.now() - 47 * 60000);
    logs.push({ id: 'lrun', jobId: runJob.id, member: 'ฝน', start: isoOf(st) + 'T' + pad(st.getHours()) + ':' + pad(st.getMinutes()), end: '', minutes: 0 });
  }
  return { settings: s, users: users, jobs: jobs, logs: logs, activity: [] };
}

/* ============ backends ============ */
const Demo = {
  db() { let d = LS.get('demo', null); if (!d || !d.jobs || !d.users) { d = seedDemo(); LS.set('demo', d); } return d; },
  save(d) { LS.set('demo', d); },
  pub(u) { return { id: u.id, name: u.name, full: u.full, role: u.role, color: u.color, active: u.active, photo: u.photo || '' }; },
  async setPhoto(p) { const d = this.db(), me = this.me(d), id = p.userId || me.id; if (id !== me.id) this.admin(me); const u = d.users.find(x => x.id === id); if (!u) throw new Error('ไม่พบผู้ใช้'); u.photo = String(p.photo || ''); this.save(d); return { user: this.pub(u) }; },
  me(d) {
    const u = d.users.find(x => x.id === LS.get(tokenKey(), ''));
    if (!u || !u.active) { const e = new Error('กรุณาเข้าสู่ระบบ'); e.code = 'auth'; throw e; }
    return u;
  },
  admin(u) { if (u.role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น'); },
  act(d, jobId, who, action, detail) { d.activity.push({ ts: nowLocal(), jobId: jobId, who: who, action: action, detail: detail || '' }); if (d.activity.length > 600) d.activity.splice(0, 100); },
  async ping() { const s = this.db().settings; return { brand: { company: s.company, appName: s.appName, accent: s.accent, logo: s.logo } }; },
  async roster() { const d = this.db(); return { users: d.users.filter(u => u.active && u.role !== 'admin').map(this.pub), brand: (await this.ping()).brand }; },
  mask(d, viewer, o, keys) {
    if (!o || P.admin(viewer)) return o;
    const admins = d.users.filter(u => u.role === 'admin').map(u => u.name), r = Object.assign({}, o);
    keys.forEach(k => { if (admins.indexOf(r[k]) >= 0) r[k] = ADMIN_LABEL; });
    return r;
  },
  mj(d, v, j) { return this.mask(d, v, j, ['assignee', 'createdBy', 'updatedBy']); },
  ml(d, v, l) { return this.mask(d, v, l, ['member']); },
  async login(p) {
    const d = this.db(), u = p.userId ? d.users.find(x => x.id === p.userId) : d.users.find(x => x.name === String(p.name || '').trim());
    if (!u || !u.active) throw new Error(p.name ? 'ชื่อหรือ PIN ไม่ถูกต้อง' : 'ไม่พบผู้ใช้นี้');
    if (String(p.pin) !== String(u.pin)) throw new Error('PIN ไม่ถูกต้อง (โหมดทดลองใช้ 1234)');
    return { token: u.id, user: this.pub(u) };
  },
  async logout() { return {}; },
  async bootstrap() { const d = this.db(), u = this.me(d); return { settings: d.settings, users: d.users.filter(x => P.admin(u) || x.role !== 'admin').map(this.pub), jobs: d.jobs.map(j => this.mj(d, u, j)), logs: d.logs.map(l => this.ml(d, u, l)), me: this.pub(u) }; },
  async saveJob(p) {
    const d = this.db(), u = this.me(d), job = Object.assign({}, p.job);
    delete job.baseUpdatedAt; delete job.minutes; delete job.createdBy; delete job.createdAt;
    job.code = String(job.code || '').trim();
    if (!job.code) throw new Error('กรุณาใส่เลข Job');
    const now = nowLocal();
    let cur = job.id ? d.jobs.find(x => x.id === job.id) : null;
    const before = cur ? clone(cur) : null;
    if (cur) {
      if (!P.owns(u, cur)) throw new Error('แก้ไขได้เฉพาะงานของตัวเอง งานนี้เป็นของ ' + (cur.assignee || 'คนอื่น'));
      if (!P.admin(u) && job.assignee !== undefined && job.assignee !== cur.assignee && job.assignee !== u.name) throw new Error('มอบหมายงานให้คนอื่นได้เฉพาะแอดมิน');
    } else {
      if (d.jobs.some(x => x.code.toLowerCase() === job.code.toLowerCase())) throw new Error('มีเลข Job ' + job.code + ' อยู่แล้ว');
      cur = { id: uid('j_'), createdAt: now, createdBy: u.name, minutes: 0 }; d.jobs.push(cur); delete job.id;
      if (!P.admin(u)) job.assignee = u.name;
    }
    Object.assign(cur, job, { updatedAt: now, updatedBy: u.name });
    if (cur.status === 'done' && !cur.finishedAt) cur.finishedAt = now;
    if (cur.status !== 'done') cur.finishedAt = '';
    if ((cur.status === 'doing' || cur.status === 'review') && !cur.startedAt) cur.startedAt = now;
    this.act(d, cur.id, u.name, !before ? 'create' : (before.status !== cur.status ? 'status' : 'edit'), !before ? cur.code : (before.status !== cur.status ? before.status + '→' + cur.status : ''));
    this.save(d); return { job: this.mj(d, u, clone(cur)) };
  },
  async deleteJob(p) {
    const d = this.db(), u = this.me(d), j = d.jobs.find(x => x.id === p.id);
    if (!j) throw new Error('ไม่พบงานนี้');
    if (!P.del(u, j)) throw new Error('ลบได้เฉพาะงานที่ตัวเองสร้าง หรือให้แอดมินลบ');
    d.jobs = d.jobs.filter(x => x.id !== p.id); d.logs = d.logs.filter(l => l.jobId !== p.id); this.save(d); return { id: p.id };
  },
  recalc(d, jobId) { const t = d.logs.filter(l => l.jobId === jobId && l.end).reduce((s, l) => s + l.minutes, 0); const j = d.jobs.find(x => x.id === jobId); if (j) j.minutes = t; return t; },
  async startTimer(p) {
    const d = this.db(), u = this.me(d), j = d.jobs.find(x => x.id === p.jobId), closed = [];
    if (!j) throw new Error('ไม่พบงานนี้');
    if (!P.owns(u, j)) throw new Error('จับเวลาได้เฉพาะงานของตัวเอง');
    d.logs.filter(l => !l.end && l.member === u.name).forEach(l => { this.stopIn(d, l, u); closed.push(clone(l)); });
    const log = { id: uid('t_'), jobId: p.jobId, member: u.name, start: nowLocal(), end: '', minutes: 0 };
    d.logs.push(log);
    if (j.status === 'queue' || j.status === 'hold') { this.act(d, j.id, u.name, 'status', j.status + '→doing'); j.status = 'doing'; if (!j.startedAt) j.startedAt = log.start; }
    this.act(d, p.jobId, u.name, 'timer', 'เริ่มจับเวลา');
    this.save(d); return { log: this.ml(d, u, clone(log)), job: this.mj(d, u, clone(j)), closed: closed.map(l => this.ml(d, u, l)) };
  },
  stopIn(d, l, u) { l.end = nowLocal(); l.minutes = Math.max(0, Math.round((parseLocal(l.end) - parseLocal(l.start)) / 60000)); this.recalc(d, l.jobId); this.act(d, l.jobId, u.name, 'timer', 'หยุดจับเวลา ' + l.minutes + ' นาที'); },
  async stopTimer(p) {
    const d = this.db(), u = this.me(d), l = d.logs.find(x => x.id === p.logId);
    if (!l) throw new Error('ไม่พบรายการจับเวลา');
    if (!P.admin(u) && l.member !== u.name) throw new Error('หยุดได้เฉพาะการจับเวลาของตัวเอง');
    if (!l.end) this.stopIn(d, l, u); this.save(d); return { log: this.ml(d, u, clone(l)), jobId: l.jobId, minutes: this.recalc(d, l.jobId) };
  },
  async deleteLog(p) {
    const d = this.db(), u = this.me(d), l = d.logs.find(x => x.id === p.logId);
    if (!l) throw new Error('ไม่พบรายการจับเวลา');
    if (!P.admin(u) && l.member !== u.name) throw new Error('ลบได้เฉพาะเวลาของตัวเอง');
    d.logs = d.logs.filter(x => x.id !== p.logId); const m = this.recalc(d, l.jobId); this.save(d); return { logId: p.logId, jobId: l.jobId, minutes: m };
  },
  async saveSettings(p) { const d = this.db(); this.admin(this.me(d)); delete p.settings.members; d.settings = p.settings; this.save(d); return { settings: p.settings }; },
  async activity(p) { const d = this.db(), u = this.me(d); return d.activity.filter(a => a.jobId === p.jobId).slice(-50).reverse().map(a => this.mask(d, u, a, ['who'])); },
  async changePin(p) {
    const d = this.db(), u = this.me(d);
    if (!/^\d{4,6}$/.test(String(p.newPin || ''))) throw new Error('PIN ใหม่ต้องเป็นตัวเลข 4–6 หลัก');
    if (String(p.oldPin) !== String(u.pin)) throw new Error('PIN เดิมไม่ถูกต้อง');
    u.pin = String(p.newPin); this.save(d); return {};
  },
  async saveUser(p) {
    const d = this.db(), me = this.me(d), data = p.user; this.admin(me);
    const name = String(data.name || '').trim(); if (!name) throw new Error('กรุณาใส่ชื่อ');
    if (d.users.some(x => x.name === name && x.id !== data.id)) throw new Error('มีชื่อ ' + name + ' อยู่แล้ว');
    let u = data.id ? d.users.find(x => x.id === data.id) : null, pin = '';
    if (u) {
      if (u.id === me.id && data.role !== 'admin') throw new Error('ลดสิทธิ์ตัวเองไม่ได้ ให้แอดมินคนอื่นทำแทน');
      if (u.id === me.id && data.active === false) throw new Error('ปิดบัญชีตัวเองไม่ได้');
      if (data.role === 'user' && u.role === 'admin' && d.users.filter(x => x.role === 'admin' && x.active).length <= 1) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
      const old = u.name;
      Object.assign(u, { name: name, full: data.full || '', role: data.role === 'admin' ? 'admin' : 'user', color: data.color || u.color, active: data.active !== false });
      if (old !== name) { d.jobs.forEach(j => { ['assignee', 'createdBy', 'updatedBy'].forEach(k => { if (j[k] === old) j[k] = name; }); }); d.logs.forEach(l => { if (l.member === old) l.member = name; }); }
    } else {
      pin = /^\d{4,6}$/.test(String(data.pin || '')) ? String(data.pin) : String(Math.floor(1000 + Math.random() * 9000));
      u = { id: uid('u_'), name: name, full: data.full || '', role: data.role === 'admin' ? 'admin' : 'user', color: data.color || COLORS[d.users.length % COLORS.length], active: true, pin: pin };
      d.users.push(u);
    }
    this.save(d); return { user: this.pub(u), pin: pin };
  },
  async resetPin(p) { const d = this.db(); this.admin(this.me(d)); const u = d.users.find(x => x.id === p.userId); if (!u) throw new Error('ไม่พบผู้ใช้'); u.pin = String(Math.floor(1000 + Math.random() * 9000)); this.save(d); return { userId: u.id, pin: u.pin }; }
};

const Remote = {
  async call(action, payload, conn) {
    const c = conn || S.conn;
    let res;
    try {
      res = await fetch(c.url, { method: 'POST', body: JSON.stringify({ token: conn ? '' : LS.get(tokenKey(), ''), action: action, payload: payload || {} }), redirect: 'follow' });
    } catch (e) { throw new Error('ติดต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตหรือ URL ของ Apps Script'); }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('URL นี้ไม่ใช่ API ของ KiwNgan หรือยังไม่ได้ Deploy แบบ "ทุกคน"'); }
    if (!data.ok) { const e = new Error(String(data.error || 'เกิดข้อผิดพลาด').replace(/^AUTH:/, '')); e.code = data.code; throw e; }
    return data.data;
  }
};
['ping', 'roster', 'login', 'logout', 'setPhoto', 'bootstrap', 'saveJob', 'deleteJob', 'startTimer', 'stopTimer', 'deleteLog', 'saveSettings', 'activity', 'changePin', 'saveUser', 'resetPin']
  .forEach(a => { Remote[a] = p => Remote.call(a, p); });
const api = () => (mode() === 'sheet' ? Remote : Demo);

/* ============ state mutations ============ */
function upsert(arr, obj) { const i = arr.findIndex(x => x.id === obj.id); if (i >= 0) arr[i] = Object.assign({}, arr[i], obj); else arr.push(obj); }
function applyStop(r) { if (r.log) upsert(S.logs, r.log); const j = jobById(r.jobId); if (j && r.minutes != null) j.minutes = r.minutes; }

async function load(silent) {
  if (!LS.get(tokenKey(), '')) return showLogin();
  S.sync = 'busy'; if (!silent && S.screen === 'app') renderShell();
  try {
    const d = await api().bootstrap();
    S.settings = normalizeSettings(d.settings);
    S.users = d.users || []; S.user = d.me; S.me = d.me.name;
    S.jobs = d.jobs || []; S.logs = d.logs || [];
    if (!S.draftDirty) S.draft = null;
    S.sync = 'ok'; S.syncErr = ''; S.lastSync = Date.now(); S.loaded = true;
    S.screen = 'app'; document.body.classList.remove('auth');
  } catch (e) {
    if (e.code === 'auth') { LS.del(tokenKey()); toast(e.message, true); return showLogin(); }
    S.sync = 'err'; S.syncErr = e.message;
    if (!S.loaded) { S.settings = normalizeSettings(null); S.loaded = true; }
    if (S.screen !== 'app') { S.login.err = e.message; return showLogin(true); }
    if (!silent) toast(e.message, true);
  }
  applyBrand(); render();
}

/* ============ login ============ */
async function showLogin(keepErr) {
  S.screen = 'login'; S.user = null; S.me = ''; closeEditor();
  document.body.classList.add('auth');
  const L = S.login; if (!keepErr) L.err = ''; L.pin = ''; L.busy = true; L.roster = null;
  renderLogin();
  try { const r = await api().roster(); L.roster = r.users || []; L.brand = r.brand || null; if (L.brand) { S.settings = normalizeSettings(Object.assign(S.settings || {}, L.brand)); applyBrand(); } }
  catch (e) { L.err = e.message; L.showConn = mode() === 'sheet'; }
  L.busy = false;
  if (L.roster && L.roster.length === 1) L.userId = L.roster[0].id;
  if (L.roster && !L.roster.some(u => u.id === L.userId)) L.userId = '';
  renderLogin();
}
function renderLogin() {
  const L = S.login, b = L.brand || S.settings || defaultSettings(), sel = (L.roster || []).find(u => u.id === L.userId);
  const dots = '<div class="pin-dots" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map(i => '<i class="' + (i < L.pin.length ? 'on' : '') + (i >= 4 ? ' opt' : '') + '"></i>').join('') + '</div>';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(k => k === 'clear' ? '<button type="button" class="key fn" data-pin="clear">ล้าง</button>'
    : k === 'back' ? '<button type="button" class="key fn" data-pin="back" aria-label="ลบ">⌫</button>' : '<button type="button" class="key" data-pin="' + k + '">' + k + '</button>').join('');
  const pinForm = extra => '<form id="pinForm" class="pin-form">' + (extra || '') + '<input id="pinIn" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" value="' + esc(L.pin) + '" aria-label="PIN">' + dots +
    '<div class="keypad">' + keys + '</div><button class="btn primary" type="submit"' + (L.pin.length < 4 ? ' disabled' : '') + '>' + (L.submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ') + '</button></form>';
  const c = S.conn || { url: '' };
  let body;
  if (L.busy) body = '<div class="loading" style="min-height:160px"><span class="spinner"></span>กำลังโหลด…</div>';
  else if (L.adminMode) body = '<button type="button" class="back-who" data-act="adminoff">‹ กลับ</button><h2 class="login-h">ผู้ดูแลระบบ</h2>' +
    pinForm('<div class="f"><label for="adminName">ชื่อผู้ดูแล</label><input id="adminName" value="' + esc(L.adminName || '') + '" autocomplete="username"></div>');
  else if (!sel) body = '<h2 class="login-h">เข้าสู่ระบบ</h2><p class="sub">เลือกชื่อของคุณ</p>' +
    ((L.roster || []).length ? '<div class="who-grid">' + L.roster.map(u => '<button type="button" class="who" data-who="' + esc(u.id) + '">' + avUser(u, 'lg') + '<b>' + esc(u.name) + '</b><small>' + esc(u.full || 'ผู้ใช้งาน') + '</small></button>').join('') + '</div>'
      : '<div class="empty" style="padding:20px 0"><b>ยังไม่มีผู้ใช้งาน</b>ผู้ดูแลระบบเพิ่มทีมงานได้ในหน้าตั้งค่า</div>');
  else body = '<button type="button" class="back-who" data-who="">‹ เปลี่ยนชื่อ</button><div class="pin-head">' + avUser(sel, 'lg') + '<div><b>' + esc(sel.name) + '</b><small>ใส่ PIN 4–6 หลัก</small></div></div>' + pinForm();

  const showConn = L.showConn;
  $('#view').innerHTML = '<div class="login"><div class="login-card">' +
    '<div class="login-brand">' + brandMark(b) + '<div><b>' + esc(b.appName || 'KiwNgan คิวงาน') + '</b><small>' + esc(b.company || '') + '</small></div></div>' +
    (mode() === 'demo' ? '<div class="banner"><span><b>โหมดทดลอง</b> ทุกคนใช้ PIN 1234 · ผู้ดูแลระบบเข้าที่ลิงก์ด้านล่าง ชื่อ "แอดมิน"</span></div>' : '') +
    body + (L.err ? '<div class="err" role="alert">' + esc(L.err) + '</div>' : '') +
    '<div class="login-foot">' +
      (showConn ? '<div class="f"><label for="cUrl">URL ฐานข้อมูล (Apps Script /exec)</label><input id="cUrl" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url" autocomplete="off"></div><div class="top-actions"><button class="btn primary sm" data-act="connect">เชื่อมต่อ</button>' + (mode() === 'sheet' ? '<button class="btn sm" data-act="disconnect">ใช้โหมดทดลอง</button>' : '') + '</div>'
        : '<div class="top-actions" style="justify-content:space-between">' + (!L.adminMode ? '<button type="button" class="btn ghost sm" data-act="adminon">ผู้ดูแลระบบ</button>' : '<span></span>') +
          (mode() === 'demo' ? '<button type="button" class="btn ghost sm" data-act="showconn">เชื่อมต่อ Google Sheet ของทีม</button>' : '') + '</div>') +
    '</div></div></div>';
  const focus = L.adminMode && !L.adminName ? $('#adminName') : $('#pinIn');
  if (focus && (!('ontouchstart' in window) || focus.id === 'adminName')) focus.focus();
}
async function doLogin() {
  const L = S.login; if (L.pin.length < 4 || L.submitting) return;
  if (L.adminMode) {
    const n = $('#adminName'); if (n) L.adminName = n.value;
    L.adminName = String(L.adminName || '').trim();
    if (!L.adminName) { L.err = 'ใส่ชื่อผู้ดูแล'; return renderLogin(); }
  }
  L.submitting = true; L.err = ''; renderLogin();
  try {
    const r = await api().login(L.adminMode ? { name: L.adminName, pin: L.pin } : { userId: L.userId, pin: L.pin });
    LS.set(tokenKey(), r.token); L.submitting = false; L.pin = '';
    S.loaded = false; await load(false);
    if (S.user) toast('สวัสดี ' + S.user.name);
  } catch (e) { L.submitting = false; L.err = e.message; L.pin = ''; renderLogin(); }
}
async function logout() {
  try { await api().logout({}); } catch (e) {}
  LS.del(tokenKey()); S.jobs = []; S.logs = []; S.users = []; S.login.userId = ''; S.login.adminMode = false; showLogin();
}

async function mutate(fn, okMsg) {
  try { const r = await fn(); S.sync = 'ok'; S.lastSync = Date.now(); if (okMsg) toast(okMsg); return r; }
  catch (e) {
    if (e.code === 'auth') { LS.del(tokenKey()); toast(e.message, true); showLogin(); throw e; }
    S.sync = 'err'; S.syncErr = e.message; toast(e.message, true); throw e;
  }
}

async function saveJob(job, msg) {
  const r = await mutate(() => api().saveJob({ job: job }), msg);
  upsert(S.jobs, r.job); render(); return r.job;
}

async function moveJob(id, status) {
  const j = jobById(id); if (!j || j.status === status) return;
  if (!canEdit(j)) { toast('เปลี่ยนสถานะได้เฉพาะงานของตัวเอง งานนี้เป็นของ ' + (j.assignee || 'คนอื่น'), true); return; }
  const prev = clone(j);
  j.status = status;
  if (status === 'done') j.finishedAt = nowLocal(); else j.finishedAt = '';
  if ((status === 'doing' || status === 'review') && !j.startedAt) j.startedAt = nowLocal();
  render();
  try {
    const run = runningOf(id);
    if (status === 'done' && run) applyStop(await api().stopTimer({ logId: run.id }));
    const p = { id: j.id, code: j.code, status: status, finishedAt: j.finishedAt, startedAt: j.startedAt, baseUpdatedAt: prev.updatedAt };
    await saveJob(p, j.code + ' → ' + ST[status].label);
  } catch (e) { upsert(S.jobs, prev); render(); }
}

async function startTimer(jobId) {
  const r = await mutate(() => api().startTimer({ jobId: jobId, member: S.me }), 'เริ่มจับเวลาแล้ว');
  (r.closed || []).forEach(l => applyStop({ log: l, jobId: l.jobId }));
  upsert(S.logs, r.log); if (r.job) upsert(S.jobs, r.job);
  if (r.closed && r.closed.length) load(true); else render();
}
async function stopTimer(logId) {
  const r = await mutate(() => api().stopTimer({ logId: logId }), 'หยุดจับเวลาแล้ว');
  applyStop(r); render();
}

/* ============ brand ============ */
function applyBrand() {
  const s = S.settings || defaultSettings();
  document.documentElement.style.setProperty('--brand', /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#0B6B70');
  document.title = s.appName || 'KiwNgan คิวงาน';
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', s.accent || '#0B6B70');
}
function brandMark(s) {
  return s.logo ? '<div class="brand-mark"><img src="' + esc(s.logo) + '" alt=""></div>'
    : '<div class="brand-mark">' + esc(String(s.appName || 'K').replace(/\s.*/, '').slice(0, 2)) + '</div>';
}

/* ============ render: shell ============ */
function navHtml(withCount) {
  const late = S.jobs.filter(isLate).length;
  return VIEWS.map(v => '<button data-view="' + v.id + '" aria-current="' + (S.view === v.id) + '">' + I[v.id] + '<span>' + v.label + '</span>' +
    (withCount && v.id === 'board' && late ? '<span class="count">' + late + '</span>' : '') + '</button>').join('');
}
function renderShell() {
  const s = S.settings || defaultSettings();
  $('#brand').innerHTML = brandMark(s) + '<div><b>' + esc(s.appName) + '</b><small>' + esc(s.company) + '</small></div>';
  $('#nav').innerHTML = navHtml(true);
  $('#tabbar').innerHTML = navHtml(true);
  const connCls = mode() === 'demo' ? '' : (S.sync === 'err' ? 'err' : 'ok');
  const connTxt = mode() === 'demo' ? 'โหมดทดลอง (เก็บในเครื่องนี้)' : (S.sync === 'err' ? 'เชื่อมต่อไม่ได้' : S.sync === 'busy' ? 'กำลังซิงก์…' : (isAdmin() ? 'เชื่อมต่อ Google Sheet' : 'ซิงก์ข้อมูลแล้ว'));
  $('#railFoot').innerHTML = '<button class="me-chip" data-go="settings" data-sec="me">' + av(S.me) + '<span><small>' + (isAdmin() ? 'แอดมิน' : 'ผู้ใช้งาน') + '</small><b>' + esc(S.me) + '</b></span></button>' +
    '<div class="conn ' + connCls + '"><i></i>' + connTxt + '</div>';
  renderTimerbar();
}
function renderTimerbar() {
  const r = myRunning(), el = $('#timerbar');
  if (!r) { el.hidden = true; el.innerHTML = ''; return; }
  const j = jobById(r.jobId);
  el.hidden = false;
  el.innerHTML = '<span class="pulse"></span><button class="t-job" data-open="' + esc(r.jobId) + '">' + esc(j ? j.code : 'งาน') + '</button>' +
    '<span class="t-clock" data-since="' + esc(r.start) + '">' + clock(Date.now() - parseLocal(r.start)) + '</span>' +
    '<button class="btn sm" data-act="stop" data-log="' + esc(r.id) + '">' + I.stop + 'หยุด</button>';
}

function render() {
  if (!S.settings || S.screen !== 'app') return;
  renderShell();
  const v = $('#view');
  let h = banner();
  if (S.view === 'board') h += viewBoard();
  else if (S.view === 'list') h += viewList();
  else if (S.view === 'team') h += viewTeam();
  else if (S.view === 'report') h += viewReport();
  else if (S.view === 'settings') h += viewSettings();
  else h += viewHome();
  v.innerHTML = h;
  if (S.edit) renderEditor();
}

function banner() {
  if (mode() === 'demo') return '<div class="banner"><span><b>โหมดทดลอง</b> ข้อมูลตัวอย่างเก็บในเบราว์เซอร์นี้เท่านั้น ลองเข้าเป็นผู้ใช้งาน (ต้น ฝน บอส) หรือผู้ดูแลระบบ เพื่อดูสิทธิ์ที่ต่างกัน</span>' + (isAdmin() ? '<button class="btn sm" data-go="settings" data-sec="conn">เชื่อมต่อ Google Sheet</button>' : '') + '</div>';
  if (S.sync === 'err') return '<div class="banner err"><span><b>ซิงก์ไม่สำเร็จ</b> ' + esc(S.syncErr) + '</span><button class="btn sm" data-act="refresh">' + I.refresh + 'ลองอีกครั้ง</button></div>';
  return '';
}

function topbar(title, sub, extra) {
  const s = S.settings;
  const d = new Date();
  return '<div class="topbar"><div><div class="eyebrow">' + esc(s.company) + ' · วัน' + TH_D[d.getDay()] + ' ' + fdY(today()) + '</div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
    '<div class="top-actions">' + (extra || '') + (mode() === 'sheet' ? '<button class="btn" data-act="refresh" title="ดึงข้อมูลล่าสุด">' + I.refresh + '<span>รีเฟรช</span></button>' : '') +
    '<button class="btn primary new" data-act="new">' + I.plus + 'เพิ่มงาน</button></div></div>';
}

/* ============ render: home ============ */
function viewHome() {
  const t = today(), open = S.jobs.filter(isOpen), late = open.filter(isLate), urgent = open.filter(j => j.priority === 'urgent');
  const m = t.slice(0, 7), doneM = S.jobs.filter(j => j.status === 'done' && finDate(j).slice(0, 7) === m);
  const okM = doneM.filter(onTime).length;
  const pct = doneM.length ? Math.round(okM / doneM.length * 100) : null;
  const doing = open.filter(j => j.status === 'doing').length, queue = open.filter(j => j.status === 'queue').length;

  const kp = [
    { k: 'var(--doing)', l: 'งานที่ยังไม่เสร็จ', n: open.length, s: 'กำลังทำ ' + doing + ' · รอคิว ' + queue, f: 'open' },
    { k: 'var(--late)', l: 'เลยกำหนดส่ง', n: late.length, s: late.length ? 'ต้องเร่งปิดงาน' : 'ไม่มีงานค้างเกินกำหนด', f: 'late' },
    { k: 'var(--urgent)', l: 'งานด่วนคงค้าง', n: urgent.length, s: 'ติดธงงานด่วน', f: 'urgent' },
    { k: 'var(--done)', l: 'เสร็จเดือนนี้', n: doneM.length, s: pct === null ? 'ยังไม่มีงานเสร็จ' : 'ตรงเวลา ' + pct + '%', f: 'done' }
  ].map(x => '<button class="kpi" style="--k:' + x.k + '" data-filter-go="' + x.f + '"><span>' + x.l + '</span><b>' + x.n + '</b><small>' + x.s + '</small></button>').join('');

  // me
  let mine = '';
  {
    const my = open.filter(j => j.assignee === S.me).sort(sortOpen);
    mine = '<section class="panel"><div class="panel-h"><div><h2>งานของ' + esc(S.me) + '</h2><div class="sub">' + my.length + ' งานค้าง · ใช้เวลาวันนี้ ' + fdur(minutesOn(t, S.me)) + '</div></div><button class="btn ghost sm" data-mine="1">ดูบนบอร์ด</button></div>' +
      (my.length ? '<div class="alist">' + my.slice(0, 5).map(aItem).join('') + '</div>' : '<div class="empty"><b>ไม่มีงานค้าง</b>กดปุ่ม + เพื่อรับงานใหม่</div>') + '</section>';
  }

  // 30-day chart
  const days = []; for (let i = 29; i >= 0; i--) days.push(addDays(t, -i));
  const per = {}; days.forEach(d => per[d] = { ok: 0, late: 0 });
  const done30 = S.jobs.filter(j => j.status === 'done' && per[finDate(j)]);
  done30.forEach(j => per[finDate(j)][onTime(j) ? 'ok' : 'late']++);
  let max = Math.max(2, ...days.map(d => per[d].ok + per[d].late)); if (max % 2) max++;
  const bars = days.map((d, i) => {
    const p = per[d], n = p.ok + p.late, wd = parseLocal(d).getDay();
    const lab = (i % 5 === 4 || i === 0) ? '<em>' + parseLocal(d).getDate() + '</em>' : '';
    return '<div class="bar' + (d === t ? ' today' : '') + (wd === 0 || wd === 6 ? ' wk' : '') + '"' + (n ? ' data-tip="' + fd(d) + ' · เสร็จ ' + n + (p.late ? ' (ช้า ' + p.late + ')' : '') + '"' : '') + '><div class="stack" style="height:' + (n / max * 100) + '%">' +
      (p.ok ? '<i style="flex:' + p.ok + '"></i>' : '') + (p.late ? '<i class="late" style="flex:' + p.late + '"></i>' : '') + '</div>' + lab + '</div>';
  }).join('');
  const ok30 = done30.filter(onTime).length;
  const withMin = done30.filter(j => j.minutes > 0);
  const avgMin = withMin.length ? withMin.reduce((s, j) => s + j.minutes, 0) / withMin.length : 0;
  const leads = done30.filter(j => j.received).map(j => Math.max(0, daysBetween(j.received, finDate(j))));
  const avgLead = leads.length ? (leads.reduce((a, b) => a + b, 0) / leads.length) : 0;

  // attention
  const att = open.filter(j => isLate(j) || j.priority === 'urgent' || (j.due && daysBetween(t, j.due) <= 1)).sort(sortOpen).slice(0, 7);

  // workload
  const names = members().map(x => x.name);
  if (open.some(j => !j.assignee)) names.push('');
  const loads = names.map(n => { const js = open.filter(j => (j.assignee || '') === n); return { n: n, js: js }; });
  const topLoad = Math.max(1, ...loads.map(x => x.js.length));
  const loadH = loads.map(x => {
    const c = st => x.js.filter(j => j.status === st).length;
    const seg = ['doing', 'review', 'queue', 'hold'].map(st => c(st) ? '<i style="width:' + (c(st) / topLoad * 100) + '%;background:var(--' + st + ')" title="' + ST[st].label + ' ' + c(st) + '"></i>' : '').join('');
    return '<div class="hb"><span>' + av(x.n) + esc(x.n || 'ยังไม่มอบหมาย') + '</span><div class="track">' + seg + '</div><b>' + x.js.length + '</b></div>';
  }).join('') || '<div class="sub">ยังไม่มีรายชื่อทีมงาน</div>';

  // by group 30d
  const agg = {}; done30.forEach(j => { const k = j.group || 'ไม่ระบุ'; agg[k] = (agg[k] || 0) + 1; });
  const arr = Object.entries(agg).sort((a, b) => b[1] - a[1]); const topG = arr.length ? arr[0][1] : 1;
  const grpH = arr.length ? arr.map(a => '<div class="hb"><span title="' + esc(a[0]) + '">' + esc(groupShort(a[0])) + '</span><div class="track"><i style="width:' + (a[1] / topG * 100) + '%;background:var(--accent)"></i></div><b>' + a[1] + '</b></div>').join('') : '<div class="sub">ยังไม่มีงานเสร็จใน 30 วัน</div>';

  return topbar('สวัสดี' + (S.me ? ' ' + esc(S.me) : ''), 'ภาพรวมคิวงานของทีมวันนี้') +
    '<div class="kpis">' + kp + '</div>' +
    '<div class="grid2">' + mine +
      '<section class="panel"><div class="panel-h"><div><h2>ต้องจัดการก่อน</h2><div class="sub">เลยกำหนด → ด่วน → ส่งภายในพรุ่งนี้</div></div><button class="btn ghost sm" data-filter-go="open">ดูทั้งหมด</button></div>' +
      (att.length ? '<div class="alist">' + att.map(aItem).join('') + '</div>' : '<div class="empty"><b>ไม่มีงานเร่งด่วน</b>คิวงานอยู่ในกำหนดทั้งหมด</div>') + '</section>' +
    '</div>' +
    '<section class="panel"><div class="panel-h"><div><h2>งานที่เสร็จ 30 วันล่าสุด</h2><div class="sub">นับตามวันที่ปิดงาน</div></div><div class="legend"><span><i style="background:var(--accent)"></i>ตรงเวลา</span><span><i style="background:var(--urgent)"></i>ช้ากว่ากำหนด</span></div></div>' +
      '<div class="minis"><div class="mini"><span>งานเสร็จ</span><b>' + done30.length + '</b></div><div class="mini"><span>ตรงเวลา</span><b>' + (done30.length ? Math.round(ok30 / done30.length * 100) + '%' : '–') + '</b></div>' +
      '<div class="mini"><span>เวลาทำเฉลี่ย/งาน</span><b>' + (avgMin ? fdur(avgMin) : '–') + '</b></div><div class="mini"><span>รับงาน → เสร็จ เฉลี่ย</span><b>' + (leads.length ? avgLead.toFixed(1) + ' วัน' : '–') + '</b></div></div>' +
      '<div class="chart"><div class="y"><span>' + max + '</span><span>' + (max / 2) + '</span><span>0</span></div><div class="plot">' + bars + '</div></div></section>' +
    '<div class="grid2 even">' +
      '<section class="panel"><div class="panel-h"><div><h2>ภาระงานรายคน</h2><div class="sub">งานที่ยังไม่เสร็จ แยกตามสถานะ</div></div><div class="legend"><span><i style="background:var(--doing)"></i>กำลังทำ</span><span><i style="background:var(--review)"></i>รอตรวจ</span><span><i style="background:var(--queue)"></i>รอคิว</span></div></div><div class="hbars">' + loadH + '</div></section>' +
      '<section class="panel"><div class="panel-h"><div><h2>งานเสร็จตามกลุ่มงาน</h2><div class="sub">30 วันล่าสุด</div></div></div><div class="hbars">' + grpH + '</div></section>' +
    '</div>';
}
function minutesOn(date, member) {
  return S.logs.filter(l => l.member === member && (l.start || '').slice(0, 10) === date)
    .reduce((s, l) => s + (l.end ? l.minutes : (Date.now() - parseLocal(l.start)) / 60000), 0);
}
function aItem(j) {
  const di = dueInfo(j), run = runningOf(j.id);
  return '<button class="aitem" data-open="' + esc(j.id) + '">' + av(j.assignee) + '<span style="min-width:0"><span class="code">' + esc(j.code) + '</span> ' +
    (j.priority === 'urgent' ? '<span class="tag urgent">ด่วน</span> ' : '') + (run ? '<span class="tag late">● จับเวลา</span>' : '') +
    '<small>' + esc([j.title, groupShort(j.group), j.taskType].filter(Boolean).join(' · ')) + '</small></span>' +
    '<span style="text-align:right">' + stPill(j) + '<small class="' + (di.cls === 'late' ? 'tag late' : '') + '">' + esc(di.text) + '</small></span></button>';
}

/* ============ render: board ============ */
function filterBar(opts) {
  const ms = members();
  return '<div class="filters"><label class="search">' + I.search + '<input id="q" type="search" placeholder="ค้นหาเลข Job, ลูกค้า, sale, หมายเหตุ…" value="' + esc(S.f.q) + '" aria-label="ค้นหางาน"></label>' +
    '<select class="sel" id="fMember" aria-label="ทีมงาน"><option value="all">ทุกคน</option>' + (S.me ? '<option value="__me"' + (S.f.member === '__me' ? ' selected' : '') + '>งานของฉัน (' + esc(S.me) + ')</option>' : '') +
    ms.map(x => '<option value="' + esc(x.name) + '"' + (S.f.member === x.name ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="__none"' + (S.f.member === '__none' ? ' selected' : '') + '>ยังไม่มอบหมาย</option></select>' +
    '<select class="sel" id="fGroup" aria-label="กลุ่มงาน"><option value="all">ทุกกลุ่มงาน</option>' + (S.settings.groups || []).map(g => '<option' + (S.f.group === g ? ' selected' : '') + '>' + esc(g) + '</option>').join('') + '</select>' +
    (opts || '') + '</div>';
}
function matchBase(j) {
  const f = S.f, q = f.q.trim().toLowerCase();
  if (f.member === '__me' && j.assignee !== S.me) return false;
  if (f.member === '__none' && j.assignee) return false;
  if (f.member !== 'all' && f.member !== '__me' && f.member !== '__none' && j.assignee !== f.member) return false;
  if (f.group !== 'all' && j.group !== f.group) return false;
  if (q && [j.code, j.title, j.sale, j.assignee, j.group, j.taskType, j.note].join(' ').toLowerCase().indexOf(q) < 0) return false;
  return true;
}
function card(j) {
  const di = dueInfo(j), run = runningOf(j.id), late = isLate(j);
  const nextSt = j.status === 'hold' ? 'doing' : FLOW[FLOW.indexOf(j.status) + 1];
  const mins = totalMinutes(j);
  const mine = canEdit(j);
  return '<div class="card' + (late ? ' is-late' : '') + (j.priority === 'urgent' ? ' is-urgent' : '') + (mine ? '' : ' ro') + '" draggable="' + mine + '" data-id="' + esc(j.id) + '" data-open="' + esc(j.id) + '" tabindex="0" role="button">' +
    '<div class="card-top"><div class="code">' + esc(j.code) + '</div>' +
    (nextSt && mine ? '<button class="adv" data-move="' + esc(j.id) + '" data-to="' + nextSt + '" title="เลื่อนเป็น ' + ST[nextSt].label + '" aria-label="เลื่อนเป็น ' + ST[nextSt].label + '">' + I.next + '</button>' : '') + '</div>' +
    (j.title ? '<div class="title">' + esc(j.title) + '</div>' : '') +
    '<div class="tags">' + (j.priority === 'urgent' ? '<span class="tag urgent">ด่วน</span>' : '') + (j.revision ? '<span class="tag rev">แก้ไข</span>' : '') + (j.status === 'hold' ? '<span class="pill s-hold">พักไว้</span>' : '') +
      '<span>' + esc(groupShort(j.group) || '–') + '</span>' + lvBars(j.level) + '<span>' + esc(j.taskType || '') + '</span></div>' +
    '<div class="card-foot">' + av(j.assignee) + (run ? '<span class="live" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : (mins ? '<span>' + fdur(mins) + '</span>' : '<span>' + esc(j.sale ? 'Sale ' + j.sale : '') + '</span>')) +
      '<span class="due ' + di.cls + '">' + esc(di.text) + '</span></div></div>';
}
function viewBoard() {
  const base = S.jobs.filter(matchBase);
  const cols = FLOW.slice();
  const hold = base.filter(j => j.status === 'hold');
  const cutoff = addDays(today(), -14);
  const colHtml = cols.map(st => {
    let js = base.filter(j => j.status === st || (st === 'queue' && j.status === 'hold'));
    let more = '';
    if (st === 'done') {
      const all = js.filter(j => finDate(j) >= cutoff).sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
      js = all.slice(0, 25);
      more = '<div class="col-more">แสดงงานที่เสร็จใน 14 วัน · <button class="btn ghost sm" data-filter-go="done">ดูทั้งหมด</button></div>';
    } else js.sort(sortOpen);
    return '<section class="col ' + ST[st].cls + '" data-col="' + st + '"><div class="col-h"><span class="dot"></span><b>' + ST[st].label + '</b><span class="n">' + js.length + '</span></div>' +
      '<div class="col-list">' + (js.length ? js.map(card).join('') : '<div class="col-more">ลากงานมาวางที่นี่</div>') + '</div>' + more + '</section>';
  }).join('');
  return topbar('บอร์ดงาน', (isAdmin() ? 'ลากการ์ดเพื่อเปลี่ยนสถานะ หรือกดลูกศรเพื่อเลื่อนไปขั้นถัดไป' : 'ลากหรือกดลูกศรบนการ์ดของคุณเพื่อเปลี่ยนสถานะ งานของคนอื่นดูได้อย่างเดียว') + (hold.length ? ' · พักไว้ ' + hold.length + ' งาน (อยู่ในช่องรอคิว)' : '')) +
    filterBar() + '<div class="board-scroll"><div class="board">' + colHtml + '</div></div>';
}

/* ============ render: list ============ */
function listRows() {
  const f = S.f, t = today();
  return S.jobs.filter(matchBase).filter(j => {
    if (f.status === 'open') return isOpen(j);
    if (f.status === 'late') return isLate(j);
    if (f.status === 'urgent') return isOpen(j) && j.priority === 'urgent';
    if (f.status === 'done') return j.status === 'done' && (!f.month || finDate(j).slice(0, 7) === f.month);
    if (ST[f.status]) return j.status === f.status;
    return true;
  }).sort((a, b) => f.status === 'done' || f.status === 'all'
    ? (isOpen(a) !== isOpen(b) ? (isOpen(a) ? -1 : 1) : (isOpen(a) ? sortOpen(a, b) : String(b.finishedAt).localeCompare(String(a.finishedAt))))
    : sortOpen(a, b));
}
function viewList() {
  const base = S.jobs.filter(matchBase);
  const n = k => base.filter(j => k === 'open' ? isOpen(j) : k === 'late' ? isLate(j) : k === 'urgent' ? isOpen(j) && j.priority === 'urgent' : k === 'all' ? true : j.status === k).length;
  const chips = [['open', 'ยังไม่เสร็จ'], ['late', 'เลยกำหนด'], ['urgent', 'ด่วน'], ['doing', 'กำลังทำ'], ['review', 'รอตรวจ/แก้'], ['hold', 'พักไว้'], ['done', 'เสร็จแล้ว'], ['all', 'ทั้งหมด']]
    .map(x => '<button class="chip" data-fstatus="' + x[0] + '" aria-pressed="' + (S.f.status === x[0]) + '">' + x[1] + ' <b>' + n(x[0]) + '</b></button>').join('');
  const months = {}; S.jobs.forEach(j => { if (finDate(j)) months[finDate(j).slice(0, 7)] = 1; });
  const monthSel = S.f.status === 'done' ? '<select class="sel" id="fMonth" aria-label="เดือนที่เสร็จ"><option value="">ทุกเดือน</option>' + Object.keys(months).sort().reverse().map(m => '<option value="' + m + '"' + (S.f.month === m ? ' selected' : '') + '>' + monthLabel(m) + '</option>').join('') + '</select>' : '';
  const rows = listRows();
  const body = rows.length ? rows.map(j => {
    const di = dueInfo(j), run = runningOf(j.id), mins = totalMinutes(j);
    return '<div class="row' + (isLate(j) ? ' is-late' : '') + (j.priority === 'urgent' ? ' is-urgent' : '') + '" data-open="' + esc(j.id) + '" tabindex="0" role="button">' +
      '<div class="cell c-main"><div class="code">' + esc(j.code) + '</div><div class="meta">' + (j.priority === 'urgent' ? '<span class="tag urgent">ด่วน</span>' : '') + (j.revision ? '<span class="tag rev">แก้ไข</span>' : '') +
        (j.title ? '<span>' + esc(j.title) + '</span>' : '') + '<span>' + esc(groupShort(j.group)) + '</span>' + lvBars(j.level) + '<span>' + esc(j.taskType) + '</span></div></div>' +
      '<div class="cell c-who"><span class="who">' + av(j.assignee) + '<span>' + esc(j.assignee || 'ยังไม่มอบหมาย') + '<small>Sale ' + esc(j.sale || '–') + '</small></span></span></div>' +
      '<div class="cell c-time">' + (run ? '<span class="tag late" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : '<span class="tnum">' + (mins ? fdur(mins) : '–') + '</span>') + '<small>เริ่ม ' + fdt(j.startedAt) + '</small></div>' +
      '<div class="cell">รับ ' + fd(j.received) + '<small>' + esc(j.taskType || '') + '</small></div>' +
      '<div class="cell c-due"><span class="' + (di.cls === 'late' ? 'tag late' : '') + '">' + esc(di.text) + '</span>' + (j.status !== 'done' && j.due ? '<small>กำหนด ' + fdY(j.due) + '</small>' : '') + '</div>' +
      '<div class="cell c-st">' + stPill(j) + '</div></div>';
  }).join('') : '<div class="empty"><b>ไม่พบงาน</b>ลองเปลี่ยนตัวกรองหรือคำค้น</div>';
  return topbar('รายการงาน', rows.length + ' รายการ จากทั้งหมด ' + S.jobs.length + ' งาน', '<button class="btn" data-act="csv">' + I.download + '<span>ส่งออก CSV</span></button>') +
    filterBar(monthSel) + '<div class="chips">' + chips + '</div>' +
    '<div class="list"><div class="lhead"><span>JOB</span><span>ผู้รับผิดชอบ</span><span>เวลาทำงาน</span><span>วันที่รับ</span><span>กำหนดส่ง</span><span>สถานะ</span></div>' + body + '</div>';
}
function exportCsv() {
  const rows = listRows();
  const head = ['เลข Job', 'ลูกค้า/โครงการ', 'กลุ่มงาน', 'รายละเอียด', 'จำนวน', 'ระดับ', 'ผู้รับผิดชอบ', 'Sale', 'ด่วน', 'งานแก้ไข', 'สถานะ', 'วันที่รับ', 'กำหนดส่ง', 'เริ่มทำ', 'เสร็จ', 'ตรงเวลา', 'เวลาทำ (นาที)', 'หมายเหตุ'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(',')].concat(rows.map(j => [j.code, j.title, j.group, j.taskType, j.qty === 'multi' ? 'หลายชิ้น' : 'ชิ้นเดียว', j.level, j.assignee, j.sale, j.priority === 'urgent' ? 'ใช่' : '', j.revision ? 'ใช่' : '',
    isLate(j) ? 'เลยกำหนด' : ST[j.status].label, j.received, j.due, j.startedAt.replace('T', ' '), (j.finishedAt || '').replace('T', ' '), j.status === 'done' ? (onTime(j) ? 'ตรงเวลา' : 'ช้า') : '', Math.round(totalMinutes(j)), j.note].map(q).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kiwngan-' + today() + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('ส่งออก ' + rows.length + ' รายการแล้ว');
}

/* ============ render: team ============ */
function viewTeam() {
  const t = today(), m = t.slice(0, 7);
  const ms = members();
  if (!ms.length) return topbar('ทีมงาน', '') + '<div class="panel"><div class="empty"><b>ยังไม่มีรายชื่อทีมงาน</b>เพิ่มรายชื่อได้ที่หน้าตั้งค่า</div><button class="btn primary" data-go="settings" data-sec="team">เพิ่มทีมงาน</button></div>';
  const cards = ms.map(x => {
    const mine = S.jobs.filter(j => j.assignee === x.name), open = mine.filter(isOpen), late = open.filter(isLate);
    const doneM = mine.filter(j => j.status === 'done' && finDate(j).slice(0, 7) === m);
    const ok = doneM.filter(onTime).length, pct = doneM.length ? Math.round(ok / doneM.length * 100) : 0;
    const minsM = S.logs.filter(l => l.member === x.name && (l.start || '').slice(0, 7) === m).reduce((s, l) => s + (l.end ? l.minutes : (Date.now() - parseLocal(l.start)) / 60000), 0);
    const lv = doneM.length ? (doneM.reduce((s, j) => s + (+j.level || 0), 0) / doneM.length).toFixed(1) : '–';
    const run = S.logs.find(l => !l.end && l.member === x.name), rj = run && jobById(run.jobId);
    return '<div class="tcard"><div class="tcard-h">' + av(x.name, 'lg') + '<div><b>' + esc(x.name) + (x.name === S.me ? ' <span class="tag rev">คุณ</span>' : '') + '</b><small>' + esc(x.full || '') + '</small></div></div>' +
      (rj ? '<button class="now-on" data-open="' + esc(rj.id) + '" style="border:0;text-align:left"><span class="tag late" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>กำลังทำ <b>' + esc(rj.code) + '</b></button>' : '') +
      '<div class="tstats"><div><span>งานค้าง</span><b>' + open.length + '</b></div><div><span>เลยกำหนด</span><b style="color:' + (late.length ? 'var(--late)' : 'inherit') + '">' + late.length + '</b></div><div><span>เสร็จเดือนนี้</span><b>' + doneM.length + '</b></div></div>' +
      '<div><div class="panel-h" style="margin-bottom:6px"><span class="sub">ตรงเวลา ' + (doneM.length ? pct + '%' : '–') + '</span><span class="sub">เวลาทำ ' + fdur(minsM) + ' · ยากเฉลี่ย ' + lv + '</span></div><div class="meter"><i style="width:' + pct + '%"></i></div></div>' +
      '<button class="btn" data-memberjobs="' + esc(x.name) + '">ดูงานของ' + esc(x.name) + '</button></div>';
  }).join('');
  return topbar('ทีมงาน', 'ภาระงานและผลงานรายคน เดือน' + monthLabel(m)) + '<div class="teams">' + cards + '</div>';
}

/* ============ render: report (printable) ============ */
const R_SECTIONS = [['kpi', 'สรุปตัวเลข'], ['people', 'สรุปรายคน'], ['groups', 'สรุปตามกลุ่มงาน'], ['jobs', 'รายการงาน'], ['sign', 'ช่องลงชื่อ']];
const R_PRESETS = [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนก่อน'], ['year', 'ปีนี้'], ['custom', 'กำหนดเอง']];
const R_SCOPES = [['all', 'งานที่เกี่ยวข้องในช่วงนี้'], ['received', 'งานที่รับเข้าในช่วงนี้'], ['done', 'งานที่เสร็จในช่วงนี้'], ['open', 'งานที่ยังค้างอยู่']];
function reportState() {
  if (!S.r) {
    const saved = LS.get('report', {}) || {};
    S.r = Object.assign({ preset: 'month', from: '', to: '', member: 'all', group: 'all', scope: 'all', orient: 'portrait', sec: { kpi: true, people: true, groups: true, jobs: true, sign: false } }, saved);
    S.r.sec = Object.assign({ kpi: true, people: true, groups: true, jobs: true, sign: false }, saved.sec || {});
    if (S.r.preset !== 'custom' || !S.r.from || !S.r.to) applyPreset(S.r.preset === 'custom' ? 'month' : S.r.preset);
  }
  return S.r;
}
function saveReportState() { const r = S.r; LS.set('report', { preset: r.preset, from: r.preset === 'custom' ? r.from : '', to: r.preset === 'custom' ? r.to : '', scope: r.scope, orient: r.orient, sec: r.sec }); }
function applyPreset(p) {
  const r = S.r, d = new Date(), t = today();
  r.preset = p;
  if (p === 'today') { r.from = r.to = t; }
  else if (p === 'week') { const off = (d.getDay() + 6) % 7; r.from = addDays(t, -off); r.to = addDays(r.from, 6); }
  else if (p === 'month') { r.from = t.slice(0, 8) + '01'; r.to = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  else if (p === 'lastmonth') { r.from = isoOf(new Date(d.getFullYear(), d.getMonth() - 1, 1)); r.to = isoOf(new Date(d.getFullYear(), d.getMonth(), 0)); }
  else if (p === 'year') { r.from = d.getFullYear() + '-01-01'; r.to = d.getFullYear() + '-12-31'; }
}
function fdFull(iso) { if (!iso) return '–'; const d = parseLocal(iso); return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
function rangeLabel(r) { return r.from === r.to ? fdFull(r.from) : fdFull(r.from) + ' – ' + fdFull(r.to); }
function logMinutes(l) { return l.end ? (+l.minutes || 0) : Math.max(0, (Date.now() - parseLocal(l.start)) / 60000); }
const inR = (iso, r) => !!iso && iso >= r.from && iso <= r.to;

function reportData() {
  const r = reportState();
  const who = j => j.assignee || '';
  const base = S.jobs.filter(j => (r.member === 'all' || (r.member === '__none' ? !j.assignee : j.assignee === r.member)) && (r.group === 'all' || j.group === r.group));
  const recv = j => inR(j.received, r), fin = j => j.status === 'done' && inR(finDate(j), r);
  const openNow = j => isOpen(j) && (!j.received || j.received <= r.to);
  const scoped = base.filter(j => r.scope === 'received' ? recv(j) : r.scope === 'done' ? fin(j) : r.scope === 'open' ? openNow(j) : (recv(j) || fin(j) || openNow(j)));
  const ids = {}; base.forEach(j => { ids[j.id] = j; });
  const logs = S.logs.filter(l => inR((l.start || '').slice(0, 10), r) && ids[l.jobId] && (r.member === 'all' || r.member === '__none' || l.member === r.member));
  const minsBy = (key, val) => logs.filter(l => (key === 'member' ? l.member : (ids[l.jobId] || {})[key]) === val).reduce((s, l) => s + logMinutes(l), 0);
  const stat = js => {
    const done = js.filter(fin), ok = done.filter(onTime).length, open = js.filter(openNow);
    return { recv: js.filter(recv).length, done: done.length, ok: ok, late: done.length - ok, pct: done.length ? Math.round(ok / done.length * 100) : null, open: open.length, overdue: open.filter(isLate).length };
  };
  const total = stat(base); total.mins = logs.reduce((s, l) => s + logMinutes(l), 0);
  // people: active members first, then anyone else appearing in the data
  const names = []; const add = n => { if (names.indexOf(n) < 0) names.push(n); };
  if (r.member !== 'all') add(r.member === '__none' ? '' : r.member);
  else { members().forEach(m => add(m.name)); base.forEach(j => { if (recv(j) || fin(j) || openNow(j)) add(who(j)); }); logs.forEach(l => add(l.member)); }
  const people = names.map(n => Object.assign({ name: n, mins: n ? minsBy('member', n) : 0 }, stat(base.filter(j => who(j) === n))))
    .filter(p => r.member !== 'all' || p.recv || p.done || p.open || p.mins || (p.name && memberBy(p.name) && memberBy(p.name).role !== 'admin'));
  const gnames = (S.settings.groups || []).slice(); base.forEach(j => { if (j.group && gnames.indexOf(j.group) < 0) gnames.push(j.group); });
  const groups = gnames.map(g => { const js = base.filter(j => j.group === g), s = stat(js), done = js.filter(fin); return Object.assign({ name: g, mins: minsBy('group', g), avg: done.length ? done.reduce((a, j) => a + (j.minutes || 0), 0) / done.length : 0 }, s); })
    .filter(g => g.recv || g.done || g.open);
  const jobs = scoped.slice().sort((a, b) => String(a.received || '').localeCompare(String(b.received || '')) || String(a.code).localeCompare(String(b.code)));
  return { r: r, total: total, people: people, groups: groups, jobs: jobs };
}

function viewReport() {
  const D = reportData(), r = D.r, s = S.settings, T = D.total;
  const ms = members();
  const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
  const memberName = r.member === 'all' ? 'ทุกคน' : r.member === '__none' ? 'ยังไม่มอบหมาย' : r.member;
  const controls = '<div class="panel rep-controls">' +
    '<div class="chips" role="group" aria-label="ช่วงเวลา">' + R_PRESETS.map(p => '<button class="chip" data-rpreset="' + p[0] + '" aria-pressed="' + (r.preset === p[0]) + '">' + p[1] + '</button>').join('') + '</div>' +
    '<div class="rep-grid">' +
      '<div class="f"><label for="rFrom">ตั้งแต่วันที่</label><input type="date" id="rFrom" value="' + esc(r.from) + '"></div>' +
      '<div class="f"><label for="rTo">ถึงวันที่</label><input type="date" id="rTo" value="' + esc(r.to) + '"></div>' +
      '<div class="f"><label for="rMember">ผู้รับผิดชอบ</label><select id="rMember">' + opt('all', r.member, 'ทุกคน') + ms.map(m => opt(m.name, r.member, m.name)).join('') + opt('__none', r.member, 'ยังไม่มอบหมาย') + '</select></div>' +
      '<div class="f"><label for="rGroup">กลุ่มงาน</label><select id="rGroup">' + opt('all', r.group, 'ทุกกลุ่มงาน') + (s.groups || []).map(g => opt(g, r.group, g)).join('') + '</select></div>' +
      '<div class="f"><label for="rScope">รายการงานที่แสดง</label><select id="rScope">' + R_SCOPES.map(x => opt(x[0], r.scope, x[1])).join('') + '</select></div>' +
      '<div class="f"><label for="rOrient">หน้ากระดาษ A4</label><select id="rOrient">' + opt('portrait', r.orient, 'แนวตั้ง') + opt('landscape', r.orient, 'แนวนอน') + '</select></div>' +
    '</div>' +
    '<div class="rep-secs"><span class="sub">หัวข้อที่จะพิมพ์</span>' + R_SECTIONS.map(x => '<label class="toggle sm"><input type="checkbox" data-rsec="' + x[0] + '"' + (r.sec[x[0]] ? ' checked' : '') + '>' + x[1] + '</label>').join('') + '</div></div>';

  const pctTxt = v => v == null ? '–' : v + '%';
  const kpi = r.sec.kpi ? '<section class="rsec"><h3>สรุปตัวเลข</h3><div class="rkpis">' +
    [['รับงานเข้า', T.recv, 'งาน'], ['เสร็จแล้ว', T.done, 'งาน'], ['ตรงเวลา', pctTxt(T.pct), T.done ? T.ok + ' จาก ' + T.done + ' งาน' : ''], ['เสร็จช้า', T.late, 'งาน'],
     ['ค้างอยู่', T.open, T.overdue ? 'เลยกำหนด ' + T.overdue + ' งาน' : 'ไม่มีงานเลยกำหนด'], ['เวลาทำงานรวม', fdur(T.mins), 'จากการจับเวลา', 'sm']]
      .map(k => '<div class="rkpi' + (k[3] ? ' ' + k[3] : '') + '"><span>' + k[0] + '</span><b>' + k[1] + '</b><small>' + esc(k[2]) + '</small></div>').join('') + '</div></section>' : '';

  const th = cols => '<thead><tr>' + cols.map(c => '<th' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + c[0] + '</th>').join('') + '</tr></thead>';
  const sumRow = (label, x, extra) => '<tr class="tot"><td>' + label + '</td><td class="n">' + x.recv + '</td><td class="n">' + x.done + '</td><td class="n">' + x.ok + '</td><td class="n">' + x.late + '</td><td class="n">' + pctTxt(x.pct) + '</td><td class="n">' + x.open + '</td><td class="n">' + x.overdue + '</td>' + extra + '</tr>';
  const people = r.sec.people ? '<section class="rsec"><h3>สรุปรายคน</h3>' + (D.people.length ? '<div class="rtable-wrap"><table class="rtable">' +
    th([['ผู้รับผิดชอบ'], ['รับเข้า', 'n'], ['เสร็จ', 'n'], ['ตรงเวลา', 'n'], ['ช้า', 'n'], ['% ตรงเวลา', 'n'], ['ค้างอยู่', 'n'], ['เลยกำหนด', 'n'], ['เวลาทำงาน', 'n']]) + '<tbody>' +
    D.people.map(p => '<tr><td><span class="rwho">' + (p.name ? av(p.name) : '') + esc(p.name || 'ยังไม่มอบหมาย') + '</span></td><td class="n">' + p.recv + '</td><td class="n">' + p.done + '</td><td class="n">' + p.ok + '</td><td class="n">' + p.late + '</td><td class="n">' + pctTxt(p.pct) + '</td><td class="n">' + p.open + '</td><td class="n' + (p.overdue ? ' bad' : '') + '">' + p.overdue + '</td><td class="n">' + (p.mins ? fdur(p.mins) : '–') + '</td></tr>').join('') +
    '</tbody>' + (D.people.length > 1 ? '<tfoot>' + sumRow('รวม', T, '<td class="n">' + fdur(T.mins) + '</td>') + '</tfoot>' : '') + '</table></div>' : '<p class="rnone">ไม่มีข้อมูลในช่วงนี้</p>') + '</section>' : '';

  const groups = r.sec.groups ? '<section class="rsec"><h3>สรุปตามกลุ่มงาน</h3>' + (D.groups.length ? '<div class="rtable-wrap"><table class="rtable">' +
    th([['กลุ่มงาน'], ['รับเข้า', 'n'], ['เสร็จ', 'n'], ['ตรงเวลา', 'n'], ['ช้า', 'n'], ['% ตรงเวลา', 'n'], ['ค้างอยู่', 'n'], ['เลยกำหนด', 'n'], ['เวลาเฉลี่ย/งาน', 'n']]) + '<tbody>' +
    D.groups.map(g => '<tr><td>' + esc(g.name) + '</td><td class="n">' + g.recv + '</td><td class="n">' + g.done + '</td><td class="n">' + g.ok + '</td><td class="n">' + g.late + '</td><td class="n">' + pctTxt(g.pct) + '</td><td class="n">' + g.open + '</td><td class="n' + (g.overdue ? ' bad' : '') + '">' + g.overdue + '</td><td class="n">' + (g.avg ? fdur(g.avg) : '–') + '</td></tr>').join('') +
    '</tbody></table></div>' : '<p class="rnone">ไม่มีข้อมูลในช่วงนี้</p>') + '</section>' : '';

  const result = j => {
    if (j.status === 'done') return onTime(j) ? '<span class="rres ok">ตรงเวลา</span>' : '<span class="rres bad">ช้า ' + (j.due && finDate(j) ? daysBetween(j.due, finDate(j)) + ' วัน' : '') + '</span>';
    return isLate(j) ? '<span class="rres bad">เลยกำหนด</span>' : '<span class="rres">' + esc((ST[j.status] || ST.queue).label) + '</span>';
  };
  const scopeLabel = (R_SCOPES.find(x => x[0] === r.scope) || R_SCOPES[0])[1];
  const jobs = r.sec.jobs ? '<section class="rsec rsec-jobs"><h3>รายการงาน <small>' + esc(scopeLabel) + ' · ' + D.jobs.length + ' งาน</small></h3>' + (D.jobs.length ? '<div class="rtable-wrap"><table class="rtable rjobs">' +
    th([['#', 'n'], ['เลข Job'], ['ลูกค้า / รายละเอียด'], ['กลุ่ม'], ['ผู้รับผิดชอบ'], ['รับ'], ['กำหนดส่ง'], ['เสร็จ'], ['สถานะ'], ['เวลาทำ', 'n']]) + '<tbody>' +
    D.jobs.map((j, i) => '<tr><td class="n">' + (i + 1) + '</td><td class="mono">' + esc(j.code) + (j.priority === 'urgent' ? ' <span class="rflag">ด่วน</span>' : '') + (j.revision ? ' <span class="rflag">แก้</span>' : '') + '</td><td>' + esc(j.title || '–') + '<small>' + esc(j.taskType || '') + (j.sale ? ' · Sale ' + esc(j.sale) : '') + '</small></td><td>' + esc(groupShort(j.group) || '–') + '</td><td>' + esc(j.assignee || '–') + '</td><td>' + fdY(j.received) + '</td><td>' + fdY(j.due) + '</td><td>' + (j.status === 'done' ? fdY(finDate(j)) : '–') + '</td><td>' + result(j) + '</td><td class="n">' + (totalMinutes(j) ? fdur(totalMinutes(j)) : '–') + '</td></tr>').join('') +
    '</tbody></table></div>' : '<p class="rnone">ไม่มีงานในช่วงนี้</p>') + '</section>' : '';

  const sign = r.sec.sign ? '<section class="rsec rsign"><div><span></span>ผู้จัดทำรายงาน<small>(' + esc(S.me) + ')</small><small>วันที่ ........../........../..........</small></div><div><span></span>ผู้ตรวจสอบ<small>(..........................................)</small><small>วันที่ ........../........../..........</small></div></section>' : '';

  const nowD = new Date();
  const paper = '<article class="paper" id="reportPaper">' +
    '<header class="rhead"><div class="rbrand">' + brandMark(s) + '<div><b>' + esc(s.company) + '</b><small>' + esc(s.appName) + '</small></div></div>' +
      '<div class="rtitle"><h2>รายงานสรุปงาน</h2><p>' + rangeLabel(r) + '</p></div></header>' +
    '<div class="rmeta"><span>ผู้รับผิดชอบ: <b>' + esc(memberName) + '</b></span><span>กลุ่มงาน: <b>' + esc(r.group === 'all' ? 'ทุกกลุ่มงาน' : r.group) + '</b></span><span>พิมพ์โดย ' + esc(S.me) + ' · ' + fdFull(today()) + ' ' + pad(nowD.getHours()) + ':' + pad(nowD.getMinutes()) + ' น.</span></div>' +
    (kpi + people + groups + jobs + sign || '<p class="rnone">เลือกหัวข้อที่จะพิมพ์อย่างน้อย 1 หัวข้อ</p>') +
    '<footer class="rfoot">' + esc(s.company) + ' · ' + esc(s.appName) + '</footer></article>';

  return topbar('รายงาน', 'เลือกช่วงเวลาแล้วกดพิมพ์ หรือบันทึกเป็น PDF', '<button class="btn primary" data-act="print">' + I.print + '<span>พิมพ์รายงาน</span></button>') + controls + paper;
}
function setPageOrient(o) {
  let el = document.getElementById('pageStyle');
  if (!el) { el = document.createElement('style'); el.id = 'pageStyle'; document.head.appendChild(el); }
  el.textContent = '@page{size:A4 ' + (o === 'landscape' ? 'landscape' : 'portrait') + ';margin:12mm 11mm}';
}
function printReport() {
  setPageOrient(reportState().orient);
  document.body.classList.add('printing');
  setTimeout(() => { try { window.print(); } catch (x) { toast('เบราว์เซอร์นี้สั่งพิมพ์ไม่ได้ ลองเปิดเว็บใน Chrome หรือ Safari', true); } }, 50);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

/* ============ render: settings ============ */
function viewSettings() {
  const admin = isAdmin();
  if (admin && !S.draft) { S.draft = clone(S.settings); S.draftDirty = false; }
  const d = S.draft || S.settings, c = S.conn || { url: '' };
  const nav = [['me', 'บัญชีของฉัน']].concat(admin ? [['conn', 'ฐานข้อมูล'], ['users', 'ผู้ใช้งานและสิทธิ์'], ['brand', 'แบรนด์'], ['lists', 'รายการตัวเลือก'], ['sla', 'ระยะเวลามาตรฐาน']] : []).concat([['about', 'เกี่ยวกับ']]);
  let h = topbar('ตั้งค่า', admin ? 'คุณเป็นแอดมิน จัดการผู้ใช้ การตั้งค่า และแบรนด์ได้' : 'บัญชีของคุณและการเชื่อมต่อ') +
    '<div class="settings"><nav class="snav">' + nav.map(n => '<a href="#s-' + n[0] + '">' + n[1] + '</a>').join('') + '</nav><div class="sbody">';

  h += '<section class="panel sec" id="s-me"><div class="panel-h"><h2>บัญชีของฉัน</h2><button class="btn sm" data-act="logout">ออกจากระบบ</button></div>' +
    '<div class="tcard-h">' + avUser(S.user, 'xl') + '<div><b>' + esc(S.me) + '</b><small>' + ((S.user && S.user.full) ? esc(S.user.full) + ' · ' : '') + (admin ? 'แอดมิน' : 'ผู้ใช้งาน') + '</small>' +
      '<div class="top-actions" style="margin-top:8px"><label class="btn sm">' + (S.user && S.user.photo ? 'เปลี่ยนรูป' : 'ใส่รูปโปรไฟล์') + '<input type="file" accept="image/*" data-photofor="' + esc(S.user ? S.user.id : '') + '" hidden></label>' +
      (S.user && S.user.photo ? '<button class="btn sm ghost" data-rmphoto="' + esc(S.user.id) + '">ลบรูป</button>' : '') + '</div></div></div>' +
    '<p class="help">' + (admin ? 'แก้ไขและลบได้ทุกงาน มอบหมายงาน และจัดการผู้ใช้' : 'ลงงานใหม่ แก้ไขและจับเวลางานของตัวเองได้ งานของคนอื่นดูได้อย่างเดียว') + '</p>' +
    '<div class="form-grid"><div class="f"><label for="pOld">PIN เดิม</label><input id="pOld" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></div><div></div>' +
    '<div class="f"><label for="pNew">PIN ใหม่ (4–6 หลัก)</label><input id="pNew" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>' +
    '<div class="f"><label for="pNew2">ยืนยัน PIN ใหม่</label><input id="pNew2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>' +
    '<div><button class="btn" data-act="changepin">เปลี่ยน PIN</button></div></section>';

  if (admin) h += '<section class="panel sec" id="s-conn"><div class="panel-h"><h2>ฐานข้อมูล</h2>' + (mode() === 'sheet' ? '<span class="pill s-done">Google Sheet</span>' : '<span class="pill s-hold">โหมดทดลอง</span>') + '</div>' +
    (mode() === 'sheet'
      ? '<p class="help">ข้อมูลของทีมเก็บใน Google Sheet ผ่าน Apps Script ด้านล่าง</p><div class="code-box">' + esc(c.url) + '</div><div class="top-actions"><button class="btn sm" data-act="copylink">คัดลอกลิงก์เข้าใช้งานให้ทีม</button><button class="btn sm" data-act="disconnect">ออกจากฐานข้อมูลนี้</button></div>'
      : '<p class="help">ตอนนี้ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น ติดตั้ง Apps Script ตามคู่มือแล้ววาง URL ที่ลงท้าย /exec เพื่อใช้ร่วมกันทั้งทีม</p>' +
        '<div class="form-grid"><div class="f full"><label for="cUrl">URL ของ Apps Script</label><input id="cUrl" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" inputmode="url"></div></div>' +
        '<div class="top-actions"><button class="btn primary" data-act="connect">เชื่อมต่อ</button><button class="btn sm" data-act="resetdemo">รีเซ็ตข้อมูลตัวอย่าง</button></div>') + '</section>';

  if (admin) {
    const rows = S.users.map(u => '<div class="urow' + (u.active ? '' : ' off') + '" data-urow="' + esc(u.id) + '">' +
      '<div class="uphoto"><label class="ph-pick" title="' + (u.photo ? 'เปลี่ยนรูป' : 'ใส่รูป') + '">' + avUser(u, 'md') + '<span class="ph-cam" aria-hidden="true">+</span><input type="file" accept="image/*" data-photofor="' + esc(u.id) + '" hidden aria-label="รูปของ ' + esc(u.name) + '"></label>' +
      (u.photo ? '<button class="ph-x" data-rmphoto="' + esc(u.id) + '" aria-label="ลบรูปของ ' + esc(u.name) + '">×</button>' : '') + '</div>' +
      '<input type="color" value="' + esc(u.color || '#5B6B7A') + '" data-u="color" aria-label="สี">' +
      '<input value="' + esc(u.name) + '" data-u="name" aria-label="ชื่อเล่น" placeholder="ชื่อเล่น"><input class="opt" value="' + esc(u.full || '') + '" data-u="full" aria-label="ชื่อจริง" placeholder="ชื่อจริง">' +
      '<select data-u="role" aria-label="สิทธิ์"><option value="user"' + (u.role !== 'admin' ? ' selected' : '') + '>ผู้ใช้งาน</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>แอดมิน</option></select>' +
      '<label class="toggle sm"><input type="checkbox" data-u="active"' + (u.active ? ' checked' : '') + '>ใช้งาน</label>' +
      '<div class="urow-act"><button class="btn sm" data-saveuser="' + esc(u.id) + '">บันทึก</button><button class="btn sm ghost" data-resetpin="' + esc(u.id) + '">รีเซ็ต PIN</button></div>' +
      (S.pinNote && S.pinNote.userId === u.id ? '<div class="pin-note">PIN ใหม่ของ ' + esc(u.name) + ': <b class="mono">' + esc(S.pinNote.pin) + '</b> แจ้งเจ้าตัวแล้วให้เปลี่ยนเองในหน้าตั้งค่า</div>' : '') + '</div>').join('');
    h += '<section class="panel sec" id="s-users"><div class="panel-h"><h2>ผู้ใช้งานและสิทธิ์</h2><span class="sub">' + S.users.filter(u => u.active).length + ' คนใช้งานอยู่</span></div>' +
      '<p class="help"><b>แอดมิน</b> แก้ไขได้ทั้งหมด · <b>ผู้ใช้งาน</b> ลงงานและแก้ไขงานของตัวเองได้ ปิด "ใช้งาน" เพื่อระงับบัญชีโดยไม่ลบประวัติงาน</p>' +
      '<div class="ulist">' + rows + '</div>' +
      '<div class="uadd"><b>เพิ่มผู้ใช้</b><span class="sub">ใส่รูปได้หลังเพิ่มแล้ว โดยกดที่วงกลมหน้าชื่อ</span><div class="urow"><input type="color" id="nuColor" value="' + COLORS[S.users.length % COLORS.length] + '" aria-label="สี"><input id="nuName" placeholder="ชื่อเล่น" aria-label="ชื่อเล่น"><input id="nuFull" class="opt" placeholder="ชื่อจริง" aria-label="ชื่อจริง">' +
      '<select id="nuRole" aria-label="สิทธิ์"><option value="user">ผู้ใช้งาน</option><option value="admin">แอดมิน</option></select><input id="nuPin" inputmode="numeric" maxlength="6" placeholder="PIN (ว่าง = สุ่ม)" aria-label="PIN เริ่มต้น">' +
      '<div class="urow-act"><button class="btn sm primary" data-act="adduser">' + I.plus + 'เพิ่ม</button></div>' +
      (S.pinNote && S.pinNote.userId === 'new' ? '<div class="pin-note">เพิ่ม ' + esc(S.pinNote.name) + ' แล้ว PIN: <b class="mono">' + esc(S.pinNote.pin) + '</b></div>' : '') + '</div></div></section>';

    const simpleRows = key => d[key].map((x, i) => '<div class="erow two"><input value="' + esc(x) + '" data-d="' + key + '.' + i + '" aria-label="ชื่อ"><button class="icon-btn" data-del="' + key + '.' + i + '" aria-label="ลบ">' + I.trash + '</button></div>').join('');
    const typeRows = d.taskTypes.map((x, i) => '<div class="erow three"><input value="' + esc(x.name) + '" data-d="taskTypes.' + i + '.name" aria-label="ชื่องาน"><select data-d="taskTypes.' + i + '.cat" aria-label="ประเภท"><option value="draw"' + (x.cat !== 'cam' ? ' selected' : '') + '>งานเขียนแบบ</option><option value="cam"' + (x.cat === 'cam' ? ' selected' : '') + '>งาน CAM</option></select><button class="icon-btn" data-del="taskTypes.' + i + '" aria-label="ลบ">' + I.trash + '</button></div>').join('');
    const levelRows = d.levels.map((x, i) => '<div class="erow two"><input value="' + esc(x.label) + '" data-d="levels.' + i + '.label" aria-label="ระดับ ' + x.level + '"><span class="tag rev">ระดับ ' + x.level + '</span></div>').join('');
    const slaRows = d.groups.map(g => {
      const r = (d.sla[g] = d.sla[g] || { cam: [1, 2], draw: [2, 3] });
      const inp = (cat, k) => '<td><input type="number" min="0" max="60" value="' + esc(r[cat][k]) + '" data-sla="' + esc(g) + '|' + cat + '|' + k + '" aria-label="' + esc(g) + ' ' + cat + '"></td>';
      return '<tr><td>' + esc(g) + '</td>' + inp('cam', 0) + inp('cam', 1) + inp('draw', 0) + inp('draw', 1) + '</tr>';
    }).join('');

    h += '<section class="panel sec" id="s-brand"><div class="panel-h"><h2>แบรนด์</h2></div><p class="help">ชื่อ สี และโลโก้ที่ทุกคนเห็น รวมถึงหน้าเข้าสู่ระบบ</p>' +
      '<div class="form-grid"><div class="f"><label for="dCompany">ชื่อบริษัท</label><input id="dCompany" value="' + esc(d.company) + '" data-d="company"></div>' +
      '<div class="f"><label for="dApp">ชื่อระบบ</label><input id="dApp" value="' + esc(d.appName) + '" data-d="appName"></div>' +
      '<div class="f full"><span class="lbl">สีหลัก</span><div class="swatches">' + BRAND_PRESETS.map(col => '<button class="swatch" style="--c:' + col + '" data-accent="' + col + '" aria-pressed="' + (d.accent.toLowerCase() === col.toLowerCase()) + '" aria-label="สี ' + col + '"></button>').join('') +
        '<input type="color" value="' + esc(d.accent) + '" data-d="accent" aria-label="เลือกสีเอง" style="width:44px;height:36px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)"></div></div>' +
      '<div class="f full"><span class="lbl">โลโก้ (สี่เหลี่ยมจัตุรัส)</span><div class="logo-box">' + brandMark(d) + '<label class="btn sm">อัปโหลดรูป<input type="file" accept="image/*" id="logoIn" hidden></label>' + (d.logo ? '<button class="btn sm ghost" data-act="nologo">ลบโลโก้</button>' : '') + '</div></div></div></section>';

    h += '<section class="panel sec" id="s-lists"><div class="panel-h"><h2>รายการตัวเลือก</h2></div>' +
      '<div class="grid2 even"><div class="editable"><div class="panel-h"><b>Sale</b><button class="btn sm" data-add="sales">' + I.plus + 'เพิ่ม</button></div>' + simpleRows('sales') + '</div>' +
      '<div class="editable"><div class="panel-h"><b>กลุ่มงาน</b><button class="btn sm" data-add="groups">' + I.plus + 'เพิ่ม</button></div>' + simpleRows('groups') + '</div>' +
      '<div class="editable"><div class="panel-h"><b>รายละเอียดงาน</b><button class="btn sm" data-add="taskTypes">' + I.plus + 'เพิ่ม</button></div>' + typeRows + '</div>' +
      '<div class="editable"><div class="panel-h"><b>ระดับความยาก</b></div>' + levelRows + '</div></div></section>';

    h += '<section class="panel sec" id="s-sla"><div class="panel-h"><h2>ระยะเวลามาตรฐาน (วันทำการ)</h2></div><p class="help">ใช้คำนวณกำหนดส่งที่แนะนำตอนรับงาน จากวันที่รับงาน + จำนวนวันตามกลุ่มงานและประเภทงาน</p>' +
      '<div class="sla-wrap"><table class="sla"><thead><tr><th>กลุ่มงาน</th><th>CAM ชิ้นเดียว</th><th>CAM หลายชิ้น</th><th>เขียนแบบ ชิ้นเดียว</th><th>เขียนแบบ หลายชิ้น</th></tr></thead><tbody>' + slaRows + '</tbody></table></div>' +
      '<label class="toggle" style="max-width:420px"><input type="checkbox" data-d="skipWeekends"' + (d.skipWeekends !== false ? ' checked' : '') + '> ไม่นับวันเสาร์-อาทิตย์</label></section>';
  }

  h += '<section class="panel sec" id="s-about"><div class="panel-h"><h2>เกี่ยวกับ</h2></div><p class="help">KiwNgan คิวงาน เวอร์ชัน ' + APP_VERSION + (admin ? ' · ข้อมูลทั้งหมดอยู่ใน Google Sheet ของทีมเอง' : '') + (S.lastSync ? ' · ซิงก์ล่าสุด ' + new Date(S.lastSync).toLocaleTimeString('th-TH') : '') + '</p></section>';
  if (admin) h += '<div class="savebar"' + (S.draftDirty ? '' : ' hidden') + ' id="savebar"><span>มีการแก้ไขที่ยังไม่บันทึก</span><button class="btn" data-act="discard">ยกเลิก</button><button class="btn primary" data-act="savesettings">บันทึกการตั้งค่า</button></div>';
  return h + '</div></div>';
}
function setPath(obj, path, val) {
  const p = path.split('.'); let o = obj;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  o[p[p.length - 1]] = val;
}
function markDirty() { S.draftDirty = true; const b = $('#savebar'); if (b) b.hidden = false; }

/* ============ editor ============ */
function openEditor(id) {
  const j = id ? jobById(id) : null;
  const base = j ? clone(j) : {
    code: '', title: '', group: '', taskType: '', qty: 'single', level: '', assignee: isAdmin() && S.f.member !== 'all' && S.f.member.indexOf('__') !== 0 ? S.f.member : S.me,
    sale: '', priority: 'normal', revision: false, status: 'queue', received: today(), due: '', startedAt: '', finishedAt: '', note: ''
  };
  base.baseUpdatedAt = j ? j.updatedAt : '';
  S.edit = { job: base, isNew: !j, confirm: false, hist: null, dueTouched: !!(j && j.due) };
  renderEditor();
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
  if (S.edit.isNew) setTimeout(() => { const el = $('#e-code'); if (el) el.focus(); }, 260);
  if (j) api().activity({ jobId: j.id }).then(h => { if (S.edit && S.edit.job.id === j.id) { S.edit.hist = h; const el = $('#hist'); if (el) el.innerHTML = histHtml(h); } }).catch(() => {});
}
function closeEditor() { S.edit = null; $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); }
function opts(list, val, ph, labelFn) {
  const arr = (list || []).slice(); if (val && arr.indexOf(val) < 0) arr.unshift(val);
  return '<option value="">' + (ph || 'เลือก') + '</option>' + arr.map(x => '<option value="' + esc(x) + '"' + (x === val ? ' selected' : '') + '>' + esc(labelFn ? labelFn(x) : x) + '</option>').join('');
}
function histHtml(h) {
  if (!h || !h.length) return '<span>ยังไม่มีประวัติ</span>';
  const act = { create: 'สร้างงาน', status: 'เปลี่ยนสถานะ', edit: 'แก้ไข', timer: 'จับเวลา', delete: 'ลบ' };
  const stl = s => String(s).replace(/(queue|doing|review|hold|done)/g, m => ST[m].label);
  return h.slice(0, 12).map(a => '<div><b>' + esc(a.who || 'ระบบ') + '</b> ' + esc(act[a.action] || a.action) + (a.detail && a.action !== 'create' ? ' · ' + esc(stl(a.detail)) : '') + ' <span class="muted">· ' + esc(fdt(String(a.ts).slice(0, 16))) + '</span></div>').join('');
}
function renderEditor() {
  const E = S.edit; if (!E) return;
  const j = E.job, s = S.settings, live = E.isNew ? null : jobById(j.id);
  const ro = !E.isNew && !canEdit(live || j);
  $('#sheetEyebrow').textContent = E.isNew ? 'งานใหม่' : (ST[j.status] ? ST[j.status].label : '') + (live && isLate(live) ? ' · เลยกำหนด' : '');
  $('#sheetTitle').textContent = E.isNew ? 'เพิ่มงานใหม่' : j.code;
  const sg = suggestDue(j);
  const dueHint = sg ? '<span class="hint">แนะนำ ' + fdY(sg.date) + ' (' + (sg.cat === 'cam' ? 'CAM' : 'เขียนแบบ') + ' ' + sg.days + ' วันทำการ)' + (j.due !== sg.date ? ' · <button type="button" data-act="usesg">ใช้วันนี้</button>' : '') + '</span>' : '<span class="hint">เลือกกลุ่มงานและรายละเอียดเพื่อให้ระบบแนะนำกำหนดส่ง</span>';

  let timer = '';
  if (!E.isNew && live) {
    const run = runningOf(j.id), mine = run && run.member === S.me;
    const logs = S.logs.filter(l => l.jobId === j.id).sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const canStop = run && (run.member === S.me || isAdmin());
    timer = '<div class="timer-card"><div class="timer-main"><div class="clock"><span data-total="' + esc(j.id) + '">' + fdur(totalMinutes(live)) + '</span><small>' + (run ? '● ' + esc(run.member) + ' กำลังจับเวลา <span data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : 'เวลาทำงานรวม ' + logs.length + ' ครั้ง') + '</small></div>' +
      (run ? (canStop ? '<button type="button" class="btn rec" data-act="stop" data-log="' + esc(run.id) + '">' + I.stop + (mine ? 'หยุด' : 'หยุดให้ ' + esc(run.member)) + '</button>' : '')
        : (j.status !== 'done' && !ro ? '<button type="button" class="btn primary" data-act="start" data-job="' + esc(j.id) + '">' + I.play + 'เริ่มจับเวลา</button>' : '')) + '</div>' +
      (logs.length ? '<div class="logs">' + logs.slice(0, 8).map(l => '<div>' + av(l.member) + '<span>' + fdt(l.start) + (l.end ? ' – ' + l.end.slice(11, 16) : ' – ตอนนี้') + '</span><span class="tnum">' + (l.end ? fdur(l.minutes) : '') + '</span>' + (l.end && (l.member === S.me || isAdmin()) ? '<button type="button" class="x" data-dellog="' + esc(l.id) + '" aria-label="ลบรายการเวลา">ลบ</button>' : '<span></span>') + '</div>').join('') + '</div>' : '') + '</div>';
  }

  const statusSeg = '<div class="seg status">' + ['queue', 'doing', 'review', 'hold', 'done'].map(st => '<button type="button" class="' + ST[st].cls + '" data-est="' + st + '" aria-pressed="' + (j.status === st) + '">' + ST[st].label + '</button>').join('') + '</div>';
  const levels = (s.levels && s.levels.length ? s.levels : defaultSettings().levels);

  $('#sheetBody').innerHTML =
    (ro ? '<div class="banner"><span><b>ดูอย่างเดียว</b> งานของ ' + esc(j.assignee || 'คนอื่น') + ' แก้ไขได้เฉพาะผู้รับผิดชอบ คนที่ลงงาน หรือแอดมิน</span></div>' : '') +
    '<div class="f"><span class="lbl">สถานะ</span>' + statusSeg + '</div>' + timer +
    '<fieldset><legend>ข้อมูลงาน</legend>' +
      '<div class="f"><label for="e-code">เลข Job</label><input id="e-code" class="mono" data-e="code" value="' + esc(j.code) + '" placeholder="เช่น R69-10012S" autocomplete="off"></div>' +
      '<div class="f"><label for="e-title">ลูกค้า / โครงการ</label><input id="e-title" data-e="title" value="' + esc(j.title) + '" placeholder="เช่น ผนังล็อบบี้โรงแรม"></div>' +
      '<div class="f"><label for="e-group">กลุ่มงาน</label><select id="e-group" data-e="group">' + opts(s.groups, j.group) + '</select></div>' +
      '<div class="f"><label for="e-type">รายละเอียดงาน</label><select id="e-type" data-e="taskType">' + opts(s.taskTypes.map(t => t.name), j.taskType) + '</select></div>' +
      '<div class="f"><span class="lbl">จำนวนชิ้น</span><div class="seg"><button type="button" data-eqty="single" aria-pressed="' + (j.qty !== 'multi') + '">ชิ้นเดียว</button><button type="button" data-eqty="multi" aria-pressed="' + (j.qty === 'multi') + '">หลายชิ้น / ต่างแบบ</button></div></div>' +
      '<div class="f"><span class="lbl">ระดับความยาก</span><div class="seg">' + levels.map(x => '<button type="button" data-elv="' + x.level + '" aria-pressed="' + (+j.level === x.level) + '" title="' + esc(x.label) + '">' + x.level + '</button>').join('') + '</div><span class="hint">' + esc((levels.find(x => x.level === +j.level) || {}).label || 'เลือกระดับ 1–3') + '</span></div>' +
      '<div class="f"><label for="e-assignee">ผู้รับผิดชอบ</label><select id="e-assignee" data-e="assignee">' + opts(members().map(x => x.name), j.assignee, 'ยังไม่มอบหมาย') + '</select></div>' +
      '<div class="f"><label for="e-sale">Sale</label><select id="e-sale" data-e="sale">' + opts(s.sales, j.sale, 'เลือก sale') + '</select></div>' +
      '<label class="toggle"><input type="checkbox" data-e="priority"' + (j.priority === 'urgent' ? ' checked' : '') + ' style="accent-color:var(--urgent)"><span><b>งานด่วน</b></span></label>' +
      '<label class="toggle"><input type="checkbox" data-e="revision"' + (j.revision ? ' checked' : '') + ' style="accent-color:var(--review)"><span><b>งานแก้ไข</b></span></label>' +
    '</fieldset>' +
    '<fieldset><legend>กำหนดเวลา</legend>' +
      '<div class="f"><label for="e-received">วันที่รับงาน</label><input type="date" id="e-received" data-e="received" value="' + esc(j.received) + '"></div>' +
      '<div class="f"><label for="e-due">กำหนดส่ง</label><input type="date" id="e-due" data-e="due" value="' + esc(j.due) + '">' + dueHint + '</div>' +
      (!E.isNew ? '<div class="f"><label for="e-started">เริ่มทำ</label><input type="datetime-local" id="e-started" data-e="startedAt" value="' + esc(j.startedAt) + '"></div>' +
        '<div class="f"><label for="e-finished">ปิดงาน</label><input type="datetime-local" id="e-finished" data-e="finishedAt" value="' + esc(j.finishedAt) + '"' + (j.status !== 'done' ? ' disabled' : '') + '></div>' : '') +
      '<div class="f full"><label for="e-note">หมายเหตุ</label><textarea id="e-note" data-e="note" placeholder="เช่น เหลืออีก 1 แผ่น, รอไฟล์ลูกค้า">' + esc(j.note) + '</textarea></div>' +
    '</fieldset>' +
    (!E.isNew ? '<div class="f"><span class="lbl">ประวัติ</span><div class="hist" id="hist">' + (E.hist ? histHtml(E.hist) : '<span>กำลังโหลด…</span>') + '</div>' +
      (live && live.updatedAt ? '<span class="hint">แก้ไขล่าสุด ' + esc(fdt(String(live.updatedAt).slice(0, 16))) + (live.updatedBy ? ' โดย ' + esc(live.updatedBy) : '') + '</span>' : '') + '</div>' : '') +
    (!E.isNew && P.del(S.user, live || j) ? (E.confirm ? '<div class="confirm">ลบงาน <b class="mono">' + esc(j.code) + '</b> และเวลาทำงานทั้งหมด? ย้อนกลับไม่ได้<button type="button" class="btn sm danger" data-act="delyes">ลบงาน</button><button type="button" class="btn sm" data-act="delno">ไม่ลบ</button></div>'
      : '<div><button type="button" class="btn sm danger" data-act="del">' + I.trash + 'ลบงานนี้</button></div>') : '') +
    '<div class="err" id="eErr" hidden></div>';
  $('#sheetFoot').innerHTML = '<button class="btn" data-act="close" type="button">ปิด</button>' + (ro ? '' : '<button class="btn primary" data-act="save" type="button">' + (E.isNew ? 'เพิ่มงาน' : 'บันทึก') + '</button>');
  if (ro) document.querySelectorAll('#sheetBody input, #sheetBody select, #sheetBody textarea, #sheetBody .seg button, #sheetBody .hint button').forEach(el => { el.disabled = true; });
  else if (!isAdmin()) { const a = $('#e-assignee'); if (a) { a.disabled = true; a.title = 'มอบหมายงานให้คนอื่นได้เฉพาะแอดมิน'; } }
}
function readEditor() {
  const j = S.edit.job;
  document.querySelectorAll('#sheetBody [data-e]').forEach(el => {
    const k = el.getAttribute('data-e');
    if (k === 'priority') j.priority = el.checked ? 'urgent' : 'normal';
    else if (k === 'revision') j.revision = el.checked;
    else j[k] = el.value.trim();
  });
  return j;
}
async function saveEditor() {
  const j = readEditor(), err = $('#eErr');
  if (!j.code) { err.hidden = false; err.textContent = 'ใส่เลข Job ก่อนบันทึก'; $('#e-code').focus(); return; }
  if (S.edit.isNew && S.jobs.some(x => x.code.toLowerCase() === j.code.toLowerCase())) { err.hidden = false; err.textContent = 'มีเลข Job นี้อยู่แล้ว ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1'; return; }
  const btn = document.querySelector('#sheetFoot [data-act="save"]'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
  try {
    const payload = Object.assign({}, j); delete payload.minutes;
    if (payload.status === 'done' && runningOf(payload.id)) applyStop(await api().stopTimer({ logId: runningOf(payload.id).id }));
    await saveJob(payload, S.edit.isNew ? 'เพิ่มงาน ' + j.code + ' แล้ว' : 'บันทึกแล้ว');
    closeEditor(); render();
  } catch (e) { err.hidden = false; err.textContent = e.message; btn.disabled = false; btn.textContent = 'บันทึก'; }
}

/* ============ navigation ============ */
function go(view, sec) {
  if (S.view === 'settings' && view !== 'settings' && S.draftDirty) { toast('มีการตั้งค่าที่ยังไม่บันทึก กดบันทึกหรือยกเลิกก่อน', true); return; }
  S.view = view; LS.set('view', view); render();
  if (sec) setTimeout(() => { const el = document.getElementById('s-' + sec); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  else window.scrollTo(0, 0);
}

/* ============ events ============ */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-open],a[href^="#s-"],label.btn');
  if (!t) return;
  const d = t.dataset;

  if (t.tagName === 'A' && t.getAttribute('href').indexOf('#s-') === 0) { e.preventDefault(); const el = document.querySelector(t.getAttribute('href')); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
  if (d.view) return go(d.view);
  if (d.go) return go(d.go, d.sec);
  if (d.move) { e.stopPropagation(); return moveJob(d.move, d.to); }
  if (d.rpreset) { reportState(); if (d.rpreset !== 'custom') applyPreset(d.rpreset); else S.r.preset = 'custom'; saveReportState(); return render(); }
  if (d.filterGo) { S.f.status = d.filterGo; S.f.month = ''; return go('list'); }
  if (d.mine) { S.f.member = '__me'; LS.set('fMember', S.f.member); return go('board'); }
  if (d.memberjobs) { S.f.member = d.memberjobs; S.f.status = 'open'; LS.set('fMember', S.f.member); return go('list'); }
  if (d.fstatus) { S.f.status = d.fstatus; if (d.fstatus !== 'done') S.f.month = ''; return render(); }
  // login screen
  if (d.who !== undefined) { S.login.userId = d.who; S.login.pin = ''; S.login.err = ''; return renderLogin(); }
  if (d.pin) { const L = S.login; const an = $('#adminName'); if (an) L.adminName = an.value; if (d.pin === 'clear') L.pin = ''; else if (d.pin === 'back') L.pin = L.pin.slice(0, -1); else if (L.pin.length < 6) L.pin += d.pin; L.err = ''; return renderLogin(); }
  // user admin
  if (d.saveuser) return saveUserRow(d.saveuser);
  if (d.rmphoto) return setPhoto(d.rmphoto, null);
  if (d.resetpin) { try { const r = await mutate(() => api().resetPin({ userId: d.resetpin })); S.pinNote = { userId: r.userId, pin: r.pin }; render(); } catch (x) {} return; }

  // editor-scoped
  if (d.est && S.edit) { readEditor(); S.edit.job.status = d.est; if (d.est === 'done' && !S.edit.job.finishedAt) S.edit.job.finishedAt = nowLocal(); if (d.est !== 'done') S.edit.job.finishedAt = ''; return renderEditor(); }
  if (d.eqty && S.edit) { readEditor(); S.edit.job.qty = d.eqty; autoDue(); return renderEditor(); }
  if (d.elv && S.edit) { readEditor(); S.edit.job.level = +d.elv === +S.edit.job.level ? '' : +d.elv; return renderEditor(); }
  if (d.dellog) { try { const r = await mutate(() => api().deleteLog({ logId: d.dellog }), 'ลบรายการเวลาแล้ว'); S.logs = S.logs.filter(l => l.id !== d.dellog); const j = jobById(r.jobId); if (j) j.minutes = r.minutes; render(); } catch (x) {} return; }

  // settings-scoped
  if (d.accent) { S.draft.accent = d.accent; markDirty(); document.documentElement.style.setProperty('--brand', d.accent); return render(); }
  if (d.add) { const k = d.add; if (k === 'members') S.draft.members.push({ id: uid('m_'), name: '', full: '', color: COLORS[S.draft.members.length % COLORS.length] }); else if (k === 'taskTypes') S.draft.taskTypes.push({ name: '', cat: 'draw' }); else S.draft[k].push(''); markDirty(); render(); setTimeout(() => { const ins = document.querySelectorAll('[data-d^="' + k + '."]'); const last = ins[k === 'members' ? ins.length - 2 : ins.length - 1]; if (last) last.focus(); }, 20); return; }
  if (d.del) { const p = d.del.split('.'); S.draft[p[0]].splice(+p[1], 1); markDirty(); return render(); }

  if (d.open && !e.target.closest('.adv')) return openEditor(d.open);

  switch (d.act) {
    case 'new': return openEditor(null);
    case 'close': return closeEditor();
    case 'save': return saveEditor();
    case 'usesg': { readEditor(); const sg = suggestDue(S.edit.job); if (sg) S.edit.job.due = sg.date; S.edit.dueTouched = true; return renderEditor(); }
    case 'del': readEditor(); S.edit.confirm = true; return renderEditor();
    case 'delno': S.edit.confirm = false; return renderEditor();
    case 'delyes': { const id = S.edit.job.id, code = S.edit.job.code; try { await mutate(() => api().deleteJob({ id: id }), 'ลบ ' + code + ' แล้ว'); S.jobs = S.jobs.filter(j => j.id !== id); S.logs = S.logs.filter(l => l.jobId !== id); closeEditor(); render(); } catch (x) {} return; }
    case 'start': if (S.edit) readEditor(); return startTimer(d.job);
    case 'stop': if (S.edit) readEditor(); return stopTimer(d.log);
    case 'refresh': return load(false).then(() => { if (S.sync === 'ok') toast('อัปเดตข้อมูลล่าสุดแล้ว'); });
    case 'csv': return exportCsv();
    case 'print': return printReport();
    case 'connect': return connect();
    case 'disconnect': S.conn = null; LS.del('conn'); S.loaded = false; S.login.showConn = false; toast('กลับสู่โหมดทดลองแล้ว'); return load(false);
    case 'resetdemo': LS.del('demo'); LS.del(tokenKey()); toast('รีเซ็ตข้อมูลตัวอย่างแล้ว'); return showLogin();
    case 'showconn': S.login.showConn = true; return renderLogin();
    case 'adminon': Object.assign(S.login, { adminMode: true, userId: '', pin: '', err: '' }); return renderLogin();
    case 'adminoff': Object.assign(S.login, { adminMode: false, pin: '', err: '' }); return renderLogin();
    case 'logout': return logout();
    case 'changepin': return changePin();
    case 'adduser': return addUser();
    case 'copylink': return copyLink();
    case 'savesettings': return saveSettings();
    case 'discard': S.draft = null; S.draftDirty = false; applyBrand(); return render();
    case 'nologo': S.draft.logo = ''; markDirty(); return render();
  }
});

document.addEventListener('submit', e => { if (e.target.id === 'pinForm') { e.preventDefault(); doLogin(); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.edit) closeEditor();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card,.row') ) { e.preventDefault(); openEditor(e.target.dataset.open); }
  if (e.key === 'n' && S.screen === 'app' && !S.edit && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openEditor(null); }
});
$('#scrim').addEventListener('click', closeEditor);

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'adminName') { S.login.adminName = t.value; return; }
  if (t.id === 'pinIn') { S.login.pin = t.value.replace(/\D/g, '').slice(0, 6); S.login.err = ''; const dots = document.querySelectorAll('.pin-dots i'); dots.forEach((el, i) => el.classList.toggle('on', i < S.login.pin.length)); const sb = document.querySelector('#pinForm [type=submit]'); if (sb) sb.disabled = S.login.pin.length < 4; return; }
  if (t.id === 'q') { S.f.q = t.value; const pos = t.selectionStart; render(); const q = $('#q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } return; }
  if (t.dataset.d && S.draft) {
    const v = t.type === 'checkbox' ? t.checked : t.value;
    const path = t.dataset.d; const old = path.split('.');
    // renaming a group must carry its SLA row
    if (old[0] === 'groups') { const prev = S.draft.groups[+old[1]]; if (S.draft.sla[prev]) { S.draft.sla[v] = S.draft.sla[prev]; if (prev !== v) delete S.draft.sla[prev]; } }
    setPath(S.draft, path, v); markDirty();
    if (path === 'accent') document.documentElement.style.setProperty('--brand', v);
    return;
  }
  if (t.dataset.sla && S.draft) { const p = t.dataset.sla.split('|'); S.draft.sla[p[0]][p[1]][+p[2]] = Math.max(0, +t.value || 0); markDirty(); return; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fMember') { S.f.member = t.value; LS.set('fMember', t.value); return render(); }
  if (t.id === 'fGroup') { S.f.group = t.value; return render(); }
  if (t.id === 'fMonth') { S.f.month = t.value; return render(); }
  if (/^r(From|To|Member|Group|Scope|Orient)$/.test(t.id)) {
    const r = reportState(), k = t.id.slice(1).toLowerCase();
    if (k === 'from' || k === 'to') { if (!t.value) return render(); r[k] = t.value; r.preset = 'custom'; if (r.from > r.to) { if (k === 'from') r.to = r.from; else r.from = r.to; } }
    else r[k] = t.value;
    if (k === 'orient') setPageOrient(r.orient);
    saveReportState(); return render();
  }
  if (t.dataset.rsec) { reportState().sec[t.dataset.rsec] = t.checked; saveReportState(); return render(); }
  if (t.id === 'logoIn' && t.files && t.files[0]) return readLogo(t.files[0]);
  if (t.dataset.photofor && t.files && t.files[0]) return setPhoto(t.dataset.photofor, t.files[0]);
  if (S.edit && t.closest('#sheetBody') && t.dataset.e) {
    readEditor();
    if (['group', 'taskType', 'received'].indexOf(t.dataset.e) >= 0) autoDue();
    if (t.dataset.e === 'due') S.edit.dueTouched = true;
    if (['group', 'taskType', 'received', 'due'].indexOf(t.dataset.e) >= 0) renderEditor();
  }
});
function autoDue() { const E = S.edit; if (!E || E.dueTouched) return; const sg = suggestDue(E.job); if (sg) E.job.due = sg.date; }

/* drag & drop on the board */
let dragId = null;
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} });
document.addEventListener('dragend', e => { document.querySelectorAll('.dragging,.drop').forEach(x => x.classList.remove('dragging', 'drop')); dragId = null; });
document.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault(); document.querySelectorAll('.col.drop').forEach(x => { if (x !== col) x.classList.remove('drop'); }); col.classList.add('drop'); });
document.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault(); const id = dragId; dragId = null; col.classList.remove('drop'); moveJob(id, col.dataset.col); });

/* settings actions */
async function saveSettings() {
  const d = S.draft;
  d.members = d.members.filter(m => String(m.name).trim()).map(m => Object.assign(m, { name: String(m.name).trim() }));
  ['sales', 'groups'].forEach(k => { d[k] = d[k].map(x => String(x).trim()).filter(Boolean); });
  d.taskTypes = d.taskTypes.filter(t => String(t.name).trim());
  const names = d.members.map(m => m.name); if (new Set(names).size !== names.length) { toast('มีชื่อทีมงานซ้ำกัน', true); return; }
  try {
    const r = await mutate(() => api().saveSettings({ settings: d }), 'บันทึกการตั้งค่าแล้ว');
    S.settings = normalizeSettings(r.settings); S.draft = null; S.draftDirty = false; applyBrand(); render();
  } catch (e) {}
}
/* square-crop and shrink an image file to a small data URL */
function squareImage(file, size, type, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('เลือกไฟล์รูปภาพ (JPG, PNG)'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'), s = Math.min(img.width, img.height);
      if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); }
      x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
    img.src = url;
  });
}
function readLogo(file) {
  squareImage(file, 128, 'image/png').then(d => { S.draft.logo = d; markDirty(); render(); }).catch(e => toast(e.message, true));
}
async function setPhoto(userId, file) {
  try {
    const photo = file ? await squareImage(file, 160, 'image/jpeg', 0.82) : '';
    const r = await mutate(() => api().setPhoto({ userId: userId, photo: photo }), photo ? 'อัปเดตรูปแล้ว' : 'ลบรูปแล้ว');
    upsert(S.users, r.user);
    if (S.user && S.user.id === r.user.id) S.user = Object.assign({}, S.user, r.user);
    render();
  } catch (e) { if (e && e.message && !e.code) toast(e.message, true); }
}
async function connect() {
  const inp = $('#cUrl'), url = (inp ? inp.value : '').trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) { toast('URL ต้องเป็นลิงก์เว็บแอปของ Apps Script (https://script.google.com/macros/s/…/exec)', true); return; }
  const btn = document.querySelector('[data-act="connect"]'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังทดสอบ…'; }
  try {
    await Remote.call('ping', {}, { url: url });
    S.conn = { url: url }; LS.set('conn', S.conn);
    S.draft = null; S.draftDirty = false; S.loaded = false; S.login.showConn = false; S.login.userId = '';
    toast('เชื่อมต่อฐานข้อมูลแล้ว เข้าสู่ระบบด้วยชื่อและ PIN');
    await load(false);
  } catch (e) { toast(e.message, true); if (btn) { btn.disabled = false; btn.textContent = 'เชื่อมต่อ'; } }
}
async function changePin() {
  const o = $('#pOld').value.trim(), n = $('#pNew').value.trim(), n2 = $('#pNew2').value.trim();
  if (!/^\d{4,6}$/.test(n)) { toast('PIN ใหม่ต้องเป็นตัวเลข 4–6 หลัก', true); return; }
  if (n !== n2) { toast('PIN ใหม่ทั้งสองช่องไม่ตรงกัน', true); return; }
  try { await mutate(() => api().changePin({ oldPin: o, newPin: n }), 'เปลี่ยน PIN แล้ว'); ['#pOld', '#pNew', '#pNew2'].forEach(x => { $(x).value = ''; }); } catch (e) {}
}
async function saveUserRow(id) {
  const row = document.querySelector('[data-urow="' + id + '"]'); if (!row) return;
  const g = k => row.querySelector('[data-u="' + k + '"]');
  const data = { id: id, name: g('name').value.trim(), full: g('full').value.trim(), role: g('role').value, color: g('color').value, active: g('active').checked };
  try {
    const r = await mutate(() => api().saveUser({ user: data }), 'บันทึกผู้ใช้ ' + data.name + ' แล้ว');
    const old = S.users.find(u => u.id === id), oldName = old && old.name;
    upsert(S.users, r.user);
    if (oldName && oldName !== r.user.name) { S.jobs.forEach(j => { ['assignee', 'createdBy', 'updatedBy'].forEach(k => { if (j[k] === oldName) j[k] = r.user.name; }); }); S.logs.forEach(l => { if (l.member === oldName) l.member = r.user.name; }); if (S.me === oldName) { S.me = r.user.name; S.user = r.user; } }
    render();
  } catch (e) {}
}
async function addUser() {
  const name = $('#nuName').value.trim(); if (!name) { toast('ใส่ชื่อผู้ใช้', true); $('#nuName').focus(); return; }
  const pin = $('#nuPin').value.trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { toast('PIN ต้องเป็นตัวเลข 4–6 หลัก หรือเว้นว่างเพื่อสุ่ม', true); return; }
  try {
    const r = await mutate(() => api().saveUser({ user: { name: name, full: $('#nuFull').value.trim(), role: $('#nuRole').value, color: $('#nuColor').value, pin: pin } }), 'เพิ่มผู้ใช้ ' + name + ' แล้ว');
    S.users.push(r.user); S.pinNote = { userId: 'new', name: r.user.name, pin: r.pin }; render();
  } catch (e) {}
}
async function copyLink() {
  const link = location.origin + location.pathname + '?api=' + encodeURIComponent(S.conn.url);
  try { await navigator.clipboard.writeText(link); toast('คัดลอกลิงก์แล้ว ส่งให้ทีมเปิดครั้งแรกได้เลย'); }
  catch (e) { toast(link); }
}

/* ============ live clocks & polling ============ */
setInterval(() => {
  document.querySelectorAll('[data-since]').forEach(el => { const t = parseLocal(el.dataset.since); if (t) el.textContent = clock(Date.now() - t); });
  document.querySelectorAll('[data-total]').forEach(el => { const j = jobById(el.dataset.total); if (j) el.textContent = fdur(totalMinutes(j)); });
}, 1000);
setInterval(() => {
  if (S.screen === 'app' && mode() === 'sheet' && document.visibilityState === 'visible' && !S.edit && !S.draftDirty && S.sync !== 'busy') load(true);
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (S.screen === 'app' && document.visibilityState === 'visible' && mode() === 'sheet' && Date.now() - S.lastSync > 30000 && !S.edit) load(true);
});

/* ============ PWA ============ */
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|usercontent/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ============ boot ============ */
(function readApiParam() {
  try {
    const u = new URL(location.href), api = u.searchParams.get('api');
    if (api && /^https:\/\/script\.google\.com\//.test(api)) { S.conn = { url: api }; LS.set('conn', S.conn); }
    if (api) { u.searchParams.delete('api'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  } catch (e) {}
})();
window.KiwNgan = { S: S, seedDemo: seedDemo, suggestDue: suggestDue, addWorkDays: addWorkDays, version: APP_VERSION };
load(false);
})();
