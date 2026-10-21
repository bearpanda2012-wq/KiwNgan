// v2.102.1: หน้า Sale — ปุ่มออกจากระบบ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.scanHit=scanHit;window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8876);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8876/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);


// เข้าผ่านหน้าเข้าสู่ระบบด้วย PIN (เหมือนผู้ใช้จริง) → จำ saleKey
await pg.evaluate(async () => { const r = await T.api().saleOpen({ pin: '1234' }); window.__k = r.key; });
const key = await pg.evaluate(() => window.__k);
await pg.evaluate(k => localStorage.setItem('kiwngan:saleKey', JSON.stringify(k)), key);
await pg.goto('http://127.0.0.1:8876/index.html?salek=' + key); await pg.waitForTimeout(1500);
eq('back-to-login link shows (key remembered)', await pg.locator('.sp-h .sp-back').count(), 1);
eq('logout button on header', await pg.locator('.sp-h [data-saleout]').count(), 1);
await pg.locator('.sp-h').screenshot({ path: new URL('out/v21021.png', import.meta.url).pathname });
eq('buttons same height', await pg.$$eval('.sp-h .sp-hb', a => new Set(a.map(b => Math.round(b.getBoundingClientRect().height))).size), 1);
eq('buttons on one line', await pg.$$eval('.sp-h .sp-hb', a => new Set(a.map(b => Math.round(b.getBoundingClientRect().top))).size), 1);
await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(300);
await pg.locator('.sp-h').screenshot({ path: new URL('out/v21023m.png', import.meta.url).pathname });
eq('mobile: buttons on one line', await pg.$$eval('.sp-h .sp-hb', a => new Set(a.map(b => Math.round(b.getBoundingClientRect().top))).size), 1);
await pg.setViewportSize({ width: 1300, height: 800 }); await pg.waitForTimeout(300);
await pg.click('.sp-h [data-saleout]'); await pg.waitForTimeout(200);
eq('first click asks to confirm', (await pg.locator('.sp-h [data-saleout] span').textContent()).includes('กดอีกครั้ง'), true);
await pg.locator('.sp-h').screenshot({ path: new URL('out/v21021b.png', import.meta.url).pathname });
await Promise.all([pg.waitForNavigation({ timeout: 8000 }).catch(() => {}), pg.click('.sp-h [data-saleout]')]); await pg.waitForTimeout(1200);
eq('back to login (no salek in url)', new URL(pg.url()).search, '');
eq('saved sale key removed', await pg.evaluate(() => Object.keys(localStorage).filter(k => /saleKey|saleCache:/.test(k)).length), 0);
eq('sale page gone', await pg.locator('.sale-page').count(), 0);
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
