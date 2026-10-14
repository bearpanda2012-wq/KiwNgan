// 1.45.0: แจ้งเตือนฝ่ายผลิตเมื่องานใหม่เข้า "รอผลิต" · แจ้งฝ่ายสต็อกเมื่องานเข้า "พร้อมส่ง"
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const D = mk('ดีไซน์', 'user', '1111'), P1 = mk('ผลิต1', 'prod', '2222'), P2 = mk('ผลิต2', 'prod', '3333'), ST = mk('สต็อก1', 'stock', '4444');
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x';
let sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(reqs.map(r => r.url)); return reqs.map(() => ({ getResponseCode: () => 201 })); };
[[D, 'd'], [P1, 'p1'], [P2, 'p2'], [ST, 's'], [A, 'a']].forEach(([t, k]) => m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/' + k } }, t));
const who = () => sent.flat().map(u => u.split('/').pop()).sort();
const info = n => JSON.parse(m.cacheStore['pinfo:' + n] || '{}');
// งานออกแบบ (ทำ CAM) เสร็จ → เข้ารอผลิต → แจ้งฝ่ายผลิตทุกคน (ไม่รวมแอดมิน/ดีไซน์/สต็อก)
let j = m.call('saveJob', { job: { code: 'R69-500', title: 'ป้ายหน้าร้าน', taskType: 'ทำ CAM', status: 'doing', priority: 'urgent', assignee: 'ดีไซน์' } }, A).data.job;
sent = [];
m.call('saveJob', { job: Object.assign({}, j, { status: 'done', baseUpdatedAt: j.updatedAt }) }, D);
eq('design done → prod users notified', who(), ['p1', 'p2']);
eq('push text data', [info('ผลิต1').kind, info('ผลิต1').code, info('ผลิต1').title, info('ผลิต1').count], ['prodnew', 'R69-500', 'ป้ายหน้าร้าน', 1]);
// เพิ่มงานรอผลิตเอง (ฝ่ายผลิต) → แจ้งคนอื่นในฝ่ายผลิต ไม่แจ้งคนกด
sent = [];
const pr = m.call('prodSave', { prod: { code: 'R69-501', title: 'ตัวอักษร' } }, P1).data.prod;
eq('manual add → other prod user only', who(), ['p2']);
// เดินขั้น (ไม่ใช่พร้อมส่ง) → ไม่แจ้ง
sent = [];
let cur = m.call('prodSave', { prod: { id: pr.id, baseUpdatedAt: pr.updatedAt, stage: 'paint' } }, P1).data.prod;
eq('other stage change → no push', who(), []);
// เข้า "พร้อมส่ง" → แจ้งฝ่ายสต็อก
cur = m.call('prodSave', { prod: { id: pr.id, baseUpdatedAt: cur.updatedAt, stage: 'ready', qc: { it: [], res: 'pass' } } }, P1).data.prod;
eq('ready → stock notified', who(), ['s']);
eq('ready push data', [info('สต็อก1').kind, info('สต็อก1').code], ['prodready', 'R69-501']);
// สต็อกกดส่งแล้ว แล้วย้อนกลับเป็นพร้อมส่ง → ไม่แจ้งซ้ำ
sent = [];
cur = m.call('prodSave', { prod: { id: pr.id, baseUpdatedAt: cur.updatedAt, stage: 'shipped' } }, ST).data.prod;
cur = m.call('prodSave', { prod: { id: pr.id, baseUpdatedAt: cur.updatedAt, stage: 'ready' } }, ST).data.prod;
eq('undo shipped → no re-notify', who(), []);
console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
