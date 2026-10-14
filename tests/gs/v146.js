// 1.46.0: แจ้งเตือนสินค้า Express ใกล้หมด — ค่ารวม '*' ทุกรายการ + ตั้งเฉพาะรายการ · เฝ้าทุกชั่วโมง → เด้งฝ่ายสต็อก
const path = require('path'), fs = require('fs'), os = require('os');
const src = fs.readFileSync(path.join(__dirname, '../../backend/Code.gs'), 'utf8').replace("const RT_URL = '';", "const RT_URL = 'https://rt.test';").replace("const RT_KEY = '';", "const RT_KEY = 'k';").replace(/const EX_TOK = '';/, "const EX_TOK = 'tok';");
const tmp = path.join(os.tmpdir(), 'code146.gs'); fs.writeFileSync(tmp, src); process.argv[2] = tmp;
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const ST = mk('สต็อก1', 'stock', '4444'), D = mk('ดีไซน์', 'user', '1111');
// Supabase จำลอง: ex_low ใช้ค่ารวม '*' กับตัวที่มียอด + ตัวที่ตั้งเฉพาะ
let ITEMS = [['A', 'กาว', 5, 'ชิ้น'], ['B', 'สกรู', 2, 'ตัว'], ['C', 'สี', 0, 'ถัง'], ['D', 'ไม้', 1, 'แผ่น']], lowBody = null;
global.UrlFetchApp.fetch = (url, o) => { if (/ex_low/.test(url)) { const mins = JSON.parse(o.payload).mins; lowBody = mins; const g = +mins['*'] || 0;
  const out = ITEMS.filter(i => mins[i[0]] ? i[2] <= mins[i[0]] : g > 0 && i[2] > 1e-9 && i[2] <= g).map(i => [i[0], i[1], i[2], i[3], mins[i[0]] || g]);
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify(out) }; } return { getResponseCode: () => 200, getContentText: () => '{}' }; };
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x';
let sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(reqs.map(r => r.url)); return reqs.map(() => ({ getResponseCode: () => 201 })); };
[[ST, 's'], [D, 'd']].forEach(([t, k]) => m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/' + k } }, t));
const who = () => sent.flat().map(u => u.split('/').pop()).sort();
const info = n => JSON.parse(m.cacheStore['pinfo:' + n] || '{}');
// ฝ่ายอื่นตั้งไม่ได้
eq('non-stock cannot set', m.call('exMinSet', { items: [{ cod: '*', min: '2' }] }, D).ok, false);
// ตั้งทุกรายการ ≤ 2 + เฉพาะ A ≤ 3 ในครั้งเดียว
const r = m.call('exMinSet', { items: [{ cod: '*', min: '2' }, { cod: 'A', min: '3' }] }, ST);
eq('saved global + own', r.data.exMins, { '*': 2, A: 3 });
eq('bootstrap carries mins', m.call('bootstrap', {}, ST).data.ex.mins, { '*': 2, A: 3 });
// รอบแรกหลังตั้ง: จำไว้เฉย ๆ ไม่เด้ง
sent = []; m.ctx.exLowWatch_(); eq('first run → no push (baseline)', who(), []);
eq('global sent to ex_low', lowBody['*'], 2);
// A ลดเหลือ 3 (ถึงจุดเฉพาะ) → เด้งฝ่ายสต็อก
ITEMS[0][2] = 3; sent = []; m.ctx.digestTick(); eq('fresh low → stock pushed', who(), ['s']);
eq('push data', [info('สต็อก1').kind, info('สต็อก1').count, /กาว/.test(info('สต็อก1').title)], ['exlow', 1, true]);
// รอบถัดไปไม่เปลี่ยน → ไม่เด้งซ้ำ
sent = []; m.ctx.exLowWatch_(); eq('no repeat', who(), []);
// ยอด 0 (C) ไม่นับตามค่ารวม · ยกเลิกค่ารวม → เหลือเฉพาะ A
m.call('exMinSet', { items: [{ cod: '*', min: '' }] }, ST);
eq('global cleared', m.call('bootstrap', {}, ST).data.ex.mins, { A: 3 });
sent = []; m.ctx.exLowWatch_(); eq('after change → baseline again, no blast', who(), []);
console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
