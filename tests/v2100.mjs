// v2.100: ดูตามแผนก — ค้นหารหัสแผนก (เช่น C20) เห็นรับเข้า · เบิกออก · คงเหลือ ทั้งหมดของแผนกนั้น
// ข้อมูลจำลอง (ไม่ใช้ข้อมูลจริงของบริษัท) · ถ้ามี tests/out/exfix.json (ข้อมูลจริง ไม่ขึ้น git) จะใช้ทดสอบความเร็วด้วย
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8871;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,exStart,exSync};window.exPendText=exPendText;window.digestCalc=digestCalc;window.S=S;window.SV=SV;window.EX=EX;window.EV=EV;window.exDepText=exDepText;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
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
const tabs = { units: { 'ส': 'เส้น', 'กป': 'กระป๋อง', 'ชน': 'ชิ้น', 'ผน': 'แผ่น' }, locs: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.', ZZ: 'เศษ', CU: 'วัสดุลูกค้า' }, groups: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.อื่น', ZZ: 'เศษวัสดุ', CU: 'ลูกค้า' }, deps: { '115': ',ฝ่ายผลิต', 'C20': 'พีอาร์เอ็กซ์ เอ็นเตอร์ไพรส์,Facade อาคาร PRX พัทยา', 'C43': 'เดอะ วันเปอร์เซนต์ เซอร์วิส,Facade คุณอาย พัทยา' } };
moves.push(['IV6910002', '20991026', 'RM', '9', 1, 760, 760, '', 'C20', 'ล่วงหน้า', 'RM-SB-02-0104']);
const dmv = [['OU6910034', td, 'RM', '6', 3, 760, 2280, 'สต็อก', 'C20', 'เหล็กกล่อง', 'RM-SB-02-0104', 'ROY69'], ['RR6910050', td, 'RM', '1', 10, 760, 7600, 'สต็อก', 'C20', 'เหล็กกล่อง', 'RM-SB-02-0104', 'ROY69'], ['IV6910002', td, 'GST1', '9', 1, 174.77, 174.77, '', 'C20', 'สี', 'GST-CL-FSS8083', 'ROY69']];
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
  else if (fn === 'ex_dep') out = String(body.dep).toUpperCase() === 'C20' ? dmv : [];
  else if (fn === 'ex_deps') out = [['C20', 3, td], ['C43', 0, td]];
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

// v2.101.2: เคลื่อนไหว 7 วัน — วันที่มีปี · ล่วงหน้าอยู่ล่างสุด · หัววันนี้
await pg.evaluate(() => { EX.recentAt = 0; EX.recent = null; T.exSync(true); }); await pg.waitForTimeout(1200);
const hd = await pg.$$eval('#exHist .ex-day b', a => a.map(x => x.textContent));
eq('first day header is today', /^วันนี้ · \d+ \S+ 25\d\d$/.test(hd[0] || ''), true);
eq('future group last', /ลงวันที่ล่วงหน้า/.test(hd[hd.length - 1] || ''), true);
eq('row date has BE year', /\d+ \S+ 25\d\d · /.test(await pg.locator('#exHist li[data-excard] small').first().textContent()), true);
eq('freshness label', /อัปเดต/.test(await pg.locator('#exHist .ex-fresh').textContent()), true);
await pg.locator('#exHist').screenshot({ path: new URL('out/v21012.png', import.meta.url).pathname });
// 1) พิมพ์ C20 ในช่องค้นหา → มีปุ่มแผนก C20
await pg.fill('#exQ', 'C20'); await pg.waitForTimeout(300);
eq('dept strip shows C20', await pg.locator('.ex-depstrip [data-exdep="C20"]').count(), 1);
await pg.click('.ex-depstrip [data-exdep="C20"]');
await pg.waitForFunction(() => document.querySelectorAll('#exDep .ex-dt tbody tr').length > 0, null, { timeout: 5000 }).catch(() => {});
eq('modal title C20', (await pg.locator('#exDep h3').textContent()).trim(), 'C20');
eq('summary rows = 2 items', await pg.locator('#exDep .ex-dt tbody tr').count(), 2);
const net = await pg.locator('#exDep .ex-dt tr[data-excard="RM-SB-02-0104"] td.b b').textContent();
eq('express-style columns', await pg.$$eval('#exDep .ex-dt thead th', a => a.map(x => x.textContent.trim())), ['สินค้า', 'ขาย', 'รับเข้า', 'จ่ายออก', 'คงเหลือ']);
eq('balance = in 10 − out 3 = 7', net.trim(), '7');
eq('kpi in count', (await pg.locator('#exDep .ex-depk .k-in b').textContent()).trim(), '1');
eq('kpi out count', (await pg.locator('#exDep .ex-depk .k-out b').textContent()).trim(), '2');
await pg.waitForTimeout(600); await pg.screenshot({ path: new URL('out/v2100a.png', import.meta.url).pathname });
await pg.click('#exDep [role="tab"][data-exdeptab="out"]'); await pg.waitForTimeout(150);
eq('out tab rows', await pg.locator('#exDep .ex-depm .ex-cr.out').count(), 2);
await pg.click('#exDep [role="tab"][data-exdeptab="in"]'); await pg.waitForTimeout(150);
eq('in tab rows', await pg.locator('#exDep .ex-depm .ex-cr.in').count(), 1);
await pg.screenshot({ path: new URL('out/v2100b.png', import.meta.url).pathname });
// กรองในแผนก
await pg.click('#exDep [role="tab"][data-exdeptab="sum"]'); await pg.fill('#exDepF', 'GST'); await pg.waitForTimeout(150);
eq('filter keeps 1 row', await pg.locator('#exDep .ex-dt tbody tr').count(), 1);
eq('copy text has balance line', (await pg.evaluate(() => exDepText())).includes('รับเข้า 10 จ่ายออก 3 · เข้า 10 ออก 3 = 7'), true);
// กดแถว → การ์ดสินค้าเปิดบนหน้าแผนก · Esc ปิดการ์ดก่อน แผนกยังอยู่
await pg.click('#exDep .ex-dt tbody tr'); await pg.waitForTimeout(400);
eq('item card opened', await pg.locator('#exModal').count(), 1);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
eq('card closed, dept stays', [await pg.locator('#exModal').count(), await pg.locator('#exDep').count()], [0, 1]);
// เปลี่ยนแผนก → เลือก C43 (ไม่มีรายการ)
await pg.click('[data-exdeppick]'); await pg.waitForTimeout(150);
await pg.fill('#exDepQ', 'คุณอาย'); await pg.waitForTimeout(150);
eq('picker finds by name', await pg.locator('#exDep .ex-deplist [data-exdep="C43"]').count(), 1);
await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
eq('C43 empty state', (await pg.locator('#exDep .sk-empty b').textContent()).includes('C43'), true);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
eq('modal closed', await pg.locator('#exDep').count(), 0);
// ปุ่มดูตามแผนก ในแถบเครื่องมือ
await pg.fill('#exQ', ''); await pg.waitForTimeout(200);
await pg.click('.ex-depbtn'); await pg.waitForTimeout(300);
await pg.fill('#exDepQ', 'c20'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
eq('lowercase c20 opens C20', (await pg.locator('#exDep h3').textContent()).trim(), 'C20');
await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(200);
await pg.screenshot({ path: new URL('out/v2100m.png', import.meta.url).pathname });
// v2.100.2: มือถือ — ช่องค้นหาแผนกไม่ยืดสูง · ปุ่มแผนกมีคำว่า "แผนก"
await pg.emulateMedia({ colorScheme: 'dark' });
await pg.click('[data-exdeppick]'); await pg.waitForTimeout(300);
eq('picker search height normal', (await pg.locator('#exDep .ex-depq').boundingBox()).height < 60, true);
await pg.screenshot({ path: new URL('out/v2100p.png', import.meta.url).pathname });
await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('dept button shows label on mobile', (await pg.locator('.ex-depbtn b').isVisible()), true);
await pg.evaluate(() => { document.querySelector('.ex-tools').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await pg.locator('.ex-tools').screenshot({ path: new URL('out/v2100t.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
