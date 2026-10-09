/* KiwNgan คิวงาน — frontend
 * Works in two modes:
 *   demo  : data kept in this browser (localStorage) — for trying the app / sales demo
 *   sheet : data in the team's Google Sheet through the Apps Script API (backend/Code.gs)
 */
(function () {
'use strict';

const APP_VERSION = '2.44.0';
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
  review: { label: 'รอตรวจ', cls: 's-review' },
  fix: { label: 'แก้ไข', cls: 's-fix' },
  hold: { label: 'พักไว้', cls: 's-hold' },
  done: { label: 'เสร็จแล้ว', cls: 's-done' }
};
const FLOW = ['queue', 'doing', 'review', 'done'];          // ขั้นหลัก (แถบความคืบหน้า)
const COLS = ['queue', 'doing', 'review', 'fix', 'done'];   // คอลัมน์บนบอร์ด
/* ขั้นถัดไปเมื่อกดลูกศร: ตรวจผ่าน → เสร็จ, แก้เสร็จ → ส่งตรวจอีกครั้ง */
const NEXT = { queue: 'doing', doing: 'review', review: 'done', fix: 'review', hold: 'doing' };
const flowIdx = st => st === 'hold' ? 0 : st === 'fix' ? 1 : Math.max(0, FLOW.indexOf(st));
const WORKING = st => st === 'doing' || st === 'review' || st === 'fix';
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const COLORS = ['#0B6B70', '#2D5FC4', '#B05A2A', '#7A4BB5', '#2B7F4A', '#B8435F', '#5B6B7A', '#A07A12'];
const BRAND_PRESETS = ['#0B6B70', '#1F4E9C', '#9A3D1F', '#5B3FA0', '#1E7A4C', '#2B2F36', '#B0402F'];

const I = {
  flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="6" height="6" rx="1.5"/><rect x="15.5" y="4" width="6" height="6" rx="1.5"/><rect x="9" y="14" width="6" height="6" rx="1.5"/><path d="M8.5 7h7M18.5 10v2.5a1.5 1.5 0 0 1-1.5 1.5h-2M5.5 10v2.5A1.5 1.5 0 0 0 7 14h2"/></svg>',
  prod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/><path d="M7 17h2M12 17h2M17 17h1"/></svg>',
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
const DECO = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  sunrise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17a5 5 0 0 1 10 0M3 17h18M12 4v4M5.6 9.6l1.5 1.5M18.4 9.6l-1.5 1.5M5 20h14"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5h.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="13" width="3" height="4" rx="1"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.6c2.2.4 3.6 2 4 4.4"/></svg>',
  pie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15.5" cy="7.5" r="1"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="M8.8 12l2.3 2.3 4.2-4.3" stroke-linecap="round"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
};
// icon in front of each panel heading, matched by the start of the title
const HEAD_IC = [['งานของ', 'user', 'doing'], ['ต้องจัดการ', 'alert', 'late'], ['งานที่เสร็จ', 'chart', 'done'], ['ภาระงาน', 'people', 'review'], ['งานเสร็จตามกลุ่ม', 'pie', 'urgent'],
  ['บัญชี', 'key', 'doing'], ['ธีม', 'palette', 'review'], ['ฐานข้อมูล', 'db', 'done'], ['ผู้ใช้งาน', 'shield', 'doing'], ['แบรนด์', 'tag', 'urgent'], ['รายการตัวเลือก', 'list', 'review'], ['ระยะเวลา', 'clock', 'done'], ['เกี่ยวกับ', 'info', 'queue']];
function decorate(root) {
  root.querySelectorAll('.panel-h h2').forEach(h => {
    if (h.querySelector('.h-ic')) return;
    const t = h.textContent.trim(), m = HEAD_IC.find(x => t.indexOf(x[0]) === 0);
    if (m) h.insertAdjacentHTML('afterbegin', '<span class="h-ic" style="--hc:var(--' + m[2] + ')" aria-hidden="true">' + DECO[m[1]] + '</span>');
  });
  root.querySelectorAll('.empty').forEach(e => {
    if (e.querySelector('.e-ic')) return;
    const ok = /ไม่มีงาน/.test(e.textContent);
    e.insertAdjacentHTML('afterbegin', '<span class="e-ic' + (ok ? ' ok' : '') + '" aria-hidden="true">' + DECO[ok ? 'check' : 'search'] + '</span>');
  });
}
// count numbers up from zero when a page opens
function countUp(root) {
  root.querySelectorAll('.kpi b, .mini b, .rkpi b, .tstats b').forEach(el => {
    const txt = el.textContent, m = txt.match(/^(\d+)(.*)$/); if (!m) return;
    const end = +m[1], rest = m[2]; if (end < 2) return;
    const t0 = performance.now(), dur = Math.min(900, 380 + end * 18);
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(end * e) + rest; if (k < 1) requestAnimationFrame(step); };
    el.textContent = '0' + rest; requestAnimationFrame(step);
  });
}
const STI = {
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>',
  doing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/></svg>',
  fix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.4-.4-2.3z"/></svg>',
  review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5l1.8 1.8 3.2-3.3"/></svg>',
  hold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.2l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.2z"/><path d="M8.7 12.2l2.2 2.2 4.4-4.5"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c-4.1 0-7-2.8-7-6.6 0-2.7 1.5-4.6 3-6.2.3 1.6 1.1 2.7 2.2 3.2-.2-3.8 1.6-6.9 4.6-9.4.2 2.8 1.4 4.6 2.8 6.2 1.4 1.6 2.4 3.4 2.4 5.9C20 19 16.4 22 12 22zm.1-2.2c1.8 0 3-1.1 3-2.8 0-1.5-.9-2.4-1.9-3.5-.3 1-1 1.7-1.9 2-.1-1.2-.6-2.1-1.4-2.8-.9 1.2-1.8 2.4-1.8 3.9 0 1.9 1.6 3.2 4 3.2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
  cmt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h11M6.5 21h11M7.5 3c0 4.5 4.5 5.5 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 5.5-4.5 9s4.5 4.5 4.5 9"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.4-1.4"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5" stroke-linecap="round"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>',
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.3" r="3.4"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>'
};
const ST_EMPTY = { queue: 'ไม่มีงานรอคิว เยี่ยมเลย!', doing: 'ยังไม่มีงานที่กำลังทำ', review: 'ไม่มีงานรอตรวจ', fix: 'ไม่มีงานที่ต้องแก้', done: 'ยังไม่มีงานเสร็จใน 14 วัน' };
const KPI_IC = {
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5" stroke-linecap="round"/></svg>',
  late: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  urgent: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  doing: '<svg class="kpi-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>'
};
const VIEWS = [
  { id: 'flow', label: 'ภาพรวมบริษัท', short: 'บริษัท' },
  { id: 'home', label: 'ภาพรวม', short: 'ภาพรวม', g: 'ฝ่ายแบบ' }, { id: 'board', label: 'บอร์ดงาน', short: 'บอร์ด', g: 'ฝ่ายแบบ' }, { id: 'list', label: 'รายการงาน', short: 'รายการ', g: 'ฝ่ายแบบ' },
  { id: 'prod', label: 'บอร์ดผลิต', short: 'ผลิต', g: 'ฝ่ายผลิต' },
  { id: 'team', label: 'ทีมงาน', short: 'ทีม', g: 'ทั่วไป' }, { id: 'report', label: 'สรุปรายงาน', short: 'รายงาน', g: 'ทั่วไป' }, { id: 'settings', label: 'ตั้งค่า', short: 'ตั้งค่า', g: 'ทั่วไป' }
];
/* ฝ่ายผลิตเห็นเฉพาะเมนูที่เกี่ยวกับงานผลิต */
const PROD_VIEWS = ['flow', 'home', 'board', 'list', 'prod', 'team', 'settings'];
const viewsFor = u => VIEWS.filter(v => !(u && u.role === 'prod') || PROD_VIEWS.indexOf(v.id) >= 0);

/* ============ state ============ */
const CFG = window.KIWNGAN_CONFIG || {};
const DEFAULT_CONN = () => (/^https:\/\/script\.google\.com\//.test(CFG.api || '') ? { url: CFG.api } : null);
const LOCKED = () => !!DEFAULT_CONN();   // this site is tied to one team's database
const S = {
  settings: null, jobs: [], logs: [],
  view: LS.get('view', 'home'),
  me: '', user: null, users: [], screen: 'boot', login: { userId: '', pin: '', err: '', busy: false, roster: null, brand: null, showConn: false },
  conn: LS.get('conn', null) || DEFAULT_CONN(),   // {url} when connected to a sheet
  f: { q: '', member: LS.get('fMember', 'all'), status: 'open', group: 'all', month: '' },
  edit: null, draft: null, draftDirty: false,
  sync: 'idle', syncErr: '', lastSync: 0, loaded: false
};
try { const qv = new URLSearchParams(location.search).get('view'); if (qv && VIEWS.some(v => v.id === qv)) S.view = qv; } catch (e) {}
const mode = () => (S.conn && S.conn.url ? 'sheet' : 'demo');
const tokenKey = () => 'token:' + (mode() === 'sheet' ? S.conn.url : 'demo');

/* permissions — the same rules are enforced by the backend */
/* ผู้ร่วมทำงาน: ชื่อคั่นจุลภาคในช่อง helpers — ทำงาน/จับเวลา/เปลี่ยนสถานะได้เหมือนผู้รับผิดชอบ */
const helpersOf = j => String((j && j.helpers) || '').split(',').map(x => x.trim()).filter(Boolean);
const inJob = (j, name) => !!name && (j.assignee === name || helpersOf(j).includes(name));
const P = {
  admin: u => !!u && u.role === 'admin',
  leads: (u, j) => !!u && (u.role === 'admin' || j.assignee === u.name || j.createdBy === u.name),
  owns: (u, j) => !!u && (u.role === 'admin' || j.assignee === u.name || j.createdBy === u.name || helpersOf(j).includes(u.name)),
  del: (u, j) => !!u && (u.role === 'admin' || j.createdBy === u.name),
  lead: u => !!u && (u.role === 'admin' || u.role === 'lead')
};
const isAdmin = () => P.admin(S.user);
const isLead = () => P.lead(S.user);   // หัวหน้างาน/แอดมิน: see everyone's numbers and reports
const ROLES = { admin: { label: 'ผู้ดูแลระบบ', cls: 'r-admin' }, lead: { label: 'หัวหน้างาน · ฝ่ายแบบ', short: 'หัวหน้างาน', dept: 'd', cls: 'r-lead' }, prod: { label: 'พนักงาน · ฝ่ายผลิต', short: 'พนักงาน', dept: 'p', cls: 'r-prod' }, user: { label: 'พนักงาน · ฝ่ายแบบ', short: 'พนักงาน', dept: 'd', cls: 'r-user' } };
const DEPTS = { d: 'ฝ่ายแบบ', p: 'ฝ่ายผลิต' };
const deptTag = u => { const r = ROLES[roleOf(u)]; return r.dept ? '<span class="dept-tag dept-' + r.dept + '">' + DEPTS[r.dept] + '</span>' : ''; };   // ป้ายแผนกบนการ์ดผู้ใช้
const ROLE_IC = {
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/></svg>',
  lead: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17h18l-1.6-9.5-4.4 3.8L12 4l-3 7.3-4.4-3.8z"/><rect x="3" y="18.5" width="18" height="2.2" rx="1"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>',
  prod: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/></svg>'
};
const roleOf = u => (u && ROLES[u.role]) ? u.role : 'user';
const roleChip = (u, small) => { const r = roleOf(u); return '<span class="role-chip ' + ROLES[r].cls + (small ? ' sm' : '') + '" title="' + ROLES[r].label + '">' + ROLE_IC[r] + (small ? '' : '<span>' + (ROLES[r].short || ROLES[r].label) + '</span>') + '</span>'; };
const roleOpts = cur => ['user', 'prod', 'lead', 'admin'].map(r => '<option value="' + r + '"' + ((cur || 'user') === r ? ' selected' : '') + '>' + ROLES[r].label + '</option>').join('');
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
  let guard = 0;
  while (left > 0 && guard++ < 400) { d.setDate(d.getDate() + 1); if ((!skipWeekends || (d.getDay() !== 0 && d.getDay() !== 6)) && !isHoliday(isoOf(d))) left--; }
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
const designers = () => members().filter(u => u.role !== 'prod');   // ฝ่ายผลิตไม่อยู่ในรายชื่อรับงาน/ผู้ร่วมทำงาน/สรุปของฝ่ายแบบ
const memberBy = name => (S.users || []).find(m => m.name === name);
function avUser(u, cls, name) {
  name = name || (u && u.name) || '';
  const photo = u && u.photo;
  return '<span class="av ' + (cls || '') + (photo ? ' ph' : '') + '" style="--c:' + esc(u && u.color ? u.color : '#5B6B7A') + '" title="' + esc(name) + '">' +
    (photo ? '<img src="' + esc(photo) + '" alt="">' : esc(initial(name))) + '</span>';
}
function cardExtras(j) {
  const nf = filesOf(j.id).length, nc = (S.cmtCount || {})[j.id] || 0, cl = clChip(j);
  return nf || nc || cl ? '<div class="card-x">' + cl + (nf ? '<span class="tg" title="ไฟล์งาน ' + nf + ' ไฟล์">' + STI.clip + nf + '</span>' : '') + (nc ? '<span class="tg" title="คอมเมนต์ ' + nc + '">' + STI.cmt + nc + '</span>' : '') + '</div>' : '';
}
function avTeam(j) {
  const hs = helpersOf(j); if (!hs.length) return av(j.assignee);
  return '<span class="av-team" title="' + esc([j.assignee || 'ยังไม่มอบหมาย'].concat(hs).join(', ')) + '">' + av(j.assignee) + hs.slice(0, 3).map(n => av(n, 'sm')).join('') + (hs.length > 3 ? '<span class="av sm more">+' + (hs.length - 3) + '</span>' : '') + '</span>';
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
  if (isLate(j)) return '<span class="pill s-late">' + STI.fire + 'เลยกำหนด</span>';
  const s = ST[j.status] || ST.queue; return '<span class="pill ' + s.cls + '">' + (STI[j.status] || '') + s.label + '</span>';
}
function lvBars(n) { n = +n || 0; let h = '<span class="lv" title="ระดับความยาก ' + (n || '-') + '">'; for (let i = 1; i <= 3; i++) h += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return h + '</span>'; }
const groupShort = g => String(g || '').replace(/^งาน\s*/, '');
function dueInfo(j) {
  if (j.status === 'done') return { cls: '', text: 'เสร็จ ' + fd(finDate(j)) + (onTime(j) ? '' : ' · ช้า') };
  if (!j.due) return { cls: '', text: 'ไม่มีกำหนด' };
  const d = daysBetween(today(), j.due);
  if (d < 0) return { cls: 'late', text: 'เลย ' + (-d) + ' วัน' };
  if (d === 0) return { cls: 'soon today', text: 'ส่งวันนี้' };
  if (d === 1) return { cls: 'soon tomorrow', text: 'ส่งพรุ่งนี้' };
  return { cls: '', text: 'ส่ง ' + fd(j.due) };
}
function taskCat(name) { const t = (S.settings.taskTypes || []).find(x => x.name === name); return t ? t.cat : (/CAM$/.test(name || '') ? 'cam' : 'draw'); }
/* สีแยกตามรายละเอียดงาน (CAD/CAM/…) และกลุ่มงาน (2D/3D/…) — ตั้งสีรายละเอียดงานเองได้ในหน้าตั้งค่า */
const TYPE_COLORS = ['#2563EB', '#EA580C', '#9333EA', '#059669', '#CA8A04', '#DB2777', '#0891B2', '#65A30D'];
const GROUP_COLORS = ['#0EA5E9', '#8B5CF6', '#F43F5E', '#10B981', '#F59E0B', '#6366F1', '#14B8A6', '#A855F7'];
function typeColor(name) {
  if (!name) return '';
  const list = S.settings.taskTypes || [], i = list.findIndex(x => x.name === name);
  if (i < 0) return '#64748B';
  return /^#[0-9a-f]{6}$/i.test(list[i].color || '') ? list[i].color : TYPE_COLORS[i % TYPE_COLORS.length];
}
function groupColor(g) {
  if (!g) return '';
  const i = (S.settings.groups || []).indexOf(g);
  return i < 0 ? '#64748B' : GROUP_COLORS[i % GROUP_COLORS.length];
}
const typeChip = (name, cls) => name ? '<span class="tchip ' + (cls || '') + '" style="--c:' + typeColor(name) + '">' + esc(name) + '</span>' : '';
const groupChip = (g, cls) => g ? '<span class="gchip ' + (cls || '') + '" style="--c:' + groupColor(g) + '">' + STI.layers + esc(groupShort(g)) + '</span>' : '';
/* งาน CAM ไม่ต้องรอตรวจ: กำลังทำ → เสร็จแล้ว ทันที */
const isCam = j => !!j && taskCat(j.taskType) === 'cam';
/* เลข Job ซ้ำ: ทุกงานจบที่ CAM → เพิ่มงาน "ทำ CAM" ของเลขเดิมได้ (ถ้ายังไม่มีงาน CAM ของเลขนั้น) · รายละเอียดอื่นซ้ำไม่ได้ */
function codeClash(code, taskType, jobs, skipId) {
  const same = (jobs || []).filter(x => x.id !== skipId && String(x.code).toLowerCase() === String(code).toLowerCase());
  if (!same.length) return '';
  if (taskCat(taskType) !== 'cam') return 'มีเลข Job ' + code + ' อยู่แล้ว — เพิ่มซ้ำได้เฉพาะงาน "ทำ CAM" ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1';
  if (same.some(x => taskCat(x.taskType) === 'cam')) return 'เลข Job ' + code + ' มีงาน CAM อยู่แล้ว ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1';
  return '';
}
const flowOf = j => isCam(j) ? ['queue', 'doing', 'done'] : FLOW;
function nextOf(j) { const n = NEXT[j.status]; return isCam(j) && (n === 'review') ? 'done' : n; }
function flowIdxOf(j) { const f = flowOf(j); if (f === FLOW) return flowIdx(j.status); return j.status === 'hold' ? 0 : j.status === 'done' ? 2 : j.status === 'queue' ? 0 : 1; }
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
    skipWeekends: true,
    machines: ['Router', 'Laser', 'Punching', 'WaterJet']
  };
}
function normalizeSettings(s) {
  const d = defaultSettings(); s = Object.assign({}, d, s || {});
  ['members', 'sales', 'groups', 'taskTypes', 'levels', 'machines'].forEach(k => { if (!Array.isArray(s[k])) s[k] = d[k]; });
  if (!s.sla || typeof s.sla !== 'object') s.sla = d.sla;
  return s;
}

/* ============ demo data ============ */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedMsgs(d) {
  const t = today(), y = addDays(t, -1), op = (d.jobs || []).find(j => j.status === 'doing') || {};
  return [
    { id: 'm_demo1', ts: y + 'T08:30:00', from: 'แอดมิน', to: 'team', kind: 'msg', text: 'สวัสดีทีม 👋 สัปดาห์นี้งานด่วนเยอะ ช่วยอัปเดตสถานะในบอร์ดด้วยนะ', jobId: '', status: '', helper: '', readBy: [] },
    { id: 'm_demo2', ts: t + 'T09:12:00', from: 'บอส', to: 'team', kind: 'help', text: 'ช่วยตรวจไฟล์ CAM ให้หน่อย ไม่แน่ใจเรื่องขนาดดอกกัด', jobId: op.id || '', status: 'open', helper: '', readBy: ['บอส'] },
    { id: 'm_demo3', ts: t + 'T09:40:00', from: 'ต้น', to: 'ฝน', kind: 'msg', text: 'ฝน งานผนังล็อบบี้ได้ไฟล์ลูกค้ายัง', jobId: '', status: '', helper: '', readBy: ['ต้น'] }
  ];
}
function seedDemo() {
  const R = mulberry32(20261002), pick = a => a[Math.floor(R() * a.length)];
  const s = defaultSettings();
  s.company = 'บริษัทตัวอย่าง จำกัด';
  const users = [{ id: 'u0', name: 'แอดมิน', full: '', role: 'admin', color: '#2B2F36', active: true, pin: '1234' }, { id: 'u1', name: 'ต้น', full: 'ธนพล', role: 'user', color: '#0B6B70', active: true, pin: '1234' }, { id: 'u2', name: 'ฝน', full: 'ปภาวรินทร์', role: 'user', color: '#2D5FC4', active: true, pin: '1234' }, { id: 'u3', name: 'บอส', full: 'ณัฐวุฒิ', role: 'lead', color: '#B05A2A', active: true, pin: '1234' }];
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
    else if (i % 7 === 3) setSt(j, 'fix', { startedAt: j.received + 'T09:30', minutes: 70, note: j.note || 'sale ตรวจแล้ว ให้ขยายลายขอบอีก 5 มม.' });
  });
  // two overdue jobs and one on hold
  const o1 = jobs[N - 18], o2 = jobs[N - 15], h1 = jobs[N - 12];
  [o1, o2].forEach((j, i) => Object.assign(j, { status: i ? 'queue' : 'doing', received: addDays(t0, -8 - i), due: addDays(t0, -3 + i), startedAt: i ? '' : addDays(t0, -6) + 'T13:20', finishedAt: '', minutes: i ? 0 : 140, priority: i ? 'urgent' : j.priority }));
  Object.assign(h1, { status: 'hold', finishedAt: '', minutes: 0, startedAt: '', note: 'รอลูกค้าส่งไฟล์ลายใหม่' });
  [o1, o2, h1].forEach(j => { for (let i = logs.length - 1; i >= 0; i--) if (logs[i].jobId === j.id) logs.splice(i, 1); });
  // ผู้ร่วมทำงานตัวอย่าง: งานโครงการที่ยังไม่เสร็จ 2 งาน มีคนช่วย
  jobs.filter(j => j.status !== 'done' && /โครงการ/.test(j.group)).slice(0, 2).forEach(j => { j.helpers = users.filter(u => u.role !== 'admin' && u.name !== j.assignee).slice(0, 2 - (j === jobs[0] ? 1 : 0)).map(u => u.name).join(','); });
  // a running timer for ฝน
  const runJob = jobs.filter(j => j.status === 'doing' && j !== o1).slice(-1)[0];
  if (runJob) {
    runJob.assignee = 'ฝน'; runJob.createdBy = 'ฝน';
    const st = new Date(Date.now() - 47 * 60000);
    logs.push({ id: 'lrun', jobId: runJob.id, member: 'ฝน', start: isoOf(st) + 'T' + pad(st.getHours()) + ':' + pad(st.getMinutes()), end: '', minutes: 0 });
  }
  return { settings: s, users: users, jobs: jobs, logs: logs, activity: [] };
}

/* งานประเภทไหน "ส่งเข้าผลิต" เมื่อทำเสร็จ: ตั้งเองได้ในตั้งค่า (ค่าเริ่มต้น: ชื่อมีคำว่า CAM) */
function toProdType(name, settings) { const t = ((settings || S.settings || {}).taskTypes || []).find(x => x.name === name); return t && t.prod !== undefined ? t.prod === true || t.prod === 'true' : /CAM/i.test(String(name || '')); }
function seedProds(d) {   // ตัวอย่างงานผลิตในโหมดทดลอง: เอาเลข Job ที่ CAM เสร็จแล้วมากระจายตามขั้น
  const codes = [], seen = {}, u = 'ช่างเอ';
  d.jobs.filter(j => j.status === 'done' && /CAM/.test(j.taskType || '')).sort((a, b) => String(finDate(b)).localeCompare(String(finDate(a)))).forEach(j => { if (!seen[j.code]) { seen[j.code] = 1; codes.push(j); } });
  const M = ['Router', 'Laser', 'Punching', 'WaterJet'], t = today(), plan = ['wait', 'wait', 'machine', 'machine', 'machine', 'paint', 'assemble', 'pack', 'ready', 'ready', 'shipped', 'shipped'];
  return codes.slice(0, plan.length).map((j, i) => { const st = plan[i], ago = n => addDays(t, -n) + 'T' + pad(9 + i % 7) + ':' + pad(i * 7 % 60);
    const ms = st === 'wait' ? [] : i % 3 === 0 ? [{ m: M[1], d: st === 'machine' ? ago(0) : ago(2) }, { m: M[2], d: st === 'machine' ? '' : ago(1) }] : [{ m: M[i % 4], d: st === 'machine' ? '' : ago(2) }];
    const hist = [{ t: ago(5), by: 'ระบบ', s: 'wait', x: 'ออกแบบเสร็จ ส่งเข้าผลิต' }].concat(st === 'wait' ? [] : [{ t: ago(st === 'machine' ? (i === 4 ? 3 : 1) : 4), by: u, s: 'machine', x: '' }]).concat(['paint', 'assemble', 'pack', 'ready', 'shipped'].slice(0, Math.max(0, ['paint', 'assemble', 'pack', 'ready', 'shipped'].indexOf(st) + 1)).map((s2, k) => ({ t: ago(3 - k), by: u, s: s2, x: '' })));
    return { id: 'p_demo' + i, code: j.code, title: j.title || '', sale: j.sale || '', group: j.group || '', stage: st, machines: JSON.stringify(ms), paint: i === 7 ? 'no' : '', note: i === 5 ? 'สีตามตัวอย่างลูกค้า เทาด้าน' : '',
      enteredAt: ago(5), startedAt: st === 'wait' ? '' : ago(4), finishedAt: st === 'ready' || st === 'shipped' ? ago(1) : '', shippedAt: st === 'shipped' ? ago(0) : '', createdBy: 'ระบบ', updatedAt: ago(0) + ':00', updatedBy: u, history: JSON.stringify(hist) }; });
}

/* ============ backends ============ */
const Demo = {
  db() { let d = LS.get('demo', null); if (!d || !d.jobs || !d.users) { d = seedDemo(); LS.set('demo', d); }
    if (!d.users.some(u => u.role === 'prod')) { d.users.push({ id: 'u4', name: 'ช่างเอ', full: 'ฝ่ายผลิต', role: 'prod', color: '#B8435F', active: true, pin: '1234' }); LS.set('demo', d); }   // ผู้ใช้ฝ่ายผลิตตัวอย่าง
    return d; },
  save(d) { LS.set('demo', d); },
  pub(u) { return { id: u.id, name: u.name, full: u.full, role: u.role, color: u.color, active: u.active, photo: u.photo || '' }; },
  async messages(p) { const d = this.db(), u = this.me(d); d.messages = d.messages || seedMsgs(d); this.save(d);
    const vis = m => m.to === 'team' || m.from === u.name || m.to === u.name || (m.to === 'admin' && P.admin(u));
    return { ids: d.messages.filter(vis).map(m => m.id), messages: d.messages.filter(m => vis(m) && (!p.since || m.ts > p.since || (m.kind === 'help' && m.status !== 'done'))).map(m => this.mmsg(d, u, m)), serverTime: nowLocal() + ':' + pad(new Date().getSeconds()) }; },
  mmsg(d, u, m) { const admins = d.users.filter(x => x.role === 'admin').map(x => x.name); const o = Object.assign({}, m, { fromAdmin: admins.indexOf(m.from) >= 0, read: (m.readBy || []).indexOf(u.name) >= 0 || m.from === u.name }); delete o.readBy;
    if (!P.admin(u)) { if (o.fromAdmin) o.from = ADMIN_LABEL; if (admins.indexOf(o.helper) >= 0) o.helper = ADMIN_LABEL; if (admins.indexOf(o.to) >= 0) o.to = 'admin'; } return o; },
  async sendMessage(p) { const d = this.db(), u = this.me(d); d.messages = d.messages || []; const text = String(p.text || '').trim(), img = /^data:image\//.test(p.img || '') ? String(p.img) : ''; if (!text && !img) throw new Error('พิมพ์ข้อความก่อนส่ง');
    let to = p.to || 'team'; const tu = d.users.find(x => x.name === to); if (tu && tu.role === 'admin' && !P.admin(u)) to = 'admin';
    const m = { id: uid('m_'), ts: nowLocal() + ':' + pad(new Date().getSeconds()), from: u.name, to: to, kind: p.kind === 'help' ? 'help' : 'msg', text: text, jobId: p.jobId || '', status: p.kind === 'help' ? 'open' : '', helper: '', readBy: [u.name], img: img };
    d.messages.push(m); this.save(d); return { message: this.mmsg(d, u, m) }; },
  async rtcSend() { return {}; },
  async rtcPoll() { return { signals: [] }; },
  async deleteMessages(p) { const d = this.db(); this.admin(this.me(d)); const n0 = (d.messages || []).length; d.messages = (d.messages || []).filter(m => (p.ids || []).indexOf(m.id) < 0); this.save(d); return { deleted: n0 - d.messages.length }; },
  async markRead(p) { const d = this.db(), u = this.me(d); (d.messages || []).forEach(m => { if ((p.ids || []).indexOf(m.id) >= 0) { m.readBy = m.readBy || []; if (m.readBy.indexOf(u.name) < 0) m.readBy.push(u.name); } }); this.save(d); return {}; },
  async helpUpdate(p) { const d = this.db(), u = this.me(d), m = (d.messages || []).find(x => x.id === p.id); if (!m) throw new Error('ไม่พบคำขอนี้');
    if (p.status === 'taken') { if (m.from === u.name) throw new Error('รับช่วยคำขอของตัวเองไม่ได้'); if (m.status !== 'open') throw new Error('มีคนรับช่วยแล้ว'); m.status = 'taken'; m.helper = u.name;
      const n = { id: uid('m_'), ts: nowLocal() + ':' + pad(new Date().getSeconds()), from: u.name, to: m.to === 'team' ? 'team' : m.from, kind: 'msg', text: '🙋 รับช่วยเรื่อง "' + m.text.slice(0, 60) + '" แล้ว', jobId: m.jobId, status: '', helper: '', readBy: [u.name] }; d.messages.push(n); this.save(d); return { message: this.mmsg(d, u, m), note: this.mmsg(d, u, n) }; }
    if (m.from !== u.name && m.helper !== u.name && !P.admin(u)) throw new Error('ปิดได้เฉพาะคนขอ คนที่รับช่วย หรือแอดมิน'); m.status = p.status; this.save(d); return { message: this.mmsg(d, u, m) }; },
  async addImage(p) { const d = this.db(), u = this.me(d), pj = /^p_/.test(p.jobId || '') ? (d.prods || []).find(x => x.id === p.jobId) : null, j = pj || d.jobs.find(x => x.id === p.jobId); if (!j) throw new Error('ไม่พบงานนี้'); if (pj ? !(u.role === 'prod' || u.role === 'admin') : !P.owns(u, j)) throw new Error(pj ? 'เพิ่มรูปงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน' : 'เพิ่มรูปได้เฉพาะงานของตัวเอง'); d.images = d.images || []; if (d.images.filter(m => m.jobId === p.jobId).length >= IMG_MAX) throw new Error('ใส่รูปได้สูงสุด ' + IMG_MAX + ' รูปต่องาน');
    const m = { id: uid('i_'), jobId: p.jobId, createdBy: u.name, createdAt: nowLocal(), thumb: p.thumb, full: p.full }; d.images.push(m);
    try { this.save(d); } catch (e) { d.images.pop(); throw new Error('พื้นที่ในโหมดทดลองเต็ม ลบรูปเก่าก่อน'); }
    return { image: { id: m.id, jobId: m.jobId, createdBy: this.mask(d, u, { n: m.createdBy }, ['n']).n, createdAt: m.createdAt, thumb: m.thumb } }; },
  async deleteImage(p) { const d = this.db(), u = this.me(d), m = (d.images || []).find(x => x.id === p.id); if (!m) throw new Error('ไม่พบรูปนี้'); const j = d.jobs.find(x => x.id === m.jobId); if (!P.admin(u) && m.createdBy !== u.name && !(/^p_/.test(m.jobId) && u.role === 'prod') && !(j && P.owns(u, j))) throw new Error('ลบได้เฉพาะรูปของงานตัวเอง'); d.images = d.images.filter(x => x.id !== p.id); this.save(d); return { id: p.id }; },
  async copyImages(p) { const d = this.db(), u = this.me(d); d.images = d.images || []; const out = d.images.filter(m => m.jobId === p.from).slice(0, IMG_MAX).map(m => Object.assign({}, m, { id: uid('i_'), jobId: p.to, createdBy: u.name, createdAt: nowLocal() })); d.images = d.images.concat(out); this.save(d); return { images: out.map(m => ({ id: m.id, jobId: m.jobId, createdBy: m.createdBy, createdAt: m.createdAt })) }; },
  async archive() { return { jobs: [], logs: [] }; },
  async addFile(p) { const d = this.db(), u = this.me(d), j = d.jobs.find(x => x.id === p.jobId); if (!j) throw new Error('ไม่พบงานนี้'); if (!P.owns(u, j)) throw new Error('แนบไฟล์ได้เฉพาะงานของตัวเอง');
    const size = Math.round(String(p.data || '').replace(/^data:[^,]*,/, '').length * 3 / 4), f = { id: uid('f_'), jobId: j.id, name: p.name, mime: p.mime, size: String(size), fileId: '', createdBy: u.name, createdAt: nowLocal(), data: size < 400000 ? p.data : '' };
    d.files = (d.files || []).concat(f); try { this.save(d); } catch (e) { d.files.pop(); f.data = ''; d.files.push(f); this.save(d); } return { file: f }; },
  async deleteFile(p) { const d = this.db(); d.files = (d.files || []).filter(f => f.id !== p.id); this.save(d); return { id: p.id }; },
  async comments(p) { const d = this.db(), u = this.me(d); return { comments: (d.comments || []).filter(c => c.jobId === p.jobId).map(c => this.mask(d, u, c, ['from'])) }; },
  async addComment(p) { const d = this.db(), u = this.me(d), text = String(p.text || '').trim(); if (!text) throw new Error('พิมพ์ข้อความก่อน'); const c = { id: uid('c_'), jobId: p.jobId, ts: nowLocal(), from: u.name, text: text }; d.comments = (d.comments || []).concat(c); this.save(d); return { comment: c }; },
  async deleteComment(p) { const d = this.db(), u = this.me(d), c = (d.comments || []).find(x => x.id === p.id); if (!c) throw new Error('ไม่พบคอมเมนต์'); if (!P.admin(u) && c.from !== u.name) throw new Error('ลบได้เฉพาะคอมเมนต์ของตัวเอง'); d.comments = d.comments.filter(x => x.id !== p.id); this.save(d); return { id: p.id, jobId: c.jobId }; },
  async saleLink(p) { const d = this.db(); this.admin(this.me(d)); if (!d.saleKey || p.reset) { d.saleKey = uid('k'); this.save(d); } return { key: d.saleKey }; },
  async saleView(p) { const d = this.db(); if (!d.saleKey || p.k !== d.saleKey) throw new Error('ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากแอดมิน'); const since = addDays(today(), -45);
    return { prods: (d.prods || []).filter(x => !p.sale || x.sale === p.sale).map(x => ({ code: x.code, title: x.title, sale: x.sale, group: x.group, stage: x.stage, machines: pms(x), paint: x.paint, assy: x.assy, enteredAt: x.enteredAt, finishedAt: x.finishedAt, shippedAt: x.shippedAt, due: x.due || '', note: x.note || '', imgs: (d.images || []).filter(m => m.jobId === x.id).map(m => m.thumb).filter(Boolean).slice(-6) })), machines: d.settings.machines || DEF_MACHINES, brand: (await this.ping()).brand, people: d.users.filter(u => u.active && u.role !== 'admin').map(u => ({ name: u.name, color: u.color })), sales: d.settings.sales || [], sale: p.sale || '', jobs: d.jobs.filter(j => (!p.sale || j.sale === p.sale) && (j.status !== 'done' || finDate(j) >= since)).map(j => { const c = clOf(j); return { assignee: j.assignee || '', helpers: j.helpers || '', code: j.code, title: j.title, group: j.group, taskType: j.taskType, status: j.status, received: j.received, due: j.due, finishedAt: j.finishedAt, sale: j.sale, priority: j.priority, note: j.note || '', steps: c.length ? c.filter(x => x.d).length + '/' + c.length : '', imgs: (d.images || []).filter(m => m.jobId === j.id).map(m => m.thumb).filter(Boolean).slice(-6) }; }) }; },
  async thumbs(p) { const d = this.db(), out = {}; (d.images || []).forEach(m => { if ((p.ids || []).indexOf(m.id) >= 0) out[m.id] = m.thumb; }); return { thumbs: out }; },
  async image(p) { const m = (this.db().images || []).find(x => x.id === p.id); if (!m) throw new Error('ไม่พบรูปนี้'); return { id: m.id, full: m.full }; },
  async setPhoto(p) { const d = this.db(), me = this.me(d), id = p.userId || me.id; if (id !== me.id) this.admin(me); const u = d.users.find(x => x.id === id); if (!u) throw new Error('ไม่พบผู้ใช้'); u.photo = String(p.photo || ''); this.save(d); return { user: this.pub(u) }; },
  me(d) {
    const u = d.users.find(x => x.id === LS.get(tokenKey(), ''));
    if (!u || !u.active) { const e = new Error('กรุณาเข้าสู่ระบบ'); e.code = 'auth'; throw e; }
    return u;
  },
  admin(u) { if (u.role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น'); },
  act(d, jobId, who, action, detail) { d.activity.push({ ts: nowLocal(), jobId: jobId, who: who, action: action, detail: detail || '' }); if (d.activity.length > 600) d.activity.splice(0, 100); },
  async ping() { const s = this.db().settings; return { brand: { company: s.company, appName: s.appName, accent: s.accent, logo: s.logo } }; },
  async roster() { const d = this.db(); return { users: d.users.filter(u => u.active && u.role !== 'admin').map(this.pub), brand: (await this.ping()).brand, sale: true }; },
  /* ฝ่ายผลิต (โหมดทดลอง) — กติกาเดียวกับหลังบ้าน */
  pfind(d, code) { const c = String(code || '').trim().toLowerCase(); return (d.prods || []).find(x => x.code.toLowerCase() === c && x.stage !== 'shipped') || null; },
  pensure(d, j, u) { d.prods = d.prods || []; if (this.pfind(d, j.code)) return; const t = nowLocal();
    d.prods.push({ id: uid('p_'), code: j.code, title: j.title || '', sale: j.sale || '', group: j.group || '', stage: 'wait', machines: '[]', paint: '', note: '', enteredAt: t, startedAt: '', finishedAt: '', shippedAt: '', createdBy: u.name, updatedAt: t + ':00', updatedBy: u.name, history: JSON.stringify([{ t: t, by: u.name, s: 'wait', x: 'ออกแบบเสร็จ ส่งเข้าผลิต' }]) }); },
  async prodSave(p) {
    const d = this.db(), u = this.me(d), data = p.prod || {}, now = nowLocal() + ':' + pad(new Date().getSeconds()); d.prods = d.prods || [];
    if (u.role !== 'prod' && u.role !== 'admin') throw new Error('อัปเดตงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน');
    let cur = data.id ? d.prods.find(x => x.id === data.id) : null; const before = cur ? clone(cur) : null;
    if (data.id && !cur) throw new Error('ไม่พบงานนี้ในฝ่ายผลิต อาจถูกลบไปแล้ว');
    if (cur && data.baseUpdatedAt && cur.updatedAt && data.baseUpdatedAt !== cur.updatedAt) throw new Error('งานนี้ถูกอัปเดตโดย ' + cur.updatedBy + ' เมื่อสักครู่ กดรีเฟรชแล้วลองอีกครั้ง');
    if (!cur) { const code = String(data.code || '').trim(); if (!code) throw new Error('กรุณาใส่เลข Job'); if (this.pfind(d, code)) throw new Error('เลข Job ' + code + ' อยู่ในฝ่ายผลิตแล้ว');
      const src = d.jobs.filter(j => j.code.toLowerCase() === code.toLowerCase()), pick = k => (src.find(j => j[k]) || {})[k] || '';
      cur = { id: uid('p_'), code: code, title: pick('title'), sale: pick('sale'), group: pick('group'), stage: 'wait', machines: '[]', paint: '', note: '', enteredAt: nowLocal(), startedAt: '', finishedAt: '', shippedAt: '', createdBy: u.name, history: '[]' }; d.prods.push(cur); }
    ['title', 'sale', 'group', 'note'].forEach(k => { if (data[k] !== undefined) cur[k] = String(data[k]); });
    if (data.due !== undefined) { const dd = String(data.due || '').slice(0, 10); if (dd && !/^\d{4}-\d{2}-\d{2}$/.test(dd)) throw new Error('กำหนดส่งไม่ถูกต้อง'); cur.due = dd; }
    if (data.paint !== undefined) cur.paint = data.paint === 'no' ? 'no' : '';
    if (data.assy !== undefined) cur.assy = data.assy === 'no' ? 'no' : '';
    if (data.machines !== undefined) cur.machines = JSON.stringify((Array.isArray(data.machines) ? data.machines : []).filter(x => x && x.m).map(x => ({ m: String(x.m), d: String(x.d || '') })));
    if (data.stage !== undefined) cur.stage = data.stage;
    const ms = pms(cur);
    if (cur.stage === 'machine' && !ms.length) { if (!before) d.prods.pop(); else Object.assign(cur, before); throw new Error('เลือกเครื่องอย่างน้อย 1 เครื่องก่อนเริ่มลงเครื่อง'); }
    if (cur.stage === 'machine' && ms.every(x => x.d)) cur.stage = 'paint';
    for (let k = 0; k < 3; k++) { if (pSkipped(cur, cur.stage) && (!before || before.stage !== cur.stage)) cur.stage = PORDER[PORDER.indexOf(cur.stage) + 1]; else break; }
    const si = PORDER.indexOf(cur.stage), n16 = now.slice(0, 16), iR = PORDER.indexOf('ready');
    cur.startedAt = si >= 1 ? cur.startedAt || n16 : ''; cur.finishedAt = si >= iR ? cur.finishedAt || n16 : ''; cur.shippedAt = si === iR + 1 ? cur.shippedAt || n16 : '';
    if (!before || before.stage !== cur.stage || before.machines !== cur.machines) cur.history = JSON.stringify(phist(cur).concat({ t: n16, by: u.name, s: cur.stage, x: String(data.why || '') }).slice(-40));
    cur.updatedAt = now; cur.updatedBy = u.name; this.save(d); return { prod: this.mask(d, u, clone(cur), ['createdBy', 'updatedBy']) };
  },
  async prodDelete(p) { const d = this.db(), u = this.me(d); if (u.role !== 'prod' && u.role !== 'admin') throw new Error('ลบงานผลิตได้เฉพาะฝ่ายผลิตหรือแอดมิน'); d.prods = (d.prods || []).filter(x => x.id !== p.id); this.save(d); return { id: p.id }; },
  async salePin(p) { const d = this.db(); this.admin(this.me(d)); d.salePin = p.pin ? String(p.pin) : ''; if (d.salePin && !d.saleKey) d.saleKey = uid('k'); this.save(d); return { on: !!d.salePin }; },
  async saleOpen(p) { const d = this.db(); if (String(p.pin) !== String(d.salePin || '1234')) throw new Error('PIN ไม่ถูกต้อง'); if (!d.saleKey) { d.saleKey = uid('k'); this.save(d); } return { key: d.saleKey }; },
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
  async bootstrap() { const d = this.db(), u = this.me(d); if (!d.prods) { d.prods = seedProds(d); this.save(d); } return { prods: (d.prods || []).map(x => this.mask(d, u, clone(x), ['createdBy', 'updatedBy'])), salePin: P.admin(u) ? !!d.salePin : undefined, settings: d.settings, users: d.users.filter(x => P.admin(u) || x.role !== 'admin').map(this.pub), jobs: d.jobs.map(j => this.mj(d, u, j)), files: d.files || [], cmtCount: (d.comments || []).reduce((o, c) => { o[c.jobId] = (o[c.jobId] || 0) + 1; return o; }, {}), logs: d.logs.map(l => this.ml(d, u, l)), images: (d.images || []).map(m => ({ id: m.id, jobId: m.jobId, createdBy: this.mask(d, u, { n: m.createdBy }, ['n']).n, createdAt: m.createdAt })), me: this.pub(u) }; },
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
      if (u.role === 'prod') throw new Error('ฝ่ายผลิตเพิ่มงานของฝ่ายแบบไม่ได้');
      { const clash = codeClash(job.code, job.taskType, d.jobs); if (clash) throw new Error(clash); }
      cur = { id: uid('j_'), createdAt: now, createdBy: u.name, minutes: 0 }; d.jobs.push(cur); delete job.id;
      if (!P.admin(u)) job.assignee = u.name;
    }
    if (before && job.helpers !== undefined && helpersOf(job).join(',') !== helpersOf(before).join(',') && !P.leads(u, before)) throw new Error('เพิ่ม/ลบผู้ร่วมทำงานได้เฉพาะผู้รับผิดชอบงานหรือแอดมิน');
    Object.assign(cur, job, { updatedAt: now, updatedBy: u.name });
    cur.helpers = helpersOf(cur).filter((n, i, a) => n !== cur.assignee && a.indexOf(n) === i).join(',');
    if (cur.status === 'done' && !cur.finishedAt) cur.finishedAt = now;
    if (cur.status !== 'done') cur.finishedAt = '';
    if (WORKING(cur.status) && !cur.startedAt) cur.startedAt = now;
    this.act(d, cur.id, u.name, !before ? 'create' : (before.status !== cur.status ? 'status' : 'edit'), !before ? cur.code : (before.status !== cur.status ? before.status + '→' + cur.status : ''));
    if (cur.status === 'done' && (!before || before.status !== 'done') && toProdType(cur.taskType, d.settings)) this.pensure(d, cur, u);
    this.save(d); return { job: this.mj(d, u, clone(cur)) };
  },
  async deleteJob(p) {
    const d = this.db(), u = this.me(d), j = d.jobs.find(x => x.id === p.id);
    if (!j) throw new Error('ไม่พบงานนี้');
    if (!P.del(u, j)) throw new Error('ลบได้เฉพาะงานที่ตัวเองสร้าง หรือให้แอดมินลบ');
    d.jobs = d.jobs.filter(x => x.id !== p.id); d.logs = d.logs.filter(l => l.jobId !== p.id); d.images = (d.images || []).filter(m => m.jobId !== p.id); this.save(d); return { id: p.id };
  },
  recalc(d, jobId) { const t = d.logs.filter(l => l.jobId === jobId && l.end).reduce((s, l) => s + l.minutes, 0); const j = d.jobs.find(x => x.id === jobId); if (j) j.minutes = t; return t; },
  async startTimer(p) {
    const d = this.db(), u = this.me(d), j = d.jobs.find(x => x.id === p.jobId), closed = [];
    if (!j) throw new Error('ไม่พบงานนี้');
    if (!P.owns(u, j)) throw new Error('จับเวลาได้เฉพาะงานของตัวเอง');
    const already = d.logs.find(l => !l.end && l.member === u.name && l.jobId === p.jobId);
    if (already) return { log: this.ml(d, u, clone(already)), job: this.mj(d, u, clone(j)), closed: [] };
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
  async deleteUser(p) {
    const d = this.db(), me = this.me(d); this.admin(me);
    const u = d.users.find(x => x.id === p.userId); if (!u) throw new Error('ไม่พบผู้ใช้นี้');
    if (u.id === me.id) throw new Error('ลบบัญชีตัวเองไม่ได้');
    if (u.role === 'admin' && !d.users.some(x => x.role === 'admin' && x.active && x.id !== u.id)) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
    d.users = d.users.filter(x => x.id !== u.id); this.save(d); return { userId: u.id };
  },
  async saveUser(p) {
    const d = this.db(), me = this.me(d), data = p.user; this.admin(me);
    const name = String(data.name || '').trim(); if (!name) throw new Error('กรุณาใส่ชื่อ');
    if (d.users.some(x => x.name === name && x.id !== data.id)) throw new Error('มีชื่อ ' + name + ' อยู่แล้ว');
    let u = data.id ? d.users.find(x => x.id === data.id) : null, pin = '';
    if (u) {
      if (u.id === me.id && data.role !== 'admin') throw new Error('ลดสิทธิ์ตัวเองไม่ได้ ให้แอดมินคนอื่นทำแทน');
      if (u.id === me.id && data.active === false) throw new Error('ปิดบัญชีตัวเองไม่ได้');
      if (data.role !== 'admin' && u.role === 'admin' && d.users.filter(x => x.role === 'admin' && x.active).length <= 1) throw new Error('ต้องมีแอดมินอย่างน้อย 1 คน');
      const old = u.name;
      Object.assign(u, { name: name, full: data.full || '', role: ['admin', 'lead', 'prod'].indexOf(data.role) >= 0 ? data.role : 'user', color: data.color || u.color, active: data.active !== false });
      if (old !== name) { d.jobs.forEach(j => { ['assignee', 'createdBy', 'updatedBy'].forEach(k => { if (j[k] === old) j[k] = name; }); }); d.logs.forEach(l => { if (l.member === old) l.member = name; }); }
    } else {
      pin = /^\d{4,6}$/.test(String(data.pin || '')) ? String(data.pin) : String(Math.floor(1000 + Math.random() * 9000));
      u = { id: uid('u_'), name: name, full: data.full || '', role: ['admin', 'lead', 'prod'].indexOf(data.role) >= 0 ? data.role : 'user', color: data.color || COLORS[d.users.length % COLORS.length], active: true, pin: pin };
      d.users.push(u);
    }
    this.save(d); return { user: this.pub(u), pin: pin };
  },
  async resetPin(p) { const d = this.db(); this.admin(this.me(d)); const u = d.users.find(x => x.id === p.userId); if (!u) throw new Error('ไม่พบผู้ใช้'); if (p.pin && !/^\d{4,6}$/.test(p.pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก'); u.pin = p.pin ? String(p.pin) : String(Math.floor(1000 + Math.random() * 9000)); this.save(d); return { userId: u.id, pin: u.pin }; },
};

/* ประตู Apps Script ของ Google บางครั้งค้าง 10–20 วิ (โค้ดเราทำงานเสร็จใน ~0.5 วิ) แต่ถ้าส่งคำขอซ้ำมักได้คำตอบใน 1–2 วิ
   → คำขอที่ส่งซ้ำได้ปลอดภัย (อ่านข้อมูล / สัญญาณที่มีรหัสกันซ้ำ) จะส่ง "สำรอง" อีกชุดถ้ายังไม่ตอบ แล้วใช้คำตอบที่มาก่อน */
const HEDGE = { saleView: 3500, ping: 4000, roster: 4000, bootstrap: 6000, messages: 3500, thumbs: 4500, image: 6000, activity: 4500, pushInfo: 4000, rtcPoll: 3500, rtcSend: 3000, stopTimer: 5000, markRead: 5000 };
const Remote = {
  call(action, payload, conn) {
    const h = HEDGE[action];
    if (!h || conn) return Remote.once(action, payload, conn);
    const wait = 0;   // รอสัญญาณแบบ long-poll ก็ส่งสำรองได้เลย: ทั้งสองคำขอรอสัญญาณชุดเดียวกัน ใช้อันที่ตอบก่อน
    return new Promise((resolve, reject) => {
      let settled = false, fails = 0, tries = 0, t2 = null, t3 = null;
      const go = () => { tries++; Remote.once(action, payload).then(r => { if (settled) { if (action === 'rtcPoll' && r && r.signals && r.signals.length) (r.signals || []).forEach(rtcOnSigOnce); return; } settled = true; clearTimeout(t2); clearTimeout(t3); resolve(r); },
        e => { fails++; if (settled) return; if (e.code === 'auth' || fails >= tries && tries >= 3) { settled = true; clearTimeout(t2); clearTimeout(t3); reject(e); } else if (fails >= tries) { clearTimeout(t2); go(); } }); };
      go();
      t2 = setTimeout(() => { if (!settled) go(); }, wait + h);            // ส่งสำรองครั้งที่ 2
      t3 = setTimeout(() => { if (!settled) go(); }, wait + h * 2.5);      // ยังเงียบอีก ส่งครั้งที่ 3
    });
  },
  async once(action, payload, conn) {
    const c = conn || S.conn;
    const body = { token: conn ? '' : LS.get(tokenKey(), ''), action: action, payload: payload || {} };
    // ทางด่วน: เซิร์ฟเวอร์ส่งคำตอบตรงมาที่ "กล่องรับ" ของเครื่องนี้ (Supabase) ไม่ต้องรอประตู googleusercontent ที่ชอบค้าง
    if (!IB.ready && (IB.ch || IB.starting) && !conn) { const t0 = Date.now(); while (!IB.ready && (IB.ch || IB.starting) && Date.now() - t0 < 1500) await new Promise(r => setTimeout(r, 50)); }   // กล่องรับกำลังเชื่อม รอแป๊บเดียวคุ้มกว่า
    const ib = IB.ready && !conn ? ibWait() : null;
    if (ib) { body.ri = IB.topic; body.rid = ib.rid; }
    const ac = ib && window.AbortController ? new AbortController() : null;
    const viaHttp = (async () => {
      let res;
      try { res = await fetch(c.url, { method: 'POST', body: JSON.stringify(body), redirect: 'follow', signal: ac ? ac.signal : undefined }); }
      catch (e) { if (ac && ac.signal.aborted) return null; throw new Error('ติดต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ตหรือ URL ของ Apps Script'); }
      try { return await res.json(); }
      catch (e) { if (ac && ac.signal.aborted) return null; if (res && !res.ok) throw new Error('ฐานข้อมูลไม่ว่างชั่วคราว (' + res.status + ') ลองใหม่อีกครั้ง'); throw new Error('URL นี้ไม่ใช่ API ของ KiwNgan หรือยังไม่ได้ Deploy แบบ "ทุกคน"'); }
    })();
    let data;
    if (ib) {
      try {
        data = await new Promise((resolve, reject) => {
          ib.p.then(t => { let d = null; try { d = JSON.parse(t); } catch (e) {} if (d) { resolve(d); if (ac) ac.abort(); } });
          viaHttp.then(d => { if (d) resolve(d); }, e => setTimeout(() => reject(e), 4000));
        });
      } finally { ib.cancel(); }
    } else data = await viaHttp;
    if (!data.ok) { const e = new Error(String(data.error || 'เกิดข้อผิดพลาด').replace(/^AUTH:/, '')); e.code = data.code; throw e; }
    if (!conn) rtAfterWrite(action);
    return data.data;
  }
};
['prodSave', 'prodDelete', 'salePin', 'saleOpen', 'addFile', 'deleteFile', 'comments', 'addComment', 'deleteComment', 'saleLink', 'saleView', 'copyImages', 'archive', 'ping', 'roster', 'login', 'logout', 'setPhoto', 'addImage', 'deleteImage', 'thumbs', 'image', 'messages', 'sendMessage', 'markRead', 'helpUpdate', 'deleteMessages', 'rtcSend', 'rtcPoll', 'pushKey', 'pushSub', 'pushUnsub', 'pushInfo', 'room', 'bootstrap', 'saveJob', 'deleteJob', 'startTimer', 'stopTimer', 'deleteLog', 'saveSettings', 'activity', 'changePin', 'saveUser', 'deleteUser', 'resetPin']
  .forEach(a => { Remote[a] = p => Remote.call(a, p); });
const api = () => (mode() === 'sheet' ? Remote : Demo);

/* ============ เรียลไทม์ผ่าน Supabase (ถ้าตั้งค่าไว้) ============
   สายเปิดค้าง (WebSocket): สัญญาณโทร/แชร์จอ และ "มีข้อมูลเปลี่ยน" ถึงทุกเครื่องในเสี้ยววินาที
   ข้อมูลงานยังอยู่ใน Google Sheet · ข้อความทุกชิ้นเข้ารหัส (AES-GCM) ด้วยกุญแจของทีม · ใช้ไม่ได้เมื่อไร กลับไปใช้ Apps Script เอง */
const RT = { cfg: null, client: null, ch: null, ok: false, key: null, room: '', chgT: null };
const RT_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
const b64e = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
const b64d = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
function loadLib(src) { return new Promise((res, rej) => { if (window.supabase && window.supabase.createClient) return res(); const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); }
const SB = { c: null, url: '' };
function sbClient(url, key) {
  if (!SB.c || SB.url !== url) { SB.c = window.supabase.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); SB.url = url; }
  return SB.c;
}
/* กล่องรับคำตอบส่วนตัวของเครื่องนี้ (ชื่อสุ่ม เปลี่ยนทุกครั้งที่เปิดแอป) */
const IB = { ready: false, starting: false, topic: '', url: '', ch: null, pend: {} };
function ibRand(n) { const a = crypto.getRandomValues(new Uint8Array(n)); return Array.from(a, x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); }
async function ibStart(cfg) {
  if (!cfg || !cfg.url || !cfg.key || mode() !== 'sheet' || !(window.crypto && crypto.getRandomValues)) return;
  LS.set('rtpub', { url: cfg.url, key: cfg.key });
  if (IB.ch && IB.url === cfg.url) return;
  IB.starting = true; setTimeout(() => { IB.starting = false; }, 4000);
  try {
    await loadLib(RT_LIB);
    if (IB.ch && IB.url === cfg.url) return;
    IB.url = cfg.url; IB.topic = 'kn-i-' + ibRand(24); IB.ready = false;
    IB.ch = sbClient(cfg.url, cfg.key).channel(IB.topic, { config: { broadcast: { self: false, ack: false } } });
    IB.ch.on('broadcast', { event: 'r' }, m => ibIn(m && m.payload));
    IB.ch.subscribe(st => { IB.ready = st === 'SUBSCRIBED'; IB.starting = false; });
  } catch (e) { IB.ready = false; IB.starting = false; }
}
function ibIn(p) {
  if (!p || !p.rid) return;
  const w = IB.pend[p.rid]; if (!w) return;
  if (w.parts[p.i] === undefined) { w.parts[p.i] = String(p.d || ''); w.got++; }
  if (w.got >= (p.n || 1)) { delete IB.pend[p.rid]; w.resolve(w.parts.join('')); }
}
function ibWait() {
  const rid = ibRand(16); let resolve;
  const p = new Promise(r => { resolve = r; });
  IB.pend[rid] = { parts: [], got: 0, resolve: resolve };
  return { rid: rid, p: p, cancel: () => { delete IB.pend[rid]; } };
}
function rtStop() { try { if (RT.client && RT.ch) RT.client.removeChannel(RT.ch); } catch (e) {} Object.assign(RT, { cfg: null, ch: null, ok: false }); }
async function rtSetup(cfg) {
  if (!cfg || !cfg.url || !cfg.key || !cfg.secret || mode() !== 'sheet' || !(window.crypto && crypto.subtle)) return rtStop();
  if (RT.cfg && RT.cfg.url === cfg.url && RT.cfg.secret === cfg.secret && RT.ch) return;
  rtStop(); RT.cfg = cfg;
  try {
    await loadLib(RT_LIB);
    const enc = new TextEncoder();
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('room:' + cfg.secret)));
    RT.room = 'kn-' + Array.from(h.slice(0, 12), x => x.toString(16).padStart(2, '0')).join('');
    RT.key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode('key:' + cfg.secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
    if (!RT.client) RT.client = sbClient(cfg.url, cfg.key);
    RT.ch = RT.client.channel(RT.room, { config: { broadcast: { self: false, ack: false } } });
    RT.ch.on('broadcast', { event: 's' }, m => { rtIn(m && m.payload).catch(() => {}); });
    RT.ch.subscribe(st => { const was = RT.ok; RT.ok = st === 'SUBSCRIBED'; if (RT.ok && !was) { rtLoop(); } });
  } catch (e) { RT.ok = false; }
}
async function rtSend(obj) {
  if (!RT.ok || !RT.key) return false;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, RT.key, new TextEncoder().encode(JSON.stringify(obj)));
    await RT.ch.send({ type: 'broadcast', event: 's', payload: { iv: b64e(iv), c: b64e(c) } });
    return true;
  } catch (e) { return false; }
}
async function rtIn(p) {
  if (!p || !p.iv || !p.c || !RT.key) return;
  let o; try { o = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(p.iv) }, RT.key, b64d(p.c)))); } catch (e) { return; }
  if (o.k === 'sig' && o.g) {
    const to = o.g.to, mine = to === S.me || ((to === 'admin' || to === ADMIN_LABEL) && isAdmin());
    if (mine && o.g.from !== S.me) rtcOnSigOnce(o.g);
  } else if (o.k === 'chg') {
    if (o.what === 'msg') { if (M.loaded) pollMessages(); }
    else { clearTimeout(RT.chgT); RT.chgT = setTimeout(rtDataChanged, 350); }
  }
}
function rtDataChanged() {
  if (S.screen !== 'app') return;
  if (S.edit || S.draftDirty || S.loading || S.saving) { clearTimeout(RT.chgT); RT.chgT = setTimeout(rtDataChanged, 1500); return; }
  load(true);
}
const RT_DATA = { saveJob: 1, deleteJob: 1, prodSave: 1, prodDelete: 1, startTimer: 1, stopTimer: 1, deleteLog: 1, setPhoto: 1, addImage: 1, deleteImage: 1, copyImages: 1, saveSettings: 1, saveUser: 1, resetPin: 1 };
const RT_MSG = { sendMessage: 1, markRead: 0, helpUpdate: 1, deleteMessages: 1 };
function rtAfterWrite(action) { if (RT_DATA[action]) rtSend({ k: 'chg', what: 'data' }); else if (RT_MSG[action]) rtSend({ k: 'chg', what: 'msg' }); }
function rtLoop() { if (typeof rtcLoop === 'function') rtcLoop(); }

/* ============ state mutations ============ */
function upsert(arr, obj) { const i = arr.findIndex(x => x.id === obj.id); if (i >= 0) arr[i] = Object.assign({}, arr[i], obj); else arr.push(obj); }
function applyStop(r) { if (r.log) upsert(S.logs, r.log); const j = jobById(r.jobId); if (j && r.minutes != null) j.minutes = r.minutes; }

async function load(silent, boot) {
  if (!LS.get(tokenKey(), '')) return showLogin();
  if (silent && S.loading) return;
  S.loading = true;
  // โหลดเงียบ: ส่ง stamp ไปด้วย ถ้าข้อมูลไม่เปลี่ยน เซิร์ฟเวอร์ตอบทันทีโดยไม่อ่านชีต (บังคับโหลดเต็มทุก 5 นาที)
  const stamp = silent && S.dataStamp && Date.now() - (S.fullAt || 0) < 300000 ? S.dataStamp : '';
  if (!stamp) { S.sync = 'busy'; if (!silent && S.screen === 'app') renderShell(); }
  try {
    let d = null;
    for (let i = 0; i < 3; i++) {   // Apps Script occasionally answers empty while busy/redeploying: retry quietly
      try { d = boot && i === 0 ? boot : await api().bootstrap(stamp ? { stamp: stamp } : {}); } catch (x) { if (x.code === 'auth' || i === 2) throw x; d = null; }
      if (d && d.same) { S.sync = 'ok'; S.syncErr = ''; S.lastSync = Date.now(); S.loading = false; return; }
      if (d && d.me && d.settings) break;
      d = null; await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
    if (!d) throw new Error('ฐานข้อมูลตอบกลับไม่ครบ กรุณากด "ลองอีกครั้ง"');
    S.settings = normalizeSettings(d.settings);
    S.users = d.users || []; S.user = d.me; S.me = d.me.name;
    const prevJobs = S.loaded && S.me && S.jobs && S.jobs.length ? S.jobs : null;
    S.jobs = d.jobs || []; S.logs = d.logs || []; S.images = d.images || []; S.files = d.files || []; S.prods = d.prods || []; S.salePinOn = !!d.salePin;
    if (!viewsFor(S.user).some(v => v.id === S.view) || (S.screen !== 'app' && isProdRole() && S.view !== 'flow')) S.view = isProdRole() ? 'prod' : 'home';   // ฝ่ายผลิตเข้าระบบแล้วเปิดบอร์ดผลิตเลย
    { const pc = S.loaded ? S.cmtCount : null; S.cmtCount = d.cmtCount || {}; if (pc) setTimeout(() => cmtAlerts(pc), 0); }
    if (d.rt !== undefined) { rtSetup(d.rt); ibStart(d.rt); }
    S.archivedBefore = d.archivedBefore || '';
    setTimeout(() => jobAlerts(prevJobs), 0);
    S.dataStamp = d.stamp || ''; S.fullAt = Date.now();
    if (!S.draftDirty) S.draft = null;
    S.sync = 'ok'; S.syncErr = ''; S.lastSync = Date.now(); S.loaded = true;
    if (S.screen !== 'app') { S.animIn = true; setTimeout(startMsgPolling, 800); }
    S.screen = 'app'; document.body.classList.remove('auth'); applyTheme();
  } catch (e) {
    S.loading = false;
    if (e.code === 'auth') { LS.del(tokenKey()); toast(e.message, true); return showLogin(); }
    S.sync = 'err'; S.syncErr = e.message;
    if (!S.loaded) { S.settings = normalizeSettings(null); S.loaded = true; }
    if (S.screen !== 'app') { S.login.err = e.message; S.login.retry = true; return showLogin(true); }
    if (!silent) toast(e.message, true);
  }
  S.loading = false;
  applyBrand(); render();
}

/* ============ install as an app (PWA) ============ */
const INST = { evt: null, installed: false, help: false };
try { INST.installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
const UA = navigator.userAgent || '';
const IS_IOS = /iphone|ipad|ipod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
const IS_ANDROID = /android/i.test(UA);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST.evt = e; if (S.screen === 'login') renderLogin(); });
window.addEventListener('appinstalled', () => { INST.installed = true; INST.evt = null; INST.help = false; toast('ติดตั้งแอปเรียบร้อย เปิดได้จากหน้าจอหลักหรือเมนูแอป'); if (S.screen === 'login') renderLogin(); });
async function installApp() {
  if (INST.evt) {
    const e = INST.evt; INST.evt = null;
    try { await e.prompt(); const c = await e.userChoice; if (c && c.outcome === 'accepted') { INST.installed = true; } } catch (x) {}
    if (S.screen === 'login') renderLogin(); return;
  }
  INST.help = !INST.help; renderLogin();
}
const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
function loadQr(cb) {
  if (window.qrcode) return cb();
  const sc = document.createElement('script'); sc.src = 'vendor/qrcode.js'; // qrcode-generator (MIT), served with the app
  sc.onload = cb; sc.onerror = () => { const el = $('#instQr'); if (el) el.innerHTML = '<small>สร้าง QR ไม่ได้ ใช้ปุ่มคัดลอกลิงก์แทน</small>'; };
  document.head.appendChild(sc);
}
function drawQr() {
  const el = $('#instQr'); if (!el || el.dataset.done) return;
  loadQr(() => {
    const box = $('#instQr'); if (!box || !window.qrcode) return;
    const q = window.qrcode(0, 'M'); q.addData(appUrl()); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); box.dataset.done = '1';
  });
}
function installBlock() {
  if (INST.installed) return '';
  const tab = INST.tab || (IS_IOS || IS_ANDROID ? 'mobile' : 'desktop');
  const ol = a => '<ol class="lg-steps">' + a.map(x => '<li>' + x + '</li>').join('') + '</ol>';
  const mobile = '<div class="inst-grid">' +
      (!(IS_IOS || IS_ANDROID) ? '<div class="inst-qr"><div id="instQr" class="qr-box"><span class="spinner"></span></div><small>สแกนด้วยกล้องมือถือ<br>เพื่อเปิดแอปบนมือถือ</small></div>' : '') +
      '<div class="inst-os"><b class="os">iPhone / iPad</b>' + ol(['เปิดลิงก์ใน <b>Safari</b>', 'แตะ <b>แชร์</b> <span class="k">⬆︎</span>', 'เลือก <b>เพิ่มไปยังหน้าจอโฮม</b> → <b>เพิ่ม</b>']) +
      '<b class="os">Android</b>' + ol(['เปิดลิงก์ใน <b>Chrome</b>', 'แตะ <span class="k">⋮</span> มุมขวาบน', 'เลือก <b>ติดตั้งแอป</b> / <b>เพิ่มลงในหน้าจอหลัก</b>']) + '</div></div>';
  const desktop = '<div class="inst-os"><b class="os">Windows / Mac — Chrome หรือ Edge</b>' +
      ol(['เปิดลิงก์นี้ใน <b>Chrome</b> หรือ <b>Edge</b>', 'กดไอคอน <span class="k">⊕</span> หรือ <span class="k">⤓</span> ท้ายช่องที่อยู่เว็บ<br><small>หรือเมนู <span class="k">⋮</span> → <b>บันทึกและแชร์ / แอป</b> → <b>ติดตั้ง KiwNgan</b></small>', 'กด <b>ติดตั้ง</b> แอปจะอยู่บนเดสก์ท็อปและเมนู Start / Dock']) +
      '<b class="os">Mac — Safari</b>' + ol(['เมนู <b>ไฟล์</b> → <b>เพิ่มไปที่ Dock</b>']) + '</div>';
  return '<div class="lg-install">' +
    '<div class="lg-inst-row"><span class="lg-inst-ic">' + I.download + '</span><div><b>ติดตั้งแอปลงเครื่อง</b><small>ใช้ได้ทั้งมือถือและคอมพิวเตอร์ เปิดจากไอคอนได้ทันที</small></div>' +
      (INST.evt ? '<button type="button" class="btn primary sm" data-act="install">ติดตั้งเลย</button>' : '') +
      '<button type="button" class="btn sm' + (INST.evt ? '' : ' primary') + '" data-act="insthelp">' + (INST.help ? 'ปิด' : (INST.evt ? 'อุปกรณ์อื่น' : 'วิธีติดตั้ง')) + '</button></div>' +
    (INST.help ? '<div class="inst-panel"><div class="seg" role="tablist"><button data-insttab="mobile" aria-pressed="' + (tab === 'mobile') + '">📱 มือถือ</button><button data-insttab="desktop" aria-pressed="' + (tab === 'desktop') + '">💻 คอมพิวเตอร์</button></div>' +
      (tab === 'mobile' ? mobile : desktop) +
      '<div class="inst-link"><span class="mono">' + esc(appUrl().replace(/^https?:\/\//, '')) + '</span><button type="button" class="btn sm" data-act="copyapp">คัดลอกลิงก์</button></div></div>' : '') +
  '</div>';
}

/* ============ login ============ */
async function showLogin(keepErr) {
  S.screen = 'login'; S.user = null; S.me = ''; closeEditor();
  document.body.classList.add('auth'); applyTheme();
  const L = S.login; if (!keepErr) L.err = ''; L.pin = '';
  // แสดงรายชื่อที่จำไว้ทันที แล้วค่อยอัปเดตจากฐานข้อมูลเบื้องหลัง
  const cached = mode() === 'sheet' ? LS.get('roster', null) : null;
  L.roster = cached && cached.users ? cached.users : null; L.brand = cached && cached.brand || L.brand || null; L.busy = !L.roster; if (cached) L.saleOn = !!cached.sale;
  if (L.roster && L.roster.length === 1 && !L.userId) L.userId = L.roster[0].id;
  renderLogin();
  if (mode() === 'sheet') ibStart(LS.get('rtpub', null));
  try {
    const r = await api().roster(); L.roster = r.users || []; L.brand = r.brand || null; L.saleOn = !!r.sale;
    if (mode() === 'sheet') { LS.set('roster', { users: L.roster, brand: L.brand, sale: L.saleOn }); if (r.rt) ibStart(r.rt); }
    if (L.brand) { S.settings = normalizeSettings(Object.assign(S.settings || {}, L.brand)); applyBrand(); }
  }
  catch (e) { if (!L.roster) { L.err = e.message; L.showConn = mode() === 'sheet'; } }
  L.busy = false;
  if (L.roster && L.roster.length === 1) L.userId = L.roster[0].id;
  if (L.roster && !L.roster.some(u => u.id === L.userId)) L.userId = '';
  renderLogin();
}
function renderLogin() {
  const L = S.login, b = L.brand || S.settings || defaultSettings(), sel = (L.roster || []).find(u => u.id === L.userId);
  const dots = '<div class="pin-dots' + (L.shake ? ' shake' : '') + '" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map(i => '<i class="' + (i < L.pin.length ? 'on' : '') + (i === L.pin.length ? ' next' : '') + (i >= 4 ? ' opt' : '') + '"></i>').join('') + '</div>' +
    '<div class="pin-hint' + (L.err ? ' bad' : '') + '" aria-live="polite">' + (L.err ? esc(L.err) : L.pin.length === 0 ? 'แตะตัวเลขเพื่อใส่ PIN' : L.pin.length < 4 ? 'อีก ' + (4 - L.pin.length) + ' หลัก' : 'พร้อมแล้ว กดเข้าสู่ระบบ') + '</div>';
  L.shake = false;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(k => k === 'clear' ? '<button type="button" class="key fn" data-pin="clear">ล้าง</button>'
    : k === 'back' ? '<button type="button" class="key fn" data-pin="back" aria-label="ลบ">⌫</button>' : '<button type="button" class="key" data-pin="' + k + '">' + k + '</button>').join('');
  const pinForm = extra => '<form id="pinForm" class="pin-form">' + (extra || '') + '<input id="pinIn" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" value="' + esc(L.pin) + '" aria-label="PIN">' + dots +
    '<div class="keypad">' + keys + '</div><button class="btn primary login-go' + (L.submitting ? ' busy' : '') + (L.pin.length >= 4 ? ' ready' : '') + '" type="submit"' + (L.pin.length < 4 || L.submitting ? ' disabled' : '') + '>' + (L.submitting ? '<span class="spin-dot"></span>กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ') + '</button></form>';
  const c = S.conn || { url: '' };
  let body;
  if (L.busy) body = '<div class="loading" style="min-height:160px"><span class="spinner"></span>กำลังโหลด…</div>';
  else if (L.adminMode) body = '<button type="button" class="back-who" data-act="adminoff">‹ กลับ</button><h2 class="login-h">ผู้ดูแลระบบ</h2>' +
    pinForm('<div class="f"><label for="adminName">ชื่อผู้ดูแล</label><div class="name-in' + (L.adminName && L.adminName.trim() ? ' has' : '') + '"><span class="ni-ic">' + STI.user + '</span><input id="adminName" value="' + esc(L.adminName || '') + '" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="พิมพ์ชื่อ เช่น แอดมิน"><span class="ni-ok" aria-hidden="true">✓</span></div></div>');
  else if (!sel) body = '<h2 class="login-h">เข้าสู่ระบบ</h2><p class="sub">เลือกชื่อของคุณ</p>' +
    ((L.roster || []).length ? '<div class="who-grid">' + L.roster.map(u => '<button type="button" class="who" data-who="' + esc(u.id) + '">' + '<span class="t-av">' + avUser(u, 'lg') + '<i class="av-role ' + ROLES[roleOf(u)].cls + '">' + ROLE_IC[roleOf(u)] + '</i></span><b>' + esc(u.name) + '</b><small>' + (ROLES[roleOf(u)].short || ROLES[roleOf(u)].label) + '</small>' + deptTag(u) + '</button>').join('') + '</div>'
      : '<div class="empty" style="padding:20px 0"><b>ยังไม่มีผู้ใช้งาน</b>ผู้ดูแลระบบเพิ่มทีมงานได้ในหน้าตั้งค่า</div>');
  else body = '<button type="button" class="back-who" data-who="">‹ เปลี่ยนชื่อ</button><div class="pin-head">' + avUser(sel, 'lg') + '<div><b>' + esc(sel.name) + '</b><small>ใส่ PIN 4–6 หลัก</small></div></div>' + pinForm();

  const showConn = L.showConn;
  const hr = new Date().getHours(), greet = hr < 12 ? 'อรุณสวัสดิ์' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const hero = '<section class="lg-hero" aria-hidden="false">' +
      '<div class="lg-brand">' + brandMark(b) + '<div><b>' + esc(b.appName || 'KiwNgan คิวงาน') + '</b><small>' + esc(b.company || '') + '</small></div></div>' +
      '<div class="lg-copy"><h1>จัดคิวงานทีม<br>ให้ทุกชิ้น<span>ส่งตรงเวลา</span></h1><p>บอร์ดงาน จับเวลาทำงาน และสรุปรายงาน ครบในที่เดียว ใช้ได้ทั้งมือถือและคอมพิวเตอร์</p></div>' +
      '<div class="lg-art" aria-hidden="true">' +
        '<div class="lg-card c1"><i class="s-queue"></i><b>รอคิว</b><span></span><span class="w60"></span></div>' +
        '<div class="lg-card c2"><i class="s-doing"></i><b>กำลังทำ</b><span></span><em>00:42:18</em></div>' +
        '<div class="lg-card c3"><i class="s-done"></i><b>เสร็จแล้ว</b><span class="w70"></span><strong>✓ ตรงเวลา</strong></div>' +
        '<div class="lg-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/><circle class="on" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="86 100"/></svg><b>86%</b><small>ตรงเวลา</small></div>' +
      '</div>' +
      '<ul class="lg-feat"><li>' + I.board + 'บอร์ดงานลากวาง</li><li>' + I.play + 'จับเวลาต่อชิ้นงาน</li><li>' + I.report + 'สรุปรายงานพร้อมพิมพ์</li></ul>' +
    '</section>';
  $('#view').innerHTML = '<div class="login">' + hero + '<section class="lg-side"><div class="login-card">' +
    '<div class="lg-hello"><span class="eyebrow">' + greet + '</span><b>ยินดีต้อนรับสู่ ' + esc(b.appName || 'KiwNgan คิวงาน') + '</b></div>' +
    (mode() === 'demo' ? '<div class="banner"><span><b>โหมดทดลอง</b> ทุกคนใช้ PIN 1234 · ผู้ดูแลระบบเข้าที่ลิงก์ด้านล่าง ชื่อ "แอดมิน"</span></div>' : '') +
    body + (L.err && !(L.adminMode || sel) ? '<div class="err" role="alert">' + esc(L.err) + (L.retry && LS.get(tokenKey(), '') ? ' <button type="button" class="btn sm" data-act="retryload">ลองอีกครั้ง</button>' : '') + '</div>' : '') +
    (!L.adminMode && !sel && !L.busy ? saleTile() : '') +
    '<div class="login-foot">' +
      (showConn ? '<div class="f"><label for="cUrl">URL ฐานข้อมูล (Apps Script /exec)</label><input id="cUrl" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url" autocomplete="off"></div><div class="top-actions"><button class="btn primary sm" data-act="connect">เชื่อมต่อ</button>' + (mode() === 'sheet' ? '' + (LOCKED() ? '' : '<button class="btn sm" data-act="disconnect">ใช้โหมดทดลอง</button>') + '' : '') + '</div>'
        : '<div class="top-actions" style="justify-content:space-between">' + (!L.adminMode ? '<button type="button" class="btn ghost sm" data-act="adminon">ผู้ดูแลระบบ</button>' : '<span></span>') +
          (mode() === 'demo' ? '<button type="button" class="btn ghost sm" data-act="showconn">เชื่อมต่อ Google Sheet ของทีม</button>' : '') + '</div>') +
    '</div></div>' + installBlock() + '<p class="lg-legal">' + esc(b.company || '') + ' · KiwNgan v' + APP_VERSION + '</p></section></div>';
  const focus = L.adminMode && !L.adminName ? $('#adminName') : $('#pinIn');
  if (focus && (!('ontouchstart' in window) || focus.id === 'adminName')) focus.focus();
}
// keypad: update in place (no full redraw) so it feels instant and the name field keeps its text
function pressKey(k, btn) {
  const L = S.login, an = $('#adminName'); if (an) L.adminName = an.value;
  const before = L.pin.length;
  if (k === 'clear') L.pin = ''; else if (k === 'back') L.pin = L.pin.slice(0, -1); else if (L.pin.length < 6) L.pin += k;
  try { if (navigator.vibrate) navigator.vibrate(k === 'clear' || k === 'back' ? 6 : 12); } catch (e) {}
  if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
  if (L.err) { L.err = ''; const er = $('.login .err'); if (er) er.remove(); const h = $('.pin-hint'); if (h) h.classList.remove('bad'); }
  syncPin(L.pin.length > before);
}
function syncPin(added) {
  const L = S.login, n = L.pin.length;
  document.querySelectorAll('.pin-dots i').forEach((el, i) => {
    el.classList.toggle('on', i < n); el.classList.toggle('next', i === n && n < 6); el.classList.remove('just');
    if (added && i === n - 1) { void el.offsetWidth; el.classList.add('just'); }
  });
  const pi = $('#pinIn'); if (pi && pi.value !== L.pin) pi.value = L.pin;
  const sb = $('#pinForm [type=submit]'); if (sb) { sb.disabled = n < 4; sb.classList.toggle('ready', n >= 4); }
  const hint = $('.pin-hint'); if (hint) hint.textContent = n === 0 ? 'แตะตัวเลขเพื่อใส่ PIN' : n < 4 ? 'อีก ' + (4 - n) + ' หลัก' : 'พร้อมแล้ว กดเข้าสู่ระบบ';
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
    S.loaded = false; await load(false, r.boot || null);
    if (S.user) toast('สวัสดี ' + S.user.name);
  } catch (e) { L.submitting = false; L.err = e.message; L.pin = ''; L.shake = true; try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch (x) {} renderLogin(); }
}
async function logout() {
  try { await api().logout({}); } catch (e) {}
  stopMsgPolling(); rtStop(); pushMetaClear(); LS.del(tokenKey()); S.jobs = []; S.logs = []; S.users = []; S.login.userId = ''; S.login.adminMode = false; showLogin();
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
  upsert(S.jobs, r.job); render();
  if (r.job.status === 'done' && toProdType(r.job.taskType) && !((p => p && p.stage !== 'shipped')(prodOfCode(r.job.code)))) { toast(r.job.code + ' ออกแบบเสร็จ → ส่งเข้า "รอผลิต" แล้ว'); setTimeout(() => load(true), 300); }   // หลังบ้านสร้างงานรอผลิตให้แล้ว ดึงมาแสดง
  return r.job;
}

/* ============ งานต่อ CAM ============
   ทุกงานจบที่ CAM: งานเขียนแบบ (CAD/แบบผลิต/…) เสร็จ → ถามว่าจะเปิดงาน CAM ต่อไหม แล้วสร้างให้ในคลิกเดียว */
const camType = () => (S.settings.taskTypes || []).find(t => t.cat === 'cam');
function camFollowNeeded(j) {
  return !!j && !isCam(j) && !!camType() && j.status === 'done' && !S.jobs.some(x => x.id !== j.id && String(x.code).toLowerCase() === String(j.code).toLowerCase() && isCam(x));
}
function offerCam(j) {
  if (!camFollowNeeded(j)) return;
  let box = $('#askBox'); if (!box) { box = document.createElement('div'); box.id = 'askBox'; box.className = 'ask-wrap'; document.body.appendChild(box); }
  const imgs = imgsOf(j.id).length;
  box.innerHTML = '<div class="ask" role="dialog" aria-label="สร้างงาน CAM ต่อ"><span class="ask-ic">' + STI.done + '</span><div class="ask-b"><b>' + esc(j.code) + ' เสร็จแล้ว — เปิดงาน CAM ต่อเลยไหม?</b>' +
    '<small>' + esc([j.title, groupShort(j.group)].filter(Boolean).join(' · ')) + (imgs ? ' · ใช้รูปเดิม ' + imgs + ' รูป' : '') + '</small>' +
    '<div class="ask-act"><button class="btn sm primary" data-camyes="' + esc(j.id) + '">' + I.plus + 'สร้างงาน ' + esc(camType().name) + '</button><button class="btn sm" data-camno="1">ไม่ต้อง</button></div></div></div>';
  box.classList.add('show'); ping(false);
  clearTimeout(offerCam.t); offerCam.t = setTimeout(() => box.classList.remove('show'), 20000);
}
async function createCamFrom(id) {
  const src = jobById(id); const box = $('#askBox'); if (box) box.classList.remove('show');
  if (!src || !camFollowNeeded(src)) return toast('มีงาน CAM ของเลขนี้แล้ว', true);
  const t = camType(), job = { code: src.code, title: src.title, group: src.group, taskType: t.name, qty: src.qty, level: src.level, sale: src.sale, priority: src.priority, revision: false,
    assignee: isAdmin() ? (src.assignee || S.me) : S.me, status: 'queue', received: today(), due: '', startedAt: '', finishedAt: '', note: '' };
  const sg = suggestDue(job); if (sg) job.due = sg.date;
  const tmpId = uid('tmp_'); S.jobs.push(Object.assign({}, job, { id: tmpId, minutes: 0, pending: true, createdBy: S.me })); render();
  S.saving = (S.saving || 0) + 1;
  try {
    const r = await mutate(() => api().saveJob({ job: job }), 'สร้างงาน CAM ' + src.code + ' แล้ว');
    S.jobs = S.jobs.filter(x => x.id !== tmpId); upsert(S.jobs, r.job); render();
    if (imgsOf(src.id).length) { try { const c = await api().copyImages({ from: src.id, to: r.job.id }); S.images = (S.images || []).concat(c.images || []); render(); } catch (e) {} }
  } catch (e) { S.jobs = S.jobs.filter(x => x.id !== tmpId); render(); }
  S.saving--;
}
async function moveJob(id, status) {
  const j = jobById(id); if (!j) return;
  if (isCam(j) && status === 'review') status = 'done';   // งาน CAM ข้ามขั้นรอตรวจ
  if (j.status === status) return;
  if (!canEdit(j)) { toast('เปลี่ยนสถานะได้เฉพาะงานของตัวเอง งานนี้เป็นของ ' + (j.assignee || 'คนอื่น'), true); return; }
  const prev = clone(j);
  S.saving = (S.saving || 0) + 1;
  j.status = status;
  if (status === 'done') j.finishedAt = nowLocal(); else j.finishedAt = '';
  if (WORKING(status) && !j.startedAt) j.startedAt = nowLocal();
  render();
  try {
    const run = runningOf(id);
    if (status === 'done' && run) applyStop(await api().stopTimer({ logId: run.id }));
    const p = { id: j.id, code: j.code, status: status, finishedAt: j.finishedAt, startedAt: j.startedAt, baseUpdatedAt: prev.updatedAt };
    await saveJob(p, j.code + ' → ' + ST[status].label);
    if (status === 'done') offerCam(jobById(id));
  } catch (e) { upsert(S.jobs, prev); render(); }
  S.saving--;
}

/* จับเวลา: กดแล้วเริ่ม/หยุดบนจอทันที แล้วบันทึกเบื้องหลัง · จับได้หลายงานพร้อมกัน (แยกเวลาของแต่ละ job) */
const PENDING_START = {};
const myRunOn = jobId => S.logs.find(l => !l.end && l.jobId === jobId && l.member === S.me);
function timerRefresh() { render(); if (S.edit) rerenderEditor(); }
function startTimer(jobId) {
  const j = jobById(jobId); if (!j || myRunOn(jobId)) return;
  const tmp = { id: uid('tmp_'), jobId: jobId, member: S.me, start: nowLocal(), end: '', minutes: 0 };
  const prevJ = clone(j);
  S.logs.push(tmp);
  if (j.status === 'queue' || j.status === 'hold') { j.status = 'doing'; if (!j.startedAt) j.startedAt = tmp.start; }
  S.saving = (S.saving || 0) + 1; toast('เริ่มจับเวลา ' + j.code); timerRefresh();
  PENDING_START[tmp.id] = (async () => {
    let realId = null;
    try {
      const r = await mutate(() => api().startTimer({ jobId: jobId, member: S.me }));
      const done = S.logs.find(l => l.id === tmp.id);
      S.logs = S.logs.filter(l => l.id !== tmp.id);
      upsert(S.logs, done && done.end ? Object.assign({}, r.log, { end: done.end, minutes: done.minutes }) : r.log);
      if (r.job) { const keepMin = jobById(jobId) ? jobById(jobId).minutes : r.job.minutes; upsert(S.jobs, Object.assign({}, r.job, { minutes: keepMin })); }
      realId = r.log.id;
    } catch (e) { S.logs = S.logs.filter(l => l.id !== tmp.id); upsert(S.jobs, prevJ); }
    delete PENDING_START[tmp.id]; S.saving--; timerRefresh();
    return realId;
  })();
}
async function stopTimer(logId) {
  const l = S.logs.find(x => x.id === logId); if (!l || l.end) return;
  const prev = clone(l), j = jobById(l.jobId), prevMin = j ? j.minutes : 0;
  l.end = nowLocal(); l.minutes = Math.max(0, Math.round((parseLocal(l.end) - parseLocal(l.start)) / 60000));
  if (j) j.minutes = (j.minutes || 0) + l.minutes;
  S.saving = (S.saving || 0) + 1; toast('หยุดจับเวลา ' + (j ? j.code + ' · ' : '') + fdur(l.minutes)); timerRefresh();
  try {
    let id = logId;
    if (PENDING_START[logId]) { id = await PENDING_START[logId]; if (!id) { S.saving--; return timerRefresh(); } }
    applyStop(await mutate(() => api().stopTimer({ logId: id })));
  } catch (e) { const cur = S.logs.find(x => x.id === logId); if (cur) Object.assign(cur, prev); if (j) j.minutes = prevMin; }
  S.saving--; timerRefresh();
}

/* ============ personal theme (per device) ============ */
const THEMES = [
  { id: 'brand', name: 'สีบริษัท', c1: '', c2: '' },
  { id: 'ocean', name: 'ทะเลลึก', c1: '#0B6B70', c2: '#2D5FC4' },
  { id: 'sky', name: 'ฟ้าใส', c1: '#1C7ED6', c2: '#15AABF' },
  { id: 'grape', name: 'องุ่น', c1: '#6741D9', c2: '#C2255C' },
  { id: 'sunset', name: 'พระอาทิตย์ตก', c1: '#E8590C', c2: '#D6336C' },
  { id: 'forest', name: 'ป่าเขียว', c1: '#2B8A3E', c2: '#0C8599' },
  { id: 'gold', name: 'ทองอำพัน', c1: '#C2410C', c2: '#B7791F' },
  { id: 'rose', name: 'ชมพูพาสเทล', c1: '#D6336C', c2: '#9C36B5' },
  { id: 'night', name: 'กลางคืน', c1: '#364FC7', c2: '#1098AD', mode: 'dark' },
  { id: 'classic', name: 'เรียบคลาสสิก', c1: '', c2: '', sidebar: 'plain', header: 'plain' }
];
const THEME_DEFAULT = { bgdim: 'mid', bgblur: '0', preset: 'brand', mode: 'auto', c1: '#0B6B70', c2: '#5B3FD6', sidebar: 'gradient', header: 'gradient', radius: 'round' };
const BGIMG = () => { try { return localStorage.getItem('kiwngan:bgimg') || ''; } catch (e) { return ''; } };
const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
function getTheme() { return Object.assign({}, THEME_DEFAULT, LS.get('theme', {}) || {}); }
function setTheme(patch) { const t = Object.assign(getTheme(), patch); LS.set('theme', t); applyTheme(); return t; }
function applyTheme() {
  // the sign-in page always uses the default look; personal themes apply only inside the app
  const t = S.screen === 'app' ? getTheme() : Object.assign({}, THEME_DEFAULT, { mode: 'light' }), root = document.documentElement, s = S.settings || defaultSettings();
  const team = isHex(s.accent) ? s.accent : '#0B6B70';
  let c1 = team, c2 = '';
  if (t.preset === 'custom') { c1 = isHex(t.c1) ? t.c1 : team; c2 = isHex(t.c2) ? t.c2 : ''; }
  else { const p = THEMES.find(x => x.id === t.preset); if (p && p.c1) { c1 = p.c1; c2 = p.c2; } }
  root.style.setProperty('--brand', c1);
  if (c2) root.style.setProperty('--brand-2', c2); else root.style.removeProperty('--brand-2');
  if (t.mode === 'light' || t.mode === 'dark') root.setAttribute('data-theme', t.mode); else root.removeAttribute('data-theme');
  root.setAttribute('data-sidebar', t.sidebar === 'plain' ? 'plain' : 'gradient');
  root.setAttribute('data-header', ['soft', 'plain'].indexOf(t.header) >= 0 ? t.header : 'gradient');
  root.setAttribute('data-radius', t.radius === 'sharp' ? 'sharp' : 'round');
  const bg = S.screen === 'app' ? BGIMG() : '';
  if (bg) { root.style.setProperty('--bgimg', 'url(' + bg + ')'); root.setAttribute('data-bg', t.bgdim || 'mid'); root.setAttribute('data-bgblur', t.bgblur || '0'); }
  else { root.style.removeProperty('--bgimg'); root.removeAttribute('data-bg'); root.removeAttribute('data-bgblur'); }
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', c1);
}
function themeSection() {
  const t = getTheme(), s = S.settings || defaultSettings(), team = isHex(s.accent) ? s.accent : '#0B6B70';
  const sw = p => {
    const c1 = p.c1 || team, c2 = p.c2 || 'color-mix(in oklab,' + team + ' 50%,#5B3FD6)';
    return '<button class="theme-sw' + (t.preset === p.id ? ' on' : '') + '" data-themepick="' + p.id + '" aria-pressed="' + (t.preset === p.id) + '" style="--t1:' + c1 + ';--t2:' + c2 + '">' +
      '<span class="tp-prev' + (p.id === 'classic' ? ' classic' : '') + (p.mode === 'dark' ? ' dark' : '') + '"><i class="tp-rail"></i><i class="tp-head"></i><i class="tp-a"></i><i class="tp-b"></i></span><b>' + p.name + '</b></button>';
  };
  const seg = (key, opts) => '<div class="seg" role="group">' + opts.map(o => '<button data-themeset="' + key + '" data-val="' + o[0] + '" aria-pressed="' + (t[key] === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
  const c1 = t.preset === 'custom' && isHex(t.c1) ? t.c1 : (THEMES.find(x => x.id === t.preset) || {}).c1 || team;
  const c2 = t.preset === 'custom' && isHex(t.c2) ? t.c2 : (THEMES.find(x => x.id === t.preset) || {}).c2 || '#5B3FD6';
  return '<section class="panel sec" id="s-theme"><div class="panel-h"><h2>ธีมและโหมดสี</h2><button class="btn sm ghost" data-act="themereset">คืนค่าเริ่มต้น</button></div>' +
    '<p class="help">ปรับหน้าตาแอปตามชอบ ใช้เฉพาะเครื่องนี้ ไม่กระทบคนอื่นในทีม</p>' +
    '<div class="sub" style="font-weight:600;color:var(--ink)">เทมเพลตสี</div><div class="theme-grid">' + THEMES.map(sw).join('') +
      '<label class="theme-sw custom' + (t.preset === 'custom' ? ' on' : '') + '" style="--t1:' + esc(c1) + ';--t2:' + esc(c2) + '"><span class="tp-prev"><i class="tp-rail"></i><i class="tp-head"></i><i class="tp-a"></i><i class="tp-b"></i></span><b>กำหนดเอง</b></label></div>' +
    '<div class="theme-opts">' +
      '<div class="f"><span class="lbl">สีหลัก / สีรอง (กำหนดเอง)</span><div class="theme-colors"><input type="color" id="thC1" value="' + esc(c1) + '" aria-label="สีหลัก"><span>→</span><input type="color" id="thC2" value="' + esc(c2) + '" aria-label="สีรอง"></div></div>' +
      '<div class="f"><span class="lbl">โหมด</span>' + seg('mode', [['auto', 'ตามเครื่อง'], ['light', 'สว่าง'], ['dark', 'มืด']]) + '</div>' +
      '<div class="f"><span class="lbl">เมนูด้านข้าง</span>' + seg('sidebar', [['gradient', 'สีไล่'], ['plain', 'พื้นเรียบ']]) + '</div>' +
      '<div class="f"><span class="lbl">หัวหน้าเพจ</span>' + seg('header', [['gradient', 'สีไล่'], ['soft', 'สีอ่อน'], ['plain', 'เรียบ']]) + '</div>' +
      '<div class="f"><span class="lbl">มุมการ์ด</span>' + seg('radius', [['round', 'โค้งมน'], ['sharp', 'เหลี่ยม']]) + '</div>' +
    '</div>' +
    '<div class="bg-pick"><div class="bg-prev' + (BGIMG() ? ' has' : '') + '"' + (BGIMG() ? ' style="background-image:url(' + BGIMG() + ')"' : '') + '>' + (BGIMG() ? '' : '<span>' + STI.camera + 'ยังไม่มีรูป</span>') + '</div>' +
      '<div class="bg-ctl"><b>รูปพื้นหลัง</b><small>ใช้รูปของคุณเป็นพื้นหลังแอป (เฉพาะเครื่องนี้)</small>' +
      '<div class="top-actions"><label class="btn sm primary">' + STI.camera + (BGIMG() ? 'เปลี่ยนรูป' : 'เลือกรูป') + '<input type="file" accept="image/*" id="bgIn" hidden></label>' + (BGIMG() ? '<button class="btn sm" data-act="bgremove">' + I.trash + 'เอาออก</button>' : '') + '</div>' +
      (BGIMG() ? '<div class="f"><span class="lbl">ความเข้มของรูป</span>' + seg('bgdim', [['soft', 'จาง'], ['mid', 'ปานกลาง'], ['strong', 'ชัด']]) + '</div><div class="f"><span class="lbl">เบลอ</span>' + seg('bgblur', [['0', 'ไม่เบลอ'], ['1', 'เบลอเล็กน้อย'], ['2', 'เบลอมาก']]) + '</div>' : '') +
    '</div></div></section>';
}

/* ============ job images ============ */
const IMG_MAX = 8;
const imgsOf = jobId => (S.images || []).filter(m => m.jobId === jobId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
const THUMBS = (() => { try { return JSON.parse(sessionStorage.getItem('kiwngan:thumbs') || '{}'); } catch (e) { return {}; } })();
const FULL = {};
let thumbQ = [], thumbT = null;
function saveThumbCache() { try { sessionStorage.setItem('kiwngan:thumbs', JSON.stringify(THUMBS)); } catch (e) { /* full: keep in memory only */ } }
function paintThumb(id) { document.querySelectorAll('img[data-thumb="' + id + '"]').forEach(el => { if (THUMBS[id]) { el.src = THUMBS[id]; el.classList.add('ok'); } }); }
function wantThumbs(ids) {
  ids.forEach(id => { if (THUMBS[id]) paintThumb(id); else if (thumbQ.indexOf(id) < 0) thumbQ.push(id); });
  if (!thumbQ.length || thumbT) return;
  thumbT = setTimeout(async () => {
    const batch = thumbQ.splice(0, 40); thumbT = null;
    try { const r = await api().thumbs({ ids: batch }); Object.assign(THUMBS, r.thumbs || {}); saveThumbCache(); batch.forEach(paintThumb); } catch (e) { batch.forEach(id => document.querySelectorAll('img[data-thumb="' + id + '"]').forEach(el => el.classList.add('fail'))); }
    if (thumbQ.length) wantThumbs([]);
  }, 60);
}
function paintAllThumbs(root) { const ids = []; (root || document).querySelectorAll('img[data-thumb]').forEach(el => { const id = el.dataset.thumb; if (ids.indexOf(id) < 0) ids.push(id); }); if (ids.length) wantThumbs(ids); }
/* รูปที่เก็บใน Google Drive โหลดจาก Google โดยตรง (เร็ว ไม่ผ่าน Apps Script) */
const driveImg = (id, w) => 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 400);
const thumbImg = (m, cls) => m.fileId ? '<img class="th ok ' + (cls || '') + '" alt="" loading="lazy" referrerpolicy="no-referrer" src="' + (THUMBS[m.id] || driveImg(m.fileId, cls === 'big' ? 800 : 400)) + '" onerror="if(!this.dataset.r){this.dataset.r=1;this.src=\'https://lh3.googleusercontent.com/d/' + esc(m.fileId) + '=w' + (cls === 'big' ? 800 : 400) + '\'}">' : '<img class="th ' + (cls || '') + '" data-thumb="' + esc(m.id) + '" alt="" src="' + (THUMBS[m.id] || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=') + '"' + (THUMBS[m.id] ? '' : ' loading="lazy"') + '>';
function canAddImg(j) { return !!j && canEdit(j); }
function canDelImg(m, j) { return isAdmin() || m.createdBy === S.me || (j && canEdit(j)); }

// resize to a JPEG data URL no longer than maxLen characters
function shrinkImage(file, maxSide, maxLen, q0) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('เลือกไฟล์รูปภาพ (JPG, PNG)'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let side = maxSide, q = q0 || 0.85, out = '';
      for (let i = 0; i < 9; i++) {
        const k = Math.min(1, side / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length <= maxLen) break;
        if (q > 0.6) q -= 0.1; else side = Math.round(side * 0.8);
      }
      URL.revokeObjectURL(url);
      out.length <= maxLen ? resolve(out) : reject(new Error('รูปใหญ่เกินไป'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
    img.src = url;
  });
}
function rerenderEditor() { if (!S.edit) return; if (S.edit.mode === 'edit' && document.querySelector('#sheetBody [data-e]')) readEditor(); renderEditor(); }
async function uploadImages(jobId, files) {
  const j = jobById(jobId); if (!canAddImg(j)) return toast('เพิ่มรูปได้เฉพาะงานของตัวเอง', true);
  const room = IMG_MAX - imgsOf(jobId).length;
  files = Array.from(files || []).slice(0, Math.max(0, room));
  if (!files.length) return toast('ใส่รูปได้สูงสุด ' + IMG_MAX + ' รูปต่องาน', true);
  S.uploading = (S.uploading || 0) + files.length; rerenderEditor();
  let ok = 0;
  for (const f of files) {
    try {
      const thumb = await shrinkImage(f, 360, 44000, 0.72);
      const full = await shrinkImage(f, 1800, 340000, 0.85);
      const r = await api().addImage({ jobId: jobId, thumb: thumb, full: full });
      THUMBS[r.image.id] = thumb; FULL[r.image.id] = full; saveThumbCache();
      S.images = (S.images || []).concat([{ id: r.image.id, jobId: jobId, createdBy: r.image.createdBy, createdAt: r.image.createdAt, fileId: r.image.fileId || '' }]); ok++;
    } catch (e) { toast(e.message || 'อัปโหลดรูปไม่สำเร็จ', true); }
    S.uploading--; rerenderEditor(); render();
  }
  if (ok) toast('เพิ่มรูปแล้ว ' + ok + ' รูป');
}
async function deleteImage(id) {
  try { await mutate(() => api().deleteImage({ id: id }), 'ลบรูปแล้ว'); S.images = (S.images || []).filter(m => m.id !== id); delete THUMBS[id]; saveThumbCache(); closeLightbox(); rerenderEditor(); render(); } catch (e) {}
}
// full-screen viewer
function openLightbox(jobId, id) {
  hideHover();
  const list = imgsOf(jobId); let i = Math.max(0, list.findIndex(m => m.id === id));
  S.lb = { jobId: jobId, i: i }; drawLightbox();
}
async function drawLightbox() {
  const L = S.lb; if (!L) return;
  const list = imgsOf(L.jobId); if (!list.length) return closeLightbox();
  L.i = (L.i + list.length) % list.length;
  const m = list[L.i], j = jobById(L.jobId);
  let box = $('#lightbox'); if (!box) { box = document.createElement('div'); box.id = 'lightbox'; box.className = 'lightbox'; document.body.appendChild(box); }
  box.innerHTML = '<div class="lb-top"><span class="lb-t"><b class="mono">' + esc(j ? j.code : ((typeof prodById === 'function' && prodById(L.jobId)) || {}).code || '') + '</b> · รูป ' + (L.i + 1) + '/' + list.length + '<small>' + esc(m.createdBy || '') + ' · ' + esc(fdt(String(m.createdAt).slice(0, 16))) + '</small></span>' +
    (canDelImg(m, j) ? '<button class="lb-btn" data-lbdel="' + esc(m.id) + '" title="ลบรูป">' + I.trash + '</button>' : '') + '<button class="lb-btn" data-lb="close" aria-label="ปิด">✕</button></div>' +
    '<div class="lb-stage">' + (list.length > 1 ? '<button class="lb-nav prev" data-lb="prev" aria-label="ก่อนหน้า">‹</button>' : '') +
    (m.fileId ? '<img id="lbImg" alt="" referrerpolicy="no-referrer" src="' + driveImg(m.fileId, 2000) + '" class="ok">' :
    '<img id="lbImg" alt="" src="' + (FULL[m.id] || THUMBS[m.id] || '') + '" class="' + (FULL[m.id] ? 'ok' : 'blur') + '">' + (FULL[m.id] ? '' : '<span class="lb-load"><span class="spin-dot"></span></span>')) +
    (list.length > 1 ? '<button class="lb-nav next" data-lb="next" aria-label="ถัดไป">›</button>' : '') + '</div>' +
    '<div class="lb-strip">' + list.map((x, k) => '<button data-lbgo="' + k + '" class="' + (k === L.i ? 'on' : '') + '">' + thumbImg(x) + '</button>').join('') + '</div>';
  box.classList.add('open'); paintAllThumbs(box);
  if (!FULL[m.id] && !m.fileId) {
    try { const r = await api().image({ id: m.id }); FULL[m.id] = r.full; if (S.lb && imgsOf(S.lb.jobId)[S.lb.i] && imgsOf(S.lb.jobId)[S.lb.i].id === m.id) drawLightbox(); } catch (e) { toast(e.message, true); }
  }
}
function closeLightbox() { S.lb = null; const b = $('#lightbox'); if (b) b.classList.remove('open'); }

/* ============ hover preview (mouse only) ============ */
let hovT = null, hovId = null, hovEl = null;
function jobInfoHtml(j, compact) {
  const di = dueInfo(j), run = runningOf(j.id), mins = totalMinutes(j), st = isLate(j) ? 'late' : j.status;
  const imgs = imgsOf(j.id);
  const hero = imgs.length ? '<div class="hv-hero"><button type="button" class="hv-main" data-lbopen="' + esc(imgs[0].id) + '" data-lbjob="' + esc(j.id) + '" title="กดดูรูปเต็มจอ">' + thumbImg(imgs[0], 'big') + '<span class="hv-zoom">' + I.search + 'กดดูรูป</span>' + (imgs.length > 1 ? '<span class="hv-cnt">' + STI.camera + imgs.length + '</span>' : '') + '</button>' +
    (imgs.length > 1 ? '<div class="hv-strip">' + imgs.slice(1, 6).map(m => '<button type="button" data-lbopen="' + esc(m.id) + '" data-lbjob="' + esc(j.id) + '">' + thumbImg(m) + '</button>').join('') + (imgs.length > 6 ? '<span class="more">+' + (imgs.length - 6) + '</span>' : '') + '</div>' : '') + '</div>' : '';
  return hero + '<div class="hv-head">' + stBadge(j, 'lg') + '<div><b class="mono">' + esc(j.code) + '</b><small>' + esc(j.title || '–') + '</small></div></div>' +
    '<div class="hv-grid">' +
      '<span>สถานะ</span><b>' + stPill(j) + '</b>' +
      '<span>ผู้รับผิดชอบ</span><b class="hv-who">' + av(j.assignee) + esc(j.assignee || 'ยังไม่มอบหมาย') + '</b>' +
      (helpersOf(j).length ? '<span>ผู้ร่วมทำงาน</span><b class="hv-who hv-helpers">' + helpersOf(j).map(n => '<span>' + av(n) + esc(n) + '</span>').join('') + '</b>' : '') +
      '<span>กลุ่ม / งาน</span><b class="hv-chips">' + (typeChip(j.taskType) + groupChip(j.group) || '–') + '</b>' +
      '<span>กำหนดส่ง</span><b class="' + (di.cls === 'late' ? 'bad' : '') + '">' + esc(di.text) + (j.due && j.status !== 'done' ? ' · ' + fdY(j.due) : '') + '</b>' +
      '<span>เวลาทำงาน</span><b>' + (run ? '<span class="live" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : (mins ? fdur(mins) : '–')) + '</b>' +
      (j.sale ? '<span>Sale</span><b>' + esc(j.sale) + '</b>' : '') +
      '<span>หมายเหตุ</span><b class="hv-notec' + (j.note ? '' : ' none') + '">' + (j.note ? esc(j.note).replace(/\n/g, '<br>') : '–') + '</b>' +
    '</div>' +
    (imgs.length ? '' : '<div class="hv-noimg">' + DECO.palette.replace('palette', '') + 'ยังไม่มีรูปงาน</div>');
}
function showHover(el) {
  if (el.dataset.shov) return showSaleHover(el);
  if (el.dataset.phov || el.dataset.popen) return showProdHover(el);
  const j = jobById(el.dataset.open || el.dataset.hov); if (!j) return;
  let h = $('#hovercard'); if (!h) { h = document.createElement('div'); h.id = 'hovercard'; h.className = 'hovercard'; h.setAttribute('role', 'tooltip'); document.body.appendChild(h); }
  const side = hvSide(j);
  h.className = 'hovercard ' + (ST[isLate(j) ? 'late' : j.status] ? 's-' + (isLate(j) ? 'late' : j.status) : '') + (imgsOf(j.id).length ? ' has-img' : '') + (side ? ' wide' : '');
  h.innerHTML = side ? '<div class="hv-col">' + jobInfoHtml(j, false) + '</div>' + side : jobInfoHtml(j, false);
  hvLoadCmts(j.id);
  if (!h.dataset.wired) { h.dataset.wired = '1'; h.addEventListener('mouseenter', () => { clearTimeout(hovT); hovT = null; }); h.addEventListener('mouseleave', e => { if (!(hovEl && e.relatedTarget && hovEl.contains(e.relatedTarget))) hideHoverSoon(); }); }
  const r = (el.classList.contains('grow') ? el.querySelector('.glab') || el : el).getBoundingClientRect(), W = h.offsetWidth || 340, vw = window.innerWidth, vh = window.innerHeight;
  let x = r.right + 12; if (x + W > vw - 8) x = Math.max(8, r.left - W - 12);
  h.style.left = x + 'px'; h.style.top = '0px'; h.classList.add('show');
  const hh = h.offsetHeight; let y = r.top + r.height / 2 - hh / 2; y = Math.max(8, Math.min(vh - hh - 8, y));
  h.style.top = y + 'px'; hovId = j.id; hovEl = el; paintAllThumbs(h);
}
/* การ์ดลอย: เช็กลิสต์ + คอมเมนต์ล่าสุด (ด้านขวา) — คอมเมนต์ดึงตอนชี้ แล้วจำไว้ 1 นาที */
const HCMT = {};
function hvSide(j) {
  const cl = clOf(j), nC = ((S.cmtCount || {})[j.id] || 0) || (HCMT[j.id] ? HCMT[j.id].list.length : 0), pd = typeof prodOfCode === 'function' && S.prods && S.prods.length ? prodOfCode(j.code) : null;
  if (!cl.length && !nC && !pd) return '';
  let h = '<div class="hv-side">';
  if (pd) {   // งานนี้อยู่ในฝ่ายผลิตแล้ว: ขั้นปัจจุบัน + เครื่อง
    const ci = PORDER.indexOf(pd.stage), ms = pms(pd);
    h += '<section class="hv-sec hv-pd ' + PSTG[pd.stage].cls + '"><div class="hv-sh"><b>' + PIC.machine + 'ฝ่ายผลิต</b>' + pPill(pd.stage) + '</div>' +
      '<div class="hv-steps">' + PORDER.map((st, k) => '<i class="' + PSTG[st].cls + (k < ci ? ' past' : k === ci ? ' now' : '') + (pSkipped(pd, st) ? ' skip' : '') + '" title="' + PSTG[st].label + '">' + (k === ci ? PIC[st] : '') + '</i>').join('') + '</div>' +
      (ms.length ? '<div class="hv-ms">' + ms.map(m => '<span class="' + (m.d ? 'on' : '') + '">' + (m.d ? '✓ ' : '') + esc(m.m) + '</span>').join('') + '</div>' : '') +
      '<small class="hv-age">' + (pd.stage === 'shipped' ? 'ส่งแล้ว ' + esc(fd(pd.shippedAt)) : 'อยู่ขั้นนี้ ' + pAgeTxt(pAge(pd))) + (pd.note ? ' · ' + esc(pd.note) : '') + '</small></section>';
  }
  if (cl.length) {
    const n = cl.filter(x => x.d).length, pct = Math.round(n / cl.length * 100), MAX = 7;
    h += '<section class="hv-sec hv-cl' + (n === cl.length ? ' all' : '') + '"><div class="hv-sh"><b>' + STI.done + 'เช็กลิสต์</b><span class="hv-n">' + n + '/' + cl.length + '</span></div>' +
      '<div class="hv-bar" title="' + pct + '%"><i style="width:' + pct + '%"></i></div><ul>' +
      cl.slice(0, MAX).map(x => '<li class="' + (x.d ? 'on' : '') + '"><span class="hv-ck">' + (x.d ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</span><span class="t">' + esc(x.t) + '</span>' +
        (x.d && x.by ? '<small title="' + esc(x.by + (x.at ? ' · ' + fdt(x.at) : '')) + '">' + av(x.by, 'xs') + '</small>' : '') + '</li>').join('') +
      (cl.length > MAX ? '<li class="more">+ อีก ' + (cl.length - MAX) + ' ขั้น</li>' : '') + '</ul></section>';
  }
  if (nC) {
    const c = HCMT[j.id], list = c ? c.list.slice(-3).reverse() : null;
    h += '<section class="hv-sec hv-cm"><div class="hv-sh"><b>' + MSG_IC.chat + 'คอมเมนต์</b><span class="hv-n">' + nC + '</span></div>' +
      (!list ? '<div class="hv-sk"><i></i><i></i></div>' : list.map(m => '<div class="hv-c' + (m.from === S.me ? ' me' : '') + '">' + av(m.from, 'sm') + '<div class="hv-cb"><span><b>' + esc(m.from) + '</b><small>' + esc(fdt(String(m.ts).slice(0, 16))) + '</small></span><p>' + esc(m.text) + '</p></div></div>').join('')) +
      (nC > 3 ? '<div class="hv-more">ดูอีก ' + (nC - 3) + ' ข้อความ — กดเปิดงาน</div>' : '') + '</section>';
  }
  return h + '</div>';
}
function hvLoadCmts(id) {
  const n = (S.cmtCount || {})[id] || 0, c = HCMT[id];
  if (!n || (c && Date.now() - c.at < 60000 && c.list.length === n)) return;
  api().comments({ jobId: id }).then(r => {
    HCMT[id] = { at: Date.now(), list: r.comments || [] };
    const h = $('#hovercard'), j = jobById(id);
    if (h && hovId === id && j) { const sd = h.querySelector('.hv-side'), nh = hvSide(j); if (sd && nh) { sd.outerHTML = nh; if (hovEl) { const r = hovEl.getBoundingClientRect(), hh = h.offsetHeight, vh = window.innerHeight; h.style.top = Math.max(8, Math.min(vh - hh - 8, r.top + r.height / 2 - hh / 2)) + 'px'; } } }
  }).catch(() => {});
}
/* หน้า Sale: การ์ดลอยรายละเอียดงานจากข้อมูลที่ Sale เห็น (รูปงาน สถานะ คนทำ กลุ่มงาน กำหนดส่ง เช็กลิสต์ ฝ่ายผลิต) */
const saleImgSrc = (x, w) => /^data:/.test(x) ? x : driveImg(x, w || 800);
function saleImgList(r) { const out = []; (r.prod ? [r.prod] : []).concat(r.jobs).forEach(j => (j.imgs || []).forEach(x => { if (out.indexOf(x) < 0) out.push(x); })); return out; }
function saleImgs(r) {
  const im = saleImgList(r); if (!im.length) return '';
  return '<div class="sf-imgs">' + im.slice(0, 8).map(x => '<a href="' + esc(saleImgSrc(x, 2000)) + '" target="_blank" rel="noopener"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(saleImgSrc(x, 400)) + '"></a>').join('') + '</div>';
}
function saleHoverHtml(r) {
  const ord = ['doing', 'fix', 'review', 'queue', 'hold'], open = r.jobs.filter(j => j.status !== 'done');
  const j = open.slice().sort((a, b) => ord.indexOf(a.status) - ord.indexOf(b.status))[0] || r.jobs.slice().sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))[0] || {};
  const im = saleImgList(r), tc = n => n ? '<span class="tchip" style="--c:' + typeColorPub(n) + '">' + esc(n) + '</span>' : '';
  const hero = im.length ? '<div class="hv-hero"><a class="hv-main" href="' + esc(saleImgSrc(im[0], 2000)) + '" target="_blank" rel="noopener" title="กดดูรูปเต็ม"><img class="th ok big" alt="" referrerpolicy="no-referrer" src="' + esc(saleImgSrc(im[0], 800)) + '"><span class="hv-zoom">' + I.search + 'กดดูรูป</span>' + (im.length > 1 ? '<span class="hv-cnt">' + STI.camera + im.length + '</span>' : '') + '</a>' +
    (im.length > 1 ? '<div class="hv-strip">' + im.slice(1, 6).map(x => '<a href="' + esc(saleImgSrc(x, 2000)) + '" target="_blank" rel="noopener"><img class="th ok" alt="" referrerpolicy="no-referrer" src="' + esc(saleImgSrc(x, 300)) + '"></a>').join('') + '</div>' : '') + '</div>' : '';
  const st = r.step === 'design' ? '<span class="pill ' + (ST[j.status] || ST.queue).cls + '">' + (ST[j.status] || ST.queue).label + '</span>' + (r.late ? ' <span class="pill s-late">' + STI.fire + 'เลยกำหนด</span>' : '') :
    r.step === 'ddone' ? '<span class="pill s-done">ออกแบบเสร็จ</span>' : pPill(r.step === 'shipped' ? 'shipped' : r.step);
  const hs = String(j.helpers || '').split(',').map(x => x.trim()).filter(Boolean), po = !r.jobs.length && r.prod;   // งานที่ฝ่ายผลิตบันทึกเอง
  if (po) { j.note = r.prod.note || ''; if (r.prod.due) { j.due = r.prod.due; } }
  const dueTx = j.due && j.status !== 'done' ? (d => (d < 0 ? 'เลย ' + (-d) + ' วัน' : d === 0 ? 'ส่งวันนี้' : d === 1 ? 'ส่งพรุ่งนี้' : 'ส่ง ' + fd(j.due)) + ' · ' + fdY(j.due))(daysBetween(today(), j.due)) : j.status === 'done' ? 'เสร็จ ' + fd(String(j.finishedAt).slice(0, 10)) : '–';
  let h = hero + '<div class="hv-head"><span class="flow-ic ic-' + coIc(r) + '">' + PIC[coIc(r)] + '</span><div><b class="mono">' + esc(r.code) + '</b><small>' + esc(r.title || '–') + '</small></div></div>' +
    '<div class="hv-grid"><span>สถานะ</span><b>' + st + '</b>' +
    (po ? '<span>ที่มา</span><b><span class="co-sk">ฝ่ายผลิตบันทึกเอง</span></b>' : '<span>ผู้รับผิดชอบ</span><b class="hv-who">' + av(j.assignee) + esc(j.assignee || 'ยังไม่มอบหมาย') + '</b>') +
    (hs.length ? '<span>ผู้ร่วมทำงาน</span><b class="hv-who hv-helpers">' + hs.map(n => '<span>' + av(n) + esc(n) + '</span>').join('') + '</b>' : '') +
    '<span>กลุ่ม / งาน</span><b class="hv-chips">' + (tc(j.taskType) + (r.group ? '<span class="gchip" style="--c:#0EA5E9">' + STI.layers + esc(groupShort(r.group)) + '</span>' : '') || '–') + '</b>' +
    '<span>กำหนดส่ง</span><b class="' + (r.late ? 'bad' : '') + '">' + esc(dueTx) + '</b>' +
    (r.sale ? '<span>Sale</span><b>' + esc(r.sale) + '</b>' : '') +
    '<span>หมายเหตุ</span><b class="hv-notec' + (j.note ? '' : ' none') + '">' + (j.note ? esc(j.note).replace(/\n/g, '<br>') : '–') + '</b></div>' +
    (im.length ? '' : '<div class="hv-noimg">' + DECO.palette.replace('palette', '') + 'ยังไม่มีรูปงาน</div>');
  // ด้านขวา: ฝ่ายผลิต + เช็กลิสต์ + งานทั้งหมดของเลข Job นี้
  let side = '';
  const pd = r.prod;
  if (pd) {
    const ci = PORDER.indexOf(pd.stage), ms = Array.isArray(pd.machines) ? pd.machines.filter(x => x && x.m) : pms(pd);
    side += '<section class="hv-sec hv-pd ' + PSTG[pd.stage].cls + '"><div class="hv-sh"><b>' + PIC.machine + 'ฝ่ายผลิต</b>' + pPill(pd.stage) + '</div>' +
      '<div class="hv-steps">' + PORDER.map((x, k) => '<i class="' + PSTG[x].cls + (k < ci ? ' past' : k === ci ? ' now' : '') + (pSkipped(pd, x) ? ' skip' : '') + '" title="' + PSTG[x].label + '">' + (k === ci ? PIC[x] : '') + '</i>').join('') + '</div>' +
      (ms.length ? '<div class="hv-ms">' + ms.map(m => '<span class="' + (m.d ? 'on' : '') + '">' + (m.d ? '✓ ' : '') + esc(m.m) + '</span>').join('') + '</div>' : '') +
      '<small class="hv-age">' + (pd.shippedAt ? 'ส่งแล้ว ' + esc(fd(pd.shippedAt)) : pd.enteredAt ? 'เข้าผลิต ' + esc(fd(pd.enteredAt)) : '') + '</small></section>';
  }
  if (j.steps) { const a = String(j.steps).split('/'), pct = Math.round(+a[0] / (+a[1] || 1) * 100);
    side += '<section class="hv-sec hv-cl' + (a[0] === a[1] ? ' all' : '') + '"><div class="hv-sh"><b>' + STI.done + 'เช็กลิสต์</b><span class="hv-n">' + esc(j.steps) + '</span></div><div class="hv-bar" title="' + pct + '%"><i style="width:' + pct + '%"></i></div></section>'; }
  if (r.jobs.length > 1) side += '<section class="hv-sec hv-jobs"><div class="hv-sh"><b>' + STI.layers + 'งานของเลขนี้</b><span class="hv-n">' + r.jobs.length + '</span></div>' +
    r.jobs.map(x => '<div class="hv-jr">' + tc(x.taskType) + '<span class="pill ' + (ST[x.status] || ST.queue).cls + '">' + (ST[x.status] || ST.queue).label + '</span><span class="hv-jw">' + av(x.assignee, 'xs') + esc(x.assignee || '–') + '</span></div>').join('') + '</section>';
  return { html: side ? '<div class="hv-col">' + h + '</div><div class="hv-side">' + side + '</div>' : h, wide: !!side, img: im.length > 0, st: r.late ? 'late' : r.step === 'design' ? j.status : '' };
}
/* การ์ดลอยของงานที่ฝ่ายผลิตบันทึกเอง (ไม่มีงานฝ่ายแบบ): ข้อมูลงาน โน้ต รูป เครื่อง ประวัติ */
function prodHoverHtml(p) {
  const dj = designJobsOf(p.code), imo = imgsOf(p.id).map(m => ({ m: m, j: p.id })); dj.forEach(j => imgsOf(j.id).forEach(m => imo.push({ m: m, j: j.id })));
  const im = imo.map(x => x.m), imj = k => imo[k].j, ms = pms(p), ci = PORDER.indexOf(p.stage), h = phist(p).slice(-4).reverse();
  const dn = p.due ? daysBetween(today(), p.due) : null, late = p.due && dn < 0 && p.stage !== 'ready' && p.stage !== 'shipped';
  const hero = im.length ? '<div class="hv-hero"><button type="button" class="hv-main" data-lbopen="' + esc(im[0].id) + '" data-lbjob="' + esc(imj(0)) + '" title="กดดูรูปเต็มจอ">' + thumbImg(im[0], 'big') + '<span class="hv-zoom">' + I.search + 'กดดูรูป</span>' + (im.length > 1 ? '<span class="hv-cnt">' + STI.camera + im.length + '</span>' : '') + '</button>' +
    (im.length > 1 ? '<div class="hv-strip">' + im.slice(1, 6).map((m, k) => '<button type="button" data-lbopen="' + esc(m.id) + '" data-lbjob="' + esc(imj(k + 1)) + '">' + thumbImg(m) + '</button>').join('') + '</div>' : '') + '</div>' : '';
  const main = hero + '<div class="hv-head"><span class="flow-ic ic-' + p.stage + '">' + PIC[p.stage] + '</span><div><b class="mono">' + esc(p.code) + '</b><small>' + esc(p.title || '–') + '</small></div></div>' +
    '<div class="hv-grid"><span>สถานะ</span><b>' + pPill(p.stage) + '</b>' +
    '<span>ที่มา</span><b>' + (dj.length ? '<span class="co-sk">จากฝ่ายแบบ</span>' : '<span class="co-sk">ฝ่ายผลิตบันทึกเอง</span>') + '</b>' +
    '<span>Sale</span><b>' + esc(p.sale || '–') + '</b>' +
    '<span>กลุ่มงาน</span><b class="hv-chips">' + (p.group ? groupChip(p.group) : '–') + '</b>' +
    '<span>กำหนดส่ง</span><b class="' + (late ? 'bad' : '') + '">' + (p.due ? esc(fdY(p.due)) + (p.stage === 'shipped' ? '' : dn < 0 ? ' · เลย ' + (-dn) + ' วัน' : dn === 0 ? ' · วันนี้' : dn === 1 ? ' · พรุ่งนี้' : '') : '–') + '</b>' +
    '<span>เข้าผลิต</span><b>' + esc(fdt(p.enteredAt)) + (p.createdBy ? ' · ' + esc(p.createdBy) : '') + '</b>' +
    '<span>รายละเอียด</span><b class="hv-notec' + (p.note ? '' : ' none') + '">' + (p.note ? esc(p.note).replace(/\n/g, '<br>') : '–') + '</b></div>' +
    (im.length ? '' : '<div class="hv-noimg">' + DECO.palette.replace('palette', '') + 'ยังไม่มีรูปงาน</div>');
  const side = '<div class="hv-side"><section class="hv-sec hv-pd ' + PSTG[p.stage].cls + '"><div class="hv-sh"><b>' + PIC.machine + 'ฝ่ายผลิต</b>' + pPill(p.stage) + '</div>' +
    '<div class="hv-steps">' + PORDER.map((st, k) => '<i class="' + PSTG[st].cls + (k < ci ? ' past' : k === ci ? ' now' : '') + (pSkipped(p, st) ? ' skip' : '') + '" title="' + PSTG[st].label + '">' + (k === ci ? PIC[st] : '') + '</i>').join('') + '</div>' +
    (ms.length ? '<div class="hv-ms">' + ms.map(m => '<span class="' + (m.d ? 'on' : '') + '">' + (m.d ? '✓ ' : '') + esc(m.m) + '</span>').join('') + '</div>' : '') +
    '<small class="hv-age">อยู่ขั้นนี้ ' + pAgeTxt(pAge(p)) + (p.paint === 'no' ? ' · ไม่ทำสี' : '') + (p.assy === 'no' ? ' · ไม่ประกอบ' : '') + '</small></section>' +
    (dj.length ? '<section class="hv-sec hv-jobs"><div class="hv-sh"><b>' + STI.layers + 'งานฝ่ายแบบของเลขนี้</b><span class="hv-n">' + dj.length + '</span></div>' + dj.map(j => '<div class="hv-jr">' + typeChip(j.taskType, 'sm') + '<span class="pill ' + (ST[j.status] || ST.queue).cls + '">' + (ST[j.status] || ST.queue).label + '</span><span class="hv-jw">' + av(j.assignee, 'xs') + esc(j.assignee || '–') + (j.status === 'done' && finDate(j) ? ' · เสร็จ ' + esc(fd(finDate(j))) : '') + '</span></div>').join('') + '</section>' : '') +
    (h.length ? '<section class="hv-sec hv-jobs"><div class="hv-sh"><b>' + STI.clock + 'ความเคลื่อนไหวล่าสุด</b></div>' + h.map(e => '<div class="hv-jr"><span class="pill ' + (PSTG[e.s] ? PSTG[e.s].cls : '') + '">' + esc(PSTG[e.s] ? PSTG[e.s].label : e.s) + '</span><span class="hv-jw">' + esc(fdt(e.t)) + (e.by ? ' · ' + esc(e.by) : '') + '</span></div>').join('') + '</section>' : '') + '</div>';
  return '<div class="hv-col">' + main + '</div>' + side;
}
function showProdHover(el) {
  const p = prodById(el.dataset.phov || el.dataset.popen); if (!p) return;
  let h = $('#hovercard'); if (!h) { h = document.createElement('div'); h.id = 'hovercard'; h.className = 'hovercard'; h.setAttribute('role', 'tooltip'); document.body.appendChild(h); }
  h.className = 'hovercard wide' + (pThumb(p) ? ' has-img' : '');
  h.innerHTML = prodHoverHtml(p);
  if (!h.dataset.wired) { h.dataset.wired = '1'; h.addEventListener('mouseenter', () => { clearTimeout(hovT); hovT = null; }); h.addEventListener('mouseleave', e => { if (!(hovEl && e.relatedTarget && hovEl.contains(e.relatedTarget))) hideHoverSoon(); }); }
  const rc = el.getBoundingClientRect(), W = h.offsetWidth || 340, vw = window.innerWidth, vh = window.innerHeight;
  const side = rc.width < 480;   // การ์ดบนบอร์ดผลิต: วางข้าง ๆ การ์ดเหมือนบอร์ดงาน
  let x = side ? rc.right + 12 : rc.left + Math.min(rc.width * .3, 360); if (side && x + W > vw - 8) x = Math.max(8, rc.left - W - 12); if (x + W > vw - 8) x = Math.max(8, vw - W - 8);
  h.style.left = x + 'px'; h.style.top = '0px'; h.classList.add('show');
  const place = () => { const hh = h.offsetHeight; if (side) { h.style.top = Math.max(8, Math.min(vh - hh - 8, rc.top + rc.height / 2 - hh / 2)) + 'px'; return; } let y = rc.bottom + 8; if (y + hh > vh - 8) y = rc.top - hh - 8; if (y < 8) y = Math.max(8, Math.min(vh - hh - 8, rc.top + rc.height / 2 - hh / 2)); h.style.top = y + 'px'; };
  place(); hovId = 'prod:' + p.id; hovEl = el; paintAllThumbs(h);
  h.querySelectorAll('img').forEach(im => im.addEventListener('load', () => { if (hovEl === el) place(); }, { once: true }));
}
function showSaleHover(el) {
  const r = SF.by && SF.by[el.dataset.shov]; if (!r) return;
  let h = $('#hovercard'); if (!h) { h = document.createElement('div'); h.id = 'hovercard'; h.className = 'hovercard'; h.setAttribute('role', 'tooltip'); document.body.appendChild(h); }
  const o = saleHoverHtml(r);
  h.className = 'hovercard' + (o.st && ST[o.st] ? ' s-' + o.st : '') + (o.img ? ' has-img' : '') + (o.wide ? ' wide' : '');
  h.innerHTML = o.html;
  if (!h.dataset.wired) { h.dataset.wired = '1'; h.addEventListener('mouseenter', () => { clearTimeout(hovT); hovT = null; }); h.addEventListener('mouseleave', e => { if (!(hovEl && e.relatedTarget && hovEl.contains(e.relatedTarget))) hideHoverSoon(); }); }
  const rc = el.getBoundingClientRect(), W = h.offsetWidth || 340, vw = window.innerWidth, vh = window.innerHeight;
  let x = rc.left + Math.min(rc.width * .3, 360); if (x + W > vw - 8) x = Math.max(8, vw - W - 8);
  h.style.left = x + 'px'; h.style.top = '0px'; h.classList.add('show');
  const hh = h.offsetHeight; let y = rc.bottom + 8; if (y + hh > vh - 8) y = rc.top - hh - 8; if (y < 8) y = Math.max(8, Math.min(vh - hh - 8, rc.top + rc.height / 2 - hh / 2));
  h.style.top = y + 'px'; hovId = 'sale:' + r.code; hovEl = el;
  h.querySelectorAll('img').forEach(im => im.addEventListener('load', () => { if (hovEl === el) { const nh = h.offsetHeight; let ny = rc.bottom + 8; if (ny + nh > vh - 8) ny = rc.top - nh - 8; if (ny < 8) ny = Math.max(8, Math.min(vh - nh - 8, rc.top + rc.height / 2 - nh / 2)); h.style.top = ny + 'px'; } }, { once: true }));
}
function hideHover() { clearTimeout(hovT); hovT = null; hovId = null; hovEl = null; const h = $('#hovercard'); if (h) h.classList.remove('show'); }
function hideHoverSoon() { clearTimeout(hovT); hovT = setTimeout(hideHover, 260); }
const inHover = el => !!(el && el.closest && el.closest('#hovercard'));
if (window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('.card[data-open], .row[data-open], .aitem[data-open], .gact[data-open], .grow[data-open], .co-row[data-hov], .co-row[data-shov], .co-row[data-phov], .pcard[data-popen]');
    if (!el) return;
    if ((el.dataset.shov ? 'sale:' + el.dataset.shov : (el.dataset.phov || el.dataset.popen) ? 'prod:' + (el.dataset.phov || el.dataset.popen) : el.dataset.open || el.dataset.hov) === hovId) { clearTimeout(hovT); hovT = null; return; }
    if (hovId) hideHover();   // ย้ายไปการ์ดอื่น: ปิดกล่องเดิมทันที ไม่ให้บังการ์ดใบอื่น
    clearTimeout(hovT); hovT = setTimeout(() => { if (!S.edit && !S.drag) showHover(el); }, 380);
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest && e.target.closest('.card[data-open], .row[data-open], .aitem[data-open], .gact[data-open], .grow[data-open], .co-row[data-hov], .co-row[data-shov], .co-row[data-phov], .pcard[data-popen]');
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    if (inHover(e.relatedTarget)) { clearTimeout(hovT); hovT = null; return; }   // เลื่อนเมาส์เข้าไปในการ์ดสรุป → ค้างไว้ให้กดดูรูปได้
    if (hovId) hideHoverSoon(); else hideHover();
  });
  document.addEventListener('scroll', e => { if (inHover(e.target)) return; const h = $('#hovercard'); if (h && h.matches(':hover')) return; if (hovEl && hovEl.isConnected && hovEl.matches(':hover')) showHover(hovEl); else if (hovId) hideHover(); }, true);
  document.addEventListener('mousedown', e => { if (!inHover(e.target)) hideHover(); }, true);
}

/* animated status badge */
function stBadge(j, size) {
  const st = isLate(j) ? 'late' : j.status;
  const ic = st === 'late' ? STI.fire : (STI[j.status] || STI.queue);
  return '<span class="st-badge sb-' + st + (size ? ' ' + size : '') + '" title="' + esc(isLate(j) ? 'เลยกำหนด' : (ST[j.status] || ST.queue).label) + '"><i>' + ic + '</i></span>';
}

/* job detail (view mode inside the side sheet) */
function renderDetail(E, j, live, ro, timer) {
  const jj = live || j, imgs = imgsOf(jj.id), di = dueInfo(jj), st = isLate(jj) ? 'late' : jj.status;
  const idx = flowIdxOf(jj), FL = flowOf(jj);
  const steps = '<div class="dt-steps">' + FL.map((f, i) => '<div class="dt-step ' + ST[f].cls + (i < idx ? ' past' : i === idx ? ' now' : '') + '"><span class="dt-dot">' + STI[f] + '</span><small>' + ST[f].label + '</small></div>' + (i < FL.length - 1 ? '<span class="dt-line' + (i < idx ? ' on' : '') + '"></span>' : '')).join('') + '</div>';
  const nextSt = nextOf(jj);
  const gallery = '<section class="dt-sec"><div class="dt-h"><b>' + DECO.palette.replace('palette', '') + 'รูปงาน</b><span class="sub">' + imgs.length + '/' + IMG_MAX + '</span></div>' +
    '<div class="gal">' + imgs.map(m => '<button type="button" class="gal-it" data-lbopen="' + esc(m.id) + '" data-lbjob="' + esc(jj.id) + '">' + thumbImg(m) + '</button>').join('') +
      Array.from({ length: S.uploading || 0 }).map(() => '<span class="gal-it up"><span class="spin-dot dark"></span><small>กำลังอัปโหลด</small></span>').join('') +
      (canAddImg(jj) && imgs.length < IMG_MAX ? '<label class="gal-add"><input type="file" accept="image/*" multiple data-imgjob="' + esc(jj.id) + '" hidden><span class="ga-ic">' + I.plus + '</span><small>เพิ่มรูป<br>หรือลากมาวาง</small></label>' : '') +
      (!imgs.length && !canAddImg(jj) ? '<span class="sub">ยังไม่มีรูป</span>' : '') +
    '</div></section>';
  $('#sheetBody').innerHTML =
    '<div class="dt-hero s-' + st + '">' + stBadge(jj, 'xl') + '<div class="dt-hero-t"><span class="eyebrow">' + esc(isLate(jj) ? 'เลยกำหนด · ' + di.text : (ST[jj.status] || ST.queue).label) + '</span><b>' + esc(jj.title || jj.code) + '</b><small class="hv-chips">' + typeChip(jj.taskType) + groupChip(jj.group) + '</small></div>' +
      (jj.priority === 'urgent' ? '<span class="tag urgent">' + STI.fire + 'ด่วน</span>' : '') + '</div>' +
    steps + clSec(jj, ro) + gallery + filesSec(jj, ro) + timer +
    '<section class="dt-sec"><div class="dt-h"><b>' + DECO.info + 'ข้อมูลงาน</b></div><div class="hv-grid dt-grid">' +
      '<span>เลข Job</span><b class="mono">' + esc(jj.code) + '</b>' +
      '<span>ผู้รับผิดชอบ</span><b class="hv-who">' + av(jj.assignee) + esc(jj.assignee || 'ยังไม่มอบหมาย') + '</b>' +
      (helpersOf(jj).length ? '<span>ผู้ร่วมทำงาน</span><b class="hv-who hv-helpers">' + helpersOf(jj).map(n => '<span>' + av(n) + esc(n) + '</span>').join('') + '</b>' : '') +
      '<span>Sale</span><b>' + esc(jj.sale || '–') + '</b>' +
      '<span>จำนวน / ระดับ</span><b>' + (jj.qty === 'multi' ? 'หลายชิ้น' : 'ชิ้นเดียว') + ' · ' + lvBars(jj.level) + '</b>' +
      '<span>รับงาน</span><b>' + fdY(jj.received) + '</b>' +
      '<span>กำหนดส่ง</span><b class="' + (di.cls === 'late' ? 'bad' : '') + '">' + fdY(jj.due) + ' <small>(' + esc(di.text) + ')</small></b>' +
      '<span>เริ่มทำ</span><b>' + fdt(jj.startedAt) + '</b>' +
      '<span>ปิดงาน</span><b>' + fdt(jj.finishedAt) + '</b>' +
    '</div>' + (jj.note ? '<p class="hv-note">' + esc(jj.note) + '</p>' : '') + '</section>' +
    cmtSec(jj) +
    '<section class="dt-sec"><div class="dt-h"><b>' + DECO.clock + 'ประวัติ</b></div><div class="hist" id="hist">' + (E.hist ? histHtml(E.hist) : '<span>กำลังโหลด…</span>') + '</div></section>';
  $('#sheetFoot').innerHTML = '<button class="btn" data-act="close" type="button">ปิด</button>' +
    '<button class="btn" type="button" data-act="askhelp" data-job="' + esc(jj.id) + '">' + MSG_IC.sos + 'ขอช่วย</button>' +
    (!ro && jj.status === 'review' ? '<button class="btn" type="button" data-move="' + esc(jj.id) + '" data-to="fix">' + STI.fix + 'ส่งกลับไปแก้ไข</button>' : '') +
    (!ro && nextSt ? '<button class="btn" type="button" data-move="' + esc(jj.id) + '" data-to="' + nextSt + '">' + (STI[nextSt] || '') + (jj.status === 'review' ? 'ตรวจผ่าน → เสร็จแล้ว' : isCam(jj) && nextSt === 'done' ? 'งาน CAM เสร็จ → เสร็จแล้ว' : jj.status === 'fix' ? 'แก้เสร็จ → ส่งตรวจ' : 'เลื่อนเป็น ' + ST[nextSt].label) + '</button>' : '') +
    (!ro ? '<button class="btn primary" data-act="editmode" type="button">' + I.settings + 'แก้ไขข้อมูล</button>' : '');
  paintAllThumbs($('#sheetBody'));
}

/* ============ v2.24: ไฟล์งาน · เช็กลิสต์ · คอมเมนต์ · ตารางงานรายคน · ลิงก์ Sale ============ */
const FILE_MAX_MB = 30;
const filesOf = id => (S.files || []).filter(f => f.jobId === id);
const fileUrl = f => f.fileId ? 'https://drive.google.com/file/d/' + encodeURIComponent(f.fileId) + '/view' : (f.data || '#');
const fileDl = f => f.fileId ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(f.fileId) : (f.data || '#');
function fsize(n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }
function fileIc(name) {
  const ext = (String(name).split('.').pop() || '').toUpperCase().slice(0, 4);
  const col = /^(DWG|DXF)$/.test(ext) ? '#2D5FC4' : /^(NC|TAP|GCODE|NCC|CNC)$/.test(ext) ? '#B05A2A' : /^PDF$/.test(ext) ? '#C0392B' : /^(STL|STEP|STP|IGS|3DM|SKP)$/.test(ext) ? '#7A4BB5' : '#5B6B7A';
  return '<span class="f-ic" style="--fc:' + col + '">' + esc(ext || 'FILE') + '</span>';
}
function filesSec(jj, ro) {
  const fs = filesOf(jj.id), up = (S.fileUp || {})[jj.id] || [];
  return '<section class="dt-sec" id="dtFiles"><div class="dt-h"><b>' + STI.clip + 'ไฟล์งาน</b><span class="sub">' + fs.length + ' ไฟล์ · DWG, DXF, NC, PDF … ไม่เกิน ' + FILE_MAX_MB + ' MB</span></div>' +
    '<div class="flist">' + fs.map(f => '<div class="frow">' + fileIc(f.name) + '<a class="fname" href="' + esc(fileUrl(f)) + '" target="_blank" rel="noopener" title="เปิดดู">' + esc(f.name) + '<small>' + fsize(f.size) + ' · ' + esc(f.createdBy || '') + ' · ' + fdt(String(f.createdAt || '').slice(0, 16)) + '</small></a>' +
      '<a class="icon-btn" href="' + esc(fileDl(f)) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '" title="ดาวน์โหลด" aria-label="ดาวน์โหลด ' + esc(f.name) + '">' + I.download + '</a>' +
      (!ro && (isAdmin() || f.createdBy === S.me || P.leads(S.user, jj)) ? '<button type="button" class="icon-btn" data-fdel="' + esc(f.id) + '" title="ลบไฟล์" aria-label="ลบ ' + esc(f.name) + '">' + I.trash + '</button>' : '') + '</div>').join('') +
      up.map(n => '<div class="frow up"><span class="spin-dot dark"></span><span class="fname">' + esc(n) + '<small>กำลังอัปโหลด…</small></span></div>').join('') +
      (!fs.length && !up.length ? '<div class="sub fempty">ยังไม่มีไฟล์</div>' : '') + '</div>' +
    (!ro ? '<label class="fdrop" data-fdrop="' + esc(jj.id) + '"><input type="file" multiple data-filejob="' + esc(jj.id) + '" hidden>' + I.plus + '<span><b>แนบไฟล์</b><small>ลากไฟล์มาวาง หรือกดเลือก · เก็บใน Google Drive โฟลเดอร์ "ไฟล์งาน/' + esc(jj.code) + '"</small></span></label>' : '') + '</section>';
}
function readDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
async function uploadFiles(jobId, files) {
  const list = Array.from(files || []); if (!list.length) return;
  S.fileUp = S.fileUp || {};
  for (const f of list) {
    if (f.size > FILE_MAX_MB * 1048576) { toast(f.name + ' ใหญ่เกิน ' + FILE_MAX_MB + ' MB — ใส่ลิงก์ไว้ในคอมเมนต์แทน', true); continue; }
    (S.fileUp[jobId] = S.fileUp[jobId] || []).push(f.name); refreshDetail();
    try {
      const data = await readDataUrl(f);
      const r = await mutate(() => api().addFile({ jobId: jobId, name: f.name, mime: f.type || '', data: data }), 'แนบ ' + f.name + ' แล้ว');
      S.files = (S.files || []).concat(r.file);
    } catch (e) {}
    S.fileUp[jobId] = (S.fileUp[jobId] || []).filter(n => n !== f.name);
    refreshDetail(); render();
  }
}
async function deleteFile(id) {
  const f = (S.files || []).find(x => x.id === id); if (!f) return;
  if (S.fdelAsk !== id) { S.fdelAsk = id; toast('กดถังขยะอีกครั้งเพื่อยืนยันลบ ' + f.name); setTimeout(() => { if (S.fdelAsk === id) S.fdelAsk = ''; }, 4000); return; }
  S.fdelAsk = '';
  try { await mutate(() => api().deleteFile({ id: id }), 'ลบ ' + f.name + ' แล้ว'); S.files = S.files.filter(x => x.id !== id); refreshDetail(); render(); } catch (e) {}
}
/* หน้าเพิ่มงานใหม่: เช็กลิสต์ · ไฟล์งาน · คอมเมนต์แรก (บันทึกพร้อมงาน) */
function newExtras(E) {
  const j = E.job, c = clOf(j), tpl = clTemplate(j.taskType), pf = E.pfiles || [];
  return '<fieldset class="nx"><legend>เช็กลิสต์</legend><div class="f full">' +
      '<div class="cl-list">' + c.map((x, i) => '<div class="cl-it"><span class="cl-box static"></span><span><em class="clt">' + esc(x.t) + '</em></span><button type="button" class="icon-btn sm" data-ncldel="' + i + '" aria-label="ลบขั้นนี้">✕</button></div>').join('') + '</div>' +
      '<div class="cl-add"><input id="nclNew" placeholder="เพิ่มขั้นตอน เช่น เช็กขนาด, ส่ง sale ตรวจ" autocomplete="off"><button type="button" class="btn sm" data-act="ncladd">' + I.plus + 'เพิ่ม</button>' +
      (tpl.length && !c.length ? '<button type="button" class="btn sm primary" data-act="ncltpl">ใช้เช็กลิสต์มาตรฐานของ "' + esc(j.taskType) + '" (' + tpl.length + ' ขั้น)</button>' : '') + '</div>' +
      (!c.length && !tpl.length ? '<span class="hint">ถ้าไม่ใส่ จะได้เช็กลิสต์มาตรฐานของรายละเอียดงานนั้นให้อัตโนมัติ (ถ้าตั้งไว้)</span>' : '') + '</div></fieldset>' +
    '<fieldset class="nx"><legend>ไฟล์งาน</legend><div class="f full">' +
      '<div class="flist">' + pf.map((f, i) => '<div class="frow">' + fileIc(f.name) + '<span class="fname">' + esc(f.name) + '<small>' + fsize(f.size) + ' · อัปโหลดหลังกดเพิ่มงาน</small></span><span></span><button type="button" class="icon-btn" data-pfdel="' + i + '" aria-label="เอาออก">' + I.trash + '</button></div>').join('') + '</div>' +
      '<label class="fdrop"><input type="file" multiple data-pfile="1" hidden>' + I.plus + '<span><b>แนบไฟล์งาน</b><small>DWG, DXF, NC, PDF … ไม่เกิน ' + FILE_MAX_MB + ' MB · ลากมาวางในหน้านี้ได้</small></span></label></div></fieldset>' +
    '<fieldset class="nx"><legend>คอมเมนต์</legend><div class="f full"><textarea id="eCmt" rows="2" placeholder="ข้อความถึงคนทำงาน เช่น ลูกค้าขอขอบมน, ใช้ไฟล์เวอร์ชันล่าสุด">' + esc(E.firstCmt || '') + '</textarea></div></fieldset>';
}
function addPendingFiles(files) {
  const E = S.edit; if (!E) return;
  const ok = Array.from(files || []).filter(f => { if (f.size > FILE_MAX_MB * 1048576) { toast(f.name + ' ใหญ่เกิน ' + FILE_MAX_MB + ' MB', true); return false; } return true; });
  if (!ok.length) return; readEditor(); E.firstCmt = ($('#eCmt') || {}).value || E.firstCmt; E.pfiles = (E.pfiles || []).concat(ok); renderEditor();
}
function refreshDetail() { if (S.edit && S.edit.mode === 'view') renderEditor(); }

/* ----- เช็กลิสต์ ----- */
function clOf(j) { try { const a = JSON.parse((j && j.checklist) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.t) : []; } catch (e) { return []; } }
function clTemplate(type) { const t = ((S.settings.checklists || {})[type] || ''); return String(t).split('\n').map(x => x.trim()).filter(Boolean).map(x => ({ t: x, d: 0 })); }
function clChip(j) { const c = clOf(j); if (!c.length) return ''; const n = c.filter(x => x.d).length; return '<span class="tg cl' + (n === c.length ? ' full' : '') + '" title="เช็กลิสต์ ' + n + '/' + c.length + '">' + DECO.check + n + '/' + c.length + '</span>'; }
function clSec(jj, ro) {
  const c = clOf(jj), n = c.filter(x => x.d).length, tpl = clTemplate(jj.taskType);
  return '<section class="dt-sec" id="dtCl"><div class="dt-h"><b>' + DECO.check + 'เช็กลิสต์</b><span class="sub">' + (c.length ? n + '/' + c.length + ' ขั้น' : 'ยังไม่มีขั้นตอน') + '</span></div>' +
    (c.length ? '<div class="cl-bar"><i style="width:' + Math.round(n / c.length * 100) + '%"></i></div>' : '') +
    '<div class="cl-list">' + c.map((x, i) => '<div class="cl-it' + (x.d ? ' done' : '') + '"><button type="button" class="cl-box" data-cltog="' + i + '" aria-pressed="' + !!x.d + '"' + (ro ? ' disabled' : '') + '>' + (x.d ? '✓' : '') + '</button><span><em class="clt">' + esc(x.t) + '</em>' + (x.by ? '<small>' + esc(x.by) + (x.at ? ' · ' + fdt(x.at) : '') + '</small>' : '') + '</span>' +
      (!ro ? '<button type="button" class="icon-btn sm" data-cldel="' + i + '" aria-label="ลบขั้นนี้">✕</button>' : '') + '</div>').join('') + '</div>' +
    (!ro ? '<div class="cl-add"><input id="clNew" placeholder="เพิ่มขั้นตอน เช่น เช็กขนาด, ส่ง sale ตรวจ" autocomplete="off"><button type="button" class="btn sm" data-act="cladd">' + I.plus + 'เพิ่ม</button>' +
      (!c.length && tpl.length ? '<button type="button" class="btn sm primary" data-act="cltpl">ใช้เช็กลิสต์มาตรฐาน (' + tpl.length + ' ขั้น)</button>' : '') + '</div>' : '') + '</section>';
}
async function clSave(jobId, list) {
  const live = jobById(jobId); if (!live) return;
  const prev = live.checklist; live.checklist = JSON.stringify(list); refreshDetail(); render();
  try { const j = clone(live); delete j.minutes; j.baseUpdatedAt = ''; await saveJob(j); }
  catch (e) { live.checklist = prev; refreshDetail(); render(); }
}

/* ----- คอมเมนต์ ----- */
function cmtSec(jj) {
  const E = S.edit, list = E && E.cmts;
  return '<section class="dt-sec" id="dtCmt"><div class="dt-h"><b>' + MSG_IC.chat + 'คอมเมนต์</b><span class="sub">' + (list ? list.length : ((S.cmtCount || {})[jj.id] || 0)) + ' ข้อความ</span></div>' +
    '<div class="cmt-list">' + (!list ? '<span class="sub">กำลังโหลด…</span>' : !list.length ? '<span class="sub">ยังไม่มีคอมเมนต์ — ถามหรือบอกจุดที่ต้องแก้ไว้ตรงนี้ได้เลย</span>' :
      list.map(c => '<div class="cmt' + (c.from === S.me ? ' me' : '') + '">' + av(c.from, 'sm') + '<div class="cmt-b"><span class="cmt-h"><b>' + esc(c.from) + '</b><small>' + fdt(String(c.ts).slice(0, 16)) + '</small>' +
        (c.from === S.me || isAdmin() ? '<button type="button" class="cmt-x" data-cmtdel="' + esc(c.id) + '" aria-label="ลบคอมเมนต์">✕</button>' : '') + '</span><p>' + esc(c.text).replace(/\n/g, '<br>') + '</p></div></div>').join('')) + '</div>' +
    '<div class="cmt-add"><textarea id="cmtText" rows="2" placeholder="เขียนคอมเมนต์… (Ctrl+Enter ส่ง)"></textarea><button type="button" class="btn primary sm" data-act="cmtsend">' + MSG_IC.send + 'ส่ง</button></div></section>';
}
function loadCmts(jobId) {
  api().comments({ jobId: jobId }).then(r => { HCMT[jobId] = { at: Date.now(), list: r.comments || [] }; if (S.edit && S.edit.job.id === jobId) { S.edit.cmts = r.comments || []; (S.cmtCount = S.cmtCount || {})[jobId] = S.edit.cmts.length; if (S.edit.mode === 'view') { const el = $('#dtCmt'); if (el) el.outerHTML = cmtSec(jobById(jobId) || S.edit.job); } } }).catch(() => {});
}
async function sendCmt() {
  const t = $('#cmtText'), text = t ? t.value.trim() : ''; if (!text || !S.edit) return;
  const jobId = S.edit.job.id; t.value = ''; t.disabled = true;
  try {
    const r = await mutate(() => api().addComment({ jobId: jobId, text: text }));
    S.cmtSelf = S.cmtSelf || {}; S.cmtSelf[jobId] = (S.cmtSelf[jobId] || 0) + 1;
    if (S.edit && S.edit.job.id === jobId) { S.edit.cmts = (S.edit.cmts || []).concat(r.comment); (S.cmtCount = S.cmtCount || {})[jobId] = S.edit.cmts.length; refreshDetail(); render(); setTimeout(() => { const l = document.querySelector('.cmt-list'); if (l) l.scrollTop = l.scrollHeight; const tt = $('#cmtText'); if (tt) tt.focus(); }, 30); }
  } catch (e) { const tt = $('#cmtText'); if (tt) { tt.value = text; tt.disabled = false; } }
}
async function delCmt(id) {
  if (!S.edit) return;
  try { await mutate(() => api().deleteComment({ id: id })); S.edit.cmts = (S.edit.cmts || []).filter(c => c.id !== id); (S.cmtCount = S.cmtCount || {})[S.edit.job.id] = S.edit.cmts.length; refreshDetail(); render(); } catch (e) {}
}
function cmtAlerts(prev) {
  if (!prev || !S.me) return;
  const cur = S.cmtCount || {};
  Object.keys(cur).forEach(id => {
    const add = (cur[id] || 0) - (prev[id] || 0); if (add <= 0) return;
    const self = (S.cmtSelf || {})[id] || 0; if (self >= add) { S.cmtSelf[id] = self - add; return; }
    const j = jobById(id); if (!j || !(inJob(j, S.me) || j.createdBy === S.me)) return;
    if (S.edit && S.edit.job.id === id) { loadCmts(id); return; }
    jobNotify('assign', 'คอมเมนต์ใหม่ · ' + j.code, j.title || '', j.id);
  });
}

/* ----- ตารางงานรายคน (หัวหน้า/แอดมิน) ----- */
function workloadPanel() {
  if (!isLead()) return '';
  const t = today(), R0 = ganttRange(), a = R0.p !== 'auto' ? R0.from : addDays(t, -3), b = R0.p !== 'auto' ? R0.to : addDays(t, 14);
  const span = daysBetween(a, b) + 1, X = iso => Math.max(0, Math.min(100, daysBetween(a, iso) / span * 100)), W = (x, y) => Math.max(0.8, X(y) - X(x));
  const ppl = designers().filter(m => m.role !== 'admin').map(m => m.name);
  const jobsIn = S.jobs.filter(j => { const st = String(j.received || j.createdAt || t).slice(0, 10), en = finDate(j) || (j.due && j.due > t ? j.due : t); return st <= b && en >= a && (isOpen(j) || finDate(j) >= a); });
  let grid = '', ticks = '';
  const step = span > 40 ? 7 : span > 20 ? 2 : 1;
  for (let i = 0; i < span; i++) {
    const d = addDays(a, i), dd = parseLocal(d), off = dd.getDay() === 0 || dd.getDay() === 6 || isHoliday(d);
    if (off) grid += '<i class="gw' + (isHoliday(d) ? ' hol' : '') + '" style="left:' + X(d) + '%;width:' + (100 / span) + '%" title="' + esc(holidayName(d) || '') + '"></i>';
    if (i % step === 0) ticks += '<span class="gt' + (dd.getDate() === 1 || i === 0 ? ' m' : '') + '" style="left:' + (X(d) + 50 / span) + '%">' + (dd.getDate() === 1 || i === 0 ? dd.getDate() + ' ' + TH_M[dd.getMonth()] : dd.getDate()) + '</span>';
  }
  const rows = ppl.concat(jobsIn.some(j => !j.assignee) ? [''] : []).map(name => {
    const js = jobsIn.filter(j => name ? inJob(j, name) : !j.assignee).map(j => ({ j: j, st: String(j.received || j.createdAt || t).slice(0, 10), en: finDate(j) || (j.due && j.due > t ? j.due : t), help: !!name && j.assignee !== name }))
      .sort((x, y) => x.st.localeCompare(y.st));
    const lanes = []; js.forEach(x => { let k = lanes.findIndex(e => e < x.st); if (k < 0) { k = lanes.length; lanes.push(''); } lanes[k] = x.en; x.lane = k; });
    const open = js.filter(x => isOpen(x.j)).length, late = js.filter(x => isLate(x.j)).length;
    const bars = js.map(x => '<i class="gact wl' + (x.help ? ' help' : '') + (isOpen(x.j) ? '' : ' fin') + (isLate(x.j) ? ' late' : '') + '" data-open="' + esc(x.j.id) + '" style="left:' + X(x.st) + '%;width:' + W(x.st, addDays(x.en, 1)) + '%;top:' + (8 + x.lane * 22) + 'px;--c:' + (typeColor(x.j.taskType) || 'var(--brand)') + '"><b>' + esc(x.j.code) + '</b></i>').join('');
    return '<div class="wrow" style="--h:' + Math.max(40, 16 + lanes.length * 22) + 'px"><div class="glab">' + (name ? '<span class="gl1">' + av(name, 'sm') + '<b>' + esc(name) + '</b></span>' : '<span class="gl1"><b>ยังไม่มอบหมาย</b></span>') +
      '<small>' + open + ' งานค้าง' + (late ? ' · <em class="late">เลย ' + late + '</em>' : '') + '</small></div><div class="gtrack">' + bars + '</div></div>';
  }).join('');
  return '<section class="panel gantt-p wl-p"><div class="panel-h"><div><h2>ตารางงานรายคน</h2><div class="sub">ใครทำอะไร ช่วงไหน · ใช้ช่วงวันที่เดียวกับ "เส้นทางงาน" · แถบเส้นประ = ไปช่วยงานคนอื่น</div></div>' +
    '<div class="legend"><span><i style="background:var(--late)"></i>เลยกำหนด</span><span><i class="lg-today"></i>วันนี้</span></div></div>' +
    '<div class="gantt wl"><div class="gscroll"><div class="ghead wl"><div class="glab"></div><div class="gtrack">' + ticks + '</div></div>' +
    '<div class="gbody"><div class="ggrid wl"><div class="glab"></div><div class="gtrack">' + grid + (t >= a && t <= b ? '<i class="gtoday" style="left:' + (X(t) + 50 / span) + '%"></i>' : '') + '</div></div>' + rows + '</div></div></div></section>';
}

/* ----- วันหยุดบริษัท ----- */
const holidays = () => (S.settings && Array.isArray(S.settings.holidays) ? S.settings.holidays : []);
const isHoliday = iso => holidays().some(h => h && h.d === iso);
const holidayName = iso => { const h = holidays().find(x => x && x.d === iso); return h ? h.n || 'วันหยุด' : ''; };
/* วันหยุดราชการที่วันที่ตายตัวทุกปี (วันพระ/วันหยุดชดเชย เพิ่มเองตามประกาศ) */
const FIXED_HOL = [['01-01', 'วันขึ้นปีใหม่'], ['04-06', 'วันจักรี'], ['04-13', 'วันสงกรานต์'], ['04-14', 'วันสงกรานต์'], ['04-15', 'วันสงกรานต์'], ['05-01', 'วันแรงงาน'], ['05-04', 'วันฉัตรมงคล'],
  ['06-03', 'วันเฉลิมฯ พระราชินี'], ['07-28', 'วันเฉลิมฯ ร.10'], ['08-12', 'วันแม่แห่งชาติ'], ['10-13', 'วันคล้ายวันสวรรคต ร.9'], ['10-23', 'วันปิยมหาราช'], ['12-05', 'วันพ่อแห่งชาติ'], ['12-10', 'วันรัฐธรรมนูญ'], ['12-31', 'วันสิ้นปี']];

/* ----- หน้า Sale (อ่านอย่างเดียว ไม่ต้องเข้าสู่ระบบ) ----- */
const SALE_Q = (() => { try { const u = new URL(location.href); return u.searchParams.get('salek') ? { k: u.searchParams.get('salek'), sale: u.searchParams.get('sale') || '' } : null; } catch (e) { return null; } })();
function typeColorPub(name) { const c = (S.settings && S.settings.taskTypes) ? typeColor(name) : ''; if (c) return c; let h = 0; String(name || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) % 360; }); return /CAM/.test(name || '') ? '#E8590C' : /CAD/.test(name || '') ? '#2D5FC4' : 'hsl(' + h + ' 55% 45%)'; }
async function salePage() {
  document.body.classList.add('auth', 'sale-mode'); applyTheme();
  const root = $('#view') || document.body;
  let last = null, lastErr = '', q = '';
  const F = { st: 'all', status: '', sale: '', group: '', type: '', range: '', who: '', help: '', prod: '' };   // ตัวกรอง
  const prevN = {}; let busy = false, firstAnim = true;
  const draw = (d, err) => {
    last = d; lastErr = err || '';
    if (d && Array.isArray(d.people)) S.users = d.people.map(p => Object.assign({ active: true }, p));
    const sel = SALE_Q.sale, t = today(), qq = q.trim().toLowerCase();
    const all = (d && d.jobs) || [], uniq = k => [...new Set(all.map(j => j[k]).filter(Boolean))].sort();
    const PM = {}; ((d && d.prods) || []).forEach(x => { const k = String(x.code).toLowerCase(); if (!PM[k] || (PM[k].stage === 'shipped' && x.stage !== 'shipped')) PM[k] = x; });
    const prodOf = j => PM[String(j.code || '').toLowerCase()] || null;
    const hs = j => String(j.helpers || '').split(',').map(x => x.trim()).filter(Boolean);
    const since = F.range === '7' ? addDays(t, -6) : F.range === '30' ? addDays(t, -29) : F.range === 'm' ? t.slice(0, 8) + '01' : '';
    const isLateJ = j => j.status !== 'done' && j.due && j.due < t;
    const base = all.filter(j => (!qq || [j.code, j.title, j.taskType, j.group, j.note, j.sale, j.assignee, j.helpers].join(' ').toLowerCase().indexOf(qq) >= 0) &&
      (!F.status || (F.status === 'late' ? isLateJ(j) : j.status === F.status)) && (!F.sale || j.sale === F.sale) && (!F.group || j.group === F.group) && (!F.type || j.taskType === F.type) &&
      (!F.who || (F.who === '__none' ? !j.assignee : j.assignee === F.who)) && (!F.help || (F.help === '__any' ? hs(j).length > 0 : hs(j).includes(F.help))) && (!since || String(j.received || '') >= since) &&
      (!F.prod || (prodOf(j) && prodOf(j).stage === F.prod)));
    const doneB = base.filter(j => j.status === 'done'), okB = doneB.filter(j => !j.due || String(j.finishedAt || '').slice(0, 10) <= j.due).length;
    const N = { all: base.length, act: base.filter(j => j.status !== 'done').length, late: base.filter(isLateJ).length, done: doneB.length };
    const jobs = base.filter(j => F.st === 'all' || (F.st === 'act' ? j.status !== 'done' : F.st === 'late' ? isLateJ(j) : j.status === 'done')).slice().sort((x, y) => (x.status === 'done') - (y.status === 'done') || isLateJ(y) - isLateJ(x) || String(x.due || '9').localeCompare(String(y.due || '9')));
    const people = [...new Set(all.map(j => j.assignee).filter(Boolean))].sort(), helpersAll = [...new Set(all.flatMap(hs))].sort();
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(label) + '</option>';
    const fsel = (k, ic, first, opts) => '<label class="spf' + (F[k] ? ' on' : '') + '"><span class="spf-ic">' + ic + '</span><select data-spf="' + k + '">' + opt('', first, F[k]) + opts + '</select></label>';
    const row = (j, i) => {
      const late = isLateJ(j), fin = String(j.finishedAt || '').slice(0, 10), ok = j.status === 'done' && (!j.due || fin <= j.due), st = late ? 'late' : j.status;
      const dd = j.due && j.status !== 'done' ? daysBetween(t, j.due) : null;
      const badge = j.status === 'done' ? '<em class="sp-bdg ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓ ตรงเวลา' : 'ช้ากว่ากำหนด') + '</em>' : dd === null ? '' : '<em class="sp-bdg ' + (dd < 0 ? 'bad' : dd <= 1 ? 'warn' : '') + '">' + (dd < 0 ? 'เลย ' + (-dd) + ' วัน' : dd === 0 ? 'วันนี้' : dd === 1 ? 'พรุ่งนี้' : 'อีก ' + dd + ' วัน') + '</em>';
      const stp = String(j.steps || '').split('/'), pct = stp.length === 2 && +stp[1] ? Math.round(+stp[0] / +stp[1] * 100) : -1;
      const team = (j.assignee ? av(j.assignee, 'sm') + '<span class="sp-who"><b>' + esc(j.assignee) + '</b>' + (hs(j).length ? '<small>+ ' + esc(hs(j).join(', ')) + '</small>' : '') + '</span>' : '<span class="sub">ยังไม่มอบหมาย</span>');
      return '<tr class="sp-r' + (late ? ' late' : '') + (j.status === 'done' ? ' done' : '') + (firstAnim ? ' in' : '') + '" style="--i:' + Math.min(i, 20) + '"><td><b class="mono">' + esc(j.code) + '</b>' + (j.priority === 'urgent' ? ' <span class="tag urgent">' + STI.fire + 'ด่วน</span>' : '') + '<small>' + esc(j.title || '') + '</small></td>' +
        '<td><span class="sp-type" style="--tc:' + (typeColorPub(j.taskType)) + '">' + esc(j.taskType || '–') + '</span><small>' + esc(groupShort(j.group || '')) + '</small></td>' +
        '<td class="sp-team">' + team + '</td>' +
        '<td><span class="pill ' + (late ? 's-late' : (ST[j.status] || ST.queue).cls) + '">' + (late ? STI.fire : (STI[j.status] || '')) + (late ? 'เลยกำหนด' : (ST[j.status] || ST.queue).label) + '</span>' +
          (pct >= 0 ? '<span class="sp-cl" title="เช็กลิสต์ ' + esc(j.steps) + '"><i style="width:' + pct + '%"></i></span><small>เช็กลิสต์ ' + esc(j.steps) + '</small>' : '') +
          ((pp => pp ? '<span class="sp-prod ' + PSTG[pp.stage].cls + '" title="ฝ่ายผลิต">' + PIC[pp.stage] + '<b>ผลิต: ' + PSTG[pp.stage].label + '</b>' + (pp.stage === 'machine' ? '<small>' + esc((pp.machines || []).map(m => (m.d ? '✓' : '') + m.m).join(' · ')) + '</small>' : pp.stage === 'shipped' ? '<small>' + esc(fd(pp.shippedAt)) + '</small>' : '') + '</span>' : '')(prodOf(j))) + '</td>' +
        '<td>' + fdY(j.received) + '</td><td>' + (j.status === 'done' ? '<b class="' + (ok ? 'ok' : 'bad') + '">เสร็จ ' + fdY(fin) + '</b>' : '<b class="' + (late ? 'bad' : '') + '">' + fdY(j.due) + '</b>') + badge + '</td>' +
        '<td class="sp-note">' + (j.note ? esc(j.note) : '<span class="sub">–</span>') + '</td>' + (sel ? '' : '<td>' + esc(j.sale || '–') + '</td>') + '</tr>';
    };
    const b = (d && d.brand) || {}, anyF = F.st !== 'all' || F.status || F.sale || F.group || F.type || F.range || F.who || F.help || F.prod || q;
    const pall = Object.values(PM).filter(x => !sel || x.sale === sel), pn = st => pall.filter(x => x.stage === st).length;
    const pstrip = pall.length ? '<div class="sp-pflow"><span class="sp-pf-h">' + PIC.machine + 'ฝ่ายผลิต</span>' + PCOLS.concat('shipped').map(st => '<button type="button" class="sp-pf ' + PSTG[st].cls + (F.prod === st ? ' on' : '') + '" data-spprod="' + st + '">' + PIC[st] + '<b>' + pn(st) + '</b><span>' + PSTG[st].label + (st === 'shipped' ? ' (60 วัน)' : '') + '</span></button>').join('') + '</div>' : '';
    const cards = [['all', 'ทั้งหมด', '', I.list || STI.queue], ['act', 'กำลังดำเนินการ', 'doing', STI.doing], ['late', 'เลยกำหนด', 'bad', STI.fire], ['done', 'เสร็จใน 45 วัน', 'ok', STI.done]];
    root.innerHTML = '<div class="sale-page"><header class="sp-h"><div class="sp-logo">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : esc(initial(b.company || 'K'))) + '</div><div class="sp-ht"><b>' + esc(b.appName || 'คิวงาน') + ' · สถานะงาน</b><small>' + esc(b.company || '') + (sel ? ' · Sale ' + esc(sel) : ' · ทุก Sale') + '</small></div>' +
      (LS.get('saleKey', '') === SALE_Q.k ? '<a class="btn sm ghost sp-back" href="' + esc(location.pathname) + '">‹ หน้าเข้าสู่ระบบ</a>' : '') +
      '<span class="sp-live" title="อัปเดตเองทุก 1 นาที"><i></i>สด</span><button class="btn sm sp-ref' + (busy ? ' spin' : '') + '" data-sale-refresh="1">' + I.refresh + '<span>รีเฟรช</span></button></header>' +
      (err ? '<div class="err">' + esc(err) + '</div>' : !d ? '<div class="sp-skel">' + '<i></i>'.repeat(6) + '</div>' : saleTabs() + (SF.v === 'flow' ? '<div class="sf-wrap">' + saleFlowHtml(d, sel) + '</div><p class="sub sp-foot">ข้อมูลล่าสุด ' + new Date().toLocaleTimeString('th-TH') + ' · อัปเดตเองทุก 1 นาที · กดที่งานเพื่อดูรายละเอียด · หน้านี้ดูได้อย่างเดียว</p>' :
        '<div class="sp-sum">' + cards.map(c => '<button type="button" data-spst="' + c[0] + '" class="sp-card c-' + c[0] + (F.st === c[0] ? ' on' : '') + '"><span class="sp-ci">' + c[3] + '</span><b class="' + c[2] + '" data-n="' + N[c[0]] + '" data-k="' + c[0] + '">' + (prevN[c[0]] !== undefined ? prevN[c[0]] : 0) + '</b><span>' + c[1] + '</span>' +
          (c[0] === 'done' && N.done ? '<small>ตรงเวลา ' + Math.round(okB / N.done * 100) + '%</small>' : c[0] === 'late' && N.act ? '<small>' + Math.round(N.late / N.act * 100) + '% ของงานค้าง</small>' : '') + '</button>').join('') + '</div>' + pstrip +
        '<div class="sp-tools"><label class="sp-search">' + I.search + '<input id="spQ" type="search" placeholder="ค้นหาเลข Job, ลูกค้า, คนทำ, หมายเหตุ…" value="' + esc(q) + '" autocomplete="off"></label>' +
        '<div class="sp-filters">' + (sel ? '' : fsel('sale', STI.user || '฿', 'ทุก Sale', uniq('sale').map(x => opt(x, x, F.sale)).join(''))) +
          fsel('status', STI.doing, 'ทุกสถานะ', [['queue', 'รอคิว'], ['doing', 'กำลังทำ'], ['review', 'รอตรวจ'], ['fix', 'แก้ไข'], ['hold', 'พักไว้'], ['done', 'เสร็จแล้ว'], ['late', 'เลยกำหนด']].map(o => opt(o[0], o[1] + ' (' + all.filter(j => o[0] === 'late' ? isLateJ(j) : j.status === o[0]).length + ')', F.status)).join('')) +
          (pall.length ? fsel('prod', PIC.machine, 'ขั้นผลิต: ทั้งหมด', PCOLS.concat('shipped').map(st => opt(st, 'ผลิต: ' + PSTG[st].label + ' (' + pn(st) + ')', F.prod)).join('')) : '') +
          fsel('who', '👤', 'ผู้รับผิดชอบ: ทุกคน', people.map(x => opt(x, x + ' (' + all.filter(j => j.assignee === x).length + ')', F.who)).join('') + (all.some(j => !j.assignee) ? opt('__none', 'ยังไม่มอบหมาย', F.who) : '')) +
          fsel('help', '🤝', 'ผู้ร่วมทำงาน: ทั้งหมด', opt('__any', 'มีผู้ร่วมทำงาน', F.help) + helpersAll.map(x => opt(x, x + ' (' + all.filter(j => hs(j).includes(x)).length + ')', F.help)).join('')) +
          fsel('group', STI.layers || '▦', 'ทุกกลุ่มงาน', uniq('group').map(x => opt(x, groupShort(x), F.group)).join('')) +
          fsel('type', '✎', 'ทุกรายละเอียดงาน', uniq('taskType').map(x => opt(x, x, F.type)).join('')) +
          fsel('range', STI.calendar, 'รับงาน: ทั้งหมด', [['7', 'รับงาน: 7 วันล่าสุด'], ['30', 'รับงาน: 30 วันล่าสุด'], ['m', 'รับงาน: เดือนนี้']].map(o => opt(o[0], o[1], F.range)).join('')) +
          (anyF ? '<button class="btn sm sp-clear" data-spclear="1">✕ ล้างตัวกรอง</button>' : '') + '</div></div>' +
        '<div class="sp-count">แสดง <b>' + jobs.length + '</b> จาก ' + all.length + ' งาน</div>' +
        '<div class="sp-wrap"><table class="sp-t"><thead><tr><th>งาน</th><th>รายละเอียด</th><th>ทีมงาน</th><th>สถานะ</th><th>รับงาน</th><th>กำหนดส่ง / เสร็จ</th><th>หมายเหตุ</th>' + (sel ? '' : '<th>Sale</th>') + '</tr></thead><tbody>' +
          (jobs.length ? jobs.map(row).join('') : '<tr><td colspan="8"><div class="sp-empty"><span>🔍</span><b>' + (anyF ? 'ไม่พบงานตามตัวกรอง' : 'ยังไม่มีงาน') + '</b>' + (anyF ? '<button class="btn sm" data-spclear="1">ล้างตัวกรอง</button>' : '') + '</div></td></tr>') + '</tbody></table></div>' +
        '<p class="sub sp-foot">ข้อมูลล่าสุด ' + new Date().toLocaleTimeString('th-TH') + ' · อัปเดตเองทุก 1 นาที · หน้านี้ดูได้อย่างเดียว</p>')) + '</div>';
    // ตัวเลขนับขึ้น
    root.querySelectorAll('.sp-card b[data-n]').forEach(el => {
      const to = +el.dataset.n, from = prevN[el.dataset.k] !== undefined ? prevN[el.dataset.k] : 0; prevN[el.dataset.k] = to;
      if (from === to) { el.textContent = to; return; }
      const t0 = performance.now(), dur = 650, step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    if (d) firstAnim = false;
  };
  // เร็วขึ้น: แสดงข้อมูลที่จำไว้ทันที → ดึงใหม่เบื้องหลัง (ทางด่วนผ่านกล่องรับ + ส่งคำขอสำรองถ้าช้า)
  const ck = 'saleCache:' + SALE_Q.k + ':' + SALE_Q.sale;
  const go = async () => {
    busy = true; const rb = document.querySelector('.sp-ref'); if (rb) rb.classList.add('spin');
    try {
      const q = { k: SALE_Q.k, sale: SALE_Q.sale }, d = mode() === 'sheet' ? await Remote.call('saleView', q) : await Demo.saleView(q);
      if (d && d.rt) ibStart(d.rt);
      try { LS.set(ck, d); } catch (e) {}
      busy = false; draw(d);
    } catch (e) { busy = false; if (/ลิงก์นี้ใช้ไม่ได้/.test(e.message) && LS.get('saleKey', '') === SALE_Q.k) LS.del('saleKey'); if (!last) draw(null, e.message); else { draw(last); toast('อัปเดตไม่สำเร็จ: ' + e.message, true); } }
  };
  if (mode() === 'sheet') ibStart(LS.get('rtpub', null));
  const cached = LS.get(ck, null);
  draw(cached && cached.jobs ? cached : null); go(); setInterval(go, 60000);
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('[data-sale-refresh],[data-spst],[data-spclear],[data-spprod],[data-sfview],[data-sfstep],[data-sfopen]'); if (!c) return;
    if (c.dataset.sfview) { SF.v = c.dataset.sfview; SF.anim = true; LS.set('saleView', SF.v); return draw(last, lastErr); }
    if (c.dataset.sfstep) { SF.step = SF.step === c.dataset.sfstep && c.dataset.sfstep !== 'all' ? 'all' : c.dataset.sfstep; SF.anim = true; return draw(last, lastErr); }
    if (c.dataset.sfopen) { const k = c.dataset.sfopen; SF.open[k] = !SF.open[k]; return draw(last, lastErr); }
    if (c.dataset.spprod) { F.prod = F.prod === c.dataset.spprod ? '' : c.dataset.spprod; return draw(last, lastErr); }
    if (c.dataset.saleRefresh) return go();
    if (c.dataset.spst) { F.st = F.st === c.dataset.spst ? 'all' : c.dataset.spst; return draw(last, lastErr); }
    if (c.dataset.spclear) { Object.assign(F, { st: 'all', status: '', sale: '', group: '', type: '', range: '', who: '', help: '', prod: '' }); q = ''; return draw(last, lastErr); }
  });
  document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.sfsale) { SF.sale = e.target.value; SF.anim = true; return draw(last, lastErr); } const k = e.target && e.target.dataset && e.target.dataset.spf; if (k) { F[k] = e.target.value; draw(last, lastErr); } });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'sfQ') { SF.q = e.target.value; const pos = e.target.selectionStart; draw(last, lastErr); const el = $('#sfQ'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} } } });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'spQ') { q = e.target.value; const pos = e.target.selectionStart; draw(last, lastErr); const el = $('#spQ'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} } } });
}
function saleLinkUrl(key, sale) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('salek', key); if (sale) u.searchParams.set('sale', sale); return u.toString(); }

/* ============ messages, help requests & notifications ============ */
const MSG_IC = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.4-7.5c.8-.4.8-1.5 0-1.8L3.4 3.6c-.7-.3-1.4.3-1.2 1l1.7 6.1 9.1 1.3-9.1 1.3-1.7 6.1c-.2.7.5 1.3 1.2 1z"/></svg>',
  sos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4l11 4V6z"/><path d="M15 9.5a3 3 0 0 1 0 5M7 14.5l1 4.5h3l-1-3.6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L2.7 15.5a1.5 1.5 0 0 1 2.3-1.9L8 16"/></svg>'
};
const HELP_TOPICS = ['ช่วยดูแบบ / ตรวจไฟล์', 'ช่วยทำ CAM', 'ช่วยเขียนแบบ', 'งานด่วน ต้องการคนช่วย', 'สอบถามข้อมูลงาน'];
const M = { list: [], since: '', loaded: false, open: false, ch: 'team', help: false, helpTo: 'team', jobId: '', timer: null, seen: {}, sending: false };
const msgMine = m => m.from === S.me && !m.fromAdmin || (isAdmin() && m.from === S.me);
function chanOf(m) {
  if (m.to === 'team') return 'team';
  if (isAdmin()) { if (m.to === 'admin') return 'u:' + m.from; return 'u:' + (m.from === S.me ? m.to : m.from); }
  if (m.fromAdmin || m.to === 'admin') return 'admin';
  return 'u:' + (m.from === S.me ? m.to : m.from);
}
function chanList() {
  const out = [{ id: 'team', name: 'ทั้งทีม', icon: MSG_IC.team }];
  if (!isAdmin()) out.push({ id: 'admin', name: ADMIN_LABEL, icon: MSG_IC.shield });
  members().filter(u => u.name !== S.me && (isAdmin() || u.role !== 'admin')).forEach(u => out.push({ id: 'u:' + u.name, name: u.name, user: u }));
  return out;
}
const chanTo = ch => ch === 'team' ? 'team' : ch === 'admin' ? 'admin' : ch.slice(2);
const unreadIn = ch => M.list.filter(m => !m.read && chanOf(m) === ch).length;
const unreadAll = () => M.list.filter(m => !m.read).length;
const openHelps = () => M.list.filter(m => m.kind === 'help' && m.status === 'open' && m.from !== S.me);

async function pollMessages(first) {
  if (S.screen !== 'app' || !S.user || M.polling) return;
  M.polling = true;
  try {
    const r = await api().messages({ since: M.since, stamp: M.loaded ? M.stamp : '' });
    if (r.same) { M.polling = false; return; }
    if (r.stamp) M.stamp = r.stamp;
    const fresh = [];
    (r.messages || []).forEach(m => {
      const i = M.list.findIndex(x => x.id === m.id);
      const pi = i < 0 ? M.list.findIndex(x => x.pending && x.text === m.text && x.to === m.to) : -1;
      if (pi >= 0) { M.list[pi] = m; M.seen[m.id] = 1; return; }
      if (i >= 0) M.list[i] = Object.assign(M.list[i], m); else { M.list.push(m); if (M.loaded && !m.read && !M.seen[m.id]) fresh.push(m); }
      M.seen[m.id] = 1;
    });
    if (Array.isArray(r.ids)) { const keep = {}; r.ids.forEach(id => { keep[id] = 1; }); M.list = M.list.filter(m => keep[m.id] || m.pending); }
    M.list.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (r.serverTime) M.since = r.serverTime;
    M.loaded = true;
    const sig = M.list.map(m => m.id + (m.read ? 1 : 0) + m.status).join('|');
    fresh.forEach(notifyMsg);
    if (M.open) { renderMsgPanel(); markChanRead(M.ch); }
    if (sig !== M.sig) { M.sig = sig; if (!first && !S.edit && !S.lb) render(); else { renderMsgFab(); if (S.screen === 'app') { $('#nav').innerHTML = navHtml(true); $('#tabbar').innerHTML = navHtml(true); } } } else renderMsgFab();
    fresh.forEach(m => peekHead(m));
  } catch (e) { /* offline: try again next tick */ }
  M.polling = false;
}
function startMsgPolling() {
  if (M.timer) return;
  M.list = []; M.since = ''; M.loaded = false; M.seen = {}; M.stamp = '';
  pollMessages(true); rtcLoop(); pushBoot();
  if (/#msg$/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} setTimeout(() => openMsgPanel(), 800); }
  M.timer = setInterval(() => { if (document.visibilityState === 'visible' || 'Notification' in window && Notification.permission === 'granted') pollMessages(); }, 20000);
}
function stopMsgPolling() { roomLeave(true); rtcStop(); clearInterval(M.timer); M.timer = null; M.list = []; M.open = false; const p = $('#msgPanel'); if (p) p.classList.remove('open'); renderMsgFab(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && M.timer) pollMessages(); });

async function markChanRead(ch) {
  const ids = M.list.filter(m => !m.read && chanOf(m) === ch).map(m => m.id);
  if (!ids.length) return;
  M.list.forEach(m => { if (ids.indexOf(m.id) >= 0) m.read = true; });
  renderMsgFab(); if (S.screen === 'app') { $('#nav').innerHTML = navHtml(true); $('#tabbar').innerHTML = navHtml(true); }
  try { await api().markRead({ ids: ids }); } catch (e) {}
}

/* floating launcher */
/* ตัวเลขข้อความที่ยังไม่อ่าน บนไอคอนแอป (ทาสก์บาร์คอม / หน้าจอโฮมมือถือ) และบนชื่อแท็บ */
let lastBadge = -1;
function appBadge(n) {
  n = Math.max(0, n | 0);
  if (n !== lastBadge) try { lastBadge = n; if (navigator.setAppBadge) { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } } catch (e) {}
  const t = document.title.replace(/^\(\d+\+?\)\s*/, ''); document.title = (n ? '(' + (n > 99 ? '99+' : n) + ') ' : '') + t;
}
function renderMsgFab() {
  appBadge(S.screen === 'app' && S.user ? unreadAll() : 0);
  { const n = S.screen === 'app' && S.user ? unreadAll() : 0;   // ตัวเลขสีแดงบนปุ่ม "ข้อความ" (คอม + มือถือ)
    document.querySelectorAll('.top-msg').forEach(b => { let x = b.querySelector('.msg-n'); b.classList.toggle('has', n > 0);
      if (!n) { if (x) x.remove(); return; } if (!x) { x = document.createElement('b'); x.className = 'badge msg-n'; b.appendChild(x); } const t = n > 99 ? '99+' : String(n); if (x.textContent !== t) { x.textContent = t; x.classList.remove('pop'); void x.offsetWidth; x.classList.add('pop'); } }); }
  let b = $('#msgFab');
  if (b) b.remove();
  if (S.screen !== 'app' || !S.user) { renderChatHeads(); return; }
  renderChatHeads(); return;
  if (!b) { b = document.createElement('button'); b.id = 'msgFab'; b.className = 'msg-fab'; b.dataset.act = 'msgopen'; b.setAttribute('aria-label', 'ข้อความ'); document.body.appendChild(b); }
  const n = unreadAll(), h = openHelps().length;
  b.innerHTML = MSG_IC.chat + (n ? '<span class="mf-n">' + (n > 99 ? '99+' : n) + '</span>' : '') + (h ? '<span class="mf-sos" title="มีคนขอความช่วยเหลือ">' + MSG_IC.sos + '</span>' : '');
  b.classList.toggle('has', n > 0); b.classList.toggle('sos', h > 0);
  renderChatHeads();
}
// floating "chat heads": who wrote to me / who is asking for help
function headsData() {
  const by = {};
  M.list.forEach(m => {
    const mine = (m.from === S.me && !m.fromAdmin) || (isAdmin() && m.from === S.me);
    if (mine) return;
    const help = m.kind === 'help' && m.status === 'open', unread = !m.read;
    if (!help && !unread) return;
    const key = m.fromAdmin && !isAdmin() ? '__admin' : m.from;
    const h = by[key] || (by[key] = { key: key, name: m.fromAdmin && !isAdmin() ? ADMIN_LABEL : m.from, admin: m.fromAdmin && !isAdmin(), n: 0, help: false, last: m });
    if (unread) h.n++; if (help) h.help = true;
    if (String(m.ts) >= String(h.last.ts)) h.last = m;
  });
  return Object.values(by).sort((a, b) => (b.help - a.help) || String(b.last.ts).localeCompare(String(a.last.ts)));
}
function renderChatHeads() {
  let w = $('#chatHeads');
  if (S.screen !== 'app' || !S.user || M.open) { if (w) w.classList.add('hide'); if (S.screen !== 'app' && w) w.remove(); return; }
  if (!w) { w = document.createElement('div'); w.id = 'chatHeads'; w.className = 'chat-heads'; document.body.appendChild(w); }
  w.classList.remove('hide');
  const hs = headsData(), show = hs.slice(0, 4), have = {};
  w.querySelectorAll('.ch-head').forEach(el => { have[el.dataset.key] = el; });
  const keep = {};
  show.forEach((h, i) => {
    keep[h.key] = 1;
    const u = memberBy(h.name), inner = (h.admin ? '<span class="av ch-adm">' + MSG_IC.shield + '</span>' : avUser(u, '', h.name)) +
      (h.help ? '<i class="hd-sos">' + MSG_IC.sos + '</i>' : '') +
      '<span class="hd-name"><b>' + esc(h.name) + '</b><small>' + (h.help ? '🛟 ขอความช่วยเหลือ' : esc(h.last.text ? String(h.last.text).slice(0, 40) : (h.last.img ? '📷 ส่งรูปมา' : ''))) + '</small></span>' + (h.n ? '<b class="hd-n">' + h.n + '</b>' : '');
    let el = have[h.key];
    if (!el) { el = document.createElement('button'); el.className = 'ch-head enter'; el.dataset.key = h.key; setTimeout(() => el.classList.remove('enter'), 700); }
    el.dataset.head = h.last.id; el.classList.toggle('help', h.help); el.setAttribute('aria-label', h.name + (h.help ? ' ขอความช่วยเหลือ' : ' ส่งข้อความ'));
    el.innerHTML = inner; el.style.setProperty('--i', i);
    w.appendChild(el);
  });
  Object.keys(have).forEach(k => { if (!keep[k]) { have[k].classList.add('leave'); setTimeout(() => have[k].remove(), 300); } });
  let more = w.querySelector('.ch-more');
  if (hs.length > 4) { if (!more) { more = document.createElement('button'); more.className = 'ch-more'; more.dataset.act = 'msgopen'; } more.textContent = '+' + (hs.length - 4); w.appendChild(more); } else if (more) more.remove();
}
function peekHead(m) {
  const key = m.fromAdmin && !isAdmin() ? '__admin' : m.from, el = document.querySelector('.ch-head[data-key="' + CSS.escape(key) + '"]');
  if (!el) return; el.classList.remove('peek', 'bump'); void el.offsetWidth; el.classList.add('peek', 'bump'); setTimeout(() => el.classList.remove('peek'), 4500);
}

/* side panel */
function openMsgPanel(ch, opts) {
  M.open = true; renderChatHeads(); if (ch) M.ch = ch;
  if (opts && opts.help) { M.help = true; M.jobId = opts.jobId || ''; M.helpTo = opts.to || 'team'; }
  hideHover(); renderMsgPanel(); markChanRead(M.ch);
  requestAnimationFrame(() => { $('#msgPanel').classList.add('open'); const t = $('#msgText'); if (t && matchMedia('(pointer:fine)').matches) t.focus(); });
}
/* คลิกพื้นที่นอกกล่องข้อความ → ซ่อนกล่อง (ยกเว้นหน้าต่างที่เปิดจากในแชท เช่น ดูรูป สายโทร แชร์จอ) */
document.addEventListener('mousedown', e => {
  if (!M.open) return; const p = $('#msgPanel'), t = e.target;
  if (!p || !t || !t.closest || p.contains(t)) return;
  if (t.closest('#imgView, #lightbox, #hovercard, #rtcModal, #rtcView, #rtcHost, #rtcCall, #roomView, .rtc-peek, .toast, #chatHeads, [data-act="msgopen"], .modal, #sheet, #pModal, .ntf')) return;
  closeMsgPanel();
}, true);
function closeMsgPanel() { M.open = false; M.help = false; const p = $('#msgPanel'); if (p) p.classList.remove('open'); renderChatHeads(); }
function msgTime(ts) { const t = String(ts); return t.slice(0, 10) === today() ? t.slice(11, 16) : fd(t.slice(0, 10)) + ' ' + t.slice(11, 16); }
function helpCard(m) {
  const mine = m.from === S.me && !m.fromAdmin || (isAdmin() && m.from === S.me), j = m.jobId ? jobById(m.jobId) : null;
  const st = m.status || 'open';
  const lab = st === 'open' ? 'รอคนช่วย' : st === 'taken' ? (m.helper ? m.helper + ' กำลังช่วย' : 'มีคนรับช่วยแล้ว') : 'เรียบร้อยแล้ว';
  const canTake = st === 'open' && !mine, canClose = st !== 'done' && (mine || isAdmin() || m.helper === S.me);
  return '<div class="help-card hc-' + st + '">' + (isAdmin() ? '<button class="bub-del" data-msgdel="' + esc(m.id) + '" title="ลบคำขอนี้">' + I.trash + '</button>' : '') + '<div class="hc-top"><span class="hc-ic">' + MSG_IC.sos + '</span><div><b>' + (mine ? 'คุณขอความช่วยเหลือ' : esc(m.from) + ' ขอความช่วยเหลือ') + '</b><small>' + (m.to === 'team' ? 'ถึงทั้งทีม' : m.to === 'admin' ? 'ถึง' + ADMIN_LABEL : 'ถึง ' + esc(m.to)) + ' · ' + msgTime(m.ts) + '</small></div><span class="hc-st">' + lab + '</span></div>' +
    '<p>' + esc(m.text) + '</p>' + (j ? '<button class="hc-job" data-open="' + esc(j.id) + '">' + stBadge(j) + '<b class="mono">' + esc(j.code) + '</b><small>' + esc(j.title || '') + '</small></button>' : '') +
    (canTake || canClose ? '<div class="hc-act">' + (canTake ? '<button class="btn sm primary" data-helptake="' + esc(m.id) + '">' + MSG_IC.hand + 'ฉันช่วยได้</button>' : '') + (canClose ? '<button class="btn sm" data-helpdone="' + esc(m.id) + '">' + STI.done + 'ปิดคำขอ</button>' : '') + '</div>' : '') + '</div>';
}
const EMO = [
  ['😀', 'หน้า', '😀😁😂🤣😊😍🥰😘😎🤩🥳😅😆😉🙂🙃😇🤔🤨😐😑😶🙄😏😴😪😮😲😳🥺😢😭😤😡🤯😱😬🤗🤭🫡🤐😷🤒🤕😵‍💫🥱'],
  ['👍', 'มือ', '👍👎👌✌️🤞🤟🤘👏🙌🙏💪👋🤝✍️👉👈👆👇☝️✋🫶❤️🧡💛💚💙💜🖤💯'],
  ['🛠️', 'งาน', '✅☑️❌⭕⚠️⛔🚫🔥⚡⏰⏳⌛📅📌📍📎📐📏✏️🖊️📝📋📁📂🗂️📦🚚🏭🏗️🔧🔨🛠️⚙️🪚🔩🧰💻🖥️🖨️📷🎨🧱🪵💡🔍📞💬📢🎯🏆🎉🚀'],
  ['☕', 'อื่นๆ', '☕🍵🍜🍚🍕🍔🍰🍺🥤🌞🌧️⛈️🌈⭐✨🌙🎂🎁🐻🐼🐶🐱🍀🌸']
];
const emoSplit = str => (typeof Intl !== 'undefined' && Intl.Segmenter) ? Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(str), x => x.segment) : Array.from(str.match(/\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*|./gu) || []);
function emoRecent() { const r = LS.get('emoRecent', []); return Array.isArray(r) ? r.slice(0, 16) : []; }
function emoPopHtml() {
  const tab = M.emoTab || (emoRecent().length ? 'recent' : '0');
  const list = tab === 'recent' ? emoRecent() : emoSplit(EMO[+tab][2]);
  return '<div class="emo-tabs">' + (emoRecent().length ? '<button type="button" data-emotab="recent" aria-pressed="' + (tab === 'recent') + '" title="ใช้ล่าสุด">🕘</button>' : '') +
    EMO.map((c, i) => '<button type="button" data-emotab="' + i + '" aria-pressed="' + (tab === String(i)) + '" title="' + c[1] + '">' + c[0] + '</button>').join('') + '</div>' +
    '<div class="emo-grid">' + list.map(x => '<button type="button" data-emo="' + esc(x) + '">' + x + '</button>').join('') + '</div>';
}
function emoInsert(ch) {
  const t = $('#msgText'); if (!t) return;
  const a = t.selectionStart != null ? t.selectionStart : t.value.length, b = t.selectionEnd != null ? t.selectionEnd : a;
  t.value = t.value.slice(0, a) + ch + t.value.slice(b); const pos = a + ch.length;
  t.focus(); try { t.setSelectionRange(pos, pos); } catch (x) {}
  t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px';
  LS.set('emoRecent', [ch].concat(emoRecent().filter(x => x !== ch)).slice(0, 16));
}
function emoToggle(force) {
  const pop = $('#emoPop'); if (!pop) return;
  M.emoji = force != null ? force : !M.emoji;
  if (M.emoji) pop.innerHTML = emoPopHtml();
  pop.hidden = !M.emoji; const b = $('#emoBtn'); if (b) b.setAttribute('aria-pressed', M.emoji);
}
function renderMsgPanel() {
  const oldT = $('#msgText'), draft = oldT ? { v: oldT.value, a: oldT.selectionStart, b: oldT.selectionEnd, f: document.activeElement === oldT } : null;
  let p = $('#msgPanel');
  if (!p) { p = document.createElement('aside'); p.id = 'msgPanel'; p.className = 'msg-panel'; p.setAttribute('aria-label', 'ข้อความ'); document.body.appendChild(p); }
  const chans = chanList(); if (!chans.some(c => c.id === M.ch)) M.ch = 'team';
  p.style.setProperty('--mp-w', Math.min(560, 420 + Math.max(0, chans.length - 5) * 28) + 'px');   // คนเยอะ กล่องกว้างขึ้นเอง (ที่เหลือขึ้นบรรทัดใหม่)
  const cur = chans.find(c => c.id === M.ch);
  const list = M.list.filter(m => chanOf(m) === M.ch);
  const helps = openHelps();
  let lastDay = '';
  const body = list.length ? list.map(m => {
    const day = String(m.ts).slice(0, 10), sep = day !== lastDay ? '<div class="mp-day"><span>' + (day === today() ? 'วันนี้' : fdY(day)) + '</span></div>' : ''; lastDay = day;
    if (m.kind === 'help') return sep + helpCard(m);
    const mine = (m.from === S.me && !m.fromAdmin) || (isAdmin() && m.from === S.me);
    return sep + '<div class="bub' + (mine ? ' me' : '') + (m.pending ? ' pending' : '') + '">' + (isAdmin() ? '<button class="bub-del" data-msgdel="' + esc(m.id) + '" title="ลบข้อความนี้">' + I.trash + '</button>' : '') + (mine ? '' : (m.fromAdmin && !isAdmin() ? '<span class="av bub-av adm">' + MSG_IC.shield + '</span>' : av(m.from, 'bub-av'))) +
      '<div class="bub-b">' + (mine || M.ch !== 'team' ? '' : '<small class="bub-n">' + esc(m.from) + '</small>') + msgImg(m) + (m.text ? '<p>' + esc(m.text).replace(/\n/g, '<br>') + '</p>' : '') + (m.jobId && jobById(m.jobId) ? '<button class="bub-job" data-open="' + esc(m.jobId) + '">' + esc(jobById(m.jobId).code) + '</button>' : '') + '<time>' + msgTime(m.ts) + '</time></div></div>';
  }).join('') : '<div class="mp-empty"><span class="e-ic">' + MSG_IC.chat + '</span><b>ยังไม่มีข้อความ</b><small>' + (M.ch === 'team' ? 'ส่งข้อความถึงทุกคนในทีมได้ที่นี่' : 'เริ่มคุยกับ ' + esc(cur.name)) + '</small></div>';
  const helpForm = M.help ? '<div class="mp-help"><div class="mp-help-h"><span class="hc-ic">' + MSG_IC.sos + '</span><b>ขอความช่วยเหลือ</b><button class="icon-btn sm" data-act="helpoff" aria-label="ยกเลิก">✕</button></div>' +
      '<div class="seg"><button data-helpto="team" aria-pressed="' + (M.helpTo === 'team') + '">' + MSG_IC.team + 'ทั้งทีม</button>' + (!isAdmin() ? '<button data-helpto="admin" aria-pressed="' + (M.helpTo === 'admin') + '">' + MSG_IC.shield + ADMIN_LABEL + '</button>' : '') + '</div>' +
      '<select id="helpTopic" class="sel mp-topic"><option value="">เลือกเรื่องที่ต้องการให้ช่วย…</option>' + HELP_TOPICS.map(t => '<option>' + esc(t) + '</option>').join('') + '</select>' +
      (M.jobId && jobById(M.jobId) ? '<div class="mp-jobchip">' + stBadge(jobById(M.jobId)) + '<span>แนบงาน <b class="mono">' + esc(jobById(M.jobId).code) + '</b></span><button type="button" class="icon-btn sm" data-act="helpnojob" aria-label="ไม่แนบงาน">✕</button></div>' : '') +
      '</div>' : '';
  p.innerHTML = '<div class="mp-head"><span class="mp-hic">' + MSG_IC.chat + '</span><div><b>ข้อความ</b><small>' + (helps.length ? helps.length + ' คำขอความช่วยเหลือรออยู่' : 'คุยกับทีมและ' + ADMIN_LABEL) + '</small></div>' +
      ('Notification' in window && Notification.permission === 'default' ? '<button class="icon-btn" data-act="notifyperm" title="เปิดแจ้งเตือนบนเครื่องนี้">' + MSG_IC.bell + '</button>' : '') +
      (isAdmin() && M.list.some(m => chanOf(m) === M.ch) ? '<button class="icon-btn" data-act="msgclear" title="ล้างประวัติห้องนี้">' + I.trash + '</button>' : '') +
      '<button class="icon-btn mp-snd' + (msgSoundOn() ? '' : ' off') + '" data-act="msgsound" title="' + (msgSoundOn() ? 'ปิดเสียง/สั่นแจ้งเตือนข้อความ' : 'เปิดเสียง/สั่นแจ้งเตือนข้อความ') + '" aria-pressed="' + msgSoundOn() + '">' + (msgSoundOn() ? RTC_IC.spk : RTC_IC.spkOff) + '</button>' +
      '<button class="icon-btn" data-act="msgclose" aria-label="ปิด">✕</button></div>' +
    (M.confirmClear ? '<div class="mp-confirm"><span>' + I.trash + 'ลบข้อความทั้งหมดในห้อง <b>' + esc(cur.name) + '</b> (' + M.list.filter(m => chanOf(m) === M.ch).length + ' ข้อความ)? ย้อนกลับไม่ได้</span><button class="btn sm danger" data-act="msgclearyes">ลบทั้งหมด</button><button class="btn sm" data-act="msgclearno">ยกเลิก</button></div>' : '') +
    '<div class="mp-chans" data-n="' + chans.length + '">' + chans.map(c => { const n = unreadIn(c.id); return '<button class="mp-ch' + (c.id === M.ch ? ' on' : '') + '" data-ch="' + esc(c.id) + '">' + (c.user ? avUser(c.user) : '<span class="av ch-ic">' + c.icon + '</span>') + '<span>' + esc(c.name) + '</span>' + (n ? '<b>' + n + '</b>' : '') + '</button>'; }).join('') + '</div>' +
    rtcStrip() +
    (helps.length && M.ch !== 'team' ? '<button class="mp-sosbar" data-ch="team">' + MSG_IC.sos + helps.length + ' คำขอความช่วยเหลือรอคนช่วย · ดู</button>' : '') +
    '<div class="mp-body" id="mpBody">' + body + '</div>' +
    '<form class="mp-compose' + (M.help ? ' helping' : '') + '" id="msgForm">' + helpForm +
      '<div class="emo-pop" id="emoPop"' + (M.emoji ? '' : ' hidden') + '>' + (M.emoji ? emoPopHtml() : '') + '</div>' +
      (M.att ? '<div class="mp-att"><img alt="" src="' + M.att.data + '"><div><b>' + STI.camera + 'รูปที่จะส่ง</b><small>พิมพ์ข้อความเพิ่มได้ แล้วกด Enter หรือปุ่มส่ง</small></div><button type="button" class="icon-btn" data-act="msgattdel" aria-label="เอารูปออก">✕</button></div>' : '') +
      '<div class="mp-row">' + (M.help ? '' : '<button type="button" class="mp-sos-btn" data-act="helpon" title="ขอความช่วยเหลือ">' + MSG_IC.sos + '<span>ขอช่วย</span></button>') +
      '<label class="mp-att-btn" title="แนบรูป (หรือกด Print Screen แล้ว Ctrl+V ในช่องพิมพ์)" aria-label="แนบรูป">' + STI.camera + '<input type="file" id="msgImg" accept="image/*" hidden></label>' +
      '<button type="button" class="mp-emo-btn" id="emoBtn" data-act="emoji" title="ใส่อีโมจิ" aria-label="ใส่อีโมจิ" aria-pressed="' + !!M.emoji + '">😊</button>' +
      '<textarea id="msgText" rows="1" autocomplete="off" maxlength="1000" placeholder="' + (M.help ? 'บอกว่าอยากให้ช่วยอะไร… (Ctrl+V วางรูปได้)' : 'พิมพ์ถึง ' + esc(cur.name) + '… (Ctrl+V วางรูปได้)') + '"></textarea>' +
      '<button type="submit" class="mp-send' + (M.help ? ' sos' : '') + '" aria-label="ส่ง"' + (M.sending ? ' disabled' : '') + '>' + MSG_IC.send + '</button></div></form>';
  const b = $('#mpBody'); if (b) b.scrollTop = b.scrollHeight;
  const nt = $('#msgText');
  if (nt && draft && draft.v) { nt.value = draft.v; nt.style.height = 'auto'; nt.style.height = Math.min(140, nt.scrollHeight) + 'px'; if (draft.f) { nt.focus(); try { nt.setSelectionRange(draft.a, draft.b); } catch (x) {} } }
}
/* รูปในแชท: Print Screen → Ctrl+V ในกล่องข้อความ, ลากรูปมาวาง หรือกดปุ่มกล้อง */
const MSGIMG = {};
function msgImg(m) {
  const src = m.imgLocal || (m.img ? (MSGIMG[m.img] || (/^data:/.test(m.img) ? m.img : driveImg(m.img, 900))) : '');
  if (!src) return '';
  const full = m.imgLocal || (m.img ? (/^data:/.test(m.img) ? m.img : driveImg(m.img, 2400)) : '');
  return '<button type="button" class="bub-img" data-imgview="' + esc(full) + '" aria-label="ดูรูปเต็ม"><img alt="รูปที่ส่งมา" loading="lazy" referrerpolicy="no-referrer" src="' + esc(src) + '" onerror="if(!this.dataset.r&&' + (m.img && !/^data:/.test(m.img) ? 1 : 0) + '){this.dataset.r=1;this.src=\'https://lh3.googleusercontent.com/d/' + esc(m.img || '') + '=w900\'}"></button>';
}
async function msgAttach(file) {
  if (!file || !/^image\//.test(file.type)) return toast('แนบได้เฉพาะไฟล์รูป', true);
  try { const data = await shrinkImage(file, 1800, 340000, 0.85); M.att = { data: data }; if (M.open) renderMsgPanel(); const t = $('#msgText'); if (t) t.focus(); }
  catch (e) { toast(e.message || 'อ่านรูปไม่ได้', true); }
}
function imgView(src) {
  let v = $('#imgView'); if (!v) { v = document.createElement('div'); v.id = 'imgView'; v.className = 'img-view'; v.setAttribute('role', 'dialog'); document.body.appendChild(v); }
  v.innerHTML = '<img alt="" referrerpolicy="no-referrer" src="' + esc(src) + '"><button type="button" class="lb-btn" data-imgclose="1" aria-label="ปิด">✕</button><a class="iv-open" href="' + esc(src) + '" target="_blank" rel="noopener">เปิดในแท็บใหม่</a>';
  v.classList.add('open');
}
document.addEventListener('click', e => {
  const iv = e.target.closest && e.target.closest('[data-imgview]'); if (iv) { e.preventDefault(); e.stopPropagation(); imgView(iv.dataset.imgview); return; }
  const v = $('#imgView'); if (v && v.classList.contains('open') && (e.target === v || (e.target.closest && e.target.closest('[data-imgclose]')))) { v.classList.remove('open'); }
}, true);
document.addEventListener('keydown', e => { const v = $('#imgView'); if (e.key === 'Escape' && v && v.classList.contains('open')) { v.classList.remove('open'); e.stopPropagation(); } }, true);
document.addEventListener('paste', e => {
  if (!M.open) return; const p = $('#msgPanel'); if (!p || !(p.contains(e.target) || p.contains(document.activeElement))) return;
  const f = Array.from((e.clipboardData && e.clipboardData.files) || []).find(x => /^image\//.test(x.type));
  if (!f) return; e.preventDefault(); msgAttach(f);
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'msgImg') { const f = (e.target.files || [])[0]; if (f) msgAttach(f); } });
document.addEventListener('dragover', e => { const p = $('#msgPanel'); if (M.open && p && p.contains(e.target) && e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); p.classList.add('drop'); } });
document.addEventListener('dragleave', e => { const p = $('#msgPanel'); if (p && !p.contains(e.relatedTarget)) p.classList.remove('drop'); });
document.addEventListener('drop', e => { const p = $('#msgPanel'); if (!M.open || !p || !p.contains(e.target)) return; p.classList.remove('drop'); const f = Array.from((e.dataTransfer && e.dataTransfer.files) || []).find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); msgAttach(f); } });
async function sendMsg() {
  const t = $('#msgText'); if (!t || M.sending) return;
  const text = t.value.trim(), att = M.att; if (!text && !att) { t.focus(); return; }
  const p = M.help ? { to: M.helpTo, kind: 'help', text: text, jobId: M.jobId || '' } : { to: chanTo(M.ch), kind: 'msg', text: text };
  if (att) p.img = att.data;
  if (!M.help && text) histPush('msg', text);
  suggClose();
  if (!M.help) {   // ข้อความธรรมดา: ขึ้นในห้องแชททันที แล้วส่งเบื้องหลัง
    const d = new Date(), tmp = { id: uid('tmp_'), ts: isoOf(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()), from: S.me, to: p.to, kind: 'msg', text: text, jobId: '', status: '', helper: '', read: true, pending: true, imgLocal: att ? att.data : '' };
    M.list.push(tmp); M.seen[tmp.id] = 1; t.value = ''; M.att = null; t.style.height = 'auto'; M.emoji = false; renderMsgPanel();
    api().sendMessage(p).then(r => {
      const i = M.list.findIndex(x => x.id === tmp.id);
      if (att && r.message.img) MSGIMG[r.message.img] = att.data;   // รูปของเราเอง: โชว์จากเครื่องทันที ไม่ต้องรอโหลดจาก Drive
      if (M.list.some(x => x.id === r.message.id)) { if (i >= 0) M.list.splice(i, 1); } else if (i >= 0) M.list[i] = r.message; else M.list.push(r.message);
      M.seen[r.message.id] = 1; if (M.open) renderMsgPanel(); renderMsgFab();
    }).catch(e => {
      M.list = M.list.filter(x => x.id !== tmp.id); toast('ส่งข้อความไม่สำเร็จ: ' + e.message, true);
      if (att && !M.att) M.att = att;
      if (M.open) { renderMsgPanel(); const c = $('#msgText'); if (c && !c.value) c.value = text; }
    });
    return;
  }
  M.sending = true;
  try {
    const r = await api().sendMessage(p);
    M.list.push(r.message); M.seen[r.message.id] = 1; t.value = ''; { const c = $('#msgText'); if (c) c.value = ''; } M.emoji = false; M.att = null;
    if (M.help) { M.ch = chanOf(r.message); M.help = false; M.jobId = ''; toast('ส่งคำขอความช่วยเหลือแล้ว'); }
    M.sending = false; renderMsgPanel(); renderMsgFab();
  } catch (e) { M.sending = false; toast(e.message, true); }
}
async function delMsgs(ids, okText) {
  if (!ids.length) return;
  try { await api().deleteMessages({ ids: ids }); M.list = M.list.filter(m => ids.indexOf(m.id) < 0); toast(okText); renderMsgPanel(); renderMsgFab(); if (S.screen === 'app') render(); }
  catch (e) { toast(e.message, true); }
}
async function helpUpdate(id, status) {
  try {
    const r = await api().helpUpdate({ id: id, status: status });
    const i = M.list.findIndex(x => x.id === id); if (i >= 0) M.list[i] = Object.assign(M.list[i], r.message);
    if (r.note) { M.list.push(r.note); M.seen[r.note.id] = 1; }
    toast(status === 'taken' ? 'รับช่วยแล้ว ทีมจะเห็นว่าคุณกำลังช่วย' : 'ปิดคำขอแล้ว');
    if (M.open) renderMsgPanel(); renderMsgFab(); dropNotice(id);
  } catch (e) { toast(e.message, true); }
}

/* pop-up notifications that slide in from the side */
function notifyMsg(m) {
  let stack = $('#ntfStack'); if (!stack) { stack = document.createElement('div'); stack.id = 'ntfStack'; stack.className = 'ntf-stack'; document.body.appendChild(stack); }
  if (M.open && chanOf(m) === M.ch && m.kind !== 'help') return;
  const help = m.kind === 'help', who = m.fromAdmin && !isAdmin() ? ADMIN_LABEL : m.from;
  const el = document.createElement('div'); el.className = 'ntf' + (help ? ' help' : ''); el.dataset.mid = m.id;
  el.innerHTML = '<span class="ntf-ic">' + (help ? MSG_IC.sos : m.fromAdmin && !isAdmin() ? MSG_IC.shield : MSG_IC.chat) + '</span>' +
    '<div class="ntf-b"><b>' + (help ? esc(who) + ' ขอความช่วยเหลือ' : esc(who) + (m.to === 'team' ? ' ถึงทั้งทีม' : '')) + '</b><p>' + esc(m.text) + '</p>' +
    '<div class="ntf-act">' + (help ? '<button class="btn sm primary" data-helptake="' + esc(m.id) + '">' + MSG_IC.hand + 'ฉันช่วยได้</button>' : '') + '<button class="btn sm" data-ntfopen="' + esc(chanOf(m)) + '">' + (help ? 'ดูรายละเอียด' : 'ตอบกลับ') + '</button></div></div>' +
    '<button class="ntf-x" data-ntfx="1" aria-label="ปิด">✕</button><i class="ntf-bar"></i>';
  stack.prepend(el);
  requestAnimationFrame(() => el.classList.add('in'));
  while (stack.children.length > 4) stack.lastChild.remove();
  setTimeout(() => dismissNtf(el), help ? 15000 : 7000);
  if (msgSoundOn()) msgBuzz(help);
  ping(help);
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    sysNotify(help ? '🛟 ' + who + ' ขอความช่วยเหลือ' : '💬 ' + who + (m.to === 'team' ? ' ถึงทั้งทีม' : ''), m.text || (m.img ? '📷 ส่งรูปมา' : ''), 'kiwngan-' + (help ? 'sos' : 'msg') + '-' + m.from, () => openMsgPanel(chanOf(m)));
  }
}
/* แจ้งเตือนงาน: มอบหมายให้ / ถูกส่งกลับไปแก้ / ใกล้ถึงกำหนด */
function jobNotify(kind, title, body, jobId) {
  let stack = $('#ntfStack'); if (!stack) { stack = document.createElement('div'); stack.id = 'ntfStack'; stack.className = 'ntf-stack'; document.body.appendChild(stack); }
  const ic = kind === 'fix' ? STI.fix : kind === 'due' ? STI.hourglass : STI.layers;
  const el = document.createElement('div'); el.className = 'ntf job-' + kind;
  el.innerHTML = '<span class="ntf-ic">' + ic + '</span><div class="ntf-b"><b>' + esc(title) + '</b><p>' + esc(body) + '</p>' +
    (jobId ? '<div class="ntf-act"><button class="btn sm primary" data-open="' + esc(jobId) + '">เปิดงาน</button></div>' : '') + '</div>' +
    '<button class="ntf-x" data-ntfx="1" aria-label="ปิด">✕</button><i class="ntf-bar"></i>';
  stack.prepend(el); requestAnimationFrame(() => el.classList.add('in'));
  while (stack.children.length > 4) stack.lastChild.remove();
  setTimeout(() => dismissNtf(el), 12000); ping(kind !== 'due');
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    try { const n = new Notification(title, { body: body, tag: 'job-' + kind + (jobId || ''), icon: 'icons/icon-192.png' }); n.onclick = () => { window.focus(); if (jobId) openEditor(jobId); }; } catch (e) {}
  }
}
function jobAlerts(prev) {
  if (!S.me || S.screen !== 'app') return;
  if (prev) {
    const pm = {}; prev.forEach(j => { pm[j.id] = j; });
    S.jobs.forEach(j => {
      const p = pm[j.id], by = j.updatedBy || j.createdBy;
      if (by !== S.me && j.status !== 'done' && j.assignee !== S.me && helpersOf(j).includes(S.me) && !(p && helpersOf(p).includes(S.me))) jobNotify('assign', (by || 'มีคน') + ' ชวนคุณร่วมทำงาน · ' + j.code, [j.title, j.taskType, j.assignee ? 'ผู้รับผิดชอบ ' + j.assignee : '', j.due ? 'ส่ง ' + fd(j.due) : ''].filter(Boolean).join(' · '), j.id);
      if (j.assignee !== S.me || by === S.me || j.status === 'done') return;
      if (!p || p.assignee !== S.me) jobNotify('assign', 'งานใหม่มอบหมายให้คุณ · ' + j.code, [j.title, j.taskType, j.due ? 'ส่ง ' + fd(j.due) : ''].filter(Boolean).join(' · '), j.id);
      else if (j.status === 'fix' && p.status !== 'fix') jobNotify('fix', 'ถูกส่งกลับไปแก้ไข · ' + j.code, (by ? by + ' ส่งกลับมา' : 'ตรวจแล้วต้องแก้') + (j.note ? ' · ' + j.note : ''), j.id);
    });
  }
  dueAlerts();
}
/* เตือนงานใกล้ถึงกำหนด: เด้งค้างไว้จนกด "รับทราบ" — เลยกำหนด / ส่งวันนี้ / ส่งพรุ่งนี้
   เตือนซ้ำเมื่อระดับเปลี่ยน (พรุ่งนี้ → วันนี้ → เลยกำหนด) และย้ำงานที่ต้องส่งวันนี้อีกครั้งหลังบ่ายสอง */
const dueAhead = () => Math.max(1, Math.min(14, +LS.get('dueAhead', 2) || 2));        // เตือนล่วงหน้ากี่วัน (ตั้งในแผงกำหนดส่ง)
const dueScope = () => isLead() ? LS.get('dueScope', 'all') : 'mine';                   // หัวหน้า/แอดมิน: ดูได้ทั้งทีม
const dueJobs = () => S.jobs.filter(j => j.due && isOpen(j) && j.status !== 'hold' && (dueScope() === 'all' || inJob(j, S.me)));
function dueLevel(j) {
  const t = today();
  if (!j.due || !isOpen(j)) return '';
  if (j.due < t) return 'late';
  if (j.due === t) return new Date().getHours() >= 14 ? 'today2' : 'today';
  if (j.due === addDays(t, 1)) return 'tomorrow';
  if (j.due <= addDays(t, dueAhead())) return 'soon';
  return '';
}
const dueCount = () => dueJobs().filter(j => dueLevel(j)).length;
function dueAlerts() {
  if (!S.me || S.screen !== 'app' || !S.jobs) return;
  const key = 'dueSeen:' + S.me, seen = LS.get(key, {}) || {}, t = today(), fresh = [];
  dueJobs().forEach(j => {
    const lv = dueLevel(j); if (!lv) return;
    const tag = t + '|' + lv;
    if (seen[j.id] !== tag) fresh.push({ j: j, lv: lv });
  });
  if (!fresh.length) return;
  const all = dueJobs().filter(j => dueLevel(j)).map(j => ({ j: j, lv: dueLevel(j) }));
  const rank = { late: 0, today2: 1, today: 1, tomorrow: 2, soon: 3 };
  all.sort((a, b) => rank[a.lv] - rank[b.lv] || String(a.j.due).localeCompare(String(b.j.due)));
  dueNotify(all, fresh.length);
  all.forEach(x => { seen[x.j.id] = t + '|' + x.lv; });
  Object.keys(seen).forEach(id => { if (!all.some(x => x.j.id === id)) delete seen[id]; });
  LS.set(key, seen);
}
function dueNotify(list, nNew) {
  let stack = $('#ntfStack'); if (!stack) { stack = document.createElement('div'); stack.id = 'ntfStack'; stack.className = 'ntf-stack'; document.body.appendChild(stack); }
  stack.querySelectorAll('.ntf.job-due').forEach(e => e.remove());
  const late = list.filter(x => x.lv === 'late').length, tod = list.filter(x => x.lv === 'today' || x.lv === 'today2').length, tom = list.filter(x => x.lv === 'tomorrow').length;
  const title = late ? 'มีงานเลยกำหนด ' + late + ' งาน' : tod ? 'งานที่ต้องส่งวันนี้ ' + tod + ' งาน' : tom ? 'งานที่ต้องส่งพรุ่งนี้ ' + tom + ' งาน' : 'งานใกล้ถึงกำหนด ' + list.length + ' งาน';
  const lab = x => x.lv === 'late' ? '<em class="dl late">เลย ' + daysBetween(x.j.due, today()) + ' วัน</em>' : x.lv === 'tomorrow' ? '<em class="dl tom">พรุ่งนี้</em>' : x.lv === 'soon' ? '<em class="dl tom">' + fd(x.j.due) + '</em>' : '<em class="dl tod">วันนี้</em>';
  const who = dueScope() === 'all';
  const el = document.createElement('div'); el.className = 'ntf job-due sticky' + (late ? ' is-late' : '');
  el.innerHTML = '<span class="ntf-ic">' + STI.hourglass + '</span><div class="ntf-b"><b>' + esc(title) + '</b>' +
    '<ul class="due-list">' + list.slice(0, 6).map(x => '<li><button class="due-it" data-open="' + esc(x.j.id) + '"><span class="mono">' + esc(x.j.code) + '</span><small>' + esc((who && x.j.assignee ? x.j.assignee + ' · ' : '') + (x.j.title || x.j.taskType || '')) + '</small>' + lab(x) + '</button></li>').join('') + '</ul>' +
    (list.length > 6 ? '<p>และอีก ' + (list.length - 6) + ' งาน</p>' : '') +
    '<div class="ntf-act"><button class="btn sm primary" data-ntfx="1">รับทราบ</button><button class="btn sm" data-act="dueopen">ดูตามวันที่</button></div></div>' +
    '<button class="ntf-x" data-ntfx="1" aria-label="ปิด">✕</button>';
  stack.prepend(el); requestAnimationFrame(() => el.classList.add('in'));
  ping(true); setTimeout(() => ping(true), 380);
  const body = list.slice(0, 4).map(x => x.j.code + (x.lv === 'late' ? ' (เลยกำหนด)' : x.lv === 'tomorrow' ? ' (พรุ่งนี้)' : ' (วันนี้)')).join(', ');
  if ('Notification' in window && Notification.permission === 'granted' && (document.visibilityState !== 'visible' || !document.hasFocus())) {
    try { const n = new Notification('คิวงาน · ' + title, { body: body, tag: 'job-due', renotify: true, icon: 'icons/icon-192.png' }); n.onclick = () => { window.focus(); if (list.length === 1) openEditor(list[0].j.id); }; } catch (e) {}
  }
}
document.addEventListener('click', e => { if (e.target && e.target.id === 'duePanel') closeDue(); });
/* แผงกำหนดส่ง: เลือกวันดูได้ (แถบ 14 วัน + ปฏิทิน) */
function openDue(day) { S.dueDay = day || S.dueDay || 'soon'; document.querySelectorAll('.ntf.job-due').forEach(dismissNtf); renderDue(); }
function closeDue() { const p = $('#duePanel'); if (p) { p.classList.remove('show'); setTimeout(() => { if (!p.classList.contains('show')) p.remove(); }, 250); } }
function renderDue() {
  let p = $('#duePanel');
  if (!p) { p = document.createElement('div'); p.id = 'duePanel'; p.className = 'due-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'กำหนดส่งงาน'); document.body.appendChild(p); requestAnimationFrame(() => p.classList.add('show')); }
  const t = today(), js = dueJobs(), sel = S.dueDay || 'soon', ahead = dueAhead();
  const late = js.filter(j => j.due < t), soon = js.filter(j => j.due >= t && j.due <= addDays(t, ahead));
  const days = []; for (let i = 0; i < 14; i++) days.push(addDays(t, i));
  const cnt = d => js.filter(j => j.due === d).length;
  const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const list = sel === 'late' ? late : sel === 'soon' ? late.concat(soon) : js.filter(j => j.due === sel);
  list.sort((a, b) => String(a.due).localeCompare(String(b.due)) || String(a.code).localeCompare(String(b.code)));
  const title = sel === 'late' ? 'เลยกำหนด' : sel === 'soon' ? 'เลยกำหนด + ใกล้ถึงกำหนด (' + ahead + ' วัน)' : sel === t ? 'ส่งวันนี้ · ' + fdY(sel) : sel === addDays(t, 1) ? 'ส่งพรุ่งนี้ · ' + fdY(sel) : 'ส่งวัน' + ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'][parseLocal(sel).getDay()] + ' ' + fdY(sel);
  const item = j => {
    const d = daysBetween(t, j.due);
    const tag = d < 0 ? '<em class="dl late">เลย ' + (-d) + ' วัน</em>' : d === 0 ? '<em class="dl tod">วันนี้</em>' : d === 1 ? '<em class="dl tom">พรุ่งนี้</em>' : '<em class="dl">อีก ' + d + ' วัน</em>';
    return '<button class="due-row" data-open="' + esc(j.id) + '">' + (j.assignee ? av(j.assignee, 'sm') : '<span class="av sm">–</span>') +
      '<span class="dr-b"><span class="dr-1"><b class="mono">' + esc(j.code) + '</b>' + stPill(j) + '</span><small>' + esc([j.assignee, j.title, j.taskType].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="dr-d">' + tag + '<small>' + fd(j.due) + '</small></span></button>';
  };
  p.innerHTML = '<div class="due-card"><div class="due-h"><span class="due-ic">' + STI.hourglass + '</span><div><b>กำหนดส่งงาน</b><small>' + (dueScope() === 'all' ? 'ทั้งทีม' : 'งานของฉัน') + ' · เตือนล่วงหน้า ' + ahead + ' วัน</small></div><button class="icon-btn" data-act="dueclose" aria-label="ปิด">✕</button></div>' +
    '<div class="due-opts">' + (isLead() ? '<div class="seg sm"><button data-duescope="mine" aria-pressed="' + (dueScope() === 'mine') + '">ของฉัน</button><button data-duescope="all" aria-pressed="' + (dueScope() === 'all') + '">ทั้งทีม</button></div>' : '') +
      '<label class="due-ahead">เตือนล่วงหน้า <select data-dueahead="1">' + [1, 2, 3, 5, 7, 14].map(n => '<option value="' + n + '"' + (n === ahead ? ' selected' : '') + '>' + n + ' วัน</option>').join('') + '</select></label>' +
      '<label class="due-pick">เลือกวัน <input type="date" data-dueday="pick" value="' + (/^\d{4}/.test(sel) ? sel : '') + '"></label></div>' +
    '<div class="due-strip"><button class="dchip q' + (sel === 'soon' ? ' on' : '') + '" data-dueday="soon"><small>ต้องดู</small><b>' + (late.length + soon.length) + '</b></button>' +
      '<button class="dchip late' + (sel === 'late' ? ' on' : '') + (late.length ? '' : ' zero') + '" data-dueday="late"><small>เลยกำหนด</small><b>' + late.length + '</b></button>' +
      days.map(d => { const c = cnt(d), dd = parseLocal(d), wk = dd.getDay() === 0 || dd.getDay() === 6; return '<button class="dchip' + (sel === d ? ' on' : '') + (c ? '' : ' zero') + (wk ? ' wk' : '') + (d === t ? ' today' : '') + '" data-dueday="' + d + '"><small>' + (d === t ? 'วันนี้' : DOW[dd.getDay()]) + '</small><span>' + dd.getDate() + '</span><b>' + (c || '·') + '</b></button>'; }).join('') + '</div>' +
    '<div class="due-t">' + esc(title) + ' <em>' + list.length + ' งาน</em></div>' +
    '<div class="due-list2">' + (list.length ? list.map(item).join('') : '<div class="empty sm"><b>ไม่มีงานครบกำหนด</b>' + (sel === 'late' || sel === 'soon' ? 'ทุกงานอยู่ในกำหนด' : 'ในวันที่เลือก') + '</div>') + '</div></div>';
}
setInterval(() => { try { dueAlerts(); } catch (e) {} }, 10 * 60 * 1000);   // ข้ามวัน / เลยบ่ายสอง / เลยกำหนด ระหว่างเปิดแอปค้างไว้
function dismissNtf(el) { if (!el || !el.isConnected) return; el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 350); }
function dropNotice(mid) { document.querySelectorAll('.ntf[data-mid="' + mid + '"]').forEach(dismissNtf); }
/* เสียงแจ้งเตือนข้อความ: เบราว์เซอร์ (โดยเฉพาะมือถือ) ให้เล่นเสียงได้หลังจากแตะหน้าจอครั้งแรก จึงปลดล็อกเสียงตอนแตะครั้งแรก */
let audioCtx = null;
const msgSoundOn = () => LS.get('msgSound', 1) !== 0;
function audioUnlock() {
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioUnlock.done) { const b = audioCtx.createBuffer(1, 1, 22050), s = audioCtx.createBufferSource(); s.buffer = b; s.connect(audioCtx.destination); s.start(0); audioUnlock.done = true; } } catch (e) {}
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, audioUnlock, { passive: true }));
function ping(strong, force) {
  if (!force && !msgSoundOn()) return;
  try {
    audioUnlock();
    const t0 = audioCtx.currentTime, notes = strong ? [[784, 0], [988, .13], [1319, .26], [988, .52], [1319, .65]] : [[880, 0], [1319, .14]];
    notes.forEach(n => {   // ติ๊ง-ต่อง แบบระฆังเล็ก ดังพอได้ยินบนมือถือ
      const o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), g = audioCtx.createGain(), t = t0 + n[1];
      o.type = 'sine'; o2.type = 'triangle'; o.frequency.setValueAtTime(n[0], t); o2.frequency.setValueAtTime(n[0] * 2, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g); o2.connect(g); g.connect(audioCtx.destination); o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.6);
    });
  } catch (e) {}
}
function msgBuzz(help) { try { if (navigator.vibrate) navigator.vibrate(help ? [300, 120, 300, 120, 300] : [180, 90, 180]); } catch (e) {} }
async function sysNotify(title, body, tag, onClick) {   // Android ต้องแจ้งผ่าน service worker (new Notification ใช้ไม่ได้)
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) { await reg.showNotification(title, { body: body, tag: tag, renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [180, 90, 180], data: { url: './#msg' } }); return; }
  } catch (e) {}
  try { const n = new Notification(title, { body: body, tag: tag, icon: 'icons/icon-192.png' }); n.onclick = () => { window.focus(); if (onClick) onClick(); }; } catch (e) {}
}
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.kn === 'openmsg' && S.user) openMsgPanel(); });

/* ============ screen share & remote pointer (WebRTC, signaling via the API) ============
   ภาพหน้าจอวิ่งตรงระหว่างสองเครื่อง (peer-to-peer) — ฐานข้อมูลใช้แค่ส่งสัญญาณเริ่มต้น
   "รีโมท" = คนดูชี้/วาดบนภาพ ส่งผ่าน data channel ไปขึ้นที่เครื่องคนแชร์ (หน้าต่างลอย) — ไม่ต้องติดตั้งโปรแกรมใดๆ
   (เบราว์เซอร์ไม่ยอมให้หน้าเว็บคลิก/พิมพ์แทนบนเครื่องอื่น จึงเป็นการชี้บอก ไม่ใช่ควบคุมแทน) */
const RTC_IC = {
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><circle cx="12" cy="10" r="2.2"/><path d="M6.5 10s2-3 5.5-3 5.5 3 5.5 3-2 3-5.5 3-5.5-3-5.5-3z"/></svg>',
  cast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M12 13V7M9.5 9.5L12 7l2.5 2.5"/></svg>',
  mouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l13 6.5-5.6 1.7L10.7 17z"/><path d="M13.4 11.6l5.1 5.1"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  hang: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-3.3 0-6.3 1-8.6 2.7-.6.5-.7 1.3-.3 1.9l1.4 2c.4.6 1.2.8 1.9.4l2.3-1.3c.5-.3.8-.9.7-1.5l-.2-1.5c1.8-.6 3.8-.6 5.6 0l-.2 1.5c-.1.6.2 1.2.7 1.5l2.3 1.3c.7.4 1.5.2 1.9-.4l1.4-2c.4-.6.3-1.4-.3-1.9C18.3 10 15.3 9 12 9z"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M14 6.5l3 3"/></svg>',
  laser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7.5" opacity=".55"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h13"/><path d="M5.6 15.6l8.5-8.5a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L13 18.8a3 3 0 0 1-2.1.9H8.6a2 2 0 0 1-1.4-.6l-1.6-1.6a2 2 0 0 1 0-2.9z"/><path d="M10 11l5 5"/></svg>',
  head: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/></svg>',
  headOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v-3a8 8 0 0 1 13.4-5.9M20 12v3"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.5"/><path d="M3 3l18 18"/></svg>',
  room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5h3.5L11 5.5v13l-4.5-4H3z"/><path d="M14.5 9a4 4 0 0 1 0 6M17 6.5a7.5 7.5 0 0 1 0 11M19.5 4a11 11 0 0 1 0 16"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.4 6.4 0 0 1-.5 2.5M12 17.5V21M3 3l18 18"/></svg>',
  spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  spkOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.3-2h7l1.3 2h1.7A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="12.5" r="3.6"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2M4 20v-4h4"/></svg>',
  pip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="15" rx="2"/><rect x="12" y="11" width="7" height="5.5" rx="1" fill="currentColor" opacity=".35"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
};
const CAN_RTC = typeof RTCPeerConnection !== 'undefined';
const CAN_SHARE = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
/* หน้าต่างเลือกจอเปิดที่แท็บ "หน้าต่าง" ก่อน: แชร์เฉพาะโปรแกรมที่ทำงาน (เช่น CAD) → หน้าต่างลอย/กรอบดูของเราไม่ติดไปในภาพ ไม่บังทั้งสองฝั่ง
   ยังเลือก "ทั้งหน้าจอ" ได้ตามปกติ (ถ้าเลือก จะระบายทับตำแหน่งหน้าต่างลอยในภาพดูของเราแทน) */
const SHARE_OPTS = () => ({ video: { frameRate: { ideal: 15, max: 24 }, displaySurface: 'window' }, audio: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include' });
/* มือถือแชร์หน้าจอผ่านเว็บไม่ได้ (iOS ไม่รองรับ, Android ได้บางรุ่น) → แชร์กล้องแทน */
const CAN_CAM = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const IS_TOUCH = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const srcWord = src => src === 'camera' ? 'กล้อง' : 'หน้าจอ';
const CAN_PIP = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
const INK_COLORS = ['#FF3B5C', '#FFB020', '#22C55E', '#3B82F6'];
const RTC_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const R = { spkOff: !!LS.get('spkOff', 0), sid: '', peer: '', name: '', role: '', state: '', pc: null, stream: null, remote: null, t0: 0, loop: null, tick: null, guard: null, prompt: null, dc: null, tool: '', color: INK_COLORS[0], ink: { strokes: [], ptr: null, rips: [] }, peek: null, peekOpen: true, pip: null, rmode: false };
const rtcBusy = () => !!R.state || (typeof V !== 'undefined' && V.on);
const sigPeer = g => (g.fromAdmin && !isAdmin() ? 'admin' : g.from);
const sigName = g => (g.fromAdmin && !isAdmin() ? ADMIN_LABEL : g.from);
const peerOfCh = ch => chanTo(ch);
const peerNameOfCh = ch => ch === 'admin' ? ADMIN_LABEL : ch.slice(2);
const peerAv = (peer, name, cls) => peer === 'admin' ? '<span class="av ' + (cls || '') + ' ch-adm">' + MSG_IC.shield + '</span>' : avUser(memberBy(name), cls || '', name);

function rtcSig(to, sid, type, data) {
  if (mode() === 'demo') return Promise.resolve({});
  const id = uid('r_');
  rtSend({ k: 'sig', g: { id: id, to: to, sid: sid, type: type, from: isAdmin() ? 'admin' : S.me, fromAdmin: isAdmin(), data: data || '', ts: Date.now() } });   // ทางด่วน (ถ้ามี)
  return api().rtcSend({ id: id, to: to, sid: sid, type: type, data: data || '' }).catch(e => { toast(e.message, true); throw e; });   // ทางหลัก + แจ้งเตือนเครื่องที่ปิดแอป
}
/* รับสัญญาณครั้งเดียวต่อรหัส (คำขอสำรองอาจได้สัญญาณชุดเดียวกัน) แล้วจดไว้เพื่อยืนยันกับเซิร์ฟเวอร์รอบถัดไป */
const SIG_SEEN = {}, SIG_ACK = [];
function rtcOnSigOnce(g) {
  if (!g || !g.id) return rtcOnSig(g);
  if (SIG_ACK.indexOf(g.id) < 0) SIG_ACK.push(g.id);
  if (SIG_SEEN[g.id]) return;
  const now = Date.now(); SIG_SEEN[g.id] = now;
  Object.keys(SIG_SEEN).forEach(k => { if (now - SIG_SEEN[k] > 300000) delete SIG_SEEN[k]; });
  rtcOnSig(g);
}
function rtcLoop() {
  clearTimeout(R.loop);
  if (S.screen !== 'app' || !S.user || !CAN_RTC || mode() === 'demo') return;
  // ระหว่างต่อสาย/แชร์จอ: ขอให้เซิร์ฟเวอร์รอสัญญาณ (long-poll) ได้สัญญาณทันทีที่อีกฝ่ายส่ง · ปกติถามทุก 2.5 วิ
  const fast = R.state === 'wait' || R.state === 'connecting' || (V.on && Date.now() - V.since < 20000);
  const my = R.loopGen = (R.loopGen || 0) + 1;
  R.loop = setTimeout(async () => {
    if (document.visibilityState === 'visible' || R.state || V.on) {
      const ack = SIG_ACK.splice(0, 100);
      try { const r = await api().rtcPoll(fast ? { wait: 6000, ack: ack } : { ack: ack }); (r.signals || []).forEach(rtcOnSigOnce); if (r.room) roomOnPoll(r.room); stampCheck(r); }
      catch (e) { ack.forEach(id => { if (SIG_ACK.indexOf(id) < 0) SIG_ACK.push(id); }); /* offline: ยืนยันใหม่รอบหน้า */ }
    }
    if (R.loopGen === my) rtcLoop();
  }, fast ? 60 : R.state || V.on ? 2000 : RT.ok ? 8000 : 2500);
}
/* สัญญาณเบา ๆ ทุก 5 วิบอกว่างาน/ข้อความเปลี่ยนไหม → ดึงเฉพาะตอนมีการเปลี่ยนแปลง (อัปเดตเกือบทันที) */
function stampCheck(r) {
  if (r.ms && M.loaded && r.ms !== M.stamp) pollMessages();
  if (r.ds && S.dataStamp && r.ds !== S.dataStamp && !S.edit && !S.draftDirty && !S.loading && !S.saving) load(true);
}
function rtcStop() { clearTimeout(R.loop); R.loop = null; rtcCleanup(); closeRtcModal(); }

function rtcOnSig(g) {
  if (g.type === 'roff' || g.type === 'rans' || g.type === 'rbye') return roomOnSig(g);
  const peer = sigPeer(g), name = sigName(g), same = g.sid && g.sid === R.sid;
  switch (g.type) {
    case 'req':
      if (rtcBusy()) return void rtcSig(peer, g.sid, 'deny', { reason: 'busy' }).catch(() => {});
      return rtcPrompt(g, 'req');
    case 'offer':
      if (same && R.role === 'view' && R.state === 'wait') return void rtcAnswer(g);
      if (rtcBusy()) return void rtcSig(peer, g.sid, 'deny', { reason: 'busy' }).catch(() => {});
      return g.data && g.data.src === 'voice' ? callPrompt(g) : rtcPrompt(g, 'offer');
    case 'answer':
      if (same && R.role === 'host' && R.pc) R.pc.setRemoteDescription({ type: 'answer', sdp: g.data.sdp }).catch(() => rtcFail());
      return;
    case 'deny':
      if (R.prompt && R.prompt.sid === g.sid) closeRtcModal();
      if (!same) return;
      if (R.src === 'voice') { toast(g.data && g.data.reason === 'busy' ? name + ' ติดสายอยู่' : name + ' ไม่รับสาย', true); return rtcCleanup(); }
      toast(g.data && g.data.reason === 'busy' ? name + ' กำลังแชร์หน้าจออยู่กับคนอื่น' : g.data && g.data.reason === 'nocap' ? name + ' ใช้อุปกรณ์ที่แชร์หน้าจอหรือกล้องไม่ได้' : g.data && g.data.reason === 'timeout' ? name + ' ไม่ได้ตอบรับ' : name + ' ปฏิเสธคำขอ', true);
      return rtcCleanup();
    case 'bye':
      if (R.prompt && R.prompt.sid === g.sid) { if (R.prompt.kind === 'call') toast('สายที่ไม่ได้รับจาก ' + name, true); closeRtcModal(); }
      if (!same) return;
      toast(R.src === 'voice' ? name + ' วางสายแล้ว' : R.role === 'view' ? name + ' หยุดแชร์หน้าจอแล้ว' : name + ' ปิดหน้าจอที่ดูแล้ว');
      return rtcCleanup();
  }
}

/* ---- viewer asks to see someone's screen ---- */
function rtcRequest(peer, name, remote) {
  if (!CAN_RTC) return toast('เบราว์เซอร์นี้ไม่รองรับการดูหน้าจอ', true);
  if (rtcBusy()) return toast('กำลังแชร์หน้าจออยู่ ปิดอันเดิมก่อน', true);
  Object.assign(R, { sid: uid('s_'), peer: peer, name: name, role: 'view', state: 'wait', t0: Date.now(), rmode: !!remote, tool: remote ? 'laser' : '' });
  rtcSig(peer, R.sid, 'req', { name: S.me, mode: remote ? 'remote' : '' }).catch(() => rtcCleanup());
  rtcGuard(60000, 'timeout');
  renderRtc(); rtcLoop(); ping(false);
  if (mode() === 'demo') setTimeout(() => { if (R.state === 'wait') rtcDemoLive(); }, 2200);
}
/* ---- host shares own screen (on own initiative or after a request) ---- */
function camStream(facing) {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing || 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 20, max: 24 } }, audio: false });
}
async function rtcHost(peer, name, sid, remote, src) {
  if (!src) src = CAN_SHARE ? 'screen' : 'camera';
  if (src === 'screen' && !CAN_SHARE) src = 'camera';
  if (src === 'camera' && !CAN_CAM) { if (sid) rtcSig(peer, sid, 'deny', { reason: 'nocap' }).catch(() => {}); return toast('อุปกรณ์นี้แชร์หน้าจอหรือกล้องไม่ได้', true); }
  if (rtcBusy() && !sid) return toast('กำลังแชร์อยู่ ปิดอันเดิมก่อน', true);
  let stream, earlyP = null;
  try {
    if (src === 'screen' && !IS_TOUCH) toast('แนะนำ: เลือกแท็บ "หน้าต่าง" แล้วเลือกโปรแกรมที่ให้ดู — หน้าต่างลอยจะไม่ติดไปในภาพ');
    const sp = src === 'camera' ? camStream('environment') : navigator.mediaDevices.getDisplayMedia(SHARE_OPTS());
    /* ห้ามเปิดหน้าต่างลอยพร้อมกับหน้าต่างเลือกจอ: หน้าต่างลอยแย่งโฟกัส ทำให้หน้าต่างเลือกจอปิดเอง = "ถูกปฏิเสธ" (เจอในแอปที่ติดตั้งบนคอม)
       ให้กดปุ่ม "หน้าต่างลอย" เองหลังแชร์แล้ว */
    stream = await sp;
  }
  catch (e) {
    if (earlyP) earlyP.then(w => { if (w) try { w.close(); } catch (x) {} });
    /* Android บางรุ่นมีปุ่มแชร์จอแต่ใช้ไม่ได้จริง → เสนอกล้องแทน */
    if (src === 'screen' && IS_TOUCH && CAN_CAM && e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') { toast('มือถือเครื่องนี้แชร์หน้าจอไม่ได้ — เปลี่ยนเป็นแชร์กล้องแทน'); return rtcHost(peer, name, sid, remote, 'camera'); }
    if (sid) rtcSig(peer, sid, 'deny', { reason: 'cancel' }).catch(() => {});
    return toast(src === 'camera' ? 'เปิดกล้องไม่ได้ — กดอนุญาตให้ใช้กล้องในเบราว์เซอร์ก่อน' : 'ยกเลิกการแชร์หน้าจอ', src === 'camera');
  }
  rtcCleanup(true);
  Object.assign(R, { sid: sid || uid('s_'), peer: peer, name: name, role: 'host', state: 'connecting', stream: stream, t0: Date.now(), rmode: !!remote, peekOpen: true, src: src, facing: 'environment' });
  const tr = stream.getVideoTracks()[0]; if (tr) { tr.onended = () => { if (!R.flipping) rtcHang(); }; try { tr.contentHint = src === 'camera' ? 'motion' : 'detail'; } catch (e) {} }
  if (earlyP) { const mySid = R.sid; earlyP.then(w => { if (!w) return; if (R.sid !== mySid || R.role !== 'host' || !R.state) { try { w.close(); } catch (x) {} return; } pipPrep(w); R.pipEarly = w; if (R.state === 'live') pipAttach(w); }); }
  renderRtc(); rtcLoop();
  if (mode() === 'demo') { setTimeout(() => { if (R.state === 'connecting') { R.state = 'live'; R.t0 = Date.now(); renderRtc(); toast(name + ' กำลังดูหน้าจอของคุณ'); inkDemo(); } }, 2000); return; }
  try {
    const pc = rtcPc(); rtcDc(pc.createDataChannel('ink')); stream.getTracks().forEach(t => { const sd = pc.addTrack(t, stream); if (t.kind === 'video') R.vsender = sd; });
    try { R.asend = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender; } catch (e) {}
    pc.ontrack = e => { if (e.track.kind === 'audio') voicePlay(e.track); };
    await pc.setLocalDescription(await pc.createOffer()); await rtcIce(pc);
    await rtcSig(peer, R.sid, 'offer', { sdp: pc.localDescription.sdp, name: S.me, src: R.src });
    rtcGuard(75000, 'timeout');
  } catch (e) { rtcCleanup(); }
}
async function rtcAnswer(g) {
  const keep = R.sid === g.sid ? { tool: R.tool, rmode: R.rmode, color: R.color } : { color: R.color };
  rtcCleanup(true);
  Object.assign(R, keep, { sid: g.sid, peer: sigPeer(g), name: sigName(g), role: 'view', state: 'connecting', t0: Date.now(), src: g.data && (g.data.src === 'camera' || g.data.src === 'voice') ? g.data.src : 'screen' });
  renderRtc(); rtcLoop();
  try {
    const pc = rtcPc();
    pc.ondatachannel = e => rtcDc(e.channel);
    pc.ontrack = e => {
      if (e.track.kind === 'audio') return voicePlay(e.track);
      R.remote = new MediaStream([e.track]); const v = $('#rtcVideo'); if (v) { v.srcObject = R.remote; v.play().catch(() => {}); }
    };
    await pc.setRemoteDescription({ type: 'offer', sdp: g.data.sdp });
    const at = pc.getTransceivers().find(x => x.receiver && x.receiver.track && x.receiver.track.kind === 'audio');
    if (at) { try { at.direction = 'sendrecv'; } catch (e) {} R.asend = at.sender; }
    if (R.src === 'voice' && at) {
      try { R.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); await R.asend.replaceTrack(R.mic.getAudioTracks()[0]); R.micOn = true; }
      catch (e) { toast('เปิดไมค์ไม่ได้ — ฟังได้อย่างเดียว กดอนุญาตไมโครโฟนแล้วกดปุ่มไมค์', true); }
    }
    await pc.setLocalDescription(await pc.createAnswer()); await rtcIce(pc);
    await rtcSig(R.peer, R.sid, 'answer', { sdp: pc.localDescription.sdp });
    rtcGuard(30000, 'fail');
  } catch (e) { rtcFail(); }
}
function rtcPc() {
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE }); R.pc = pc;
  pc.onconnectionstatechange = () => {
    if (R.pc !== pc) return;
    const s = pc.connectionState;
    if (s === 'connected') { clearTimeout(R.guard); if (R.state !== 'live') { R.state = 'live'; R.t0 = Date.now(); renderRtc(); ringStop(); if (R.role === 'host' && R.pipEarly && !R.pip) pipAttach(R.pipEarly); if (R.src === 'voice') { ping(false); } else if (R.role === 'host') { toast(R.name + ' กำลังดูหน้าจอของคุณ' + (CAN_PIP ? ' — กด "หน้าต่างลอย" เพื่อเห็นจุดที่เขาชี้ขณะใช้โปรแกรมอื่น' : '')); ping(false); } } }
    else if (s === 'failed') rtcFail();
    else if (s === 'disconnected') setTimeout(() => { if (R.pc === pc && pc.connectionState === 'disconnected') { toast('การเชื่อมต่อหลุด', true); rtcHang(); } }, 6000);
  };
  return pc;
}
/* รอ ICE แค่พอได้ที่อยู่ภายนอก (srflx) แล้วส่งเลย — ไม่ต้องรอครบทุกเส้นทาง (เดิมรอได้ถึง 3 วิ) */
function rtcIce(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    let done = false, soon = null;
    const fin = () => { if (done) return; done = true; clearTimeout(cap); clearTimeout(soon); res(); };
    const cap = setTimeout(fin, 1800);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') fin(); });
    pc.addEventListener('icecandidate', e => { if (!e.candidate) return fin(); if (/ typ (srflx|relay) /.test(e.candidate.candidate) && !soon) soon = setTimeout(fin, 250); });
  });
}
function rtcGuard(ms, why) {
  clearTimeout(R.guard); const sid = R.sid;
  R.guard = setTimeout(() => {
    if (R.sid !== sid || R.state === 'live') return;
    if (why === 'fail') return rtcFail();
    if (R.src === 'voice' && R.role === 'host') {
      toast('ไม่มีผู้รับสาย — ส่งข้อความแจ้ง ' + R.name + ' แล้ว', true);
      if (mode() !== 'demo') api().sendMessage({ to: R.peer, text: '📞 โทรหาแต่ไม่มีผู้รับสาย โทรกลับได้ที่ปุ่ม "โทร"' }).then(() => pollMessages()).catch(() => {});
      return rtcHang();
    }
    toast(R.name + ' ยังไม่ตอบรับ ลองใหม่อีกครั้งภายหลัง', true); rtcHang();
  }, ms);
}
function rtcFail() { if (!R.state) return; toast((R.src === 'voice' ? 'ต่อสายไม่สำเร็จ' : 'เชื่อมต่อหน้าจอไม่สำเร็จ') + ' — สองเครื่องต้องออกอินเทอร์เน็ตได้ และเครือข่ายไม่บล็อกการเชื่อมต่อตรง', true); rtcHang(); }
function rtcHang() { if (R.sid && R.peer && R.state) rtcSig(R.peer, R.sid, 'bye').catch(() => {}); rtcCleanup(); }
function rtcCleanup(keepUi) {
  clearTimeout(R.guard); clearInterval(R.tick);
  if (R.stream) R.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
  if (R.remote && R.demo) R.remote.getTracks().forEach(t => t.stop());
  if (R.pc) { try { R.pc.close(); } catch (e) {} }
  cancelAnimationFrame(R.raf); clearInterval(R.demoInk);
  if (R.dc) { try { R.dc.close(); } catch (e) {} }
  if (R.inkRaf) { try { (R.inkWin || window).cancelAnimationFrame(R.inkRaf); } catch (e) {} R.inkRaf = 0; }
  const pip = R.pip; R.pip = null; if (R.peek) R.peek.remove(); if (pip) { try { pip.close(); } catch (e) {} }
  if (R.pipEarly) { try { R.pipEarly.close(); } catch (e) {} R.pipEarly = null; }
  inkTitle(false); voiceStop(); ringStop();
  Object.assign(R, { sid: '', peer: '', name: '', role: '', state: '', pc: null, stream: null, remote: null, demo: false, dc: null, tool: '', drawId: '', ink: { strokes: [], ptr: null, rips: [] }, peek: null, peekOpen: true, rmode: false, src: '', facing: '', vsender: null, flipping: false, nudgeT: 0, nudged: 0 });
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (!keepUi) renderRtc();
}

/* ---- incoming prompts ---- */
function rtcPrompt(g, kind) {
  const peer = sigPeer(g), name = sigName(g), rem = kind === 'req' && g.data && g.data.mode === 'remote';
  const title = rem ? name + ' ขอรีโมทหน้าจอของคุณ' : kind === 'req' ? name + ' ขอดูหน้าจอของคุณ' : name + ' ต้องการแชร์' + srcWord(g.data && g.data.src) + 'ให้คุณดู';
  const sub = kind === 'req' ? (!CAN_SHARE ? (CAN_CAM ? 'มือถือแชร์หน้าจอผ่านเว็บไม่ได้ — กด "แชร์กล้อง" ส่องให้เขาดูแทน (เช่น ชิ้นงาน เอกสาร หรือจอเครื่องอื่น) เขาชี้/วาดบอกจุดบนภาพได้' : 'อุปกรณ์นี้แชร์หน้าจอหรือกล้องไม่ได้')
      : rem ? 'กด "แชร์หน้าจอ" แล้วเลือกจอที่จะให้ดู — เขาจะชี้และวาดบอกจุดบนจอได้ คุณเห็นตามทันทีในหน้าต่างลอย ไม่ต้องติดตั้งอะไร (เขาคลิกแทนคุณไม่ได้)'
      : 'กด "แชร์หน้าจอ" แล้วเลือกหน้าจอหรือหน้าต่างที่จะให้ดู — เขาดูและชี้บอกจุดได้ แต่ควบคุมเครื่องไม่ได้')
    : 'กด "ดู' + srcWord(g.data && g.data.src) + '" เพื่อเปิดดู — ชี้หรือวาดบนภาพเพื่อบอกจุดให้เขาเห็นได้';
  const body = '';
  const acts = '<button class="btn" data-rtc="no">ปฏิเสธ</button>' + (kind !== 'req' ? '<button class="btn primary rtc-go" data-rtc="yes">' + RTC_IC.eye + 'ดู' + srcWord(g.data && g.data.src) + '</button>'
    : (CAN_SHARE ? '<button class="btn primary rtc-go" data-rtc="yes">' + RTC_IC.cast + 'แชร์หน้าจอ</button>' : '') +
      (CAN_CAM && (!CAN_SHARE || IS_TOUCH) ? '<button class="btn ' + (CAN_SHARE ? '' : 'primary rtc-go') + '" data-rtc="yescam">' + RTC_IC.cam + 'แชร์กล้อง</button>' : ''));
  R.prompt = { sid: g.sid, peer: peer, name: name, kind: kind, g: g };
  openRtcModal('<div class="rtc-ring">' + peerAv(peer, name, 'rtc-av') + '<i></i><i></i><span class="rtc-badge ' + (rem ? 'ctl' : kind) + '">' + (rem ? RTC_IC.mouse : kind === 'req' ? RTC_IC.eye : RTC_IC.cast) + '</span></div>' +
    '<h3>' + esc(title) + '</h3><p>' + sub + '</p>' + body + '<div class="rtc-acts">' + acts + '</div>', kind);
  ping(true); setTimeout(() => ping(true), 380);
  try { if (navigator.vibrate) navigator.vibrate([60, 80, 60]); } catch (e) {}
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') { try { const n = new Notification(title, { tag: 'rtc' + g.sid, icon: 'icons/icon-192.png' }); n.onclick = () => window.focus(); } catch (e) {} }
  const sid = g.sid;
  clearTimeout(R.promptT); R.promptT = setTimeout(() => { if (R.prompt && R.prompt.sid === sid) { rtcSig(peer, sid, 'deny', { reason: 'timeout' }).catch(() => {}); closeRtcModal(); } }, 60000);
  rtcLoop();
}
function openRtcModal(html, kind) {
  let m = $('#rtcModal');
  if (!m) { m = document.createElement('div'); m.id = 'rtcModal'; m.className = 'rtc-modal'; document.body.appendChild(m); }
  m.innerHTML = '<div class="rtc-card k-' + kind + '" role="dialog" aria-modal="true">' + html + '</div>';
  requestAnimationFrame(() => m.classList.add('in'));
}
function closeRtcModal() { if (R.ring === 'in') ringStop(); R.prompt = null; clearTimeout(R.promptT); const m = $('#rtcModal'); if (m) { m.classList.remove('in'); setTimeout(() => { if (!m.classList.contains('in')) m.remove(); }, 260); } }

async function rtcAct(a, t) {
  const p = R.prompt;
  switch (a) {
    case 'yes':
      if (!p) return; voiceUnlock(); closeRtcModal();
      if (p.kind === 'req') return rtcHost(p.peer, p.name, p.sid, !!(p.g.data && p.g.data.mode === 'remote'));
      if (p.kind === 'offer' || p.kind === 'call') { ringStop(); return rtcAnswer(p.g); }
      return;
    case 'no':
      if (!p) return; closeRtcModal();
      return void rtcSig(p.peer, p.sid, 'deny', { reason: 'no' }).catch(() => {});
    case 'close': return closeRtcModal();
    case 'view': voiceUnlock(); return rtcRequest(t.dataset.peer, t.dataset.name);
    case 'remote': voiceUnlock(); return rtcRequest(t.dataset.peer, t.dataset.name, true);
    case 'tool': R.tool = R.tool === t.dataset.v ? '' : t.dataset.v; if (!R.tool) inkSendAll({ t: 'pl' }); return inkBarSync();
    case 'color': R.color = t.dataset.v; if (!R.tool) R.tool = 'pen'; return inkBarSync();
    case 'undo': inkSendAll({ t: 'undo' }); return inkBarSync();
    case 'clear': inkSendAll({ t: 'clr' }); return inkBarSync();
    case 'pip': return rtcPip();
    case 'mic': return voiceMic();
    case 'call': voiceUnlock(); ringUnlock(); return callStart(t.dataset.peer, t.dataset.name);
    case 'spk': R.spkOff = !R.spkOff; LS.set('spkOff', R.spkOff ? 1 : 0); if (R.audioEl) R.audioEl.muted = !!R.spkOff; if (!R.spkOff) voiceUnlock(); return voiceSync();
    case 'yescam': if (!p) return; voiceUnlock(); closeRtcModal(); return rtcHost(p.peer, p.name, p.sid, !!(p.g.data && p.g.data.mode === 'remote'), 'camera');
    case 'sharecam': return rtcHost(t.dataset.peer, t.dataset.name, '', false, 'camera');
    case 'flip': {
      if (R.role !== 'host' || R.src !== 'camera') return;
      if (R.flipping) return;
      const want = R.facing === 'user' ? 'environment' : 'user';
      /* มือถือ (โดยเฉพาะ iPhone) เปิดกล้องได้ทีละตัว: ปล่อยกล้องเดิมก่อน แล้วค่อยเปิดกล้องใหม่และสลับภาพในสายเดิม ไม่ตัดสาย */
      R.flipping = true; t.disabled = true;
      const snd = R.vsender || (R.pc && R.pc.getSenders().find(x => !x.track || x.track.kind === 'video'));
      R.stream.getTracks().forEach(x => { x.onended = null; x.stop(); });
      let ns = null, got = want;
      try { ns = await camStream(want); }
      catch (e) { got = R.facing; try { ns = await camStream(R.facing); toast('สลับกล้องไม่ได้ — ใช้กล้องเดิมต่อ', true); } catch (e2) { ns = null; } }
      R.flipping = false; t.disabled = false;
      if (!ns) { toast('เปิดกล้องไม่ได้ — หยุดแชร์', true); return rtcHang(); }
      if (R.role !== 'host' || !R.state) { ns.getTracks().forEach(x => x.stop()); return; }
      const nt = ns.getVideoTracks()[0];
      try { if (snd) await snd.replaceTrack(nt); } catch (e) {}
      nt.onended = () => { if (!R.flipping) rtcHang(); }; try { nt.contentHint = 'motion'; } catch (e) {}
      R.stream = ns; R.facing = got;
      const v = R.peek && R.peek.querySelector('video'); if (v) { v.srcObject = ns; v.play().catch(() => {}); }
      return;
    }
    case 'peek': R.peekOpen = !R.peekOpen; if (R.pip) { try { R.pip.close(); } catch (e) {} } return renderRtc();
    case 'share': return rtcHost(t.dataset.peer, t.dataset.name);
    case 'hang': return rtcHang();
    case 'full': { const w = $('#rtcStage'); if (!w) return; if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen().catch(() => {}); return; }
    case 'fit': R.fit = !R.fit; { const v = $('#rtcBox'); if (v) v.classList.toggle('actual', !!R.fit); } inkKick(); return;
  }
}

/* ---- on-screen UI ---- */
function renderRtc() {
  let v = $('#rtcView'), h = $('#rtcHost');
  const voice = R.src === 'voice';
  renderCall();
  if (R.role !== 'view' || !R.state || voice) { if (v) { v.classList.remove('in'); setTimeout(() => { if (!R.state || R.role !== 'view') v.remove(); }, 300); } }
  if (R.role !== 'host' || !R.state || voice) { if (h) { h.classList.add('out'); setTimeout(() => { if (R.role !== 'host') h.remove(); }, 300); } }
  clearInterval(R.tick);
  if (R.role === 'view' && R.state && !voice) {
    if (!v) { v = document.createElement('div'); v.id = 'rtcView'; v.className = 'rtc-view'; document.body.appendChild(v); requestAnimationFrame(() => v.classList.add('in')); }
    const live = R.state === 'live';
    v.dataset.state = R.state;
    v.innerHTML = '<div class="rtc-bar">' + peerAv(R.peer, R.name, 'rtc-mini') + '<div class="rtc-who"><b>' + (live ? srcWord(R.src) + 'ของ ' : R.state === 'wait' ? 'กำลังขอดูหน้าจอของ ' : 'กำลังเชื่อมต่อกับ ') + esc(R.name) + '</b><small>' + (live ? '<i class="rtc-live">LIVE</i><span id="rtcClock">0:00</span> · <span id="rtcInkHint">' + inkHint() + '</span>' : R.state === 'wait' ? 'รอ ' + esc(R.name) + ' กดอนุญาต…' : 'กำลังเปิดภาพ…') + '</small></div>' +
      '<div class="rtc-tools">' + (live ? voiceBtns() + inkBar() + '<button class="rtc-tb" data-rtc="fit" title="ขนาดจริง / พอดีจอ">1:1</button><button class="rtc-tb" data-rtc="full" title="เต็มจอ">' + RTC_IC.full + '</button>' : '') +
      '<button class="rtc-tb end" data-rtc="hang" title="' + (live ? 'ปิด' : 'ยกเลิก') + '">' + RTC_IC.hang + '<span>' + (live ? 'ปิด' : 'ยกเลิก') + '</span></button></div></div>' +
      '<div class="rtc-stage" id="rtcStage">' + (live || R.state === 'connecting' ? '<div class="rtc-vbox' + (R.fit ? ' actual' : '') + (R.tool ? ' drawing' : '') + '" id="rtcBox"><video id="rtcVideo" autoplay playsinline muted></video><canvas id="rtcInk"></canvas></div>' : '') +
      (live ? '' : '<div class="rtc-waiting"><div class="rtc-ring big">' + peerAv(R.peer, R.name, 'rtc-av') + '<i></i><i></i><i></i><span class="rtc-badge req">' + RTC_IC.eye + '</span></div><b>' + (R.state === 'wait' ? 'ส่งคำขอถึง ' + esc(R.name) + ' แล้ว' : 'กำลังเชื่อมต่อ…') + '</b><small>' + (R.state === 'wait' ? 'เมื่อเขากดแชร์ ภาพหน้าจอจะขึ้นตรงนี้' : 'ใช้เวลาไม่กี่วินาที') + '</small><span class="rtc-dots"><i></i><i></i><i></i></span></div>') + '</div>';
    const vid = $('#rtcVideo'); if (vid) { vid.addEventListener('resize', inkKick); vid.addEventListener('loadedmetadata', inkKick); if (R.remote) { vid.srcObject = R.remote; vid.play().catch(() => {}); } }
    inkKick();
  }
  if (R.role === 'host' && R.state && !voice) {
    if (!h) { h = document.createElement('div'); h.id = 'rtcHost'; h.className = 'rtc-host'; document.body.appendChild(h); }
    h.classList.remove('out');
    const live = R.state === 'live';
    h.dataset.state = R.state;
    h.innerHTML = '<span class="rtc-rec"></span>' + peerAv(R.peer, R.name, 'rtc-mini') + '<div class="rtc-who"><b>' + (live ? esc(R.name) + ' กำลังดู' + srcWord(R.src) + 'คุณ' : 'รอ ' + esc(R.name) + ' เปิดดู…') + '</b><small>' + (live ? '<span id="rtcClock">0:00</span> · ' + (R.src === 'camera' ? 'แชร์กล้อง' : R.rmode ? 'รีโมทชี้จอ' : 'ชี้บอกจุดได้') : 'แชร์' + srcWord(R.src) + 'อยู่') + '</small></div>' +
      (live ? voiceBtns() : '') +
      (R.src === 'camera' ? '<button class="rtc-tb" data-rtc="flip" title="สลับกล้องหน้า/หลัง">' + RTC_IC.flip + '</button>' : '') +
      (live ? (CAN_PIP && R.src !== 'camera' ? '<button class="rtc-tb" data-rtc="pip" title="หน้าต่างลอยอยู่บนสุด — เห็นจุดที่เขาชี้แม้ใช้โปรแกรมอื่นอยู่">' + RTC_IC.pip + '<span>' + (R.pip ? 'ปิดหน้าต่างลอย' : 'หน้าต่างลอย') + '</span></button>' : '') +
        '<button class="rtc-tb' + (R.peekOpen || R.pip ? ' on' : '') + '" data-rtc="peek" title="แสดง/ซ่อนภาพจุดที่เขาชี้">' + RTC_IC.pen + '</button>' : '') +
      '<button class="rtc-tb end" data-rtc="hang">' + RTC_IC.stop + '<span>หยุดแชร์</span></button>';
  }
  if (R.state === 'live') {
    const c = () => { const el = $('#rtcClock'); if (el) el.textContent = clock(Date.now() - R.t0).replace(/^0?0:/, ''); };
    c(); R.tick = setInterval(c, 1000);
  }
  renderPeek();
  if (M.open) renderMsgPanel();
}
function rtcStrip() {
  if (CAN_RTC && M.ch === 'team') return roomStrip();
  if (!CAN_RTC || M.ch === 'team' || !M.ch) return '';
  const peer = peerOfCh(M.ch), name = peerNameOfCh(M.ch), on = R.state && R.peer === peer;
  if (on) return '<div class="mp-rtc on"><span class="rtc-rec"></span><span>' + (R.src === 'voice' ? (R.state === 'live' ? 'กำลังคุยสายกับ ' : 'กำลังโทรหา ') : R.role === 'view' ? (R.state === 'live' ? 'กำลังดูหน้าจอของ ' : 'กำลังขอดูหน้าจอ ') : 'กำลังแชร์หน้าจอให้ ') + esc(name) + '</span>' + (R.src === 'voice' && R.state === 'live' ? '<button class="mp-vbtn' + (R.micOn ? ' on' : ' off') + '" data-rtc="mic" title="' + (R.micOn ? 'ปิดไมค์' : 'เปิดไมค์') + '">' + (R.micOn ? RTC_IC.mic : RTC_IC.micOff) + '</button><button class="mp-vbtn' + (R.spkOff ? ' off' : ' on') + '" data-rtc="spk" title="' + (R.spkOff ? 'เปิดลำโพง' : 'ปิดลำโพง') + '">' + (R.spkOff ? RTC_IC.spkOff : RTC_IC.spk) + '</button>' : '') + '<button class="btn sm danger" data-rtc="hang">' + (R.src === 'voice' ? RTC_IC.hang + 'วางสาย' : RTC_IC.stop + 'หยุด') + '</button></div>';
  const dp = ' data-peer="' + esc(peer) + '" data-name="' + esc(name) + '"';
  return '<div class="mp-rtc"><button class="mp-call" data-rtc="call"' + dp + ' title="โทรหา ' + esc(name) + ' (เสียง)">' + RTC_IC.phone + '<span>โทร</span></button><button data-rtc="view"' + dp + ' title="ขอดูหน้าจอของ ' + esc(name) + '">' + RTC_IC.eye + '<span>ขอดูจอ</span></button>' +
    (CAN_SHARE || !CAN_CAM ? '<button data-rtc="share"' + dp + (CAN_SHARE ? '' : ' disabled') + ' title="' + (CAN_SHARE ? 'แชร์หน้าจอของฉันให้ ' + esc(name) + ' ดู' : 'อุปกรณ์นี้แชร์หน้าจอไม่ได้') + '">' + RTC_IC.cast + '<span>แชร์จอฉัน</span></button>'
      : '<button data-rtc="sharecam"' + dp + ' title="มือถือแชร์หน้าจอผ่านเว็บไม่ได้ — แชร์กล้องให้ ' + esc(name) + ' ดูแทน">' + RTC_IC.cam + '<span>แชร์กล้อง</span></button>') +
    '</div>';
}





/* ============ ห้องเสียงทีม (แบบ Discord) ============
   ทุกคนในห้องต่อตรงหากัน (mesh) — เหมาะกับทีมเล็ก ~2–8 คน
   คนที่เข้าห้องทีหลังเป็นฝ่ายโทรหาคนที่อยู่ก่อน · เสียงและจอวิ่งตรงระหว่างเครื่อง ฐานข้อมูลเก็บแค่ใครอยู่ในห้อง */
const V = { on: false, joining: false, since: 0, peers: {}, mic: null, muted: false, deaf: false, share: null, shareKind: '', members: [], beatT: null, view: false, focus: '', an: {}, speakT: null, known: null, speaking: {} };
const roomKey = m => (m.admin && !isAdmin()) ? 'admin' : m.name;
const roomIsMe = m => m.name === S.me && (!m.admin || isAdmin());
const roomMine = () => V.members.find(roomIsMe);
function roomNewer(m) { const me = roomMine(); if (!me) return true; return me.since > m.since || (me.since === m.since && S.me > m.name); }
function roomOnPoll(list) {
  const prev = V.known; V.members = list || [];
  const names = V.members.map(m => m.name);
  if (prev && !V.on) V.members.forEach(m => { if (prev.indexOf(m.name) < 0 && !roomIsMe(m)) toast('🔊 ' + m.name + ' เข้าห้องเสียงทีม'); });
  V.known = names;
  if (V.on) {
    Object.keys(V.peers).forEach(k => { if (!V.members.some(m => roomKey(m) === k)) roomDrop(k); });
    V.members.forEach(m => {
      if (roomIsMe(m)) return;
      const k = roomKey(m), P = V.peers[k];
      if (roomNewer(m) && (!P || (P.state !== 'connected' && Date.now() - P.t > 20000))) roomOffer(k, m.name);
    });
    if (!roomMine() && mode() !== 'demo') roomBeat(); // ถูกตัดออกจากรายชื่อ (เน็ตสะดุด) → ส่งสัญญาณกลับเข้าห้อง
  }
  renderRoom();
}
async function roomJoin() {
  if (V.on || V.joining) return;
  if (!CAN_RTC) return toast('เบราว์เซอร์นี้เข้าห้องเสียงไม่ได้', true);
  if (R.state) return toast('วางสายหรือหยุดแชร์จอก่อน แล้วค่อยเข้าห้องเสียง', true);
  V.joining = true; ringUnlock(); renderRoom();
  try { V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { V.mic = null; toast('ไมค์ใช้ไม่ได้ — เข้าห้องแบบฟังอย่างเดียว', true); }
  Object.assign(V, { on: true, joining: false, since: Date.now(), muted: !V.mic, deaf: false, peers: {} });
  speakStart(); if (V.mic) speakWatch('__me', V.mic);
  roomTone(true);
  if (mode() === 'demo') { V.members = [{ name: S.me, mic: !V.muted, share: '', since: Date.now(), admin: isAdmin() }]; toast('โหมดทดลอง: ไม่มีคนอื่นในห้อง — ลองกดปุ่มต่างๆ ได้'); renderRoom(); return; }
  try { const r = await api().room({ op: 'join', mic: !V.muted }); roomOnPoll(r.room); }
  catch (e) { toast('เข้าห้องไม่สำเร็จ: ' + e.message, true); return roomLeave(true); }
  clearInterval(V.beatT); V.beatT = setInterval(roomBeat, 10000);
  rtcLoop();
}
function roomBeat() { if (!V.on || mode() === 'demo') return; api().room({ op: 'beat', mic: !V.muted && !!V.mic, share: V.shareKind }).then(r => roomOnPoll(r.room)).catch(() => {}); }
function roomLeave(quiet) {
  if (!V.on) return;
  Object.keys(V.peers).forEach(k => { rtcSig(k, 'room', 'rbye', {}).catch(() => {}); roomDrop(k, true); });
  [V.mic, V.share].forEach(st => { if (st) st.getTracks().forEach(t => { t.onended = null; t.stop(); }); });
  clearInterval(V.beatT); speakStop();
  Object.assign(V, { on: false, mic: null, share: null, shareKind: '', muted: false, deaf: false, view: false, focus: '', peers: {}, speaking: {} });
  if (mode() !== 'demo') api().room({ op: 'leave' }).then(r => roomOnPoll(r.room)).catch(() => {});
  else V.members = [];
  if (!quiet) roomTone(false);
  renderRoom();
}
window.addEventListener('pagehide', () => {
  if (!V.on || mode() !== 'sheet') return;
  try { navigator.sendBeacon(S.conn.url, JSON.stringify({ token: LS.get(tokenKey(), ''), action: 'room', payload: { op: 'leave' } })); } catch (e) {}
});
function roomPc(key, name) {
  roomDrop(key, true);
  const pc = new RTCPeerConnection({ iceServers: RTC_ICE });
  const P = V.peers[key] = { key: key, name: name, pc: pc, video: null, audioEl: null, state: 'connecting', t: Date.now() };
  pc.ontrack = e => {
    if (V.peers[key] !== P) return;
    if (e.track.kind === 'audio') {
      const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.style.display = 'none';
      a.srcObject = new MediaStream([e.track]); a.muted = V.deaf; document.body.appendChild(a); a.play().catch(() => {});
      if (P.audioEl) P.audioEl.remove(); P.audioEl = a; speakWatch(key, a.srcObject);
    } else { P.video = new MediaStream([e.track]); roomVideos(); }
  };
  pc.onconnectionstatechange = () => {
    if (V.peers[key] !== P) return;
    P.state = pc.connectionState;
    if (P.state === 'connected') { P.t = Date.now(); roomTone(true, true); }
    if (P.state === 'failed') { P.t = 0; } // จะลองต่อใหม่ในรอบถัดไป
    if (P.state === 'disconnected') setTimeout(() => { if (V.peers[key] === P && pc.connectionState === 'disconnected') { P.state = 'failed'; P.t = 0; renderRoom(); } }, 8000);
    renderRoom();
  };
  return P;
}
async function roomTracks(P) {
  const pc = P.pc, tx = pc.getTransceivers();
  let a = tx.find(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio'), v = tx.find(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'video');
  if (!a) a = pc.addTransceiver('audio', { direction: 'sendrecv' });
  if (!v) v = pc.addTransceiver('video', { direction: 'sendrecv' });
  try { a.direction = 'sendrecv'; v.direction = 'sendrecv'; } catch (e) {}
  P.as = a.sender; P.vs = v.sender;
  const mt = V.mic && V.mic.getAudioTracks()[0], st = V.share && V.share.getVideoTracks()[0];
  try { await a.sender.replaceTrack(mt || null); await v.sender.replaceTrack(st || null); } catch (e) {}
}
async function roomOffer(key, name) {
  const P = roomPc(key, name); P.role = 'off';
  try {
    await roomTracks(P); await P.pc.setLocalDescription(await P.pc.createOffer()); await rtcIce(P.pc);
    if (V.peers[key] !== P || !V.on) return;
    await rtcSig(key, 'room', 'roff', { sdp: P.pc.localDescription.sdp, name: S.me });
  } catch (e) { if (V.peers[key] === P) { P.state = 'failed'; P.t = 0; } }
  renderRoom();
}
async function roomAnswer(key, name, sdp) {
  const P = roomPc(key, name); P.role = 'ans';
  try {
    await P.pc.setRemoteDescription({ type: 'offer', sdp: sdp }); await roomTracks(P);
    await P.pc.setLocalDescription(await P.pc.createAnswer()); await rtcIce(P.pc);
    if (V.peers[key] !== P || !V.on) return;
    await rtcSig(key, 'room', 'rans', { sdp: P.pc.localDescription.sdp });
  } catch (e) { if (V.peers[key] === P) { P.state = 'failed'; P.t = 0; } }
  renderRoom();
}
function roomOnSig(g) {
  const key = sigPeer(g), name = sigName(g);
  if (g.type === 'rbye') { roomDrop(key); return renderRoom(); }
  if (!V.on) { if (g.type === 'roff') rtcSig(key, 'room', 'rbye', {}).catch(() => {}); return; }
  if (g.type === 'roff') {
    const cur = V.peers[key], m = V.members.find(x => roomKey(x) === key);
    if (cur && cur.role === 'off' && cur.pc.signalingState === 'have-local-offer' && m && roomNewer(m)) return; // ชนกัน: คนเข้าทีหลังเป็นฝ่ายเสนอ
    roomAnswer(key, name, g.data && g.data.sdp);
  } else if (g.type === 'rans') {
    const P = V.peers[key];
    if (P && P.pc.signalingState === 'have-local-offer') P.pc.setRemoteDescription({ type: 'answer', sdp: g.data.sdp }).catch(() => { P.state = 'failed'; P.t = 0; });
  }
}
function roomDrop(key, quiet) {
  const P = V.peers[key]; if (!P) return;
  try { P.pc.close(); } catch (e) {}
  if (P.audioEl) { P.audioEl.srcObject = null; P.audioEl.remove(); }
  delete V.peers[key]; delete V.an[key]; delete V.speaking[key];
  if (V.focus === key) V.focus = '';
  if (!quiet) renderRoom();
}
async function roomMic() {
  if (!V.on) return;
  if (!V.mic) {
    try { V.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return toast('เปิดไมค์ไม่ได้ — กดอนุญาตไมโครโฟนก่อน', true); }
    const t = V.mic.getAudioTracks()[0]; Object.values(V.peers).forEach(P => { if (P.as) P.as.replaceTrack(t).catch(() => {}); });
    speakWatch('__me', V.mic); V.muted = false;
  } else V.muted = !V.muted;
  if (!V.muted && V.deaf) roomDeaf(false);
  V.mic.getAudioTracks().forEach(t => { t.enabled = !V.muted; });
  roomBeat(); renderRoom();
}
function roomDeaf(on) {
  V.deaf = on == null ? !V.deaf : on;
  Object.values(V.peers).forEach(P => { if (P.audioEl) P.audioEl.muted = V.deaf; });
  if (V.deaf && V.mic && !V.muted) { V.muted = true; V.mic.getAudioTracks().forEach(t => { t.enabled = false; }); roomBeat(); }
  renderRoom();
}
async function roomShare() {
  if (!V.on) return;
  if (V.share) return roomUnshare();
  let st, kind = CAN_SHARE ? 'screen' : 'camera';
  try { st = kind === 'screen' ? await navigator.mediaDevices.getDisplayMedia(SHARE_OPTS()) : await camStream('environment'); }
  catch (e) { if (kind === 'screen' && IS_TOUCH && CAN_CAM) { try { st = await camStream('environment'); kind = 'camera'; } catch (x) { return; } } else return; }
  const tr = st.getVideoTracks()[0]; try { tr.contentHint = kind === 'screen' ? 'detail' : 'motion'; } catch (e) {}
  tr.onended = () => roomUnshare();
  V.share = st; V.shareKind = kind; V.focus = '__me'; V.view = true;
  Object.values(V.peers).forEach(P => { if (P.vs) P.vs.replaceTrack(tr).catch(() => {}); });
  roomBeat(); renderRoom(); toast(kind === 'screen' ? 'กำลังแชร์จอให้ทั้งห้อง' : 'กำลังแชร์กล้องให้ทั้งห้อง');
}
function roomUnshare() {
  if (!V.share) return;
  V.share.getTracks().forEach(t => { t.onended = null; t.stop(); });
  V.share = null; V.shareKind = ''; if (V.focus === '__me') V.focus = '';
  Object.values(V.peers).forEach(P => { if (P.vs) P.vs.replaceTrack(null).catch(() => {}); });
  roomBeat(); renderRoom();
}
function roomAct(a, t) {
  switch (a) {
    case 'join': return roomJoin();
    case 'leave': return roomLeave();
    case 'mic': return roomMic();
    case 'deaf': return roomDeaf();
    case 'share': return roomShare();
    case 'open': V.view = true; return renderRoom();
    case 'close': V.view = false; return renderRoom();
    case 'focus': V.focus = t.dataset.key || ''; return renderRoom();
    case 'full': { const w = $('#roomStage'); if (!w) return; if (document.fullscreenElement) document.exitFullscreen(); else if (w.requestFullscreen) w.requestFullscreen().catch(() => {}); return; }
  }
}
/* เสียงเข้า/ออกห้อง สั้นๆ */
function roomTone(up, soft) {
  try { ringUnlock(); if (!ACTX || ACTX.state !== 'running') return; const t = ACTX.currentTime, g = ACTX.createGain(); g.connect(ACTX.destination);
    const v = soft ? .05 : .1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.linearRampToValueAtTime(0, t + .32);
    const o = ACTX.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(up ? 520 : 780, t); o.frequency.linearRampToValueAtTime(up ? 780 : 460, t + .25); o.connect(g); o.start(t); o.stop(t + .34); } catch (e) {}
}
/* ใครกำลังพูด (วงเขียวรอบรูป) */
function speakWatch(key, stream) {
  try { ringUnlock(); if (!ACTX) return; const src = ACTX.createMediaStreamSource(stream), an = ACTX.createAnalyser(); an.fftSize = 512; src.connect(an); V.an[key] = { an: an, buf: new Uint8Array(an.fftSize), src: src }; } catch (e) {}
}
function speakStart() {
  clearInterval(V.speakT);
  V.speakT = setInterval(() => {
    Object.keys(V.an).forEach(k => {
      const x = V.an[k]; x.an.getByteTimeDomainData(x.buf);
      let sum = 0; for (let i = 0; i < x.buf.length; i++) { const d = (x.buf[i] - 128) / 128; sum += d * d; }
      if (Math.sqrt(sum / x.buf.length) > .03) x.loud = Date.now();
      const on = Date.now() - (x.loud || 0) < 450 && !(k === '__me' && V.muted) && !(k !== '__me' && V.deaf);
      if (!!V.speaking[k] !== on) { V.speaking[k] = on; document.querySelectorAll('[data-vkey="' + (k === '__me' ? '__me' : CSS.escape(k)) + '"]').forEach(el => el.classList.toggle('speaking', on)); }
    });
  }, 120);
}
function speakStop() { clearInterval(V.speakT); V.speakT = null; V.an = {}; }
/* ---- UI ---- */
function roomPeople() {
  return V.members.map(m => { const me = roomIsMe(m), k = me ? '__me' : roomKey(m), P = V.peers[roomKey(m)];
    return { m: m, me: me, key: k, peerKey: roomKey(m), mic: me ? (!!V.mic && !V.muted) : m.mic, share: me ? V.shareKind : m.share, state: me ? 'connected' : P ? P.state : (V.on ? 'connecting' : '') }; });
}
function roomAv(p, cls) {
  return '<span class="rm-av ' + (cls || '') + (V.speaking[p.key] ? ' speaking' : '') + (p.state && p.state !== 'connected' ? ' pending' : '') + '" data-vkey="' + esc(p.key) + '" title="' + esc(p.m.name) + '">' + peerAv(p.peerKey === 'admin' ? 'admin' : p.m.name, p.m.name, 'rtc-mini') +
    (!p.mic ? '<i class="rm-mute">' + RTC_IC.micOff + '</i>' : '') + (p.share ? '<i class="rm-share">' + (p.share === 'camera' ? RTC_IC.cam : RTC_IC.cast) + '</i>' : '') + '</span>';
}
function roomCard() {
  const ppl = roomPeople();
  return '<div class="room-card' + (V.on ? ' in' : '') + (ppl.length ? ' live' : '') + '" id="roomCard"><span class="rc-ic">' + RTC_IC.room + '</span><div class="rc-t"><b>ห้องเสียงทีม</b><small>' +
    (ppl.length ? ppl.length + ' คนอยู่ในห้อง' + (ppl.some(p => p.share) ? ' · มีคนแชร์จอ' : '') : 'ยังไม่มีใครอยู่ในห้อง — เข้าก่อนแล้วชวนเพื่อนได้') + '</small></div>' +
    '<div class="rc-avs">' + ppl.slice(0, 8).map(p => roomAv(p)).join('') + '</div>' +
    (V.on ? '<button class="btn" data-room="open">' + RTC_IC.expand + '<span>เปิดห้อง</span></button>' : '<button class="btn primary rc-join" data-room="join"' + (V.joining ? ' disabled' : '') + '>' + RTC_IC.room + '<span>' + (V.joining ? 'กำลังเข้า…' : 'เข้าห้อง') + '</span></button>') + '</div>';
}
function roomStrip() {
  const n = V.members.length;
  return '<div class="mp-rtc room" id="roomStrip"><span class="rs-ic">' + RTC_IC.room + '</span><span class="rs-t"><b>ห้องเสียงทีม</b><small>' + (n ? n + ' คนอยู่ในห้อง' : 'ว่าง') + '</small></span>' +
    (V.on ? '<button class="btn sm" data-room="open">เปิดห้อง</button>' : '<button class="btn sm primary" data-room="join">' + RTC_IC.room + 'เข้าห้อง</button>') + '</div>';
}
function roomBtns(big) {
  return '<button class="rtc-tb mic' + (V.mic && !V.muted ? ' on' : ' off') + '" data-room="mic" title="' + (V.muted ? 'เปิดไมค์' : 'ปิดไมค์') + '">' + (V.mic && !V.muted ? RTC_IC.mic : RTC_IC.micOff) + (big ? '<span>' + (V.muted ? 'เปิดไมค์' : 'ไมค์เปิด') + '</span>' : '') + '</button>' +
    '<button class="rtc-tb' + (V.deaf ? ' off' : '') + '" data-room="deaf" title="' + (V.deaf ? 'เปิดเสียงห้อง' : 'ปิดเสียงห้อง (ไม่ได้ยินใคร)') + '">' + (V.deaf ? RTC_IC.headOff : RTC_IC.head) + '</button>' +
    (CAN_SHARE || CAN_CAM ? '<button class="rtc-tb' + (V.share ? ' on share' : '') + '" data-room="share" title="' + (V.share ? 'หยุดแชร์' : CAN_SHARE ? 'แชร์จอให้ทั้งห้อง' : 'แชร์กล้องให้ทั้งห้อง') + '">' + (CAN_SHARE ? RTC_IC.cast : RTC_IC.cam) + (big ? '<span>' + (V.share ? 'หยุดแชร์' : CAN_SHARE ? 'แชร์จอ' : 'แชร์กล้อง') + '</span>' : '') + '</button>' : '') +
    '<button class="rtc-tb end" data-room="leave" title="ออกจากห้อง">' + RTC_IC.hang + (big ? '<span>ออกจากห้อง</span>' : '') + '</button>';
}
function renderRoom() {
  const c = $('#roomCard'); if (c) c.outerHTML = roomCard();
  const st = $('#roomStrip'); if (st) st.outerHTML = roomStrip();
  let bar = $('#roomBar');
  if (!V.on) { if (bar) bar.remove(); const v = $('#roomView'); if (v) v.remove(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); return; }
  const ppl = roomPeople(), wait = ppl.filter(p => !p.me && p.state !== 'connected').length;
  if (!bar) { bar = document.createElement('div'); bar.id = 'roomBar'; bar.className = 'room-bar'; document.body.appendChild(bar); }
  /* สร้าง HTML ใหม่เฉพาะเมื่อสถานะเปลี่ยน — ไม่งั้นวิดีโอที่แชร์จะกระพริบทุกครั้งที่ดึงข้อมูล */
  const sig = JSON.stringify([ppl.map(p => [p.key, p.mic, p.share, p.state]), V.muted, V.deaf, !!V.share, V.view, V.focus, !!V.mic]);
  if (sig === V.sig && $('#roomView') === null === !V.view) return;
  V.sig = sig;
  bar.innerHTML = '<button class="rb-head" data-room="open" title="เปิดห้อง"><span class="rb-ic">' + RTC_IC.room + '</span><span class="rb-t"><b>ห้องเสียงทีม</b><small>' + ppl.length + ' คน' + (wait ? ' · กำลังต่อ ' + wait : ' · เชื่อมต่อแล้ว') + '</small></span></button>' +
    '<div class="rb-avs">' + ppl.slice(0, 6).map(p => roomAv(p, 'sm')).join('') + (ppl.length > 6 ? '<span class="rb-more">+' + (ppl.length - 6) + '</span>' : '') + '</div><div class="rb-btns">' + roomBtns(false) + '</div>';
  let v = $('#roomView');
  if (!V.view) { if (v) v.remove(); return; }
  if (!v) { v = document.createElement('div'); v.id = 'roomView'; v.className = 'rtc-view room-view in'; document.body.appendChild(v); }
  const sharers = ppl.filter(p => p.share);
  let focus = sharers.find(p => p.key === V.focus) || sharers[0];
  v.innerHTML = '<div class="rtc-bar"><span class="rb-ic big">' + RTC_IC.room + '</span><div class="rtc-who"><b>ห้องเสียงทีม</b><small>' + ppl.length + ' คนในห้อง' + (sharers.length ? ' · ' + esc(sharers.map(p => p.me ? 'คุณ' : p.m.name).join(', ')) + ' กำลังแชร์' : '') + '</small></div>' +
    '<div class="rtc-tools">' + roomBtns(true) + (focus ? '<button class="rtc-tb" data-room="full" title="เต็มจอ">' + RTC_IC.full + '</button>' : '') + '<button class="rtc-tb" data-room="close" title="ย่อ (ยังอยู่ในห้อง)">✕</button></div></div>' +
    '<div class="room-body' + (focus ? ' has-stage' : '') + '">' +
    (focus ? '<div class="room-stage" id="roomStage"><video id="roomVid" autoplay playsinline muted></video><span class="rs-name">' + (focus.share === 'camera' ? RTC_IC.cam : RTC_IC.cast) + esc(focus.me ? 'จอของคุณ (ทุกคนในห้องเห็น)' : focus.m.name) + '</span></div>' : '') +
    '<div class="room-tiles">' + ppl.map(p => '<div class="rm-tile' + (focus && focus.key === p.key ? ' focused' : '') + '" data-vkey="' + esc(p.key) + '"' + (p.share ? ' data-room="focus" data-key="' + esc(p.key) + '" role="button" tabindex="0"' : '') + '>' + roomAv(p, 'lg') +
      '<b>' + esc(p.m.name) + (p.me ? ' <span class="tag rev">คุณ</span>' : '') + '</b><small>' + (p.share ? (p.share === 'camera' ? 'แชร์กล้อง · แตะเพื่อดู' : 'แชร์จอ · แตะเพื่อดู') : p.state && p.state !== 'connected' ? 'กำลังเชื่อมต่อ…' : !p.mic ? 'ปิดไมค์' : 'ในห้อง') + '</small></div>').join('') +
    (ppl.length < 2 ? '<div class="rm-empty">' + RTC_IC.room + '<b>รอเพื่อนเข้าห้อง</b><small>คนในทีมจะเห็นว่าคุณอยู่ในห้อง ที่หน้าทีมงานและแชท "ทั้งทีม"</small></div>' : '') + '</div></div>';
  roomVideos(focus);
}
function roomVideos(focus) {
  const vid = $('#roomVid'); if (!vid) return;
  if (!focus) { const ppl = roomPeople().filter(p => p.share); focus = ppl.find(p => p.key === V.focus) || ppl[0]; }
  if (!focus) return;
  const src = focus.me ? V.share : (V.peers[focus.peerKey] || {}).video;
  if (src && vid.srcObject !== src) { vid.srcObject = src; vid.play().catch(() => {}); }
}

/* ============ voice calls + push (สายเรียกเข้าเด้งแม้ปิดแอป) ============ */
const PUSH_OK = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
const IS_STANDALONE = (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function pushMeta() {
  if (mode() !== 'sheet' || typeof caches === 'undefined') return;
  const tok = LS.get(tokenKey(), ''); if (!tok) return;
  caches.open('kiwngan-meta').then(c => c.put('/__meta', new Response(JSON.stringify({ api: S.conn.url, token: tok }), { headers: { 'Content-Type': 'application/json' } }))).catch(() => {});
}
function pushMetaClear() { if (typeof caches !== 'undefined') caches.open('kiwngan-meta').then(c => c.delete('/__meta')).catch(() => {}); }
const b64uBytes = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
async function pushEnable(ask) {
  if (mode() !== 'sheet') { if (ask) toast('โหมดทดลองไม่มีการแจ้งเตือนจริง', true); return false; }
  if (!PUSH_OK) { if (ask) toast(IS_IOS && !IS_STANDALONE ? 'iPhone/iPad: ต้องติดตั้งแอปลงหน้าจอโฮมก่อน (แชร์ → เพิ่มไปยังหน้าจอโฮม) แล้วเปิดจากไอคอน จึงจะเปิดการแจ้งเตือนได้' : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ push', true); return false; }
  try {
    if (Notification.permission === 'default' && ask) await Notification.requestPermission();
    if (Notification.permission !== 'granted') { if (ask) toast('ยังไม่ได้อนุญาตการแจ้งเตือน — เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์', true); return false; }
    const reg = await navigator.serviceWorker.ready, key = (await api().pushKey({})).key;
    let sub = await reg.pushManager.getSubscription();
    if (sub && LS.get('pushKey', '') && LS.get('pushKey', '') !== key) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(key) });
    await api().pushSub({ sub: sub.toJSON() });
    LS.set('pushKey', key); LS.set('pushOn', true); pushMeta();
    if (ask) toast('เปิดแจ้งเตือนสายเรียกเข้าแล้ว — มีคนโทรมาจะเด้งบนเครื่องนี้แม้ปิดแอป');
    return true;
  } catch (e) { if (ask) toast('เปิดการแจ้งเตือนไม่สำเร็จ: ' + (e && e.message || e), true); return false; }
}
async function pushDisable() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await api().pushUnsub({ endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } } catch (e) {}
  LS.set('pushOn', false); toast('ปิดการแจ้งเตือนบนเครื่องนี้แล้ว');
}
function pushBoot() { pushMeta(); if (mode() === 'sheet' && PUSH_OK && Notification.permission === 'granted' && LS.get('pushOn', true) !== false) pushEnable(false); }
function pushSection() {
  const on = PUSH_OK && typeof Notification !== 'undefined' && Notification.permission === 'granted' && LS.get('pushOn', false);
  const why = mode() !== 'sheet' ? 'ใช้ได้เมื่อเชื่อมต่อฐานข้อมูลจริง (ไม่ใช่โหมดทดลอง)'
    : !PUSH_OK ? (IS_IOS && !IS_STANDALONE ? 'iPhone/iPad ต้องติดตั้งแอปลงหน้าจอโฮมก่อน: กดปุ่มแชร์ → "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดแอปจากไอคอน' : 'เบราว์เซอร์นี้ไม่รองรับ ลองใช้ Chrome / Edge / Safari รุ่นใหม่')
    : Notification.permission === 'denied' ? 'เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้ไว้ — เปิดได้ที่การตั้งค่าเว็บไซต์ (ไอคอนแม่กุญแจหน้าลิงก์)' : '';
  return '<section class="panel sec" id="s-push"><div class="panel-h"><h2>แจ้งเตือนบนเครื่อง</h2>' + (on ? '<span class="push-on">' + RTC_IC.phone + 'เปิดอยู่</span>' : '') + '</div>' +
    '<p class="help">มีคนโทรหา ขอดูจอ มีงานใหม่มอบหมายให้ งานถูกส่งกลับไปแก้ และงานใกล้ถึงกำหนด (08:00 วันทำงาน) จะเด้งแจ้งเตือนบนเครื่องนี้ แม้ปิดแอปหรือล็อกหน้าจออยู่ แตะการแจ้งเตือนเพื่อเปิดแอปแล้วรับสาย — ต้องเปิดแยกในแต่ละเครื่อง</p>' +
    (why ? '<p class="help warn">' + why + '</p>' : '') +
    '<div class="top-actions">' + (on ? '<button class="btn" data-act="notifyperm">ลงทะเบียนเครื่องนี้ใหม่</button><button class="btn ghost" data-act="pushoff">ปิดบนเครื่องนี้</button>'
      : '<button class="btn primary" data-act="notifyperm"' + (why && mode() !== 'sheet' ? ' disabled' : '') + '>' + RTC_IC.phone + 'เปิดแจ้งเตือนบนเครื่องนี้</button>') + '</div></section>';
}

/* ringtone (เข้า) / เสียงรอสาย (ออก) ด้วย WebAudio — ไม่ต้องมีไฟล์เสียง */
let ACTX = null;
function ringUnlock() { try { ACTX = ACTX || new (window.AudioContext || window.webkitAudioContext)(); if (ACTX.state === 'suspended') ACTX.resume(); } catch (e) {} }
document.addEventListener('pointerdown', () => { if (ACTX && ACTX.state === 'suspended') ACTX.resume().catch(() => {}); }, { passive: true });
function ringStart(kind) {
  ringStop(); R.ring = kind;
  const beep = (f1, f2, dur) => { try { ringUnlock(); if (!ACTX || ACTX.state !== 'running') return; const t = ACTX.currentTime, g = ACTX.createGain(); g.connect(ACTX.destination); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'in' ? .22 : .12, t + .03); g.gain.setValueAtTime(kind === 'in' ? .22 : .12, t + dur - .05); g.gain.linearRampToValueAtTime(0, t + dur);
    [f1, f2].filter(Boolean).forEach(f => { const o = ACTX.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + dur); }); } catch (e) {} };
  const tick = () => { if (kind === 'in') { beep(880, 1320, .35); setTimeout(() => R.ring === 'in' && beep(880, 1320, .35), 450); try { if (navigator.vibrate) navigator.vibrate([400, 200, 400]); } catch (e) {} } else beep(425, 0, 1); };
  tick(); R.ringT = setInterval(tick, kind === 'in' ? 2200 : 4000);
}
function ringStop() { clearInterval(R.ringT); R.ringT = null; R.ring = ''; try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {} }

async function callStart(peer, name) {
  if (!CAN_RTC) return toast('เบราว์เซอร์นี้โทรไม่ได้', true);
  if (rtcBusy()) return toast('กำลังใช้สายอยู่ วางสายเดิมก่อน', true);
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return toast('อุปกรณ์นี้ใช้ไมโครโฟนไม่ได้', true);
  let mic;
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { return toast('เปิดไมค์ไม่ได้ — กดอนุญาตให้ใช้ไมโครโฟนก่อนโทร', true); }
  rtcCleanup(true);
  Object.assign(R, { sid: uid('c_'), peer: peer, name: name, role: 'host', state: 'connecting', src: 'voice', t0: Date.now(), mic: mic, micOn: true });
  renderRtc(); rtcLoop(); ringStart('out');
  if (mode() === 'demo') { setTimeout(() => { if (R.state === 'connecting' && R.src === 'voice') { R.state = 'live'; R.t0 = Date.now(); ringStop(); renderRtc(); ping(false); } }, 2500); return; }
  try {
    const pc = rtcPc(); rtcDc(pc.createDataChannel('ink'));
    R.asend = pc.addTransceiver(mic.getAudioTracks()[0], { direction: 'sendrecv' }).sender;
    pc.ontrack = e => { if (e.track.kind === 'audio') voicePlay(e.track); };
    await pc.setLocalDescription(await pc.createOffer()); await rtcIce(pc);
    await rtcSig(peer, R.sid, 'offer', { sdp: pc.localDescription.sdp, name: S.me, src: 'voice' });
    rtcGuard(45000, 'timeout');
  } catch (e) { rtcCleanup(); }
}
function callPrompt(g) {
  const peer = sigPeer(g), name = sigName(g);
  R.prompt = { sid: g.sid, peer: peer, name: name, kind: 'call', g: g };
  openRtcModal('<div class="rtc-ring call">' + peerAv(peer, name, 'rtc-av') + '<i></i><i></i><i></i><span class="rtc-badge call">' + RTC_IC.phone + '</span></div>' +
    '<h3>' + esc(name) + '</h3><p class="call-sub">กำลังโทรหาคุณ…</p>' +
    '<div class="rtc-acts call-acts"><button class="call-btn no" data-rtc="no" aria-label="ไม่รับสาย">' + RTC_IC.hang + '<span>ไม่รับ</span></button><button class="call-btn yes" data-rtc="yes" aria-label="รับสาย">' + RTC_IC.phone + '<span>รับสาย</span></button></div>', 'call');
  ringStart('in');
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') { try { const n = new Notification('📞 ' + name + ' กำลังโทรหาคุณ', { tag: 'call' + g.sid, icon: 'icons/icon-192.png', requireInteraction: true }); n.onclick = () => window.focus(); } catch (e) {} }
  const sid = g.sid;
  clearTimeout(R.promptT); R.promptT = setTimeout(() => { if (R.prompt && R.prompt.sid === sid) { closeRtcModal(); toast('สายที่ไม่ได้รับจาก ' + name, true); } }, 45000);
  rtcLoop();
}
function renderCall() {
  let c = $('#rtcCall');
  if (R.src !== 'voice' || !R.state) { if (c) { c.classList.add('out'); setTimeout(() => { if (R.src !== 'voice' || !R.state) c.remove(); }, 280); } return; }
  if (!c) { c = document.createElement('div'); c.id = 'rtcCall'; c.className = 'rtc-call'; document.body.appendChild(c); }
  c.classList.remove('out');
  const live = R.state === 'live';
  c.dataset.state = R.state;
  c.innerHTML = '<div class="rc-ring' + (live ? ' live' : '') + '">' + peerAv(R.peer, R.name, 'rtc-mini') + '<i></i><i></i></div>' +
    '<div class="rtc-who"><b>' + esc(R.name) + '</b><small>' + (live ? '<i class="rtc-live">ในสาย</i><span id="rtcClock">0:00</span>' : R.role === 'host' ? 'กำลังโทร…' : 'กำลังต่อสาย…') + '</small></div>' +
    voiceBtns() + '<button class="rtc-tb end" data-rtc="hang" title="วางสาย">' + RTC_IC.hang + '<span>วางสาย</span></button>';
}

/* ---- voice: two-way talk during screen share / remote (mic off by default, toggle mic & speaker) ---- */
function voiceUnlock() {
  if (!R.audioEl) { const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.style.display = 'none'; document.body.appendChild(a); R.audioEl = a; }
  R.audioEl.muted = !!R.spkOff; const pr = R.audioEl.play(); if (pr && pr.catch) pr.catch(() => {});
}
function voicePlay(track) {
  voiceUnlock();
  R.audioIn = new MediaStream([track]); R.audioEl.srcObject = R.audioIn;
  const pr = R.audioEl.play(); if (pr && pr.catch) pr.catch(() => { R.audioBlocked = true; voiceSync(); });
}
async function voiceMic() {
  if (!R.state) return;
  if (R.mic) {
    const tr = R.mic.getAudioTracks()[0]; R.micOn = !R.micOn; if (tr) tr.enabled = R.micOn;
  } else {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return toast('อุปกรณ์นี้ใช้ไมโครโฟนไม่ได้', true);
    if (mode() !== 'demo' && !R.asend) return toast('อีกฝ่ายใช้เวอร์ชันเก่า — ให้เขารีเฟรชหน้าเว็บแล้วเชื่อมต่อใหม่ ถึงจะคุยด้วยเสียงได้', true);
    try { R.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (e) { return toast('เปิดไมค์ไม่ได้ — กดอนุญาตให้ใช้ไมโครโฟนในเบราว์เซอร์ก่อน', true); }
    if (!R.state) { R.mic.getTracks().forEach(x => x.stop()); R.mic = null; return; }
    const tr = R.mic.getAudioTracks()[0];
    try { if (R.asend) await R.asend.replaceTrack(tr); } catch (e) {}
    R.micOn = true; voiceUnlock();
  }
  inkSend({ t: 'mic', on: !!R.micOn });
  toast(R.micOn ? 'เปิดไมค์แล้ว — ' + R.name + ' ได้ยินเสียงคุณ' : 'ปิดไมค์แล้ว');
  voiceSync();
}
function voiceStop() {
  if (R.mic) R.mic.getTracks().forEach(x => x.stop());
  if (R.audioEl) { try { R.audioEl.srcObject = null; } catch (e) {} } // keep the element: iOS only lets audio play on an element unlocked by a tap
  Object.assign(R, { mic: null, micOn: false, peerMic: false, asend: null, audioIn: null, audioBlocked: false });
}
function voiceBtns() {
  return '<span class="rtc-voice" id="rtcVoice"><button class="rtc-tb mic' + (R.micOn ? ' on' : ' off') + '" data-rtc="mic" title="' + (R.micOn ? 'ปิดไมค์' : 'เปิดไมค์ คุยกับ ' + esc(R.name)) + '">' + (R.micOn ? RTC_IC.mic : RTC_IC.micOff) + '<span>' + (R.micOn ? 'ไมค์เปิด' : 'เปิดไมค์') + '</span></button>' +
    '<button class="rtc-tb spk' + (R.spkOff ? ' off' : '') + '" data-rtc="spk" title="' + (R.spkOff ? 'เปิดลำโพง (ได้ยินเสียงอีกฝ่าย)' : 'ปิดลำโพง — คุยต่อได้ ไมค์ยังเปิดอยู่') + '">' + (R.spkOff ? RTC_IC.spkOff : RTC_IC.spk) + '<span>' + (R.spkOff ? 'ลำโพงปิด' : 'ลำโพง') + '</span></button>' +
    (R.peerMic ? '<i class="peer-mic" title="' + esc(R.name) + ' เปิดไมค์อยู่">' + RTC_IC.mic + '</i>' : '') + '</span>';
}
function voiceSync() { const el = $('#rtcVoice'); if (el) el.outerHTML = voiceBtns(); else renderRtc(); if (M.open && $('#msgPanel .mp-rtc.on')) renderMsgPanel(); }

/* ---- remote pointer: ชี้ / วาดบนจอที่แชร์ ---- */
const PEEK_CSS = `.pip-wait{font:500 14px system-ui,sans-serif;color:#cfe;padding:28px 18px;text-align:center;line-height:1.6}.pip-wait small{color:#8aa;font-size:12px}.rtc-peek{position:fixed;right:16px;bottom:16px;z-index:115;width:min(340px,calc(100vw - 32px));background:#10161c;color:#e9eef3;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px -12px rgba(0,0,0,.55),0 0 0 1px #2a343e;font:13px/1.35 Anuphan,system-ui,sans-serif;animation:peekIn .4s cubic-bezier(.3,1.4,.5,1);transition:box-shadow .3s}
.rtc-peek.in-pip{position:fixed;inset:0;width:auto;border-radius:0;box-shadow:none;display:flex;flex-direction:column;animation:none}
.rtc-peek.hot{box-shadow:0 0 0 3px #FF3B5C,0 18px 50px -12px rgba(0,0,0,.55)}
.rtc-peek-bar{display:flex;align-items:center;gap:7px;padding:7px 7px 7px 11px}
.rtc-peek-bar b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.rtc-peek-bar button{height:28px;padding:0 9px;border-radius:8px;border:1px solid #2c3742;background:#1a232c;color:#dce5ee;font:inherit;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;flex:none}
.rtc-peek-bar button:hover{background:#243039}
.rtc-peek-bar svg{width:15px;height:15px}
.rtc-peek-rec{width:9px;height:9px;border-radius:50%;background:#E5484D;flex:none;animation:peekRec 1.4s infinite}
.rtc-peek-box{position:relative;aspect-ratio:16/9;background:#0d1318;margin:0 8px;border-radius:8px}
.rtc-peek.in-pip .rtc-peek-box{flex:1;aspect-ratio:auto}
.rtc-peek-box video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:8px}
.rtc-peek-box canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.rtc-peek.drawing .rtc-peek-box canvas{pointer-events:auto;cursor:crosshair;touch-action:none}
.rtc-peek.drawing:not(.in-pip){width:min(560px,calc(100vw - 32px))}
.rtc-peek-bar button.on{background:#2f6fed;border-color:#2f6fed;color:#fff}
.rtc-peek-bar .pk-dot{width:18px;height:18px;padding:0;border-radius:50%;background:var(--c);border:2px solid #1a232c}
.rtc-peek-bar .pk-dot.on{box-shadow:0 0 0 2px #fff}
.rtc-peek-bar{flex-wrap:wrap}
.rtc-peek-where{display:flex;align-items:center;gap:7px;padding:7px 12px 9px;color:#93a3b2;font-size:13px}
.rtc-peek-where b{color:#fff}
.rtc-peek-where i{width:10px;height:10px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor}
.rtc-peek.in-pip .rtc-peek-box{margin:0 8px}
@keyframes peekRec{50%{opacity:.3}}
@keyframes peekIn{from{opacity:0;transform:translateY(24px) scale(.95)}}
body.pip-body{margin:0;background:#0b0f13}`;
(function () { if (typeof document === 'undefined') return; const st = document.createElement('style'); st.textContent = PEEK_CSS; document.head.appendChild(st); })();

function rtcDc(ch) {
  R.dc = ch;
  ch.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (!m || typeof m.t !== 'string') return; if (m.t === 'mic') { R.peerMic = !!m.on; return voiceSync(); } inkApply(m, true); };
  ch.onopen = () => { if (R.micOn) inkSend({ t: 'mic', on: true }); };
}
function inkSend(m) { if (R.dc && R.dc.readyState === 'open') { try { R.dc.send(JSON.stringify(m)); } catch (e) {} } }
function inkSendAll(m) { inkApply(m); inkSend(m); }
const inkN = v => Math.round(Math.min(1, Math.max(0, +v || 0)) * 10000) / 10000;
const inkC = c => INK_COLORS.indexOf(c) >= 0 ? c : INK_COLORS[0];
function inkApply(m, remote) {
  const k = R.ink, now = performance.now();
  switch (m.t) {
    case 'p': k.ptr = { x: inkN(m.x), y: inkN(m.y), c: inkC(m.c), t: now, r: !!remote }; break;
    case 'pl': if (k.ptr) k.ptr.t = Math.min(k.ptr.t, now - 2400); break;
    case 'b': {
      const st = { id: String(m.id), c: inkC(m.c), l: !!m.l, pts: [[inkN(m.x), inkN(m.y)]], end: 0, r: !!remote };
      k.strokes.push(st); if (k.strokes.length > 300) k.strokes.shift();
      k.ptr = { x: st.pts[0][0], y: st.pts[0][1], c: st.c, t: now, r: !!remote }; k.rips.push({ x: st.pts[0][0], y: st.pts[0][1], c: st.c, t: now }); break;
    }
    case 'm': { const st = k.strokes.find(x => x.id === String(m.id)); if (st && st.pts.length < 4000) { st.pts.push([inkN(m.x), inkN(m.y)]); k.ptr = { x: inkN(m.x), y: inkN(m.y), c: st.c, t: now, r: st.r }; } break; }
    case 'e': { const st = k.strokes.find(x => x.id === String(m.id)); if (st) st.end = now; break; }
    case 'clr': k.strokes = []; break;
    case 'undo': for (let i = k.strokes.length - 1; i >= 0; i--) if (!k.strokes[i].l) { k.strokes.splice(i, 1); break; } break;
    default: return;
  }
  if (remote && R.role === 'host' && (m.t === 'p' || m.t === 'b')) inkNudge();
  if (R.role === 'host' && R.peek && /^(e|clr|undo)$/.test(m.t)) R.peek.querySelector('.rtc-peek-bar').innerHTML = peekBar();
  inkKick();
}
function inkTitle(on) {
  const base = (S.settings && S.settings.appName) || 'KiwNgan คิวงาน';
  document.title = on ? '✏️ ' + R.name + ' กำลังชี้บนจอคุณ' : base;
  if (!on) appBadge(lastBadge);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && /^✏️/.test(document.title)) inkTitle(false); });
/* คนแชร์ไม่ได้ดูหน้าคิวงานอยู่ → เตือนให้เห็นว่ามีคนชี้ */
function inkNudge() {
  const now = Date.now(); if (now - (R.nudgeT || 0) < 6000) return; R.nudgeT = now;
  if (R.peek) { R.peek.classList.add('hot'); setTimeout(() => R.peek && R.peek.classList.remove('hot'), 1600); }
  if (R.pip) return;
  if (document.visibilityState !== 'visible') {
    inkTitle(true);
    if (!R.nudged && 'Notification' in window && Notification.permission === 'granted') { R.nudged = 1; try { const n = new Notification(R.name + ' กำลังชี้บนหน้าจอคุณ', { body: 'เปิดคิวงานแล้วกด "หน้าต่างลอย" เพื่อเห็นจุดที่เขาชี้ขณะทำงาน', tag: 'ink' + R.sid, icon: 'icons/icon-192.png' }); n.onclick = () => window.focus(); } catch (e) {} }
  } else if (!R.peekOpen) { R.peekOpen = true; renderRtc(); }
}
/* ปิดบังตัวกรอบดูเอง (ในแอปหรือหน้าต่างลอย) ออกจากภาพจอที่แชร์ ไม่ให้เกิด "จอซ้อนจอ" ไม่รู้จบ
   ใช้ได้เมื่อแชร์ทั้งจอ (monitor): คำนวณตำแหน่งกรอบบนจอจริง แล้วระบายทับตำแหน่งเดียวกันในภาพ */
function peekMask(g, r) {
  R.maskOn = false;
  if (R.role !== 'host' || R.src !== 'screen' || !R.stream || !R.peek) return;
  const tr = R.stream.getVideoTracks()[0], st = tr && tr.getSettings ? tr.getSettings() : {};
  if (st.displaySurface && st.displaySurface !== 'monitor') return;
  const w = R.pip || window, sc = w.screen || screen;
  if (!sc || !sc.width) return;
  let x, y, W, H;
  if (R.pip) { x = w.screenX; y = w.screenY; W = w.outerWidth; H = w.outerHeight; }
  else { const b = R.peek.getBoundingClientRect(); x = window.screenX + Math.max(0, (window.outerWidth - window.innerWidth) / 2) + b.left; y = window.screenY + Math.max(0, window.outerHeight - window.innerHeight) + b.top; W = b.width; H = b.height; }
  const L = sc.left !== undefined ? sc.left : (sc.availLeft || 0), T = sc.top !== undefined ? sc.top : (sc.availTop || 0);
  const pad = 10, kx = r.w / sc.width, ky = r.h / sc.height;
  const mx = r.x + (x - L - pad) * kx, my = r.y + (y - T - pad) * ky, mw = (W + pad * 2) * kx, mh = (H + pad * 2) * ky;
  if (mx > r.x + r.w || my > r.y + r.h || mx + mw < r.x || my + mh < r.y) { R.maskOn = true; return; }   // กรอบอยู่จออื่น
  R.maskOn = true;
  g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
  g.fillStyle = '#10161c'; g.fillRect(mx, my, mw, mh);
  g.strokeStyle = '#2c3a47'; g.lineWidth = 1; g.strokeRect(mx + .5, my + .5, mw - 1, mh - 1);
  g.restore();
}
/* วาด */
function inkFit(box, vw, vh) {
  const W = box.clientWidth, H = box.clientHeight;
  if (!vw || !vh) return { x: 0, y: 0, w: W, h: H };
  const k = Math.min(W / vw, H / vh); return { x: (W - vw * k) / 2, y: (H - vh * k) / 2, w: vw * k, h: vh * k };
}
function inkPaint(cv, vid) {
  const box = cv.parentNode; if (!box || !box.clientWidth) return;
  const win = cv.ownerDocument.defaultView || window, dpr = win.devicePixelRatio || 1, W = box.clientWidth, H = box.clientHeight;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const r = inkFit(box, vid && vid.videoWidth, vid && vid.videoHeight), P = p => [r.x + p[0] * r.w, r.y + p[1] * r.h];
  if (cv.classList.contains('map')) {
    g.fillStyle = '#16202a'; g.strokeStyle = '#2c3a47'; g.lineWidth = 1.5;
    g.beginPath(); if (g.roundRect) g.roundRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1, 6); else g.rect(r.x, r.y, r.w, r.h); g.fill(); g.stroke();
    g.strokeStyle = '#223039'; g.setLineDash([3, 4]); g.beginPath();
    [1, 2].forEach(i => { g.moveTo(r.x + r.w * i / 3, r.y + 4); g.lineTo(r.x + r.w * i / 3, r.y + r.h - 4); g.moveTo(r.x + 4, r.y + r.h * i / 3); g.lineTo(r.x + r.w - 4, r.y + r.h * i / 3); });
    g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2a3845'; g.fillRect(r.x + 1, r.y + r.h - 7, r.w - 2, 6);
  }
  if (vid && vid.videoWidth && cv.closest && cv.closest('.rtc-peek')) peekMask(g, r);
  const now = performance.now(), k = R.ink, lw = Math.max(2.5, r.w / 300);
  g.lineCap = g.lineJoin = 'round';
  k.strokes = k.strokes.filter(x => !(x.l && x.end && now - x.end > 1500));
  k.strokes.forEach(x => {
    g.globalAlpha = x.l && x.end ? Math.max(0, 1 - (now - x.end) / 1500) : 1;
    g.strokeStyle = x.c; g.lineWidth = x.l ? lw * 1.5 : lw; g.shadowColor = x.c; g.shadowBlur = x.l ? 14 : 0;
    g.beginPath(); x.pts.forEach((p, i) => { const q = P(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    if (x.pts.length === 1) { const q = P(x.pts[0]); g.lineTo(q[0] + .1, q[1]); }
    g.stroke();
  });
  g.shadowBlur = 0;
  k.rips = k.rips.filter(x => now - x.t < 900);
  k.rips.forEach(x => { const q = P([x.x, x.y]), f = (now - x.t) / 900; g.globalAlpha = 1 - f; g.strokeStyle = x.c; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1], 10 + f * 36, 0, Math.PI * 2); g.stroke(); });
  if (k.ptr && now - k.ptr.t < 3000) {
    const q = P([k.ptr.x, k.ptr.y]), c = k.ptr.c; g.globalAlpha = Math.min(1, (3000 - (now - k.ptr.t)) / 600);
    const pulse = 15 + 4 * Math.sin(now / 160);
    const gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], pulse + 10); gr.addColorStop(0, c + 'aa'); gr.addColorStop(1, c + '00');
    g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], pulse + 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = c; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(q[0], q[1], 7, 0, Math.PI * 2); g.fill(); g.stroke();
    if (k.ptr.r) {   // ป้ายชื่อบอกว่าใครชี้ (อีกฝ่าย) — ทั้งคนแชร์และคนดู
      const label = R.name; g.font = '600 12px Anuphan, system-ui, sans-serif';
      const tw = g.measureText(label).width + 14, lx = Math.min(q[0] + 12, W - tw - 2), ly = Math.min(q[1] + 12, H - 24);
      g.fillStyle = c; g.beginPath(); if (g.roundRect) g.roundRect(lx, ly, tw, 20, 10); else g.rect(lx, ly, tw, 20); g.fill();
      g.fillStyle = '#fff'; g.fillText(label, lx + 7, ly + 14);
    }
  }
  g.globalAlpha = 1;
}
/* ขนาดจอที่แชร์ (ไม่แสดงภาพจอในกรอบ เพื่อไม่ให้ภาพซ้อนกันไม่รู้จบ) */
function inkDims() {
  const tr = R.stream && R.stream.getVideoTracks()[0], st = tr && tr.getSettings ? tr.getSettings() : {};
  return { videoWidth: st.width || 1920, videoHeight: st.height || 1080 };
}
function inkWhere() {
  const el = R.peek && R.peek.querySelector('.rtc-peek-where'); if (!el) return;
  const k = R.ink, live = k.ptr && performance.now() - k.ptr.t < 3000;
  let t;
  if (live) {
    const cx = k.ptr.x < .34 ? 'ซ้าย' : k.ptr.x > .66 ? 'ขวา' : '', cy = k.ptr.y < .34 ? 'บน' : k.ptr.y > .66 ? 'ล่าง' : '';
    t = '<i style="background:' + k.ptr.c + '"></i>' + (k.ptr.r ? esc(R.name) : 'คุณ') + ' ชี้ที่ <b>' + (cx || cy ? (cx && cy ? 'มุม' : 'ด้าน') + cx + cy : 'กลางจอ') + '</b>';
  } else t = k.strokes.some(x => !x.l) ? esc(R.name) + ' วาดบอกไว้ ' + k.strokes.filter(x => !x.l).length + ' จุด' : 'รอ ' + esc(R.name) + ' ชี้…';
  if (el.innerHTML !== t) el.innerHTML = t;
}
function inkKick() {
  if (R.inkRaf || !R.state) return;
  const w = R.pip || window; R.inkWin = w;
  R.inkRaf = w.requestAnimationFrame(inkFrame);
}
function inkFrame() {
  R.inkRaf = 0;
  const a = $('#rtcInk'); if (a) inkPaint(a, $('#rtcVideo'));
  if (R.peek) { const c = R.peek.querySelector('canvas'); if (c) inkPaint(c, R.peek.querySelector('video') || inkDims()); inkWhere(); }
  const k = R.ink, now = performance.now();
  if ((k.ptr && now - k.ptr.t < 3000) || k.rips.length || k.strokes.some(x => x.l)) inkKick();
  else if (R.peek && R.maskOn) { clearTimeout(R.maskT); R.maskT = setTimeout(inkKick, 250); }   // ตามตำแหน่งกรอบเมื่อถูกลากย้าย
}
window.addEventListener('resize', () => inkKick());
/* คนดู: ลาก/ชี้บนภาพ */
let inkLastP = 0;
function inkXY(e) {
  const box = e.target.parentNode, rc = box.getBoundingClientRect(), vid = e.target.id === 'rtcInk' ? $('#rtcVideo') : (box.querySelector('video') && box.querySelector('video').videoWidth ? box.querySelector('video') : inkDims());
  const r = inkFit(box, vid && vid.videoWidth, vid && vid.videoHeight);
  const x = (e.clientX - rc.left - r.x) / r.w, y = (e.clientY - rc.top - r.y) / r.h;
  return { x: inkN(x), y: inkN(y), out: x < 0 || x > 1 || y < 0 || y > 1 };
}
document.addEventListener('pointerdown', e => {
  if (!e.target || e.target.id !== 'rtcInk' || !R.tool || R.state !== 'live') return;
  const p = inkXY(e); if (p.out) return;
  e.preventDefault(); try { e.target.setPointerCapture(e.pointerId); } catch (x) {}
  R.drawId = uid('k'); inkSendAll({ t: 'b', id: R.drawId, c: R.color, l: R.tool === 'laser' ? 1 : 0, x: p.x, y: p.y });
});
document.addEventListener('pointermove', e => {
  if (!e.target || e.target.id !== 'rtcInk' || !R.tool || R.state !== 'live') return;
  const p = inkXY(e);
  if (R.drawId) return inkSendAll({ t: 'm', id: R.drawId, x: p.x, y: p.y });
  if (p.out) return;
  const now = performance.now(); if (now - inkLastP < 33) return; inkLastP = now;
  inkSendAll({ t: 'p', x: p.x, y: p.y, c: R.color });
});
function inkUp() { if (!R.drawId) return; const id = R.drawId; R.drawId = ''; inkSendAll({ t: 'e', id: id }); inkBarSync(); }
document.addEventListener('pointerup', inkUp); document.addEventListener('pointercancel', inkUp);
document.addEventListener('pointerout', e => { if (e.target && e.target.id === 'rtcInk' && !R.drawId && R.tool) inkSendAll({ t: 'pl' }); });
document.addEventListener('keydown', e => {
  if (R.role !== 'view' || R.state !== 'live' || /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); inkSendAll({ t: 'undo' }); }
});
function inkHint() { return R.tool === 'laser' ? 'กำลังชี้ให้ ' + esc(R.name) + ' เห็น' : R.tool === 'pen' ? 'กำลังวาดให้ ' + esc(R.name) + ' เห็น' : 'กด "ชี้" หรือ "วาด" เพื่อบอกจุด'; }
function inkBar() {
  const hasPen = R.ink.strokes.some(x => !x.l);
  return '<div class="rtc-ink" id="rtcInkBar"><button class="rtc-tb' + (R.tool === 'laser' ? ' on' : '') + '" data-rtc="tool" data-v="laser" title="ชี้ (เลเซอร์) — เขาเห็นจุดที่คุณชี้ คลิกเพื่อทำวงกระเพื่อม">' + RTC_IC.laser + '<span>ชี้</span></button>' +
    '<button class="rtc-tb' + (R.tool === 'pen' ? ' on' : '') + '" data-rtc="tool" data-v="pen" title="วาด / วงจุดบนจอ">' + RTC_IC.pen + '<span>วาด</span></button>' +
    (R.tool ? '<span class="rtc-dots-c">' + INK_COLORS.map(c => '<button class="rtc-dot' + (c === R.color ? ' on' : '') + '" data-rtc="color" data-v="' + c + '" style="--c:' + c + '" aria-label="สี"></button>').join('') + '</span>' : '') +
    (hasPen ? '<button class="rtc-tb" data-rtc="undo" title="ย้อน (Ctrl+Z)">' + RTC_IC.undo + '</button><button class="rtc-tb" data-rtc="clear" title="ล้างที่วาดทั้งหมด">' + RTC_IC.eraser + '</button>' : '') + '</div>';
}
function inkBarSync() {
  const b = $('#rtcInkBar'); if (b) b.outerHTML = inkBar();
  const x = $('#rtcBox'); if (x) x.classList.toggle('drawing', !!R.tool);
  const h = $('#rtcInkHint'); if (h) h.innerHTML = inkHint();
}
/* คนแชร์: ภาพจอตัวเอง + จุดที่อีกฝ่ายชี้ (ในหน้า หรือหน้าต่างลอยอยู่บนสุด) */
function peekBar() {
  return '<span class="rtc-peek-rec"></span><b>' + esc(R.name) + (R.pip ? ' ชี้บนจอคุณ' : R.src === 'camera' ? ' เห็นภาพกล้องนี้' : ' เห็นจอนี้') + '</b>' +
    '<button data-peek="laser" class="' + (R.tool === 'laser' ? 'on' : '') + '" title="ชี้ให้ ' + esc(R.name) + ' เห็น">' + RTC_IC.laser + '</button>' +
    '<button data-peek="pen" class="' + (R.tool === 'pen' ? 'on' : '') + '" title="วาด/เขียนบอก ' + esc(R.name) + ' (เขาเห็นด้วย)">' + RTC_IC.pen + '</button>' +
    (R.tool ? INK_COLORS.map(c => '<button data-peek="c" data-c="' + c + '" class="pk-dot' + (c === R.color ? ' on' : '') + '" style="--c:' + c + '" aria-label="สี"></button>').join('') : '') +
    (R.ink.strokes.some(x => !x.l) ? '<button data-peek="undo" title="ย้อน">' + RTC_IC.undo + '</button><button data-peek="clr" title="ล้างที่วาดทั้งหมด">' + RTC_IC.eraser + '</button>' : '') +
    (R.pip ? '<button data-peek="stop" title="หยุดแชร์">' + RTC_IC.stop + 'หยุด</button>'
      : (CAN_PIP && R.src !== 'camera' ? '<button data-peek="pip" title="หน้าต่างลอยอยู่บนสุดของทุกโปรแกรม">' + RTC_IC.pip + 'ลอย</button>' : '') + '<button data-peek="hide" title="ซ่อน">✕</button>');
}
function renderPeek() {
  const want = R.role === 'host' && R.state === 'live' && R.stream;
  if (!want) { if (R.peek) { R.peek.remove(); R.peek = null; } return; }
  if (!R.peek) {
    const el = document.createElement('div'); el.className = 'rtc-peek';
    // แสดงภาพจอ/กล้องที่กำลังแชร์ไว้ใต้เส้นที่อีกฝ่ายวาด (ทั้งในแอปและหน้าต่างลอย) จะได้รู้ว่าเขาชี้ตรงไหน
    el.innerHTML = '<div class="rtc-peek-bar"></div><div class="rtc-peek-box"><video autoplay playsinline muted></video><canvas></canvas></div><div class="rtc-peek-where" id="peekWhere">รอ ' + esc(R.name) + ' ชี้…</div>';
    { const v = el.querySelector('video'); v.srcObject = R.stream; v.addEventListener('loadedmetadata', inkKick); v.play().catch(() => {}); }
    el.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-peek]'); if (!b) return;
      const a = b.dataset.peek;
      if (a === 'pip') rtcPip(); else if (a === 'hide') { R.peekOpen = false; renderRtc(); }
      else if (a === 'clr') { inkSendAll({ t: 'clr' }); renderPeek(); } else if (a === 'stop') rtcHang();
      else if (a === 'undo') { inkSendAll({ t: 'undo' }); renderPeek(); }
      else if (a === 'laser' || a === 'pen') { R.tool = R.tool === a ? '' : a; if (!R.tool) inkSendAll({ t: 'pl' }); renderPeek(); }
      else if (a === 'c') { R.color = b.dataset.c; if (!R.tool) R.tool = 'pen'; renderPeek(); }
    });
    {   // คนแชร์วาด/ชี้บนภาพจอตัวเองได้ด้วย อีกฝ่ายเห็นบนภาพที่เขาดูอยู่
      const cv = el.querySelector('canvas');
      cv.addEventListener('pointerdown', e => { if (!R.tool || R.state !== 'live') return; const p = inkXY(e); if (p.out) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} R.drawId = uid('k'); inkSendAll({ t: 'b', id: R.drawId, c: R.color, l: R.tool === 'laser' ? 1 : 0, x: p.x, y: p.y }); });
      cv.addEventListener('pointermove', e => { if (!R.tool || R.state !== 'live') return; const p = inkXY(e); if (R.drawId) return inkSendAll({ t: 'm', id: R.drawId, x: p.x, y: p.y }); if (p.out) return; const now = performance.now(); if (now - inkLastP < 33) return; inkLastP = now; inkSendAll({ t: 'p', x: p.x, y: p.y, c: R.color }); });
      const up = () => { if (!R.drawId) return; const id = R.drawId; R.drawId = ''; inkSendAll({ t: 'e', id: id }); renderPeek(); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { if (!R.drawId && R.tool) inkSendAll({ t: 'pl' }); });
    }
    R.peek = el;
  }
  R.peek.querySelector('.rtc-peek-bar').innerHTML = peekBar();
  R.peek.classList.toggle('in-pip', !!R.pip); R.peek.classList.toggle('drawing', !!R.tool);
  const home = R.pip ? R.pip.document.body : R.peekOpen ? document.body : null;
  if (!home) R.peek.remove();
  else if (R.peek.parentNode !== home) { home.appendChild(R.peek); const v = R.peek.querySelector('video'); if (v) v.play().catch(() => {}); }
  inkKick();
}
async function rtcPip() {
  if (!CAN_PIP) return toast('เครื่องนี้เปิดหน้าต่างลอยไม่ได้ ใช้ Chrome หรือ Edge บนคอมพิวเตอร์', true);
  if (R.role !== 'host' || R.state !== 'live') return;
  if (R.pip) { try { R.pip.close(); } catch (e) {} return; }
  if (R.pipEarly) return pipAttach(R.pipEarly);
  let w;
  try { w = await window.documentPictureInPicture.requestWindow({ width: 360, height: 250 }); } catch (e) { return toast('เปิดหน้าต่างลอยไม่สำเร็จ', true); }
  pipPrep(w); pipAttach(w);
}
function pipPrep(w) {
  if (w.__prep) return; w.__prep = 1;
  const st = w.document.createElement('style'); st.textContent = PEEK_CSS; w.document.head.appendChild(st);
  w.document.body.className = 'pip-body'; w.document.title = 'คิวงาน · ' + R.name;
  w.document.body.innerHTML = '<div class="pip-wait">กำลังเชื่อมต่อกับ ' + esc(R.name) + '…<br><small>หน้าต่างนี้จะแสดงจุดที่เขาชี้/วาดบนจอคุณ</small></div>';
  w.addEventListener('pagehide', () => { if (R.pipEarly === w) R.pipEarly = null; });
}
function pipAttach(w) {
  if (R.pipEarly === w) R.pipEarly = null;
  const ww = w.document.querySelector('.pip-wait'); if (ww) ww.remove();
  if (R.inkRaf) { try { (R.inkWin || window).cancelAnimationFrame(R.inkRaf); } catch (e) {} R.inkRaf = 0; }
  R.pip = w; inkTitle(false);
  w.addEventListener('pagehide', () => {
    if (R.pip !== w) return;
    try { w.cancelAnimationFrame(R.inkRaf); } catch (e) {} R.inkRaf = 0; R.pip = null;
    renderRtc();
  });
  renderRtc();
}
/* demo: จำลองอีกฝ่ายชี้และวงจุดบนจอ */
function inkDemo() {
  let t = 0; clearInterval(R.demoInk);
  R.demoInk = setInterval(() => {
    if (R.role !== 'host' || R.state !== 'live') return clearInterval(R.demoInk);
    t++;
    if (t < 40) inkApply({ t: 'p', x: .25 + t * .008, y: .3 + Math.sin(t / 6) * .05, c: INK_COLORS[0] });
    else if (t === 40) inkApply({ t: 'b', id: 'd1', c: INK_COLORS[0], l: 0, x: .62, y: .5 });
    else if (t < 70) { const a = (t - 40) / 29 * Math.PI * 2.1; inkApply({ t: 'm', id: 'd1', x: .55 + Math.cos(a) * .07, y: .5 + Math.sin(a) * .11 }); }
    else if (t === 70) { inkApply({ t: 'e', id: 'd1' }); renderPeek(); }
    else if (t > 140) { inkApply({ t: 'clr' }); t = 0; renderPeek(); }
  }, 60);
}

/* demo mode: no second person, so show a simulated screen */
function rtcDemoLive() {
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 760; const g = cv.getContext('2d');
  const draw = t => {
    g.fillStyle = '#1d232a'; g.fillRect(0, 0, 1280, 760);
    g.fillStyle = '#2a323b'; g.fillRect(0, 0, 1280, 40); g.fillRect(0, 40, 220, 720);
    g.fillStyle = '#8fa3b5'; g.font = '16px sans-serif'; g.fillText('CAD — ring_R1042.3dm   (หน้าจอจำลองของ ' + R.name + ')', 16, 26);
    ['Layers', 'Curve', 'Surface', 'Solid', 'Mesh', 'Render'].forEach((s, i) => { g.fillStyle = i === 2 ? '#3b6ea8' : '#333d47'; g.fillRect(14, 64 + i * 46, 192, 36); g.fillStyle = '#d6e0ea'; g.fillText(s, 28, 88 + i * 46); });
    g.strokeStyle = '#26303a'; g.lineWidth = 1; for (let x = 240; x < 1280; x += 40) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 760); g.stroke(); } for (let y = 40; y < 760; y += 40) { g.beginPath(); g.moveTo(220, y); g.lineTo(1280, y); g.stroke(); }
    const a = t / 1400; g.save(); g.translate(750, 400);
    for (let k = 0; k < 28; k++) { const ph = a + k * Math.PI / 14; g.strokeStyle = 'hsla(' + (190 + k * 4) + ',70%,' + (55 + 15 * Math.sin(ph)) + '%,.85)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 200 * Math.abs(Math.cos(ph)) + 18, 200, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, -200, 26, 0, Math.PI * 2); g.fill(); g.restore();
    const mx = 750 + Math.cos(a * 1.7) * 260, my = 420 + Math.sin(a * 2.3) * 160;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 14, my + 34); g.lineTo(mx + 20, my + 20); g.lineTo(mx + 34, my + 14); g.closePath(); g.fill();
    g.fillStyle = '#8fa3b5'; g.fillText(new Date().toLocaleTimeString('th-TH'), 1180, 26);
    R.raf = requestAnimationFrame(draw);
  };
  R.raf = requestAnimationFrame(draw);
  R.remote = cv.captureStream(24); R.demo = true; R.state = 'live'; R.t0 = Date.now(); renderRtc(); ping(false);
}

/* ============ brand ============ */
function applyBrand() {
  const s = S.settings || defaultSettings();
  document.documentElement.style.setProperty('--brand', /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : '#0B6B70');
  document.title = s.appName || 'KiwNgan คิวงาน'; if (lastBadge > 0) appBadge(lastBadge);
  applyTheme();
}
function brandMark(s) {
  return s.logo ? '<div class="brand-mark"><img src="' + esc(s.logo) + '" alt=""></div>'
    : '<div class="brand-mark">' + esc(String(s.appName || 'K').replace(/\s.*/, '').slice(0, 2)) + '</div>';
}

/* ============ render: shell ============ */
function teamBadge() {
  const ids = {}; M.list.forEach(m => { if (!m.read) ids[m.id] = 1; }); openHelps().forEach(m => { ids[m.id] = 1; });
  const n = Object.keys(ids).length; if (!n) { M.lastBadge = 0; return ''; }
  const grow = n > (M.lastBadge || 0); M.lastBadge = n;
  return '<span class="count' + (openHelps().length ? ' sos' : '') + (grow ? ' pop' : '') + '" title="ข้อความใหม่ / ขอความช่วยเหลือ">' + (n > 99 ? '99+' : n) + '</span>';
}
function navHtml(withCount, tabs) {
  const late = listPool().filter(isLate).length, vs = viewsFor(S.user);
  let g = '';
  return vs.map(v => (!tabs && v.g && v.g !== g && (g = v.g) && vs.length > 4 ? '<div class="nav-h">' + esc(v.g) + '</div>' : '') + '<button data-view="' + v.id + '" aria-current="' + (S.view === v.id) + '">' + I[v.id] + '<span>' + (tabs ? v.short || v.label : v.label) + '</span>' +
    (withCount && v.id === 'prod' && typeof prodsAll === 'function' ? (n => n ? '<span class="count pc">' + n + '</span>' : '')(prodsAll().filter(p => p.stage === 'wait').length) : '') +
    (withCount && v.id === 'board' && late ? '<span class="count">' + late + '</span>' : '') +
    (withCount && v.id === 'team' && typeof M !== 'undefined' ? teamBadge() : '') + '</button>').join('');
}
function renderShell() {
  const s = S.settings || defaultSettings();
  $('#brand').innerHTML = brandMark(s) + '<div><b>' + esc(s.appName) + '</b><small>' + esc(s.company) + '</small></div>';
  $('#nav').innerHTML = navHtml(true);
  { const fab = $('.fab'), pv = S.view === 'prod', lbl = pv ? 'เพิ่มงานเข้าผลิต' : 'เพิ่มงาน'; if (fab) { fab.style.display = (pv && !canProd()) || (!pv && isProdRole()) ? 'none' : ''; fab.dataset.tip = lbl; fab.setAttribute('aria-label', lbl); } }
  $('#tabbar').innerHTML = navHtml(true, true); $('#tabbar').style.setProperty('--tabs', viewsFor(S.user).length);
  const connCls = mode() === 'demo' ? '' : (S.sync === 'err' ? 'err' : 'ok');
  const connTxt = mode() === 'demo' ? 'โหมดทดลอง (เก็บในเครื่องนี้)' : (S.sync === 'err' ? 'เชื่อมต่อไม่ได้' : S.sync === 'busy' ? 'กำลังซิงก์…' : (isAdmin() ? 'เชื่อมต่อ Google Sheet' : 'ซิงก์ข้อมูลแล้ว'));
  $('#railFoot').innerHTML = '<button class="me-chip" data-go="settings" data-sec="me">' + av(S.me) + '<span><small>' + ROLES[roleOf(S.user)].label + '</small><b>' + esc(S.me) + '</b></span>' + roleChip(S.user, true) + '</button>' +
    '<div class="conn ' + connCls + '"><i></i>' + connTxt + '</div>';
  renderTimerbar();
}
function renderTimerbar() {
  const runs = S.me ? S.logs.filter(l => !l.end && l.member === S.me) : [], el = $('#timerbar');
  if (!runs.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.classList.toggle('multi', runs.length > 1);
  el.innerHTML = runs.map(r => { const j = jobById(r.jobId);
    return '<div class="t-run"><span class="pulse"></span><button class="t-job" data-open="' + esc(r.jobId) + '">' + esc(j ? j.code : 'งาน') + '</button>' +
      '<span class="t-clock" data-since="' + esc(r.start) + '">' + clock(Date.now() - parseLocal(r.start)) + '</span>' +
      '<button class="btn sm" data-act="stop" data-log="' + esc(r.id) + '">' + I.stop + 'หยุด</button></div>'; }).join('');
}

function render() {
  if (!S.settings || S.screen !== 'app') return;
  renderShell();
  const v = $('#view');
  let h = banner();
  if (S.view === 'flow') h += viewFlow();
  else if (S.view === 'prod') h += viewProd();
  else if (S.view === 'board') h += viewBoard();
  else if (S.view === 'list') h += viewList();
  else if (S.view === 'team') h += viewTeam();
  else if (S.view === 'report') h += viewReport();
  else if (S.view === 'settings') h += viewSettings();
  else h += viewHome();
  v.innerHTML = h;
  decorate(v);
  { const gs = v.querySelector('.gscroll'), tl = gs && gs.querySelector('.gtoday'); if (gs && tl && gs.scrollWidth > gs.clientWidth) { const tr = tl.parentNode; gs.scrollLeft = Math.max(0, tr.offsetLeft + tl.offsetLeft - gs.clientWidth * 0.6); } }   // เลื่อนไทม์ไลน์ให้เห็น "วันนี้"
  paintAllThumbs(v);
  renderMsgFab();
  if (S.animIn) {
    S.animIn = false;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); clearTimeout(S.animT); S.animT = setTimeout(() => v.classList.remove('enter'), 1400); countUp(v); }
  }
  if (S.edit) renderEditor();
  if (P2.id || P2.add) pModalDraw();
}

function banner() {
  if (mode() === 'demo') return '<div class="banner"><span><b>โหมดทดลอง</b> ข้อมูลตัวอย่างเก็บในเบราว์เซอร์นี้เท่านั้น ลองเข้าเป็นผู้ใช้งาน (ต้น ฝน บอส) หรือผู้ดูแลระบบ เพื่อดูสิทธิ์ที่ต่างกัน</span>' + (isAdmin() ? '<button class="btn sm" data-go="settings" data-sec="conn">เชื่อมต่อ Google Sheet</button>' : '') + '</div>';
  if (S.sync === 'err') return '<div class="banner err"><span><b>ซิงก์ไม่สำเร็จ</b> ' + esc(S.syncErr) + '</span><button class="btn sm" data-act="refresh">' + I.refresh + 'ลองอีกครั้ง</button></div>';
  return '';
}

function newBtn() {
  if (S.view === 'prod') return canProd() ? '<button class="btn primary new" data-act="new">' + I.plus + 'เพิ่มงานเข้าผลิต</button>' : '';
  if (isProdRole()) return '';   // ฝ่ายผลิตดูงานฝ่ายแบบได้อย่างเดียว
  return '<button class="btn primary new" data-act="new">' + I.plus + 'เพิ่มงาน</button>';
}
function topbar(title, sub, extra) {
  const s = S.settings;
  const d = new Date();
  const hr = d.getHours(), tod = hr < 6 || hr >= 18 ? 'moon' : hr < 11 ? 'sunrise' : 'sun';
  return '<div class="topbar"><span class="hero-ic" aria-hidden="true">' + (I[S.view] || I.home) + '</span><span class="hero-dots" aria-hidden="true"><i></i><i></i><i></i></span><div><div class="eyebrow"><span class="tod ' + tod + '" aria-hidden="true">' + DECO[tod] + '</span>' + esc(s.company) + ' · วัน' + TH_D[d.getDay()] + ' ' + fdY(today()) + '</div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
    '<div class="top-actions">' + (extra || '') + (S.me ? (n => '<button class="btn top-due' + (n ? ' has' : '') + '" data-act="dueopen" title="กำหนดส่งงาน">' + STI.hourglass + '<span>กำหนดส่ง</span>' + (n ? '<b class="badge">' + n + '</b>' : '') + '</button>')(dueCount()) : '') + '<button class="btn top-msg' + (unreadAll() ? ' has' : '') + '" data-act="msgopen" title="ข้อความ">' + MSG_IC.chat + '<span>ข้อความ</span>' + (unreadAll() ? '<b class="badge msg-n">' + (unreadAll() > 99 ? '99+' : unreadAll()) + '</b>' : '') + '</button>' + (mode() === 'sheet' ? '<button class="btn" data-act="refresh" title="ดึงข้อมูลล่าสุด">' + I.refresh + '<span>รีเฟรช</span></button>' : '') +
    newBtn() + '</div></div>';
}

/* ============ render: home ============ */
/* ===== ไทม์ไลน์เส้นทางงาน: เลข Job เดียวกัน = งานเดียว (CAD → CAM …) เดินตามวันที่จนถึงวันจบงาน ===== */
function ganttRange() {
  const g = S.gr || { p: 'auto' }, t = today(), d = new Date(), iso = (y, m, dd) => isoOf(new Date(y, m, dd));
  if (g.p === '2w') return { p: g.p, from: addDays(t, -7), to: addDays(t, 7) };
  if (g.p === 'month') return { p: g.p, from: iso(d.getFullYear(), d.getMonth(), 1), to: iso(d.getFullYear(), d.getMonth() + 1, 0) };
  if (g.p === 'next') return { p: g.p, from: iso(d.getFullYear(), d.getMonth() + 1, 1), to: iso(d.getFullYear(), d.getMonth() + 2, 0) };
  if (g.p === 'last') return { p: g.p, from: iso(d.getFullYear(), d.getMonth() - 1, 1), to: iso(d.getFullYear(), d.getMonth(), 0) };
  if (g.p === 'custom') { let f = g.from || addDays(t, -14), to = g.to || addDays(t, 14); if (to < f) { const x = f; f = to; to = x; } if (daysBetween(f, to) > 366) to = addDays(f, 366); return { p: g.p, from: f, to: to }; }
  return { p: 'auto' };
}
function ganttPanel(pool) {
  const t = today(), recent = addDays(t, -30);
  if (S.gg === undefined) { S.gg = LS.get('ganttGroup', 'all'); S.ganttDone = !!LS.get('ganttDone', false); S.gr = LS.get('ganttRange', null) || { p: 'auto' }; }
  const R0 = ganttRange(), rng = R0.p !== 'auto';
  const groups = (S.settings.groups || []).slice();
  const byCode = {};
  pool.forEach(j => { if (!j.code) return; (byCode[j.code] = byCode[j.code] || []).push(j); });
  let rows = Object.keys(byCode).map(code => {
    const js = byCode[code].slice().sort((a, b) => String(a.received || a.createdAt || '').localeCompare(String(b.received || b.createdAt || '')));
    const open = js.some(isOpen), lastFin = js.map(finDate).filter(Boolean).sort().pop() || '';
    const segs = js.map(j => {
      const st = String(j.received || j.createdAt || t).slice(0, 10), fin = finDate(j), due = j.due || '';
      return { j: j, st: st, fin: fin, due: due, end: fin || (due && due > t ? due : t) };
    });
    const start = segs.reduce((m, x) => x.st < m ? x.st : m, segs[0].st);
    const end = open ? segs.reduce((m, x) => { const e = x.fin || x.due || t; return e > m ? e : m; }, t) : lastFin;
    const dueLast = segs.map(x => x.due).filter(Boolean).sort().pop() || '';
    return { code: code, js: js, segs: segs, open: open, start: start, end: end, fin: open ? '' : lastFin, due: dueLast, group: js[js.length - 1].group || '', late: js.some(isLate) };
  }).filter(r => rng ? (r.start <= R0.to && (r.fin || r.end) >= R0.from) : (r.open || (S.ganttDone && r.fin && r.fin >= recent)));
  const counts = {}; rows.forEach(r => { counts[r.group] = (counts[r.group] || 0) + 1; });
  if (S.gg !== 'all' && !groups.includes(S.gg)) S.gg = 'all';
  if (S.gg !== 'all') rows = rows.filter(r => r.group === S.gg);
  rows.sort((a, b) => (b.open - a.open) || (a.open ? (a.due || '9').localeCompare(b.due || '9') : b.fin.localeCompare(a.fin)));
  const more = rows.length > 25; if (!S.ganttAll) rows = rows.slice(0, 25);
  const chips = '<div class="hp-chips gantt-chips"><button class="hp-chip' + (S.gg === 'all' ? ' on' : '') + '" data-gg="all">ทั้งหมด</button>' +
    groups.filter(g => counts[g]).map(g => '<button class="hp-chip' + (S.gg === g ? ' on' : '') + '" data-gg="' + esc(g) + '"><i class="gdot" style="background:' + (groupColor(g) || '#64748B') + '"></i>' + esc(groupShort(g)) + ' <em>' + counts[g] + '</em></button>').join('') +
    '<div class="g-range"><select data-grange="1" aria-label="ช่วงเวลา">' + [['auto', 'อัตโนมัติ (งานค้าง)'], ['2w', '± 1 สัปดาห์'], ['month', 'เดือนนี้'], ['next', 'เดือนหน้า'], ['last', 'เดือนก่อน'], ['custom', 'กำหนดเอง']].map(o => '<option value="' + o[0] + '"' + (R0.p === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      (rng ? '<input type="date" data-gfrom="1" value="' + R0.from + '" aria-label="ตั้งแต่"><span>–</span><input type="date" data-gto="1" value="' + R0.to + '" aria-label="ถึง">'
        : '<label class="toggle sm gdone-t"><input type="checkbox" data-act="ganttdone"' + (S.ganttDone ? ' checked' : '') + '>งานที่จบแล้ว (30 วัน)</label>') + '</div></div>';
  const head = '<section class="panel gantt-p"><div class="panel-h"><div><h2>เส้นทางงาน</h2><div class="sub">รับงาน → แต่ละขั้น (CAD, CAM …) → วันจบงาน</div></div>' +
    '<div class="legend"><span><i style="background:var(--muted);opacity:.35"></i>ช่วงกำหนดส่ง</span><span><i style="background:var(--late)"></i>เลยกำหนด</span><span><i class="lg-today"></i>วันนี้</span></div></div>' + chips;
  if (!rows.length) return head + '<div class="empty"><b>ยังไม่มีงานในช่วงนี้</b>' + (S.gg !== 'all' ? 'ลองเลือก "ทั้งหมด"' : rng ? 'ลองเปลี่ยนช่วงวันที่' : '') + '</div></section>';
  let a = rows.reduce((m, r) => r.start < m ? r.start : m, t), b = rows.reduce((m, r) => r.end > m ? r.end : m, addDays(t, 3));
  if (a < addDays(t, -60)) a = addDays(t, -60); if (b > addDays(t, 60)) b = addDays(t, 60);
  a = addDays(a, -1); b = addDays(b, 2);
  if (rng) { a = R0.from; b = R0.to; }
  const span = daysBetween(a, b) + 1, X = iso => Math.max(0, Math.min(100, daysBetween(a, iso) / span * 100)), W = (x, y) => Math.max(0.6, X(y) - X(x));
  const step = span > 70 ? 7 : span > 35 ? 3 : span > 18 ? 2 : 1;
  let grid = '', ticks = '';
  for (let i = 0; i < span; i++) {
    const d = addDays(a, i), dd = parseLocal(d), wk = dd.getDay() === 0 || dd.getDay() === 6;
    if (wk || isHoliday(d)) grid += '<i class="gw' + (isHoliday(d) ? ' hol' : '') + '" style="left:' + X(d) + '%;width:' + (100 / span) + '%" title="' + esc(holidayName(d)) + '"></i>';
    const nearM = dd.getDate() !== 1 && [1, 2].some(k => k < step + 1 && i + k < span && parseLocal(addDays(d, k)).getDate() === 1);
    if ((i % step === 0 && !nearM && i > 0) || dd.getDate() === 1) ticks += '<span class="gt' + (dd.getDate() === 1 ? ' m' : '') + '" style="left:' + (X(d) + 50 / span) + '%">' + (dd.getDate() === 1 || i === 0 ? dd.getDate() + ' ' + TH_M[dd.getMonth()] : dd.getDate()) + '</span>';
  }
  const tx = X(t) + 50 / span;
  const rowH = r => {
    const last = r.js.filter(isOpen).pop() || r.js[r.js.length - 1];
    const bars = r.segs.map(x => {
      const c = typeColor(x.j.taskType) || 'var(--brand)', s0 = x.st;
      let h = '';
      if (x.due && x.due >= s0) h += '<i class="gplan" style="left:' + X(s0) + '%;width:' + W(s0, addDays(x.due, 1)) + '%;--c:' + c + '"></i>';
      const actEnd = x.fin ? addDays(x.fin, 1) : (x.due && x.due < t ? addDays(x.due, 1) : addDays(t, 1));
      h += '<i class="gact' + (x.fin ? ' fin' : '') + '" data-open="' + esc(x.j.id) + '" style="left:' + X(s0) + '%;width:' + W(s0, actEnd) + '%;--c:' + c + '"><b>' + esc(String(x.j.taskType || '').replace(/^ทำ\s*/, '')) + '</b></i>';
      if (!x.fin && x.due && x.due < t) h += '<i class="glate" style="left:' + X(addDays(x.due, 1)) + '%;width:' + W(addDays(x.due, 1), addDays(t, 1)) + '%"></i>';
      if (x.fin) h += '<i class="gdone" style="left:' + X(addDays(x.fin, 1)) + '%" title="เสร็จ ' + esc(fd(x.fin)) + '">✓</i>';
      return h;
    }).join('');
    const endTxt = r.open ? (r.due ? (r.late ? '<em class="late">เลย ' + fd(r.due) + '</em>' : 'จบ ' + fd(r.due)) : 'ยังไม่กำหนด') : '<em class="ok">จบแล้ว ' + fd(r.fin) + '</em>';
    return '<div class="grow' + (r.open ? '' : ' closed') + '" data-open="' + esc(last.id) + '" role="button" tabindex="0">' +
      '<div class="glab"><span class="gl1"><b class="mono">' + esc(r.code) + '</b>' + stPill(last) + '</span><small>' + (r.group ? '<i class="gdot" style="background:' + (groupColor(r.group) || '#64748B') + '"></i>' + esc(groupShort(r.group)) + ' · ' : '') + esc(last.title || '') + '</small></div>' +
      '<div class="gtrack">' + bars + '</div><div class="gend">' + endTxt + '</div></div>';
  };
  return head + '<div class="gantt"><div class="gscroll"><div class="ghead"><div class="glab"></div><div class="gtrack">' + ticks + '</div><div class="gend"></div></div>' +
    '<div class="gbody"><div class="ggrid"><div class="glab"></div><div class="gtrack">' + grid + (t >= a && t <= b ? '<i class="gtoday" style="left:' + tx + '%"></i>' : '') + '</div><div class="gend"></div></div>' + rows.map(rowH).join('') + '</div></div></div>' +
    (more ? '<div class="top-actions"><button class="btn sm ghost" data-act="ganttall">' + (S.ganttAll ? 'แสดงแค่ 25 งาน' : 'ดูทั้งหมด') + '</button></div>' : '') + '</section>';
}
function viewHome() {
  /* พนักงานเห็นภาพรวมเฉพาะงานตัวเอง + ตัวเลขรวมของทีม (ไม่มีชื่อ) — หัวหน้างาน/แอดมินเห็นทั้งทีม */
  const lead = isLead() || isProdRole(), pool = listPool();
  const t = today(), open = pool.filter(isOpen), late = open.filter(isLate), urgent = open.filter(j => j.priority === 'urgent');
  const m = t.slice(0, 7), doneM = pool.filter(j => j.status === 'done' && finDate(j).slice(0, 7) === m);
  const okM = doneM.filter(onTime).length;
  const pct = doneM.length ? Math.round(okM / doneM.length * 100) : null;
  const doingJ = open.filter(j => j.status === 'doing'), doing = doingJ.length, queue = open.filter(j => j.status === 'queue' || j.status === 'hold').length, review = open.filter(j => j.status === 'review').length, fixN = open.filter(j => j.status === 'fix').length;
  const timing = doingJ.filter(j => runningOf(j.id)).length;

  const kp = [
    { k: 'var(--accent)', l: 'งานที่ยังไม่เสร็จ', n: open.length, s: 'ทำ ' + doing + ' · ตรวจ ' + review + (fixN ? ' · แก้ ' + fixN : '') + ' · คิว ' + queue, f: 'open' },
    { k: 'var(--doing)', l: 'กำลังทำ', n: doing, s: doing ? (timing ? 'จับเวลาอยู่ ' + timing + ' งาน' : doingJ.slice(0, 2).map(j => j.code).join(', ') + (doing > 2 ? ' …' : '')) : 'ยังไม่มีงานที่กำลังทำ', f: 'doing', live: timing },
    { k: 'var(--late)', l: 'เลยกำหนดส่ง', n: late.length, s: late.length ? 'ต้องเร่งปิดงาน' : 'ไม่มีงานค้างเกินกำหนด', f: 'late' },
    { k: 'var(--urgent)', l: 'งานด่วนคงค้าง', n: urgent.length, s: 'ติดธงงานด่วน', f: 'urgent' },
    { k: 'var(--done)', l: 'เสร็จเดือนนี้', n: doneM.length, s: (pct === null ? 'เดือนนี้ยังไม่มีงานเสร็จ' : 'ตรงเวลา ' + pct + '%') + ' · รวมทุกเดือน ' + pool.filter(j => j.status === 'done').length, f: 'done', m: m }
  ].map(x => '<button class="kpi k-' + x.f + (x.live ? ' is-live' : '') + '" style="--k:' + x.k + '" data-filter-go="' + x.f + '"' + (x.m ? ' data-fmonth="' + x.m + '"' : '') + '><i class="kpi-ic" aria-hidden="true">' + KPI_IC[x.f] + '</i><span>' + x.l + '</span><b>' + x.n + '</b><small>' + x.s + '</small></button>').join('');

  // me
  let mine = '';
  {
    const my = open.filter(j => inJob(j, S.me)).sort(sortOpen);
    mine = '<section class="panel"><div class="panel-h"><div><h2>งานของ' + esc(S.me) + '</h2><div class="sub">' + my.length + ' งานค้าง · ใช้เวลาวันนี้ ' + fdur(minutesOn(t, S.me)) + '</div></div><div class="top-actions"><button class="btn sm t-sosbtn" data-act="askhelp" data-job="">' + MSG_IC.sos + '<span>ขอความช่วยเหลือ</span></button><button class="btn ghost sm" data-mine="1">ดูบนบอร์ด</button></div></div>' +
      (my.length ? '<div class="alist">' + my.slice(0, 5).map(aItem).join('') + '</div>' : '<div class="empty"><b>ไม่มีงานค้าง</b>กดปุ่ม + เพื่อรับงานใหม่</div>') + '</section>';
  }

  // finished-jobs chart over a chosen date range
  const hr = homeRange(), span = daysBetween(hr.from, hr.to) + 1, weekly = span > 62;
  const days = []; for (let i = 0; i < span; i++) days.push(addDays(hr.from, i));
  const keyOf = d => { if (!weekly) return d; const x = parseLocal(d); return addDays(d, -((x.getDay() + 6) % 7)); };
  const keys = []; days.forEach(d => { const k = keyOf(d); if (keys.indexOf(k) < 0) keys.push(k); });
  const per = {}; keys.forEach(k => per[k] = { ok: 0, late: 0 });
  const doneAll = pool.filter(j => j.status === 'done' && finDate(j) >= hr.from && finDate(j) <= hr.to);
  /* หัวหน้างาน/แอดมิน: เลือกดูทุกคนหรือทีละคน — "ทุกคน" แท่งกราฟแยกสีตามคน */
  let hp = lead ? (S.hp != null ? S.hp : LS.get('homePerson', '')) : '';
  const pplCount = {}; doneAll.forEach(j => { const k = j.assignee || ''; pplCount[k] = (pplCount[k] || 0) + 1; });
  const ppl = []; designers().forEach(x => { if (ppl.indexOf(x.name) < 0 && (pplCount[x.name] || x.role !== 'admin')) ppl.push(x.name); }); Object.keys(pplCount).forEach(n => { if (ppl.indexOf(n) < 0) ppl.push(n); });
  if (hp && ppl.indexOf(hp === '__none' ? '' : hp) < 0) hp = '';
  const done30 = hp ? doneAll.filter(j => (j.assignee || '') === (hp === '__none' ? '' : hp)) : doneAll;
  const byPerson = lead && !hp && LS.get('chartType', 'bar') === 'bar' && ppl.length > 1;
  const pColor = n => n ? ((memberBy(n) || {}).color || '#5B6B7A') : '#9AA5B0';
  done30.forEach(j => { const k = keyOf(finDate(j)); if (per[k]) { per[k][onTime(j) ? 'ok' : 'late']++; const w = j.assignee || ''; (per[k].who = per[k].who || {})[w] = (per[k].who[w] || 0) + 1; } });
  let max = Math.max(2, ...keys.map(d => per[d].ok + per[d].late)); if (max % 2) max++;
  const every = Math.max(1, Math.ceil(keys.length / 7));
  const bars = keys.map((d, i) => {
    const p = per[d], n = p.ok + p.late, wd = parseLocal(d).getDay();
    const lab = (i % every === 0 || i === keys.length - 1) ? '<em>' + (weekly || span > 31 ? fd(d < hr.from ? hr.from : d) : parseLocal(d).getDate()) + '</em>' : '';
    const tipD = weekly ? 'สัปดาห์ ' + fd(d < hr.from ? hr.from : d) + ' – ' + fd(addDays(d, 6) > hr.to ? hr.to : addDays(d, 6)) : fd(d);
    const who = p.who ? ppl.filter(x => p.who[x]).map(x => (x || 'ยังไม่มอบหมาย') + ' ' + p.who[x]).join(', ') : '';
    const segs = byPerson ? ppl.filter(x => p.who && p.who[x]).map(x => '<i class="pp-seg" style="flex:' + p.who[x] + ';background:' + esc(pColor(x)) + '"></i>').join('')
      : (p.ok ? '<i style="flex:' + p.ok + '"></i>' : '') + (p.late ? '<i class="late" style="flex:' + p.late + '"></i>' : '');
    return '<div class="bar' + (!weekly && d === t ? ' today' : '') + (!weekly && (wd === 0 || wd === 6) ? ' wk' : '') + (byPerson && p.late ? ' has-late' : '') + '"' + (byPerson && p.late ? ' style="--h:' + (n / max * 100) + '%"' : '') + (n ? ' data-tip="' + esc(tipD + ' · เสร็จ ' + n + (p.late ? ' (ช้า ' + p.late + ')' : '') + (lead && !hp && who ? ' — ' + who : '')) + '"' : '') + '><div class="stack' + (byPerson ? ' by-p' : '') + '" style="height:' + (n / max * 100) + '%">' +
      segs + '</div>' + lab + '</div>';
  }).join('');
  const ctype = LS.get('chartType', 'bar');
  const ctTabs = '<div class="ct-tabs" role="tablist" aria-label="รูปแบบกราฟ">' + CHART_TYPES.map(c => '<button data-ctype="' + c[0] + '" aria-pressed="' + (ctype === c[0]) + '" title="' + c[1] + '">' + c[2] + '<span>' + c[1] + '</span></button>').join('') + '</div>';
  const rangeTxt = hr.from === hr.to ? fdY(hr.from) : fdY(hr.from) + ' – ' + fdY(hr.to);
  const hrCtl = ctTabs + '<div class="hr-ctl"><div class="hr-chips">' + H_PRESETS.map(x => '<button class="chip sm" data-hpreset="' + x[0] + '" aria-pressed="' + (hr.preset === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
    '<div class="hr-dates"><label>' + STI.calendar + '<input type="date" id="hFrom" value="' + hr.from + '" max="' + t + '" aria-label="ตั้งแต่วันที่"></label><span>–</span><label><input type="date" id="hTo" value="' + hr.to + '" max="' + t + '" aria-label="ถึงวันที่"></label></div></div>';
  const hpChips = lead && ppl.length > 1 ? '<div class="hp-chips" role="group" aria-label="เลือกคน"><button class="hp-chip' + (hp ? '' : ' on') + '" data-hperson="">' + I.team + 'ทุกคน <b>' + doneAll.length + '</b></button>' +
    ppl.map(n => { const v = n || '__none'; return '<button class="hp-chip' + (hp === v ? ' on' : '') + '" data-hperson="' + esc(v) + '" style="--pc:' + esc(pColor(n)) + '">' + av(n) + esc(n || 'ยังไม่มอบหมาย') + ' <b>' + (pplCount[n] || 0) + '</b></button>'; }).join('') + '</div>' : '';
  const legendH = byPerson ? '<div class="legend">' + ppl.filter(n => pplCount[n]).map(n => '<span><i style="background:' + esc(pColor(n)) + '"></i>' + esc(n || 'ยังไม่มอบหมาย') + '</span>').join('') + '<span><i class="lg-late"></i>มีงานช้า</span></div>'
    : '<div class="legend"><span><i style="background:var(--accent)"></i>ตรงเวลา</span><span><i style="background:var(--urgent)"></i>ช้ากว่ากำหนด</span></div>';
  const ok30 = done30.filter(onTime).length;
  const withMin = done30.filter(j => j.minutes > 0);
  const avgMin = withMin.length ? withMin.reduce((s, j) => s + j.minutes, 0) / withMin.length : 0;
  const leads = done30.filter(j => j.received).map(j => Math.max(0, daysBetween(j.received, finDate(j))));
  const avgLead = leads.length ? (leads.reduce((a, b) => a + b, 0) / leads.length) : 0;

  // attention
  const att = open.filter(j => isLate(j) || j.priority === 'urgent' || (j.due && daysBetween(t, j.due) <= 1)).sort(sortOpen).slice(0, 7);

  // workload
  const names = designers().map(x => x.name);
  if (open.some(j => !j.assignee)) names.push('');
  const loads = names.map(n => { const js = open.filter(j => (j.assignee || '') === n); return { n: n, js: js }; });
  const topLoad = Math.max(1, ...loads.map(x => x.js.length));
  const loadH = loads.map(x => {
    const c = st => x.js.filter(j => j.status === st).length;
    const seg = ['doing', 'fix', 'review', 'queue', 'hold'].map(st => c(st) ? '<i style="width:' + (c(st) / topLoad * 100) + '%;background:var(--' + st + ')" title="' + ST[st].label + ' ' + c(st) + '"></i>' : '').join('');
    return '<div class="hb"><span>' + av(x.n) + esc(x.n || 'ยังไม่มอบหมาย') + '</span><div class="track">' + seg + '</div><b>' + x.js.length + '</b></div>';
  }).join('') || '<div class="sub">ยังไม่มีรายชื่อทีมงาน</div>';

  // by group 30d
  const agg = {}; done30.forEach(j => { const k = j.group || 'ไม่ระบุ'; agg[k] = (agg[k] || 0) + 1; });
  const arr = Object.entries(agg).sort((a, b) => b[1] - a[1]); const topG = arr.length ? arr[0][1] : 1;
  const grpH = arr.length ? arr.map(a => '<div class="hb"><span title="' + esc(a[0]) + '">' + esc(groupShort(a[0])) + '</span><div class="track"><i style="width:' + (a[1] / topG * 100) + '%;background:var(--accent)"></i></div><b>' + a[1] + '</b></div>').join('') : '<div class="sub">ยังไม่มีงานเสร็จใน 30 วัน</div>';

  // team pulse for staff: totals only, no names
  const tOpen = S.jobs.filter(isOpen), tDoing = tOpen.filter(j => j.status === 'doing').length, tLate = tOpen.filter(isLate).length;
  const pulse = lead ? '' : '<div class="team-pulse"><span class="tp-ic">' + I.team + '</span><span>ทั้งทีมมีงานค้างอยู่ <b>' + tOpen.length + '</b> งาน</span><span class="tp-dot"></span><span>กำลังทำ <b>' + tDoing + '</b></span>' + (tLate ? '<span class="tp-dot"></span><span>เลยกำหนด <b>' + tLate + '</b></span>' : '') + '<small>' + (tOpen.length > members().length * 4 ? 'ช่วงนี้ทีมงานแน่น' : tOpen.length > members().length * 2 ? 'งานทีมปานกลาง' : 'งานทีมเบา') + '</small></div>';
  const grpPanel = '<section class="panel"><div class="panel-h"><div><h2>' + (lead ? 'งานเสร็จตามกลุ่มงาน' : 'งานที่คุณทำเสร็จ ตามกลุ่มงาน') + '</h2><div class="sub">' + rangeTxt + '</div></div></div><div class="hbars">' + grpH + '</div></section>';
  return topbar('สวัสดี' + (S.me ? ' ' + esc(S.me) : '') + ' <span class="wave" aria-hidden="true">👋</span>', lead ? 'ภาพรวมคิวงานของทีมวันนี้' : 'ภาพรวมงานของคุณวันนี้') +
    '<div class="kpis">' + kp + '</div>' + pulse +
    '<div class="grid2">' + mine +
      '<section class="panel"><div class="panel-h"><div><h2>ต้องจัดการก่อน</h2><div class="sub">เลยกำหนด → ด่วน → ส่งภายในพรุ่งนี้</div></div><button class="btn ghost sm" data-filter-go="open">ดูทั้งหมด</button></div>' +
      (att.length ? '<div class="alist">' + att.map(aItem).join('') + '</div>' : '<div class="empty"><b>ไม่มีงานเร่งด่วน</b>คิวงานอยู่ในกำหนดทั้งหมด</div>') + '</section>' +
    '</div>' + ganttPanel(pool) + workloadPanel() +
    '<section class="panel"><div class="panel-h"><div><h2>' + (lead ? 'งานที่เสร็จ' + (hp ? ' · ' + esc(hp === '__none' ? 'ยังไม่มอบหมาย' : hp) : ' · ทุกคน') : 'งานที่คุณทำเสร็จ') + '</h2><div class="sub">' + rangeTxt + ' · ' + span + ' วัน' + (weekly ? ' (รวมเป็นรายสัปดาห์)' : '') + ' · นับตามวันที่ปิดงาน</div></div>' + legendH + '</div>' +
      hrCtl + hpChips + '<div class="minis"><div class="mini"><span>งานเสร็จ</span><b>' + done30.length + '</b></div><div class="mini"><span>ตรงเวลา</span><b>' + (done30.length ? Math.round(ok30 / done30.length * 100) + '%' : '–') + '</b></div>' +
      '<div class="mini"><span>เวลาทำเฉลี่ย/งาน</span><b>' + (avgMin ? fdur(avgMin) : '–') + '</b></div><div class="mini"><span>รับงาน → เสร็จ เฉลี่ย</span><b>' + (leads.length ? avgLead.toFixed(1) + ' วัน' : '–') + '</b></div></div>' +
      chartBlock(keys, per, max, every, weekly, span, hr, done30, bars, lead ? (hp ? [hp === '__none' ? '' : hp] : ppl) : null) + '</section>' +
    (lead ? '<div class="grid2 even">' +
      '<section class="panel"><div class="panel-h"><div><h2>ภาระงานรายคน</h2><div class="sub">งานที่ยังไม่เสร็จ แยกตามสถานะ</div></div><div class="legend"><span><i style="background:var(--doing)"></i>กำลังทำ</span><span><i style="background:var(--fix)"></i>แก้ไข</span><span><i style="background:var(--review)"></i>รอตรวจ</span><span><i style="background:var(--queue)"></i>รอคิว</span></div></div><div class="hbars">' + loadH + '</div></section>' +
      grpPanel + '</div>' : grpPanel);
}
const H_PRESETS = [['7d', '7 วัน'], ['30d', '30 วัน'], ['month', 'เดือนนี้'], ['lastmonth', 'เดือนก่อน'], ['90d', '90 วัน'], ['year', 'ปีนี้']];
function homeRange() {
  const t = today(), d = new Date();
  if (!S.hr) { const sv = LS.get('homeRange', null) || {}; S.hr = { preset: sv.preset || '30d', from: sv.from || '', to: sv.to || '' }; }
  const r = S.hr;
  if (r.preset === '7d') { r.from = addDays(t, -6); r.to = t; }
  else if (r.preset === '30d') { r.from = addDays(t, -29); r.to = t; }
  else if (r.preset === '90d') { r.from = addDays(t, -89); r.to = t; }
  else if (r.preset === 'month') { r.from = t.slice(0, 8) + '01'; r.to = t; }
  else if (r.preset === 'lastmonth') { r.from = isoOf(new Date(d.getFullYear(), d.getMonth() - 1, 1)); r.to = isoOf(new Date(d.getFullYear(), d.getMonth(), 0)); }
  else if (r.preset === 'year') { r.from = d.getFullYear() + '-01-01'; r.to = t; }
  if (!r.from || !r.to) { r.preset = '30d'; r.from = addDays(t, -29); r.to = t; }
  if (r.from > r.to) { const x = r.from; r.from = r.to; r.to = x; }
  if (daysBetween(r.from, r.to) > 730) r.from = addDays(r.to, -730);   // keep the chart readable
  return r;
}
function saveHomeRange() { LS.set('homeRange', S.hr.preset === 'custom' ? S.hr : { preset: S.hr.preset }); }
const CHART_TYPES = [
  ['bar', 'แท่ง', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="13" width="3" height="4" rx="1"/></svg>'],
  ['line', 'เส้น', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 6-8 3 3"/></svg>'],
  ['area', 'พื้นที่', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 20V15l5-6 4 3 6-7 3 3v12z" opacity=".35"/><path d="M3 15l5-6 4 3 6-7 3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>'],
  ['cum', 'สะสม', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M4 18l4-2 4-4 4-2 5-6"/><path d="M17 4h4v4"/></svg>'],
  ['donut', 'วงกลม', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8h-8z" fill="currentColor" stroke="none"/></svg>'],
  ['people', 'รายคน', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><path d="M12 7h9M12 17h5"/></svg>']
];
function chartBlock(keys, per, max, every, weekly, span, hr, done, bars, people) {
  const type = LS.get('chartType', 'bar');
  const lab = d => weekly || span > 31 ? fd(d < hr.from ? hr.from : d) : parseLocal(d).getDate();
  const empty = !done.length ? '<div class="ch-empty">ยังไม่มีงานเสร็จในช่วงนี้</div>' : '';
  if (type === 'bar') return '<div class="chart"><div class="y"><span>' + max + '</span><span>' + (max / 2) + '</span><span>0</span></div><div class="plot">' + bars + '</div></div>';
  if (type === 'donut' || type === 'people') {
    if (!done.length && !(type === 'people' && people && people.length)) return '<div class="chart alt">' + empty + '</div>';
    if (type === 'donut') {
      const ok = done.filter(onTime).length, late = done.length - ok, pct = Math.round(ok / done.length * 100), C = 2 * Math.PI * 42;
      const agg = {}; done.forEach(j => { const k = groupShort(j.group) || 'ไม่ระบุ'; agg[k] = (agg[k] || 0) + 1; });
      const grp = Object.entries(agg).sort((a, b) => b[1] - a[1]), cols = ['var(--brand)', 'var(--doing)', 'var(--review)', 'var(--urgent)', 'var(--done)', 'var(--hold)', 'var(--late)'];
      let acc = 0;
      const ring2 = grp.map((g, i) => { const len = g[1] / done.length * C * 0.72 / 0.84; const seg = '<circle r="30" cx="60" cy="60" fill="none" stroke="' + cols[i % cols.length] + '" stroke-width="10" pathLength="' + (C) + '" stroke-dasharray="' + (g[1] / done.length * C) + ' ' + C + '" stroke-dashoffset="' + (-acc) + '" style="--d:' + (i * 0.08) + 's"/>'; acc += g[1] / done.length * C; return seg; }).join('');
      return '<div class="chart alt donut-wrap"><svg class="donut" viewBox="0 0 120 120"><circle r="42" cx="60" cy="60" fill="none" stroke="var(--surface-3)" stroke-width="12"/>' +
        '<circle class="dn-ok" r="42" cx="60" cy="60" fill="none" stroke="var(--done)" stroke-width="12" stroke-linecap="round" pathLength="' + C + '" stroke-dasharray="' + (ok / done.length * C) + ' ' + C + '"/>' +
        (late ? '<circle class="dn-late" r="42" cx="60" cy="60" fill="none" stroke="var(--urgent)" stroke-width="12" pathLength="' + C + '" stroke-dasharray="' + (late / done.length * C) + ' ' + C + '" stroke-dashoffset="' + (-(ok / done.length * C)) + '"/>' : '') +
        '<g class="dn-in">' + ring2 + '</g><text x="60" y="58" text-anchor="middle" class="dn-pct">' + pct + '%</text><text x="60" y="74" text-anchor="middle" class="dn-sub">ตรงเวลา</text></svg>' +
        '<div class="dn-legend"><div><b>สถานะการส่ง (วงนอก)</b><span><i style="background:var(--done)"></i>ตรงเวลา ' + ok + '</span><span><i style="background:var(--urgent)"></i>ช้ากว่ากำหนด ' + late + '</span></div>' +
        '<div><b>กลุ่มงาน (วงใน)</b>' + grp.map((g, i) => '<span><i style="background:' + cols[i % cols.length] + '"></i>' + esc(g[0]) + ' ' + g[1] + '</span>').join('') + '</div></div></div>';
    }
    const agg = {}; (people || []).forEach(n => { agg[n] = { ok: 0, late: 0 }; }); // หัวหน้างาน/แอดมิน: แสดงทุกคนแม้ยังไม่มีงานเสร็จ
    done.forEach(j => { const k = j.assignee || ''; agg[k] = agg[k] || { ok: 0, late: 0 }; agg[k][onTime(j) ? 'ok' : 'late']++; });
    const rows = Object.entries(agg).sort((a, b) => (b[1].ok + b[1].late) - (a[1].ok + a[1].late)), top = Math.max(1, ...rows.map(r => r[1].ok + r[1].late));
    return '<div class="chart alt pp">' + rows.map((r, i) => { const n = r[1].ok + r[1].late; return '<div class="pp-row' + (n ? '' : ' zero') + '" style="--d:' + (i * 0.07) + 's"><span class="pp-n">' + av(r[0]) + esc(r[0] || 'ยังไม่มอบหมาย') + '</span><div class="pp-bar">' + (n ? '<i style="width:' + (r[1].ok / top * 100) + '%"></i><i class="late" style="width:' + (r[1].late / top * 100) + '%"></i>' : '<em>ยังไม่มีงานเสร็จในช่วงนี้</em>') + '</div><b>' + n + '</b></div>'; }).join('') + '</div>';
  }
  // line / area / cumulative as SVG
  let vals = keys.map(k => per[k].ok + per[k].late);
  if (type === 'cum') { let a = 0; vals = vals.map(v => (a += v)); }
  let mx = Math.max(2, ...vals); if (mx % 2) mx++;
  const W = 600, H = 168, n = vals.length, x = i => n === 1 ? W / 2 : 8 + i * (W - 16) / (n - 1), y = v => H - 6 - v / mx * (H - 16);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ' L' + x(n - 1).toFixed(1) + ' ' + (H - 6) + ' L' + x(0).toFixed(1) + ' ' + (H - 6) + ' Z';
  const lateDots = type === 'cum' ? '' : keys.map((k, i) => per[k].late ? '<circle cx="' + x(i) + '" cy="' + y(vals[i]) + '" r="5" class="ln-late"/>' : '').join('');
  const tip = (k, i) => (weekly ? 'สัปดาห์ ' : '') + fd(k < hr.from ? hr.from : k) + ' · ' + (type === 'cum' ? 'สะสม ' + vals[i] : 'เสร็จ ' + vals[i]);
  const labels = keys.map((k, i) => (i % every === 0 || i === n - 1) ? '<em style="left:' + (x(i) / W * 100) + '%">' + lab(k) + '</em>' : '').join('');
  return '<div class="chart"><div class="y"><span>' + mx + '</span><span>' + (mx / 2) + '</span><span>0</span></div><div class="plot svgplot">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="lnc ' + type + '"><defs><linearGradient id="lnFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".45"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>' +
    (type !== 'line' ? '<path d="' + area + '" fill="url(#lnFill)" class="ln-area"/>' : '') +
    '<path d="' + path + '" fill="none" class="ln-path" pathLength="1"/>' + lateDots + '</svg>' +
    '<div class="ln-dots">' + pts.map((p, i) => '<span data-tip="' + tip(keys[i], i) + '" style="left:' + (p[0] / W * 100) + '%;top:' + (p[1] / H * 100) + '%"></span>').join('') + '</div>' +
    '<div class="ln-x">' + labels + '</div></div></div>';
}
function minutesOn(date, member) {
  return S.logs.filter(l => l.member === member && (l.start || '').slice(0, 10) === date)
    .reduce((s, l) => s + (l.end ? l.minutes : (Date.now() - parseLocal(l.start)) / 60000), 0);
}
function aItem(j) {
  const di = dueInfo(j), run = runningOf(j.id);
  return '<button class="aitem" data-open="' + esc(j.id) + '">' + stBadge(j) + '<span style="min-width:0"><span class="code">' + esc(j.code) + '</span> ' + (imgsOf(j.id).length ? '<span class="img-chip">' + STI.camera + imgsOf(j.id).length + '</span> ' : '') +
    (j.priority === 'urgent' ? '<span class="tag urgent">ด่วน</span> ' : '') + (run ? '<span class="tag late">● จับเวลา</span>' : '') +
    '<small>' + esc([j.title, groupShort(j.group), j.taskType].filter(Boolean).join(' · ')) + '</small></span>' +
    '<span style="text-align:right">' + stPill(j) + '<small class="' + (di.cls === 'late' ? 'tag late' : /soon/.test(di.cls) ? 'tag ' + di.cls : '') + '">' + esc(di.text) + '</small></span></button>';
}

/* ============ render: board ============ */
function filterBar(opts, noMember) {
  const ms = designers();
  return '<div class="filters"><label class="search">' + I.search + '<input id="q" type="search" autocomplete="off" placeholder="ค้นหาเลข Job, ลูกค้า, sale, หมายเหตุ…" value="' + esc(S.f.q) + '" aria-label="ค้นหางาน"></label>' +
    (noMember ? '' : '<select class="sel" id="fMember" aria-label="ทีมงาน"><option value="all">ทุกคน</option>' + (S.me ? '<option value="__me"' + (S.f.member === '__me' ? ' selected' : '') + '>งานของฉัน (' + esc(S.me) + ')</option>' : '') +
    ms.map(x => '<option value="' + esc(x.name) + '"' + (S.f.member === x.name ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '<option value="__none"' + (S.f.member === '__none' ? ' selected' : '') + '>ยังไม่มอบหมาย</option></select>') +
    '<select class="sel" id="fGroup" aria-label="กลุ่มงาน"><option value="all">ทุกกลุ่มงาน</option>' + (S.settings.groups || []).map(g => '<option' + (S.f.group === g ? ' selected' : '') + '>' + esc(g) + '</option>').join('') + '</select>' +
    (opts || '') + '</div>';
}
function matchBase(j, anyMember) {
  const f = anyMember ? Object.assign({}, S.f, { member: 'all' }) : S.f, q = f.q.trim().toLowerCase();
  if (f.member === '__me' && !inJob(j, S.me)) return false;
  if (f.member === '__none' && j.assignee) return false;
  if (f.member !== 'all' && f.member !== '__me' && f.member !== '__none' && !inJob(j, f.member)) return false;
  if (f.group !== 'all' && j.group !== f.group) return false;
  if (q && [j.code, j.title, j.sale, j.assignee, j.helpers, j.group, j.taskType, j.note].join(' ').toLowerCase().indexOf(q) < 0) return false;
  return true;
}
function tracker(j) {
  // delivery-style progress: รอคิว → ทำ → ตรวจ → เสร็จ
  const FL = flowOf(j), idx = flowIdxOf(j), pct = idx / (FL.length - 1) * 100;
  const st = j.status === 'hold' ? 'hold' : j.status;
  return '<div class="trk ' + (ST[st] || ST.queue).cls + (j.status === 'done' ? ' fin' : '') + '" style="--p:' + pct + '%" title="' + esc((ST[st] || ST.queue).label) + '">' +
    '<span class="trk-line"><i></i></span>' + FL.map((f, i) => '<span class="trk-dot' + (i <= idx ? ' on' : '') + '" style="left:' + (i / (FL.length - 1) * 100) + '%"></span>').join('') +
    '<span class="trk-rider' + (j.status === 'doing' || j.status === 'fix' ? ' go' : '') + '">' + (STI[st] || STI.queue) + '</span></div>';
}
function timerBtn(j, mine) {
  if (!mine || !S.me || j.status === 'done') return '';
  const r = myRunOn(j.id);
  return r ? '<button type="button" class="tbtn on" data-act="stop" data-log="' + esc(r.id) + '" title="หยุดจับเวลา" aria-label="หยุดจับเวลา">' + I.stop + '</button>'
    : '<button type="button" class="tbtn" data-act="start" data-job="' + esc(j.id) + '" title="เริ่มจับเวลา" aria-label="เริ่มจับเวลา">' + I.play + '</button>';
}
function card(j, i) {
  const di = dueInfo(j), run = runningOf(j.id), late = isLate(j), tc = typeColor(j.taskType), imgs = imgsOf(j.id);
  const nextSt = nextOf(j);
  const mins = totalMinutes(j);
  const mine = canEdit(j) && !j.pending;
  const dueIc = di.cls === 'late' ? STI.fire : /soon/.test(di.cls) ? STI.hourglass : j.status === 'done' ? STI.done : STI.calendar;
  return '<div class="card' + (j.pending ? ' is-pending' : '') + (tc ? ' has-tc' : '') + (late ? ' is-late' : '') + (j.priority === 'urgent' ? ' is-urgent' : '') + (mine ? '' : ' ro') + '"' + (tc ? ' style="--tc:' + tc + '"' : '') + ' draggable="' + mine + '" data-id="' + esc(j.id) + '" data-open="' + esc(j.id) + '" tabindex="0" role="button">' +
    '<div class="card-top">' + (i >= 0 ? '<span class="qno" title="ลำดับที่ ' + (i + 1) + '">' + (i + 1) + '</span>' : '') + stBadge(j) + '<div class="code">' + esc(j.code) + '</div>' + (imgs.length ? '<button type="button" class="card-th" data-lbopen="' + esc(imgs[0].id) + '" data-lbjob="' + esc(j.id) + '" title="ดูรูป" aria-label="ดูรูปงาน">' + thumbImg(imgs[0]) + (imgs.length > 1 ? '<b>' + imgs.length + '</b>' : '') + '</button>' : '') +
    (nextSt && mine ? '<button class="adv" data-move="' + esc(j.id) + '" data-to="' + nextSt + '" title="เลื่อนเป็น ' + ST[nextSt].label + '" aria-label="เลื่อนเป็น ' + ST[nextSt].label + '">' + I.next + '</button>' : '') + '</div>' +
    (j.title ? '<div class="title">' + esc(j.title) + '</div>' : '') +
    '<div class="tags">' + (j.priority === 'urgent' ? '<span class="tag urgent">' + STI.fire + 'ด่วน</span>' : '') + (j.revision ? '<span class="tag rev">' + STI.pen + 'แก้ไข</span>' : '') + (j.status === 'hold' ? '<span class="pill s-hold">' + STI.hold + 'พักไว้</span>' : '') +
      typeChip(j.taskType) + groupChip(j.group) + lvBars(j.level) + '</div>' +
    tracker(j) + cardExtras(j) + prodChip(j) +
    '<div class="card-foot">' + timerBtn(j, mine) + avTeam(j) + (run ? '<span class="live" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : (mins ? '<span class="tg">' + STI.timer + fdur(mins) + '</span>' : '<span>' + esc(j.sale ? 'Sale ' + j.sale : '') + '</span>')) +
      '<span class="due ' + di.cls + '">' + dueIc + esc(di.text) + '</span></div></div>';
}
function prodChip(j) {   // งานที่ออกแบบเสร็จแล้ว: บอกว่าตอนนี้อยู่ขั้นไหนในฝ่ายผลิต
  if (j.status !== 'done' || !S.prods || !S.prods.length) return '';
  const p = prodOfCode(j.code); if (!p) return '';
  return '<button type="button" class="pchip ' + PSTG[p.stage].cls + '" data-popen="' + esc(p.id) + '" title="ดูงานในฝ่ายผลิต">' + PIC[p.stage] + '<span>ฝ่ายผลิต · <b>' + PSTG[p.stage].label + '</b></span></button>';
}
function typeLegend() {
  const ts = (S.settings.taskTypes || []).filter(t => t.name); if (!ts.length) return '';
  return '<div class="tlegend"><span class="tl-h">สีรายละเอียดงาน</span>' + ts.map(t => typeChip(t.name, 'sm')).join('') +
    (ts.some(t => t.cat === 'cam') ? '<span class="tl-note">' + STI.done + 'งาน CAM ทำเสร็จแล้วไป "เสร็จแล้ว" ทันที ไม่ต้องรอตรวจ</span>' : '') + '</div>';
}
function viewBoard() {
  const q = S.f.quick || 'all', t = today();
  const quickOk = j => q === 'mine' ? inJob(j, S.me) : q === 'urgent' ? j.priority === 'urgent' && isOpen(j) : q === 'late' ? isLate(j) : q === 'today' ? isOpen(j) && j.due && j.due <= addDays(t, 1) : true;
  const base0 = listPool().filter(listMatch), base = base0.filter(quickOk);
  const cols = COLS.slice();
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
    return '<section class="col ' + ST[st].cls + '" data-col="' + st + '"><div class="col-h"><span class="col-ic ic-' + st + '">' + STI[st] + '</span><div class="col-t"><b>' + ST[st].label + '</b><small>' + (st === 'done' ? '14 วันล่าสุด' : st === 'queue' ? 'รวมงานพักไว้' : st === 'doing' ? 'อยู่ระหว่างทำ' : st === 'fix' ? 'ตรวจแล้วต้องแก้' : 'รอคนตรวจ') + '</small></div><span class="n">' + js.length + '</span></div>' +
      '<div class="col-list">' + (js.length ? js.map(card).join('') : '<div class="col-empty"><span class="ce-art ic-' + st + '">' + STI[st] + '<i></i><i></i><i></i></span><b>' + ST_EMPTY[st] + '</b><small>ลากการ์ดมาวางที่นี่ได้</small></div>') + '</div>' + more + '</section>';
  }).join('');
  const cnt = st => base0.filter(j => st === 'queue' ? (j.status === 'queue' || j.status === 'hold') : st === 'done' ? j.status === 'done' && finDate(j) >= cutoff : j.status === st).length;
  const flow = '<div class="flow">' + COLS.map((st, i) => '<div class="flow-step ' + ST[st].cls + '"><span class="flow-ic ic-' + st + '">' + STI[st] + '</span><div><b>' + cnt(st) + '</b><small>' + ST[st].label + '</small></div></div>' + (i < COLS.length - 1 ? '<span class="flow-arrow" aria-hidden="true"><i></i><i></i><i></i></span>' : '')).join('') + '</div>';
  const qn = k => base0.filter(j => (k === 'mine' ? inJob(j, S.me) : k === 'urgent' ? j.priority === 'urgent' && isOpen(j) : k === 'late' ? isLate(j) : k === 'today' ? isOpen(j) && j.due && j.due <= addDays(t, 1) : true) && (k === 'all' || isOpen(j) || k === 'mine')).length;
  const quick = '<div class="qchips">' + [['all', 'ทั้งหมด', STI.all, ''], ['mine', 'งานของฉัน', STI.user, 'doing'], ['today', 'ส่งวันนี้/พรุ่งนี้', STI.hourglass, 'review'], ['urgent', 'งานด่วน', STI.fire, 'urgent'], ['late', 'เลยกำหนด', STI.clock, 'late']]
    .filter(x => x[0] !== 'mine' || (S.me && isLead()))
    .map(x => '<button class="qchip' + (x[3] ? ' q-' + x[3] : '') + '" data-quick="' + x[0] + '" aria-pressed="' + (q === x[0]) + '"><span class="qi">' + x[2] + '</span>' + x[1] + (x[0] !== 'all' ? '<b>' + qn(x[0]) + '</b>' : '') + '</button>').join('') + '</div>';
  return topbar('บอร์ดงาน', (isProdRole() ? 'ดูงานของฝ่ายแบบได้อย่างเดียว (ฝ่ายผลิตแก้ไขหรือเพิ่มงานตรงนี้ไม่ได้)' : isAdmin() ? 'ลากการ์ดเพื่อเปลี่ยนสถานะ หรือกดลูกศรเพื่อเลื่อนไปขั้นถัดไป' : isLead() ? 'ลากหรือกดลูกศรบนการ์ดของคุณเพื่อเปลี่ยนสถานะ งานของคนอื่นดูได้อย่างเดียว' : 'งานของ' + esc(S.me) + ' · ลากหรือกดลูกศรบนการ์ดเพื่อเปลี่ยนสถานะ') + (hold.length ? ' · พักไว้ ' + hold.length + ' งาน (อยู่ในช่องรอคิว)' : '')) +
    flow + filterBar('', !isLead()) + quick + typeLegend() + '<div class="board-scroll"><div class="board">' + colHtml + '</div></div>';
}

/* ============ render: list ============ */
/* พนักงานเห็นเฉพาะงานที่ตัวเองรับผิดชอบในหน้ารายการงานและบอร์ดงาน — หัวหน้างาน/แอดมินเห็นทุกงาน */
const listPool = () => isLead() || isProdRole() ? S.jobs : S.jobs.filter(j => inJob(j, S.me));   // ฝ่ายผลิตดูงานฝ่ายแบบได้ทั้งหมด (แก้ไม่ได้)
const listMatch = j => matchBase(j, !isLead());
function listRows() {
  const f = S.f, t = today();
  return listPool().filter(listMatch).filter(j => {
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
  const pool = listPool(), base = pool.filter(listMatch);
  const n = k => base.filter(j => k === 'open' ? isOpen(j) : k === 'late' ? isLate(j) : k === 'urgent' ? isOpen(j) && j.priority === 'urgent' : k === 'all' ? true : k === 'done' ? j.status === 'done' && (!S.f.month || S.f.status !== 'done' || finDate(j).slice(0, 7) === S.f.month) : j.status === k).length;
  const chips = [['open', 'ยังไม่เสร็จ'], ['late', 'เลยกำหนด'], ['urgent', 'ด่วน'], ['doing', 'กำลังทำ'], ['review', 'รอตรวจ'], ['fix', 'แก้ไข'], ['hold', 'พักไว้'], ['done', 'เสร็จแล้ว'], ['all', 'ทั้งหมด']]
    .map(x => '<button class="chip" data-fstatus="' + x[0] + '" aria-pressed="' + (S.f.status === x[0]) + '">' + ({ open: STI.layers, late: STI.fire, urgent: STI.fire, doing: STI.doing, review: STI.review, fix: STI.fix, hold: STI.hold, done: STI.done, all: STI.all }[x[0]] || '') + x[1] + ' <b>' + n(x[0]) + '</b></button>').join('');
  const months = {}; pool.forEach(j => { if (finDate(j)) months[finDate(j).slice(0, 7)] = 1; }); if (S.f.month) months[S.f.month] = 1;
  const monthSel = S.f.status === 'done' ? '<select class="sel" id="fMonth" aria-label="เดือนที่เสร็จ"><option value="">ทุกเดือน</option>' + Object.keys(months).sort().reverse().map(m => '<option value="' + m + '"' + (S.f.month === m ? ' selected' : '') + '>' + monthLabel(m) + '</option>').join('') + '</select>' : '';
  const rows = listRows();
  const body = rows.length ? rows.map((j, i) => {
    const di = dueInfo(j), run = runningOf(j.id), mins = totalMinutes(j), tc = typeColor(j.taskType);
    return '<div class="row' + (tc ? ' has-tc' : '') + (isLate(j) ? ' is-late' : '') + (j.priority === 'urgent' ? ' is-urgent' : '') + '"' + (tc ? ' style="--tc:' + tc + '"' : '') + ' data-open="' + esc(j.id) + '" tabindex="0" role="button">' +
      '<div class="cell c-main"><div class="code"><span class="qno">' + (i + 1) + '</span>' + stBadge(j) + esc(j.code) + (imgsOf(j.id).length ? '<span class="img-chip">' + STI.camera + imgsOf(j.id).length + '</span>' : '') + '</div><div class="meta">' + (j.priority === 'urgent' ? '<span class="tag urgent">ด่วน</span>' : '') + (j.revision ? '<span class="tag rev">แก้ไข</span>' : '') +
        typeChip(j.taskType) + groupChip(j.group) + (j.title ? '<span>' + esc(j.title) + '</span>' : '') + lvBars(j.level) + cardExtras(j) + '</div></div>' +
      '<div class="cell c-who"><span class="who">' + avTeam(j) + '<span>' + esc(j.assignee || 'ยังไม่มอบหมาย') + (helpersOf(j).length ? '<small class="helpers">+ ' + esc(helpersOf(j).join(', ')) + '</small>' : '') + '<small>Sale ' + esc(j.sale || '–') + '</small></span></span></div>' +
      '<div class="cell c-time">' + (run ? '<span class="tag late" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : '<span class="tnum">' + (mins ? fdur(mins) : '–') + '</span>') + '<small>เริ่ม ' + fdt(j.startedAt) + '</small></div>' +
      '<div class="cell">รับ ' + fd(j.received) + '<small>' + esc(j.taskType || '') + '</small></div>' +
      '<div class="cell c-due"><span class="' + (di.cls === 'late' ? 'tag late' : /soon/.test(di.cls) ? 'tag ' + di.cls : '') + '">' + esc(di.text) + '</span>' + (j.status !== 'done' && j.due ? '<small>กำหนด ' + fdY(j.due) + '</small>' : '') + '</div>' +
      '<div class="cell c-note"' + (j.note ? ' title="' + esc(j.note) + '"' : '') + '>' + (j.note ? '<span class="note-txt">' + STI.note + '<span>' + esc(j.note) + '</span></span>' : '<span class="muted">–</span>') + '</div>' +
      '<div class="cell c-st">' + stPill(j) + '</div></div>';
  }).join('') : '<div class="empty"><b>ไม่พบงาน</b>ลองเปลี่ยนตัวกรองหรือคำค้น</div>';
  return topbar('รายการงาน', isLead() ? rows.length + ' รายการ จากทั้งหมด ' + S.jobs.length + ' งาน' : 'งานของ' + esc(S.me) + ' · ' + rows.length + ' รายการ จาก ' + pool.length + ' งาน', '<button class="btn" data-act="csv">' + I.download + '<span>ส่งออก CSV</span></button>') +
    filterBar(monthSel, !isLead()) + '<div class="chips">' + chips + '</div>' +
    '<div class="list"><div class="lhead"><span>JOB</span><span>ผู้รับผิดชอบ</span><span>เวลาทำงาน</span><span>วันที่รับ</span><span>กำหนดส่ง</span><span>หมายเหตุ</span><span>สถานะ</span></div>' + body + '</div>';
}
function exportCsv() {
  const rows = listRows();
  const head = ['เลข Job', 'ลูกค้า/โครงการ', 'กลุ่มงาน', 'รายละเอียด', 'จำนวน', 'ระดับ', 'ผู้รับผิดชอบ', 'ผู้ร่วมทำงาน', 'Sale', 'ด่วน', 'งานแก้ไข', 'สถานะ', 'วันที่รับ', 'กำหนดส่ง', 'เริ่มทำ', 'เสร็จ', 'ตรงเวลา', 'เวลาทำ (นาที)', 'หมายเหตุ'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [head.map(q).join(',')].concat(rows.map(j => [j.code, j.title, j.group, j.taskType, j.qty === 'multi' ? 'หลายชิ้น' : 'ชิ้นเดียว', j.level, j.assignee, helpersOf(j).join(', '), j.sale, j.priority === 'urgent' ? 'ใช่' : '', j.revision ? 'ใช่' : '',
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
    const hp = M.list.filter(m => m.kind === 'help' && m.status !== 'done' && m.from === x.name && !m.fromAdmin), hOpen = hp.filter(m => m.status === 'open');
    const unr = M.list.filter(m => !m.read && m.from === x.name && !m.fromAdmin).length, canChat = x.name !== S.me;
    const helpBox = hp.length ? '<div class="t-help' + (hOpen.length ? '' : ' taken') + '"><span class="th-ic">' + MSG_IC.sos + '</span><div class="th-b"><b>' + (hOpen.length ? 'ขอความช่วยเหลือ' : (hp[0].helper ? esc(hp[0].helper) + ' กำลังช่วย' : 'มีคนรับช่วยแล้ว')) + '</b><p>' + esc(hp[hp.length - 1].text) + '</p></div>' +
      '<div class="th-act">' + (hOpen.length && canChat ? '<button class="btn sm primary" data-helptake="' + esc(hOpen[hOpen.length - 1].id) + '">' + MSG_IC.hand + 'ฉันช่วยได้</button>' : '') + '<button class="btn sm" data-ch="' + esc(hp[hp.length - 1].to === 'team' ? 'team' : chanOf(hp[hp.length - 1])) + '">ดูข้อความ</button></div></div>' : '';
    const full = isLead() || x.name === S.me; // กดเข้าไปดูงาน: เฉพาะหัวหน้างาน/แอดมิน หรือของตัวเอง
    const stats = x.role !== 'prod';            // ตัวเลขผลงานฝ่ายแบบ: ทุกคนเห็น (ฝ่ายผลิตไม่มีตัวเลขนี้)
    return '<div class="tcard' + (hOpen.length ? ' needs-help' : '') + '" style="--c:' + esc(x.color || '#5B6B7A') + '"><div class="tcard-h"><span class="t-av">' + av(x.name, 'lg') + '<i class="av-role tl ' + ROLES[roleOf(x)].cls + '">' + ROLE_IC[roleOf(x)] + '</i>' + (hOpen.length ? '<i class="t-sos">' + MSG_IC.sos + '</i>' : unr ? '<i class="t-unread">' + unr + '</i>' : '') + '</span><div><b>' + esc(x.name) + (x.name === S.me ? ' <span class="tag rev">คุณ</span>' : '') + '</b><small>' + esc(x.full || '') + '</small><span class="t-roles">' + roleChip(x) + deptTag(x) + '</span></div></div>' +
      (rj ? (full ? '<button class="now-on" data-open="' + esc(rj.id) + '" style="border:0;text-align:left"><span class="tag late" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>กำลังทำ <b>' + esc(rj.code) + '</b></button>'
        : '<div class="now-on ro" title="ดูได้อย่างเดียว"><span class="tag late" data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>กำลังทำ <b>' + esc(rj.code) + '</b></div>') : '') +
      (stats ? '<div class="tstats"><div><span>งานค้าง</span><b>' + open.length + '</b></div><div><span>เลยกำหนด</span><b style="color:' + (late.length ? 'var(--late)' : 'inherit') + '">' + late.length + '</b></div><div><span>เสร็จเดือนนี้</span><b>' + doneM.length + '</b></div></div>' +
      '<div><div class="panel-h" style="margin-bottom:6px"><span class="sub">ตรงเวลา ' + (doneM.length ? pct + '%' : '–') + '</span><span class="sub">เวลาทำ ' + fdur(minsM) + ' · ยากเฉลี่ย ' + lv + '</span></div><div class="meter"><i style="width:' + pct + '%"></i></div></div>' : '') +
      helpBox + '<div class="t-btns">' + (full ? '<button class="btn" data-memberjobs="' + esc(x.name) + '">' + (x.name === S.me ? 'ดูงานของฉัน' : 'ดูงานของ' + esc(x.name)) + '</button>' : '') + (canChat && CAN_RTC ? '<button class="btn t-call" data-rtc="call" data-peer="' + esc(x.name) + '" data-name="' + esc(x.name) + '" title="โทรหา ' + esc(x.name) + '">' + RTC_IC.phone + '</button>' : '') + (canChat ? '<button class="btn t-chat' + (unr ? ' has' : '') + (full ? '' : ' wide') + '" data-ch="u:' + esc(x.name) + '" title="ส่งข้อความถึง ' + esc(x.name) + '">' + MSG_IC.chat + (full ? '' : '<span>ส่งข้อความ</span>') + (unr ? '<b>' + unr + '</b>' : '') + '</button>' : '<button class="btn t-sosbtn" data-act="askhelp" data-job="" title="ขอความช่วยเหลือจากทีมและ' + ADMIN_LABEL + '">' + MSG_IC.sos + '<span>ขอช่วย</span></button>') + '</div></div>';
  }).join('');
  return topbar('ทีมงาน', 'ภาระงานและผลงานรายคน เดือน' + monthLabel(m)) + (CAN_RTC ? roomCard() : '') + '<div class="teams">' + cards + '</div>';
}

/* ============ render: report (printable) ============ */
const R_SECTIONS = [['kpi', 'สรุปตัวเลข'], ['people', 'สรุปรายคน', true], ['groups', 'สรุปตามกลุ่มงาน'], ['jobs', 'รายการงาน'], ['sign', 'ช่องลงชื่อ']];
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

/* รายงานย้อนหลังเกินช่วงที่เก็บถาวร: โหลดงานเก่าจากไฟล์เก็บถาวรมารวม (ครั้งเดียวต่อการเปิดแอป) */
const needArch = r => !!(S.archivedBefore && r.from < S.archivedBefore);
function reportPool(r) {
  if (!needArch(r)) return S.jobs;
  if (!S.arch && !S.archLoading && mode() === 'sheet') {
    S.archLoading = true;
    api().archive({}).then(a => { S.arch = a; }).catch(e => { S.arch = { jobs: [], logs: [] }; toast('โหลดงานเก่าไม่สำเร็จ: ' + e.message, true); }).then(() => { S.archLoading = false; render(); });
  }
  if (!S.arch) return S.jobs;
  const have = {}; S.jobs.forEach(j => { have[j.id] = 1; });
  return S.jobs.concat((S.arch.jobs || []).filter(j => !have[j.id]));
}
function reportLogs(r) {
  if (!needArch(r) || !S.arch) return S.logs;
  const have = {}; S.logs.forEach(l => { have[l.id] = 1; });
  return S.logs.concat((S.arch.logs || []).filter(l => !have[l.id]));
}
function reportData() {
  const r = reportState();
  if (!isLead()) r.member = S.me; // staff only report on their own work; leads and admins see everyone
  const who = j => j.assignee || '';
  const base = reportPool(r).filter(j => (r.member === 'all' || (r.member === '__none' ? !j.assignee : j.assignee === r.member)) && (r.group === 'all' || j.group === r.group));
  const recv = j => inR(j.received, r), fin = j => j.status === 'done' && inR(finDate(j), r);
  const openNow = j => isOpen(j) && (!j.received || j.received <= r.to);
  const scoped = base.filter(j => r.scope === 'received' ? recv(j) : r.scope === 'done' ? fin(j) : r.scope === 'open' ? openNow(j) : (recv(j) || fin(j) || openNow(j)));
  const ids = {}; base.forEach(j => { ids[j.id] = j; });
  const logs = reportLogs(r).filter(l => inR((l.start || '').slice(0, 10), r) && ids[l.jobId] && (r.member === 'all' || r.member === '__none' || l.member === r.member));
  const minsBy = (key, val) => logs.filter(l => (key === 'member' ? l.member : (ids[l.jobId] || {})[key]) === val).reduce((s, l) => s + logMinutes(l), 0);
  const stat = js => {
    const done = js.filter(fin), ok = done.filter(onTime).length, open = js.filter(openNow);
    return { recv: js.filter(recv).length, done: done.length, ok: ok, late: done.length - ok, pct: done.length ? Math.round(ok / done.length * 100) : null, open: open.length, overdue: open.filter(isLate).length };
  };
  const total = stat(base); total.mins = logs.reduce((s, l) => s + logMinutes(l), 0);
  // people: active members first, then anyone else appearing in the data
  const names = []; const add = n => { if (names.indexOf(n) < 0) names.push(n); };
  if (r.member !== 'all') add(r.member === '__none' ? '' : r.member);
  else { designers().forEach(m => add(m.name)); base.forEach(j => { if (recv(j) || fin(j) || openNow(j)) add(who(j)); }); logs.forEach(l => add(l.member)); }
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
  const ms = designers();
  const opt = (v, cur, label) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
  const memberName = r.member === 'all' ? 'ทุกคน' : r.member === '__none' ? 'ยังไม่มอบหมาย' : r.member;
  const controls = '<div class="panel rep-controls">' +
    '<div class="chips" role="group" aria-label="ช่วงเวลา">' + R_PRESETS.map(p => '<button class="chip" data-rpreset="' + p[0] + '" aria-pressed="' + (r.preset === p[0]) + '">' + p[1] + '</button>').join('') + '</div>' +
    '<div class="rep-grid">' +
      '<div class="f"><label for="rFrom">ตั้งแต่วันที่</label><input type="date" id="rFrom" value="' + esc(r.from) + '"></div>' +
      '<div class="f"><label for="rTo">ถึงวันที่</label><input type="date" id="rTo" value="' + esc(r.to) + '"></div>' +
      (isLead() ? '<div class="f"><label for="rMember">ผู้รับผิดชอบ</label><select id="rMember">' + opt('all', r.member, 'ทุกคน') + ms.map(m => opt(m.name, r.member, m.name)).join('') + opt('__none', r.member, 'ยังไม่มอบหมาย') + '</select></div>'
        : '<div class="f"><label>ผู้รับผิดชอบ</label><div class="rme">' + av(S.me) + '<b>' + esc(S.me) + '</b><small>งานของฉัน</small></div></div>') +
      '<div class="f"><label for="rGroup">กลุ่มงาน</label><select id="rGroup">' + opt('all', r.group, 'ทุกกลุ่มงาน') + (s.groups || []).map(g => opt(g, r.group, g)).join('') + '</select></div>' +
      '<div class="f"><label for="rScope">รายการงานที่แสดง</label><select id="rScope">' + R_SCOPES.map(x => opt(x[0], r.scope, x[1])).join('') + '</select></div>' +
      '<div class="f"><label for="rOrient">หน้ากระดาษ A4</label><select id="rOrient">' + opt('portrait', r.orient, 'แนวตั้ง') + opt('landscape', r.orient, 'แนวนอน') + '</select></div>' +
    '</div>' +
    '<div class="rep-secs"><span class="sub">หัวข้อที่จะพิมพ์</span>' + R_SECTIONS.filter(x => !x[2] || isLead()).map(x => '<label class="toggle sm"><input type="checkbox" data-rsec="' + x[0] + '"' + (r.sec[x[0]] ? ' checked' : '') + '>' + x[1] + '</label>').join('') + '</div></div>';

  const pctTxt = v => v == null ? '–' : v + '%';
  const kpi = r.sec.kpi ? '<section class="rsec"><h3>สรุปตัวเลข</h3><div class="rkpis">' +
    [['รับงานเข้า', T.recv, 'งาน'], ['เสร็จแล้ว', T.done, 'งาน'], ['ตรงเวลา', pctTxt(T.pct), T.done ? T.ok + ' จาก ' + T.done + ' งาน' : ''], ['เสร็จช้า', T.late, 'งาน'],
     ['ค้างอยู่', T.open, T.overdue ? 'เลยกำหนด ' + T.overdue + ' งาน' : 'ไม่มีงานเลยกำหนด'], ['เวลาทำงานรวม', fdur(T.mins), 'จากการจับเวลา', 'sm']]
      .map(k => '<div class="rkpi' + (k[3] ? ' ' + k[3] : '') + '"><span>' + k[0] + '</span><b>' + k[1] + '</b><small>' + esc(k[2]) + '</small></div>').join('') + '</div></section>' : '';

  const th = cols => '<thead><tr>' + cols.map(c => '<th' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + c[0] + '</th>').join('') + '</tr></thead>';
  const sumRow = (label, x, extra) => '<tr class="tot"><td>' + label + '</td><td class="n">' + x.recv + '</td><td class="n">' + x.done + '</td><td class="n">' + x.ok + '</td><td class="n">' + x.late + '</td><td class="n">' + pctTxt(x.pct) + '</td><td class="n">' + x.open + '</td><td class="n">' + x.overdue + '</td>' + extra + '</tr>';
  const showPeople = r.sec.people && isLead();
  const people = showPeople ? '<section class="rsec"><h3>สรุปรายคน</h3>' + (D.people.length ? '<div class="rtable-wrap"><table class="rtable">' +
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

  return topbar('สรุปรายงาน', isLead() ? 'เลือกช่วงเวลาแล้วกดพิมพ์ หรือบันทึกเป็น PDF' : 'สรุปงานของคุณ เลือกช่วงเวลาแล้วกดพิมพ์ หรือบันทึกเป็น PDF', '<button class="btn primary" data-act="print">' + I.print + '<span>พิมพ์รายงาน</span></button>') + controls + (S.archLoading ? '<div class="banner"><span><b>กำลังโหลดงานเก่า</b> จากไฟล์เก็บถาวร (งานที่เสร็จก่อน ' + esc(fdY(S.archivedBefore)) + ')…</span></div>' : '') + paper;
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
  const nav = [['me', 'บัญชีของฉัน'], ['theme', 'ธีมและสี']].concat(admin ? [['conn', 'ฐานข้อมูล'], ['users', 'ผู้ใช้งานและสิทธิ์'], ['brand', 'แบรนด์'], ['lists', 'รายการตัวเลือก'], ['sla', 'ระยะเวลามาตรฐาน'], ['salelink', 'Sale']] : []).concat([['about', 'เกี่ยวกับ']]);
  let h = topbar('ตั้งค่า', admin ? 'คุณเป็นแอดมิน จัดการผู้ใช้ การตั้งค่า และแบรนด์ได้' : 'บัญชีของคุณและการเชื่อมต่อ') +
    '<div class="settings"><nav class="snav">' + nav.map(n => '<a href="#s-' + n[0] + '">' + n[1] + '</a>').join('') + '</nav><div class="sbody">';

  h += '<section class="panel sec" id="s-me"><div class="panel-h"><h2>บัญชีของฉัน</h2><button class="btn sm" data-act="logout">ออกจากระบบ</button></div>' +
    '<div class="tcard-h">' + avUser(S.user, 'xl') + '<div><b>' + esc(S.me) + '</b><small>' + ((S.user && S.user.full) ? esc(S.user.full) + ' · ' : '') + '</small>' + roleChip(S.user) + deptTag(S.user) +
      '<div class="top-actions" style="margin-top:8px"><label class="btn sm">' + (S.user && S.user.photo ? 'เปลี่ยนรูป' : 'ใส่รูปโปรไฟล์') + '<input type="file" accept="image/*" data-photofor="' + esc(S.user ? S.user.id : '') + '" hidden></label>' +
      (S.user && S.user.photo ? '<button class="btn sm ghost" data-rmphoto="' + esc(S.user.id) + '">ลบรูป</button>' : '') + '</div></div></div>' +
    '<p class="help">' + (admin ? 'แก้ไขและลบได้ทุกงาน มอบหมายงาน และจัดการผู้ใช้' : 'ลงงานใหม่ แก้ไขและจับเวลางานของตัวเองได้ งานของคนอื่นดูได้อย่างเดียว') + '</p>' +
    '<div class="form-grid"><div class="f"><label for="pOld">PIN เดิม</label><input id="pOld" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></div><div></div>' +
    '<div class="f"><label for="pNew">PIN ใหม่ (4–6 หลัก)</label><input id="pNew" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>' +
    '<div class="f"><label for="pNew2">ยืนยัน PIN ใหม่</label><input id="pNew2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>' +
    '<div><button class="btn" data-act="changepin">เปลี่ยน PIN</button></div></section>';
  h += pushSection();
  h += themeSection();

  if (admin) h += '<section class="panel sec" id="s-conn"><div class="panel-h"><h2>ฐานข้อมูล</h2>' + (mode() === 'sheet' ? '<span class="pill s-done">Google Sheet</span>' : '<span class="pill s-hold">โหมดทดลอง</span>') + '</div>' +
    (mode() === 'sheet'
      ? '<p class="help">ข้อมูลของทีมเก็บใน Google Sheet ผ่าน Apps Script ด้านล่าง</p><div class="code-box">' + esc(c.url) + '</div><div class="top-actions"><button class="btn sm" data-act="copylink">คัดลอกลิงก์เข้าใช้งานให้ทีม</button>' + (LOCKED() ? '' : '<button class="btn sm" data-act="disconnect">ออกจากฐานข้อมูลนี้</button>') + '</div>'
      : '<p class="help">ตอนนี้ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น ติดตั้ง Apps Script ตามคู่มือแล้ววาง URL ที่ลงท้าย /exec เพื่อใช้ร่วมกันทั้งทีม</p>' +
        '<div class="form-grid"><div class="f full"><label for="cUrl">URL ของ Apps Script</label><input id="cUrl" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" inputmode="url"></div></div>' +
        '<div class="top-actions"><button class="btn primary" data-act="connect">เชื่อมต่อ</button><button class="btn sm" data-act="resetdemo">รีเซ็ตข้อมูลตัวอย่าง</button></div>') + '</section>';

  if (admin) {
    const rows = S.users.map(u => '<div class="urow' + (u.active ? '' : ' off') + '" data-urow="' + esc(u.id) + '">' +
      '<div class="uphoto"><label class="ph-pick" title="' + (u.photo ? 'เปลี่ยนรูป' : 'ใส่รูป') + '">' + avUser(u, 'md') + '<span class="ph-cam" aria-hidden="true">+</span><input type="file" accept="image/*" data-photofor="' + esc(u.id) + '" hidden aria-label="รูปของ ' + esc(u.name) + '"></label>' +
      (u.photo ? '<button class="ph-x" data-rmphoto="' + esc(u.id) + '" aria-label="ลบรูปของ ' + esc(u.name) + '">×</button>' : '') + '</div>' +
      '<input type="color" value="' + esc(u.color || '#5B6B7A') + '" data-u="color" aria-label="สี">' +
      '<input value="' + esc(u.name) + '" data-u="name" aria-label="ชื่อเล่น" placeholder="ชื่อเล่น"><input class="opt" value="' + esc(u.full || '') + '" data-u="full" aria-label="ชื่อจริง" placeholder="ชื่อจริง">' +
      '<select data-u="role" aria-label="ตำแหน่ง">' + roleOpts(u.role) + '</select>' +
      '<label class="toggle sm"><input type="checkbox" data-u="active"' + (u.active ? ' checked' : '') + '>ใช้งาน</label>' +
      '<div class="urow-act"><button class="btn sm" data-saveuser="' + esc(u.id) + '">บันทึก</button><button class="btn sm ghost" data-pinedit="' + esc(u.id) + '">' + STI.key + 'PIN</button>' +
        (u.id !== (S.user && S.user.id) ? '<button class="icon-btn sm udel" data-udel="' + esc(u.id) + '" aria-label="ลบ ' + esc(u.name) + '" title="ลบผู้ใช้">' + I.trash + '</button>' : '') + '</div>' +
      (S.userDel === u.id ? '<div class="confirm"><span>ลบบัญชี <b>' + esc(u.name) + '</b> ถาวร? เข้าระบบไม่ได้อีก แต่งานและเวลาที่เคยทำยังอยู่ในประวัติและรายงาน (ถ้าแค่พักใช้ ให้ปิด "ใช้งาน" แทน)</span><button class="btn sm danger" data-udelyes="' + esc(u.id) + '">ลบผู้ใช้</button><button class="btn sm" data-udel="">ไม่ลบ</button></div>' : '') +
      (S.pinEdit === u.id ? '<div class="pin-edit"><span class="pe-ic">' + STI.key + '</span><div class="pe-b"><b>เปลี่ยน PIN ของ ' + esc(u.name) + '</b><small>ระบบเก็บ PIN แบบเข้ารหัส จึงดู PIN เดิมไม่ได้ ตั้งใหม่ได้เลย</small></div>' +
        '<input id="pinSet" inputmode="numeric" maxlength="6" placeholder="PIN ใหม่ 4–6 หลัก" autocomplete="off"><button class="btn sm primary" data-pinsave="' + esc(u.id) + '">บันทึก PIN</button><button class="btn sm" data-resetpin="' + esc(u.id) + '">สุ่มให้</button><button class="icon-btn sm" data-pinedit="" aria-label="ปิด">✕</button></div>' : '') +
      (S.pinNote && S.pinNote.userId === u.id ? '<div class="pin-note">PIN ใหม่ของ ' + esc(u.name) + ': <b class="mono">' + esc(S.pinNote.pin) + '</b> <button class="btn sm" data-copypin="' + esc(S.pinNote.pin) + '">คัดลอก</button> แจ้งเจ้าตัว ใช้เข้าระบบได้ทันที (เจ้าตัวเปลี่ยนเองได้ในหน้าตั้งค่า)</div>' : '') + '</div>').join('');
    h += '<section class="panel sec" id="s-users"><div class="panel-h"><h2>ผู้ใช้งานและสิทธิ์</h2><span class="sub">' + S.users.filter(u => u.active).length + ' คนใช้งานอยู่</span></div>' +
      '<p class="help"><b>แอดมิน</b> แก้ไขได้ทั้งหมด · <b>ผู้ใช้งาน</b> ลงงานและแก้ไขงานของตัวเองได้ ปิด "ใช้งาน" เพื่อระงับบัญชีโดยไม่ลบประวัติงาน</p>' +
      '<div class="ulist">' + rows + '</div>' +
      '<div class="uadd"><b>เพิ่มผู้ใช้</b><span class="sub">ใส่รูปได้หลังเพิ่มแล้ว โดยกดที่วงกลมหน้าชื่อ</span><div class="urow"><input type="color" id="nuColor" value="' + COLORS[S.users.length % COLORS.length] + '" aria-label="สี"><input id="nuName" placeholder="ชื่อเล่น" aria-label="ชื่อเล่น"><input id="nuFull" class="opt" placeholder="ชื่อจริง" aria-label="ชื่อจริง">' +
      '<select id="nuRole" aria-label="ตำแหน่ง">' + roleOpts('user') + '</select><input id="nuPin" inputmode="numeric" maxlength="6" placeholder="PIN (ว่าง = สุ่ม)" aria-label="PIN เริ่มต้น">' +
      '<div class="urow-act"><button class="btn sm primary" data-act="adduser">' + I.plus + 'เพิ่ม</button></div>' +
      (S.pinNote && S.pinNote.userId === 'new' ? '<div class="pin-note">เพิ่ม ' + esc(S.pinNote.name) + ' แล้ว PIN: <b class="mono">' + esc(S.pinNote.pin) + '</b></div>' : '') + '</div></div></section>';

    const simpleRows = key => d[key].map((x, i) => '<div class="erow two"><input value="' + esc(x) + '" data-d="' + key + '.' + i + '" aria-label="ชื่อ"><button class="icon-btn" data-del="' + key + '.' + i + '" aria-label="ลบ">' + I.trash + '</button></div>').join('');
    const typeRows = d.taskTypes.map((x, i) => '<div class="erow tt"><input type="color" value="' + esc(/^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : TYPE_COLORS[i % TYPE_COLORS.length]) + '" data-d="taskTypes.' + i + '.color" aria-label="สีของงานนี้" title="สีที่แสดงบนการ์ด"><input value="' + esc(x.name) + '" data-d="taskTypes.' + i + '.name" aria-label="ชื่องาน"><select data-d="taskTypes.' + i + '.cat" aria-label="ประเภท"><option value="draw"' + (x.cat !== 'cam' ? ' selected' : '') + '>งานเขียนแบบ</option><option value="cam"' + (x.cat === 'cam' ? ' selected' : '') + '>งาน CAM</option></select><label class="prod-tog" title="ทำเสร็จแล้วเข้า &quot;รอผลิต&quot; ของฝ่ายผลิตเอง"><input type="checkbox" data-d="taskTypes.' + i + '.prod"' + (toProdType(x.name, d) ? ' checked' : '') + '>ส่งผลิต</label><button class="icon-btn" data-del="taskTypes.' + i + '" aria-label="ลบ">' + I.trash + '</button></div>').join('');
    const levelRows = d.levels.map((x, i) => '<div class="erow two"><input value="' + esc(x.label) + '" data-d="levels.' + i + '.label" aria-label="ระดับ ' + x.level + '"><span class="tag rev">ระดับ ' + x.level + '</span></div>').join('');
    const slaRows = d.groups.map((g, gi) => {
      const r = (d.sla[g] = d.sla[g] || { cam: [1, 2], draw: [2, 3] });
      const inp = (cat, k) => '<td><input type="number" min="0" max="60" value="' + esc(r[cat][k]) + '" data-sla="' + gi + '|' + cat + '|' + k + '" aria-label="' + esc(g) + ' ' + cat + '"></td>';
      return '<tr><td><input class="sla-g" value="' + esc(g) + '" data-d="groups.' + gi + '" placeholder="ชื่อกลุ่มงาน" aria-label="ชื่อกลุ่มงาน"></td>' + inp('cam', 0) + inp('cam', 1) + inp('draw', 0) + inp('draw', 1) +
        '<td><button class="icon-btn" data-del="groups.' + gi + '" aria-label="ลบกลุ่ม ' + esc(g) + '" title="ลบกลุ่มงานนี้">' + I.trash + '</button></td></tr>';
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
      '<div class="editable"><div class="panel-h"><b>ระดับความยาก</b></div>' + levelRows + '</div>' +
      '<div class="editable"><div class="panel-h"><b>เครื่องจักร (ฝ่ายผลิต)</b><button class="btn sm" data-add="machines">' + I.plus + 'เพิ่ม</button></div>' + simpleRows('machines') + '<p class="help">ปุ่มเลือกเครื่องบนบอร์ดผลิต · งานเดียวเลือกได้หลายเครื่อง</p></div></div>' +
      '<div class="editable cl-tpl"><div class="panel-h"><b>เช็กลิสต์มาตรฐาน</b><span class="sub">ใส่ขั้นตอนบรรทัดละ 1 ขั้น · งานใหม่ของรายละเอียดงานนั้นจะได้เช็กลิสต์นี้อัตโนมัติ</span></div>' +
        '<div class="cl-tpl-grid">' + d.taskTypes.filter(x => x.name).map(x => '<label class="f"><span class="lbl">' + typeChip(x.name) + '</span><textarea rows="4" data-cltplf="' + esc(x.name) + '" placeholder="เช่น&#10;เช็กขนาด&#10;ส่ง sale ตรวจ&#10;ส่งต่อ CAM">' + esc(((d.checklists || {})[x.name]) || '') + '</textarea></label>').join('') + '</div></div></section>';

    h += '<section class="panel sec" id="s-sla"><div class="panel-h"><h2>ระยะเวลามาตรฐาน (วันทำการ)</h2></div><p class="help">ใช้คำนวณกำหนดส่งที่แนะนำตอนรับงาน จากวันที่รับงาน + จำนวนวันตามกลุ่มงานและประเภทงาน</p>' +
      '<div class="sla-wrap"><table class="sla"><thead><tr><th>กลุ่มงาน</th><th>CAM ชิ้นเดียว</th><th>CAM หลายชิ้น</th><th>เขียนแบบ ชิ้นเดียว</th><th>เขียนแบบ หลายชิ้น</th><th></th></tr></thead><tbody>' + slaRows + '</tbody></table></div>' +
      '<div class="top-actions"><button class="btn sm" data-add="groups">' + I.plus + 'เพิ่มกลุ่มงาน</button></div>' +
      '<label class="toggle" style="max-width:420px"><input type="checkbox" data-d="skipWeekends"' + (d.skipWeekends !== false ? ' checked' : '') + '> ไม่นับวันเสาร์-อาทิตย์</label>' +
      '<div class="hol"><div class="panel-h"><b>วันหยุดบริษัท</b><span class="sub">ไม่นับเป็นวันทำการตอนคำนวณกำหนดส่ง · แสดงเป็นแถบจางบนชาร์ต</span></div>' +
        '<div class="hol-add"><input type="date" id="holD" aria-label="วันที่"><input id="holN" placeholder="ชื่อวันหยุด เช่น วันมาฆบูชา" aria-label="ชื่อวันหยุด"><button class="btn sm" data-act="holadd">' + I.plus + 'เพิ่ม</button><button class="btn sm ghost" data-act="holfixed">เพิ่มวันหยุดราชการ (วันที่ตายตัว) ปีนี้–ปีหน้า</button></div>' +
        '<div class="hol-list">' + ((d.holidays || []).filter(h => h.d >= addDays(today(), -31)).map(h => '<span class="hol-it' + (h.d < today() ? ' past' : '') + '"><b>' + fdY(h.d) + '</b>' + esc(h.n || '') + '<button class="icon-btn sm" data-holdel="' + esc(h.d) + '" aria-label="ลบ">✕</button></span>').join('') || '<span class="sub">ยังไม่มีวันหยุด — วันพระและวันหยุดชดเชยเพิ่มเองตามประกาศแต่ละปี</span>') + '</div></div></section>' +
    '<section class="panel sec" id="s-salelink"><div class="panel-h"><h2>ปุ่ม Sale ที่หน้าเข้าสู่ระบบ</h2>' + (S.salePinOn ? '<span class="pill s-done">เปิดอยู่</span>' : '<span class="pill s-hold">ปิดอยู่</span>') + '</div>' +
      '<p class="help">ตั้ง PIN ให้ Sale 1 ชุด แล้วที่หน้าเข้าสู่ระบบจะมีปุ่ม "สำหรับ Sale" กดแล้วใส่ PIN ก็เห็นสถานะงานทุกฝ่าย (ฝ่ายแบบ + ฝ่ายผลิต) ไม่ต้องมีบัญชี · เปลี่ยน PIN ได้ตลอด</p>' +
      '<div class="pin-set"><input id="salePinSet" inputmode="numeric" maxlength="6" placeholder="PIN ใหม่ 4–6 หลัก" aria-label="PIN สำหรับ Sale"><button class="btn primary sm" data-act="salepin">' + (S.salePinOn ? 'เปลี่ยน PIN' : 'ตั้ง PIN และเปิดปุ่ม') + '</button>' + (S.salePinOn ? '<button class="btn sm ghost" data-act="salepin" data-clear="1">ปิดปุ่ม Sale</button>' : '') + '</div></section>' +
    '<section class="panel sec" id="s-salelink2"><div class="panel-h"><h2>ลิงก์ดูสถานะงานสำหรับ Sale</h2></div><p class="help">Sale เปิดลิงก์แล้วเห็นสถานะงานของตัวเอง (อ่านอย่างเดียว ไม่ต้องเข้าสู่ระบบ) — ไม่แสดงชื่อคนทำ เวลาทำงาน และข้อความภายในทีม</p>' +
      (S.saleKey ? '<div class="sale-links">' + [''].concat(d.sales || []).map(n => { const u = saleLinkUrl(S.saleKey, n); return '<div class="sl-row"><b>' + (n ? 'Sale ' + esc(n) : 'ทุก Sale (สำหรับหัวหน้าฝ่ายขาย)') + '</b><code>' + esc(u) + '</code><button class="btn sm" data-act="copysale" data-url="' + esc(u) + '">คัดลอก</button></div>'; }).join('') + '</div>' +
        '<div class="top-actions"><button class="btn sm ghost" data-act="salelink" data-reset="1">สร้างลิงก์ใหม่ (ลิงก์เก่าจะใช้ไม่ได้)</button></div>'
      : '<div class="top-actions"><button class="btn primary sm" data-act="salelink">แสดงลิงก์</button></div>') + '</section>';
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
  if (j && j.pending) return toast('กำลังบันทึกงานนี้ รอสักครู่…');
  const base = j ? clone(j) : {
    code: '', title: '', group: '', taskType: '', qty: 'single', level: '', assignee: isAdmin() && S.f.member !== 'all' && S.f.member.indexOf('__') !== 0 ? S.f.member : S.me,
    sale: '', priority: 'normal', revision: false, status: 'queue', received: today(), due: '', startedAt: '', finishedAt: '', note: ''
  };
  base.baseUpdatedAt = j ? j.updatedAt : '';
  S.edit = { job: base, isNew: !j, confirm: false, hist: null, dueTouched: !!(j && j.due), mode: j ? 'view' : 'edit' };
  hideHover();
  renderEditor();
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
  if (S.edit.isNew) setTimeout(() => { const el = $('#e-code'); if (el) el.focus(); }, 260);
  if (j) loadCmts(j.id);
  if (j) api().activity({ jobId: j.id }).then(h => { if (S.edit && S.edit.job.id === j.id) { S.edit.hist = h; const el = $('#hist'); if (el) el.innerHTML = histHtml(h); } }).catch(() => {});
}
function closeEditor() { dropPending(S.edit); S.edit = null; $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); }
function opts(list, val, ph, labelFn) {
  const arr = (list || []).slice(); if (val && arr.indexOf(val) < 0) arr.unshift(val);
  return '<option value="">' + (ph || 'เลือก') + '</option>' + arr.map(x => '<option value="' + esc(x) + '"' + (x === val ? ' selected' : '') + '>' + esc(labelFn ? labelFn(x) : x) + '</option>').join('');
}
function histHtml(h) {
  if (!h || !h.length) return '<span>ยังไม่มีประวัติ</span>';
  const act = { create: 'สร้างงาน', status: 'เปลี่ยนสถานะ', edit: 'แก้ไข', timer: 'จับเวลา', delete: 'ลบ' };
  const stl = s => String(s).replace(/\b(queue|doing|review|fix|hold|done)\b/g, m => ST[m].label);
  return h.slice(0, 12).map(a => '<div><b>' + esc(a.who || 'ระบบ') + '</b> ' + esc(act[a.action] || a.action) + (a.detail && a.action !== 'create' ? ' · ' + esc(stl(a.detail)) : '') + ' <span class="muted">· ' + esc(fdt(String(a.ts).slice(0, 16))) + '</span></div>').join('');
}
function renderEditor() {
  const E = S.edit; if (!E) return;
  const j = E.job, s = S.settings, live = E.isNew ? null : jobById(j.id);
  const ro = !E.isNew && !canEdit(live || j);
  $('#sheetEyebrow').textContent = E.isNew ? 'งานใหม่' : (ST[j.status] ? ST[j.status].label : '') + (live && isLate(live) ? ' · เลยกำหนด' : '');
  $('#sheetTitle').textContent = E.isNew ? 'เพิ่มงานใหม่' : j.code;
  $('#sheet').classList.toggle('viewing', E.mode === 'view');
  const sg = suggestDue(j);
  const dueHint = sg ? '<span class="hint">แนะนำ ' + fdY(sg.date) + ' (' + (sg.cat === 'cam' ? 'CAM' : 'เขียนแบบ') + ' ' + sg.days + ' วันทำการ)' + (j.due !== sg.date ? ' · <button type="button" data-act="usesg">ใช้วันนี้</button>' : '') + '</span>' : '<span class="hint">เลือกกลุ่มงานและรายละเอียดเพื่อให้ระบบแนะนำกำหนดส่ง</span>';

  let timer = '';
  if (!E.isNew && live) {
    const run = myRunOn(j.id) || runningOf(j.id), mine = run && run.member === S.me;
    const logs = S.logs.filter(l => l.jobId === j.id).sort((a, b) => String(b.start).localeCompare(String(a.start)));
    const canStop = run && (run.member === S.me || isAdmin());
    timer = '<div class="timer-card"><div class="timer-main"><div class="clock"><span data-total="' + esc(j.id) + '">' + fdur(totalMinutes(live)) + '</span><small>' + (run ? '● ' + esc(run.member) + ' กำลังจับเวลา <span data-since="' + esc(run.start) + '">' + clock(Date.now() - parseLocal(run.start)) + '</span>' : 'เวลาทำงานรวม ' + logs.length + ' ครั้ง') + '</small></div>' +
      (run ? (canStop ? '<button type="button" class="btn rec" data-act="stop" data-log="' + esc(run.id) + '">' + I.stop + (mine ? 'หยุด' : 'หยุดให้ ' + esc(run.member)) + '</button>' : '')
        : (j.status !== 'done' && !ro ? '<button type="button" class="btn primary" data-act="start" data-job="' + esc(j.id) + '">' + I.play + 'เริ่มจับเวลา</button>' : '')) + '</div>' +
      (logs.length ? '<div class="logs">' + logs.slice(0, 8).map(l => '<div>' + av(l.member) + '<span>' + fdt(l.start) + (l.end ? ' – ' + l.end.slice(11, 16) : ' – ตอนนี้') + '</span><span class="tnum">' + (l.end ? fdur(l.minutes) : '') + '</span>' + (l.end && (l.member === S.me || isAdmin()) ? '<button type="button" class="x" data-dellog="' + esc(l.id) + '" aria-label="ลบรายการเวลา">ลบ</button>' : '<span></span>') + '</div>').join('') + '</div>' : '') + '</div>';
  }

  if (E.mode === 'view' && live) return renderDetail(E, j, live, ro, timer);
  const statusSeg = '<div class="seg status">' + ['queue', 'doing', 'review', 'fix', 'hold', 'done'].map(st => '<button type="button" class="' + ST[st].cls + '" data-est="' + st + '" aria-pressed="' + (j.status === st) + '">' + ST[st].label + '</button>').join('') + '</div>';
  const levels = (s.levels && s.levels.length ? s.levels : defaultSettings().levels);

  $('#sheetBody').innerHTML =
    (ro ? '<div class="banner"><span><b>ดูอย่างเดียว</b> งานของ ' + esc(j.assignee || 'คนอื่น') + ' แก้ไขได้เฉพาะผู้รับผิดชอบ คนที่ลงงาน หรือแอดมิน</span></div>' : '') +
    '<div class="f"><span class="lbl">สถานะ</span>' + statusSeg + '</div>' + timer +
    '<fieldset><legend>ข้อมูลงาน</legend>' +
      '<div class="f"><label for="e-code">เลข Job</label><input id="e-code" class="mono" data-e="code" value="' + esc(j.code) + '" placeholder="เช่น R69-10012S" autocomplete="off"></div>' +
      '<div class="f"><label for="e-title">ลูกค้า / โครงการ</label><input id="e-title" data-e="title" autocomplete="off" value="' + esc(j.title) + '" placeholder="เช่น ผนังล็อบบี้โรงแรม"></div>' +
      '<div class="f"><label for="e-group">กลุ่มงาน</label><select id="e-group" data-e="group">' + opts(s.groups, j.group) + '</select></div>' +
      '<div class="f"><label for="e-type">รายละเอียดงาน</label><select id="e-type" data-e="taskType">' + opts(s.taskTypes.map(t => t.name), j.taskType) + '</select></div>' +
      '<div class="f"><span class="lbl">จำนวนชิ้น</span><div class="seg"><button type="button" data-eqty="single" aria-pressed="' + (j.qty !== 'multi') + '">ชิ้นเดียว</button><button type="button" data-eqty="multi" aria-pressed="' + (j.qty === 'multi') + '">หลายชิ้น / ต่างแบบ</button></div></div>' +
      '<div class="f"><span class="lbl">ระดับความยาก</span><div class="seg">' + levels.map(x => '<button type="button" data-elv="' + x.level + '" aria-pressed="' + (+j.level === x.level) + '" title="' + esc(x.label) + '">' + x.level + '</button>').join('') + '</div><span class="hint">' + esc((levels.find(x => x.level === +j.level) || {}).label || 'เลือกระดับ 1–3') + '</span></div>' +
      '<div class="f"><label for="e-assignee">ผู้รับผิดชอบ</label><select id="e-assignee" data-e="assignee">' + opts(designers().map(x => x.name), j.assignee, 'ยังไม่มอบหมาย') + '</select></div>' +
      '<div class="f"><label for="e-sale">Sale</label><select id="e-sale" data-e="sale">' + opts(s.sales, j.sale, 'เลือก sale') + '</select></div>' +
      helpersField(j, ro || (!E.isNew && !P.leads(S.user, live || j))) +
      '<label class="toggle"><input type="checkbox" data-e="priority"' + (j.priority === 'urgent' ? ' checked' : '') + ' style="accent-color:var(--urgent)"><span><b>งานด่วน</b></span></label>' +
      '<label class="toggle"><input type="checkbox" data-e="revision"' + (j.revision ? ' checked' : '') + ' style="accent-color:var(--review)"><span><b>งานแก้ไข</b></span></label>' +
    '</fieldset>' +
    editorImgs(E, live, ro) + (E.isNew ? newExtras(E) : '') +
    '<fieldset><legend>กำหนดเวลา</legend>' +
      '<div class="f"><label for="e-received">วันที่รับงาน</label><input type="date" id="e-received" data-e="received" value="' + esc(j.received) + '"></div>' +
      '<div class="f"><label for="e-due">กำหนดส่ง</label><input type="date" id="e-due" data-e="due" value="' + esc(j.due) + '">' + dueHint + '</div>' +
      (!E.isNew ? '<div class="f"><label for="e-started">เริ่มทำ</label><input type="datetime-local" id="e-started" data-e="startedAt" value="' + esc(j.startedAt) + '"></div>' +
        '<div class="f"><label for="e-finished">ปิดงาน</label><input type="datetime-local" id="e-finished" data-e="finishedAt" value="' + esc(j.finishedAt) + '"' + (j.status !== 'done' ? ' disabled' : '') + '></div>' : '') +
      '<div class="f full"><label for="e-note">หมายเหตุ</label><textarea id="e-note" data-e="note" autocomplete="off" placeholder="เช่น เหลืออีก 1 แผ่น, รอไฟล์ลูกค้า">' + esc(j.note) + '</textarea></div>' +
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
function helpersField(j, locked) {
  const hs = helpersOf(j), pool = designers().filter(m => m.name !== j.assignee && (m.role !== 'admin' || hs.includes(m.name)));
  return '<div class="f full"><span class="lbl">ผู้ร่วมทำงาน <small class="muted">' + (locked ? 'เพิ่ม/ลบได้เฉพาะผู้รับผิดชอบงาน' : 'กดเลือกคนที่มาช่วยทำงานนี้ (เลือกได้หลายคน)') + '</small></span>' +
    '<div class="helper-pick">' + (pool.length ? pool.map(m => '<button type="button" class="hp-mem' + (hs.includes(m.name) ? ' on' : '') + '" data-ehelp="' + esc(m.name) + '" aria-pressed="' + hs.includes(m.name) + '"' + (locked ? ' disabled' : '') + '>' + avUser(m, 'sm') + '<span>' + esc(m.name) + '</span>' + (hs.includes(m.name) ? '<i>✓</i>' : '') + '</button>').join('') : '<span class="muted">ยังไม่มีคนอื่นในทีม</span>') + '</div></div>';
}
/* รูปงานในฟอร์ม: ลากรูปมาวาง / วางจากคลิปบอร์ด / เลือกไฟล์ — งานใหม่จะอัปโหลดหลังกดเพิ่มงาน */
function editorImgs(E, live, ro) {
  const pend = E.pending || [], have = live ? imgsOf(live.id) : [], room = IMG_MAX - have.length - pend.length - (live ? (S.uploading || 0) : 0);
  const canAdd = !ro && (E.isNew || canAddImg(live));
  if (!canAdd && !have.length) return '';
  const tiles = have.map(m => '<button type="button" class="dz-it" data-lbopen="' + esc(m.id) + '" data-lbjob="' + esc(live.id) + '">' + thumbImg(m) + '</button>').join('') +
    (live ? Array.from({ length: S.uploading || 0 }).map(() => '<span class="dz-it up"><span class="spin-dot dark"></span></span>').join('') : '') +
    pend.map(p => '<span class="dz-it pend"><img src="' + p.url + '" alt=""><button type="button" class="dz-x" data-pendx="' + esc(p.id) + '" aria-label="เอารูปนี้ออก">✕</button></span>').join('');
  return '<fieldset class="dz-fs"><legend>รูปงาน <small>' + (have.length + pend.length) + '/' + IMG_MAX + '</small></legend>' +
    (canAdd ? '<label class="dropzone' + (have.length || pend.length ? ' has' : '') + '" id="eDrop"><input type="file" accept="image/*" multiple id="eImgIn" hidden' + (room <= 0 ? ' disabled' : '') + '>' +
      '<span class="dz-ic">' + STI.camera + '</span><span class="dz-t"><b>' + (room > 0 ? 'ลากรูปมาวางที่นี่' : 'ครบ ' + IMG_MAX + ' รูปแล้ว') + '</b><small>' + (room > 0 ? 'หรือกดเพื่อเลือกรูป · วางรูปที่คัดลอกไว้ (Ctrl+V) ได้' : 'ลบรูปเดิมก่อนถ้าต้องการเพิ่ม') + '</small></span></label>' : '') +
    (tiles ? '<div class="dz-grid">' + tiles + '</div>' : '') +
    (E.isNew && pend.length ? '<span class="hint">รูปจะอัปโหลดอัตโนมัติหลังกด "เพิ่มงาน"</span>' : '') + '</fieldset>';
}
function addEditorFiles(files) {
  const E = S.edit; if (!E) return;
  files = Array.from(files || []).filter(f => /^image\//.test(f.type));
  if (!files.length) return toast('เลือกไฟล์รูปภาพ (JPG, PNG)', true);
  if (E.mode === 'edit') readEditor();
  if (!E.isNew) { const live = jobById(E.job.id); if (live) uploadImages(live.id, files); return; }
  E.pending = E.pending || [];
  const room = IMG_MAX - E.pending.length; if (room <= 0) return toast('ใส่รูปได้สูงสุด ' + IMG_MAX + ' รูปต่องาน', true);
  if (files.length > room) toast('ใส่ได้อีก ' + room + ' รูป (สูงสุด ' + IMG_MAX + ' รูปต่องาน)', true);
  files.slice(0, room).forEach(f => E.pending.push({ id: uid('p_'), file: f, url: URL.createObjectURL(f) }));
  renderEditor();
}
function dropPending(E) { (E && E.pending || []).forEach(p => { try { URL.revokeObjectURL(p.url); } catch (x) {} }); }
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
  if (S.edit.isNew) { const clash = codeClash(j.code, j.taskType, S.jobs); if (clash) { err.hidden = false; err.textContent = clash; return; } if (!clOf(j).length && clTemplate(j.taskType).length) j.checklist = JSON.stringify(clTemplate(j.taskType)); }
  const btn = document.querySelector('#sheetFoot [data-act="save"]'); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
  const pre = Object.assign({}, j); delete pre.minutes;
  if (isCam(pre) && pre.status === 'review') { pre.status = 'done'; if (!pre.finishedAt) pre.finishedAt = nowLocal(); }
  // แก้ไขงานเดิม: ปิดหน้าต่างและอัปเดตบนจอทันที แล้วบันทึกเบื้องหลัง (ถ้าไม่สำเร็จจะเปิดฟอร์มเดิมคืนให้)
  if (!S.edit.isNew && !(pre.status === 'done' && runningOf(pre.id))) {
    const live = jobById(pre.id), prev = live ? clone(live) : null, draft = clone(j);
    if (live) Object.assign(live, pre);
    closeEditor(); render();
    S.saving = (S.saving || 0) + 1;
    try { await saveJob(pre, 'บันทึกแล้ว'); if (pre.status === 'done' && prev && prev.status !== 'done') offerCam(jobById(pre.id)); }
    catch (e) {
      if (prev) upsert(S.jobs, prev); render();
      if (e.code !== 'auth') { openEditor(pre.id); S.edit.job = Object.assign(draft, { baseUpdatedAt: draft.baseUpdatedAt }); S.edit.mode = 'edit'; S.edit.dueTouched = true; renderEditor(); const er = $('#eErr'); if (er) { er.hidden = false; er.textContent = 'ยังไม่ได้บันทึก: ' + e.message; } }
    }
    S.saving--;
    return;
  }
  // งานใหม่: ขึ้นบนบอร์ดทันที (สถานะ "กำลังบันทึก") แล้วบันทึกเบื้องหลัง — ถ้าไม่สำเร็จเปิดฟอร์มคืนพร้อมข้อมูลเดิม
  if (S.edit.isNew) {
    const files = (S.edit.pending || []).map(p => p.file), docs = (S.edit.pfiles || []).slice(), cmt = (($('#eCmt') || {}).value || '').trim(), draft = clone(j), tmpId = uid('tmp_');
    S.jobs.push(Object.assign({}, pre, { id: tmpId, minutes: 0, pending: true, createdBy: S.me, assignee: isAdmin() ? pre.assignee : S.me }));
    closeEditor(); render(); toast('กำลังเพิ่มงาน ' + j.code + '…');
    S.saving = (S.saving || 0) + 1;
    try {
      const r = await mutate(() => api().saveJob({ job: pre }), 'เพิ่มงาน ' + j.code + ' แล้ว' + (files.length ? ' · กำลังอัปโหลดรูป ' + files.length + ' รูป' : ''));
      S.jobs = S.jobs.filter(x => x.id !== tmpId); upsert(S.jobs, r.job); render();
      if (files.length) uploadImages(r.job.id, files);
      if (docs.length) uploadFiles(r.job.id, docs);
      if (cmt) api().addComment({ jobId: r.job.id, text: cmt }).then(() => { S.cmtSelf = S.cmtSelf || {}; S.cmtSelf[r.job.id] = (S.cmtSelf[r.job.id] || 0) + 1; (S.cmtCount = S.cmtCount || {})[r.job.id] = ((S.cmtCount || {})[r.job.id] || 0) + 1; render(); }).catch(e => toast('ส่งคอมเมนต์ไม่สำเร็จ: ' + e.message, true));
    } catch (e) {
      S.jobs = S.jobs.filter(x => x.id !== tmpId); render();
      if (e.code !== 'auth') {
        openEditor(); S.edit.job = draft; S.edit.dueTouched = true; S.edit.pending = files.map(f => ({ id: uid('p_'), file: f, url: URL.createObjectURL(f) })); S.edit.pfiles = docs; S.edit.firstCmt = cmt; renderEditor();
        const er = $('#eErr'); if (er) { er.hidden = false; er.textContent = 'ยังไม่ได้เพิ่มงาน: ' + e.message; }
      }
    }
    S.saving--;
    return;
  }
  try {
    const payload = pre;
    if (payload.status === 'done' && runningOf(payload.id)) applyStop(await api().stopTimer({ logId: runningOf(payload.id).id }));
    const files = S.edit.isNew ? (S.edit.pending || []).map(p => p.file) : [];
    const saved = await saveJob(payload, S.edit.isNew ? 'เพิ่มงาน ' + j.code + ' แล้ว' + (files.length ? ' · กำลังอัปโหลดรูป ' + files.length + ' รูป' : '') : 'บันทึกแล้ว');
    closeEditor(); render();
    if (files.length && saved && saved.id) uploadImages(saved.id, files);
  } catch (e) { err.hidden = false; err.textContent = e.message; btn.disabled = false; btn.textContent = 'บันทึก'; }
}

/* ============ navigation ============ */
function go(view, sec) {
  if (S.view === 'settings' && view !== 'settings' && S.draftDirty) { toast('มีการตั้งค่าที่ยังไม่บันทึก กดบันทึกหรือยกเลิกก่อน', true); return; }
  S.view = view; LS.set('view', view); S.animIn = true; render();
  if (sec) setTimeout(() => { const el = document.getElementById('s-' + sec); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  else window.scrollTo(0, 0);
}

/* ============ ฝ่ายผลิต + ภาพรวมบริษัท ============
   1 เลข Job = 1 งานที่เดินต่อกันทั้งบริษัท: ฝ่ายแบบ (CAD → CAM) → รอผลิต → ลงเครื่อง → ทำสี → แพ็ค → พร้อมส่ง → ส่งแล้ว
   งานประเภทที่ "ส่งเข้าผลิต" (ค่าเริ่มต้น: ชื่อมีคำว่า CAM) ทำเสร็จแล้วเข้า "รอผลิต" เอง
   อัปเดตงานผลิตได้: ฝ่ายผลิต หัวหน้างาน แอดมิน · คนอื่นดูอย่างเดียว (หลังบ้านตรวจสิทธิ์ซ้ำ) */
const DEF_MACHINES = ['Router', 'Laser', 'Punching', 'WaterJet'];
const PSTG = {
  wait: { label: 'รอผลิต', sub: 'รอเลือกเครื่อง', cls: 'p-wait', empty: 'ยังไม่มีงานรอผลิต' },
  machine: { label: 'ลงเครื่อง', sub: 'กำลังผลิต', cls: 'p-machine', empty: 'ไม่มีงานบนเครื่อง' },
  paint: { label: 'ทำสี', sub: 'พ่น / ทำสี', cls: 'p-paint', empty: 'ไม่มีงานรอทำสี' },
  assemble: { label: 'ประกอบ', sub: 'ประกอบติดตั้ง', cls: 'p-assemble', empty: 'ไม่มีงานรอประกอบ' },
  pack: { label: 'แพ็ค', sub: 'แพ็คงาน', cls: 'p-pack', empty: 'ไม่มีงานรอแพ็ค' },
  ready: { label: 'พร้อมส่ง', sub: 'รอส่งลูกค้า', cls: 'p-ready', empty: 'ยังไม่มีงานพร้อมส่ง' },
  shipped: { label: 'ส่งแล้ว', sub: 'ส่งถึงลูกค้า', cls: 'p-shipped', empty: '' }
};
const PCOLS = ['wait', 'machine', 'paint', 'assemble', 'pack', 'ready'];
const PORDER = PCOLS.concat('shipped');
const PSKIP = { paint: 'paint', assemble: 'assy' };   // ขั้นที่ติ๊ก "ไม่ต้อง" ได้ → ชื่อช่องธง
const pSkipped = (p, st) => !!PSKIP[st] && !!p && p[PSKIP[st]] === 'no';
function pNextOf(p) { let i = PORDER.indexOf(p.stage) + 1; while (PORDER[i] && pSkipped(p, PORDER[i])) i++; return PORDER[i] || ''; }
function pPrevOf(p) { let i = PORDER.indexOf(p.stage) - 1; while (i > 0 && pSkipped(p, PORDER[i])) i--; return i >= 0 ? PORDER[i] : ''; }
const PDONE = { paint: 'ทำสีเสร็จ', assemble: 'ประกอบเสร็จ', pack: 'แพ็คเสร็จ', ready: 'ส่งแล้ว' };
const PIC = {
  wait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9l8-5 8 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 20v-6h6v6"/></svg>',
  machine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 13V9h10v4M12 9V4M9.5 6.5L12 4l2.5 2.5"/><circle cx="7.5" cy="16.5" r=".6" fill="currentColor"/><path d="M11 16.5h6"/></svg>',
  paint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="13" height="6" rx="1.5"/><path d="M17 6h2.5v5H11v3"/><rect x="9.5" y="14" width="3" height="7" rx="1"/></svg>',
  assemble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6.5a4 4 0 0 0-5.3 5.1L3.8 17a1.7 1.7 0 0 0 2.4 2.4l5.4-5.4a4 4 0 0 0 5.1-5.3l-2.3 2.3-2.2-.4-.4-2.2z"/><path d="M17 15l4 4M19 13l2 2"/></svg>',
  pack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9M7.8 5.2l8.5 4.6"/></svg>',
  ready: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  shipped: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>',
  design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l3.5-1 11-11-2.5-2.5-11 11zM14 5.5l2.5-2.5 2.5 2.5L16.5 8"/><path d="M13 21h8"/></svg>',
  sale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};
const canProd = () => !!S.user && (S.user.role === 'prod' || S.user.role === 'admin');   // บอร์ดผลิต: ฝ่ายผลิตและแอดมินแก้ได้
const isProdRole = () => !!S.user && S.user.role === 'prod';
const machinesList = () => { const m = (S.settings && S.settings.machines || []).map(x => String(x || '').trim()).filter(Boolean); return m.length ? m : DEF_MACHINES; };
function pms(p) { try { const a = JSON.parse((p && p.machines) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.m) : []; } catch (e) { return []; } }
function phist(p) { try { const a = JSON.parse((p && p.history) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
const prodsAll = () => S.prods || [];
const prodById = id => prodsAll().find(p => p.id === id);
function prodOfCode(code) {
  const c = String(code || '').toLowerCase(), a = prodsAll().filter(p => String(p.code).toLowerCase() === c);
  return a.find(p => p.stage !== 'shipped') || a.sort((x, y) => String(y.shippedAt).localeCompare(String(x.shippedAt)))[0] || null;
}
function pStageSince(p) { const h = phist(p).filter(x => x.s === p.stage).pop(); return (h && h.t) || p.updatedAt || p.enteredAt || ''; }
function pAge(p) { const s = pStageSince(p); return s ? Math.max(0, daysBetween(String(s).slice(0, 10), today())) : 0; }
const pAgeTxt = n => n <= 0 ? 'วันนี้' : n + ' วัน';
function pStuck(p) { const n = pAge(p); return p.stage === 'wait' ? n >= 3 : p.stage === 'ready' ? n >= 3 : (p.stage === 'machine' || p.stage === 'paint' || p.stage === 'assemble' || p.stage === 'pack') ? n >= 2 : false; }
function designJobsOf(code) { const c = String(code || '').toLowerCase(); return S.jobs.filter(j => String(j.code).toLowerCase() === c); }
function pDueTag(p) {   // กำหนดส่งของงานผลิต (ใส่ได้ตอนเพิ่มงานที่ไม่ผ่านฝ่ายแบบ)
  if (!p.due || p.stage === 'shipped') return '';
  const n = daysBetween(today(), p.due), done = p.stage === 'ready', cls = done ? '' : n < 0 ? ' late' : n <= 1 ? ' soon' : '';
  return '<span class="tag pt-due' + cls + '" title="กำหนดส่ง ' + esc(fdY(p.due)) + '">' + (cls === ' late' ? STI.fire : STI.calendar) + (done ? 'ส่ง ' + fd(p.due) : n < 0 ? 'เลยส่ง ' + (-n) + ' วัน' : n === 0 ? 'ส่งวันนี้' : n === 1 ? 'ส่งพรุ่งนี้' : 'ส่ง ' + fd(p.due)) + '</span>';
}
function pThumb(p) { const own = imgsOf(p.id); if (own.length) return { img: own[0], job: { id: p.id } }; for (const j of designJobsOf(p.code)) { const im = imgsOf(j.id); if (im.length) return { img: im[0], job: j }; } return null; }
const stIdx = st => PCOLS.indexOf(st === 'shipped' ? 'ready' : st);
function pTrack(p) {   // แถบความคืบหน้าแบบเดียวกับฝ่ายแบบ: รอผลิต → เครื่อง → สี → แพ็ค → พร้อมส่ง
  const i = p.stage === 'shipped' ? PCOLS.length - 1 : stIdx(p.stage), pct = i / (PCOLS.length - 1) * 100;
  return '<div class="trk ' + PSTG[p.stage].cls + (p.stage === 'shipped' || p.stage === 'ready' ? ' fin' : '') + '" style="--p:' + pct + '%"><span class="trk-line"><i></i></span>' +
    PCOLS.map((f, k) => '<span class="trk-dot' + (k <= i ? ' on' : '') + (pSkipped(p, f) ? ' skip' : '') + '" style="left:' + (k / (PCOLS.length - 1) * 100) + '%"></span>').join('') +
    '<span class="trk-rider' + (p.stage === 'machine' ? ' go' : '') + '">' + PIC[p.stage] + '</span></div>';
}
function pPill(st, txt) { return '<span class="pill ' + PSTG[st].cls + '">' + esc(txt || PSTG[st].label) + '</span>'; }

/* ---- เขียนข้อมูล (อัปเดตหน้าจอทันที แล้วค่อยรอหลังบ้าน) ---- */
async function prodWrite(id, patch, okMsg) {
  const cur = id ? prodById(id) : null, prev = cur ? clone(cur) : null;
  if (cur) { Object.assign(cur, patch, { pending: true }); if (patch.machines !== undefined) cur.machines = JSON.stringify(patch.machines); render(); if (P2.id === id) pModalDraw(); }
  try {
    const r = await mutate(() => api().prodSave({ prod: Object.assign({ id: id || undefined, baseUpdatedAt: prev ? prev.updatedAt : undefined }, patch) }), okMsg);
    S.prods = S.prods || []; upsert(S.prods, Object.assign(r.prod, { pending: false }));
    render(); if (P2.id === (id || r.prod.id)) pModalDraw();
    return r.prod;
  } catch (e) {
    if (cur && prev) { Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, prev); render(); if (P2.id === id) pModalDraw(); }
    return null;
  }
}
const pNow = () => nowLocal();
function pAdvance(p) {   // ปุ่มหลักบนการ์ด: ทำสี → ประกอบ → แพ็ค → พร้อมส่ง → ส่งแล้ว (ข้ามขั้นที่ติ๊ก "ไม่ต้อง")
  const to = pNextOf(p); if (!PDONE[p.stage] || !to) return;
  return prodWrite(p.id, { stage: to }, p.code + ' ' + PDONE[p.stage] + (to === 'shipped' ? ' 🎉' : ' → ' + PSTG[to].label));
}
function pBack(p) {
  const to = pPrevOf(p); if (!to) return;
  const patch = { stage: to, why: 'ย้อนกลับ' };
  if (to === 'machine') patch.machines = pms(p).map((m, k, a) => k === a.length - 1 ? { m: m.m, d: '' } : m);   // ย้อนกลับไปเครื่องสุดท้าย
  if (to === 'wait') patch.machines = pms(p).map(m => ({ m: m.m, d: '' }));
  return prodWrite(p.id, patch, p.code + ' ย้อนกลับเป็น ' + PSTG[to].label);
}
function pMachineDone(p, name) {
  const ms = pms(p).map(m => m.m === name ? { m: m.m, d: m.d ? '' : pNow() } : m), left = ms.filter(m => !m.d).length;
  const after = left ? 'เหลืออีก ' + left + ' เครื่อง' : 'ครบทุกเครื่อง → ' + PSTG[pNextOf(p)].label;
  return prodWrite(p.id, { machines: ms }, p.code + ' · ' + name + (ms.find(m => m.m === name).d ? ' เสร็จ · ' + after : ' ยกเลิกเสร็จ'));
}
function pStart(p) {
  S.psel = S.psel || {};
  const sel = (S.psel && S.psel[p.id]) || pms(p).map(m => m.m);
  if (!sel.length) { toast('เลือกเครื่องก่อน (เลือกได้มากกว่า 1 เครื่อง)', true); return; }
  delete S.psel[p.id];
  return prodWrite(p.id, { stage: 'machine', machines: sel.map(m => ({ m: m, d: '' })), paint: p.paint, assy: p.assy }, p.code + ' เริ่มลงเครื่อง ' + sel.join(' + '));
}

function pSkipTogs(p, ro) {   // "ไม่ต้องทำสี" / "ไม่ต้องประกอบ"
  return [['paint', 'ppaint', 'ไม่ต้องทำสี'], ['assy', 'passy', 'ไม่ต้องประกอบ']].map(x => { const on = p[x[0]] === 'no';
    return '<button type="button" class="ptog' + (on ? ' on' : '') + '"' + (ro ? ' disabled' : '') + ' data-' + x[1] + '="' + esc(p.id) + '" aria-pressed="' + on + '">' + (on ? PIC.check : '') + x[2] + '</button>'; }).join('');
}
/* ---- การ์ดงานผลิต ---- */
function pcard(p) {
  const ro = !canProd() || p.pending, ms = pms(p), th = pThumb(p), age = pAge(p), stuck = pStuck(p), F = S.pm || 'all';
  let body = '';
  if (p.stage === 'wait') {
    const sel = (S.psel && S.psel[p.id]) || ms.map(m => m.m);
    body = ro ? '<div class="pc-note">' + (canProd() ? '' : 'รอฝ่ายผลิตเลือกเครื่อง') + '</div>'
      : '<div class="pc-pick" role="group" aria-label="เลือกเครื่อง">' + machinesList().map(m => '<button type="button" class="mchip' + (sel.indexOf(m) >= 0 ? ' on' : '') + '" data-pmt="' + esc(m) + '" data-pid="' + esc(p.id) + '" aria-pressed="' + (sel.indexOf(m) >= 0) + '">' + (sel.indexOf(m) >= 0 ? PIC.check : '') + esc(m) + '</button>').join('') + '</div>' +
        '<div class="pc-row"><span class="pc-skips">' + pSkipTogs(p, false) + '</span>' +
        '<button type="button" class="btn primary sm pc-go" data-pstart="' + esc(p.id) + '"' + (sel.length ? '' : ' disabled') + '>' + PIC.machine + 'เริ่มลงเครื่อง' + (sel.length > 1 ? ' (' + sel.length + ')' : '') + '</button></div>';
  } else if (p.stage === 'machine') {
    body = '<div class="pc-ms">' + ms.map(m => '<button type="button" class="mrow' + (m.d ? ' done' : '') + (F !== 'all' && F === m.m ? ' hi' : '') + '"' + (ro ? ' disabled' : '') + ' data-pmd="' + esc(m.m) + '" data-pid="' + esc(p.id) + '" title="' + (m.d ? 'เสร็จ ' + esc(fdt(m.d)) + ' · กดอีกครั้งเพื่อยกเลิก' : 'กดเมื่อเครื่องนี้ทำเสร็จ') + '">' +
      '<span class="mr-box">' + (m.d ? PIC.check : '') + '</span><b>' + esc(m.m) + '</b><small>' + (m.d ? 'เสร็จ ' + esc(fdt(m.d).replace(/^.* /, '')) : 'กำลังทำ') + '</small></button>').join('') + '</div>';
  } else if (PDONE[p.stage]) {
    const nx = pNextOf(p);
    body = ms.length ? '<div class="pc-mdone">' + ms.map(m => '<span>' + PIC.check + esc(m.m) + '</span>').join('') + '</div>' : '';
    if (!ro) body += '<button type="button" class="btn sm pc-go ' + (p.stage === 'ready' ? 'primary' : 'adv-' + p.stage) + '" data-padv="' + esc(p.id) + '" title="' + (nx && nx !== 'shipped' ? 'ไปขั้น ' + PSTG[nx].label : '') + '">' + PIC[nx || 'shipped'] + PDONE[p.stage] + '</button>';
  }
  return '<div class="card pcard ' + PSTG[p.stage].cls + (p.pending ? ' is-pending' : '') + (stuck ? ' is-late' : '') + '" data-popen="' + esc(p.id) + '" tabindex="0" role="button">' +
    '<div class="card-top"><div class="code">' + esc(p.code) + '</div>' +
      (th ? '<button type="button" class="card-th" data-lbopen="' + esc(th.img.id) + '" data-lbjob="' + esc(th.job.id) + '" aria-label="ดูรูปงาน">' + thumbImg(th.img) + '</button>' : '') +
      (!ro && p.stage !== 'wait' ? '<button type="button" class="adv pback" data-pback="' + esc(p.id) + '" title="ย้อนกลับ 1 ขั้น" aria-label="ย้อนกลับ 1 ขั้น">' + PIC.back + '</button>' : '') + '</div>' +
    (p.title ? '<div class="title">' + esc(p.title) + '</div>' : '') +
    '<div class="tags">' + (p.stage === 'machine' ? '<span class="tag pt-mc">' + PIC.machine + 'เสร็จ ' + ms.filter(m => m.d).length + '/' + ms.length + ' เครื่อง</span>' : '') + (p.paint === 'no' ? '<span class="tag pt-nopaint">ไม่ทำสี</span>' : '') + (p.assy === 'no' ? '<span class="tag pt-noassy">ไม่ประกอบ</span>' : '') + (p.group ? groupChip(p.group) : '') + pDueTag(p) + '</div>' + (p.note ? '<div class="pc-notetx" title="' + esc(p.note) + '">' + STI.note + '<span>' + esc(p.note) + '</span></div>' : '') +
    body + pTrack(p) +
    '<div class="card-foot"><span>' + esc(p.sale ? 'Sale ' + p.sale : '') + '</span><span class="due' + (stuck ? ' late' : '') + '" title="อยู่ขั้นนี้มาแล้ว">' + (stuck ? STI.fire : STI.clock) + 'อยู่ขั้นนี้ ' + pAgeTxt(age) + '</span></div></div>';
}

/* ---- บอร์ดฝ่ายผลิต ---- */
function prodPool() {
  const q = String(S.pq || '').trim().toLowerCase();
  return prodsAll().filter(p => !q || [p.code, p.title, p.sale, p.group, p.note].join(' ').toLowerCase().indexOf(q) >= 0);
}
function viewProd() {
  const pool = prodPool(), F = S.pm || 'all', open = pool.filter(p => p.stage !== 'shipped');
  const inMachine = (p, m) => p.stage === 'machine' && pms(p).some(x => x.m === m && !x.d);
  const cols = PCOLS.map(st => {
    let js = open.filter(p => p.stage === st);
    if (st === 'machine' && F !== 'all') js = js.filter(p => inMachine(p, F));
    js.sort((a, b) => String(pStageSince(a)).localeCompare(String(pStageSince(b))));
    let extra = '';
    if (st === 'machine') extra = '<div class="pm-sum">' + machinesList().map(m => { const n = open.filter(p => inMachine(p, m)).length; return '<span class="' + (n ? 'on' : '') + '">' + esc(m) + ' <b>' + n + '</b></span>'; }).join('') + '</div>';
    let more = '';
    if (st === 'ready') {
      const since = addDays(today(), -7), sh = pool.filter(p => p.stage === 'shipped' && String(p.shippedAt).slice(0, 10) >= since).sort((a, b) => String(b.shippedAt).localeCompare(String(a.shippedAt)));
      if (sh.length) more = '<div class="col-more"><button class="btn ghost sm" data-pship="1" aria-expanded="' + !!S.pship + '">' + PIC.shipped + 'ส่งแล้ว 7 วันล่าสุด (' + sh.length + ')</button></div>' +
        (S.pship ? '<div class="pship">' + sh.map(p => '<button type="button" class="pship-row" data-popen="' + esc(p.id) + '"><b>' + esc(p.code) + '</b><span>' + esc(p.title || '') + '</span><small>' + esc(fd(p.shippedAt)) + '</small></button>').join('') + '</div>' : '');
    }
    return '<section class="col ' + PSTG[st].cls + '" data-pcol="' + st + '"><div class="col-h"><span class="col-ic ic-' + st + '">' + PIC[st] + '</span><div class="col-t"><b>' + PSTG[st].label + '</b><small>' + PSTG[st].sub + '</small></div><span class="n">' + js.length + '</span></div>' + extra +
      '<div class="col-list">' + (js.length ? js.map(pcard).join('') : '<div class="col-empty"><span class="ce-art ic-' + st + '">' + PIC[st] + '<i></i><i></i><i></i></span><b>' + (st === 'machine' && F !== 'all' ? 'ไม่มีงานรอเครื่อง ' + esc(F) : PSTG[st].empty) + '</b><small>' + (st === 'wait' ? 'งาน CAM ที่เสร็จจะเข้ามาที่นี่เอง' : '') + '</small></div>') + '</div>' + more + '</section>';
  }).join('');
  const cnt = st => open.filter(p => p.stage === st).length;
  const flow = '<div class="flow pflow">' + PCOLS.map((st, i) => '<div class="flow-step ' + PSTG[st].cls + '"><span class="flow-ic ic-' + st + '">' + PIC[st] + '</span><div><b>' + cnt(st) + '</b><small>' + PSTG[st].label + '</small></div></div>' + (i < PCOLS.length - 1 ? '<span class="flow-arrow" aria-hidden="true"><i></i><i></i><i></i></span>' : '')).join('') + '</div>';
  const chips = '<div class="qchips pm-chips"><span class="pm-lbl">ดูเฉพาะเครื่อง</span>' + [['all', 'ทุกเครื่อง']].concat(machinesList().map(m => [m, m])).map(x => {
    const n = x[0] === 'all' ? open.filter(p => p.stage === 'machine').length : open.filter(p => inMachine(p, x[0])).length;
    return '<button class="qchip" data-pm="' + esc(x[0]) + '" aria-pressed="' + (F === x[0]) + '"><span class="qi">' + (x[0] === 'all' ? STI.all : PIC.machine) + '</span>' + esc(x[1]) + '<b>' + n + '</b></button>'; }).join('') + '</div>';
  const search = '<div class="filters"><label class="search">' + I.search + '<input id="pq" type="search" autocomplete="off" placeholder="ค้นหาเลข Job, ชื่องาน, sale…" value="' + esc(S.pq || '') + '" aria-label="ค้นหางานผลิต"></label></div>';
  const sub = canProd() ? 'เลือกเครื่องแล้วกด "เริ่มลงเครื่อง" · ติ๊กแต่ละเครื่องเมื่อเสร็จ ครบแล้วไปทำสี → ประกอบติดตั้ง → แพ็ค เอง' : 'ดูสถานะงานผลิตได้อย่างเดียว · อัปเดตได้เฉพาะฝ่ายผลิตและแอดมิน';
  return topbar('ฝ่ายผลิต', sub) + flow + search + chips + '<div class="board-scroll"><div class="board pboard">' + cols + '</div></div>';
}

/* ---- ภาพรวมบริษัท: ทุกเลข Job ในสายงานเดียว ---- */
const CO_STEPS = [
  { k: 'design', label: 'ฝ่ายแบบ', sub: 'CAD / CAM', ic: 'design', dept: 'd' },
  { k: 'wait', label: 'รอผลิต', sub: 'รอเลือกเครื่อง', ic: 'wait', dept: 'p' },
  { k: 'machine', label: 'ลงเครื่อง', sub: 'Router · Laser …', ic: 'machine', dept: 'p' },
  { k: 'paint', label: 'ทำสี', sub: '', ic: 'paint', dept: 'p' },
  { k: 'assemble', label: 'ประกอบ', sub: 'ประกอบติดตั้ง', ic: 'assemble', dept: 'p' },
  { k: 'pack', label: 'แพ็ค', sub: '', ic: 'pack', dept: 'p' },
  { k: 'ready', label: 'พร้อมส่ง', sub: '', ic: 'ready', dept: 's' }
];
function coRows() {
  const byCode = {}, pool = listPool(), cutoff = addDays(today(), -14);
  const key = c => String(c || '').trim().toLowerCase();
  pool.forEach(j => { const k = key(j.code); if (!k) return; (byCode[k] = byCode[k] || { code: j.code, jobs: [], prod: null }).jobs.push(j); });
  prodsAll().forEach(p => { const k = key(p.code); const cur = byCode[k] || (byCode[k] = { code: p.code, jobs: designJobsOf(p.code), prod: null }); if (!cur.prod || (cur.prod.stage === 'shipped' && p.stage !== 'shipped')) cur.prod = p; });
  return Object.values(byCode).map(r => {
    const open = r.jobs.filter(j => j.status !== 'done'), last = r.jobs.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || {};
    const p = r.prod, ref = p || last;
    let step, sub, since, late = false;
    if (p && p.stage !== 'shipped') { step = p.stage; sub = p.stage === 'machine' ? pms(p).filter(m => !m.d).map(m => m.m).join(' + ') || 'ครบแล้ว' : PSTG[p.stage].sub; since = pStageSince(p); late = pStuck(p); }
    else if (open.length) {
      const o = open.slice().sort((a, b) => ['doing', 'fix', 'review', 'queue', 'hold'].indexOf(a.status) - ['doing', 'fix', 'review', 'queue', 'hold'].indexOf(b.status))[0];
      step = 'design'; sub = (o.taskType || 'ออกแบบ') + ' · ' + ST[o.status].label + (o.assignee ? ' · ' + o.assignee : ''); since = o.startedAt || o.received || ''; late = open.some(isLate);
    } else if (p && p.stage === 'shipped') { step = 'shipped'; sub = 'ส่งแล้ว ' + fd(p.shippedAt); since = p.shippedAt; }
    else { const fin = r.jobs.map(finDate).sort().pop() || ''; if (fin < cutoff) return null; step = 'ddone'; sub = 'ออกแบบเสร็จ ' + fd(fin) + ' · ไม่ได้ส่งเข้าผลิต'; since = fin; }
    if (step === 'shipped' && String(p.shippedAt).slice(0, 10) < addDays(today(), -7)) return null;
    // วันที่สำหรับป้ายวันที่ (แบบหน้า Sale): ฝ่ายแบบ = กำหนดส่งแบบ, ผลิต = วันเข้าผลิต/พร้อมส่ง, ส่งแล้ว = วันส่ง
    let due = '', dl = '', dd = '';
    if (step === 'design') { due = open.map(j => j.due).filter(Boolean).sort()[0] || ''; dl = 'กำหนดส่งแบบ'; dd = due; }
    else if (step === 'shipped') { dl = 'ส่งแล้ว'; dd = String(p.shippedAt).slice(0, 10); }
    else if (step === 'ddone') { dl = 'ออกแบบเสร็จ'; dd = String(since).slice(0, 10); }
    else if (p && p.due && p.stage !== 'ready') { due = p.due; dl = 'กำหนดส่ง'; dd = due; }
    else if (p) { dl = p.stage === 'ready' ? 'พร้อมส่งตั้งแต่' : 'เข้าผลิต'; dd = String(p.stage === 'ready' ? p.finishedAt : p.enteredAt).slice(0, 10); }
    return { code: r.code, title: ref.title || (r.jobs.find(j => j.title) || {}).title || '', sale: ref.sale || (r.jobs.find(j => j.sale) || {}).sale || '', group: ref.group || '', step: step, sub: sub, since: since, late: late, prod: p, jobs: r.jobs,
      due: due, dl: dl, dd: dd,
      urgent: r.jobs.some(j => j.priority === 'urgent' && j.status !== 'done') };
  }).filter(Boolean);
}
function coIdx(step) { return step === 'design' || step === 'ddone' ? 0 : step === 'shipped' ? CO_STEPS.length : CO_STEPS.findIndex(s => s.k === step); }
/* เส้นทางงานแบบแอปส่งของ: จุดตามขั้น ช่วงที่ผ่านแล้วมีสี จุดปัจจุบันมีไอคอนและวงกระเพื่อม */
const coStg = r => r.step === 'design' ? 's-doing' : r.step === 'ddone' ? 's-done' : (PSTG[r.step] || PSTG.wait).cls;
const coIc = r => r.step === 'design' ? 'design' : r.step === 'ddone' ? 'shipped' : r.step;
function coRoute(r) {
  const i = Math.min(coIdx(r.step), CO_STEPS.length - 1), fin = r.step === 'shipped', n = CO_STEPS.length - 1, pct = fin ? 100 : i / n * 100;
  return '<div class="rt' + (fin ? ' fin' : '') + (r.late ? ' late' : '') + '" style="--p:' + pct + '%"><span class="rt-line"><i></i></span>' + CO_STEPS.map((st, k) => {
    const cls = k < i || fin ? 'past' : k === i ? 'now' : '', sk = pSkipped(r.prod, st.k);
    return '<span class="rt-dot d-' + st.dept + ' ' + cls + (sk ? ' skip' : '') + ' ' + (st.k === 'design' ? 's-doing' : PSTG[st.k].cls) + '" style="left:' + (k / n * 100) + '%" title="' + esc(st.label) + (sk ? ' (ข้าม)' : '') + '">' +
      (cls === 'now' ? PIC[st.ic] : cls === 'past' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</span>' +
      (cls === 'now' ? '<span class="rt-lbl" style="left:' + (k / n * 100) + '%">' + esc(st.label) + '</span>' : '');
  }).join('') + '</div>';
}
/* ชิปรายละเอียดแบบการ์ดบอร์ดงาน: รายละเอียดงาน · สถานะ · คนทำ · เช็กลิสต์ · กลุ่มงาน · เครื่อง · Sale */
function coX(r, o) {
  o = o || {};
  const ord = ['doing', 'fix', 'review', 'queue', 'hold'], open = r.jobs.filter(j => j.status !== 'done');
  const cur = open.slice().sort((a, b) => ord.indexOf(a.status) - ord.indexOf(b.status))[0] || r.jobs.slice().sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')))[0];
  const tc = n => n ? '<span class="tchip sm" style="--c:' + typeColorPub(n) + '">' + esc(n) + '</span>' : '';
  const gc = g => g ? '<span class="gchip sm" style="--c:' + (S.settings && S.settings.groups ? groupColor(g) : '#0EA5E9') + '">' + STI.layers + esc(groupShort(g)) + '</span>' : '';
  const ms = p => (Array.isArray(p.machines) ? p.machines.filter(x => x && x.m) : pms(p));
  let h = '';
  if (r.prod && r.step !== 'design' && r.step !== 'ddone') {
    const m = ms(r.prod);
    h += m.map(x => '<span class="co-mc' + (x.d ? ' on' : '') + '">' + (x.d ? '✓ ' : PIC.machine) + esc(x.m) + '</span>').join('');
    if (r.prod.paint === 'no') h += '<span class="co-sk">ไม่ทำสี</span>';
    if (r.prod.assy === 'no') h += '<span class="co-sk">ไม่ประกอบ</span>';
    { const ni = (Array.isArray(r.prod.imgs) ? r.prod.imgs.length : (typeof imgsOf === 'function' && r.prod.id ? imgsOf(r.prod.id).length : 0)); if (ni) h += '<span class="co-sk co-ph">' + STI.camera + ni + '</span>'; }
    if (r.prod.note) h += '<span class="co-pnote" title="' + esc(r.prod.note) + '">' + STI.note + esc(String(r.prod.note).slice(0, 60)) + '</span>';
    if (cur && !m.length) h += tc(cur.taskType);
  } else if (cur) {
    h += tc(cur.taskType);
    if (cur.status !== 'done') h += '<span class="pill ' + (ST[cur.status] || ST.queue).cls + '">' + (ST[cur.status] || ST.queue).label + '</span>';
    if (cur.assignee) h += '<span class="co-who">' + av(cur.assignee, 'sm') + esc(cur.assignee) + '</span>';
    const st = cur.steps || (cur.checklist ? (c => c.length ? c.filter(x => x.d).length + '/' + c.length : '')(clOf(cur)) : '');
    if (st) { const a = st.split('/'), full = a[0] === a[1]; h += '<span class="co-cl' + (full ? ' full' : '') + '" title="เช็กลิสต์ ' + esc(st) + '"><i style="--w:' + Math.round(+a[0] / (+a[1] || 1) * 100) + '%"></i>' + esc(st) + '</span>'; }
    if (open.length > 1) h += '<span class="co-sk">+' + (open.length - 1) + ' งาน</span>';
  }
  h += gc(r.group);
  if (o.sale !== false && r.sale) h += '<span class="co-sale">' + STI.user + esc(r.sale) + '</span>';
  return h ? '<span class="co-x">' + h + '</span>' : '';
}
/* ป้ายวันที่เด่น ๆ (ใช้ทั้งหน้า Sale และภาพรวมบริษัท): r.dd วันที่, r.dl คำอธิบาย, r.due = กำหนดส่งแบบ */
function coDate(r) {   // ป้ายวันที่เด่น ๆ: วันเดือนตัวใหญ่ + สถานะ (เลย/วันนี้/พรุ่งนี้/อีกกี่วัน)
    if (!r.dd) return '<span class="sf-date k-none"><span class="sf-dl"><small>ยังไม่กำหนดส่ง</small></span></span>';
    const t = today(), x = parseLocal(r.dd), n = daysBetween(t, r.dd), isDue = !!r.due;
    const k = !isDue ? (r.step === 'shipped' ? 'ship' : r.step === 'ready' ? 'ready' : 'info') : n < 0 ? 'late' : n === 0 ? 'today' : n === 1 ? 'tmr' : n <= 3 ? 'soon' : 'later';
    const tag = !isDue ? (n === 0 ? 'วันนี้' : n === -1 ? 'เมื่อวาน' : n < 0 ? (-n) + ' วันก่อน' : '') : n < 0 ? 'เลย ' + (-n) + ' วัน' : n === 0 ? 'ส่งวันนี้' : n === 1 ? 'ส่งพรุ่งนี้' : 'อีก ' + n + ' วัน';
    return '<span class="sf-date k-' + k + '"><span class="sf-cal"><i>' + TH_M[x.getMonth()] + '</i><b>' + x.getDate() + '</b></span><span class="sf-dl"><small>' + esc(r.dl) + '</small>' + (tag ? '<em>' + (k === 'late' ? STI.fire : k === 'today' ? STI.hourglass : '') + tag + '</em>' : '') + '</span></span>';
}
function coTrack(r) {
  const i = coIdx(r.step), n = CO_STEPS.length;
  return '<div class="co-trk" aria-label="' + esc(r.step === 'shipped' ? 'ส่งแล้ว' : (CO_STEPS[i] || {}).label || '') + '">' + CO_STEPS.map((s, k) =>
    '<i class="' + (k < i ? 'past' : k === i ? 'now' : '') + (k === i && r.late ? ' late' : '') + (pSkipped(r.prod, s.k) ? ' skip' : '') + ' d-' + s.dept + '" title="' + esc(s.label) + '"></i>').join('') + (i >= n ? '' : '') + '</div>';
}
function viewFlow() {
  const rows = coRows(), F = S.cf || 'all', q = String(S.cq || '').trim().toLowerCase();
  const n = k => rows.filter(r => k === 'design' ? r.step === 'design' : r.step === k).length;
  const stepTile = (s, i) => { const c = n(s.k), lt = rows.filter(r => r.step === s.k && r.late).length;
    return '<button type="button" class="co-step d-' + s.dept + ' ' + (s.k === 'design' ? 's-doing' : PSTG[s.k].cls) + '" data-cf="' + s.k + '" aria-pressed="' + (F === s.k) + '"><span class="flow-ic ic-' + s.ic + '">' + PIC[s.ic] + '</span><b>' + c + '</b><span>' + s.label + '</span>' + (lt ? '<em>' + STI.fire + lt + ' ค้าง</em>' : '<small>' + esc(s.sub || '') + '</small>') + '</button>' + (i < CO_STEPS.length - 1 ? '<span class="co-arrow" aria-hidden="true"></span>' : ''); };
  const depts = '<div class="co-pipe"><div class="co-depts"><span class="dl d-d">' + PIC.design + 'ฝ่ายแบบ</span><span class="dl d-p">' + PIC.machine + 'ฝ่ายผลิต</span><span class="dl d-s">' + PIC.ready + 'ส่งมอบ</span></div>' +
    '<div class="co-steps">' + CO_STEPS.map(stepTile).join('') + '</div></div>';
  const shipped7 = rows.filter(r => r.step === 'shipped').length, late = rows.filter(r => r.late).length;
  const kpis = '<div class="co-kpis"><div class="kpi"><span>งานในสายทั้งหมด</span><b>' + rows.filter(r => r.step !== 'shipped' && r.step !== 'ddone').length + '</b><small>เลข Job ที่ยังไม่ส่ง</small></div>' +
    '<div class="kpi k-late"><span>ค้างนาน / เลยกำหนด</span><b>' + late + '</b><small>ฝ่ายแบบเลยกำหนด · ผลิตค้าง ≥2–3 วัน</small></div>' +
    '<div class="kpi k-done"><span>ส่งแล้ว 7 วัน</span><b>' + shipped7 + '</b><small>ปิดงานถึงลูกค้า</small></div></div>';
  let list = rows.filter(r => (F === 'all' ? r.step !== 'shipped' && r.step !== 'ddone' : F === 'late' ? r.late : F === 'design' ? r.step === 'design' || r.step === 'ddone' : r.step === F) &&
    (!q || [r.code, r.title, r.sale, r.group, r.sub].join(' ').toLowerCase().indexOf(q) >= 0));
  list.sort((a, b) => (b.late - a.late) || (coIdx(b.step) - coIdx(a.step)) || String(a.since).localeCompare(String(b.since)));
  const chips = '<div class="qchips">' + [['all', 'ทั้งหมดที่ยังไม่ส่ง'], ['late', 'ค้างนาน'], ['shipped', 'ส่งแล้ว 7 วัน']].map(x => '<button class="qchip' + (x[0] === 'late' ? ' q-late' : '') + '" data-cf="' + x[0] + '" aria-pressed="' + (F === x[0]) + '">' + x[1] + '<b>' + (x[0] === 'all' ? rows.filter(r => r.step !== 'shipped' && r.step !== 'ddone').length : x[0] === 'late' ? late : shipped7) + '</b></button>').join('') +
    (F !== 'all' && F !== 'late' && F !== 'shipped' ? '<button class="qchip" data-cf="all" aria-pressed="true">' + esc(F === 'design' ? 'ฝ่ายแบบ' : PSTG[F] ? PSTG[F].label : F) + ' ✕</button>' : '') + '</div>';
  const where = r => r.step === 'design' ? '<span class="pill s-doing">ฝ่ายแบบ</span>' : r.step === 'ddone' ? '<span class="pill s-done">ออกแบบเสร็จ</span>' : pPill(r.step);
  const hovJob = r => { const o = r.jobs.filter(j => j.status !== 'done'); return (o[0] || r.jobs.slice().sort((a, b) => String(finDate(b)).localeCompare(String(finDate(a))))[0] || {}).id || ''; };
  const table = list.length ? '<div class="co-list">' + list.slice(0, 200).map((r, k) => '<button type="button" class="co-row ' + coStg(r) + ' co-' + (r.step === 'ddone' ? 'design' : r.step) + (r.late ? ' late' : '') + '" style="--i:' + Math.min(k, 24) + '" data-coopen="' + esc(r.code) + '"' + (hovJob(r) ? ' data-hov="' + esc(hovJob(r)) + '"' : r.prod ? ' data-phov="' + esc(r.prod.id) + '"' : '') + '>' +
      '<span class="co-bub flow-ic ic-' + coIc(r) + '">' + PIC[coIc(r)] + '</span><span class="co-code"><b>' + esc(r.code) + '</b>' + (r.urgent ? '<span class="tag urgent">' + STI.fire + 'ด่วน</span>' : '') + '<small>' + esc(r.title || '–') + '</small></span>' + coX(r) +
      '<span class="co-mid">' + coRoute(r) + '<small>' + where(r) + ' ' + esc(r.sub) + '</small></span>' +
      '<span class="co-meta">' + coDate(r) + '<small class="co-age' + (r.late ? ' late' : '') + '">' + (r.since && r.step !== 'shipped' ? (r.late ? STI.fire : STI.clock) + 'อยู่ขั้นนี้ ' + pAgeTxt(Math.max(0, daysBetween(String(r.since).slice(0, 10), today()))) : '') + '</small></span></button>').join('') + '</div>' +
      (list.length > 200 ? '<div class="col-more">แสดง 200 จาก ' + list.length + ' รายการ ใช้ช่องค้นหาเพื่อหางานอื่น</div>' : '')
    : '<div class="empty" style="padding:28px 0"><b>ไม่มีงานในมุมมองนี้</b>ลองเลือก "ทั้งหมดที่ยังไม่ส่ง"</div>';
  const search = '<div class="filters"><label class="search">' + I.search + '<input id="cq" type="search" autocomplete="off" placeholder="ค้นหาเลข Job, ชื่องาน, sale…" value="' + esc(S.cq || '') + '" aria-label="ค้นหางาน"></label></div>';
  const legend = '<div class="co-legend"><span><i class="d-d"></i>ฝ่ายแบบ</span><span><i class="d-p"></i>ฝ่ายผลิต</span><span><i class="d-s"></i>ส่งมอบ</span><span><i class="now"></i>ตอนนี้อยู่ที่</span><span><i class="now late"></i>ค้างนาน</span></div>';
  return topbar('ภาพรวมบริษัท', 'ทุกเลข Job ตั้งแต่ออกแบบจนส่งลูกค้า กดขั้นตอนด้านบนเพื่อกรอง หรือกดงานเพื่อดูรายละเอียด') + depts + kpis +
    '<section class="panel"><div class="panel-h"><h2>งานตามเลข Job</h2>' + legend + '</div>' + search + chips + table + '</section>';
}

/* ---- หน้าต่างรายละเอียดงานผลิต / เพิ่มงานเข้าผลิต ---- */
const P2 = { id: '', add: false };
function pModalOpen(id) { P2.id = id; P2.add = false; P2.edit = false; pModalDraw(); }
function pAddOpen(code) { P2.id = ''; P2.add = true; P2.code = code || ''; P2.ms = []; P2.paint = ''; P2.assy = ''; (P2.files || []).forEach(x => URL.revokeObjectURL(x.url)); P2.files = []; P2.f = { title: '', sale: '', group: '', due: '', note: '' }; P2.found = null; if (code) pAddLookup(code); pModalDraw(); setTimeout(() => { const x = $('#pAddCode'); if (x) x.focus(); }, 30); }
function pAddRead() {
  if (!P2.add) return; const v = id => { const e = $('#' + id); return e ? e.value : undefined; };
  const c = v('pAddCode'); if (c !== undefined) P2.code = c;
  P2.f = P2.f || {}; [['title', 'pAddTitle'], ['sale', 'pAddSale'], ['group', 'pAddGroup'], ['due', 'pAddDue'], ['note', 'pAddNote']].forEach(x => { const y = v(x[1]); if (y !== undefined) P2.f[x[0]] = y; });
}
/* พิมพ์เลข Job ที่มีในฝ่ายแบบ → ดึงชื่องาน Sale กลุ่มงาน กำหนดส่งมาใส่ให้ (ช่องที่ยังว่าง) */
function pAddLookup(code) {
  const k = String(code || '').trim().toLowerCase(), js = k ? S.jobs.filter(j => String(j.code).toLowerCase() === k) : [];
  const pick = n => (js.find(j => j[n]) || {})[n] || '';
  P2.found = js.length ? { code: js[0].code, title: pick('title') } : null;
  if (js.length) { P2.f = P2.f || {}; ['title', 'sale', 'group'].forEach(n => { if (!P2.f[n]) P2.f[n] = pick(n); }); if (!P2.f.due) P2.f.due = js.map(j => j.due).filter(Boolean).sort().pop() || ''; }
}
async function uploadProdImages(id, files) {
  const room = IMG_MAX - imgsOf(id).length; files = Array.from(files || []).slice(0, Math.max(0, room));
  if (!files.length) return 0;
  S.puploading = (S.puploading || 0) + files.length; if (P2.id === id) pModalDraw();
  let ok = 0;
  for (const f of files) {
    try {
      const thumb = await shrinkImage(f, 360, 44000, 0.72), full = await shrinkImage(f, 1800, 340000, 0.85);
      const r = await api().addImage({ jobId: id, thumb: thumb, full: full });
      THUMBS[r.image.id] = thumb; FULL[r.image.id] = full; saveThumbCache();
      S.images = (S.images || []).concat([{ id: r.image.id, jobId: id, createdBy: r.image.createdBy, createdAt: r.image.createdAt, fileId: r.image.fileId || '' }]); ok++;
    } catch (e) { toast(e.message || 'อัปโหลดรูปไม่สำเร็จ', true); }
    S.puploading--; render(); if (P2.id === id) pModalDraw();
  }
  return ok;
}
function pModalClose() { (P2.files || []).forEach(x => URL.revokeObjectURL(x.url)); P2.files = []; P2.id = ''; P2.add = false; P2.edit = false; const m = $('#pModal'); if (m) m.remove(); document.body.classList.remove('pm-open'); }
function pInfoHtml(p, ro) {
  if (P2.edit && !ro) {
    const sales = (S.settings && S.settings.sales) || [], groups = (S.settings && S.settings.groups) || [];
    const opt = (list, v, ph) => '<option value="">' + ph + '</option>' + list.concat(v && list.indexOf(v) < 0 ? [v] : []).map(x => '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    return '<div class="pm-edit"><div class="f"><label for="pEdTitle">ชื่องาน / ลูกค้า</label><input id="pEdTitle" value="' + esc(p.title || '') + '"></div>' +
      '<div class="pa-2"><div class="f"><label for="pEdSale">Sale</label><select id="pEdSale">' + opt(sales, p.sale, '–') + '</select></div><div class="f"><label for="pEdGroup">กลุ่มงาน</label><select id="pEdGroup">' + opt(groups, p.group, '–') + '</select></div></div>' +
      '<div class="f"><label for="pEdDue">กำหนดส่งลูกค้า</label><input id="pEdDue" type="date" value="' + esc(p.due || '') + '"></div>' +
      '<div class="top-actions"><button type="button" class="btn sm" data-pinfo="cancel">ยกเลิก</button><button type="button" class="btn sm primary" data-pinfo="save">บันทึกข้อมูลงาน</button></div></div>';
  }
  const dn = p.due ? daysBetween(today(), p.due) : null, late = p.due && dn < 0 && p.stage !== 'ready' && p.stage !== 'shipped';
  return '<div class="pm-grid"><div><span class="lbl">Sale</span><b>' + esc(p.sale || '–') + '</b></div><div><span class="lbl">กลุ่มงาน</span><b>' + esc(p.group || '–') + '</b></div>' +
    '<div><span class="lbl">กำหนดส่งลูกค้า</span><b class="' + (late ? 'bad' : '') + '">' + (p.due ? esc(fdY(p.due)) + (p.stage === 'shipped' ? '' : dn < 0 ? ' · เลย ' + (-dn) + ' วัน' : dn === 0 ? ' · วันนี้' : dn === 1 ? ' · พรุ่งนี้' : '') : '–') + '</b></div>' +
    '<div><span class="lbl">เข้ารอผลิต</span><b>' + esc(fdt(p.enteredAt)) + '</b></div>' +
    '<div class="pm-gw"><span class="lbl">' + (p.shippedAt ? 'ส่งแล้ว' : 'เสร็จพร้อมส่ง') + '</span><b>' + esc(fdt(p.shippedAt || p.finishedAt)) + '</b></div>' +
    (ro ? '' : '<button type="button" class="btn ghost sm pm-editbtn" data-pinfo="edit">' + STI.pen + 'แก้ไขข้อมูลงาน</button>') + '</div>';
}
function pImgsHtml(p, ro) {
  const own = imgsOf(p.id), dj = designJobsOf(p.code), fromD = []; dj.forEach(j => imgsOf(j.id).forEach(m => fromD.push({ m: m, j: j.id })));
  const all = own.map(m => ({ m: m, j: p.id })).concat(fromD), up = S.puploading || 0;
  if (!all.length && ro) return '';
  return '<div class="f"><label>รูปงาน <small class="muted">' + (all.length ? all.length + ' รูป' : '') + (fromD.length ? ' · รวมรูปจากฝ่ายแบบ' : '') + '</small></label><div class="pa-imgs">' +
    all.map(x => '<button type="button" class="pa-im" data-lbopen="' + esc(x.m.id) + '" data-lbjob="' + esc(x.j) + '">' + thumbImg(x.m) + '</button>').join('') +
    (up ? '<span class="pa-im pa-up"><span class="spin-dot"></span></span>' : '') +
    (!ro && own.length < IMG_MAX ? '<label class="pa-add">' + STI.camera + '<span>เพิ่มรูป</span><input type="file" id="pImgIn" accept="image/*" multiple hidden></label>' : '') + '</div></div>';
}
function pModalDraw() {
  let m = $('#pModal');
  if (!P2.id && !P2.add) { if (m) m.remove(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'pModal'; m.className = 'pmodal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m); document.body.classList.add('pm-open'); }
  const x = '<button type="button" class="icon-btn" data-pclose="1" aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  if (P2.add) {
    const have = {}; prodsAll().forEach(p => { if (p.stage !== 'shipped') have[String(p.code).toLowerCase()] = 1; });
    const cands = []; const seen = {};
    S.jobs.filter(j => j.status === 'done').sort((a, b) => String(finDate(b)).localeCompare(String(finDate(a)))).forEach(j => { const k = String(j.code).toLowerCase(); if (!have[k] && !seen[k]) { seen[k] = 1; cands.push(j); } });
    const f = P2.f || {}, sales = ((S.settings && S.settings.sales) || []), groups = ((S.settings && S.settings.groups) || []), fd0 = P2.found;
    const opt = (list, v, ph) => '<option value="">' + ph + '</option>' + list.concat(v && list.indexOf(v) < 0 ? [v] : []).map(x => '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    m.innerHTML = '<div class="pm-card pm-add"><div class="pm-h"><div><span class="eyebrow">' + PIC.machine + 'ฝ่ายผลิต</span><h3>เพิ่มงานเข้ารอผลิต</h3><p class="sub">ใช้สำหรับงานที่ไม่ได้ผ่านฝ่ายแบบ หรืองานที่ CAM ไม่ได้ทำในระบบ</p></div>' + x + '</div><div class="pm-b">' +
      '<section class="pa-sec"><div class="pa-h"><span class="pa-n">1</span><b>ข้อมูลงาน</b></div>' +
      '<div class="f"><label for="pAddCode">เลข Job <i class="req">*</i></label><input id="pAddCode" list="pAddList" autocomplete="off" placeholder="เช่น 69-10123 หรือเลือกเลขที่ออกแบบเสร็จแล้ว" value="' + esc(P2.code || '') + '"><datalist id="pAddList">' + cands.slice(0, 300).map(j => '<option value="' + esc(j.code) + '">' + esc(j.title || '') + '</option>').join('') + '</datalist>' +
        '<div class="pa-found' + (fd0 ? ' on' : '') + '" id="pAddFound">' + (fd0 ? STI.done + 'พบงานฝ่ายแบบ: <b>' + esc(fd0.title || fd0.code) + '</b> · ดึงข้อมูลมาให้แล้ว' : STI.note + 'งานใหม่ที่ไม่ผ่านฝ่ายแบบ — ใส่ข้อมูลด้านล่างได้เลย') + '</div></div>' +
      '<div class="f"><label for="pAddTitle">ชื่องาน / ลูกค้า</label><input id="pAddTitle" autocomplete="off" placeholder="เช่น ป้ายหน้าร้าน คุณเอ" value="' + esc(f.title || '') + '"></div>' +
      '<div class="pa-2"><div class="f"><label for="pAddSale">Sale</label><select id="pAddSale">' + opt(sales, f.sale, 'เลือก Sale') + '</select></div>' +
        '<div class="f"><label for="pAddGroup">กลุ่มงาน</label><select id="pAddGroup">' + opt(groups, f.group, 'เลือกกลุ่มงาน') + '</select></div></div>' +
      '<div class="pa-2"><div class="f"><label for="pAddDue">กำหนดส่งลูกค้า</label><input id="pAddDue" type="date" value="' + esc(f.due || '') + '"></div><div class="f pa-quick"><label>&nbsp;</label><div>' + [[0, 'วันนี้'], [1, 'พรุ่งนี้'], [3, '+3 วัน'], [7, '+7 วัน']].map(q => '<button type="button" class="chip sm" data-padue="' + q[0] + '">' + q[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="f"><label for="pAddNote">รายละเอียด / โน้ตฝ่ายผลิต</label><textarea id="pAddNote" rows="2" placeholder="เช่น อะคริลิกหนา 5 มม. สีตามตัวอย่าง ระวังขอบบาง">' + esc(f.note || '') + '</textarea></div></section>' +
      '<section class="pa-sec"><div class="pa-h"><span class="pa-n">2</span><b>รูปงาน</b><small>' + P2.files.length + '/' + IMG_MAX + '</small></div><div class="pa-imgs">' +
        P2.files.map((im, k) => '<span class="pa-im"><img alt="" src="' + im.url + '"><button type="button" data-padimgdel="' + k + '" aria-label="เอารูปออก">✕</button></span>').join('') +
        (P2.files.length < IMG_MAX ? '<label class="pa-add">' + STI.camera + '<span>เพิ่มรูป</span><small>ถ่ายหรือเลือกจากเครื่อง</small><input type="file" id="pAddImg" accept="image/*" multiple hidden></label>' : '') + '</div></section>' +
      '<section class="pa-sec"><div class="pa-h"><span class="pa-n">3</span><b>เครื่องและขั้นตอน</b><small>เลือกทีหลังได้</small></div>' +
      '<div class="pc-pick">' + machinesList().map(mm => '<button type="button" class="mchip' + (P2.ms.indexOf(mm) >= 0 ? ' on' : '') + '" data-paddm="' + esc(mm) + '" aria-pressed="' + (P2.ms.indexOf(mm) >= 0) + '">' + (P2.ms.indexOf(mm) >= 0 ? PIC.check : '') + esc(mm) + '</button>').join('') + '</div>' +
      '<div class="pc-skips"><button type="button" class="ptog' + (P2.paint === 'no' ? ' on' : '') + '" data-paddpaint="1" aria-pressed="' + (P2.paint === 'no') + '">' + (P2.paint === 'no' ? PIC.check : '') + 'ไม่ต้องทำสี</button>' +
      '<button type="button" class="ptog' + (P2.assy === 'no' ? ' on' : '') + '" data-paddassy="1" aria-pressed="' + (P2.assy === 'no') + '">' + (P2.assy === 'no' ? PIC.check : '') + 'ไม่ต้องประกอบ</button></div></section>' +
      '</div><div class="pm-f"><button type="button" class="btn" data-pclose="1">ยกเลิก</button><button type="button" class="btn primary" data-paddsave="1"' + (P2.saving ? ' disabled' : '') + '>' + I.plus + (P2.saving ? 'กำลังบันทึก…' : P2.ms.length ? 'เพิ่มและเริ่มลงเครื่อง' : 'เพิ่มเข้ารอผลิต') + '</button></div></div>';
    return;
  }
  const p = prodById(P2.id); if (!p) return pModalClose();
  const ro = !canProd(), ms = pms(p), dj = designJobsOf(p.code), h = phist(p).slice().reverse();
  const order = PORDER, ci = order.indexOf(p.stage);
  const stepper = '<div class="pm-steps">' + order.map((st, i) => '<button type="button" class="pm-step ' + PSTG[st].cls + (i < ci ? ' past' : i === ci ? ' now' : '') + (pSkipped(p, st) ? ' skip' : '') + '"' + (ro || i === ci ? ' disabled' : '') + ' data-pset="' + st + '" title="' + (ro ? '' : 'ย้ายไปขั้น ' + PSTG[st].label) + '"><span>' + PIC[st] + '</span><small>' + PSTG[st].label + '</small></button>').join('') + '</div>';
  const mPick = '<div class="pc-pick">' + machinesList().concat(ms.map(x => x.m).filter(n => machinesList().indexOf(n) < 0)).map(n => { const cur = ms.find(x => x.m === n);
    return '<button type="button" class="mchip' + (cur ? ' on' : '') + (cur && cur.d ? ' done' : '') + '"' + (ro ? ' disabled' : '') + ' data-pmset="' + esc(n) + '" aria-pressed="' + !!cur + '">' + (cur ? PIC.check : '') + esc(n) + (cur && cur.d ? ' · เสร็จ ' + esc(fdt(cur.d).replace(/^.* /, '')) : '') + '</button>'; }).join('') + '</div>';
  m.innerHTML = '<div class="pm-card ' + PSTG[p.stage].cls + '"><div class="pm-h"><div><span class="eyebrow">' + pPill(p.stage) + ' · อยู่ขั้นนี้ ' + pAgeTxt(pAge(p)) + '</span><h3>' + esc(p.code) + '</h3>' + (p.title ? '<p class="sub">' + esc(p.title) + '</p>' : '') + '</div>' + x + '</div><div class="pm-b">' +
    stepper +
    pInfoHtml(p, ro) + pImgsHtml(p, ro) +
    '<div class="f"><label>เครื่องที่ใช้</label>' + mPick + (p.stage === 'machine' && !ro ? '<div class="hint">ติ๊กเครื่องที่ทำเสร็จได้ที่การ์ดบนบอร์ด ครบทุกเครื่องแล้วงานไปขั้นต่อเอง</div>' : '') + '</div>' +
    '<div class="pc-skips">' + pSkipTogs(p, ro) + '</div>' +
    '<div class="f"><label for="pNote">โน้ตฝ่ายผลิต</label><textarea id="pNote" rows="2" placeholder="เช่น สีตามตัวอย่าง, ระวังขอบบาง"' + (ro ? ' readonly' : '') + '>' + esc(p.note || '') + '</textarea>' + (ro ? '' : '<div class="top-actions"><button type="button" class="btn sm" data-pnote="1">บันทึกโน้ต</button></div>') + '</div>' +
    (dj.length ? '<div class="f"><label>งานฝ่ายแบบของเลขนี้</label><div class="pm-jobs">' + dj.map(j => '<button type="button" class="pm-job" data-pjob="' + esc(j.id) + '">' + stBadge(j) + '<b>' + esc(j.taskType || 'งาน') + '</b><small>' + esc(j.assignee || '') + ' · ' + esc(j.status === 'done' ? 'เสร็จ ' + fd(finDate(j)) : ST[j.status].label) + '</small></button>').join('') + '</div></div>' : '') +
    (h.length ? '<div class="f"><label>ประวัติ</label><ol class="pm-hist">' + h.map(e => '<li class="' + (PSTG[e.s] ? PSTG[e.s].cls : '') + '"><i></i><b>' + esc(PSTG[e.s] ? PSTG[e.s].label : e.s) + '</b><span>' + esc(fdt(e.t)) + ' · ' + esc(e.by || '') + (e.x ? ' · ' + esc(e.x) : '') + '</span></li>').join('') + '</ol></div>' : '') +
    '</div><div class="pm-f">' + (canProd() ? (P2.del ? '<span class="pm-del">ลบงานนี้ออกจากฝ่ายผลิต?</span><button type="button" class="btn sm" data-pdel="no">ไม่</button><button type="button" class="btn sm danger" data-pdel="yes">ลบ</button>' : '<button type="button" class="btn ghost sm" data-pdel="ask">' + I.trash + 'ลบ</button>') : '') +
    '<span style="flex:1"></span><button type="button" class="btn" data-pclose="1">ปิด</button>' +
    (!ro && p.stage === 'wait' ? '<button type="button" class="btn primary" data-pstart="' + esc(p.id) + '">' + PIC.machine + 'เริ่มลงเครื่อง</button>' : '') +
    (!ro && PDONE[p.stage] ? '<button type="button" class="btn primary" data-padv="' + esc(p.id) + '">' + PDONE[p.stage] + '</button>' : '') + '</div></div>';
  paintAllThumbs(m);
}
function coOpen(code) {
  const p = prodOfCode(code); if (p) return pModalOpen(p.id);
  const js = designJobsOf(code), j = js.find(x => x.status !== 'done') || js[0]; if (j) return openEditor(j.id);
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t && t.id === 'pAddImg') { pAddRead(); Array.from(t.files || []).filter(f => /^image\//.test(f.type)).slice(0, IMG_MAX - P2.files.length).forEach(f => P2.files.push({ f: f, url: URL.createObjectURL(f) })); pModalDraw(); }
  if (t && t.id === 'pImgIn' && P2.id) { const id = P2.id; uploadProdImages(id, t.files).then(n => { if (n) toast('เพิ่มรูปแล้ว ' + n + ' รูป'); }); }
});
document.addEventListener('input', e => {
  const t = e.target; if (!t || t.id !== 'pAddCode') return;
  const before = P2.found ? P2.found.code : ''; pAddRead(); pAddLookup(t.value);
  if ((P2.found ? P2.found.code : '') !== before && P2.found) { const pos = t.selectionStart; pModalDraw(); const c = $('#pAddCode'); if (c) { c.focus(); try { c.setSelectionRange(pos, pos); } catch (x) {} } }
  else { const b = $('#pAddFound'); if (b) { b.className = 'pa-found' + (P2.found ? ' on' : ''); } }
});
/* ---- คลิกทั้งหมดของส่วนนี้ (คืน true เมื่อจัดการแล้ว) ---- */
function prodClick(t, d, e) {   // ไม่ใช้ ที่นี่: ปุ่มอื่นในแอปต้องตอบสนองทันที
  if (d.pclose || (t.id === 'pModal')) { pModalClose(); return true; }
  if (d.pm) { S.pm = d.pm; render(); return true; }
  if (d.cf) { S.cf = S.cf === d.cf && d.cf !== 'all' ? 'all' : d.cf; S.animIn = true; render(); return true; }
  if (d.coopen) { coOpen(d.coopen); return true; }
  if (d.pship) { S.pship = !S.pship; render(); return true; }
  if (d.pjob) { pModalClose(); openEditor(d.pjob); return true; }
  if (d.paddm) { const i = P2.ms.indexOf(d.paddm); if (i >= 0) P2.ms.splice(i, 1); else P2.ms.push(d.paddm); pAddRead(); pModalDraw(); return true; }
  if (d.paddassy) { P2.assy = P2.assy === 'no' ? '' : 'no'; pAddRead(); pModalDraw(); return true; }
  if (d.paddpaint) { P2.paint = P2.paint === 'no' ? '' : 'no'; pAddRead(); pModalDraw(); return true; }
  if (d.padue !== undefined) { pAddRead(); P2.f.due = addDays(today(), +d.padue); pModalDraw(); return true; }
  if (d.padimgdel !== undefined) { pAddRead(); const x = P2.files.splice(+d.padimgdel, 1)[0]; if (x) URL.revokeObjectURL(x.url); pModalDraw(); return true; }
  if (d.paddsave) {
    pAddRead(); const code = String(P2.code || '').trim(); if (!code) { toast('ใส่เลข Job ก่อน', true); const c = $('#pAddCode'); if (c) c.focus(); return true; }
    if (P2.saving) return true;
    const f = P2.f || {}, patch = { code: code, paint: P2.paint, assy: P2.assy, title: f.title || '', sale: f.sale || '', group: f.group || '', due: f.due || '', note: f.note || '' };
    if (P2.ms.length) { patch.machines = P2.ms.map(m => ({ m: m, d: '' })); patch.stage = 'machine'; }
    const files = P2.files.map(x => x.f); P2.saving = true; pModalDraw();
    prodWrite('', patch, code + ' เข้า' + (patch.stage ? 'ลงเครื่องแล้ว' : 'รอผลิตแล้ว')).then(async r => {
      P2.saving = false;
      if (!r) { pModalDraw(); return; }
      pModalClose(); if (S.view !== 'prod') go('prod');
      if (files.length) { const n = await uploadProdImages(r.id, files); if (n) toast('เพิ่มรูปแล้ว ' + n + ' รูป'); }
    });
    return true;
  }
  if (d.pinfo) {
    if (d.pinfo === 'edit') { P2.edit = true; pModalDraw(); setTimeout(() => { const x = $('#pEdTitle'); if (x) x.focus(); }, 30); return true; }
    if (d.pinfo === 'cancel') { P2.edit = false; pModalDraw(); return true; }
    const p = prodById(P2.id); if (!p || !canProd()) return true;
    const v = id => (($('#' + id) || {}).value || '').trim();
    P2.edit = false; prodWrite(p.id, { title: v('pEdTitle'), sale: v('pEdSale'), group: v('pEdGroup'), due: v('pEdDue') }, 'บันทึกข้อมูลงานแล้ว'); return true;
  }
  if (!canProd() && (d.pmt || d.ppaint || d.passy || d.pstart || d.pmd || d.padv || d.pback || d.pset || d.pmset || d.pnote || d.pdel)) return true;
  if (d.pmt) { e.stopPropagation(); const p = prodById(d.pid); if (!p) return true; S.psel = S.psel || {}; const a = (S.psel[p.id] || pms(p).map(m => m.m)).slice(), i = a.indexOf(d.pmt); if (i >= 0) a.splice(i, 1); else a.push(d.pmt); S.psel[p.id] = a; render(); return true; }
  if (d.passy) { e.stopPropagation(); const p = prodById(d.passy); if (p) prodWrite(p.id, { assy: p.assy === 'no' ? '' : 'no' }, p.assy === 'no' ? 'งานนี้ต้องประกอบติดตั้ง' : 'งานนี้ไม่ต้องประกอบติดตั้ง'); return true; }
  if (d.ppaint) { e.stopPropagation(); const p = prodById(d.ppaint); if (p) prodWrite(p.id, { paint: p.paint === 'no' ? '' : 'no' }, p.paint === 'no' ? 'งานนี้ต้องทำสี' : 'งานนี้ไม่ต้องทำสี'); return true; }
  if (d.pstart) { e.stopPropagation(); const p = prodById(d.pstart); if (p) pStart(p); return true; }
  if (d.pmd) { e.stopPropagation(); const p = prodById(d.pid); if (p) pMachineDone(p, d.pmd); return true; }
  if (d.padv) { e.stopPropagation(); const p = prodById(d.padv); if (p) pAdvance(p); return true; }
  if (d.pback) { e.stopPropagation(); const p = prodById(d.pback); if (p) pBack(p); return true; }
  if (d.pset) { const p = prodById(P2.id); if (!p) return true; const patch = { stage: d.pset, why: 'ย้ายขั้นจากหน้ารายละเอียด' };
    if (d.pset === 'machine' && !pms(p).length) { toast('เลือกเครื่องในช่อง "เครื่องที่ใช้" ก่อน', true); return true; }
    if (d.pset === 'machine') patch.machines = pms(p).map(m => ({ m: m.m, d: '' }));
    if (d.pset === 'wait') patch.machines = pms(p).map(m => ({ m: m.m, d: '' }));
    prodWrite(p.id, patch, p.code + ' → ' + PSTG[d.pset].label); return true; }
  if (d.pmset) { const p = prodById(P2.id); if (!p) return true; let ms = pms(p); const has = ms.find(x => x.m === d.pmset);
    ms = has ? ms.filter(x => x.m !== d.pmset) : ms.concat({ m: d.pmset, d: '' });
    if (p.stage === 'machine' && !ms.length) { toast('งานที่กำลังลงเครื่องต้องมีอย่างน้อย 1 เครื่อง', true); return true; }
    if (p.stage === 'wait') { S.psel = S.psel || {}; S.psel[p.id] = ms.map(x => x.m); }
    prodWrite(p.id, { machines: ms }, (has ? 'เอา ' : 'เพิ่ม ') + d.pmset + (has ? ' ออก' : '')); return true; }
  if (d.pnote) { const p = prodById(P2.id); if (p) prodWrite(p.id, { note: ($('#pNote') || {}).value || '' }, 'บันทึกโน้ตแล้ว'); return true; }
  if (d.pdel) {
    if (d.pdel === 'ask') { P2.del = true; pModalDraw(); return true; }
    if (d.pdel === 'no') { P2.del = false; pModalDraw(); return true; }
    const id = P2.id, p = prodById(id); P2.del = false;
    mutate(() => api().prodDelete({ id: id }), 'ลบ ' + (p ? p.code : '') + ' ออกจากฝ่ายผลิตแล้ว').then(() => { S.prods = prodsAll().filter(x => x.id !== id); pModalClose(); render(); }, () => pModalDraw());
    return true;
  }
  if (d.popen) { if (e.stopPropagation) e.stopPropagation(); pModalOpen(d.popen); return true; }
  return false;
}

/* ---- ปุ่ม Sale ที่หน้าเข้าสู่ระบบ ---- */
function saleTile() {
  const L = S.login;   // แสดงเสมอ — ถ้าแอดมินยังไม่ตั้ง PIN จะบอกตอนกด
  if (!L.sale) return '<button type="button" class="sale-tile" data-act="saleon"><span class="st-ic">' + PIC.sale + '</span><span><b>สำหรับ Sale</b><small>ดูสถานะงานทุกฝ่าย ไม่ต้องมีบัญชี</small></span><span class="st-go">' + I.next + '</span></button>';
  return '<form class="sale-pin" id="saleForm"><div class="sp-row"><span class="st-ic">' + PIC.sale + '</span><b>PIN สำหรับ Sale</b><button type="button" class="icon-btn sm" data-act="saleoff" aria-label="ยกเลิก">✕</button></div>' +
    '<div class="sp-row"><input id="salePin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="PIN 4–6 หลัก" aria-label="PIN สำหรับ Sale"><button class="btn primary sm" type="submit"' + (L.saleBusy ? ' disabled' : '') + '>' + (L.saleBusy ? 'กำลังเปิด…' : 'เปิดหน้า Sale') + '</button></div>' +
    (L.saleErr ? '<div class="err" role="alert">' + esc(L.saleErr) + '</div>' : '<small class="sub">ขอ PIN ได้จากแอดมิน' + (mode() === 'demo' ? ' (โหมดทดลองใช้ 1234)' : '') + '</small>') + '</form>';
}
async function saleSubmit() {
  const L = S.login, pin = String(($('#salePin') || {}).value || '').trim();
  if (!/^\d{4,6}$/.test(pin)) { L.saleErr = 'PIN ต้องเป็นตัวเลข 4–6 หลัก'; renderLogin(); return; }
  L.saleBusy = true; L.saleErr = ''; renderLogin();
  try {
    const r = mode() === 'sheet' ? await Remote.call('saleOpen', { pin: pin }) : await Demo.saleOpen({ pin: pin });
    LS.set('saleKey', r.key); location.href = saleLinkUrl(r.key, '');
  } catch (e) { L.saleBusy = false; L.saleErr = e.message; renderLogin(); const x = $('#salePin'); if (x) x.focus(); }
}

/* ===== หน้า Sale: มุมมอง "ภาพรวมสถานะ" แบบเดียวกับหน้าภาพรวมบริษัท (1 เลข Job = 1 แถว เดินตั้งแต่ฝ่ายแบบจนส่งลูกค้า) ===== */
const SF = { v: LS.get('saleView', 'flow'), step: 'all', q: '', sale: '', open: {}, anim: true };
function saleRows(d) {
  const t = today(), by = {}, key = c => String(c || '').trim().toLowerCase();
  (d.jobs || []).forEach(j => { const k = key(j.code); if (k) (by[k] = by[k] || { code: j.code, jobs: [], prod: null }).jobs.push(j); });
  (d.prods || []).forEach(p => { const k = key(p.code); const r = by[k] || (by[k] = { code: p.code, jobs: [], prod: null }); if (!r.prod || (r.prod.stage === 'shipped' && p.stage !== 'shipped')) r.prod = p; });
  return Object.values(by).map(r => {
    const p = r.prod, open = r.jobs.filter(j => j.status !== 'done'), ref = p || r.jobs[0] || {};
    let step, sub, info = '', late = false, due = '';
    if (p && p.stage !== 'shipped') {
      step = p.stage; const ms = (p.machines || []).filter(m => m && m.m);
      sub = p.stage === 'machine' ? ms.map(m => (m.d ? '✓ ' : '') + m.m).join(' · ') : PSTG[p.stage].sub;
      info = p.stage === 'ready' ? 'พร้อมส่งตั้งแต่ ' + fd(p.finishedAt) : 'เข้าผลิต ' + fd(p.enteredAt); var dl = p.stage === 'ready' ? 'พร้อมส่งตั้งแต่' : 'เข้าผลิต', dd = String(p.stage === 'ready' ? p.finishedAt : p.enteredAt).slice(0, 10);
      if (p.due && p.stage !== 'ready') { due = p.due; late = due < t; }
    } else if (open.length) {
      const o = open.slice().sort((a, b) => ['doing', 'fix', 'review', 'queue', 'hold'].indexOf(a.status) - ['doing', 'fix', 'review', 'queue', 'hold'].indexOf(b.status))[0];
      step = 'design'; sub = (o.taskType || 'ออกแบบ') + ' · ' + (ST[o.status] || ST.queue).label;
      due = open.map(j => j.due).filter(Boolean).sort()[0] || ''; late = !!due && due < t;
    } else if (p) { step = 'shipped'; sub = 'ส่งถึงลูกค้าแล้ว'; info = 'ส่งแล้ว ' + fd(p.shippedAt); dl = 'ส่งแล้ว'; dd = String(p.shippedAt).slice(0, 10); }
    else { const fin = r.jobs.map(j => String(j.finishedAt || '').slice(0, 10)).sort().pop() || ''; step = 'ddone'; sub = 'ออกแบบเสร็จ · รอเข้าผลิต'; info = 'เสร็จ ' + fd(fin); var old = fin < addDays(t, -14); dl = 'ออกแบบเสร็จ'; dd = fin; }
    return { code: r.code, title: ref.title || (r.jobs.find(j => j.title) || {}).title || '', sale: ref.sale || (r.jobs.find(j => j.sale) || {}).sale || '', group: ref.group || (r.jobs[0] || {}).group || '',
      step: step, sub: sub, info: info, late: late, due: due, prod: p, old: step === 'ddone' && !!old, dl: due ? (step === 'design' ? 'กำหนดส่งแบบ' : 'กำหนดส่ง') : dl || '', dd: due || dd || '', jobs: r.jobs, urgent: r.jobs.some(j => j.priority === 'urgent' && j.status !== 'done') };
  });
}
function saleFlowHtml(d, sel) {
  const t = today(), all = saleRows(d).filter(r => !SF.sale || r.sale === SF.sale), qq = SF.q.trim().toLowerCase();
  const n = k => all.filter(r => k === 'design' ? r.step === 'design' || r.step === 'ddone' : r.step === k).length;
  const live = all.filter(r => r.step !== 'shipped' && !r.old), late = all.filter(r => r.late).length;
  const tile = (s, i) => '<button type="button" class="co-step d-' + s.dept + ' ' + (s.k === 'design' ? 's-doing' : PSTG[s.k].cls) + '" data-sfstep="' + s.k + '" aria-pressed="' + (SF.step === s.k) + '"><span class="flow-ic ic-' + s.ic + '">' + PIC[s.ic] + '</span><b>' + n(s.k) + '</b><span>' + s.label + '</span><small>' + esc(s.sub || '') + '</small></button>' + (i < CO_STEPS.length - 1 ? '<span class="co-arrow" aria-hidden="true"></span>' : '');
  const pipe = '<div class="co-pipe"><div class="co-depts"><span class="dl d-d">' + PIC.design + 'ฝ่ายแบบ</span><span class="dl d-p">' + PIC.machine + 'ฝ่ายผลิต</span><span class="dl d-s">' + PIC.ready + 'ส่งมอบ</span></div><div class="co-steps">' + CO_STEPS.map(tile).join('') + '</div></div>';
  const kpis = '<div class="co-kpis"><button type="button" class="kpi" data-sfstep="all"><span>งานที่ยังไม่ส่ง</span><b>' + live.length + '</b><small>เลข Job ที่อยู่ระหว่างทำ</small></button>' +
    '<button type="button" class="kpi k-late" data-sfstep="late"><span>เลยกำหนด (ฝ่ายแบบ)</span><b>' + late + '</b><small>ควรติดตามกับทีม</small></button>' +
    '<button type="button" class="kpi k-done" data-sfstep="shipped"><span>ส่งแล้ว</span><b>' + n('shipped') + '</b><small>ปิดงานถึงลูกค้า (60 วันล่าสุด)</small></button></div>';
  let list = all.filter(r => (SF.step === 'all' ? r.step !== 'shipped' && !r.old : SF.step === 'late' ? r.late : SF.step === 'design' ? r.step === 'design' || r.step === 'ddone' : r.step === SF.step) &&
    (!qq || [r.code, r.title, r.sale, r.group, r.sub].join(' ').toLowerCase().indexOf(qq) >= 0));
  list.sort((a, b) => (b.late - a.late) || (coIdx(b.step) - coIdx(a.step)) || String(a.due || '9').localeCompare(String(b.due || '9')));
  const sales = [...new Set(saleRows(d).map(r => r.sale).filter(Boolean))].sort();
  const where = r => r.step === 'design' ? '<span class="pill s-doing">ฝ่ายแบบ</span>' : r.step === 'ddone' ? '<span class="pill s-done">ออกแบบเสร็จ</span>' : pPill(r.step);
  const dateBox = coDate;
  const dueTxt = r => { if (!r.due) return r.info; const dd = daysBetween(t, r.due); return 'กำหนดส่งแบบ ' + fd(r.due) + (dd < 0 ? ' · เลย ' + (-dd) + ' วัน' : dd === 0 ? ' · วันนี้' : dd === 1 ? ' · พรุ่งนี้' : ''); };
  const detail = r => '<div class="sf-det">' + saleImgs(r) + (r.jobs.length ? '<div class="sf-jobs">' + r.jobs.map(j => '<div class="sf-job"><span class="sp-type" style="--tc:' + typeColorPub(j.taskType) + '">' + esc(j.taskType || 'งาน') + '</span>' +
      '<span class="pill ' + (ST[j.status] || ST.queue).cls + '">' + (ST[j.status] || ST.queue).label + '</span><span class="sf-who">' + (j.assignee ? av(j.assignee, 'sm') + esc(j.assignee) : 'ยังไม่มอบหมาย') + '</span>' +
      '<small>' + (j.status === 'done' ? 'เสร็จ ' + fd(String(j.finishedAt).slice(0, 10)) : j.due ? 'กำหนด ' + fd(j.due) : '') + (j.steps ? ' · เช็กลิสต์ ' + esc(j.steps) : '') + '</small></div>').join('') + '</div>' : '') +
    (r.prod ? '<div class="sf-prod ' + PSTG[r.prod.stage].cls + '">' + PIC.machine + '<b>ฝ่ายผลิต: ' + PSTG[r.prod.stage].label + '</b>' + ((r.prod.machines || []).length ? '<span>' + (r.prod.machines || []).map(m => '<i class="' + (m.d ? 'on' : '') + '">' + (m.d ? '✓ ' : '') + esc(m.m) + '</i>').join('') + '</span>' : '') +
      '<small>' + [r.prod.paint === 'no' ? 'ไม่ทำสี' : '', r.prod.assy === 'no' ? 'ไม่ประกอบ' : '', r.prod.enteredAt ? 'เข้าผลิต ' + fd(r.prod.enteredAt) : '', r.prod.shippedAt ? 'ส่งแล้ว ' + fd(r.prod.shippedAt) : ''].filter(Boolean).join(' · ') + '</small></div>' : '') +
    ((r.jobs.find(j => j.note) || {}).note ? '<p class="sf-note">' + STI.note + esc(r.jobs.find(j => j.note).note) + '</p>' : '') + '</div>';
  SF.by = {}; list.forEach(r => { SF.by[r.code] = r; });
  const rows = list.length ? '<div class="co-list sf-list">' + list.slice(0, 300).map((r, k) => { const op = !!SF.open[r.code];
      return '<div class="sf-item' + (op ? ' open' : '') + '"><button type="button" class="co-row ' + coStg(r) + ' co-' + (r.step === 'ddone' ? 'design' : r.step) + (r.late ? ' late' : '') + (SF.anim ? ' in' : '') + '" style="--i:' + Math.min(k, 24) + '" data-sfopen="' + esc(r.code) + '" data-shov="' + esc(r.code) + '" aria-expanded="' + op + '">' +
        '<span class="co-bub flow-ic ic-' + coIc(r) + '">' + PIC[coIc(r)] + '</span><span class="co-code"><b>' + esc(r.code) + '</b>' + (r.urgent ? '<span class="tag urgent">' + STI.fire + 'ด่วน</span>' : '') + '<small>' + esc(r.title || '–') + '</small></span>' + coX(r, { sale: !sel }) +
        '<span class="co-mid">' + coRoute(r) + '<small>' + where(r) + ' ' + esc(r.sub) + '</small></span>' +
        '<span class="co-meta">' + dateBox(r) + '<span class="sf-chev">' + I.next + '</span></span></button>' +
        (op ? detail(r) : '') + '</div>'; }).join('') + '</div>'
    : '<div class="sp-empty"><span>🔍</span><b>ไม่มีงานในมุมมองนี้</b><button class="btn sm" data-sfstep="all">ดูทั้งหมด</button></div>';
  const chips = '<div class="qchips">' + [['all', 'ทั้งหมดที่ยังไม่ส่ง', live.length], ['late', 'เลยกำหนด', late], ['shipped', 'ส่งแล้ว', n('shipped')]].map(x => '<button class="qchip' + (x[0] === 'late' ? ' q-late' : '') + '" data-sfstep="' + x[0] + '" aria-pressed="' + (SF.step === x[0]) + '">' + x[1] + '<b>' + x[2] + '</b></button>').join('') +
    (['all', 'late', 'shipped'].indexOf(SF.step) < 0 ? '<button class="qchip" data-sfstep="all" aria-pressed="true">' + esc(SF.step === 'design' ? 'ฝ่ายแบบ' : PSTG[SF.step].label) + ' ✕</button>' : '') + '</div>';
  const tools = '<div class="sp-tools"><label class="sp-search">' + I.search + '<input id="sfQ" type="search" placeholder="ค้นหาเลข Job, ชื่อลูกค้า…" value="' + esc(SF.q) + '" autocomplete="off"></label>' +
    (sel ? '' : '<div class="sp-filters"><label class="spf' + (SF.sale ? ' on' : '') + '"><span class="spf-ic">' + STI.user + '</span><select data-sfsale="1"><option value="">ทุก Sale</option>' + sales.map(x => '<option' + (SF.sale === x ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></label></div>') + '</div>';
  const legend = '<div class="co-legend"><span><i class="d-d"></i>ฝ่ายแบบ</span><span><i class="d-p"></i>ฝ่ายผลิต</span><span><i class="d-s"></i>ส่งมอบ</span><span><i class="now"></i>ตอนนี้อยู่ที่</span><span><i class="now late"></i>เลยกำหนด</span></div>';
  SF.anim = false;
  return pipe + kpis + '<section class="panel sf-panel"><div class="panel-h"><h2>งานตามเลข Job</h2>' + legend + '</div>' + tools + chips + rows + '</section>';
}
const saleTabs = () => '<div class="sf-tabs" role="tablist"><button type="button" role="tab" data-sfview="flow" aria-selected="' + (SF.v === 'flow') + '">' + I.flow + 'ภาพรวมสถานะ</button><button type="button" role="tab" data-sfview="table" aria-selected="' + (SF.v !== 'flow') + '">' + I.list + 'ตารางงานฝ่ายแบบ</button></div>';

/* ============ events ============ */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-open],[data-popen],[data-room],a[href^="#s-"],a[data-rtc],label.btn');
  if (!t) return;
  const d = t.dataset;

  if (t.tagName === 'A' && !t.dataset.rtc && t.getAttribute('href').indexOf('#s-') === 0) { e.preventDefault(); const el = document.querySelector(t.getAttribute('href')); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
  if (d.rtc) { e.preventDefault(); return rtcAct(d.rtc, t); }
  if (d.room) { e.preventDefault(); return roomAct(d.room, t); }
  if (d.view) return go(d.view);
  if (d.go) return go(d.go, d.sec);
  if (d.move) { e.stopPropagation(); return moveJob(d.move, d.to); }
  if (d.rpreset) { reportState(); if (d.rpreset !== 'custom') applyPreset(d.rpreset); else S.r.preset = 'custom'; saveReportState(); return render(); }
  if (d.filterGo) { S.f.status = d.filterGo; S.f.month = d.fmonth || ''; return go('list'); }
  if (d.mine) { S.f.member = '__me'; LS.set('fMember', S.f.member); return go('board'); }
  if (d.memberjobs) { S.f.member = d.memberjobs; S.f.status = 'open'; LS.set('fMember', S.f.member); return go('list'); }
  if (d.fstatus) { S.f.status = d.fstatus; if (d.fstatus !== 'done') S.f.month = ''; return render(); }
  // login screen
  if (d.who !== undefined) { S.login.userId = d.who; S.login.pin = ''; S.login.err = ''; return renderLogin(); }
  if (d.pin) { pressKey(d.pin, t); return; }
  // user admin
  if (d.themepick) { setTheme(Object.assign({ preset: d.themepick }, d.themepick === 'classic' ? { sidebar: 'plain', header: 'plain' } : getTheme().preset === 'classic' ? { sidebar: 'gradient', header: 'gradient' } : {}, (THEMES.find(x => x.id === d.themepick) || {}).mode ? { mode: THEMES.find(x => x.id === d.themepick).mode } : {})); return render(); }
  if (d.themeset) { setTheme({ [d.themeset]: d.val }); return render(); }
  if (d.insttab) { INST.tab = d.insttab; renderLogin(); drawQr(); return; }
  if (d.quick) { S.f.quick = d.quick; return render(); }
  if (d.ctype) { LS.set('chartType', d.ctype); S.animIn = true; return render(); }
  if (d.holdel && S.draft) { S.draft.holidays = (S.draft.holidays || []).filter(h => h.d !== d.holdel); markDirty(); return render(); }
  if (d.dueday && d.dueday !== 'pick') { S.dueDay = d.dueday; return renderDue(); }
  if (d.duescope) { LS.set('dueScope', d.duescope); LS.set('dueSeen:' + S.me, {}); renderDue(); return render(); }
  if (d.open && t.closest('#duePanel')) closeDue();
  if (d.gg) { S.gg = d.gg; LS.set('ganttGroup', d.gg); return render(); }
  if (d.hperson !== undefined) { S.hp = d.hperson; LS.set('homePerson', d.hperson); return render(); }
  if (d.hpreset) { homeRange(); S.hr.preset = d.hpreset; homeRange(); saveHomeRange(); return render(); }
  if (d.saveuser) return saveUserRow(d.saveuser);
  if (d.udel !== undefined) { S.userDel = d.udel || ''; return render(); }
  if (d.udelyes) { const id = d.udelyes, u = S.users.find(x => x.id === id); try { await mutate(() => api().deleteUser({ userId: id }), 'ลบผู้ใช้ ' + (u ? u.name : '') + ' แล้ว'); S.users = S.users.filter(x => x.id !== id); S.userDel = ''; render(); } catch (x) {} return; }
  if (d.rmphoto) return setPhoto(d.rmphoto, null);
  if (d.pinedit !== undefined) { S.pinEdit = d.pinedit; S.pinNote = null; render(); const x = $('#pinSet'); if (x) x.focus(); return; }
  if (d.copypin) { try { await navigator.clipboard.writeText(d.copypin); toast('คัดลอก PIN แล้ว'); } catch (x) {} return; }
  if (d.pinsave) { const v = ($('#pinSet') || {}).value || ''; if (!/^\d{4,6}$/.test(v)) { toast('PIN ต้องเป็นตัวเลข 4–6 หลัก', true); return; } try { const r = await mutate(() => api().resetPin({ userId: d.pinsave, pin: v }), 'ตั้ง PIN ใหม่แล้ว'); S.pinEdit = ''; S.pinNote = { userId: r.userId, pin: r.pin }; render(); } catch (x) {} return; }
  if (d.resetpin) { S.pinEdit = ''; try { const r = await mutate(() => api().resetPin({ userId: d.resetpin })); S.pinNote = { userId: r.userId, pin: r.pin }; render(); } catch (x) {} return; }

  // editor-scoped
  if (d.est && S.edit) { readEditor(); S.edit.job.status = isCam(S.edit.job) && d.est === 'review' ? 'done' : d.est; if (S.edit.job.status !== d.est) toast('งาน CAM ไม่ต้องรอตรวจ — ตั้งเป็นเสร็จแล้ว'); if (S.edit.job.status === 'done' && !S.edit.job.finishedAt) S.edit.job.finishedAt = nowLocal(); if (S.edit.job.status !== 'done') S.edit.job.finishedAt = ''; return renderEditor(); }
  if (d.fdel) return deleteFile(d.fdel);
  if (d.ncldel !== undefined && S.edit) { readEditor(); S.edit.firstCmt = ($('#eCmt') || {}).value || ''; const c = clOf(S.edit.job); c.splice(+d.ncldel, 1); S.edit.job.checklist = JSON.stringify(c); return renderEditor(); }
  if (d.pfdel !== undefined && S.edit) { readEditor(); S.edit.firstCmt = ($('#eCmt') || {}).value || ''; (S.edit.pfiles || []).splice(+d.pfdel, 1); return renderEditor(); }
  if (d.cltog !== undefined && S.edit && !t.disabled) { const id = S.edit.job.id, c = clOf(jobById(id)), x = c[+d.cltog]; if (x) { x.d = x.d ? 0 : 1; if (x.d) { x.by = S.me; x.at = nowLocal(); } else { delete x.by; delete x.at; } clSave(id, c); } return; }
  if (d.cldel !== undefined && S.edit) { const id = S.edit.job.id, c = clOf(jobById(id)); c.splice(+d.cldel, 1); clSave(id, c); return; }
  if (d.cmtdel) return delCmt(d.cmtdel);
  if (d.ehelp && S.edit) { readEditor(); const hs = helpersOf(S.edit.job), n = d.ehelp; S.edit.job.helpers = (hs.includes(n) ? hs.filter(x => x !== n) : hs.concat(n)).join(','); return renderEditor(); }
  if (d.eqty && S.edit) { readEditor(); S.edit.job.qty = d.eqty; autoDue(); return renderEditor(); }
  if (d.elv && S.edit) { readEditor(); S.edit.job.level = +d.elv === +S.edit.job.level ? '' : +d.elv; return renderEditor(); }
  if (d.dellog) { try { const r = await mutate(() => api().deleteLog({ logId: d.dellog }), 'ลบรายการเวลาแล้ว'); S.logs = S.logs.filter(l => l.id !== d.dellog); const j = jobById(r.jobId); if (j) j.minutes = r.minutes; render(); } catch (x) {} return; }

  // settings-scoped
  if (d.accent) { S.draft.accent = d.accent; markDirty(); document.documentElement.style.setProperty('--brand', d.accent); return render(); }
  if (d.add) { const k = d.add; if (k === 'members') S.draft.members.push({ id: uid('m_'), name: '', full: '', color: COLORS[S.draft.members.length % COLORS.length] }); else if (k === 'taskTypes') S.draft.taskTypes.push({ name: '', cat: 'draw' }); else S.draft[k].push(''); markDirty(); render(); setTimeout(() => { const ins = document.querySelectorAll('[data-d^="' + k + '."]'); const last = ins[k === 'members' ? ins.length - 2 : ins.length - 1]; if (last) last.focus(); }, 20); return; }
  if (d.del) { const p = d.del.split('.'); const gone = S.draft[p[0]].splice(+p[1], 1)[0]; if (p[0] === 'groups' && S.draft.sla && gone !== undefined && !S.draft.groups.includes(gone)) delete S.draft.sla[gone]; markDirty(); return render(); }

  if (d.ch) { M.help = false; if (!M.open) return openMsgPanel(d.ch); M.ch = d.ch; renderMsgPanel(); return markChanRead(d.ch); }
  if (d.head) { const m = M.list.find(x => x.id === d.head); return openMsgPanel(m ? chanOf(m) : 'team'); }
  if (d.helpto) { M.helpTo = d.helpto; renderMsgPanel(); return; }
  if (d.helptopic) { const t = $('#msgText'); if (t) { t.value = d.helptopic + (t.value ? ' — ' + t.value : ''); t.focus(); } return; }
  if (d.msgdel) return delMsgs([d.msgdel], 'ลบข้อความแล้ว');
  if (d.helptake) return helpUpdate(d.helptake, 'taken');
  if (d.helpdone) return helpUpdate(d.helpdone, 'done');
  if (d.ntfopen) { dismissNtf(t.closest('.ntf')); return openMsgPanel(d.ntfopen); }
  if (d.ntfx) return dismissNtf(t.closest('.ntf'));
  if (d.camyes) return createCamFrom(d.camyes);
  if (d.camno) { const b = $('#askBox'); if (b) b.classList.remove('show'); return; }
  if (d.emo) { e.preventDefault(); return emoInsert(d.emo); }
  if (d.emotab) { M.emoTab = d.emotab; const pop = $('#emoPop'); if (pop) pop.innerHTML = emoPopHtml(); return; }
  if (d.act === 'emoji') { e.preventDefault(); return emoToggle(); }
  if (d.pendx && S.edit) { const E = S.edit; if (E.mode === 'edit') readEditor(); const p = (E.pending || []).find(x => x.id === d.pendx); if (p) URL.revokeObjectURL(p.url); E.pending = (E.pending || []).filter(x => x.id !== d.pendx); return renderEditor(); }
  if (d.lbopen) return openLightbox(d.lbjob, d.lbopen);
  if (d.lbgo !== undefined) { S.lb.i = +d.lbgo; return drawLightbox(); }
  if (d.lb) { if (d.lb === 'close') return closeLightbox(); S.lb.i += d.lb === 'next' ? 1 : -1; return drawLightbox(); }
  if (d.lbdel) return deleteImage(d.lbdel);
  if (prodClick(t, d, e)) return;
  if (d.open && !e.target.closest('.adv')) return openEditor(d.open);

  switch (d.act) {
    case 'new': if (S.view === 'prod') return canProd() ? pAddOpen() : undefined; if (isProdRole()) return; return openEditor(null);
    case 'saleon': { const k = LS.get('saleKey', ''); if (k && mode() === 'sheet') { location.href = saleLinkUrl(k, ''); return; } S.login.sale = true; S.login.saleErr = ''; renderLogin(); setTimeout(() => { const x = $('#salePin'); if (x) x.focus(); }, 30); return; }
    case 'saleoff': S.login.sale = false; S.login.saleErr = ''; return renderLogin();
    case 'salepin': { const v = String(($('#salePinSet') || {}).value || '').trim(); if (v && !/^\d{4,6}$/.test(v)) { toast('PIN ต้องเป็นตัวเลข 4–6 หลัก', true); return; }
      try { const r = await mutate(() => api().salePin({ pin: d.clear ? '' : v }), d.clear ? 'ปิดปุ่ม Sale ที่หน้าเข้าสู่ระบบแล้ว' : 'ตั้ง PIN ของ Sale แล้ว'); S.salePinOn = !!r.on; render(); } catch (x) {} return; }
    case 'close': return closeEditor();
    case 'save': return saveEditor();
    case 'usesg': { readEditor(); const sg = suggestDue(S.edit.job); if (sg) S.edit.job.due = sg.date; S.edit.dueTouched = true; return renderEditor(); }
    case 'del': readEditor(); S.edit.confirm = true; return renderEditor();
    case 'delno': S.edit.confirm = false; return renderEditor();
    case 'delyes': { const id = S.edit.job.id, code = S.edit.job.code; try { await mutate(() => api().deleteJob({ id: id }), 'ลบ ' + code + ' แล้ว'); S.jobs = S.jobs.filter(j => j.id !== id); S.logs = S.logs.filter(l => l.jobId !== id); closeEditor(); render(); } catch (x) {} return; }
    case 'start': if (S.edit) readEditor(); return startTimer(d.job);
    case 'stop': if (S.edit) readEditor(); return stopTimer(d.log);
    case 'ganttall': S.ganttAll = !S.ganttAll; return render();
    case 'refresh': return load(false).then(() => { if (S.sync === 'ok') toast('อัปเดตข้อมูลล่าสุดแล้ว'); });
    case 'csv': return exportCsv();
    case 'retryload': S.login.err = ''; S.login.retry = false; S.login.busy = true; renderLogin(); return load(false);
    case 'msgopen': return M.open ? closeMsgPanel() : openMsgPanel();
    case 'dueopen': return $('#duePanel') && $('#duePanel').classList.contains('show') ? closeDue() : openDue();
    case 'dueclose': return closeDue();
    case 'cladd': { const el = $('#clNew'), v = el ? el.value.trim() : ''; if (!v || !S.edit) return; const id = S.edit.job.id, c = clOf(jobById(id)); c.push({ t: v, d: 0 }); clSave(id, c); setTimeout(() => { const n = $('#clNew'); if (n) n.focus(); }, 60); return; }
    case 'cltpl': { if (!S.edit) return; const j = jobById(S.edit.job.id); return clSave(j.id, clTemplate(j.taskType)); }
    case 'cmtsend': return sendCmt();
    case 'ncladd': { if (!S.edit) return; const el = $('#nclNew'), v = el ? el.value.trim() : ''; if (!v) return; readEditor(); S.edit.firstCmt = ($('#eCmt') || {}).value || ''; const c = clOf(S.edit.job); c.push({ t: v, d: 0 }); S.edit.job.checklist = JSON.stringify(c); renderEditor(); setTimeout(() => { const n = $('#nclNew'); if (n) n.focus(); }, 30); return; }
    case 'ncltpl': { if (!S.edit) return; readEditor(); S.edit.firstCmt = ($('#eCmt') || {}).value || ''; S.edit.job.checklist = JSON.stringify(clTemplate(S.edit.job.taskType)); return renderEditor(); }
    case 'salelink': { try { const r = await mutate(() => api().saleLink({ reset: !!d.reset })); S.saleKey = r.key; if (d.reset) toast('สร้างลิงก์ใหม่แล้ว ลิงก์เก่าใช้ไม่ได้'); render(); } catch (x) {} return; }
    case 'copysale': { try { await navigator.clipboard.writeText(d.url); toast('คัดลอกลิงก์แล้ว'); } catch (x) { prompt('คัดลอกลิงก์นี้', d.url); } return; }
    case 'holadd': { const dd = $('#holD'), nn = $('#holN'); if (!dd || !dd.value || !S.draft) return; S.draft.holidays = (S.draft.holidays || []).filter(h => h.d !== dd.value).concat({ d: dd.value, n: (nn && nn.value.trim()) || 'วันหยุด' }).sort((a, b) => a.d.localeCompare(b.d)); markDirty(); return render(); }
    case 'holfixed': { if (!S.draft) return; const y = new Date().getFullYear(); const add = [y, y + 1].flatMap(yy => FIXED_HOL.map(h => ({ d: yy + '-' + h[0], n: h[1] }))).filter(h => h.d >= today()); const have = new Set((S.draft.holidays || []).map(h => h.d)); S.draft.holidays = (S.draft.holidays || []).concat(add.filter(h => !have.has(h.d))).sort((a, b) => a.d.localeCompare(b.d)); markDirty(); toast('เพิ่มวันหยุดราชการ (วันที่ตายตัว) ' + add.filter(h => !have.has(h.d)).length + ' วัน'); return render(); }
    case 'msgclose': return closeMsgPanel();
    case 'msgsound': LS.set('msgSound', msgSoundOn() ? 0 : 1); if (msgSoundOn()) { ping(false, true); msgBuzz(false); } toast(msgSoundOn() ? 'เปิดเสียงและสั่นเมื่อมีข้อความ' : 'ปิดเสียงแจ้งเตือนข้อความแล้ว'); renderMsgPanel(); return;
    case 'msgattdel': M.att = null; renderMsgPanel(); { const t = $('#msgText'); if (t) t.focus(); } return;
    case 'helpon': M.help = true; M.helpTo = M.ch === 'admin' ? 'admin' : 'team'; renderMsgPanel(); { const x = $('#msgText'); if (x) x.focus(); } return;
    case 'helpnojob': M.jobId = ''; renderMsgPanel(); return;
    case 'msgclear': M.confirmClear = true; renderMsgPanel(); return;
    case 'msgclearno': M.confirmClear = false; renderMsgPanel(); return;
    case 'msgclearyes': { M.confirmClear = false; const ids = M.list.filter(m => chanOf(m) === M.ch).map(m => m.id); return delMsgs(ids, 'ล้างประวัติแล้ว ' + ids.length + ' ข้อความ'); }
    case 'helpoff': M.help = false; renderMsgPanel(); return;
    case 'askhelp': { const jid = d.job; closeEditor(); return openMsgPanel(null, { help: true, jobId: jid }); }
    case 'notifyperm': pushEnable(true).then(() => { renderMsgPanel(); if (S.view === 'settings') render(); }); return;
    case 'pushoff': pushDisable().then(() => render()); return;
    case 'editmode': if (S.edit) { S.edit.mode = 'edit'; renderEditor(); } return;
    case 'install': return installApp();
    case 'insthelp': INST.help = !INST.help; renderLogin(); if (INST.help) drawQr(); return;
    case 'copyapp': try { await navigator.clipboard.writeText(appUrl()); toast('คัดลอกลิงก์แล้ว ส่งให้ทีมหรือเปิดบนอีกเครื่องได้เลย'); } catch (x) { toast(appUrl()); } return;
    case 'bgremove': try { localStorage.removeItem('kiwngan:bgimg'); } catch (x) {} applyTheme(); toast('เอารูปพื้นหลังออกแล้ว'); return render();
    case 'themereset': LS.del('theme'); applyTheme(); toast('คืนค่าธีมเริ่มต้นแล้ว'); return render();
    case 'print': return printReport();
    case 'connect': return connect();
    case 'disconnect': if (LOCKED()) { LS.del('conn'); S.conn = DEFAULT_CONN(); toast('กลับไปใช้ฐานข้อมูลหลักของทีมแล้ว'); S.loaded = false; return load(false); } S.conn = null; LS.del('conn'); S.loaded = false; S.login.showConn = false; toast('กลับสู่โหมดทดลองแล้ว'); return load(false);
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

document.addEventListener('click', e => { if (e.target && e.target.id === 'pModal') pModalClose(); });
document.addEventListener('submit', e => { if (e.target.id === 'saleForm') { e.preventDefault(); saleSubmit(); return; } if (e.target.id === 'pinForm') { e.preventDefault(); doLogin(); } if (e.target.id === 'msgForm') { e.preventDefault(); sendMsg(); } });
document.addEventListener('keydown', e => {
  if (e.target && e.target.id === 'msgText' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(); return; }
  if (e.key === 'Escape' && (P2.id || P2.add) && !S.lb && !S.edit) { pModalClose(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.pcard')) { e.preventDefault(); pModalOpen(e.target.dataset.popen); return; }
  if (e.key === 'Escape' && $('#duePanel') && !S.lb && !S.edit) { closeDue(); return; }
  if (e.key === 'Escape' && M.open && !S.lb) { closeMsgPanel(); return; }
  if (e.target && e.target.id === 'adminName' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); if (S.login.pin.length >= 4) doLogin(); else { const k = $('.keypad'); if (k) { k.classList.remove('nudge'); void k.offsetWidth; k.classList.add('nudge'); } } return; }
  if (S.lb) { if (e.key === 'Escape') return closeLightbox(); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { S.lb.i += e.key === 'ArrowRight' ? 1 : -1; return drawLightbox(); } }
  if (e.key === 'Escape' && S.edit) closeEditor();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.card,.row') ) { e.preventDefault(); openEditor(e.target.dataset.open); }
  if (e.key === 'n' && S.screen === 'app' && !S.edit && !P2.id && !P2.add && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (S.view === 'prod') { if (canProd()) pAddOpen(); } else if (!isProdRole()) openEditor(null); }
});
$('#scrim').addEventListener('click', closeEditor);

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'msgText') { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; return; }
  if (t.id === 'adminName') { S.login.adminName = t.value; const w = t.closest('.name-in'); if (w) { w.classList.toggle('has', !!t.value.trim()); w.classList.remove('typing'); void w.offsetWidth; w.classList.add('typing'); } return; }
  if (t.id === 'pinIn') { S.login.pin = t.value.replace(/\D/g, '').slice(0, 6); S.login.err = ''; const dots = document.querySelectorAll('.pin-dots i'); dots.forEach((el, i) => el.classList.toggle('on', i < S.login.pin.length)); const sb = document.querySelector('#pinForm [type=submit]'); if (sb) sb.disabled = S.login.pin.length < 4; return; }
  if (t.id === 'pq' || t.id === 'cq') { S[t.id] = t.value; const pos = t.selectionStart, id = t.id; render(); const q = $('#' + id); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } return; }
  if (t.id === 'q') { S.f.q = t.value; const pos = t.selectionStart; render(); const q = $('#q'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} } return; }
  if ((t.id === 'thC1' || t.id === 'thC2') && $('#thC1') && $('#thC2')) { // live preview while dragging the picker
    document.documentElement.style.setProperty('--brand', $('#thC1').value); document.documentElement.style.setProperty('--brand-2', $('#thC2').value); return;
  }
  if (t.dataset.d && S.draft) {
    const v = t.type === 'checkbox' ? t.checked : t.value;
    const path = t.dataset.d; const old = path.split('.');
    // renaming a group must carry its SLA row
    if (old[0] === 'groups') { const prev = S.draft.groups[+old[1]]; if (S.draft.sla[prev]) { S.draft.sla[v] = S.draft.sla[prev]; if (prev !== v) delete S.draft.sla[prev]; } }
    setPath(S.draft, path, v); markDirty();
    if (path === 'accent') document.documentElement.style.setProperty('--brand', v);
    return;
  }
  if (t.id === 'eCmt' && S.edit) { S.edit.firstCmt = t.value; return; }
  if (t.dataset.cltplf !== undefined && S.draft) { S.draft.checklists = Object.assign({}, S.draft.checklists || {}); S.draft.checklists[t.dataset.cltplf] = t.value; markDirty(); return; }
  if (t.dataset.sla && S.draft) { const p = t.dataset.sla.split('|'), g = S.draft.groups[+p[0]]; const r = (S.draft.sla[g] = S.draft.sla[g] || { cam: [1, 2], draw: [2, 3] }); r[p[1]][+p[2]] = Math.max(0, +t.value || 0); markDirty(); return; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.dueahead) { LS.set('dueAhead', +t.value); LS.set('dueSeen:' + S.me, {}); renderDue(); return render(); }
  if (t.dataset && t.dataset.dueday === 'pick' && t.value) { S.dueDay = t.value; return renderDue(); }
  if (t.dataset && t.dataset.grange) { const cur = ganttRange(); S.gr = t.value === 'custom' ? { p: 'custom', from: cur.from || addDays(today(), -14), to: cur.to || addDays(today(), 14) } : { p: t.value }; LS.set('ganttRange', S.gr); return render(); }
  if (t.dataset && (t.dataset.gfrom || t.dataset.gto) && t.value) { const cur = ganttRange(); S.gr = { p: 'custom', from: t.dataset.gfrom ? t.value : cur.from, to: t.dataset.gto ? t.value : cur.to }; LS.set('ganttRange', S.gr); return render(); }
  if (t.dataset && t.dataset.act === 'ganttdone') { S.ganttDone = t.checked; LS.set('ganttDone', t.checked); return render(); }
  if (t.id === 'fMember') { S.f.member = t.value; LS.set('fMember', t.value); return render(); }
  if (t.id === 'fGroup') { S.f.group = t.value; return render(); }
  if (t.id === 'helpTopic' && t.value) { const x = $('#msgText'); if (x) { x.value = t.value + (x.value ? ' — ' + x.value : ''); x.focus(); } t.value = ''; return; }
  if (t.id === 'fMonth') { S.f.month = t.value; return render(); }
  if ((t.id === 'hFrom' || t.id === 'hTo') && t.value) { homeRange(); S.hr.preset = 'custom'; S.hr[t.id === 'hFrom' ? 'from' : 'to'] = t.value; homeRange(); saveHomeRange(); return render(); }
  if (t.id === 'thC1' || t.id === 'thC2') { setTheme({ preset: 'custom', c1: $('#thC1').value, c2: $('#thC2').value }); return render(); }
  if (/^r(From|To|Member|Group|Scope|Orient)$/.test(t.id)) {
    const r = reportState(), k = t.id.slice(1).toLowerCase();
    if (k === 'from' || k === 'to') { if (!t.value) return render(); r[k] = t.value; r.preset = 'custom'; if (r.from > r.to) { if (k === 'from') r.to = r.from; else r.from = r.to; } }
    else r[k] = t.value;
    if (k === 'orient') setPageOrient(r.orient);
    saveReportState(); return render();
  }
  if (t.dataset.rsec) { reportState().sec[t.dataset.rsec] = t.checked; saveReportState(); return render(); }
  if (t.id === 'logoIn' && t.files && t.files[0]) return readLogo(t.files[0]);
  if (t.id === 'bgIn' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; shrinkImage(f, 1920, 900000, 0.82).then(d => { try { localStorage.setItem('kiwngan:bgimg', d); } catch (x) { return toast('รูปใหญ่เกินไปสำหรับเครื่องนี้ ลองรูปอื่น', true); } applyTheme(); toast('ตั้งรูปพื้นหลังแล้ว'); render(); }).catch(e => toast(e.message, true)); return; }
  if (t.dataset.photofor && t.files && t.files[0]) return setPhoto(t.dataset.photofor, t.files[0]);
  if (t.id === 'eImgIn' && t.files && t.files.length) { const f = Array.from(t.files); t.value = ''; return addEditorFiles(f); }
  if (t.dataset.pfile && t.files && t.files.length) { const f = Array.from(t.files); t.value = ''; return addPendingFiles(f); }
  if (t.dataset.filejob && t.files && t.files.length) { const f = Array.from(t.files); t.value = ''; return uploadFiles(t.dataset.filejob, f); }
  if (t.dataset.imgjob && t.files && t.files.length) { const f = Array.from(t.files); t.value = ''; return uploadImages(t.dataset.imgjob, f); }
  if (S.edit && t.closest('#sheetBody') && t.dataset.e) {
    readEditor();
    if (['group', 'taskType', 'received'].indexOf(t.dataset.e) >= 0) autoDue();
    if (t.dataset.e === 'due') S.edit.dueTouched = true;
    if (['group', 'taskType', 'received', 'due'].indexOf(t.dataset.e) >= 0) renderEditor();
  }
});
function autoDue() { const E = S.edit; if (!E || E.dueTouched) return; const sg = suggestDue(E.job); if (sg) E.job.due = sg.date; }

document.addEventListener('mousedown', e => { if (M.emoji && !(e.target.closest && e.target.closest('#emoPop,#emoBtn'))) emoToggle(false); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && M.emoji) { emoToggle(false); e.stopPropagation(); } }, true);
document.addEventListener('keydown', e => {
  const t = e.target; if (!t || !t.id) return;
  if (t.id === 'cmtText' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendCmt(); }
  else if (t.id === 'nclNew' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const b = document.querySelector('[data-act="ncladd"]'); if (b) b.click(); }
  else if (t.id === 'clNew' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const b = document.querySelector('[data-act="cladd"]'); if (b) b.click(); }
  else if ((t.id === 'holD' || t.id === 'holN') && e.key === 'Enter') { e.preventDefault(); const b = document.querySelector('[data-act="holadd"]'); if (b) b.click(); }
});
/* ลากไฟล์รูปลงหน้าเพิ่ม/แก้ไขงาน (หรือลงหน้ารายละเอียดงาน) */
const hasFiles = e => { const dt = e.dataTransfer; return !!dt && Array.from(dt.types || []).indexOf('Files') >= 0; };
document.addEventListener('dragover', e => {
  if (!hasFiles(e) || !S.edit) return;
  const sh = e.target.closest && e.target.closest('#sheet'); if (!sh) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; sh.classList.add('file-over');
  const dz = $('#eDrop'); if (dz) dz.classList.add('over');
});
document.addEventListener('dragleave', e => { const sh = $('#sheet'); if (sh && (!e.relatedTarget || !sh.contains(e.relatedTarget))) { sh.classList.remove('file-over'); const dz = $('#eDrop'); if (dz) dz.classList.remove('over'); } });
document.addEventListener('drop', e => {
  if (!hasFiles(e) || !S.edit) return;
  const sh = e.target.closest && e.target.closest('#sheet'); if (!sh) return;
  e.preventDefault(); sh.classList.remove('file-over');
  const E = S.edit, live = E.isNew ? null : jobById(E.job.id);
  const all = Array.from(e.dataTransfer.files || []), toFiles = e.target.closest('.fdrop') ? all : all.filter(f => !/^image\//.test(f.type));
  if (toFiles.length) { if (E.isNew) { addPendingFiles(toFiles); if (all.length === toFiles.length) return; } else { if (!canEdit(live)) return toast('แนบไฟล์ได้เฉพาะงานของตัวเอง', true); uploadFiles(live.id, toFiles); } }
  const imgs = all.filter(f => toFiles.indexOf(f) < 0); if (!imgs.length) return;
  if (!E.isNew && !canAddImg(live)) return toast('เพิ่มรูปได้เฉพาะงานของตัวเอง', true);
  addEditorFiles(imgs);
});
document.addEventListener('paste', e => {
  if (!S.edit || !$('#sheet').classList.contains('open')) return;
  { const mp = $('#msgPanel'); if (mp && M.open && (mp.contains(e.target) || mp.contains(document.activeElement))) return; }
  const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  const E = S.edit, live = E.isNew ? null : jobById(E.job.id);
  if (!E.isNew && !canAddImg(live)) return;
  e.preventDefault(); addEditorFiles(files);
});
/* ============ คำแนะนำตอนพิมพ์ (autocomplete) ============
   พิมพ์ตัวแรกในช่องที่รองรับ → ขึ้นข้อความเดิมที่เคยใช้ให้เลือก · ↑↓ เลือก, Enter/Tab ใช้, Esc ปิด */
const HIST_MAX = 60;
function histGet(k) { const v = LS.get('hist:' + k, []); return Array.isArray(v) ? v : []; }
function histPush(k, v) { v = String(v || '').trim(); if (!v || v.length > 300) return; LS.set('hist:' + k, [v].concat(histGet(k).filter(x => x !== v)).slice(0, HIST_MAX)); }
const SUGG_HIST = { 'e-title': 'title', 'e-note': 'note', 'e-code': 'code', 'adminName': 'adminName', 'msgText': 'msg', 'q': 'search' };
function suggStrings(lists) {
  const seen = {}, out = [];
  lists.forEach(list => (list || []).forEach(v => { v = String(v || '').trim(); const k = v.toLowerCase(); if (v && !seen[k]) { seen[k] = 1; out.push({ v: v }); } }));
  return out;
}
const byRecent = arr => arr.slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
function suggSource(id) {
  const jobs = byRecent(S.jobs || []).filter(j => !j.pending);
  switch (id) {
    case 'e-code': {
      const map = {}; jobs.forEach(j => { const k = String(j.code).toLowerCase(); (map[k] = map[k] || []).push(j); });
      return Object.keys(map).map(k => { const js = map[k]; return { v: js[0].code, sub: [js[0].title].concat(js.map(j => j.taskType)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · '), jobs: js }; });
    }
    case 'e-title': return suggStrings([histGet('title'), jobs.map(j => j.title)]);
    case 'e-note': return suggStrings([histGet('note'), jobs.map(j => j.note)]);
    case 'msgText': return M.help ? [] : suggStrings([histGet('msg')]);
    case 'q': return suggStrings([histGet('search'), jobs.map(j => j.code), jobs.map(j => j.title)]);
    case 'adminName': return suggStrings([histGet('adminName')]);
  }
  return null;
}
const SG = { id: '', items: [], idx: -1 };
function suggMatch(list, q) {
  q = q.trim().toLowerCase(); if (!q) return [];
  const a = [], b = [], c = [];
  list.forEach(it => {
    const v = it.v.toLowerCase(); if (v === q) return;
    if (v.indexOf(q) === 0) a.push(it); else if (v.split(/[\s\-_/·,()]+/).some(w => w.indexOf(q) === 0)) b.push(it); else if (q.length > 1 && v.indexOf(q) >= 0) c.push(it);
  });
  return a.concat(b, c).slice(0, 8);
}
function suggClose() { SG.id = ''; SG.items = []; SG.idx = -1; const b = $('#suggBox'); if (b) b.hidden = true; }
function suggOpen(el) {
  const src = suggSource(el.id); if (!src) return suggClose();
  const q = el.tagName === 'TEXTAREA' && el.id !== 'msgText' ? el.value : el.value;
  const items = suggMatch(src, q);
  if (!items.length || el.disabled || el.readOnly) return suggClose();
  SG.id = el.id; SG.items = items; if (SG.idx >= items.length) SG.idx = -1;
  let b = $('#suggBox'); if (!b) { b = document.createElement('div'); b.id = 'suggBox'; b.className = 'sugg'; b.setAttribute('role', 'listbox'); document.body.appendChild(b); }
  const qq = q.trim().toLowerCase();
  const hl = v => { const i = v.toLowerCase().indexOf(qq); return i < 0 ? esc(v) : esc(v.slice(0, i)) + '<b>' + esc(v.slice(i, i + qq.length)) + '</b>' + esc(v.slice(i + qq.length)); };
  b.innerHTML = '<div class="sugg-h">ข้อความที่เคยใช้</div>' + items.map((it, i) => '<button type="button" class="sugg-it' + (i === SG.idx ? ' on' : '') + '" data-sg="' + i + '" role="option"><span>' + hl(it.v) + '</span>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</button>').join('');
  const r = el.getBoundingClientRect(), vh = window.innerHeight;
  b.hidden = false; b.style.width = Math.max(220, r.width) + 'px';
  b.style.left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(220, r.width) - 8)) + 'px';
  const h = b.offsetHeight, below = vh - r.bottom;
  b.style.top = (below < h + 12 && r.top > h + 12 ? r.top - h - 4 : r.bottom + 4) + 'px';
}
function suggPick(i) {
  const it = SG.items[i], el = $('#' + SG.id); if (!it || !el) return suggClose();
  const id = SG.id; suggClose();
  if (id === 'e-code' && S.edit && S.edit.isNew && it.jobs) {   // เลือกเลข Job เดิม → ดึงข้อมูลงานเดิมมาให้ (เช่น ต่อ CAM จากงาน CAD)
    readEditor(); const j = S.edit.job, src = it.jobs[0];
    j.code = it.v; ['title', 'group', 'sale', 'qty', 'level'].forEach(k => { if (src[k] !== undefined && src[k] !== '') j[k] = src[k]; });
    if (!it.jobs.some(x => isCam(x))) { const cam = (S.settings.taskTypes || []).find(t => t.cat === 'cam'); if (cam) j.taskType = cam.name; }
    autoDue(); renderEditor(); const n = $('#e-title'); if (n) n.focus();
    return toast('ดึงข้อมูลจากงานเดิม ' + it.v + (isCam(j) ? ' · ตั้งเป็น ' + j.taskType : ''));
  }
  el.value = it.v; el.focus(); try { el.setSelectionRange(it.v.length, it.v.length); } catch (x) {}
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}
document.addEventListener('input', e => { const t = e.target; if (!t || !t.id || !(t.id in SUGG_HIST)) return; SG.idx = -1; const cur = $('#' + t.id) || t; if (document.activeElement === cur) suggOpen(cur); });
document.addEventListener('focusin', e => { const t = e.target; if (t && t.id in SUGG_HIST && t.value) suggOpen(t); else if (SG.id && (!t || t.id !== SG.id)) suggClose(); });
document.addEventListener('focusout', e => { if (e.target && e.target.id === SG.id) setTimeout(() => { const a = document.activeElement; if (!a || a.id !== SG.id) suggClose(); }, 120); });
document.addEventListener('mousedown', e => { const b = e.target.closest && e.target.closest('[data-sg]'); if (b) { e.preventDefault(); suggPick(+b.dataset.sg); } }, true);
document.addEventListener('keydown', e => {
  if (!SG.id || !SG.items.length || !e.target || e.target.id !== SG.id) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); SG.idx = (SG.idx + (e.key === 'ArrowDown' ? 1 : -1) + SG.items.length + 1) % (SG.items.length + 1); if (SG.idx === SG.items.length) SG.idx = -1; return suggOpen(e.target); }
  if ((e.key === 'Enter' || e.key === 'Tab') && SG.idx >= 0 && !e.isComposing) { e.preventDefault(); e.stopImmediatePropagation(); return suggPick(SG.idx); }
  if (e.key === 'Escape') { e.stopImmediatePropagation(); suggClose(); }
}, true);
document.addEventListener('change', e => { const t = e.target; if (t && SUGG_HIST[t.id] && t.id !== 'msgText' && t.id !== 'e-code') histPush(SUGG_HIST[t.id], t.value); });
window.addEventListener('resize', suggClose);
document.addEventListener('scroll', e => { if (SG.id && !(e.target.closest && e.target.closest('#suggBox'))) { const el = $('#' + SG.id); if (el && document.activeElement === el) suggOpen(el); else suggClose(); } }, true);

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
  d.taskTypes.forEach((t, i) => { if (!/^#[0-9a-f]{6}$/i.test(t.color || '')) t.color = TYPE_COLORS[i % TYPE_COLORS.length]; });
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
  if (S.screen === 'app' && mode() === 'sheet' && document.visibilityState === 'visible' && !S.edit && !S.draftDirty && !S.saving && S.sync !== 'busy') load(true);
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (S.screen === 'app' && document.visibilityState === 'visible' && mode() === 'sheet' && Date.now() - S.lastSync > 30000 && !S.edit && !S.saving) load(true);
});

/* ============ PWA ============ */
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|usercontent/.test(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    // look for a new version whenever the app comes back to the foreground
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {}));
  // a new version took over: reload once so the page runs the new code (not while typing in the editor)
  let reloaded = !navigator.serviceWorker.controller; // first visit: nothing old to replace
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return; reloaded = true;
    if (S.edit || S.draftDirty) { toast('มีเวอร์ชันใหม่ รีเฟรชหน้าเว็บหลังบันทึกงาน'); return; }
    location.reload();
  });
}

/* ============ boot ============ */
(function readApiParam() {
  try {
    const u = new URL(location.href), api = u.searchParams.get('api');
    if (api && /^https:\/\/script\.google\.com\//.test(api)) { S.conn = { url: api }; LS.set('conn', S.conn); }
    if (api) { u.searchParams.delete('api'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  } catch (e) {}
})();
try { applyTheme(); } catch (e) {}
window.KiwNgan = { S: S, M: M, R: R, V: V, pollMessages: pollMessages, seedDemo: seedDemo, suggestDue: suggestDue, addWorkDays: addWorkDays, version: APP_VERSION, renderPeek: renderPeek, rtcDc: rtcDc };
if (SALE_Q) { salePage(); } else {
if (mode() === 'sheet') ibStart(LS.get('rtpub', null));   // เปิดกล่องรับคำตอบไว้ก่อน ระหว่างรอ bootstrap ครั้งแรก
load(false);
}
})();
