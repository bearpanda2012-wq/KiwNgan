// 1.41.0: ทีมออกแบบดีไซน์ — เลข Job อัตโนมัติ · ใช้เลขร่วมกับ CAD/CAM · Jobshop ส่งผลิต · นัดหน้างานในสรุปเช้า + แจ้งเตือน 08:00
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const D = mk('ต้น', 'user', '1111'); mk('ฝน', 'user', '2222');
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x'; const sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(reqs.map(r => r.url)); return reqs.map(() => ({ getResponseCode: () => 201 })); };
m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/d1' } }, D);
const T = n => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10), td = T(0);
// เลข Job อัตโนมัติ
let r = m.call('saveJob', { job: { code: '', title: 'อาคาร ABC', taskType: 'ออกแบบ Façade', status: 'queue', received: td, assignee: 'ต้น', ds: JSON.stringify({ survey: 1, surveyAt: td + 'T10:00', area: '120' }) } }, A);
console.log('code', r.data && r.data.job.code); eq('empty code → DSyymm-001', /^DS\d{4}-001$/.test(r.data && r.data.job.code), true);
const c1 = r.data.job.code;
r = m.call('saveJob', { job: { code: '', title: 'คอนโด X', taskType: 'ออกแบบ คอนโด/บ้าน', status: 'queue', received: td, assignee: 'ฝน', helpers: 'ต้น', ds: JSON.stringify({ measureAt: T(1) + 'T14:30' }) } }, A);
eq('next auto code increments', r.data.job.code, c1.replace(/001$/, '002'));
eq('ds data kept', JSON.parse(r.data.job.ds).measureAt, T(1) + 'T14:30');
eq('CAD/CAM still needs code', !!m.call('saveJob', { job: { code: '', title: 'x', taskType: 'ทำ CAD', status: 'queue' } }, A).error, true);
// ใช้เลข Job ร่วมกับ CAD/CAM ได้ · งานออกแบบซ้ำกันเองไม่ได้
m.call('saveJob', { job: { code: 'R69-777', title: 'a', taskType: 'ทำ CAD', status: 'queue', group: 'งาน 2D' } }, A);
eq('design job may share code with CAD job', !!m.call('saveJob', { job: { code: 'R69-777', title: 'a', taskType: 'ออกแบบ Façade', status: 'queue' } }, A).data, true);
eq('two design jobs same code blocked', /มีงานออกแบบเลข/.test(m.call('saveJob', { job: { code: 'R69-777', title: 'b', taskType: 'ออกแบบ Jobshop', status: 'queue' } }, A).error || ''), true);
eq('CAD job same code still blocked by CAD rule', !!m.call('saveJob', { job: { code: 'R69-777', title: 'c', taskType: 'ทำ CAD', status: 'queue' } }, A).error, true);
// Jobshop เสร็จ → เข้ารอผลิต · Façade เสร็จ → ไม่เข้า
r = m.call('saveJob', { job: { code: 'R69-888', title: 'แคมป์', taskType: 'ออกแบบ Jobshop', status: 'queue' } }, A).data.job;
m.call('saveJob', { job: Object.assign({}, r, { status: 'done', baseUpdatedAt: r.updatedAt }) }, A);
const prods = m.call('bootstrap', {}, A).data.prods;
eq('jobshop done → production', prods.some(p => p.code === 'R69-888'), true);
// สรุปเช้า: นัดหน้างานวันนี้
const dg = m.call('digestTest', {}, A).data;
eq('digest lists today site visit', /📍 นัดหน้างานวันนี้ 1: อาคาร ABC · สำรวจหน้างาน 10:00 น\./.test(dg.body), true);
// แจ้งเตือน 08:00: วันนี้ + วันทำงานถัดไป · ผู้รับผิดชอบ + ผู้ร่วมทำงาน
const realDay = Date.prototype.getDay; Date.prototype.getDay = function () { return 2; };   // อังคาร
sent.length = 0; m.ctx.morningReminders(); Date.prototype.getDay = realDay;
const info = JSON.parse(m.cacheStore['pinfo:ต้น'] || '{}');
eq('helper/assignee gets one visit push', [sent.length >= 1, info.kind, info.count], [true, 'visit', 2]);
eq('push text has today + tomorrow', [/วันนี้ อาคาร ABC · สำรวจหน้างาน 10:00/.test(info.body), /คอนโด X · วัดพื้นที่หน้างาน 14:30/.test(info.body), info.title], [true, true, 'วันนี้ 1 นัด']);
console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
