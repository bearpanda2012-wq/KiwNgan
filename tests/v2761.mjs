// v2.76.1: กดการ์ดขั้นตอนในภาพรวมบริษัท → เลื่อนไปที่รายการงานของขั้นนั้น
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8912);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 640 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8912/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('flow'); window.scrollTo(0, 0); document.querySelectorAll('.main,.content').forEach(e => e.scrollTop = 0); }); await pg.waitForTimeout(900);
const top = () => pg.evaluate(() => Math.round(document.querySelector('.qchips').getBoundingClientRect().top));
const before = await top();
await pg.click('.co-pipe [data-cf="design"]'); await pg.waitForTimeout(1200);
const after = await top();
eq('filter applied', await pg.evaluate(() => S.cf), "design");
eq('list scrolled into view (near top)', [before > 300, after >= 0 && after < 160], [true, true]);
eq('rows shown are design step', await pg.evaluate(() => [...document.querySelectorAll('.co-row')].every(r => r.classList.contains('co-design'))), true);
// ชิปกรองในรายการไม่ทำให้เลื่อน
await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); const b2 = await top();
await pg.evaluate(() => { const c = document.querySelector('.qchips [data-cf="late"]'); if (c) c.click(); }); await pg.waitForTimeout(800);   // กดผ่านหน้าเว็บ (ไม่ให้ตัวทดสอบเลื่อนหาปุ่มเอง)
eq('chips below do not trigger jump', Math.abs((await top()) - b2) < 5, true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
