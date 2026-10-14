// v2.83: ตรวจทุกช่องค้นหา — ไม่ต้องพิมพ์ขีด · หลายคำ · ปุ่ม ✕ / Esc ล้าง · งานเก่า/ส่งแล้วยังค้นเจอ · พิมพ์ต่อได้แม้ข้อมูลซิงก์ (รวมหน้า Sale)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8831;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,api,qHit};window.S=S;window.SV=SV;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));

// ตัวจับคำแบบเดียวกันทุกช่อง
eq('matcher: no dash / case / multi-word', await pg.evaluate(() => [T.qHit(['R69-07028', 'ป้ายร้าน'], '6907028'), T.qHit('R69-07028 Router', 'router 028'), T.qHit('abc', 'r69'), T.qHit('ป้ายร้านคุณอิตา', 'ป้าย อิตา')]), [true, true, false, true]);

// เตรียมงานออกแบบเสร็จนาน 60 วัน + งานผลิตส่งแล้ว 40 วัน
const prep = await pg.evaluate(() => {
  const d = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10), j = S.jobs.find(x => x.status === 'done');
  j.code = 'R69-07028'; j.title = 'ป้ายร้านคุณอิตา'; j.finishedAt = d + 'T10:00:00';
  const p = (S.prods || [])[0]; p.stage = 'shipped'; p.shippedAt = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10) + 'T09:00:00'; p.code = 'R69-05511'; p.title = 'กล่องไฟเก่า';
  return { pid: p.id };
});
const type = async (sel, q) => { await pg.click(sel, { clickCount: 3 }); await pg.keyboard.press('Backspace'); await pg.keyboard.type(q, { delay: 20 }); await pg.waitForTimeout(350); };

// 1) รายการงาน: ค้นแบบไม่ใส่ขีด · ไม่เจอในมุมมอง "ยังไม่เสร็จ" → บอกว่าเจอที่อื่น + ปุ่มดูทั้งหมด
await pg.evaluate(() => { S.f.status = 'open'; T.go('list'); }); await pg.waitForTimeout(500);
await type('#q', '6907028');
eq('list: hint when match is in another status', await pg.evaluate(() => !!document.querySelector('.list .empty [data-fstatus="all"]')), true);
await pg.click('.list .empty [data-fstatus="all"]'); await pg.waitForTimeout(400);
eq('list: shows the done job after switching to all', await pg.evaluate(() => document.querySelector('.list .row .code') && document.querySelector('.list .row .code').textContent.includes('R69-07028')), true);
eq('list: ✕ clear button visible', await pg.locator('#q ~ .cq-x').count(), 1);
await pg.click('#q ~ .cq-x'); await pg.waitForTimeout(300);
eq('list: ✕ clears and keeps focus', await pg.evaluate(() => [document.querySelector('#q').value, S.f.q, document.activeElement.id]), ['', '', 'q']);
await type('#q', 'อิตา'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
eq('list: Esc clears search', await pg.evaluate(() => [document.querySelector('#q').value, S.f.q]), ['', '']);
// พิมพ์ต่อได้แม้มีการวาดหน้าใหม่ระหว่างพิมพ์
await pg.click('#q'); await pg.keyboard.type('R69', { delay: 20 }); await pg.evaluate(() => T.render()); await pg.keyboard.type('-07028', { delay: 20 }); await pg.waitForTimeout(200);
eq('list: typing survives refresh', await pg.evaluate(() => [document.querySelector('#q').value, document.activeElement.id]), ['R69-07028', 'q']);

// 2) บอร์ด: งานเสร็จเกิน 14 วันขึ้นตอนค้นหา
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(500);
eq('board: old done job appears while searching', await pg.evaluate(() => [...document.querySelectorAll('[data-col="done"] .card')].some(c => c.textContent.includes('R69-07028'))), true);
await pg.evaluate(() => { S.f.q = ''; T.render(); }); await pg.waitForTimeout(300);
eq('board: hidden again without search', await pg.evaluate(() => [...document.querySelectorAll('[data-col="done"] .card')].some(c => c.textContent.includes('R69-07028'))), false);

// 3) ฝ่ายผลิต: งานส่งแล้ว 40 วันค้นเจอ · ไม่เจอบอกวิธี
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
await type('#pq', '6905511');
eq('prod: shipped 40 days ago found + summary', await pg.evaluate(() => [!!document.querySelector('.co-sres'), [...document.querySelectorAll('.pq-ship .pship-row b')].map(x => x.textContent)]), [true, ['R69-05511']]);
eq('prod: match highlighted', await pg.evaluate(() => (document.querySelector('.pq-ship mark') || {}).textContent), '69-05511');
await type('#pq', 'ZZZNOPE');
eq('prod: no result message with clear', await pg.evaluate(() => !!document.querySelector('.co-none [data-qclear="pq"]')), true);
await pg.click('.co-none [data-qclear="pq"]'); await pg.waitForTimeout(300);
eq('prod: cleared', await pg.evaluate(() => [S.pq, document.querySelectorAll('.co-sres').length]), ['', 0]);

// 4) คลังวัสดุ: ค้นจากทุกหมวด แม้เลือกหมวดอื่นอยู่
await pg.evaluate(() => T.go('stock')); await pg.waitForTimeout(500);
const st = await pg.evaluate(() => { const it = (S.stock.items || []).find(x => +x.qty > 0 && !x.grade); return it ? { name: it.name, cat: it.cat } : null; });
if (st) {
  await pg.evaluate(() => { SV.cat = 'low'; T.render(); }); await pg.waitForTimeout(300);
  await type('#sq', st.name);
  eq('stock: found even when another chip is selected', await pg.evaluate(n => [...document.querySelectorAll('.sk-grid .sk-card')].some(c => c.textContent.includes(n)), st.name), true);
  eq('stock: summary shown, chips hidden', await pg.evaluate(() => [!!document.querySelector('.sk-main .co-sres'), document.querySelectorAll('.sk-chips').length]), [true, 0]);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  eq('stock: Esc clears', await pg.evaluate(() => [SV.q, document.querySelectorAll('.sk-chips').length]), ['', 1]);
}

// 5) หน้า Sale (ลิงก์ภายนอก)
await pg.evaluate(async () => { const j = S.jobs.find(x => x.code === 'R69-07028'); await T.api().saveJob(j).catch(() => {}); });
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:' + PORT + '/index.html?salek=' + key); await pg.waitForTimeout(1500);
await pg.evaluate(() => { const t = document.querySelector('[data-sfview="flow"]'); if (t) t.click(); }); await pg.waitForTimeout(500);
const sc = await pg.evaluate(() => (document.querySelector('.co-row .co-code b') || {}).textContent || '');
eq('sale page has rows', !!sc, true);
const tail = sc.replace(/[^0-9]/g, '').slice(-5);
await type('#sfQ', tail);
eq('sale flow: found by digits only + count', await pg.evaluate(c => [[...document.querySelectorAll('.co-row .co-code b')].some(b => b.textContent === c), !!document.querySelector('.sf-panel .co-sres')], sc), [true, true]);
// ข้อมูลอัปเดตเบื้องหลังระหว่างพิมพ์ → ไม่หลุดโฟกัส
await pg.click('#sfQ', { clickCount: 3 }); await pg.keyboard.press('Backspace'); await pg.keyboard.type(sc.slice(0, 3), { delay: 20 });
await pg.evaluate(() => document.querySelector('[data-sale-refresh]') && document.querySelector('[data-sale-refresh]').click()); await pg.waitForTimeout(900);
await pg.keyboard.type(sc.slice(3), { delay: 20 }); await pg.waitForTimeout(300);
eq('sale flow: typing survives background refresh', await pg.evaluate(() => [document.querySelector('#sfQ').value, document.activeElement.id]), [sc, 'sfQ']);
await type('#sfQ', 'ZZZNOPE');
eq('sale flow: no result + clear button', await pg.evaluate(() => !!document.querySelector('.sp-empty [data-qclear="sfQ"]')), true);
await pg.click('.sp-empty [data-qclear="sfQ"]'); await pg.waitForTimeout(300);
eq('sale flow: cleared, chips back', await pg.evaluate(() => [document.querySelector('#sfQ').value, document.querySelectorAll('.sf-panel .qchips').length]), ['', 1]);
await pg.locator('.sf-panel').screenshot({ path: new URL('out/v283-sale.png', import.meta.url).pathname }).catch(() => {});
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
eq('phone: no sideways overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
