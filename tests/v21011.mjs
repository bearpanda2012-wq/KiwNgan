// v2.101.1: ปุ่มสแกน QR แบบหน้า Sale ทุกหน้า
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.viewsFor=viewsFor;window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8874);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8874/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);

const views = await pg.evaluate(() => viewsFor(S.user).map(v => v.id));
const miss = [];
for (const v of views) { await pg.evaluate(v => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go(v); }, v); await pg.waitForTimeout(350); if (!await pg.locator('.topbar .top-scan').count()) miss.push(v); }
eq('scan button on every page', miss, []);
eq('views checked', views.length > 5, true);
await pg.evaluate(() => T.go('home')); await pg.waitForTimeout(500);
const st = await pg.evaluate(() => { const b = document.querySelector('.topbar .top-scan'), c = getComputedStyle(b); return [c.fontWeight, c.backgroundColor, b.textContent.trim()]; });
eq('white pill, bold, label', [+st[0] >= 700, /255, 255, 255/.test(st[1]), st[2]], [true, true, 'สแกน QR']);
await pg.locator('.topbar').screenshot({ path: new URL('out/v21011a.png', import.meta.url).pathname });
await pg.click('.topbar .top-scan'); await pg.waitForTimeout(500);
eq('scan opens', await pg.locator('#scanModal').count(), 1);
await pg.click('#scanModal [data-scanx]'); await pg.waitForTimeout(200);
await pg.setViewportSize({ width: 390, height: 800 }); await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(500);
eq('label visible on mobile', await pg.locator('.topbar .top-scan span').isVisible(), true);
await pg.locator('.topbar').screenshot({ path: new URL('out/v21011m.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
