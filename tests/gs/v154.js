// หลังบ้าน 1.54 (แอป v2.120): คนทำในประวัติ · เวลาเริ่ม/คนทำต่อเครื่อง · สาเหตุงานช้า · เตือนคอขวด · ต้นทุนวัสดุต่อ Job จาก Express
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
const mk = (n, role) => { const r = m.call('saveUser', { user: { name: n, role: role || 'user' } }, A).data; return [m.call('login', { userId: r.user.id, pin: r.pin }).data.token, r.user]; };
const [U] = mk('หมี'), [PR] = mk('ช่างเอ', 'prod'), [ST] = mk('คลังบี', 'stock');
let ok = 0, bad = 0; const eq = (lbl, a, b) => { const p = JSON.stringify(a) === JSON.stringify(b); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b))); };
// งานผลิตใหม่ → ลงเครื่อง: เครื่องได้เวลาเริ่ม · ติ๊กเสร็จพร้อมคนคุม · ครบแล้วไปประกอบ พร้อมคนทำในประวัติ
let r = m.call('prodSave', { prod: { code: 'W-1', title: 'ป้าย', stage: 'machine', machines: [{ m: 'Router' }, { m: 'Laser' }] } }, PR).data.prod;
eq('machines get start time', JSON.parse(r.machines).every(x => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.s)), true);
const s0 = JSON.parse(r.machines)[0].s;
r = m.call('prodSave', { prod: { id: r.id, machines: [{ m: 'Router', s: s0, d: '2026-10-28T10:00', w: ['ช่างเอ'] }, { m: 'Laser', s: s0 }] } }, PR).data.prod;
eq('one machine done keeps w + s', JSON.parse(r.machines).map(x => [x.m, !!x.d, (x.w || []).join(), x.s === s0]), [['Router', true, 'ช่างเอ', true], ['Laser', false, '', true]]);
r = m.call('prodSave', { prod: { id: r.id, machines: [{ m: 'Router', s: s0, d: '2026-10-28T10:00', w: ['ช่างเอ'] }, { m: 'Laser', s: s0, d: '2026-10-28T11:00', w: ['ช่างบี'] }], workers: ['ช่างเอ', 'ช่างบี', 'ช่างเอ'] } }, PR).data.prod;
eq('all done → ประกอบ with workers', [r.stage, JSON.parse(r.history).pop().w], ['assemble', ['ช่างเอ', 'ช่างบี']]);
r = m.call('prodSave', { prod: { id: r.id, note: 'แก้โน้ต', workers: ['x'] } }, PR).data.prod;
eq('no stage change → no new history', JSON.parse(r.history).length, 3);
eq('w only kept when machine done', JSON.parse(m.call('prodSave', { prod: { id: r.id, stage: 'machine', machines: [{ m: 'Router', w: ['ช่างเอ'] }] } }, PR).data.prod.machines)[0].w, undefined);
// สาเหตุงานช้า
r = m.call('prodSave', { prod: { id: r.id, late: 'mach|ใบมีดหัก' } }, PR).data.prod; eq('prod late reason', r.late, 'mach|ใบมีดหัก');
eq('bad key cleared', m.call('prodSave', { prod: { id: r.id, late: 'zzz' } }, PR).data.prod.late, '');
m.call('saveJob', { job: { code: 'L-1', title: 'งานช้า', taskType: 'ทำ CAD', status: 'doing', due: '2026-10-01', lateWhy: 'cust|รอยืนยันสี' } }, U);
let j = m.call('bootstrap', {}, U).data.jobs.find(x => x.code === 'L-1'); eq('job lateWhy saved', j.lateWhy, 'cust|รอยืนยันสี');
m.call('saveJob', { job: Object.assign({}, j, { lateWhy: 'rev' }) }, U);
const act = m.call('activity', { jobId: j.id }, U).data; eq('history says reason', JSON.stringify(act).indexOf('สาเหตุที่ช้า: แก้แบบ') >= 0, true);
// เตือนคอขวด: เฉลี่ย 1 วัน, ค้าง 4 วัน → ช้า
const now = Date.now(), iso = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 16);
const hist = d => JSON.stringify([{ t: iso(now - d * 864e5), s: 'paint' }, { t: iso(now - (d - 1) * 864e5), s: 'qc' }]);
const ps = [1, 2, 3].map(i => ({ id: 'a' + i, code: 'A' + i, stage: 'shipped', history: hist(10 + i) })).concat({ id: 'z', code: 'Z', stage: 'paint', history: JSON.stringify([{ t: iso(now - 4 * 864e5), s: 'paint' }]) }, { id: 'y', code: 'Y', stage: 'paint', history: JSON.stringify([{ t: iso(now - 1.2 * 864e5), s: 'paint' }]) });
const sl = m.ctx.slowProds_(ps, now); eq('slowProds_ finds only Z', sl.map(o => [o.p.code, o.st, Math.round(o.avg)]), [['Z', 'paint', 1]]);
eq('digest has slow line', m.ctx.digestBuild_([], ps, [], '2026-10-28', '2026-10-27', 3, ['prod'], [], []).body.indexOf('⏱️ ค้างนานกว่าปกติ 1 งาน: Z') >= 0, true);
// ต้นทุนวัสดุต่อ Job จาก Express (รายการรอลง Express ที่ใส่เลข Job)
m.call('exPendAdd', { kind: 'out', job: 'W-1', items: [{ cod: 'AL-01', des: 'อลูมิเนียม', unit: 'แผ่น', qty: 3 }] }, ST);
m.call('exPendAdd', { kind: 'out', items: [{ cod: 'AL-02', qty: 1 }] }, ST);
const jm = m.call('exJobMat', { from: '2000-01-01', to: '2999-12-31' }, A).data.rows; eq('exJobMat rows with job only', jm.map(x => [x.job, x.cod, x.qty, x.kind]), [['W-1', 'AL-01', 3, 'out']]);
{ const r0 = m.call('saveUser', { user: { name: 'ไม่มีสิทธิ์', role: 'user', perms: '-' } }, A).data, NT = m.call('login', { userId: r0.user.id, pin: r0.pin }).data.token; eq('no perms → blocked', m.call('exJobMat', { from: '2000-01-01', to: '2999-12-31' }, NT).error, 'ไม่มีสิทธิ์ดูต้นทุนวัสดุ'); }
console.log(ok + ' ok, ' + bad + ' failed'); if (bad) process.exit(1);
