// QC ก่อนแพ็ค: ติ๊กหัวข้อตรวจ ผ่าน → แพ็ค, ไม่ผ่าน → ส่งกลับไปแก้ + รูปผู้ใช้บนแบนเนอร์
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8798);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8798/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
eq('user avatar on banner', await pg.locator('.topbar .hero-me .av').count(), 1);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('prod'); }); await pg.waitForTimeout(600); await pg.screenshot({ path: out + 'prod-board.png' });
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('prod'); }); await pg.waitForTimeout(500);
const id = await pg.evaluate(async () => { const r = await T.api().prodSave({ prod: { code: 'QC-1', title: 'ป้ายทดสอบ', paint: 'no', assy: 'no', stage: 'machine', machines: [{ m: 'Laser', d: '2026-10-09T09:00' }] } }); S.prods.push(r.prod); T.go('prod'); return r.prod.id; });
await pg.waitForTimeout(500);
eq('job lands in QC column', await pg.evaluate(id => S.prods.find(p => p.id === id).stage, id), 'qc');
eq('QC column on board', await pg.locator('.pboard .col.p-qc, .pboard [data-col="qc"], .pboard .p-qc').count() > 0, true);
await pg.click('.pcard[data-popen="' + id + '"] [data-pqc]'); await pg.waitForTimeout(500);
eq('QC section open', await pg.locator('#pModal .qc-box').count(), 1);
eq('no paint item when paint skipped', await pg.locator('#pModal .qc-it', { hasText: 'สีตรงตามตัวอย่าง' }).count(), 0);
eq('pass disabled until all ticked', await pg.locator('#pModal [data-qcpass]').isDisabled(), true);
// ไม่ผ่าน
await pg.click('#pModal [data-qcfail="ask"]'); await pg.waitForTimeout(200);
await pg.click('#pModal [data-qcback="machine"]'); await pg.fill('#qcWhy', 'ขอบบิ่น 2 ชิ้น'); await pg.click('#pModal [data-qcfail="go"]'); await pg.waitForTimeout(800);
eq('fail sends back to machine', await pg.evaluate(id => S.prods.find(p => p.id === id).stage, id), 'machine');
eq('fail counted', await pg.evaluate(id => JSON.parse(S.prods.find(p => p.id === id).qc).fails, id), 1);
eq('fail summary shown', await pg.locator('#pModal .qc-sum.bad').count(), 1);
// แก้แล้วกลับมา QC อีกรอบ
await pg.locator('#pModal .pm-f [data-pclose]').click(); await pg.waitForTimeout(200);
await pg.evaluate(async id => { const r = await T.api().prodSave({ prod: { id: id, machines: [{ m: 'Laser', d: '2026-10-10T09:00' }] } }); const i = S.prods.findIndex(p => p.id === id); S.prods[i] = r.prod; T.go('prod'); }, id); await pg.waitForTimeout(400);
await pg.click('.pcard[data-popen="' + id + '"] [data-pqc]'); await pg.waitForTimeout(500);
eq('previous failure warned', await pg.locator('#pModal .qc-warn').count(), 1);
const n = await pg.locator('#pModal .qc-it').count();
for (let k = 0; k < n; k++) { await pg.locator('#pModal .qc-it').nth(k).click(); await pg.waitForTimeout(120); }
await pg.fill('#qcOk', '12');
eq('all ticked', await pg.locator('#pModal .qc-n.all').count(), 1);
await pg.locator('#pModal .qc-box').screenshot({ path: out + 'qc-box.png' });
await pg.click('#pModal [data-qcpass]'); await pg.waitForTimeout(900);
const pr = await pg.evaluate(id => { const p = S.prods.find(p => p.id === id); return [p.stage, JSON.parse(p.qc).res, JSON.parse(p.qc).ok]; }, id);
eq('pass → pack with result', pr, ['pack', 'pass', '12']);
eq('pass summary shown', await pg.locator('#pModal .qc-sum:not(.bad)').count(), 1);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
