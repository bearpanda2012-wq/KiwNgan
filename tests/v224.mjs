const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={moveJob,uploadImages,imgsOf,jobAlerts,go,openEditor,addWorkDays,isHoliday};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8782);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem("kn-init")) { localStorage.clear(); sessionStorage.setItem("kn-init", "1"); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8782/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
console.log('due notice shown at login', await pg.locator('.ntf.job-due').count());
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// 1) detail: checklist + file + comment
const id = await pg.evaluate(() => S.jobs.find(j => j.status === 'doing' && j.assignee).id);
await pg.evaluate(id => T.openEditor(id), id); await pg.waitForTimeout(600);
await pg.fill('#clNew', 'เช็กขนาด'); await pg.press('#clNew', 'Enter'); await pg.waitForTimeout(400);
await pg.fill('#clNew', 'ส่ง sale ตรวจ'); await pg.click('[data-act="cladd"]'); await pg.waitForTimeout(400);
await pg.click('[data-cltog="0"]'); await pg.waitForTimeout(500);
console.log('checklist', await pg.evaluate(id => S.jobs.find(j => j.id === id).checklist, id));
await pg.setInputFiles('[data-filejob]', { name: 'panel-A.dwg', mimeType: 'application/acad', buffer: Buffer.from('fake dwg content') }); await pg.waitForTimeout(900);
console.log('files row', await pg.locator('.frow:not(.up)').count(), await pg.locator('.frow .fname').first().textContent());
await pg.fill('#cmtText', 'ขนาดขอบผิด 5 มม. ช่วยแก้ด้วย'); await pg.keyboard.press('Control+Enter'); await pg.waitForTimeout(700);
console.log('comments', await pg.locator('.cmt').count());
console.log('sections', await pg.evaluate(() => [...document.querySelectorAll('#sheetBody .dt-sec .dt-h b')].map(b => b.textContent).join(' | '))); await pg.evaluate(() => { document.querySelector('#sheetBody').scrollTop = 0; }); await pg.locator('#sheet').screenshot({ path: new URL('out/v224-detail.png', import.meta.url).pathname });
await pg.click('[data-act="close"]'); await pg.waitForTimeout(300);
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(400);
console.log('card extras', await pg.locator('.card[data-open="' + id + '"] .card-x .tg').count());
// 2) workload panel
await pg.evaluate(() => T.go('home')); await pg.waitForTimeout(600);
console.log('workload rows', await pg.locator('.wl-p .wrow').count(), 'bars', await pg.locator('.wl-p .gact').count(), 'helper bars', await pg.locator('.wl-p .gact.help').count());
await pg.locator('.wl-p').screenshot({ path: new URL('out/v224-wl.png', import.meta.url).pathname });
// 3) holidays + checklist template in settings
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(500);
const t1 = await pg.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const before = await pg.evaluate(() => T.addWorkDays(new Date().toISOString().slice(0, 10), 1, true));
await pg.fill('#holD', t1); await pg.fill('#holN', 'หยุดทดสอบ'); await pg.click('[data-act="holadd"]'); await pg.waitForTimeout(200);
await pg.click('[data-act="holfixed"]'); await pg.waitForTimeout(200);
await pg.locator('[data-cltplf="ทำ CAD"]').fill('เช็กขนาด\nส่ง sale ตรวจ\nส่งต่อ CAM'); await pg.dispatchEvent('[data-cltplf="ทำ CAD"]', 'input');
await pg.click('[data-act="savesettings"]'); await pg.waitForTimeout(700);
const after = await pg.evaluate(() => T.addWorkDays(new Date().toISOString().slice(0, 10), 1, true));
console.log('holidays', await pg.evaluate(() => (S.settings.holidays || []).length), '| +1 workday', before, '→', after, '| tpl', JSON.stringify(await pg.evaluate(() => S.settings.checklists)));
// sale link
await pg.click('[data-act="salelink"]'); await pg.waitForTimeout(400);
const url = await pg.locator('[data-act="copysale"]').nth(1).getAttribute('data-url');
console.log('sale url', url.replace(/salek=[^&]+/, 'salek=…'));
await pg.locator('#s-salelink').screenshot({ path: new URL('out/v224-salelinks.png', import.meta.url).pathname });
await pg.locator('#s-sla').screenshot({ path: new URL('out/v224-hol.png', import.meta.url).pathname });
// new job gets template checklist
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(300);
await pg.fill('#e-code', 'TPL-1'); await pg.selectOption('#e-type', 'ทำ CAD'); await pg.click('[data-act="save"]'); await pg.waitForTimeout(1200);
console.log('new job checklist', await pg.evaluate(() => (S.jobs.find(j => j.code === 'TPL-1') || {}).checklist));
await pg.goto(url); await pg.waitForTimeout(1500);
console.log('sale page rows', await pg.locator('.sp-t tbody tr').count(), '| sidebar', await pg.evaluate(() => { const e = document.querySelector('.sidebar'); return e ? getComputedStyle(e).display : 'none'; }));
await pg.screenshot({ path: new URL('out/v224-sale.png', import.meta.url).pathname });
console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close();
