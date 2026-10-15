// v2.96: หน้า Sale มีรูปตัวอย่างเล็กข้างเลข Job (แถวติดตามงาน + ตาราง) · กดรูป = ดูรูปเต็มจอ ไม่เปิดรายละเอียด
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8852);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8852/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
// ภาพรวมบริษัท: มีป้ายวันที่แบบหน้า Sale
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('flow'); }); await pg.waitForTimeout(900);
eq('company rows have date badge', await pg.evaluate(() => document.querySelectorAll('.co-row .sf-date .sf-cal').length > 5), true);
eq('design row badge says due', await pg.evaluate(() => { const r = document.querySelector('.co-row.co-design .sf-dl small'); return r && r.textContent; }), 'กำหนดส่งแบบ');
// ใส่รูปให้งานหนึ่ง แล้วเปิดหน้า Sale
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const code = await pg.evaluate(async px => { const j = S.jobs.find(x => x.status === 'doing'); await T.api().addImage({ jobId: j.id, thumb: px, full: px }); return j.code; }, PX);
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:8852/index.html?salek=' + key); await pg.waitForTimeout(1500);
const row = pg.locator('.co-row[data-shov="' + code + '"]');
const n = await pg.locator('.co-row[data-shov="' + code + '"] .mth[data-gal] img').count();
eq('flow: row with photo shows small preview', n, 1);
eq('flow: camera count chip gone', await pg.locator('.co-row .co-ph').count(), 0);
eq('flow: rows without photos have no preview', await pg.evaluate(() => [...document.querySelectorAll('.co-row')].filter(r => r.querySelector('.mth')).length), 1);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
await pg.locator('.co-row[data-shov="' + code + '"] .mth').click(); await pg.waitForTimeout(500);
eq('flow: click preview → photo viewer, row not expanded', await pg.evaluate(c => [!!document.querySelector('#imgView.open'), !!document.querySelector('.sf-item.open')], code), [true, false]);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.locator('.co-row[data-shov="' + code + '"]').screenshot({ path: out + 'v296-flow.png' });
// ตาราง
await pg.click('[data-sfview="table"]'); await pg.waitForTimeout(900);
eq('table: preview next to job code', await pg.locator('tr.sp-r[data-shov="' + code + '"] .mth[data-gal] img').count(), 1);
await pg.locator('tr.sp-r[data-shov="' + code + '"] .mth').click(); await pg.waitForTimeout(500);
eq('table: click opens viewer', await pg.locator('#imgView.open').count(), 1);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.locator('tr.sp-r[data-shov="' + code + '"]').screenshot({ path: out + 'v296-table.png' });
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.click('[data-sfview="flow"]'); await pg.waitForTimeout(800);
eq('mobile: no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.screenshot({ path: out + 'v296-mobile.png' });
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
