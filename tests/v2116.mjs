// v2.116: ตัวเลขบนการ์ด/แบนเนอร์ทุกหน้า ต้องตรงกับจำนวนรายการที่เห็นเมื่อกดการ์ดนั้น
// เคสที่เคยพลาด: งานแบบ (แก้ระหว่างผลิต) เลยกำหนด · งานผลิตเลยกำหนดส่งลูกค้า · พร้อมส่งแล้วไม่นับเลยกำหนด · คลังวัสดุ ใกล้หมด/หมด · คิวเครื่อง (กำลังทำ + รอ)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const PORT = 8914;
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,api,Demo,SV,today,addDays};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const U = 'http://127.0.0.1:' + PORT + '/index.html';
await pg.goto(U); await pg.waitForTimeout(700);
const login = async () => { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200); };
await login();

// เตรียมข้อมูล: A = ลงเครื่อง + งานแบบแก้ไขเลยกำหนด · B = ทำสี เลยกำหนดส่งลูกค้า · C = พร้อมส่ง กำหนดส่งผ่านไปแล้ว (ไม่นับ)
const info = await pg.evaluate(() => { const D = T.Demo, d = D.db(), t = T.today(), past = T.addDays(t, -5);
  const ps = d.prods.filter(p => p.stage !== 'shipped'), seen = {}, pick = []; ps.forEach(p => { if (!seen[p.code] && pick.length < 3) { seen[p.code] = 1; pick.push(p); } });
  const [A, B, C] = pick;
  A.stage = 'machine'; A.due = ''; A.machines = JSON.stringify([{ m: 'Laser', d: '' }]);
  B.stage = 'paint'; B.due = past; C.stage = 'ready'; C.due = past; C.finishedAt = past + 'T10:00';
  d.prods.filter(p => p !== A && p !== B && p !== C && p.stage !== 'shipped').forEach(p => { p.due = ''; });
  d.jobs.push({ id: 'j_rev1', code: A.code, title: 'แก้แบบระหว่างผลิต', taskType: 'เขียนแบบ', status: 'fix', received: T.addDays(t, -9), due: T.addDays(t, -2), sale: A.sale || '', group: A.group || '', checklist: '[]', minutes: 0, assignee: '', priority: '' });
  // คลังวัสดุ: 1 ใกล้หมด (ยังมีของ) + 1 หมด (มีจุดสั่ง) + 1 หมด (ไม่มีจุดสั่ง) + ของลูกค้าที่หมดแล้ว
  D.save(d); return { A: A.code, B: B.code, C: C.code }; });
await pg.reload(); await pg.waitForTimeout(900);
if (await pg.locator('[data-act="adminon"]').count()) await login();

// ---------- หน้า Sale (มุมมองเลข Job) ----------
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto(U + '?salek=' + key); await pg.waitForTimeout(1600);
const sfLate = +(await pg.locator('.co-kpis .kpi.k-late b').innerText());
const sfLateRowsAll = await pg.locator('.sf-list .co-row.late').count();
eq('Sale: late card = red rows in list', sfLate, sfLateRowsAll);
eq('Sale: late chip = card', +(await pg.locator('.qchip.q-late b').innerText()), sfLate);
await pg.click('.co-kpis .kpi.k-late'); await pg.waitForTimeout(500);
eq('Sale: click late card → rows = card', await pg.locator('.sf-list .co-row').count(), sfLate);
const lateCodes = await pg.$$eval('.sf-list .co-row .co-code b', a => a.map(x => x.textContent.trim()));
eq('Sale: design revision late while in production counted', lateCodes.includes(info.A), true);
eq('Sale: production past customer due counted', lateCodes.includes(info.B), true);
eq('Sale: ready-to-ship not counted', lateCodes.includes(info.C), false);
eq('Sale: breakdown mentions both depts', /ฝ่ายแบบ \d+ · ฝ่ายผลิต \d+/.test(await pg.locator('.co-kpis .kpi.k-late small').innerText()), true);
eq('Sale: A shows overdue design date', (await pg.locator('.sf-list .co-row', { hasText: info.A }).first().innerText()).includes('กำหนดส่งแบบ'), true);
await pg.screenshot({ path: out + 'v2116-sale-late.png' });
// มุมมองตาราง: การ์ดเลยกำหนด = แถว
const tv = await pg.$('[data-sfview="table"]'); if (tv) { await tv.click(); await pg.waitForTimeout(900);
  const n = +(await pg.locator('.sp-card.c-late b').getAttribute('data-n')); await pg.click('.sp-card.c-late'); await pg.waitForTimeout(700);
  eq('Sale table: late card = rows', await pg.locator('tr.sp-r').count(), n); }

// ---------- แอป: ภาพรวมบริษัท ----------
await pg.goto(U); await pg.waitForTimeout(900); if (await pg.locator('[data-act="adminon"]').count()) await login();
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(700);
const coLate = +(await pg.locator('.co-kpis .kpi.k-late b').innerText());
await pg.click('.co-kpis .kpi.k-late'); await pg.waitForTimeout(500);
eq('Company: click late card → rows = card', await pg.locator('.co-list .co-row').count(), coLate);
const coCodes = await pg.$$eval('.co-list .co-row .co-code b', a => a.map(x => x.textContent.trim()));
eq('Company: A + B in late list, C not', [coCodes.includes(info.A), coCodes.includes(info.B), coCodes.includes(info.C)], [true, true, false]);
eq('Company: chip = card', +(await pg.locator('.qchip.q-late b').innerText()), coLate);
await pg.screenshot({ path: out + 'v2116-company-late.png' });

// ---------- แอป: หน้าแรก → รายการ ----------
for (const f of ['open', 'late', 'urgent', 'doing', 'done']) {
  await pg.evaluate(() => { T.S = S; S.f.q = 'zzzz-ไม่มี'; S.f.group = 'all'; T.go('home'); }); await pg.waitForTimeout(1600);   // รอเลขนับขึ้นจบ
  const c = pg.locator('.kpi[data-filter-go="' + f + '"] b'); if (!(await c.count())) continue;
  const n = +(await c.innerText()); await pg.click('.kpi[data-filter-go="' + f + '"]'); await pg.waitForTimeout(500);
  const rows = await pg.locator('.row[data-open]').count();
  const more = await pg.locator('.col-more').count();
  if (f === 'done' && more) eq('Home ' + f + ': list has rows', rows > 0, true); else eq('Home ' + f + ': card = list rows (stale search cleared)', rows, n);
}

// ---------- ฝ่ายผลิต: การ์ดเครื่อง = กำลังทำ + รอ ที่เห็นในคอลัมน์ ----------
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(700);
const mcs = await pg.$$eval('.mq-c[data-pm]:not(.all)', a => a.map(x => ({ m: x.dataset.pm, n: +x.querySelector('.mq-n').textContent })));
for (const x of mcs.filter(x => x.n).slice(0, 3)) {
  await pg.click('.mq-c[data-pm="' + x.m + '"]'); await pg.waitForTimeout(400);
  const seen = await pg.evaluate(() => ['machine', 'wait'].reduce((s, k) => s + document.querySelectorAll('[data-pcol="' + k + '"] .pcard').length, 0));
  eq('Prod: machine ' + x.m + ' card = cards shown', seen, x.n);
}
await pg.click('.mq-c[data-pm="all"]'); await pg.waitForTimeout(300);

// ---------- คลังวัสดุ (ในแอป) ----------
const hasStock = await pg.evaluate(() => { if (!S.stock) S.stock = { items: [], logs: [] }; const it = S.stock.items;
  it.push({ id: 's_t1', name: 'ทดสอบใกล้หมด', cat: 'ทดสอบ', qty: 2, min: 5, unit: 'แผ่น' }, { id: 's_t2', name: 'ทดสอบหมดมีจุดสั่ง', cat: 'ทดสอบ', qty: 0, min: 3, unit: 'แผ่น' },
    { id: 's_t3', name: 'ทดสอบหมดไม่มีจุดสั่ง', cat: 'ทดสอบ', qty: 0, min: 0, unit: 'แผ่น' }, { id: 's_t4', name: 'ของลูกค้าหมดแล้ว', cat: 'ทดสอบ', qty: 0, own: 'cust', cust: 'ลูกค้า ก', unit: 'ชิ้น' }, { id: 's_t5', name: 'ของลูกค้ามี', cat: 'ทดสอบ', qty: 3, own: 'cust', cust: 'ลูกค้า ข', unit: 'ชิ้น' });
  T.SV.src = 'app'; T.go('stock'); return true; });
await pg.waitForTimeout(700);
if (hasStock && await pg.locator('.sk-kpis .sk-kpi.k-all').count()) {
  const cards = () => pg.locator('.sk-card:not(.sk-add)').count();
  const allN = +(await pg.locator('.sk-kpi.k-all b').innerText()); await pg.click('.sk-kpi.k-all'); await pg.waitForTimeout(400);
  eq('Stock: total card = items listed', await cards(), allN);
  for (const k of ['k-low', 'k-zero']) { const n = +(await pg.locator('.sk-kpi.' + k + ' b').innerText()); if (!n) continue; await pg.click('.sk-kpi.' + k); await pg.waitForTimeout(400); eq('Stock: ' + k + ' card = items listed', await cards(), n); await pg.evaluate(() => { T.SV.cat = 'all'; T.render(); }); await pg.waitForTimeout(200); }
  for (const c of ['low', 'cust']) { const ch = pg.locator('.sk-chips .qchip[data-scat="' + c + '"]'); if (!(await ch.count())) continue; const n = +(await ch.locator('b').innerText()); await ch.click(); await pg.waitForTimeout(400); eq('Stock: chip ' + c + ' = items listed', await cards(), n); await pg.evaluate(() => { T.SV.cat = 'all'; T.render(); }); await pg.waitForTimeout(200); }
  await pg.screenshot({ path: out + 'v2116-stock.png' });
} else console.log('skip stock (no stock view in demo)');

eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' fail'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
