// KiwNgan service worker: app shell offline, data always from the network
const CACHE = 'kiwngan-v2.40.0';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
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
  due: (f, i) => ['⏳ งานใกล้ถึงกำหนด ' + (i.count || '') + ' งาน', (i.late ? 'เลยกำหนดแล้ว ' + i.late + ' งาน · ' : '') + (i.code || '')]
};
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let info = null;
    try {
      const m = await (await caches.open('kiwngan-meta')).match('/__meta');
      if (m) {
        const meta = await m.json();
        const r = await fetch(meta.api, { method: 'POST', body: JSON.stringify({ token: meta.token, action: 'pushInfo', payload: {} }), redirect: 'follow' });
        const j = await r.json(); info = j && j.ok && j.data ? j.data.info : null;
      }
    } catch (x) { info = null; }
    const k = info && PUSH_TEXT[info.kind] ? info.kind : 'call', t = PUSH_TEXT[k](info && info.from ? info.from : 'มีคน', info || {});
    await self.registration.showNotification(t[0], {
      body: t[1], tag: 'kiwngan-' + k + (info && info.code ? '-' + info.code : ''), renotify: true, requireInteraction: k === 'call',
      vibrate: k === 'call' ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200],
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './?from=push#' + k }
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) return c.focus(); }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});
