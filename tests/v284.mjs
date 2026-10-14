// v2.84: สต็อกจาก Express — แท็บ "ยอดจาก Express" · ดึงเฉพาะที่เปลี่ยน · ค้นหา · กรองกลุ่ม/คลัง · สต็อกการ์ด · สถานะตัวซิงก์ · แคชในเครื่อง
// ข้อมูลจำลอง (ไม่ใช้ข้อมูลจริงของบริษัท) · ถ้ามี tests/out/exfix.json (ข้อมูลจริง ไม่ขึ้น git) จะใช้ทดสอบความเร็วด้วย
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8832;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,exStart,exSync};window.S=S;window.SV=SV;window.EX=EX;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
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
eq('no Express tab without config', await pg.locator('.ex-tabs').count(), 0);
await pg.evaluate(() => T.exStart({ url: 'https://ex.test', key: 'k', tok: 'exr_test_token_123456789012345' })); await pg.waitForTimeout(800);
eq('tabs appear', await pg.locator('.ex-tabs [data-exsrc="ex"]').count(), 1);
await pg.click('[data-exsrc="ex"]');
await pg.waitForFunction(() => document.querySelectorAll('.ex-row').length > 0, null, { timeout: 8000 }).catch(() => {});
eq('paged pull: since 0 → 2000 (more) → done', pulls.slice(0, 2), [0, 2000]);
eq('all items loaded', await pg.evaluate(() => EX.items.size), items.length);
eq('status says connected', await pg.evaluate(() => document.querySelector('.ex-status').className.includes('on') && /เชื่อมกับ Express/.test(document.querySelector('.ex-status b').textContent)), true);
eq('default shows only items with balance', await pg.evaluate(() => document.querySelector('.sk-main .panel-h .sub').textContent), items.filter(x => Math.abs(x[6]) > 1e-9).length.toLocaleString('th-TH') + ' รายการ');
eq('unit + location names mapped', await pg.evaluate(() => { const r = document.querySelector('.ex-row[data-excard="RM-SB-02-0104"]'); return r && [r.querySelector('.ex-q small').textContent, r.querySelector('.ex-locs i').title]; }), ['เส้น', 'วัตถุดิบ']);
eq('negative item highlighted', await pg.locator('.ex-row.neg').count(), 1);
// ค้นหา: ไม่ต้องพิมพ์ขีด · ค้นทุกรหัสแม้ยอด 0
await pg.fill('#exQ', 'rmsb020104'); await pg.waitForTimeout(300);
eq('search without dashes', await pg.evaluate(() => [...document.querySelectorAll('.ex-row')].map(r => r.dataset.excard)), ['RM-SB-02-0104']);
await pg.fill('#exQ', 'ZZ-00001'); await pg.waitForTimeout(300);
eq('search includes zero-balance codes', await pg.evaluate(() => [...document.querySelectorAll('.ex-row')].some(r => r.dataset.excard === 'ZZ-00001')), true);
await pg.fill('#exQ', 'สีน้ำ toa'); await pg.waitForTimeout(300);
eq('multi-word Thai search', await pg.evaluate(() => [...document.querySelectorAll('.ex-row')].map(r => r.dataset.excard)), ['GST-CL-FSS8083']);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('Esc clears', await pg.evaluate(() => document.querySelector('#exQ').value), '');
// กรองกลุ่ม · คลัง
await pg.click('[data-exgrp="neg"].qchip'); await pg.waitForTimeout(200);
eq('negative filter', await pg.evaluate(() => [...document.querySelectorAll('.ex-row')].map(r => r.dataset.excard)), ['NEG-001']);
await pg.click('[data-exgrp="bal"].qchip'); await pg.selectOption('[data-exloc]', 'GST1'); await pg.waitForTimeout(200);
eq('location filter', await pg.evaluate(() => [...document.querySelectorAll('.ex-row')].map(r => r.dataset.excard)), ['GST-CL-FSS8083']);
await pg.selectOption('[data-exloc]', ''); await pg.waitForTimeout(200);
// เคลื่อนไหวล่าสุด + สต็อกการ์ด
eq('recent moves listed', await pg.evaluate(() => document.querySelectorAll('.ex-log li').length), 2);
await pg.click('.ex-row[data-excard="RM-SB-02-0104"]'); await pg.waitForSelector('.ex-cr', { timeout: 5000 }).catch(() => {});
eq('stock card rows with in/out', await pg.evaluate(() => [...document.querySelectorAll('#exModal .ex-cr')].map(r => r.className.split(' ')[1] + ':' + r.querySelector('span:last-child b').textContent)), ['out:−2', 'in:+7']);
eq('card shows department name', await pg.evaluate(() => document.querySelector('#exModal .ex-cr').textContent.includes('ฝ่ายผลิต')), true);
await pg.locator('#exModal .pm-card').screenshot({ path: new URL('out/v284-card.png', import.meta.url).pathname });
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('Esc closes card', await pg.locator('#exModal').count(), 0);
// ยอดเปลี่ยนใน Express → ดึงเฉพาะส่วนที่เปลี่ยน
extra = { items: [['RM-SB-02-0104', 'เหล็กกล่อง 2 mm. 1"x4"', '', 'RM', '0', 'ส', 3, 2280, 760, '20260901', 760, 'SUP01', '', '', '20261014', 0], ['ZZ-00004', '', '', 'ZZ', '0', 'ชน', 0, 0, 0, '', 0, '', '', '', '', 1]], locs: [['RM-SB-02-0104', 'RM', 3, 2280, '20261014', 0]], tabs: {}, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: false, ver: 3002, top: 3002 };
await pg.click('[data-exsync]'); await pg.waitForTimeout(800);
eq('delta applied (balance + deleted code)', await pg.evaluate(() => [document.querySelector('.ex-row[data-excard="RM-SB-02-0104"] .ex-q b').textContent, EX.items.has('ZZ-00004'), EX.ver]), ['3', false, 3002]);
// แคชในเครื่อง: เปิดใหม่เห็นทันที และดึงต่อจาก ver เดิม
await pg.reload(); await pg.waitForTimeout(900);
pulls = [];
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('stock'); T.exStart({ url: 'https://ex.test', key: 'k', tok: 'exr_test_token_123456789012345' }); }); await pg.waitForTimeout(1200);
eq('remembers Express tab', await pg.evaluate(() => SV.src), 'ex');
eq('cache restored, pull resumes from saved ver', [await pg.evaluate(() => EX.items.size), pulls[0]], [items.length - 1, 3002]);
// ตัวซิงก์เงียบ → เตือน
agentAt = new Date(Date.now() - 40 * 60e3).toISOString(); extra = null;
await pg.click('[data-exsync]'); await pg.waitForTimeout(700);
eq('stale agent warning', await pg.evaluate(() => [document.querySelector('.ex-status').classList.contains('off'), /เงียบ/.test(document.querySelector('.ex-status b').textContent)]), [true, true]);
// สิทธิ์ผิด
await pg.evaluate(() => { EX.cfg.tok = 'wrong'; }); await pg.click('[data-exsync]'); await pg.waitForTimeout(600);
eq('bad token shown', await pg.evaluate(() => (document.querySelector('.ex-err') || {}).textContent), 'สิทธิ์อ่านข้อมูล Express ไม่ถูกต้อง');
await pg.evaluate(() => { EX.cfg.tok = 'exr_test_token_123456789012345'; EX.err = ''; T.render(); });
await pg.evaluate(() => scrollTo(0, 0)); await pg.screenshot({ path: new URL('out/v284-express.png', import.meta.url).pathname });
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
eq('phone: no sideways overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.click('.ex-row[data-excard="RM-SB-02-0104"]'); await pg.waitForTimeout(500);
eq('phone: card fits', await pg.evaluate(() => { const c = document.querySelector('#exModal .pm-card').getBoundingClientRect(); return c.right <= innerWidth + 1 && c.left >= -1; }), true);
await pg.screenshot({ path: new URL('out/v284-phone.png', import.meta.url).pathname });
await pg.keyboard.press('Escape');
// ข้อมูลจริง (ถ้ามีในเครื่อง): วาดหน้า 13,000+ รหัสได้เร็ว
if (real) {
  await pg.setViewportSize({ width: 1400, height: 900 });
  const ms = await pg.evaluate(r => { EX.items = new Map(r.items.map(x => [x[0], x])); EX.locs = new Map(r.locs.map(x => [x[0] + '|' + x[1], x])); EX.tabs = r.tabs; const t0 = performance.now(); T.render(); return performance.now() - t0; }, real);
  console.log('real data render ms', Math.round(ms), 'items', real.items.length);
  eq('real data renders under 400ms', ms < 400, true);
  await pg.locator('#view').screenshot({ path: new URL('out/v284-real.png', import.meta.url).pathname });
}
// เครื่องมือคลังในแอป (ใบขอซื้อ · นับสต็อก · แจ้งต้องสั่ง) ยังอยู่ในแท็บ Express
await pg.setViewportSize({ width: 1400, height: 900 }); await pg.evaluate(() => { SV.src = 'ex'; T.render(); }); await pg.waitForTimeout(300);
eq('Express tab still has buy-list + count buttons', await pg.evaluate(() => [!!document.querySelector('.ex-apptools [data-buyopen]'), !!document.querySelector('.ex-apptools [data-cntopen]')]), [true, true]);
await pg.click('.ex-apptools [data-cntopen]'); await pg.waitForTimeout(400);
eq('count opens from Express tab', await pg.locator('#cntModal').count(), 1);
await pg.keyboard.press('Escape'); await pg.evaluate(() => { const m = document.querySelector('#cntModal'); if (m) m.remove(); }); await pg.waitForTimeout(200);
await pg.click('.ex-apptools [data-buyopen]'); await pg.waitForTimeout(400);
eq('buy list opens from Express tab', await pg.locator('#buyModal').count(), 1);
await pg.evaluate(() => { const m = document.querySelector('#buyModal'); if (m) m.remove(); document.body.classList.remove('pm-open'); });
const hasNeed = await pg.locator('.ex-apptools .sk-alert').count();
if (hasNeed) { await pg.click('.ex-apptools .sk-alert'); await pg.waitForTimeout(400); eq('need-to-order alert jumps to app tab filtered', await pg.evaluate(() => [SV.src, SV.cat]), ['app', 'low']); await pg.evaluate(() => { SV.src = 'ex'; SV.cat = 'all'; T.render(); }); }
// ฝั่งแอปเดิมยังใช้ได้
await pg.click('[data-exsrc="app"]'); await pg.waitForTimeout(300);
eq('switch back to app stock', await pg.evaluate(() => !!document.querySelector('.sk-grid') && !document.querySelector('.ex-list')), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
