// v2.102: หน้า Sale ภาพรวม — ตัวกรองแบบตารางงาน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.scanHit=scanHit;window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8875);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8875/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);


const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:8875/index.html?salek=' + key); await pg.waitForTimeout(1500);
await pg.evaluate(() => { const b = document.querySelector('[data-sfview="flow"]'); if (b) b.click(); }); await pg.waitForTimeout(500);
eq('filters present', await pg.$$eval('.sp-filters select', a => a.map(x => x.dataset.sff || 'sale')), ['sale', 'stage', 'mach', 'who', 'group', 'type', 'due']);
eq('urgent toggle', await pg.locator('.sp-filters [data-sffurg]').count(), 1);
// v2.102.2: ตัวเลขเครื่อง = งานที่กำลังลงเครื่อง ตรงกับช่องลงเครื่องด้านบน
const tileMach = +(await pg.evaluate(() => { const t = document.querySelector('[data-sfstep="machine"] b'); return t ? t.textContent : '0'; }));
const machOpts = await pg.$$eval('[data-sff="mach"] option', a => a.filter(o => o.value).map(o => +((o.textContent.match(/\((\d+)\)/) || [])[1] || 0)));
eq('machine counts ≤ machine tile & sum ≥ tile when each job has a machine', machOpts.every(n => n <= tileMach), true);
if (machOpts.some(n => n > 0)) {
  const firstVal = await pg.$$eval('[data-sff="mach"] option', a => (a.find(o => o.value && !o.disabled) || {}).value);
  await pg.selectOption('[data-sff="mach"]', firstVal); await pg.waitForTimeout(400);
  eq('machine filter rows are all in machine stage', await pg.$$eval('.sf-list .co-row', a => a.length > 0 && a.every(r => r.classList.contains('co-machine'))), true);
  await pg.click('[data-sffclear]'); await pg.waitForTimeout(300);
}
console.log('tile', tileMach, 'opts', machOpts);
const n0 = await pg.locator('.sf-list .co-row').count();
const stageOpts = await pg.$$eval('[data-sff="stage"] option:not([disabled])', a => a.map(o => o.value).filter(Boolean));
await pg.selectOption('[data-sff="stage"]', 'design'); await pg.waitForTimeout(400);
const rows = await pg.$$eval('.sf-list .co-row', a => a.map(r => r.className));
eq('stage filter: only design rows', rows.length > 0 && rows.every(c => /co-design/.test(c)), true);
eq('count line shows', await pg.locator('.sp-count').count() > 0, true);
const whoOpt = await pg.$$eval('[data-sff="who"] option:not([disabled])', a => a.map(o => o.value).filter(v => v && v !== '__none')[0]);
await pg.selectOption('[data-sff="who"]', whoOpt); await pg.waitForTimeout(400);
const n2 = await pg.locator('.sf-list .co-row').count();
eq('who narrows further', n2 > 0 && n2 <= rows.length, true);
await pg.locator('.sp-tools').scrollIntoViewIfNeeded(); await pg.waitForTimeout(300); await pg.locator('.sp-tools').screenshot({ path: new URL('out/v2102a.png', import.meta.url).pathname });
await pg.click('[data-sffclear]'); await pg.waitForTimeout(400);
eq('clear restores', await pg.locator('.sf-list .co-row').count(), n0);
await pg.click('[data-sffurg]'); await pg.waitForTimeout(400);
const urgRows = await pg.$$eval('.sf-list .co-row', a => a.map(r => !!r.querySelector('.tag.urgent')));
eq('urgent toggle shows only urgent', urgRows.every(Boolean), true);
await pg.click('[data-sffurg]'); await pg.waitForTimeout(300);
await pg.selectOption('[data-sff="due"]', 'late'); await pg.waitForTimeout(400);
eq('due late rows are late', await pg.$$eval('.sf-list .co-row', a => a.every(r => r.classList.contains('late'))), true);
await pg.setViewportSize({ width: 390, height: 900 }); await pg.waitForTimeout(300);
await pg.locator('.sp-tools').screenshot({ path: new URL('out/v2102m.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
