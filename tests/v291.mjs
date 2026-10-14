// v2.91: รูปตัวอย่างเล็กบนทุกแถว/การ์ดงาน (หน้าแรก · รายการงาน · ภาพรวม · ติดตามงาน · ไทม์ไลน์) · กดรูป = ดูรูป ไม่เปิดงาน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8836;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,openEditor,jobById,addWorkDays,today};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
// ข้อมูลจำลองไม่มีรูป → ใส่รูปให้งานบางงาน
const nImg = await pg.evaluate(() => { S.images = S.images || []; const js = S.jobs.filter(j => j.status !== 'done').slice(0, 6).concat(S.jobs.filter(j => j.status === 'done').slice(0, 10)); js.forEach((j, i) => { for (let k = 0; k < (i % 3) + 1; k++) S.images.push({ id: 'im' + i + '_' + k, jobId: j.id, createdAt: '2026-10-0' + (k + 1) }); });
  (S.prods || []).slice(0, 4).forEach((p, i) => S.images.push({ id: 'ip' + i, jobId: p.id, createdAt: '2026-10-01' })); return S.images.length; });
const paint = () => pg.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 60; const g = c.getContext('2d'); const cols = ['#0B6B70', '#D2650C', '#7A4BB5', '#2D5FC4', '#B8435F'];
  document.querySelectorAll('.card-th img').forEach((im, i) => { const gr = g.createLinearGradient(0, 0, 60, 60); gr.addColorStop(0, cols[i % 5]); gr.addColorStop(1, '#F3E9D2'); g.fillStyle = gr; g.fillRect(0, 0, 60, 60); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(10, 34, 40, 14); im.src = c.toDataURL(); }); });
console.log('demo images', nImg);
const views = { home: '.aitem', list: '.row[data-open]', flow: '.co-row', board: '.card[data-open]', prod: '.pcard' };
for (const [v, sel] of Object.entries(views)) {
  await pg.evaluate(v => { T.go(v); }, v); await pg.waitForTimeout(700);
  const r = await pg.evaluate(sel => { const rows = [...document.querySelectorAll('#view ' + sel)]; return { rows: rows.length, th: rows.filter(x => x.querySelector('.card-th img')).length }; }, sel);
  console.log(v, JSON.stringify(r));
  eq(v + ': rows with photos show a small preview', r.th > 0, true);
}
// ไทม์ไลน์ (gantt) ถ้ามี
await pg.evaluate(() => { T.go('board'); }); await pg.waitForTimeout(300);
// กดรูปในแถวภาพรวม = เปิดดูรูป ไม่เปิดงาน
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(600);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
await pg.locator('#view .co-row .mth').first().click(); await pg.waitForTimeout(500);
eq('click preview → lightbox, not the job panel', await pg.evaluate(() => [!!document.querySelector('#lb, .lb, .lightbox, [class*="lb-stage"]'), !!document.querySelector('.co-panel.open, .sf-item.open')]), [true, false]);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
await pg.evaluate(() => T.go('home')); await pg.waitForTimeout(600);
await pg.locator('#view .aitem .mth').first().click(); await pg.waitForTimeout(500);
eq('home: click preview opens photo only', await pg.evaluate(() => [!!document.querySelector('[class*="lb-stage"]'), !!document.querySelector('.editor.open, #editor.open, .ed-modal')]), [true, false]);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
for (const v of ['flow', 'home', 'list']) { await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(600); await pg.evaluate(() => document.querySelectorAll('.ntf,.dl-pop').forEach(e => e.remove())); await paint(); await pg.locator('#view').screenshot({ path: new URL('out/v291-' + v + '.png', import.meta.url).pathname }); }
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(600);
eq('mobile: no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await paint(); await pg.screenshot({ path: new URL('out/v291-mobile.png', import.meta.url).pathname });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad || errs.length ? 1 : 0);
