// backend 1.49: ประวัติ "แก้ไข" บอกว่าแก้อะไร (เลื่อนกำหนดส่ง/เพิ่มบรีฟ) + เหตุผล
const path = require('path'); process.argv[2] = process.argv[2] || path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let bad = 0; const eq = (l, a, w) => { const ok = JSON.stringify(a) === JSON.stringify(w); if (!ok) bad++; console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l + (ok ? '' : ' → ' + JSON.stringify(a))); };
const r = m.call('saveJob', { job: { code: '6904079C', title: 'ทดสอบ', taskType: 'เขียนแบบ', status: 'queue', received: '2026-10-19', due: '2026-10-22', note: 'เพิ่มอาคารด้านข้าง' } }, A);
const j = r.data.job;
const r2 = m.call('saveJob', { job: Object.assign({}, j, { due: '2026-10-24', note: 'เพิ่มอาคารด้านข้าง\n-ย้ายด้านลึก', why: 'สลับกับงาน MV Food', baseUpdatedAt: j.updatedAt }) }, A);
eq('saved', r2.ok, true);
eq('why not stored on job', r2.data.job.why, undefined);
const h = m.call('activity', { jobId: j.id }, A).data;
const list = (h.activity || h.items || h).filter ? (h.activity || h.items || h) : [];
const ed = list.find(a => a.action === 'edit');
eq('edit detail readable', ed && ed.detail, 'เลื่อนกำหนดส่ง 22 ต.ค. → 24 ต.ค. (+2 วัน) · เพิ่มบรีฟ: -ย้ายด้านลึก · เหตุผล: สลับกับงาน MV Food');
const j2 = r2.data.job;
const r3 = m.call('saveJob', { job: Object.assign({}, j2, { status: 'doing', why: 'เริ่มก่อนเพราะลูกค้าเร่ง', baseUpdatedAt: j2.updatedAt }) }, A);
const h3 = m.call('activity', { jobId: j.id }, A).data; const l3 = (h3.activity || h3.items || h3);
eq('status reason', l3.some(a => a.action === 'status' && a.detail === 'queue→doing · เหตุผล: เริ่มก่อนเพราะลูกค้าเร่ง'), true);
console.log(bad ? bad + ' fail' : 'all ok'); process.exit(bad ? 1 : 0);
