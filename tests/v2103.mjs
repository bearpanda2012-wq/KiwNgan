// QC ก่อนแพ็ค: ติ๊กหัวข้อตรวจ ผ่าน → แพ็ค, ไม่ผ่าน → ส่งกลับไปแก้ + รูปผู้ใช้บนแบนเนอร์
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api,pModalOpen};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8877);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8877/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);

await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); });
await pg.evaluate(async () => { for (const [c, ms] of [['MC-R', ['Router']], ['MC-L', ['Laser']], ['MC-P', ['Punching']], ['MC-W', ['WaterJet', 'Router']]]) { const r = await T.api().prodSave({ prod: { code: c, title: 'สีเครื่อง ' + ms.join('+'), stage: 'machine', machines: ms.map(m => ({ m: m, d: '' })) } }); S.prods.push(r.prod); } T.go('prod'); });
await pg.waitForTimeout(800);
const cols = await pg.$$eval('.pcard .mrow', a => a.map(r => [r.querySelector('b').textContent.trim(), getComputedStyle(r).getPropertyValue('--mc').trim()]));
const by = {}; cols.forEach(([n, c]) => { by[n] = c; });
eq('each machine row has a color', ['Router', 'Laser', 'Punching', 'WaterJet'].every(n => !!by[n]), true);
eq('colors all different', new Set(['Router', 'Laser', 'Punching', 'WaterJet'].map(n => by[n])).size, 4);
eq('same machine same color everywhere', await pg.$$eval('.pcard .mrow', a => { const m = {}; return a.every(r => { const n = r.querySelector('b').textContent.trim(), c = getComputedStyle(r).getPropertyValue('--mc').trim(); if (m[n] && m[n] !== c) return false; m[n] = c; return true; }); }), true);
const col = pg.locator('.pboard .col').filter({ has: pg.locator('.mrow') }).first();
await col.screenshot({ path: new URL('out/v2103a.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
