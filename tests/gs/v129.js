// สิทธิ์แบบช่องติ๊ก (perms) + คลังวัสดุ (ฝ่ายสต็อก)
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
const mk = (n, role, perms) => { const r = m.call('saveUser', { user: { name: n, role: role || 'user', perms } }, A).data; return [m.call('login', { userId: r.user.id, pin: r.pin }).data.token, r.user]; };
let ok = 0, bad = 0; const eq = (lbl, a, b) => { const p = JSON.stringify(a) === JSON.stringify(b); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b))); };
const [U, uu] = mk('หมี'), [E, eu] = mk('อีฟ'), [L, lu] = mk('บอส', 'lead', ['design.add', 'design.edit', 'design.assign', 'team.all']), [ST, su] = mk('คลังบี', 'stock');
eq('default perms stored empty', uu.perms, '');
eq('custom perms stored', lu.perms, 'design.add,design.edit,design.assign,team.all');
eq('stock role kept', su.role, 'stock');
// งานของหมี: อีฟแก้ไม่ได้ บอส (design.edit) แก้ได้
m.call('saveJob', { job: { code: 'A-1', taskType: 'ทำ CAD', status: 'queue' } }, U);
const j = m.call('bootstrap', {}, E).data.jobs.find(x => x.code === 'A-1');
eq('everyone sees every job', !!j, true);
eq('other user cannot edit', !!m.call('saveJob', { job: Object.assign({}, j, { note: 'x' }) }, E).error, true);
eq('design.edit can edit', m.call('saveJob', { job: Object.assign({}, j, { note: 'แก้โดยหัวหน้า' }) }, L).data.job.note, 'แก้โดยหัวหน้า');
eq('no assign perm → error', !!m.call('saveJob', { job: Object.assign({}, j, { assignee: 'อีฟ' }) }, U).error, true);
const j2 = m.call('bootstrap', {}, L).data.jobs.find(x => x.code === 'A-1');
eq('design.assign can reassign', m.call('saveJob', { job: Object.assign({}, j2, { assignee: 'อีฟ' }) }, L).data.job.assignee, 'อีฟ');
eq('assign on create kept', m.call('saveJob', { job: { code: 'A-2', taskType: 'ทำ CAD', assignee: 'หมี' } }, L).data.job.assignee, 'หมี');
eq('no assign on create → self', m.call('saveJob', { job: { code: 'A-3', taskType: 'ทำ CAD', assignee: 'อีฟ' } }, U).data.job.assignee, 'หมี');
const a2 = m.call('bootstrap', {}, U).data.jobs.find(x => x.code === 'A-2');
eq('cannot delete others job', !!m.call('deleteJob', { id: a2.id }, E).error, true);
// ปิดสิทธิ์ลงงาน
const ru = m.call('saveUser', { user: Object.assign({}, eu, { perms: [] }) }, A).data.user;
eq('empty perms → "-"', ru.perms, '-');
eq('no design.add → cannot create', m.call('saveJob', { job: { code: 'A-4', taskType: 'ทำ CAD' } }, E).error, 'ไม่มีสิทธิ์ลงงานใหม่ของฝ่ายแบบ');
eq('perms back to default → empty', m.call('saveUser', { user: Object.assign({}, eu, { perms: ['stock.view', 'design.add'] }) }, A).data.user.perms, '');
eq('unknown perm dropped', m.call('saveUser', { user: Object.assign({}, eu, { perms: ['design.add', 'hack.all'] }) }, A).data.user.perms, 'design.add');
eq('me returns perms', m.call('me', {}, E).data.user.perms, 'design.add');
// คลังวัสดุ
eq('bootstrap stock for stock.view', !!m.call('bootstrap', {}, U).data.stock, true);
eq('no stock.view → null', m.call('bootstrap', {}, E).data.stock, null);
eq('designer cannot add item', !!m.call('stockSave', { item: { name: 'แผ่นอะคริลิค' } }, U).error, true);
let s = m.call('stockSave', { item: { name: 'แผ่นอะลูมิเนียม 3 มม.', cat: 'แผ่น', unit: 'แผ่น', qty: 20, min: 5 } }, ST).data;
const it = s.items[0];
eq('item added with start qty + log', [it.qty, it.min, s.logs.length, s.logs[0].note], [20, 5, 1, 'ยอดเริ่มต้น']);
eq('duplicate name', !!m.call('stockSave', { item: { name: 'แผ่นอะลูมิเนียม 3 มม.' } }, ST).error, true);
s = m.call('stockMove', { itemId: it.id, kind: 'out', qty: 6, job: 'A-1', note: 'ตัดผนัง' }, ST).data;
eq('out → 14', [s.items[0].qty, s.logs[0].kind, s.logs[0].bal, s.logs[0].job], [14, 'out', 14, 'A-1']);
eq('over-withdraw blocked', m.call('stockMove', { itemId: it.id, kind: 'out', qty: 99 }, ST).error, 'เบิกเกินยอดคงเหลือ (เหลือ 14 แผ่น)');
s = m.call('stockMove', { itemId: it.id, kind: 'in', qty: 2.5 }, ST).data; eq('in 2.5 → 16.5', s.items[0].qty, 16.5);
s = m.call('stockMove', { itemId: it.id, kind: 'adj', qty: 15 }, ST).data; eq('adjust → 15, diff -1.5', [s.items[0].qty, s.logs[0].qty], [15, -1.5]);
eq('zero qty rejected', !!m.call('stockMove', { itemId: it.id, kind: 'in', qty: 0 }, ST).error, true);
eq('admin can move', m.call('stockMove', { itemId: it.id, kind: 'out', qty: 1 }, A).data.items[0].qty, 14);
s = m.call('stockSave', { item: Object.assign({}, it, { min: 20, qty: 999 }) }, ST).data; eq('edit keeps qty', [s.items[0].min, s.items[0].qty], [20, 14]);
eq('delete item', m.call('stockDelete', { id: it.id }, ST).data.items.length, 0);
console.log(ok + ' ok, ' + bad + ' failed');
if (bad) process.exit(1);
