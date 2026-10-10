// v2.60: ธงด่วนติดไปจนส่งมอบ — งานฝ่ายแบบด่วน → การ์ดผลิตทุกขั้นมีป้ายด่วน, ขึ้นก่อน, ติดเองได้, หน้า Sale/ภาพรวมเห็นด่วนแม้ฝ่ายแบบเสร็จแล้ว
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,moveJob,coRows,pModalOpen,saveJob};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8798);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.goto('http://127.0.0.1:8798/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// urgent CAM job → done → production
await pg.evaluate(() => T.openEditor(null)); await pg.waitForTimeout(400);
await pg.fill('#e-code', 'URG-1'); await pg.selectOption('#e-group', { index: 1 }); await pg.selectOption('#e-type', 'ทำ CAM'); await pg.check('[data-e="priority"]');
await pg.click('[data-act="save"]'); await pg.waitForTimeout(1500);
const jid = await pg.evaluate(() => S.jobs.find(j => j.code === 'URG-1').id);
for (const st of ['doing', 'done']) { await pg.evaluate(([id, s]) => T.moveJob(id, s), [jid, st]); await pg.waitForTimeout(900); }
await pg.waitForTimeout(800);
const pid = await pg.evaluate(() => (S.prods.find(p => p.code === 'URG-1') || {}).id);
eq('production job created with urgent flag', await pg.evaluate(id => S.prods.find(p => p.id === id).priority, pid), 'urgent');
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
eq('prod card shows ด่วน', await pg.locator(`.pcard[data-popen="${pid}"].is-urgent .tag.urgent`).count(), 1);
eq('urgent cards sorted first in รอผลิต', await pg.evaluate(() => { const f = [...document.querySelectorAll('[data-pcol="wait"] .pcard')].map(c => c.classList.contains('is-urgent')); return f.indexOf(false) < 0 || f.lastIndexOf(true) < f.indexOf(false); }), true);
await pg.locator(`.pcard[data-popen="${pid}"]`).screenshot({ path: new URL('out/urgent-card.png', import.meta.url).pathname });
// walk to ready: flag still there
await pg.evaluate(id => { const p = S.prods.find(x => x.id === id); p.stage = 'ready'; }, pid);
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(300);
eq('still ด่วน at พร้อมส่ง', await pg.locator(`[data-pcol="ready"] .pcard[data-popen="${pid}"] .tag.urgent`).count(), 1);
eq('company overview keeps ด่วน after design is done', await pg.evaluate(() => (T.coRows().find(r => r.code === 'URG-1') || {}).urgent), true);
// manual flag on a production-only job
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(300);
const other = await pg.evaluate(() => S.prods.find(p => p.stage !== 'shipped' && p.code !== 'URG-1' && !S.jobs.some(j => j.code === p.code && j.priority === 'urgent')).id);
await pg.evaluate(id => T.pModalOpen(id), other); await pg.waitForTimeout(300);
eq('toggle shown in production popup', await pg.locator('#pModal [data-purg]').count(), 1);
await pg.click('#pModal [data-purg]'); await pg.waitForTimeout(900);
eq('manual urgent saved', await pg.evaluate(id => S.prods.find(p => p.id === id).priority, other), 'urgent');
eq('popup header shows ด่วน', await pg.locator('#pModal .pm-h .tag.urgent').count(), 1);
await pg.locator('#pModal .pm-card').screenshot({ path: new URL('out/urgent-modal.png', import.meta.url).pathname });
await pg.click('#pModal [data-purg]'); await pg.waitForTimeout(900);
eq('manual urgent removed', await pg.evaluate(id => S.prods.find(p => p.id === id).priority, other), '');
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
