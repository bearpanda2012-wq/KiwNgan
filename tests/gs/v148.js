// backend 1.48: หน้า Sale ได้โทเค็นอ่านคลัง Express แบบไม่มีราคา (sha256hex(sha256hex(EX_TOK)+'|sale')) — ไม่ส่ง EX_TOK ตัวจริง
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '../../backend/Code.gs'), 'utf8')
  .replace("const EX_TOK = '';", "const EX_TOK = 'exr_test_token_123456789012345';").replace(/const RT_URL = '';/, "const RT_URL = 'https://x.supabase.co';").replace(/const RT_KEY = '';/, "const RT_KEY = 'pk_test';");
const tmp = path.join(os.tmpdir(), 'code148.gs'); fs.writeFileSync(tmp, src); process.argv[2] = tmp;
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const A = m.call('login', { name: 'แอดมิน', pin }).data.token;
const key = m.call('saleLink', {}, A).data.key; const sv = m.call('saleView', { k: key });
const h = s => crypto.createHash('sha256').update(s).digest('hex'), want = h(h('exr_test_token_123456789012345') + '|sale');
let bad = 0; const eq = (l, a, w) => { const ok = JSON.stringify(a) === JSON.stringify(w); if (!ok) bad++; console.log((ok ? 'ok  ' : 'FAIL') + ' ' + l + (ok ? '' : ' → ' + JSON.stringify(a))); };
eq('saleView has ex', !!(sv.ok && sv.data.ex), true);
eq('sale token derived', sv.data.ex && sv.data.ex.tok, want);
eq('real read token not leaked', JSON.stringify(sv.data).indexOf('exr_test_token_123456789012345'), -1);
eq('url/key passed', sv.data.ex && [sv.data.ex.url, sv.data.ex.key], ['https://x.supabase.co', 'pk_test']);
console.log(bad ? bad + ' fail' : 'all ok'); process.exit(bad ? 1 : 0);
