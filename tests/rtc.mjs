const { chromium } = await import(process.env.PW);
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const http = require('http'), fs = require('fs'), path = require('path');
process.argv[2] = new URL('../backend/Code.gs', import.meta.url).pathname;
const ol = console.log; const logs = []; console.log = (...a) => logs.push(a.join(' ')); const m = require('./gs/mock.js'); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1];
const T0 = m.call('login', { name: 'แอดมิน', pin }).data.token;
const su = m.call('saveUser', { user: { name: 'ต้น', role: 'user' } }, T0).data;
const LAT = +(process.env.LAT || 800);
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = "window.KIWNGAN_CONFIG={api:'https://script.google.com/macros/s/T/exec'}"; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,rtcRequest,rtcAct,callStart};window.R=R;window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8769);
const b = await chromium.launch({ args: ['--no-proxy-server', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const TRACE = []; const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
async function open(who, isAdmin, pinv) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, permissions: ['microphone', 'camera'] });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log(who, 'PAGEERR', e.message));
  await pg.route('https://script.google.com/**', async route => { const body = route.request().postData() || '{}'; const stall = Math.random() < (+process.env.STALL || 0); const jj0 = JSON.parse(body); const tq = Date.now(); await new Promise(r => setTimeout(r, LAT + (stall ? 15000 : 0))); const j = JSON.parse(body); const w = j.payload && j.payload.wait; const body0 = w ? JSON.stringify(Object.assign({}, j, { payload: Object.assign({}, j.payload, { wait: 0 }) })) : body; let out = m.ctx.doPost({ postData: { contents: body0 } }).t;
    if (j.action === 'rtcPoll' && w) { const end = Date.now() + Math.min(6000, w); while (JSON.parse(out).data && !(JSON.parse(out).data.signals || []).length && Date.now() < end) { await new Promise(r => setTimeout(r, 200)); out = m.ctx.doPost({ postData: { contents: body0 } }).t; } }
    if (/rtc/.test(jj0.action)) TRACE.push(who + ' ' + jj0.action + (jj0.payload.type ? ':' + jj0.payload.type : '') + (jj0.payload.wait ? ' W' : '') + ' sent@' + ((tq - t0) / 1000).toFixed(1) + ' back@' + ((Date.now() - t0) / 1000).toFixed(1) + (stall ? ' STALL' : '') + ' sig=' + ((JSON.parse(out).data || {}).signals || []).map(x => x.type).join(',')); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out }); });
  await pg.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve();
    navigator.mediaDevices.getDisplayMedia = async () => { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d'); setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random() * 999).toString().padStart(3, '0'); g.fillRect(0, 0, 1280, 720); }, 100); return c.captureStream(15); };
  });
  await pg.goto('http://127.0.0.1:8769/index.html'); await pg.waitForTimeout(2500);
  await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', isAdmin ? 'แอดมิน' : 'ต้น');
  await pg.fill('#pinIn', pinv); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter');
  await pg.waitForFunction(() => window.S && S.screen === 'app', null, { timeout: 20000 });
  return pg;
}
const host = await open('host', false, su.pin);   // ต้น shares
const viewer = await open('viewer', true, pin);   // admin views
await host.waitForTimeout(1500);
const t1 = Date.now(); console.log('REQ at', ((t1 - t0) / 1000).toFixed(1));
await viewer.evaluate(() => T.rtcRequest('ต้น', 'ต้น', false));
await host.waitForSelector('#rtcModal [data-rtc="yes"]', { timeout: 30000 }); const tPrompt = Date.now();
await host.click('#rtcModal [data-rtc="yes"]'); const tAccept = Date.now(); console.log('ACCEPT at', ((tAccept - t0) / 1000).toFixed(1));
await viewer.waitForFunction(() => R.state === 'live', null, { timeout: 40000 }); const tLive = Date.now();
await host.waitForFunction(() => R.state === 'live', null, { timeout: 10000 });
console.log(TRACE.filter(l => !/rtcPoll sent@\S+ back@\S+ sig=$/.test(l) || / STALL/.test(l)).join('\n')); console.log('request→prompt', ((tPrompt - t1) / 1000).toFixed(1) + 's', '| accept→viewer live', ((tLive - tAccept) / 1000).toFixed(1) + 's');
console.log('host DPiP', await host.evaluate(() => 'documentPictureInPicture' in window), 'pipEarly', await host.evaluate(() => !!R.pipEarly), 'pip', await host.evaluate(() => !!R.pip)); console.log('dc states', await viewer.evaluate(() => R.dc && R.dc.readyState), await host.evaluate(() => R.dc && R.dc.readyState));
await viewer.waitForTimeout(800);
await viewer.evaluate(() => T.rtcAct('tool', { dataset: { v: 'pen' } }));
const box = await viewer.locator('#rtcInk').boundingBox(); console.log('ink canvas', !!box);
await viewer.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3); await viewer.mouse.down();
await viewer.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 10 }); await viewer.mouse.up();
await host.waitForTimeout(500);
console.log('host strokes', await host.evaluate(() => R.ink.strokes.length), 'host peek in DOM', await host.evaluate(() => !!(R.peek && R.peek.isConnected)), 'peekOpen', await host.evaluate(() => R.peekOpen));
await host.screenshot({ path: new URL('out/rtc-host.png', import.meta.url).pathname }); await viewer.screenshot({ path: new URL('out/rtc-viewer.png', import.meta.url).pathname });
await viewer.evaluate(() => T.rtcAct('hang', {})); await host.waitForTimeout(3000);
// call test
const c0 = Date.now();
await viewer.evaluate(() => T.callStart('ต้น', 'ต้น'));
await host.waitForSelector('#rtcModal [data-rtc="yes"]', { timeout: 30000 }); const cP = Date.now();
await host.click('#rtcModal [data-rtc="yes"]'); const cA = Date.now();
await viewer.waitForFunction(() => R.state === 'live', null, { timeout: 40000 }); const cL = Date.now();
console.log('call: dial→ring', ((cP - c0) / 1000).toFixed(1) + 's', '| answer→connected', ((cL - cA) / 1000).toFixed(1) + 's');
await b.close(); srv.close();
