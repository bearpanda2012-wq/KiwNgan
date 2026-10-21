// v2.101: หน้า Sale — สแกน QR ฉลากงาน → เปิดรายละเอียดงาน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.scanHit=scanHit;window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8873);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8873/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);

const code = await pg.evaluate(() => S.jobs.find(x => x.status === 'doing').code);
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.setViewportSize({ width: 390, height: 800 });
await pg.goto('http://127.0.0.1:8873/index.html?salek=' + key); await pg.waitForTimeout(1500);
eq('scan button on sale header', await pg.locator('.sp-h .sp-scan').count(), 1);
eq('scan label visible on mobile', await pg.locator('.sp-h .sp-scan span').isVisible(), true);
await pg.screenshot({ path: new URL('out/v2101a.png', import.meta.url).pathname });
await pg.click('.sp-h .sp-scan'); await pg.waitForTimeout(700);
eq('scan modal opens', await pg.locator('#scanModal').count(), 1);
await pg.screenshot({ path: new URL('out/v2101b.png', import.meta.url).pathname });
await pg.click('#scanModal [data-scanx]'); await pg.waitForTimeout(300);
eq('scan modal closes', await pg.locator('#scanModal').count(), 0);
// สแกนลิงก์ฉลาก (?job=) → เปิดรายละเอียดงาน
await pg.click('.sp-h .sp-scan'); await pg.waitForTimeout(500);
eq('hit job link', await pg.evaluate(c => scanHit('https://example.com/KiwNgan/?job=' + encodeURIComponent(c)), code), true);
await pg.waitForTimeout(600);
eq('detail modal for scanned job', await pg.locator('#sdModal').count(), 1);
eq('detail shows the code', (await pg.locator('#sdModal').innerText()).includes(code), true);
await pg.screenshot({ path: new URL('out/v2101c.png', import.meta.url).pathname });
await pg.click('#sdModal [data-sdclose]'); await pg.waitForTimeout(200);
// สแกนเลข Job ตรง ๆ (ตัวพิมพ์เล็ก)
await pg.click('.sp-h .sp-scan'); await pg.waitForTimeout(400);
eq('hit raw code', await pg.evaluate(c => scanHit(c.toLowerCase()), code), true); await pg.waitForTimeout(600);
eq('detail opens from raw code', await pg.locator('#sdModal').count(), 1);
await pg.click('#sdModal [data-sdclose]'); await pg.waitForTimeout(200);
// QR ที่ไม่ใช่ฉลากงาน
await pg.click('.sp-h .sp-scan'); await pg.waitForTimeout(400);
eq('random QR rejected', await pg.evaluate(() => scanHit('hello world')), false);
eq('hint says not a job label', (await pg.locator('#scanModal .scan-hint').textContent()).includes('ไม่ใช่ฉลากงาน'), true);
await pg.click('#scanModal [data-scanx]'); await pg.waitForTimeout(200);
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
