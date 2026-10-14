// 1.44.0: รอลง Express — บันทึกเบิก/รับในแอป · ยกเลิก/ลงเอง · จับคู่เอกสาร Express อัตโนมัติ · สรุปเช้า
const path = require('path'), fs = require('fs'), os = require('os');
const src = fs.readFileSync(path.join(__dirname, '../../backend/Code.gs'), 'utf8').replace("const RT_URL = '';", "const RT_URL = 'https://rt.test';").replace("const RT_KEY = '';", "const RT_KEY = 'k';").replace(/const EX_TOK = '';/, "const EX_TOK = 'tok';");
const tmp = path.join(os.tmpdir(), 'code144.gs'); fs.writeFileSync(tmp, src); process.argv[2] = tmp;
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const P = mk('ช่างเอ', 'prod', '1111'), U = mk('สต็อก1', 'stock', '2222'), V = mk('สต็อก2', 'stock', '4444'), S = mk('สต็อก', 'stock', '3333');
// Supabase จำลอง
let MOVES = [], calls = [];
global.UrlFetchApp.fetch = (url, o) => { calls.push(url); if (/ex_find/.test(url)) { const b = JSON.parse(o.payload); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(MOVES.filter(x => b.cods.indexOf(x[7]) >= 0 && x[2] >= b.since)) }; } if (/ex_low/.test(url)) return { getResponseCode: () => 200, getContentText: () => '[]' }; return { getResponseCode: () => 200, getContentText: () => '{}' }; };
const td = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
// บันทึก
eq('non-stock user cannot record', /ไม่มีสิทธิ์/.test(m.call('exPendAdd', { kind: 'out', items: [{ cod: 'RM-1', qty: 1 }] }, P).error || ''), true);
eq('kind required', !!m.call('exPendAdd', { items: [{ cod: 'RM-1', qty: 1 }] }, U).error, true);
eq('qty > 0', !!m.call('exPendAdd', { kind: 'out', items: [{ cod: 'RM-1', qty: 0 }] }, U).error, true);
let r = m.call('exPendAdd', { kind: 'out', job: 'R69-100', note: 'หน้างาน A', items: [{ cod: 'RM-1', qty: 2, des: 'แผ่น A', unit: 'แผ่น', loc: 'RM' }, { cod: 'CU-9', qty: 5 }] }, U).data;
eq('2 waiting rows', r.exPend.map(x => [x.cod, x.qty, x.kind, x.status, x.who, x.job]), [['RM-1', 2, 'out', 'wait', 'สต็อก1', 'R69-100'], ['CU-9', 5, 'out', 'wait', 'สต็อก1', 'R69-100']]);
m.call('exPendAdd', { kind: 'in', items: [{ cod: 'RM-1', qty: 10 }] }, V);
m.call('exPendAdd', { kind: 'out', items: [{ cod: 'BT-1', qty: 3 }] }, V); m.call('exPendAdd', { kind: 'out', items: [{ cod: 'BT-1', qty: 4 }] }, U);
const boot = m.call('bootstrap', {}, P).data;
eq('non-stock user still sees pend list', boot.ex && boot.ex.pend.length, 5);
// ยกเลิก: เจ้าของหรือฝ่ายสต็อก
const idCU = r.exPend.find(x => x.cod === 'CU-9').id;
eq('non-stock user cannot cancel', !!m.call('exPendSet', { id: idCU, act: 'cancel' }, P).error, true);
eq('stock cancels', m.call('exPendSet', { id: idCU, act: 'cancel' }, V).data.exPend.find(x => x.id === idCU).status, 'cancel');
eq('prod user cannot mark done', !!m.call('exPendSet', { id: idCU, act: 'done', doc: 'X' }, P).error, true);
// จับคู่อัตโนมัติ
MOVES = [
  ['ROY69|PD1|1|RM-1|RM|6', 'PD1', td, 'RM', '6', 1, 'JS01', 'RM-1'],   // จำนวนไม่ตรง
  ['ROY69|PD2|1|RM-1|RM|6', 'PD2', td, 'RM', '6', 2, 'JS01', 'RM-1'],   // ตรง (เบิก 2)
  ['ROY69|PI1|1|RM-1|RM|1', 'PI1', td, 'RM', '1', 10, '', 'RM-1'],      // รับ 10
  ['ROY69|PD3|1|BT-1|RM|6', 'PD3', td, 'RM', '6', 7, '', 'BT-1'],       // รวม 3+4
  ['ROY69|PD0|1|RM-1|RM|6', 'PD0', '20200101', 'RM', '6', 2, '', 'RM-1'] // เก่าเกินไป
];
r = m.call('exPendMatch', {}, S).data;
eq('matched 4 (2 exact + group of 2)', r.matched, 4);
const L = r.exPend, by = (c, k) => L.filter(x => x.cod === c && x.kind === k);
eq('out RM-1 → PD2', [by('RM-1', 'out')[0].status, by('RM-1', 'out')[0].doc, by('RM-1', 'out')[0].docDat, by('RM-1', 'out')[0].doneBy], ['done', 'PD2', td, 'อัตโนมัติ']);
eq('in RM-1 → PI1', by('RM-1', 'in')[0].doc, 'PI1');
eq('combined line BT-1 3+4 → PD3', by('BT-1', 'out').map(x => x.doc), ['PD3', 'PD3']);
eq('throttled right after', m.call('exPendMatch', {}, S).data.matched, 0);
// ไม่ใช้เอกสารเดิมซ้ำ
m.call('exPendAdd', { kind: 'out', items: [{ cod: 'RM-1', qty: 2 }] }, U); delete m.cacheStore.xpm;
eq('same doc not reused', m.call('exPendMatch', {}, S).data.matched, 0);
// ลงเอง / เปิดใหม่ (ฝ่ายสต็อก)
const w = m.call('bootstrap', {}, S).data.ex.pend.find(x => x.status === 'wait');
eq('stock marks done manually', m.call('exPendSet', { id: w.id, act: 'done', doc: 'PD99' }, S).data.exPend.find(x => x.id === w.id).doc, 'PD99');
eq('doc required', !!m.call('exPendSet', { id: w.id, act: 'done', doc: '' }, S).error, true);
eq('reopen', m.call('exPendSet', { id: w.id, act: 'reopen' }, S).data.exPend.find(x => x.id === w.id).status, 'wait');
// สรุปเช้า
const dg = m.call('digestTest', {}, A).data;
eq('digest shows waiting count', /🧾 รอลง Express 1 รายการ/.test(dg.body), true);
// ฟังก์ชันจับคู่: คลังตรงกันมาก่อน
const pr = m.ctx.exPendPair_([{ id: 'a', ts: '2026-10-14T09:00:00', cod: 'X', kind: 'out', qty: '1', loc: 'B' }], [['k1', 'D1', '20261014', 'A', '6', 1, '', 'X'], ['k2', 'D2', '20261015', 'B', '6', 1, '', 'X']], {});
eq('prefers same location', pr[0].m[1], 'D2');
const pr2 = m.ctx.exPendPair_([{ id: 'a', ts: '2026-10-14T09:00:00', cod: 'X', kind: 'out', qty: '1', loc: '' }], [['k1', 'D1', '20261012', 'A', '6', 1, '', 'X'], ['k2', 'D2', '20261016', 'A', '6', 1, '', 'X']], {});
eq('prefers doc on/after entry date', pr2[0].m[1], 'D2');
eq('in does not match issue', m.ctx.exPendPair_([{ id: 'a', ts: '2026-10-14T09:00:00', cod: 'X', kind: 'in', qty: '1' }], [['k1', 'D1', '20261014', 'A', '6', 1, '', 'X']], {}).length, 0);
console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
