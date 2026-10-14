// v2.82: ช่องค้นหาภาพรวมบริษัท — ค้นทุกงาน (รวมที่ส่งแล้ว/ออกแบบเสร็จนานแล้ว) · ไม่ต้องพิมพ์ขีด · ไฮไลต์ · พิมพ์ต่อได้แม้ข้อมูลซิงก์เข้ามาระหว่างพิมพ์
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8820;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,coRows,render};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('flow'); }); await pg.waitForTimeout(700);
// เตรียมงานเก่า: งานออกแบบเสร็จนาน 60 วัน (ไม่อยู่ในสาย) + งานผลิตส่งแล้ว 40 วัน
const old = await pg.evaluate(() => {
  const d = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10), j = S.jobs.find(x => x.status === 'done');
  j.code = 'R69-07028'; j.title = 'ป้ายร้านคุณอิตา'; j.finishedAt = d + 'T10:00:00'; j.sale = 'โย';
  const p = (S.prods || []).find(x => x.stage === 'shipped') || (S.prods || [])[0]; if (p) { p.stage = 'shipped'; p.shippedAt = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10) + 'T09:00:00'; }
  T.render(); return { live: T.coRows().some(r => r.code === 'R69-07028'), pcode: p && p.code };
});
eq('old jobs are not in the normal list', old.live, false);
const type = async q => { await pg.click('#cq', { clickCount: 3 }); await pg.keyboard.press('Backspace'); await pg.keyboard.type(q, { delay: 25 }); await pg.waitForTimeout(350); return pg.evaluate(() => [...document.querySelectorAll('.co-row .co-code b')].map(b => b.textContent)); };
let r = await type('R69-07028');
eq('finished long ago: found by full code', r[0], 'R69-07028');
r = await type('7028'); eq('found by last digits', r.includes('R69-07028'), true);
r = await type('6907028'); eq('found without dash', r[0], 'R69-07028');
r = await type('r69 07028'); eq('lowercase + space works', r[0], 'R69-07028');
r = await type('คุณอิตา'); eq('found by customer name (Thai)', r.includes('R69-07028'), true);
eq('match highlighted', await pg.evaluate(() => (document.querySelector('.co-row mark') || {}).textContent), 'คุณอิตา');
eq('result count + scope note shown, filter chips hidden', await pg.evaluate(() => [!!document.querySelector('.co-sres b'), document.querySelectorAll('.qchips').length]), [true, 0]);
if (old.pcode) { r = await type(old.pcode); eq('shipped 40 days ago still found', r.includes(old.pcode), true); }
r = await type('โย'); eq('found by sale name', r.includes('R69-07028'), true);
// เลข Job ตรงเป๊ะขึ้นก่อน
r = await type('07028'); eq('exact/prefix code match first', r[0], 'R69-07028');
// ไม่เจอ → กล่องบอกวิธี + ปุ่มล้าง
await type('ZZZ-NOPE'); eq('no result: helpful empty state', await pg.evaluate(() => !!document.querySelector('.co-none [data-cqclear]')), true);
await pg.click('.co-none [data-cqclear]'); await pg.waitForTimeout(300);
eq('clear restores normal list + chips', await pg.evaluate(() => [document.querySelector('#cq').value, document.querySelectorAll('.qchips').length, document.querySelectorAll('.co-row').length > 3]), ['', 1, true]);
// ข้อมูลซิงก์เข้ามาระหว่างพิมพ์ → ยังพิมพ์ต่อได้ ไม่หลุดโฟกัส
await pg.click('#cq'); await pg.keyboard.type('R69', { delay: 30 });
await pg.evaluate(() => T.render()); await pg.keyboard.type('-07', { delay: 30 }); await pg.evaluate(() => T.render()); await pg.keyboard.type('028', { delay: 30 }); await pg.waitForTimeout(300);
eq('typing survives background refresh', await pg.evaluate(() => [document.querySelector('#cq').value, document.activeElement.id, (document.querySelector('.co-row .co-code b') || {}).textContent]), ['R69-07028', 'cq', 'R69-07028']);
await pg.locator('.panel:has(#cq)').screenshot({ path: new URL('out/v282-search.png', import.meta.url).pathname });
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
eq('phone: no sideways overflow while searching', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
