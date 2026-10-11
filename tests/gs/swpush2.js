// v2.77.1: ไม่รู้ว่าเรื่องอะไร → ไม่เดาว่า "โทรหา" · ถามด้วย endpoint ของเครื่อง · Safari/iPhone แสดงครั้งเดียว (ไม่ซ้อนหลายรายการ)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
function load(o) {
  const shown = [], L = {}, asked = []; const open = {};
  const reg = { scope: 'https://x/app/', pushManager: { getSubscription: () => Promise.resolve({ endpoint: 'https://web.push.apple.com/QPhone' }) },
    showNotification: (t, op) => { shown.push({ t, tag: op.tag, body: op.body, url: op.data && op.data.url }); open[op.tag] = { close() { delete open[op.tag]; } }; return Promise.resolve(); },
    getNotifications: q => Promise.resolve(open[q.tag] ? [open[q.tag]] : []) };
  const self = { registration: reg, navigator: { userAgent: o.ua || 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36' }, addEventListener: (k, f) => { L[k] = f; }, clients: { matchAll: () => Promise.resolve([]), claim() {} }, skipWaiting() {} };
  const caches = { open: () => Promise.resolve({ match: () => Promise.resolve({ json: () => Promise.resolve({ api: 'x', token: 't' }) }) }) };
  const fetch = (u, req) => { const b = JSON.parse(req.body); asked.push([b.action, b.payload && b.payload.ep || '', b.token || '']); const info = o.info(b); return new Promise(r => setTimeout(() => r({ json: () => Promise.resolve({ ok: true, data: { info } }) }), o.delay || 50)); };
  new Function('self', 'caches', 'fetch', 'location', src)(self, caches, fetch, { origin: 'https://x' });
  return { shown, asked, fire: () => new Promise(res => L.push({ waitUntil: p => p.then(res) })) };
}
const DIG = { kind: 'digest', title: '☀️ สรุปงานเช้านี้ · อา. 11 ต.ค.', code: '🎨 ฝ่ายแบบ ค้าง 9 งาน\n🏭 ฝ่ายผลิต 7 งาน', count: 0 };
(async () => {
  let w = load({ info: () => null });
  await w.fire();
  eq('unknown push → one neutral notice, never "call"', [w.shown.length, /มีการแจ้งเตือนใหม่/.test(w.shown[0].t), w.shown.some(s => /โทร/.test(s.t)), /#push$/.test(w.shown[0].url)], [1, true, false, true]);
  w = load({ info: b => b.action === 'pushInfoEp' ? DIG : null });
  await w.fire();
  eq('asks by device endpoint first (no token)', w.asked[0], ['pushInfoEp', 'https://web.push.apple.com/QPhone', '']);
  eq('digest: one notice with summary, opens summary', [w.shown.length, w.shown[0].t, w.shown[0].body, /#digest$/.test(w.shown[0].url)], [1, DIG.title, DIG.code, true]);
  w = load({ info: b => b.action === 'pushInfo' ? DIG : null });
  await w.fire();
  eq('falls back to account lookup', [w.asked.map(a => a[0]), w.shown[0].t], [['pushInfoEp', 'pushInfo'], DIG.title]);
  const SAF = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  w = load({ ua: SAF, info: () => ({ kind: 'call', from: 'บอส' }) });
  await w.fire();
  eq('iPhone: real call shows once (no stacked repeats)', w.shown.length, 1);
  w = load({ ua: SAF, delay: 4000, info: () => DIG });
  await w.fire();
  eq('iPhone slow server: no placeholder, single digest', [w.shown.length, w.shown[0].t], [1, DIG.title]);
  console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})();
