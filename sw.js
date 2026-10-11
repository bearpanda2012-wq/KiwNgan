// KiwNgan service worker: app shell offline, data always from the network
const CACHE = 'kiwngan-v2.76.1';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

/* ตัวนี้ลงทะเบียน 2 ที่: ที่หลัก (แอป) และ ./ring/ (ช่องด่วน: push ที่มาทางนี้คือสายเรียกเข้า/ขอดูจอแน่นอน เด้งได้ทันที) */
const RING = /\/ring\/$/.test(self.registration.scope);
const APP = RING ? new URL('../', self.registration.scope).href : self.registration.scope;
self.addEventListener('install', e => {
  if (RING) { e.waitUntil(self.skipWaiting()); return; }
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (RING) return;
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API and fonts go straight to the network
  // network first so updates show up immediately; fall back to cache when offline
  e.respondWith(
    // no-cache: always revalidate with GitHub Pages instead of using the browser's 10-minute HTTP cache
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

/* ---------- push: สายเรียกเข้า / ขอดูจอ (เด้งแม้ปิดแอป) ----------
   push มาแบบไม่มีเนื้อหา → ถามเซิร์ฟเวอร์ว่าใครเรียก แล้วแสดงการแจ้งเตือนทุกครั้ง */
const PUSH_TEXT = {
  call: f => ['📞 ' + f + ' กำลังโทรหาคุณ', 'แตะเพื่อเปิดแอปแล้วกด "รับสาย"'],
  remote: f => ['🖱️ ' + f + ' ขอรีโมทหน้าจอของคุณ', 'แตะเพื่อเปิดแอปแล้วตอบรับ'],
  view: f => ['🖥️ ' + f + ' ขอดูหน้าจอของคุณ', 'แตะเพื่อเปิดแอปแล้วตอบรับ'],
  share: f => ['🖥️ ' + f + ' ต้องการแชร์หน้าจอให้คุณดู', 'แตะเพื่อเปิดดู'],
  assign: (f, i) => ['📋 งานใหม่มอบหมายให้คุณ · ' + (i.code || ''), (i.title ? i.title + ' · ' : '') + 'จาก ' + f],
  cmt: (f, i) => ['💬 ' + f + ' คอมเมนต์ในงาน ' + (i.code || ''), i.title || ''],
  help: (f, i) => ['🤝 ' + f + ' ชวนคุณร่วมทำงาน · ' + (i.code || ''), (i.title || '') + ' — แตะเพื่อเปิดดูงาน'],
  fix: (f, i) => ['🔧 ถูกส่งกลับไปแก้ไข · ' + (i.code || ''), (i.title ? i.title + ' · ' : '') + f + ' ส่งกลับมา'],
  msg: (f, i) => ['💬 ' + f + (i.team ? ' ถึงทั้งทีม' : ' ส่งข้อความถึงคุณ'), i.title || 'แตะเพื่อเปิดอ่าน'],
  sos: (f, i) => ['🛟 ' + f + ' ขอความช่วยเหลือ', i.title || 'แตะเพื่อเปิดดู'],
  due: (f, i) => ['⏳ งานใกล้ถึงกำหนด ' + (i.count || '') + ' งาน', (i.late ? 'เลยกำหนดแล้ว ' + i.late + ' งาน · ' : '') + (i.code || '')],
  low: (f, i) => ['📦 ' + (i.title || 'วัสดุ') + ' ใกล้หมด', 'เหลือ ' + (i.code || '') + ' · ถึงจุดสั่งซื้อแล้ว (' + f + ' เบิกล่าสุด)'],
  nostock: (f, i) => ['🚫 ' + (i.title || 'วัสดุ') + ' หมดสต็อก', 'เหลือ 0 · ' + f + ' เบิกล่าสุด — ต้องสั่งเพิ่ม'],
  digest: (f, i) => [i.title || '☀️ สรุปงานเช้านี้', i.code || 'แตะเพื่อเปิดดูภาพรวมบริษัท'],
  kb: (f, i) => ['📘 ความรู้ใหม่' + (i.code ? ' · ' + i.code : '') + (i.count ? ' (สำคัญ)' : ''), (i.title || '') + ' — โดย ' + f]
};
/* ถามเซิร์ฟเวอร์ว่าใครเรียก/เรื่องอะไร (push ไม่มีเนื้อหา) · จำกัดเวลารอ ไม่ให้แจ้งเตือนช้า */
async function pushInfo(ms) {
  try {
    const m = await (await caches.open('kiwngan-meta')).match('/__meta'); if (!m) return null;
    const meta = await m.json(), ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), ms || 9000);
    const r = await fetch(meta.api, { method: 'POST', body: JSON.stringify({ token: meta.token, action: 'pushInfo', payload: {} }), redirect: 'follow', signal: ctl ? ctl.signal : undefined });
    clearTimeout(tm); const j = await r.json(); return j && j.ok && j.data ? j.data.info : null;
  } catch (x) { return null; }
}
const URGENT = { call: 1, view: 1, remote: 1, share: 1, sos: 1 };
const VIB = { call: [900, 350, 900, 350, 900, 350, 900, 350, 900], view: [600, 250, 600, 250, 600, 250, 600], remote: [600, 250, 600, 250, 600, 250, 600], share: [600, 250, 600, 250, 600], sos: [400, 150, 400, 150, 400, 150, 400, 150, 400] };
const STOP = {};   // แท็กที่ผู้ใช้กดหรือปัดทิ้งแล้ว → หยุดเรียกซ้ำ
const wait = ms => new Promise(r => setTimeout(r, ms));
const enc = encodeURIComponent;
/* ปลายทางเมื่อแตะแจ้งเตือน: แชท → ห้อง+ข้อความนั้น · งาน → เปิดงานเลข Job นั้น */
const urlOf = (k, i) => { i = i || {};
  const msgCh = i.team ? 'team' : i.from === 'ผู้ดูแลระบบ' ? 'admin' : i.code ? 'u:' + i.code : '';
  const h = k === 'msg' || k === 'sos' ? 'msg' + (i.mid || msgCh ? '/' + enc(i.mid || '') + '/' + enc(msgCh) + '/' + enc(i.code || '') : '')
    : (k === 'assign' || k === 'cmt' || k === 'help' || k === 'fix') && i.code ? 'job/' + enc(i.code)
    : k === 'low' || k === 'nostock' ? 'stock' : k === 'digest' ? 'digest' : k === 'due' ? 'home' : k === 'pend' ? 'push' : k;
  return APP + '?from=push#' + h; };
function notifOpts(k, info, extra) {
  return Object.assign({ body: '', tag: 'kiwngan-' + k + (info && info.code && k !== 'digest' ? '-' + info.code : ''), renotify: true, requireInteraction: !!URGENT[k], silent: false,
    vibrate: VIB[k] || [300, 120, 300], icon: APP + 'icons/icon-192.png', badge: APP + 'icons/icon-192.png', data: { url: urlOf(k, info), k: k } }, extra || {});
}
/* สายเรียกเข้า/ขอดูจอ: เด้งซ้ำทุก ~4 วินาที (มีเสียง+สั่นทุกครั้ง) จนกดรับ/ปัดทิ้ง หรือครบ ~25 วินาที — คล้ายเสียงเรียกเข้า */
async function ring(k, title, opts) {
  const tag = opts.tag; delete STOP[tag];
  for (let i = 0; i < 7; i++) {
    if (STOP[tag]) return;
    await self.registration.showNotification(title, Object.assign({}, opts, { renotify: true }));
    await wait(i === 0 ? 3500 : 4000);
    if (STOP[tag]) return;
    const still = await self.registration.getNotifications({ tag: tag });
    if (!still.length) return;   // ถูกปัดทิ้งไปแล้ว
  }
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    if (RING) {   // ช่องด่วน: แสดงทันที แล้วค่อยเติมชื่อคนโทร
      const pre = notifOpts('call', null, { tag: 'kiwngan-ring', body: 'แตะเพื่อเปิดแอปแล้วตอบรับ' });
      await self.registration.showNotification('📞 มีสายเรียกเข้า / ขอดูจอจาก KiwNgan', pre);
      const info = await pushInfo(8000), k = info && URGENT[info.kind] ? info.kind : 'call';
      const t = PUSH_TEXT[k](info && info.from ? info.from : 'มีคน', info || {});
      return ring(k, t[0], notifOpts(k, info, { tag: 'kiwngan-ring', body: t[1] }));
    }
    let info = null, late = false;
    const pend = setTimeout(() => { late = true; self.registration.showNotification('🔔 KiwNgan · มีการแจ้งเตือนใหม่', notifOpts('pend', null, { tag: 'kiwngan-pending', body: 'กำลังโหลดรายละเอียด… แตะเพื่อเปิดแอป', requireInteraction: false })); }, 2500);   // เซิร์ฟเวอร์ตอบช้า: เด้งก่อน แล้วค่อยแทนที่
    info = await pushInfo(15000); clearTimeout(pend);
    const k = info && PUSH_TEXT[info.kind] ? info.kind : (late ? '' : 'call');
    if (late) { (await self.registration.getNotifications({ tag: 'kiwngan-pending' })).forEach(n => n.close()); if (!k) return self.registration.showNotification('🔔 KiwNgan · มีการแจ้งเตือนใหม่', notifOpts('pend', null, { body: 'แตะเพื่อเปิดแอปดูรายละเอียด' })); }
    const t = PUSH_TEXT[k](info && info.from ? info.from : 'มีคน', info || {});
    if (k === 'msg' || k === 'sos') {   // แอปเปิดอยู่บนจอ: แอปเด้งแจ้งเตือน + เสียงเองแล้ว ไม่ต้องซ้ำ
      const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (cs.some(c => c.visibilityState === 'visible' && c.focused)) return;
    }
    const o = notifOpts(k, info, Object.assign({ body: t[1] }, late ? { tag: 'kiwngan-pending' } : {}));
    if (URGENT[k]) return ring(k, t[0], o);
    await self.registration.showNotification(t[0], o);
  })());
});
self.addEventListener('notificationclose', e => { STOP[e.notification.tag] = 1; });
self.addEventListener('notificationclick', e => {
  STOP[e.notification.tag] = 1; e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const url = (e.notification.data && e.notification.data.url) || '', hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#')) : '';
    const win = cs.find(c => c.url.indexOf(APP) === 0 && 'focus' in c) || cs.find(c => 'focus' in c && new URL(c.url).pathname === new URL(APP).pathname);
    if (win) { if (hash) win.postMessage({ kn: 'pushopen', hash: hash }); return win.focus(); }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || APP);
  }));
});
