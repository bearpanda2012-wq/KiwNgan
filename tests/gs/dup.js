const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const T = m.call('login', { name: 'แอดมิน', pin }).data.token;
const s = (t) => { const r = m.call('saveJob', { job: { code: 'R69-10002S', taskType: t, status: 'queue' } }, T); return t + ' → ' + (r.ok ? 'OK' : r.error); };
console.log(s('ทำ CAD')); console.log(s('ทำ CAM')); console.log(s('ทำ CAM')); console.log(s('ทำ แบบผลิต'));
const r = m.call('saveJob', { job: { code: 'NEW-2', taskType: 'ทำ CAM', status: 'queue' } }, T); console.log('fresh CAM', r.ok);
