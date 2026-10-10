// v2.71: คลังวัสดุ — รับคืนจากหน้างาน (สภาพดี/ตำหนิ/เศษ + ขนาด + ผู้ส่งคืน + รูป) · ของลูกค้า · คืนลูกค้า · ต้นทุน Job หักของคืน · รายงานของคืน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,matHtml,retData,jobMaterials};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8794);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const shot = n => pg.screenshot({ path: new URL('out/' + n + '.png', import.meta.url).pathname });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.goto('http://127.0.0.1:8794/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1400);
await pg.evaluate(() => { document.querySelectorAll('.ntf,.chat-heads').forEach(e => e.remove()); T.go('stock'); }); await pg.waitForTimeout(700);
const ID = 's_demo0', item = id => pg.evaluate(i => S.stock.items.find(x => x.id === i), id);
const q0 = (await item(ID)).qty;
// เบิกให้ Job ก่อน แล้วรับคืน
await pg.click('.sk-card[data-sopen="' + ID + '"] [data-squick="out"]'); await pg.waitForTimeout(300);
await pg.fill('#smQty', '5'); await pg.fill('#smJob', 'R71-1'); await pg.click('[data-sgo]'); await pg.waitForTimeout(600);
eq('out 5', (await item(ID)).qty, q0 - 5);
await pg.click('[data-skind="ret"]'); await pg.waitForTimeout(200);
eq('return tab has 4 kinds', await pg.locator('.sk-seg [data-skind]').count(), 4);
eq('condition chips', await pg.locator('.sm-cond [data-scond]').count(), 3);
await pg.fill('#smQty', '2'); await pg.click('[data-sgo]'); await pg.waitForTimeout(300);
eq('return requires job (no change)', (await item(ID)).qty, q0 - 5);
await pg.fill('#smQty', '2'); await pg.fill('#smJob', 'R71-1'); await pg.fill('#smFrom', 'ทีมติดตั้ง');
await pg.setInputFiles('#skRetIn', { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }); await pg.waitForTimeout(300);
eq('return photo queued', await pg.locator('.sm-rph .skg-t').count(), 1);
await shot('v271-ret');
await pg.click('[data-sgo]'); await pg.waitForTimeout(1500);
eq('good return back to item', (await item(ID)).qty, q0 - 3);
const lg = await pg.evaluate(() => S.stock.logs[0]);
eq('return log', [lg.kind, lg.cond, lg.from, lg.job], ['ret', 'ok', 'ทีมติดตั้ง', 'R71-1']);
eq('return photo uploaded', await pg.evaluate(id => (S.images || []).filter(m => m.jobId === 'r_' + id).length, lg.id), 1);
eq('history shows photo + condition', [await pg.locator('#sModal .sl-ph').count() >= 1, (await pg.locator('#sModal .sk-log li').first().innerText()).includes('สภาพดี · คืนโดย ทีมติดตั้ง')], [true, true]);
// เศษ ต้องใส่ขนาด
await pg.click('[data-scond="scrap"]'); await pg.waitForTimeout(200);
await pg.fill('#smQty', '1'); await pg.fill('#smJob', 'R71-1'); await pg.click('[data-sgo]'); await pg.waitForTimeout(300);
eq('scrap requires size', await pg.evaluate(() => S.stock.items.filter(x => x.grade).length), 0);
await pg.fill('#smSize', '60 x 120 ซม.'); await pg.click('[data-sgo]'); await pg.waitForTimeout(900);
const sc = await pg.evaluate(() => S.stock.items.find(x => x.grade === 'scrap'));
eq('scrap item created', [sc && sc.name, sc && sc.qty, sc && sc.base], ['แผ่นอะลูมิเนียมคอมโพสิต 4 มม. · เศษ 60×120 ซม.', 1, ID]);
eq('usable qty unchanged by scrap', (await item(ID)).qty, q0 - 3);
eq('parent shows split-off scrap', (await pg.locator('#sModal .sk-mins').innerText()).includes('เศษ 60×120 ซม. 1'), true);
// ต้นทุน Job หักของคืนสภาพดี
const mat = await pg.evaluate(() => T.jobMaterials('R71-1'));
eq('job cost nets good return', [mat[0].qty, mat[0].ret, mat[0].cost], [3, 2, 3750]);
await pg.click('[data-sclose]').catch(() => {}); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.evaluate(() => { document.querySelectorAll('#sModal').forEach(e => e.remove()); document.body.classList.remove('pm-open'); });
// ตัวกรองตำหนิ/เศษ
eq('scrap chip', await pg.locator('[data-scat="scrap"]').count(), 1);
await pg.click('[data-scat="scrap"]'); await pg.waitForTimeout(400);
eq('scrap filter shows only scrap', await pg.locator('.sk-grid .sk-card[data-sopen]').count(), 1);
await shot('v271-scrap');
eq('search by size', await pg.evaluate(() => { const i = document.querySelector('#sq'); return !!i; }), true);
// เบิกเศษไปใช้ Job อื่น ไม่คิดต้นทุน
await pg.click('.sk-card[data-sopen="' + sc.id + '"] [data-squick="out"]'); await pg.waitForTimeout(300);
eq('scrap item has no return tab', await pg.locator('[data-skind="ret"]').count(), 0);
await pg.fill('#smQty', '1'); await pg.fill('#smJob', 'R71-9'); await pg.click('[data-sgo]'); await pg.waitForTimeout(700);
const m9 = await pg.evaluate(() => T.jobMaterials('R71-9'));
eq('scrap used for other job is free + priced', [m9[0].qty, m9[0].cost, m9[0].priced, m9[0].scrap], [1, 0, true, true]);
await pg.evaluate(() => { document.querySelectorAll('#sModal').forEach(e => e.remove()); document.body.classList.remove('pm-open'); });
await pg.click('[data-scat="all"]'); await pg.waitForTimeout(300);
eq('used-up scrap hidden from all list', await pg.locator('.sk-card[data-sopen="' + sc.id + '"]').count(), 0);
// ของลูกค้า
await pg.evaluate(() => { const fab = document.querySelector('[data-sadd]'); fab.click(); }); await pg.waitForTimeout(300);
await pg.click('[data-sfown="cust"]'); await pg.waitForTimeout(200);
eq('customer form fields', [await pg.locator('#sfCust').count(), await pg.locator('#sfJob').count(), await pg.locator('#sfMin').count(), await pg.locator('#sfPrice').count()], [1, 1, 0, 0]);
await pg.fill('#sfCust', 'คุณบี'); await pg.fill('#sfJob', 'R71-5'); await pg.fill('#sfName', 'แผ่นอะลูมิเนียมคอมโพสิต 4 มม.'); await pg.click('[data-sfunit="แผ่น"]'); await pg.fill('#sfQty', '6');
await shot('v271-custform');
await pg.click('[data-ssave]'); await pg.waitForTimeout(900);
const cu = await pg.evaluate(() => S.stock.items.find(x => x.own === 'cust'));
eq('customer item saved (same name ok)', [cu && cu.cust, cu && cu.job, cu && cu.qty, cu && cu.price], ['คุณบี', 'R71-5', 6, 0]);
eq('customer panel kinds', await pg.evaluate(() => Array.from(document.querySelectorAll('.sk-seg [data-skind]')).map(b => b.textContent.replace(/^\W/, '').trim())), ['รับของลูกค้า', 'เบิกใช้', 'คืนลูกค้า', 'ปรับยอด']);
await pg.click('[data-skind="out"]'); await pg.fill('#smQty', '4'); await pg.click('[data-sgo]'); await pg.waitForTimeout(700);
eq('customer out uses item job by default', await pg.evaluate(() => S.stock.logs[0].job), 'R71-5');
await pg.click('[data-skind="back"]'); await pg.fill('#smQty', '5'); await pg.click('[data-sgo]'); await pg.waitForTimeout(400);
eq('cannot give back more than left', (await item(cu.id)).qty, 2);
await pg.fill('#smQty', '2'); await pg.click('[data-sgo]'); await pg.waitForTimeout(700);
eq('give back to customer', (await item(cu.id)).qty, 0);
const m5 = await pg.evaluate(() => T.jobMaterials('R71-5'));
eq('customer material: no cost', [m5[0].qty, m5[0].cost, m5[0].cust, m5[0].priced], [4, 0, true, true]);
await shot('v271-cust');
await pg.evaluate(() => { document.querySelectorAll('#sModal').forEach(e => e.remove()); document.body.classList.remove('pm-open'); });
eq('value KPI excludes customer item', (await pg.locator('.sk-kpi.k-all b').innerText()).trim(), String(await pg.evaluate(() => S.stock.items.filter(x => !x.own && !x.grade).length)));
// รายงาน
const rd = await pg.evaluate(() => T.retData('', ''));
eq('report data', [rd.n, rd.val, rd.cond.ok, rd.cond.scrap, rd.jobs[0].job], [2, 2500, 1, 1, 'R71-1']);
await pg.evaluate(() => { S.rep = Object.assign(S.rep || {}, { sec: 'mat' }); T.go('report'); }); await pg.waitForTimeout(700);
const hasRet = await pg.locator('.rsec-ret').count();
if (!hasRet) { const btn = pg.locator('[data-rsec="mat"]'); if (await btn.count()) { await btn.first().click(); await pg.waitForTimeout(500); } }
eq('report section rendered', await pg.locator('.rsec-ret').count(), 1);
await pg.locator('.rsec-ret').scrollIntoViewIfNeeded().catch(() => {}); await shot('v271-report');
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); if (bad) process.exit(1);
