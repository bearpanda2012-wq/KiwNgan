// 1.33.0: หลักฐานส่งมอบ · แจ้งเตือนของใกล้หมด · ราคาต่อหน่วย/ต้นทุนต่อ Job · PIN Sale รายคน
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const P = mk('ช่างผลิต', 'prod', '1111'), K = mk('สต็อก', 'stock', '2222'), K2 = mk('สต็อก2', 'stock', '3333'), U = mk('ฝน', 'user', '4444');
const IMG = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(50)).toString('base64');
const PNG = 'data:image/png;base64,' + Buffer.from('sig'.repeat(20)).toString('base64');

/* ---- หลักฐานส่งมอบ ---- */
let p = m.call('prodSave', { prod: { code: 'R69-1', title: 'ป้าย', sale: 'เอ' } }, P).data.prod;
p = m.call('prodSave', { prod: { id: p.id, stage: 'ready', qc: { it: [{ t: 'a', d: 'x' }], res: 'pass' } } }, A).data.prod;
eq('prod reached ready', p.stage, 'ready');
eq('user cannot add delivery photo', m.call('addImage', { jobId: 'd_' + p.id, thumb: IMG, full: IMG }, U).error, 'เพิ่มหลักฐานส่งมอบได้เฉพาะฝ่ายสต็อกหรือแอดมิน');
const ph = m.call('addImage', { jobId: 'd_' + p.id, thumb: IMG, full: IMG }, K).data.image;
const sg = m.call('addImage', { jobId: 'd_' + p.id, thumb: PNG, full: PNG }, K).data.image;
eq('stock adds delivery photo + signature', !!(ph.id && sg.id), true);
eq('delivery image saved to Drive', !!ph.fileId, true);
const sh = m.call('prodSave', { prod: { id: p.id, stage: 'shipped', ship: { to: 'คุณบี', note: 'วางหน้าร้าน', sig: sg.id }, title: 'แอบแก้' } }, K).data.prod;
eq('shipped by stock', sh.stage, 'shipped');
eq('stock cannot change other fields', sh.title, 'ป้าย');
const sp = JSON.parse(sh.ship);
eq('ship proof stored', [sp.to, sp.note, sp.sig, sp.by], ['คุณบี', 'วางหน้าร้าน', sg.id, 'สต็อก']);
eq('bad sig id dropped', JSON.parse(m.call('prodSave', { prod: { id: p.id, ship: { to: 'x', sig: '<script>' } } }, A).data.prod.ship).sig, '');
m.call('prodSave', { prod: { id: p.id, ship: { to: 'คุณบี', note: 'วางหน้าร้าน', sig: sg.id } } }, A);
{ const rr = m.call('prodSave', { prod: { id: p.id, ship: { to: 'ช่าง' } } }, P); eq('prod user cannot change ship info', JSON.parse((rr.data ? rr.data.prod.ship : '') || '{}').to || 'blocked', rr.data ? 'คุณบี' : 'blocked'); }
m.call('saleLink', {}, A); m.call('salePin', { pin: '5555' }, A);
const key = m.call('saleOpen', { pin: '5555' }).data.key;
const sv = m.call('saleView', { k: key }).data, spv = sv.prods.find(x => x.code === 'R69-1');
eq('sale sees delivery proof', [spv.ship.to, spv.ship.note, !!spv.ship.sig, spv.ship.photos.length], ['คุณบี', 'วางหน้าร้าน', true, 1]);
eq('stock can delete own delivery photo', m.call('deleteImage', { id: ph.id }, K2).error, undefined);

/* ---- คลัง: ราคา + แจ้งเตือนใกล้หมด ---- */
m.cacheStore['vj:https://fcm.googleapis.com'] = 'vapid t=x';
const sent = []; global.UrlFetchApp.fetchAll = reqs => { sent.push(reqs.map(r => r.url)); return reqs.map(() => ({ getResponseCode: () => 201 })); };
m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/k2' } }, K2);
m.call('pushSub', { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/u1' } }, U);
let st = m.call('stockSave', { item: { name: 'ACP 4mm', unit: 'แผ่น', qty: 10, min: 4, price: 850 } }, K).data;
const it = st.items[0];
eq('price saved', it.price, 850);
st = m.call('stockMove', { itemId: it.id, kind: 'out', qty: 3, job: 'R69-1' }, K).data;
eq('above min: no push', sent.length, 0);
eq('log keeps unit price', st.logs[0].price, 850);
st = m.call('stockMove', { itemId: it.id, kind: 'out', qty: 3, job: 'R69-1' }, K).data;
eq('cross min → push to other stock staff only', sent.length === 1 && sent[0].length === 1 && /k2$/.test(sent[0][0]), true);
eq('push info is low', JSON.parse(m.cacheStore['pinfo:สต็อก2']).kind, 'low');
m.call('stockMove', { itemId: it.id, kind: 'out', qty: 1, job: 'R69-2' }, K);
eq('already low: no repeat push', sent.length, 1);
m.call('stockMove', { itemId: it.id, kind: 'out', qty: 3 }, K);
eq('ran out → push "nostock"', [sent.length, JSON.parse(m.cacheStore['pinfo:สต็อก2']).kind], [2, 'nostock']);
st = m.call('stockSave', { item: { id: it.id, name: 'ACP 4mm', unit: 'แผ่น', min: 4 } }, K).data;
eq('edit without price keeps price', st.items[0].price, 850);
eq('negative price rejected', m.call('stockSave', { item: { id: it.id, name: 'ACP 4mm', unit: 'แผ่น', price: -1 } }, K).error, 'ราคาต่อหน่วยต้องเป็นตัวเลข 0 ขึ้นไป');
for (let i = 0; i < 320; i++) m.call('stockMove', { itemId: it.id, kind: 'in', qty: 1 }, K);
st = m.call('stockSave', { item: { id: it.id, name: 'ACP 4mm', unit: 'แผ่น', min: 4 } }, K).data;
eq('old job usage kept beyond last 300 logs', st.logs.filter(l => l.job === 'R69-1').length, 2);

/* ---- PIN Sale รายคน ---- */
eq('person PIN clash with shared PIN', m.call('salePin', { pin: '5555', sale: 'เอ' }, A).error, 'PIN นี้มีคนใช้แล้ว เลือก PIN อื่น');
let r = m.call('salePin', { pin: '6161', sale: 'เอ' }, A).data;
eq('person PIN set', r.pins, ['เอ']);
m.call('salePin', { pin: '7171', sale: 'บี' }, A);
eq('PIN clash between people', m.call('salePin', { pin: '7171', sale: 'เอ' }, A).error, 'PIN นี้มีคนใช้แล้ว เลือก PIN อื่น');
eq('shared PIN clash with person', m.call('salePin', { pin: '6161' }, A).error, 'PIN นี้มีคนใช้แล้ว เลือก PIN อื่น');
const oa = m.call('saleOpen', { pin: '6161' }).data;
eq('person PIN opens own key', [oa.sale, oa.key !== key], ['เอ', true]);
m.call('saveJob', { job: { code: 'J-B', title: 'งานบี', sale: 'บี', taskType: 'CAD' } }, A);
const va = m.call('saleView', { k: oa.key, sale: '' }).data;
eq('person sees only own jobs', [va.sale, va.own, va.prods.every(x => x.sale === 'เอ'), va.jobs.some(j => j.sale === 'บี')], ['เอ', 1, true, false]);
eq('cannot widen with sale param', m.call('saleView', { k: oa.key, sale: 'บี' }).data.sale, 'เอ');
eq('shared PIN still sees all', m.call('saleView', { k: key }).data.jobs.some(j => j.sale === 'บี'), true);
m.call('salePin', { pin: '6262', sale: 'เอ' }, A);
eq('new PIN invalidates old personal link', m.call('saleView', { k: oa.key }).error, 'ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากแอดมิน');
eq('old PIN rejected', m.call('saleOpen', { pin: '6161' }).error, 'PIN ไม่ถูกต้อง');
m.call('salePin', { pin: '', sale: 'เอ' }, A);
eq('removed person PIN', m.call('saleOpen', { pin: '6262' }).error, 'PIN ไม่ถูกต้อง');
m.call('salePin', { pin: '' }, A);
eq('roster sale button on with only personal PINs', m.call('roster', {}).data.sale, true);
eq('admin bootstrap lists personal PINs', m.call('bootstrap', {}, A).data.salePins, ['บี']);
eq('non-admin does not see PIN list', m.call('bootstrap', {}, U).data.salePins, undefined);
m.call('salePin', { pin: '', sale: 'บี' }, A);
eq('roster sale button off when no PINs', m.call('roster', {}).data.sale, false);
console.log(ok + ' ok, ' + bad + ' failed');
if (bad) process.exit(1);
