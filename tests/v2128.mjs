// v2.128: กดแล้วไม่เด้งกลับ — โหลดเบื้องหลังที่ค้างอยู่ไม่ทับสิ่งที่เพิ่งกด · กดติดกันเร็ว ๆ ไม่ชนกันเอง (งานแบบ + บอร์ดผลิต)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const PORT = 8931;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={moveJob,prodWrite,load,Demo,prodById,jobById};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1000);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));

// หลังบ้านช้า: bootstrap อ่านข้อมูล "ตอนถูกเรียก" แล้วค่อยตอบ (= ข้อมูลเก่า) · การบันทึกช้า
await pg.evaluate(() => {
  const D = T.Demo, sleep = ms => new Promise(r => setTimeout(r, ms));
  const bs = D.bootstrap.bind(D), sj = D.saveJob.bind(D), ps = D.prodSave.bind(D);
  window.__bootMs = 900; window.__saveMs = 300; window.__calls = [];
  D.bootstrap = async a => { const d = JSON.parse(JSON.stringify(await bs(a))); await sleep(window.__bootMs); return d; };
  D.saveJob = async p => { await sleep(window.__saveMs); window.__calls.push(['job', p.job.status, p.job.baseUpdatedAt || '']); return sj(p); };
  D.prodSave = async p => { await sleep(window.__saveMs); try { const r = await ps(p); window.__calls.push(['prod', p.prod.stage, 'ok']); return r; } catch (e) { window.__calls.push(['prod', p.prod.stage, e.message]); throw e; } };
});
// sampler: จดสถานะของงานทุก 40ms เพื่อจับว่ามีจังหวะเด้งกลับไหม
const watch = (kind, id) => pg.evaluate(([kind, id]) => { window.__seen = []; clearInterval(window.__w); const tick = () => { const x = kind === 'job' ? T.jobById(id) : T.prodById(id); const v = x && (kind === 'job' ? x.status : x.stage); if (window.__seen[window.__seen.length - 1] !== v) window.__seen.push(v); }; tick(); window.__w = setInterval(tick, 40); }, [kind, id]);
const settle = () => pg.waitForFunction(() => !S.loading && !S.saving && !S.inflight, null, { timeout: 15000 }).then(() => pg.waitForTimeout(1500));   // รอโหลดใหม่หลังบันทึก (loadAfterWrites) จบก่อน
const seen = () => pg.evaluate(() => { clearInterval(window.__w); return window.__seen; });

// 1) โหลดเบื้องหลังค้างอยู่ แล้วกดย้ายสถานะ → ผลโหลด (ข้อมูลเก่า) ต้องไม่ทับ
const jid = await pg.evaluate(() => S.jobs.find(j => j.status === 'queue' && !j.pending).id);
await watch('job', jid);
await pg.evaluate(id => { S.dataStamp = ''; T.load(true); setTimeout(() => T.moveJob(id, 'doing'), 60); }, jid);
await pg.waitForTimeout(3500);
eq('stale load does not bounce job back', await seen(), ['queue', 'doing']);
eq('job saved as doing', await pg.evaluate(id => T.jobById(id).status, jid), 'doing');

// 2) กดย้ายสถานะติดกัน 2 ครั้งเร็ว ๆ (queue → doing → review) ส่งทีละครั้ง ไม่เด้งกลับ
const jid2 = await pg.evaluate(() => S.jobs.find(j => j.status === 'queue' && !j.pending && j.taskType && !/CAM$/.test(j.taskType)).id);
await pg.evaluate(() => { window.__calls = []; window.__saveMs = 1100; });
await watch('job', jid2);
await pg.evaluate(id => { T.moveJob(id, 'doing'); setTimeout(() => T.moveJob(id, 'review'), 80); }, jid2);
await pg.waitForTimeout(3500);
eq('double tap: no bounce', await seen(), ['queue', 'doing', 'review']);
eq('double tap: saved in order, second uses fresh updatedAt', await pg.evaluate(() => { const c = window.__calls.filter(x => x[0] === 'job'); return [c.map(x => x[1]), c.length === 2 && c[0][2] !== c[1][2]]; }), [['doing', 'review'], true]);
eq('double tap: final review', await pg.evaluate(id => T.jobById(id).status, jid2), 'review');

// 3) บอร์ดผลิต: กดเลื่อนขั้นติดกัน 2 ครั้ง + มีโหลดเบื้องหลังค้าง → ไม่ชน ไม่เด้งกลับ
const pid = await pg.evaluate(() => { const p = (S.prods || []).find(x => x.stage === 'assemble'); return p && p.id; });
if (pid) {
  // 3a) เลื่อนขั้น (ประกอบ → ทำสี) ระหว่างมีโหลดเบื้องหลังค้าง → ไม่เด้งกลับ
  await pg.evaluate(() => { window.__calls = []; window.__saveMs = 1100; window.__bootMs = 900; });
  await watch('prod', pid);
  await pg.evaluate(id => { S.dataStamp = ''; T.load(true); setTimeout(() => T.prodWrite(id, { stage: 'paint' }), 60); }, pid);
  await pg.waitForTimeout(3500);
  eq('prod stage: no bounce', await seen(), ['assemble', 'paint']);
  // 3b) แก้งานเดียวกันติดกัน 2 ครั้ง → ส่งทีละครั้ง ไม่ชนกันเอง ไม่เด้งกลับ
  await pg.evaluate(() => { window.__calls = []; });
  await pg.evaluate(id => { window.__seen = []; clearInterval(window.__w); window.__w = setInterval(() => { const v = T.prodById(id).note; if (window.__seen[window.__seen.length - 1] !== v) window.__seen.push(v); }, 40); }, pid);
  const note0 = await pg.evaluate(id => T.prodById(id).note, pid);
  await pg.evaluate(id => { S.dataStamp = ''; T.load(true); setTimeout(() => T.prodWrite(id, { note: 'แก้ครั้งที่ 1' }), 60); setTimeout(() => T.prodWrite(id, { note: 'แก้ครั้งที่ 2' }), 160); }, pid);
  await pg.waitForTimeout(4000);
  eq('prod double edit: no bounce', await seen(), [note0, 'แก้ครั้งที่ 1', 'แก้ครั้งที่ 2']);
  eq('prod double edit: both saves ok (no self-conflict)', await pg.evaluate(() => window.__calls.filter(x => x[0] === 'prod').map(x => x[2])), ['ok', 'ok']);
} else { bad++; console.log('FAIL no prod in assemble stage to test'); }

// 4) ไม่มีการบันทึกค้าง → โหลดเบื้องหลังยังอัปเดตข้อมูลตามปกติ (ไม่ถูกทิ้งตลอด)
await pg.evaluate(() => { window.__bootMs = 50; }); await settle();
await pg.evaluate(() => { T.Demo.db && (() => { const d = T.Demo.db(); d.jobs[0].title = 'เปลี่ยนจากเครื่องอื่น'; T.Demo.save(d); })(); S.dataStamp = ''; return T.load(true); });
await pg.waitForTimeout(400);
eq('idle load still applies', await pg.evaluate(() => S.jobs.some(j => j.title === 'เปลี่ยนจากเครื่องอื่น')), true);
eq('no write left busy', await pg.evaluate(() => [S.saving || 0, S.inflight || 0]), [0, 0]);

eq('page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' fail');
await b.close(); srv.close();
if (bad) process.exit(1);
