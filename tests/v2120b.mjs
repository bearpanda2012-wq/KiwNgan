// v2.120: แอดมินตั้งค่า แสดง/ซ่อน หน้าและส่วนต่าง ๆ (ทุกคน / บางฝ่าย)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,viewsFor,uiHidden};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8921);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8921/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(500);
eq('settings has show/hide section', await pg.locator('#s-show .uh-g').count() >= 9, true);
// ซ่อนส่วน "คิวงานแต่ละเครื่อง" จากทุกคน + ซ่อนหน้า "คลังความรู้" เฉพาะแอดมิน
await pg.evaluate(() => { document.querySelectorAll('#s-show details').forEach(d => d.open = true); });
await pg.click('[data-uhk="prod.mq"][data-uhv="all"]'); await pg.waitForTimeout(150);
await pg.click('[data-uhk="v.kb"][data-uhv="some"]'); await pg.waitForTimeout(150);
await pg.check('[data-uhdep="v.kb"][value="a"]'); await pg.waitForTimeout(100); await pg.uncheck('[data-uhdep="v.kb"][value="d"]'); await pg.waitForTimeout(150);
eq('draft hide', await pg.evaluate(() => S.draft.hide), { 'prod.mq': 1, 'v.kb': ['a'] });
await pg.locator('#s-show').screenshot({ path: out + 'v2120-show.png' }).catch(() => {});
await pg.click('#savebar .btn.primary'); await pg.waitForTimeout(1200);
eq('saved', await pg.evaluate(() => S.settings.hide), { 'prod.mq': 1, 'v.kb': ['a'] });
eq('kb page gone from admin menu', await pg.evaluate(() => T.viewsFor(S.user).some(v => v.id === 'kb')), false);
eq('kb still visible for ฝ่ายแบบ', await pg.evaluate(() => T.viewsFor({ role: 'user', name: 'x' }).some(v => v.id === 'kb')), true);
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
eq('machine queue hidden', await pg.evaluate(() => getComputedStyle(document.querySelector('#view .mq')).display), 'none');
eq('other prod parts still shown', await pg.evaluate(() => getComputedStyle(document.querySelector('#view .pflow')).display !== 'none'), true);
await pg.evaluate(() => T.go('kb')); await pg.waitForTimeout(500);
eq('hidden page redirects', await pg.evaluate(() => S.view !== 'kb'), true);
// ล้างการซ่อน
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(400); await pg.click('[data-uhreset]'); await pg.click('#savebar .btn.primary'); await pg.waitForTimeout(1200);
eq('reset shows all', [await pg.evaluate(() => Object.keys(S.settings.hide || {}).length), await pg.evaluate(() => T.viewsFor(S.user).some(v => v.id === 'kb'))], [0, true]);
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
