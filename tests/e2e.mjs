import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PW);
const http = require('http'), fs = require('fs'), path = require('path');
const ol = console.log; const logs = []; console.log = (...a) => logs.push(a.join(' '));
process.argv[2] = new URL('../backend/Code.gs', import.meta.url).pathname; const m = require('./gs/mock.js'); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1];
const counts = {};
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => {
  if (q.method === 'POST') { let b = ''; q.on('data', c => b += c); q.on('end', () => { const j = JSON.parse(b); counts[j.action] = (counts[j.action] || 0) + 1; const out = m.ctx.doPost({ postData: { contents: b } }).t; r.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); r.end(out); }); return; }
  let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let body = fs.readFileSync(p); if (p.endsWith('config.js')) body = "window.KIWNGAN_CONFIG = { api: 'https://script.google.com/macros/s/TEST/exec' };";
  if (p.endsWith('app.js')) body = body.toString().replace('window.KiwNgan = {', 'window.T={go,jobById,openEditor,$};window.S=S;window.M=M;window.KiwNgan = {');
  r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(body);
}).listen(8766);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route('https://script.google.com/**', async route => { const b = route.request().postData() || '{}'; const j = JSON.parse(b); counts[j.action] = (counts[j.action] || 0) + 1; await new Promise(r => setTimeout(r, 150)); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: m.ctx.doPost({ postData: { contents: b } }).t }); });
await pg.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8766/index.html'); await pg.waitForTimeout(1500);
console.log(await pg.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n/g, ' ')));
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', pin); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter');
await pg.waitForTimeout(2000);
console.log('logged in', await pg.evaluate(() => S.screen), 'stamp', await pg.evaluate(() => S.dataStamp));
// external change by another session
const T = m.call('login', { name: 'แอดมิน', pin }).data.token;
m.call('saveJob', { job: { code: 'EXT-1', status: 'queue' } }, T);
for (const k in counts) counts[k] = 0;
await pg.waitForTimeout(7000);
console.log('ext job visible', await pg.evaluate(() => S.jobs.some(j => j.code === 'EXT-1')), JSON.stringify(counts));
for (const k in counts) counts[k] = 0;
await pg.waitForTimeout(11000);
console.log('idle 11s calls', JSON.stringify(counts));
m.call('sendMessage', { to: 'team', text: 'จากอีกเครื่อง' }, T);
await pg.waitForTimeout(6000);
console.log('msg arrived', await pg.evaluate(() => M.list.some(x => x.text === 'จากอีกเครื่อง')));
console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close();
