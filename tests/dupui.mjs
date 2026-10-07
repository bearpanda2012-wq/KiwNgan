const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={openEditor};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8771);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage();
await pg.addInitScript(() => { localStorage.clear(); if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8771/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1000);
const code = await pg.evaluate(() => S.jobs.find(j => !/CAM/.test(j.taskType)).code);
for (const t of ['ทำ CAM', 'ทำ CAM', 'ทำ CAD']) {
  await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(300);
  await pg.fill('#e-code', code); await pg.selectOption('#e-type', t); await pg.waitForTimeout(100);
  await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(600);
  console.log(t, '→', await pg.evaluate(() => S.edit ? 'blocked: ' + document.querySelector('#eErr').textContent : 'added'));
  await pg.evaluate(() => { if (S.edit) document.querySelector('[data-act="close"]').click(); }); await pg.waitForTimeout(300);
}
console.log('jobs with code', await pg.evaluate(c => S.jobs.filter(j => j.code === c).map(j => j.taskType).join(', '), code));
await b.close(); srv.close();
