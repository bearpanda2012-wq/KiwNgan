// QC ก่อนแพ็ค: ติ๊กหัวข้อตรวจ ผ่าน → แพ็ค, ไม่ผ่าน → ส่งกลับไปแก้ + รูปผู้ใช้บนแบนเนอร์
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api,pModalOpen};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8872);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8872/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);

await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('prod'); }); await pg.waitForTimeout(500);
const id = await pg.evaluate(async () => { const r = await T.api().prodSave({ prod: { code: 'QC-SCROLL', title: 'ทดสอบเลื่อน', paint: 'no', assy: 'no', stage: 'machine', machines: [{ m: 'Laser', d: '2026-10-09T09:00' }] } }); S.prods.push(r.prod); T.go('prod'); return r.prod.id; });
await pg.waitForTimeout(500);
eq('stage qc', await pg.evaluate(id => S.prods.find(p => p.id === id).stage, id), 'qc');
await pg.evaluate(id => T.pModalOpen(id), id); await pg.waitForTimeout(600);
eq('QC open', await pg.locator('#pModal .qc-box').count(), 1);
const n = await pg.locator('#pModal .qc-it').count();
let moved = 0;
for (let k = 3; k < n; k++) {
  await pg.locator('#pModal .qc-it').nth(k).scrollIntoViewIfNeeded(); await pg.waitForTimeout(150);
  const before = await pg.evaluate(() => document.querySelector('#pModal .pm-b').scrollTop);
  const y0 = (await pg.locator('#pModal .qc-it').nth(k).boundingBox()).y;
  await pg.locator('#pModal .qc-it').nth(k).tap(); await pg.waitForTimeout(700);
  const after = await pg.evaluate(() => document.querySelector('#pModal .pm-b').scrollTop), y1 = (await pg.locator('#pModal .qc-it').nth(k).boundingBox()).y;
  if (Math.abs(after - before) > 2 || Math.abs(y1 - y0) > 12) { moved++; console.log('moved at', k, before, after, y0, y1); }
}
eq('ticked items stay ticked', await pg.locator('#pModal .qc-it.on').count(), n - 3);
eq('no scroll jump when ticking', moved, 0);
// ช่องพิมพ์ยังโฟกัสอยู่หลังติ๊ก
await pg.fill('#qcNote', 'ทดสอบ'); await pg.locator('#pModal .qc-it').nth(0).tap(); await pg.waitForTimeout(600);
eq('note kept', await pg.inputValue('#qcNote'), 'ทดสอบ');
await pg.screenshot({ path: new URL('out/v21003.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
