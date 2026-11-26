// v2.129: อัปเดตแอปเอง — รีโหลดเองเมื่อปลอดภัย · มีงานค้าง (ฟอร์ม/บันทึก/ข้อความที่พิมพ์) = รอก่อน · หลังอัปเดตบอกเวอร์ชันใหม่
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const PORT = 8932;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={updSafe,updApply,openEditor,closeEditor};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1000);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));

eq('idle app: safe to reload', await pg.evaluate(() => T.updSafe()), true);
// ฟอร์มงานเปิดอยู่ → ยังไม่รีโหลด
const id = await pg.evaluate(() => S.jobs[0].id);
await pg.evaluate(id => T.openEditor(id), id); await pg.waitForTimeout(300);
eq('editor open: wait', await pg.evaluate(() => T.updSafe()), false);
await pg.evaluate(() => T.closeEditor()); await pg.waitForTimeout(300);
// มีการบันทึกค้าง → ยังไม่รีโหลด
eq('write in flight: wait', await pg.evaluate(() => { S.inflight = 1; const r = T.updSafe(); S.inflight = 0; return r; }), false);
// ข้อความพิมพ์ค้างในช่องข้อความ → ยังไม่รีโหลด
eq('prefilled text ok, unsent text: wait', await pg.evaluate(() => { const t = document.createElement('textarea'); t.defaultValue = 'ข้อความเดิมในหน้า'; document.body.appendChild(t); const r0 = T.updSafe(); t.value = 'ยังไม่ได้ส่ง'; const r = T.updSafe(); t.remove(); return [r0, r]; }), [true, false]);
// มีเวอร์ชันใหม่ระหว่างที่ยังไม่ว่าง → ขึ้นแจ้ง แล้วรีโหลดเองเมื่อว่าง
await pg.evaluate(() => { S.draftDirty = true; T.updApply(); });
await pg.waitForTimeout(300);
eq('busy: shows notice, no reload yet', await pg.evaluate(() => [/มีเวอร์ชันใหม่/.test(document.body.innerText), typeof T]), [true, 'object']);
const nav = pg.waitForEvent('load', { timeout: 10000 }).then(() => true).catch(() => false);
await pg.evaluate(() => { S.draftDirty = false; });
eq('reloads by itself once free', await nav, true);
// หลังรีโหลดเพราะอัปเดต → บอกเวอร์ชันใหม่ (จำลองว่ามาจากเวอร์ชันเก่า)
await pg.evaluate(() => sessionStorage.setItem('kn-upd', '0.0.1')); await pg.reload(); await pg.waitForTimeout(2500);
eq('after update: version toast', await pg.evaluate(() => /อัปเดตเป็นเวอร์ชัน 2\.129\.0 แล้ว/.test(document.body.innerText)), true);

eq('page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' fail');
await b.close(); srv.close();
if (bad) process.exit(1);
