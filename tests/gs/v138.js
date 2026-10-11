// 1.38.0: 1 เครื่อง = 1 แจ้งเตือน (เครื่องที่เคยสลับบัญชี) · ข้อมูล push ผูกกับเครื่อง (endpoint) · ส่งทดสอบสรุปเช้าถึงผู้รับที่เลือก
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return [m.call('login', { userId: r.user.id, pin: p }).data.token, r.user.id]; };
const [B, bid] = mk('หมี', 'user', '1111'), [C] = mk('ต้น', 'user', '2222');
const aid = m.call('bootstrap', {}, A).data.me.id;
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x'; m.cacheStore['vj:https://web.push.apple.com'] = 'vapid t=x';
const sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(...reqs.map(r => r.url)); return reqs.map(() => ({ getResponseCode: () => 201 })); };
const PHONE = 'https://web.push.apple.com/QPhone1', PC = 'https://fcm.googleapis.com/fcm/send/pc1', TON = 'https://fcm.googleapis.com/fcm/send/ton1';
// เครื่องข้อมูลเก่า: มือถือค้างอยู่ทั้งในบัญชีแอดมิน (เก่ากว่า) และบัญชีหมี (ใหม่กว่า)
m.props['PUSH_' + aid] = JSON.stringify([{ e: PC, t: 100 }, { e: PHONE, t: 200 }]);
m.props['PUSH_' + bid] = JSON.stringify([{ e: PHONE, t: 300 }]);
let r = m.call('digestTest', { send: true, to: ['หมี'] }, A).data;
eq('test send: me + chosen → each device once', [sent.slice().sort(), r.sent.devices, r.sent.ok], [[PC, PHONE].sort(), 2, 2]);
eq('phone belongs to newest account only', sent.filter(u => u === PHONE).length, 1);
sent.length = 0; r = m.call('digestTest', { send: true }, A).data;
eq('send-to-me no longer hits phone that moved to หมี', sent, [PC]);
// ข้อมูลผูกกับเครื่อง: ถามด้วย endpoint ได้เรื่องที่ส่งจริง แม้ไม่มี token
sent.length = 0; m.call('digestTest', { send: true, to: ['หมี'] }, A);
let i = m.call('pushInfoEp', { ep: PHONE }).data.info;
eq('phone gets digest info by endpoint (no token)', [i && i.kind, /สรุปงานเช้านี้/.test(i && i.title), /ฝ่ายแบบ/.test(i && i.code)], ['digest', true, true]);
eq('unknown / foreign endpoint → nothing', [m.call('pushInfoEp', { ep: 'https://fcm.googleapis.com/fcm/send/zzz' }).data.info, m.call('pushInfoEp', { ep: 'https://evil.com/x' }).data.info], [null, null]);
// ต่อมามีข้อความหาต้น (คนละเครื่อง) — ไม่ทับข้อมูลของมือถือ
m.call('pushSub', { sub: { endpoint: TON } }, C);
m.call('pushTest', {}, C);
eq('other device push does not overwrite phone info', m.call('pushInfoEp', { ep: PHONE }).data.info.kind, 'digest');
eq('authed pushInfo with ep prefers device info', m.call('pushInfo', { ep: PHONE }, C).data.info.kind, 'digest');
eq('authed pushInfo without ep → by name (old app)', m.call('pushInfo', {}, C).data.info.kind, 'call');
// มือถือเข้าระบบเป็นแอดมินอีกครั้ง → ย้ายไปบัญชีแอดมิน เอาออกจากบัญชีหมี
m.call('pushSub', { sub: { endpoint: PHONE } }, A);
eq('re-subscribe moves device between accounts', [JSON.parse(m.props['PUSH_' + aid]).map(x => x.e).indexOf(PHONE) >= 0, m.props['PUSH_' + bid] === undefined], [true, true]);
sent.length = 0; m.call('digestTest', { send: true, to: ['หมี'] }, A);
eq('then phone still gets exactly one', sent.filter(u => u === PHONE).length, 1);
console.log('v138: ' + ok + ' ok, ' + bad + ' fail'); if (bad) process.exit(1);
