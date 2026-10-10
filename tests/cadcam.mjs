// v2.59: ประเภทงาน "งาน CAD+CAM" — เขียนแบบ+CAM ในงานเดียว ส่งผลิตเลย ไม่ถามเปิดงาน CAM ต่อ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,moveJob,suggestDue,codeClash,taskCat};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8796);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.goto('http://127.0.0.1:8796/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('settings'); }); await pg.waitForTimeout(500);
const idx = await pg.evaluate(() => S.draft ? S.draft.taskTypes.findIndex(t => t.name === 'ทำ CAD+CAM') : -1);
eq('settings dropdown has งาน CAD+CAM', await pg.locator('select[data-d$=".cat"] option[value="cadcam"]').count() > 0, true);
await pg.selectOption(`select[data-d="taskTypes.${idx}.cat"]`, 'cadcam');
await pg.click('[data-act="savesettings"]'); await pg.waitForTimeout(800);
eq('saved as cadcam', await pg.evaluate(() => [T.taskCat('ทำ CAD+CAM'), T.taskCat('ทำ CAM'), T.taskCat('ทำ CAD')]), ['cadcam', 'cam', 'draw']);
const sg = await pg.evaluate(() => { const g = S.settings.groups[0], r = S.settings.sla[g]; const s = T.suggestDue({ received: '2026-10-12', group: g, taskType: 'ทำ CAD+CAM', qty: 'single' }); return [s && s.days, +r.draw[0] + +r.cam[0], s && s.cat]; });
eq('due suggestion = draw days + cam days', [sg[0] === sg[1], sg[2]], [true, 'cadcam']);
// create a CAD+CAM job, finish it → goes to production, no "open CAM job?" prompt
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(300);
await pg.evaluate(() => T.openEditor(null)); await pg.waitForTimeout(400);
await pg.fill('#e-code', 'CC-001'); await pg.fill('#e-title', 'ผนัง CAD+CAM'); await pg.selectOption('#e-group', { index: 1 }); await pg.selectOption('#e-type', 'ทำ CAD+CAM');
await pg.waitForTimeout(200);
eq('editor hint mentions CAD+CAM', await pg.locator('#sheetBody .hint:has-text("CAD+CAM")').count() > 0, true);
await pg.click('[data-act="save"]'); await pg.waitForTimeout(1500);
const jid = await pg.evaluate(() => (S.jobs.find(j => j.code === 'CC-001') || {}).id);
eq('job created', !!jid, true);
await pg.evaluate(id => T.moveJob(id, 'doing'), jid); await pg.waitForTimeout(800);
await pg.evaluate(id => T.moveJob(id, 'review'), jid); await pg.waitForTimeout(800);
eq('CAD+CAM goes through review (CAD part checked)', await pg.evaluate(id => S.jobs.find(j => j.id === id).status, jid), 'review');
await pg.evaluate(id => T.moveJob(id, 'done'), jid); await pg.waitForTimeout(1800);
eq('no "open CAM job" prompt', await pg.locator('#askBox:visible').count(), 0);
eq('sent to production (รอผลิต)', await pg.evaluate(() => (S.prods.find(p => p.code === 'CC-001') || {}).stage), 'wait');
eq('extra CAM on same code blocked', await pg.evaluate(() => T.codeClash('CC-001', 'ทำ CAM', S.jobs)), 'เลข Job CC-001 มีงาน CAM (CAD+CAM) อยู่แล้ว ถ้าเป็นงานแก้ไขให้เติมท้าย เช่น _re1');
// plain CAD still offers CAM follow-up
await pg.evaluate(() => T.openEditor(null)); await pg.waitForTimeout(300);
await pg.fill('#e-code', 'CC-002'); await pg.selectOption('#e-group', { index: 1 }); await pg.selectOption('#e-type', 'ทำ CAD'); await pg.click('[data-act="save"]'); await pg.waitForTimeout(1500);
const j2 = await pg.evaluate(() => S.jobs.find(j => j.code === 'CC-002').id);
for (const st of ['doing', 'review', 'done']) { await pg.evaluate(([id, s]) => T.moveJob(id, s), [j2, st]); await pg.waitForTimeout(800); }
await pg.waitForTimeout(800);
eq('plain CAD still offers CAM follow-up', await pg.locator('#askBox').count() > 0 && await pg.locator('#askBox').innerText().then(t => /CAM/.test(t)), true);
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
