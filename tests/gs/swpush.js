// service worker: ช่องด่วนเด้งทันที + เรียกซ้ำ · ปัดทิ้งแล้วหยุด · เซิร์ฟเวอร์ช้าเด้งก่อนภายใน 2.5 วิ
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
function load(scope, infoDelay, info) {
  const shown = [], L = {}, t0 = Date.now(); let open = {};
  const reg = { scope, showNotification: (t, o) => { shown.push({ t, tag: o.tag, at: Date.now() - t0, vib: o.vibrate, ri: o.requireInteraction }); open[o.tag] = { tag: o.tag, close() { delete open[o.tag]; } }; return Promise.resolve(); },
    getNotifications: q => Promise.resolve(open[q.tag] ? [open[q.tag]] : []) };
  const self = { registration: reg, addEventListener: (k, f) => { L[k] = f; }, clients: { matchAll: () => Promise.resolve([]), claim() {} }, skipWaiting() {} };
  const caches = { open: () => Promise.resolve({ match: () => Promise.resolve({ json: () => Promise.resolve({ api: 'x', token: 't' }) }) }) };
  const fetch = () => new Promise(r => setTimeout(() => r({ json: () => Promise.resolve({ ok: true, data: { info } }) }), infoDelay));
  new Function('self', 'caches', 'fetch', 'location', src)(self, caches, fetch, { origin: 'https://x' });
  return { shown, L, open, fire: k => new Promise(res => L[k]({ waitUntil: p => p.then(res) })), t0 };
}
(async () => {
  // ช่องด่วน: แสดงก่อนข้อมูลมา · เรียกซ้ำ
  let w = load('https://x/app/ring/', 1500, { kind: 'call', from: 'บอส' });
  const p1 = w.fire('push'); await new Promise(r => setTimeout(r, 50));
  eq('ring channel shows instantly', [w.shown.length, w.shown[0] && w.shown[0].at < 50, w.shown[0] && w.shown[0].ri], [1, true, true]);
  await new Promise(r => setTimeout(r, 9000));
  eq('then caller name + repeats', [w.shown.some(s => /บอส/.test(s.t)), w.shown.length >= 3], [true, true]);
  w.open['kiwngan-ring'] && w.open['kiwngan-ring'].close(); w.L.notificationclose({ notification: { tag: 'kiwngan-ring' } });
  const n = w.shown.length; await new Promise(r => setTimeout(r, 4500));
  eq('dismiss stops ringing', w.shown.length, n);
  // ปกติ แต่เซิร์ฟเวอร์ช้า: เด้งก่อนภายใน 2.5 วิ แล้วแทนที่
  w = load('https://x/app/', 4000, { kind: 'assign', from: 'บอส', code: 'J1', title: 'งาน' });
  const p2 = w.fire('push'); await new Promise(r => setTimeout(r, 2700));
  eq('slow server: placeholder within 2.5s', [w.shown.length, w.shown[0] && w.shown[0].tag], [1, 'kiwngan-pending']);
  await p2;
  eq('placeholder replaced by real notice', [w.shown.length, /งานใหม่/.test(w.shown[1].t), !!w.open['kiwngan-pending']], [2, true, false]);
  // ปกติ เซิร์ฟเวอร์เร็ว: ไม่มีตัวกั้น
  w = load('https://x/app/', 300, { kind: 'kb', from: 'บอส', title: 'เรื่องใหม่', code: 'ฝ่ายผลิต' });
  await w.fire('push');
  eq('fast server: single real notice', [w.shown.length, /ความรู้ใหม่/.test(w.shown[0].t)], [1, true]);
  console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
})();
