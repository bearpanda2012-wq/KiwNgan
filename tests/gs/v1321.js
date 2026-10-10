// 1.32.1: เปลี่ยน PIN ของตัวเองได้ (เดิมเทียบกับผู้ใช้ฉบับย่อในแคช → "PIN เดิมไม่ถูกต้อง" ทุกครั้ง)
const path = require('path'); process.argv[2] = path.join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const r = m.call('saveUser', { user: { name: 'หมี', pin: '1111' } }, A).data, U = m.call('login', { userId: r.user.id, pin: '1111' }).data.token;
eq('wrong old PIN rejected', m.call('changePin', { oldPin: '9999', newPin: '2222' }, U).error, 'PIN เดิมไม่ถูกต้อง');
eq('same PIN rejected', m.call('changePin', { oldPin: '1111', newPin: '1111' }, U).error, 'PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม');
eq('correct old PIN → changed', m.call('changePin', { oldPin: '1111', newPin: '2222' }, U).error, undefined);
eq('old PIN no longer works', !!m.call('login', { userId: r.user.id, pin: '1111' }).error, true);
eq('new PIN logs in', !!m.call('login', { userId: r.user.id, pin: '2222' }).data.token, true);
eq('admin changes own PIN', m.call('changePin', { oldPin: pin, newPin: '7777' }, A).error, undefined);
console.log(ok + ' ok, ' + bad + ' failed');
if (bad) process.exit(1);
