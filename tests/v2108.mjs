// ประวัติ: แก้อะไร/เลื่อนเพราะอะไร · เลื่อนกำหนดส่งต้องใส่เหตุผล · งานออกแบบดีไซน์ไม่แสดง "จำนวน / ระดับ"
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8864;
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={openEditor,jobById,closeEditor,editDetail};window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 950 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(900);
// ตัวแปลงข้อความประวัติ
eq('editDetail text', await pg.evaluate(() => T.editDetail({ due: '2026-10-22', note: 'ก', assignee: 'อ๊อฟ', priority: 'normal' }, { due: '2026-10-24', note: 'ก\nข', assignee: 'ฝน', priority: 'urgent' }, 'สลับคิว')),
  'ผู้รับผิดชอบ อ๊อฟ → ฝน · ความด่วน · เลื่อนกำหนดส่ง 22 ต.ค. → 24 ต.ค. (+2 วัน) · เพิ่มบรีฟ: ข · เหตุผล: สลับคิว'.replace('ความด่วน', 'ตั้งเป็นงานด่วน'));
// แก้งานเดิม: เลื่อนกำหนดส่งโดยไม่ใส่เหตุผล → บันทึกไม่ได้
const id = await pg.evaluate(() => { const j = KiwNgan.S.jobs.find(x => x.status === 'queue' && x.due && !/^ออกแบบ/.test(x.taskType)); T.openEditor(j.id); return j.id; });
await pg.waitForTimeout(300); await pg.click('[data-act="editmode"]'); await pg.waitForTimeout(250);
eq('reason field shown', await pg.locator('#e-why').count(), 1);
const due0 = await pg.evaluate(id => T.jobById(id).due, id);
const later = await pg.evaluate(d => { const x = new Date(d.slice(0, 10) + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 3); return x.toISOString().slice(0, 10); }, due0);
await pg.fill('#e-due', later); await pg.fill('#e-note', 'บรีฟเดิม\n-ลูกค้าเพิ่มด้านข้าง');
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(250);
eq('blocked without reason', await pg.evaluate(() => !!KiwNgan.S.edit && !document.querySelector('#eErr').hidden), true);
await pg.fill('#e-why', 'สลับกับงาน MV Food'); await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(900);
eq('saved', await pg.evaluate(id => T.jobById(id).due, id), later);
eq('why not kept on job', await pg.evaluate(id => T.jobById(id).why, id), undefined);
await pg.evaluate(id => T.openEditor(id), id); await pg.waitForTimeout(900);
const hist = await pg.locator('#hist').innerText();
console.log(hist.split('\n').slice(0, 3).join(' | '));
eq('history shows postpone', /เลื่อนกำหนดส่ง .* \(\+3 วัน\)/.test(hist), true);
eq('history shows brief', /บรีฟ: .*-ลูกค้าเพิ่มด้านข้าง/.test(hist), true);
eq('history shows reason', hist.includes('เหตุผล: สลับกับงาน MV Food'), true);
await pg.locator('#hist').screenshot({ path: out + 'hist-why.png' });
await pg.evaluate(() => T.closeEditor()); await pg.waitForTimeout(200);
// งานออกแบบดีไซน์: ไม่มีแถว จำนวน / ระดับ · งาน CAD ยังมี
const ds = await pg.evaluate(() => { const S = KiwNgan.S; S.jobs.push({ id: 'dsx1', code: 'DS6910-002', title: 'คอนโด', taskType: 'ออกแบบ Façade', qty: 'single', level: '2', status: 'queue', assignee: S.me, received: '2026-10-11', due: '2026-10-15', ds: '{}' }); T.openEditor('dsx1'); return 'dsx1'; });
if (ds) { await pg.waitForTimeout(400); eq('design job: no level row', (await pg.locator('#sheetBody').innerText()).includes('จำนวน / ระดับ'), false); await pg.evaluate(() => T.closeEditor()); await pg.waitForTimeout(200); }
else console.log('skip: no design job in demo');
await pg.evaluate(id => T.openEditor(id), id); await pg.waitForTimeout(400);
eq('cad job keeps level row', (await pg.locator('#sheetBody').innerText()).includes('จำนวน / ระดับ'), true);
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
