// v2.80: ตรวจทั้งระบบ — ไอคอนสถานะเชื่อมต่อ · การ์ดลอยไม่ค้าง · PIN Sale ไม่ล้น · ปุ่มสถานะมือถือ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8805);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:8805/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// สถานะเชื่อมต่อเป็นไอคอน ไม่มีข้อความ
eq('connection badge sits on the avatar inside the user card', await pg.evaluate(() => { const c = document.querySelector('#railFoot .me-chip .me-av .conn'), a = document.querySelector('#railFoot .me-av .av'); if (!c || !a) return null; const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect(); return [!!c.querySelector('svg'), c.textContent.trim(), !!c.getAttribute('aria-label'), cr.right > ar.left + ar.width / 2 && cr.bottom > ar.top + ar.height / 2]; }), [true, '', true, true]);
await pg.locator('#railFoot').screenshot({ path: new URL('out/v2801-foot.png', import.meta.url).pathname });
// การ์ดลอยไม่ค้างหลังเปลี่ยนหน้า
await pg.evaluate(() => T.go('list')); await pg.waitForTimeout(700);
await pg.hover('.row[data-open], [data-open]'); await pg.waitForTimeout(900);
const sh = () => pg.evaluate(() => { const h = document.querySelector('#hovercard'); return !!h && h.classList.contains('show'); });
const s1 = await sh(); await pg.evaluate(() => T.go('report')); await pg.waitForTimeout(600);
eq('hover preview hides when page changes', [s1, await sh()], [true, false]);
// ปุ่มตั้ง PIN ของ Sale ไม่ล้นการ์ดบนจอ 1024
await pg.setViewportSize({ width: 1024, height: 760 }); await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800);
eq('sale PIN buttons stay inside card at 1024px', await pg.evaluate(() => { const s = document.querySelector('#s-salelink').getBoundingClientRect(); return [...document.querySelectorAll('#s-salelink .pin-set .btn')].every(b => b.getBoundingClientRect().right <= s.right + 1); }), true);
// บอร์ดงาน: วันที่ส่งไม่ถูกตัด เลข Job เห็นครบ (คอลัมน์แคบแบบจอ 1325 + เมนูซ้าย)
await pg.setViewportSize({ width: 1325, height: 868 }); await pg.evaluate(() => { S.jobs.forEach((j, i) => { if (i % 3 === 0) j.sale = 'บริษัท เฟรนด์ลี่แคช จำกัด(คุณเล็ก)'; if (i % 4 === 1 && j.status !== 'done') j.due = new Date(Date.now() + 864e5 + 7 * 3600e3).toISOString().slice(0, 10); }); T.go('board'); }); await pg.waitForTimeout(900);
const clip = await pg.evaluate(() => [...document.querySelectorAll('.board .card')].filter(c => c.offsetParent).map(c => { const cb = c.getBoundingClientRect(), d = c.querySelector('.card-foot .due'), k = c.querySelector('.code'); return { due: d ? (d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= cb.right + 1) : true, code: k ? k.scrollWidth <= k.clientWidth + 1 : true }; }));
eq('board: every due date fully visible', clip.every(x => x.due), true);
eq('board: job codes not cut', clip.every(x => x.code), true);
eq('board: avatars stay round', await pg.evaluate(() => [...document.querySelectorAll('.board .card .card-foot .av')].filter(a => a.offsetParent).every(a => { const r = a.getBoundingClientRect(); return Math.abs(r.width - r.height) < 2; })), true);
await pg.locator('.board .col').first().screenshot({ path: new URL('out/v280-board.png', import.meta.url).pathname });
// มือถือ: ปุ่มสถานะไม่หักกลางคำ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.go('list')); await pg.waitForTimeout(500);
await pg.click('.fab'); await pg.waitForTimeout(700);
eq('status buttons single-line on phone', await pg.evaluate(() => [...document.querySelectorAll('.seg.status button')].every(b => b.getBoundingClientRect().height < 50)), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
