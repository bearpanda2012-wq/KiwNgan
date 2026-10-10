// v2.59: เมนูล่างมือถืออยู่แถวเดียวเสมอ (ไม่มีหัวกลุ่ม) แม้ระบบวาดเมนูใหม่ตอนมีข้อความเข้า · หน้าเข้าสู่ระบบ Sale แบบใหม่
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,markChanRead};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8797);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const shot = n => pg.screenshot({ path: new URL('out/' + n + '.png', import.meta.url).pathname });
await pg.goto('http://127.0.0.1:8797/index.html'); await pg.waitForTimeout(700);
// Sale tile + PIN panel
eq('sale tile shown', await pg.locator('.sx-tile').count(), 1);
await pg.locator('.sx-tile').scrollIntoViewIfNeeded(); await pg.waitForTimeout(700); await shot('sale-tile');
eq('sale tile layout: icon left, text middle', await pg.evaluate(() => { const t = document.querySelector('.sx-tile').getBoundingClientRect(), i = document.querySelector('.sx-tile .sx-ic').getBoundingClientRect(), x = document.querySelector('.sx-tile .sx-t').getBoundingClientRect(); return i.left < x.left && i.top < t.top + t.height / 2 && i.bottom > t.top + t.height / 2; }), true);
await pg.click('.sx-tile'); await pg.waitForTimeout(400);
eq('PIN panel with 4 dots', await pg.locator('#saleForm .sx-dots i').count(), 4);
await pg.fill('#salePin', '12'); await pg.waitForTimeout(100);
eq('dots fill as you type, button disabled <4', [await pg.locator('#saleForm .sx-dots i.on').count(), await pg.locator('#saleForm .sx-btn').isDisabled()], [2, true]);
await pg.fill('#salePin', '0000'); await pg.waitForTimeout(700);
eq('4 digits auto-submit; wrong PIN shakes + message', [await pg.locator('#saleForm.bad').count(), await pg.locator('#saleForm .sx-err').textContent()], [1, 'PIN ไม่ถูกต้อง']);
await shot('sale-pin');
await pg.click('[data-act="saleoff"]'); await pg.waitForTimeout(300);
// staff login → bottom tab bar
await pg.click('.who:has-text("ต้น")'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1300);
const row = () => pg.evaluate(() => { const tb = document.querySelector('#tabbar'), bs = [...tb.querySelectorAll('button')]; return { heads: tb.querySelectorAll('.nav-h').length, oneRow: new Set(bs.map(x => Math.round(x.getBoundingClientRect().top))).size === 1, h: Math.round(tb.getBoundingClientRect().height) }; });
let r1 = await row(); eq('tab bar: no group headers, one row', [r1.heads, r1.oneRow, r1.h < 90], [0, true, true]);
await pg.evaluate(() => T.markChanRead('team').catch(() => {})); await pg.waitForTimeout(400);
r1 = await row(); eq('still one row after message redraw', [r1.heads, r1.oneRow, r1.h < 90], [0, true, true]);
await shot('tabbar');
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
