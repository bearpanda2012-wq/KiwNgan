// 1.47.0: คลังความรู้นับคนดู (ในแอป + หน้า Sale) · ข้อความบอกว่าอ่านแล้วกี่คน (ชื่อเฉพาะคนส่ง/แอดมิน)
const path = require('path'), fs = require('fs'), os = require('os');
const src = fs.readFileSync(path.join(__dirname, '../../backend/Code.gs'), 'utf8');
const tmp = path.join(os.tmpdir(), 'code147.gs'); fs.writeFileSync(tmp, src); process.argv[2] = tmp;
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const mk = (name, role, p) => { const r = m.call('saveUser', { user: { name, role, pin: p } }, A).data; return m.call('login', { userId: r.user.id, pin: p }).data.token; };
const D = mk('ดีไซน์', 'user', '1111'), P = mk('ผลิต', 'prod', '2222'), S2 = mk('สต็อก', 'stock', '3333');
// ---- คลังความรู้ ----
const kid = m.call('kbSave', { item: { dept: 'd', cat: 'tip', title: 'เทคนิค A', body: 'x' } }, D).data.kb[0].id;
const kb = t => m.call('bootstrap', {}, t).data.kb.find(k => k.id === kid);
eq('new article: 0 views', kb(D).views, 0);
m.call('kbView', { id: kid }, P); m.call('kbView', { id: kid }, P); m.call('kbView', { id: kid }, S2);
eq('same person counted once', kb(D).views, 2);
eq('viewers list names', kb(D).viewers.map(v => v.n).sort(), ['ผลิต', 'สต็อก'].sort());
m.call('kbView', { id: kid }, A);
eq('admin name hidden from users', kb(D).viewers.some(v => v.n === 'แอดมิน'), false);
eq('admin sees own name', kb(A).viewers.some(v => v.n === 'แอดมิน'), true);
// หน้า Sale
m.call('salePin', { pin: '2468' }, A); const key = m.call('saleOpen', { pin: '2468' }).data.key;
eq('bad sale key rejected', !!m.call('saleKbView', { k: 'nope', id: kid, dev: 'abcdef12' }).error, true);
eq('sale device view counted', m.call('saleKbView', { k: key, id: kid, dev: 'abcdef12' }).data.views, 4);
m.call('saleKbView', { k: key, id: kid, dev: 'abcdef12' });
eq('same device once', m.call('saleKbView', { k: key, id: kid, dev: 'zzzzzz99' }).data.views, 5);
eq('short device id ignored', m.call('saleKbView', { k: key, id: kid, dev: 'ab' }).data.views, 0);
const sk = m.call('saleView', { k: key }).data.kb.find(k => k.id === kid);
eq('sale page gets count, no names', [sk.views, sk.viewers], [5, undefined]);
eq('app shows sale viewers as "Sale"', kb(D).viewers.filter(v => v.n === 'Sale').length, 2);
eq('edit keeps views', (m.call('kbSave', { item: { id: kid, dept: 'd', cat: 'tip', title: 'เทคนิค A2', body: 'y' } }, D), kb(D).views), 5);
// ---- ข้อความ อ่านแล้วกี่คน ----
const mid = m.call('sendMessage', { to: 'team', text: 'ประชุม 9 โมง' }, D).data.message.id;
const msgs = (t, since) => m.call('messages', { since: since || '' }, t).data;
const mine = () => msgs(D).messages.find(x => x.id === mid);
eq('fresh message: 0 read', [mine().rc, mine().rn], [0, undefined]);
const since = msgs(P).serverTime;
m.call('markRead', { ids: [mid] }, P); m.call('markRead', { ids: [mid] }, P); m.call('markRead', { ids: [mid] }, S2);
eq('sender sees count + names', [mine().rc, mine().rn.sort()], [2, ['ผลิต', 'สต็อก'].sort()]);
const other = msgs(P).messages.find(x => x.id === mid);
eq('others see count only', [other.rc, other.rn], [2, undefined]);
eq('rd map updates old messages (since)', msgs(P, since).rd[mid], [2]);
m.call('markRead', { ids: [mid] }, A);
eq('admin reader masked for sender', mine().rn.indexOf('แอดมิน') < 0 && mine().rn.length === 3, true);
console.log(ok + ' ok, ' + bad + ' failed'); process.exit(bad ? 1 : 0);
