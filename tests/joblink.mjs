// v2.61: พิมพ์เลข Job ในแชท → เป็นปุ่ม + การ์ดงาน, ระหว่างพิมพ์โชว์การ์ด, กดแล้วเปิดงาน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openMsgPanel};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8798);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.goto('http://127.0.0.1:8798/index.html'); await pg.waitForTimeout(700);
await pg.click('.who:has-text("ต้น")'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1300);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// a design job of someone else + a production job
const code = await pg.evaluate(() => S.jobs.find(j => j.assignee !== S.me && j.status !== 'done').code);
const pcode = await pg.evaluate(() => S.prods.find(p => p.stage !== 'shipped').code);
await pg.evaluate(() => T.openMsgPanel('team')); await pg.waitForTimeout(500);
await pg.fill('#msgText', 'ช่วยดู ' + code.toLowerCase() + ' หน่อย'); await pg.dispatchEvent('#msgText', 'input'); await pg.waitForTimeout(200);
eq('typing a job code shows its card above the box', [await pg.locator('#msgPeek.on .jmini').count(), await pg.locator('#msgPeek .jm-t b').first().innerText()], [1, code]);
await pg.locator('#msgPanel').screenshot({ path: new URL('out/joblink-peek.png', import.meta.url).pathname });
await pg.press('#msgText', 'Enter'); await pg.waitForTimeout(900);
eq('peek cleared after send', await pg.locator('#msgPeek.on').count(), 0);
eq('sent message: code is a link + job card', [await pg.locator('#mpBody .bub.me .jlink').count() > 0, await pg.locator('#mpBody .bub.me .jmini').count() > 0], [true, true]);
await pg.fill('#msgText', 'งานผลิต ' + pcode + ' ถึงไหนแล้ว'); await pg.press('#msgText', 'Enter'); await pg.waitForTimeout(900);
await pg.locator('#msgPanel').screenshot({ path: new URL('out/joblink-chat.png', import.meta.url).pathname });
eq('non-codes are not linked', await pg.evaluate(() => [...document.querySelectorAll('#mpBody .jlink')].every(a => /\d/.test(a.textContent))), true);
// click the design job card → chat closes, job opens read-only for others
await pg.locator('#mpBody .bub.me .jmini', { hasText: code }).last().click(); await pg.waitForTimeout(700);
eq('click opens the job and closes chat', [await pg.locator('#msgPanel.open').count(), await pg.evaluate(() => !!S.edit || !!document.querySelector('#pModal'))], [0, true]);
await pg.screenshot({ path: new URL('out/joblink-open.png', import.meta.url).pathname });
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
