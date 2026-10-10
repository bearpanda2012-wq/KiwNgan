// 1.34.0: รับคืนจากหน้างาน (สภาพดี/ตำหนิ/เศษ + ขนาด + ผู้ส่งคืน + รูป) · ของลูกค้า · คืนลูกค้า
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const K = mk('สต็อก', 'stock', '2222'), U = mk('ฝน', 'user', '4444');
const IMG = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(50)).toString('base64');
let st = m.call('stockSave', { item: { name: 'ACP 4mm', cat: 'แผ่น', unit: 'แผ่น', qty: 10, min: 2, price: 800 } }, K).data;
const acp = st.items[0];
m.call('stockMove', { itemId: acp.id, kind: 'out', qty: 6, job: 'R70-1' }, K);
/* ---- รับคืน ---- */
eq('return needs job', m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1 }, K).error, 'ใส่เลข Job ที่ของกลับมาจากหน้างาน');
eq('user cannot return', !!m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1, job: 'R70-1' }, U).error, true);
let r = m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 2, job: 'R70-1', cond: 'ok', from: 'ทีมติดตั้ง' }, K).data;
eq('good return back to same item', r.items.find(x => x.id === acp.id).qty, 6);
eq('return log fields', [r.logs[0].kind, r.logs[0].cond, r.logs[0].from, r.logs[0].price, r.logId === r.logs[0].id, r.itemId], ['ret', 'ok', 'ทีมติดตั้ง', 800, true, acp.id]);
eq('scrap needs size', m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1, job: 'R70-1', cond: 'scrap' }, K).error, 'ใส่ขนาดเศษ เช่น 60×120 ซม.');
r = m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 2, job: 'R70-1', cond: 'scrap', size: '60 x 120 ซม.' }, K).data;
const sc = r.items.find(x => x.grade === 'scrap');
eq('scrap becomes own item', [sc.name, sc.qty, sc.base, sc.size, sc.price, sc.min], ['ACP 4mm · เศษ 60×120 ซม.', 2, acp.id, '60×120 ซม.', 0, 0]);
eq('scrap does not touch usable qty', r.items.find(x => x.id === acp.id).qty, 6);
r = m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1, job: 'R70-2', cond: 'scrap', size: '60×120 ซม.' }, K).data;
eq('same size scrap merges', [r.items.filter(x => x.grade === 'scrap').length, r.items.find(x => x.grade === 'scrap').qty], [1, 3]);
r = m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1, job: 'R70-2', cond: 'scrap', size: '30×40' }, K).data;
eq('other size → new scrap item', r.items.filter(x => x.grade === 'scrap').length, 2);
r = m.call('stockMove', { itemId: acp.id, kind: 'ret', qty: 1, job: 'R70-2', cond: 'ng', from: 'ช่างเอ' }, K).data;
const ng = r.items.find(x => x.grade === 'ng');
eq('damaged item', [ng.name, ng.qty], ['ACP 4mm · ตำหนิ', 1]);
eq('cannot return onto scrap item', m.call('stockMove', { itemId: sc.id, kind: 'ret', qty: 1, job: 'R70-1' }, K).error, 'รับคืนได้เฉพาะวัสดุของบริษัท');
r = m.call('stockMove', { itemId: sc.id, kind: 'out', qty: 1, job: 'R70-9' }, K).data;
eq('use scrap for another job (free)', [r.items.find(x => x.id === sc.id).qty, r.logs[0].price], [2, 0]);
eq('return photo', !!m.call('addImage', { jobId: 'r_' + r.logs.find(l => l.kind === 'ret').id, thumb: IMG, full: IMG }, K).data.image.id, true);
eq('return photo blocked for user', !!m.call('addImage', { jobId: 'r_' + r.logs.find(l => l.kind === 'ret').id, thumb: IMG, full: IMG }, U).error, true);
eq('bad return photo id', m.call('addImage', { jobId: 'r_sl_nope', thumb: IMG, full: IMG }, K).error, 'ไม่พบรายการรับคืนนี้');
/* ---- ของลูกค้า ---- */
st = m.call('stockSave', { item: { name: 'ACP 4mm', unit: 'แผ่น', qty: 5, own: 'cust', cust: 'คุณบี', job: 'R70-5', price: 999, min: 3 } }, K).data;
const cu = st.items.find(x => x.own === 'cust');
eq('customer item same name allowed', [cu.cust, cu.job, cu.price, cu.min, cu.qty], ['คุณบี', 'R70-5', 0, 0, 5]);
eq('customer item name clash per customer', m.call('stockSave', { item: { name: 'acp 4mm', unit: 'แผ่น', own: 'cust', cust: 'คุณบี' } }, K).error, 'มีวัสดุชื่อ acp 4mm อยู่แล้ว');
eq('back only for customer items', m.call('stockMove', { itemId: acp.id, kind: 'back', qty: 1 }, K).error, 'คืนลูกค้าได้เฉพาะของลูกค้า');
eq('cannot return customer item from site', m.call('stockMove', { itemId: cu.id, kind: 'ret', qty: 1, job: 'x' }, K).error, 'รับคืนได้เฉพาะวัสดุของบริษัท');
r = m.call('stockMove', { itemId: cu.id, kind: 'out', qty: 3, job: 'R70-5' }, K).data;
r = m.call('stockMove', { itemId: cu.id, kind: 'back', qty: 2 }, K).data;
eq('customer use + give back', [r.items.find(x => x.id === cu.id).qty, r.logs[0].kind], [0, 'back']);
eq('back over balance', m.call('stockMove', { itemId: cu.id, kind: 'back', qty: 1 }, K).error, 'คืนเกินยอดคงเหลือ (เหลือ 0 แผ่น)');
st = m.call('stockSave', { item: { id: cu.id, name: 'ACP 4mm', unit: 'แผ่น' } }, K).data;
eq('edit keeps customer fields', [st.items.find(x => x.id === cu.id).own, st.items.find(x => x.id === cu.id).cust], ['cust', 'คุณบี']);
/* ---- ไม่เด้งแจ้งเตือนของใกล้หมดจากเศษ/ของลูกค้า ---- */
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x'; const sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(reqs.length); return reqs.map(() => ({ getResponseCode: () => 201 })); };
const K2 = mk('สต็อก2', 'stock', '3333'); m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/k2' } }, K2);
m.call('stockMove', { itemId: ng.id, kind: 'out', qty: 1 }, K);
eq('no low-stock push for damaged item running out', sent.length, 0);
/* ---- ประวัติย้อนหลังเก็บรายการรับคืนที่มีเลข Job ---- */
for (let i = 0; i < 305; i++) m.call('stockMove', { itemId: acp.id, kind: 'in', qty: 1 }, K);
st = m.call('stockSave', { item: { id: acp.id, name: 'ACP 4mm', unit: 'แผ่น', min: 2 } }, K).data;
eq('old returns kept for job cost', st.logs.filter(l => l.kind === 'ret').length, 5);
console.log(ok + ' ok, ' + bad + ' failed');
if (bad) process.exit(1);
