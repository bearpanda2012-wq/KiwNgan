// 1.39.0: ธีมผูกกับบัญชี (themeGet / themeSave) · ใหม่กว่าชนะ · จำกัดขนาด · แยกต่อผู้ใช้
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const r0 = m.call('saveUser', { user: { name: 'หมี', role: 'user', pin: '1111' } }, A).data; const B = m.call('login', { userId: r0.user.id, pin: '1111' }).data.token;
eq('empty at first', m.call('themeGet', {}, B).data.data, null);
const t1 = Date.now() - 5000;
eq('save', m.call('themeSave', { data: { ts: t1, theme: { preset: 'night', mode: 'dark' }, saves: [{ id: 'a', name: 'กลางคืน', theme: { preset: 'night' } }] } }, B).data.ts, t1);
eq('get same on another device', (d => [d.theme.preset, d.saves.length, d.ts])(m.call('themeGet', {}, B).data.data), ['night', 1, t1]);
eq('per user (admin sees own, none)', m.call('themeGet', {}, A).data.data, null);
const old = m.call('themeSave', { data: { ts: t1 - 99999, theme: { preset: 'gold' } } }, B).data;
eq('older save does not overwrite newer', [old.stale, old.data.theme.preset, m.call('themeGet', {}, B).data.data.theme.preset], [true, 'night', 'night']);
eq('bad payload rejected', !!m.call('themeSave', { data: { theme: 'x' } }, B).error, true);
const big = Array.from({ length: 24 }, (x, i) => ({ id: 's' + i, name: 'ธีม ' + i, theme: { bgurl: 'https://x/' + 'a'.repeat(3000) } }));
const r = m.call('themeSave', { data: { ts: Date.now(), theme: { preset: 'brand' }, saves: big } }, B).data;
eq('too big → trims saved list to fit', [r.saves < 24, r.saves > 5, m.call('themeGet', {}, B).data.data.theme.preset], [true, true, 'brand']);
eq('needs login', !!m.call('themeGet', {}, '').error, true);
console.log('v139: ' + ok + ' ok, ' + bad + ' fail'); if (bad) process.exit(1);
