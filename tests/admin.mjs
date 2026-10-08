const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={moveJob,uploadImages,imgsOf,jobAlerts,go};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8774);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { localStorage.clear(); if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8774/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
console.log('due notice shown at login', await pg.locator('.ntf.job-due').count());
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(600);
// SLA: add a group, name it, set numbers, rename an existing one, save
const n0 = await pg.locator('#s-sla tbody tr').count();
await pg.click('#s-sla [data-add="groups"]'); await pg.waitForTimeout(200);
const rows = pg.locator('#s-sla tbody tr'); console.log('sla rows', n0, '→', await rows.count());
const last = rows.last(); await last.locator('input.sla-g').fill('งาน ทดสอบ'); await last.locator('input[type=number]').nth(0).fill('4'); await last.locator('input[type=number]').nth(3).fill('7');
await rows.first().locator('input.sla-g').fill('งาน 2D ใหม่');
await pg.click('[data-act="savesettings"]'); await pg.waitForTimeout(800);
console.log('saved sla', JSON.stringify(await pg.evaluate(() => ({ g: S.settings.groups, t: S.settings.sla['งาน ทดสอบ'], r: !!S.settings.sla['งาน 2D ใหม่'] }))));
// delete a user
const victim = await pg.evaluate(() => S.users.find(u => u.id !== S.user.id && u.role !== 'admin').name);
const vid = await pg.evaluate(n => S.users.find(u => u.name === n).id, victim);
await pg.click(`[data-udel="${vid}"]`); await pg.waitForTimeout(200);
console.log('confirm shown', await pg.locator('.urow .confirm').count(), '| own row has delete btn', await pg.evaluate(() => !!document.querySelector('[data-udel="' + S.user.id + '"]')));
await pg.screenshot({ path: new URL('out/udel.png', import.meta.url).pathname });
await pg.click(`[data-udelyes="${vid}"]`); await pg.waitForTimeout(600);
console.log('deleted', victim, !(await pg.evaluate(n => S.users.some(u => u.name === n), victim)), '| jobs kept', await pg.evaluate(n => S.jobs.filter(j => j.assignee === n).length, victim));
console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close();
