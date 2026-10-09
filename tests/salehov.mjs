// หน้า Sale: การ์ดลอยรายละเอียด + รูป, ภาพรวมบริษัท: ป้ายวันที่
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8794);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8794/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
// ภาพรวมบริษัท: มีป้ายวันที่แบบหน้า Sale
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('flow'); }); await pg.waitForTimeout(900);
eq('company rows have date badge', await pg.evaluate(() => document.querySelectorAll('.co-row .sf-date .sf-cal').length > 5), true);
eq('design row badge says due', await pg.evaluate(() => { const r = document.querySelector('.co-row.co-design .sf-dl small'); return r && r.textContent; }), 'กำหนดส่งแบบ');
// ใส่รูปให้งานหนึ่ง แล้วเปิดหน้า Sale
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const code = await pg.evaluate(async px => { const j = S.jobs.find(x => x.status === 'doing'); await T.api().addImage({ jobId: j.id, thumb: px, full: px }); return j.code; }, PX);
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:8794/index.html?salek=' + key); await pg.waitForTimeout(1500);
const row = pg.locator('.co-row[data-shov="' + code + '"]');
eq('sale row exists', await row.count(), 1); if (!await row.count()) console.log(await pg.evaluate(() => [...document.querySelectorAll('[data-shov]')].map(e => e.dataset.shov).join(',') + ' | ' + document.body.innerText.slice(0, 900)));
await row.hover(); await pg.waitForTimeout(900);
eq('sale hover shows', await pg.locator('#hovercard.show').count(), 1);
eq('sale hover has image', await pg.locator('#hovercard .hv-hero img').count(), 1);
eq('sale hover shows assignee', await pg.locator('#hovercard .hv-who').count() > 0, true);
eq('sale hover fits screen', await pg.evaluate(() => { const r = document.querySelector('#hovercard').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; }), true);
await pg.screenshot({ path: out + 'sale-hover.png' });
await pg.mouse.move(5, 5); await pg.waitForTimeout(500);
await row.click(); await pg.waitForTimeout(400);
eq('expanded detail shows image strip', await pg.locator('.sf-item.open .sf-imgs img').count(), 1);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
