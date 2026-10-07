// ทางด่วนตอบกลับผ่าน "กล่องรับ" (Supabase จำลอง) + เข้าสู่ระบบรอบเดียว: HTTP ถูกหน่วง STALL ms แต่แอปต้องเร็ว
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.PW);
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const STALL = +(process.env.STALL || 8000);
const tmp = path.join(os.tmpdir(), 'kn-fast-Code.gs');
fs.writeFileSync(tmp, fs.readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8').replace("const RT_URL = '';", "const RT_URL = 'https://fake.supabase.co';").replace("const RT_KEY = '';", "const RT_KEY = 'k';"));
const ol = console.log; const logs = []; console.log = (...a) => logs.push(a.join(' '));
process.argv[2] = tmp; const m = require('./gs/mock.js'); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1];
let outbox = [];
global.UrlFetchApp = { fetch: (u, o) => { if (/broadcast/.test(u)) outbox.push(o.payload); return { getResponseCode: () => 202 }; }, fetchAll: rs => rs.map(r => UrlFetchApp.fetch(r.url, r)) };
const counts = {};
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => {
  let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  let body = fs.readFileSync(p); if (p.endsWith('config.js')) body = "window.KIWNGAN_CONFIG = { api: 'https://script.google.com/macros/s/TEST/exec' };";
  if (p.endsWith('app.js')) body = body.toString().replace('window.KiwNgan = {', 'window.T={go};window.S=S;window.IB=IB;window.KiwNgan = {');
  r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(body);
}).listen(8767);
const FAKE_SB = `window.__SBCH={};window.supabase={createClient(){return{channel(n){const cbs=[];window.__SBCH[n]=cbs;return{on(t,f,cb){cbs.push([f.event,cb]);return this},subscribe(cb){setTimeout(()=>cb('SUBSCRIBED'),30);return this},send(){return Promise.resolve('ok')}}},removeChannel(){},removeAllChannels(){}}}};`;
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1300, height: 850 } }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_SB }));
await pg.route('https://script.google.com/**', async route => {
  const bd = route.request().postData() || '{}'; const j = JSON.parse(bd); counts[j.action] = (counts[j.action] || 0) + 1;
  outbox = []; const out = m.ctx.doPost({ postData: { contents: bd } }).t; const sent = outbox; outbox = [];
  setTimeout(() => pg.evaluate(list => list.forEach(s => JSON.parse(s).messages.forEach(x => (window.__SBCH[x.topic] || []).forEach(([ev, cb]) => ev === x.event && cb({ payload: x.payload })))), sent).catch(() => {}), 120);
  await new Promise(r => setTimeout(r, STALL)); try { await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out }); } catch (e) {}
});
await pg.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let t0 = Date.now();
await pg.goto('http://127.0.0.1:8767/index.html');
await pg.waitForSelector('[data-act="adminon"]'); await pg.waitForFunction(() => window.IB && IB.ready, null, { timeout: 15000 }).catch(() => {});
console.log('first visit: login page usable after', Date.now() - t0, 'ms', '| inbox ready', await pg.evaluate(() => IB.ready));
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', pin); await pg.dispatchEvent('#pinIn', 'input');
for (const k in counts) delete counts[k];
t0 = Date.now(); await pg.press('#pinIn', 'Enter');
await pg.waitForFunction(() => S.screen === 'app' && S.user, null, { timeout: 30000 }).catch(async () => console.log('FAIL', JSON.stringify(await pg.evaluate(() => ({ sc: S.screen, err: S.login.err, jobs: S.jobs.length, sub: S.login.submitting }))), JSON.stringify(counts)));
console.log('login → board', Date.now() - t0, 'ms (HTTP stall', STALL, 'ms) calls', JSON.stringify(counts));
// second visit: cached roster appears instantly, reload while logged in boots fast
const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errs.push(e.message));
await pg2.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_SB }));
await pg2.route('https://script.google.com/**', async route => { const bd = route.request().postData() || '{}'; outbox = []; const out = m.ctx.doPost({ postData: { contents: bd } }).t; const sent = outbox; outbox = [];
  setTimeout(() => pg2.evaluate(list => list.forEach(s => JSON.parse(s).messages.forEach(x => (window.__SBCH[x.topic] || []).forEach(([ev, cb]) => ev === x.event && cb({ payload: x.payload })))), sent).catch(() => {}), 120);
  await new Promise(r => setTimeout(r, STALL)); try { await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out }); } catch (e) {} });
t0 = Date.now(); await pg2.goto('http://127.0.0.1:8767/index.html');
await pg2.waitForFunction(() => S.screen === 'app' && S.user, null, { timeout: 30000 });
console.log('reopen app (logged in) → board', Date.now() - t0, 'ms');
await pg2.evaluate(() => { localStorage.removeItem('kiwngan:token'); Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k)); });
t0 = Date.now(); await pg2.reload(); await pg2.waitForSelector('.who-grid .who, [data-act="adminon"]');
console.log('logged-out reopen: roster shown after', Date.now() - t0, 'ms, users', await pg2.locator('.who-grid .who').count());
console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close();
