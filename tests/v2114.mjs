// v2.114: สแกน QR งานที่ส่งแล้ว/นอกรายการที่กรอง → เปิดและบอกสถานะ · หน้า Sale มี QR ทุกงาน · สแกนในแอปหางานเก่าจากฐานข้อมูล
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.scanHit=scanHit;window.T={go,saveJob,api,Demo,prodOfCode};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8879);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8879/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);


// เตรียม: งานผลิตที่ส่งแล้วนาน (ไม่อยู่ในหน้า Sale) + งานที่ยังไม่ส่ง
const info = await pg.evaluate(() => { const D = T.Demo, d = D.db(); const p = d.prods.find(x => x.stage !== 'shipped') || d.prods[0];
  const old = Object.assign({}, p, { id: 'p_old1', code: 'OLD-2501', stage: 'shipped', shippedAt: '2025-01-10 10:00', enteredAt: '2025-01-02', ship: '{}' }); d.prods.push(old);
  d.jobs.push({ id: 'j_old1', code: 'OLD-2501', title: 'งานเก่ามาก', taskType: 'เขียนแบบ', status: 'done', received: '2024-12-20', due: '2024-12-28', finishedAt: '2025-01-01 10:00', sale: p.sale || '', group: '', checklist: '[]', minutes: 0 });
  D.save(d); return { live: p.code }; });
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:8879/index.html?salek=' + key); await pg.waitForTimeout(1600);
// QR ทุกงาน: กางรายการ → มี QR
const first = await pg.$('[data-sfopen]');
if (first) { await first.click(); await pg.waitForTimeout(900); }
eq('QR button in expanded item', await pg.locator('.sf-det [data-qrsale]').count() >= 1, true);
await pg.locator('.sf-det [data-qrsale]').first().click(); await pg.waitForTimeout(700);
eq('QR modal like production', await pg.locator('#qrModal .qr-prev svg').count(), 1);
eq('label sizes + print button', [await pg.locator('#qrModal [data-qrsize]').count(), await pg.locator('#qrModal [data-qrprint]').count()], [2, 1]);
await pg.locator('#qrModal .pm-card').screenshot({ path: out + 'v2114-sale-qrmodal.png' });
await pg.click('#qrModal [data-qrx]'); await pg.waitForTimeout(300);
eq('QR modal closes', await pg.locator('#qrModal').count(), 0);
await pg.locator('.sf-det').first().screenshot({ path: out + 'v2114-sale-qr.png' }).catch(() => {});
// กรองเฉพาะ "ส่งแล้ว" แล้วสแกนงานที่ยังไม่ส่ง → ยังเจอ (ไม่ดูแค่ที่กรองอยู่)
const tab = await pg.$('[data-sfstep="shipped"]'); if (tab) { await tab.click(); await pg.waitForTimeout(400); }
eq('scan job outside current filter', await pg.evaluate(c => scanHit('https://x/KiwNgan/?job=' + encodeURIComponent(c)), info.live), true);
await pg.waitForTimeout(800);
eq('detail opened', await pg.locator('#sdModal').count(), 1);
eq('status banner shown', await pg.locator('#sdModal .sd-scan').count(), 1);
eq('QR button in detail', await pg.locator('#sdModal [data-qrsale]').count(), 1);
eq('no inline QR image', await pg.locator('#sdModal .sd-qr-box').count(), 0);
await pg.click('#sdModal [data-sdclose]'); await pg.waitForTimeout(200);
// งานส่งแล้วนานจนไม่อยู่ในหน้า Sale → ค้นจากฐานข้อมูล แล้วบอกว่าส่งแล้ว
eq('scan old shipped job', await pg.evaluate(() => scanHit('https://x/KiwNgan/?job=OLD-2501')), true);
await pg.waitForTimeout(1500);
eq('old job detail opened', await pg.locator('#sdModal').count(), 1);
eq('says shipped', (await pg.locator('#sdModal .sd-scan').innerText()).includes('ส่งแล้ว'), true);
await pg.locator('#sdModal .pm-card').screenshot({ path: out + 'v2114-sale-scan.png' });
// เช็กลิสต์ในหน้า Sale แสดงทุกขั้น (ทำแล้ว ✓ / ขั้นถัดไป)
await pg.setViewportSize({ width: 1385, height: 830 });
const clc = await pg.evaluate(() => { const d = T.Demo.db(); const j = null && d.jobs.find(x => { try { const c = JSON.parse(x.checklist || '[]'); return c.length >= 3; } catch (e) { return false; } }); const jj = j || d.jobs.find(x => x.status !== 'done'); if (!jj) return null; const c = j ? JSON.parse(j.checklist) : ['วัดพื้นที่หน้างาน', 'ประชุม Concept และงบประมาณ', 'ออกแบบ (3D/VR · แบบสถาปัตย์ · แบบผลิตชิ้นงาน)', 'จัดหาเฟอร์นิเจอร์ ส่งรายการจัดซื้อ', 'ประสานงานหน้างาน', 'ตรวจงานหน้างาน', 'จัด Prop ตกแต่งห้อง', 'ถ่ายคลิป VDO ปิดงาน'].map(t => ({ t, d: 0 })); c[0].d = 1; c[0].by = 'อ๊อฟ'; c[0].at = '2026-10-20 10:00'; jj.checklist = JSON.stringify(c); T.Demo.save(d); return { code: jj.code, n: c.length }; });
if (clc) {
  await pg.goto('http://127.0.0.1:8879/index.html?salek=' + key); await pg.waitForTimeout(1600);
  await pg.evaluate(c => scanHit('https://x/KiwNgan/?job=' + encodeURIComponent(c)), clc.code); await pg.waitForTimeout(900);
  eq('checklist items listed', await pg.locator('#sdModal .sl-cl li').count() >= clc.n, true);
  eq('done item marked with who', (await pg.locator('#sdModal .sl-cl li.on').first().innerText()).includes('อ๊อฟ'), true);
  eq('next step highlighted', await pg.locator('#sdModal .sl-cl li.nx').count(), 1);
  await pg.locator('#sdModal .pm-card').screenshot({ path: out + 'v2115-sale-cl.png' });
}
// มุมมองตาราง: การ์ด "เลยกำหนด" นับตรงกับแถวที่ขึ้นป้ายแดง (ค้างเลยกำหนด + เสร็จช้ากว่ากำหนด)
await pg.evaluate(() => { const d = T.Demo.db(), j = d.jobs.find(x => x.status === 'done'); if (j) { j.due = '2026-01-01'; j.finishedAt = (j.finishedAt && j.finishedAt > '2026-01-02' ? j.finishedAt : '2026-10-10 10:00'); } T.Demo.save(d); });
await pg.goto('http://127.0.0.1:8879/index.html?salek=' + key); await pg.waitForTimeout(1400);
await pg.click('[data-sfview="table"]'); await pg.waitForTimeout(800);
await pg.click('[data-spst="late"]'); await pg.waitForTimeout(1500);
const lateN = +(await pg.getAttribute('[data-spst="late"] b', 'data-n'));
const rowsN = await pg.locator('tr.sp-r').count(), badN = await pg.locator('tr.sp-r .sp-bdg.bad').count();
eq('late card count = rows shown', [lateN > 0, lateN === rowsN, badN === rowsN], [true, true, true]);
await pg.locator('.sp-sum').screenshot({ path: out + 'v2115-late.png' });
await pg.setViewportSize({ width: 1400, height: 900 }); await pg.waitForTimeout(300);
await pg.locator('.sp-wrap').screenshot({ path: out + 'v2115-table.png', clip: undefined }).catch(() => {});
// ในแอป: งานผลิตเก่าที่ไม่ได้โหลดมา → สแกนแล้วค้นจากฐานข้อมูล
await pg.goto('http://127.0.0.1:8879/index.html'); await pg.waitForTimeout(1500);
await pg.evaluate(() => { S.prods = S.prods.filter(p => p.code !== 'OLD-2501'); S.jobs = S.jobs.filter(j => j.code !== 'OLD-2501'); });
eq('app: not loaded', await pg.evaluate(() => !!T.prodOfCode('OLD-2501')), false);
eq('app: scan hit', await pg.evaluate(() => scanHit('https://x/KiwNgan/?job=OLD-2501')), true);
await pg.waitForTimeout(1500);
eq('app: found via lookup', await pg.evaluate(() => !!T.prodOfCode('OLD-2501')), true);
eq('app: status toast', (await pg.locator('.toast').allInnerTexts()).join(' ').includes('ส่งแล้ว'), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
