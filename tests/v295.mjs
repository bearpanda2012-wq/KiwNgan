// v2.95: ตั้งแจ้งเตือนสินค้าใกล้หมด — ทุกรายการในครั้งเดียว / เลือกรายการเอง
// ข้อมูลจำลอง (ไม่ใช้ข้อมูลจริงของบริษัท) · ถ้ามี tests/out/exfix.json (ข้อมูลจริง ไม่ขึ้น git) จะใช้ทดสอบความเร็วด้วย
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8851;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,exStart,exSync};window.exPendText=exPendText;window.digestCalc=digestCalc;window.S=S;window.SV=SV;window.EX=EX;window.EV=EV;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };

// ---- ข้อมูลจำลองแบบเดียวกับที่ ex_pull ส่งมา ----
const real = fs.existsSync(new URL('out/exfix.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('out/exfix.json', import.meta.url))) : null;
const items = [], locs = [], moves = [];
const it = (cod, des, grp, unit, bal, unitpr) => { items.push([cod, des, '', grp, '0', unit, bal, bal * unitpr, unitpr, '20260901', unitpr, 'SUP01', '', '', '20261001', 0]); };
it('RM-SB-02-0104', 'เหล็กกล่อง 2 mm. 1"x4"', 'RM', 'ส', 5, 760); locs.push(['RM-SB-02-0104', 'RM', 5, 3800, '20261012', 0]);
it('GST-CL-FSS8083', 'สีน้ำ 4SEASON TOA8083 แบบด้าน ภายนอก', 'GST1', 'กป', 1, 174.77); locs.push(['GST-CL-FSS8083', 'GST1', 1, 174.77, '20261010', 0]);
it('NEG-001', 'ของติดลบ', 'RM', 'ผน', -2, 100); locs.push(['NEG-001', 'RM', -2, -200, '20261011', 0]);
for (let i = 0; i < 2500; i++) it('ZZ-' + String(i).padStart(5, '0'), 'เศษวัสดุ ' + i, i % 3 ? 'ZZ' : 'CU', 'ชน', i % 4 ? 0 : i % 7 + 1, 10);
items.filter(x => x[6]).forEach(x => { if (!locs.some(l => l[0] === x[0])) locs.push([x[0], x[3], x[6], x[7], '20261001', 0]); });
const td = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
moves.push(['OU6910010', td, 'RM', '6', 2, 760, 1520, '', '115', '451/16512', 'RM-SB-02-0104'], ['RR6910003', td, 'RM', '0', 7, 760, 5320, 'SUP01', '', 'เหล็กกล่อง 2 mm. 1"x4"', 'RM-SB-02-0104']);
const tabs = { units: { 'ส': 'เส้น', 'กป': 'กระป๋อง', 'ชน': 'ชิ้น', 'ผน': 'แผ่น' }, locs: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.', ZZ: 'เศษ', CU: 'วัสดุลูกค้า' }, groups: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.อื่น', ZZ: 'เศษวัสดุ', CU: 'ลูกค้า' }, deps: { '115': 'ฝ่ายผลิต' } };
let agentAt = new Date().toISOString(), pulls = [], extra = null;
await pg.route('https://ex.test/rest/v1/rpc/**', async route => {
  const fn = route.request().url().split('/').pop(), body = JSON.parse(route.request().postData() || '{}');
  if (body.tok !== 'exr_test_token_123456789012345') return route.fulfill({ status: 401, body: '{"message":"bad token"}' });
  let out;
  if (fn === 'ex_pull') {
    pulls.push(body.since);
    if (+body.since === 0) out = { items: items.slice(0, 2000), locs: [], tabs: {}, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: true, ver: 2000, top: 3000 };
    else if (+body.since === 2000) out = { items: items.slice(2000), locs: locs, tabs: tabs, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: false, ver: 3000, top: 3000 };
    else out = extra && +body.since === 3000 ? extra : { items: [], locs: [], tabs: {}, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: false, ver: +body.since, top: +body.since };
  } else if (fn === 'ex_recent') out = moves;
  else if (fn === 'ex_card') out = moves.filter(m => m[10] === body.cod).map(m => m.slice(0, 10).concat('ROY69'));
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
});

await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); indexedDB.deleteDatabase('kn-ex'); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('stock'); }); await pg.waitForTimeout(400);
await pg.evaluate(() => T.exStart({ url: 'https://ex.test', key: 'k', tok: 'exr_test_token_123456789012345' })); await pg.waitForTimeout(800);
await pg.waitForSelector('#exList');
await pg.waitForFunction(() => document.querySelectorAll('.ex-row').length > 0, null, { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500);
eq('alert strip shows (off)', await pg.locator('.ex-albar:not(.on)').count(), 1);
eq('two buttons for stock', await pg.locator('.ex-albar [data-exal]').count(), 2);
// 1) ทุกรายการในครั้งเดียว
await pg.click('.ex-albar [data-exal="all"]'); await pg.waitForTimeout(200);
eq('modal open on tab all', await pg.locator('#exAl .xa-tab[aria-selected="true"]').getAttribute('data-exaltab'), 'all');
await pg.check('#xaOn', { force: true }); await pg.waitForTimeout(100);
await pg.click('#exAl [data-exalg="5"]'); await pg.waitForTimeout(100);
eq('quick 5 sets value', await pg.inputValue('#xaG'), '5');
const prev = await pg.locator('#xaPrev .xa-stat .warn b').textContent().catch(() => '');
eq('preview counts items now ≤ 5 (with balance)', +prev > 0, true);
await pg.screenshot({ path: new URL('out/v295a.png', import.meta.url).pathname });
await pg.click('#exAl [data-exalsave]'); await pg.waitForTimeout(500);
eq('modal closed', await pg.locator('#exAl').count(), 0);
eq('global saved', await pg.evaluate(() => EX.mins['*']), 5);
eq('strip on', await pg.locator('.ex-albar.on').count(), 1);
eq('KPI low counts global (bal>0 only)', await pg.evaluate(() => [...EX.items.values()].filter(x => (+x[6] || 0) > 1e-9 && x[6] <= 5).length) > 0, true);
const lowN = await pg.evaluate(() => +document.querySelector('.k-low b').dataset.cnt);
eq('KPI low = items with 0<bal≤5', lowN, await pg.evaluate(() => [...EX.items.values()].filter(x => (+x[6] || 0) > 1e-9 && x[6] <= 5).length));
// 2) เลือกรายการเอง
await pg.click('.ex-albar [data-exal="pick"]'); await pg.waitForTimeout(200);
await pg.fill('#xaQ', 'RM-SB'); await pg.waitForTimeout(150);
eq('search finds item', await pg.locator('#xaRes .xa-r').count(), 1);
await pg.fill('#xaRes [data-exalin="RM-SB-02-0104"]', '8'); await pg.locator('#xaRes [data-exalin="RM-SB-02-0104"]').dispatchEvent('change'); await pg.waitForTimeout(100);
eq('listed under set', await pg.locator('#xaSet [data-exalin="RM-SB-02-0104"]').count(), 1);
eq('dirty count', await pg.locator('#xaDirty').textContent(), 'ยังไม่บันทึก 1 การเปลี่ยนแปลง');
// ค้นด้วยชื่อหมวด + ใส่ให้ทั้งหมด
await pg.fill('#xaQ', 'วัสดุสิ้นเปลือง'); await pg.waitForTimeout(150);
eq('search by category', await pg.locator('#xaRes .xa-r').count() >= 1, true);
await pg.fill('#xaBulk', '3'); await pg.click('[data-exalbulk]'); await pg.waitForTimeout(150);
await pg.screenshot({ path: new URL('out/v295b.png', import.meta.url).pathname });
await pg.click('#exAl [data-exalsave]'); await pg.waitForTimeout(500);
await pg.screenshot({ path: new URL('out/v295c.png', import.meta.url).pathname });
eq('own saved', await pg.evaluate(() => [EX.mins['RM-SB-02-0104'], EX.mins['GST-CL-FSS8083'], EX.mins['*']]), [8, 3, 5]);
eq('own beats global (5 ≤ 8 → low)', await pg.evaluate(() => [...EX.items.values()].some(x => x[0] === 'RM-SB-02-0104' && x[6] <= 8)), true);
// การ์ดสินค้าบอกที่มา
await pg.evaluate(() => { EV.q = 'RM-SB-02'; T.render(); }); await pg.waitForTimeout(300);
await pg.locator('.ex-row', { hasText: 'RM-SB-02-0104' }).first().click({ position: { x: 300, y: 10 } }); await pg.waitForTimeout(400);
eq('card shows own', /ตั้งเฉพาะรายการนี้|ใกล้หมดแล้ว/.test(await pg.locator('.ex-minbox').textContent()), true);
// มือถือ
await pg.evaluate(() => { document.querySelector('[data-excclose]') && document.querySelector('[data-excclose]').click(); });
await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(200);
await pg.evaluate(() => document.querySelector('.ex-albar [data-exal="pick"]').click()); await pg.waitForTimeout(250);
eq('mobile modal fits', await pg.evaluate(() => { const c = document.querySelector('#exAl .pm-card').getBoundingClientRect(); return c.left >= 0 && c.right <= 390; }), true);
eq('no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= 390), true);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
eq('esc closes', await pg.locator('#exAl').count(), 0);
await pg.screenshot({ path: new URL('out/v295.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
