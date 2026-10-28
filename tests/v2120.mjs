// v2.120: ประกอบก่อนทำสี · ถามคนทำตอนย้ายขั้น/ติ๊กเครื่องเสร็จ · จับเวลารายเครื่อง · เตือนคอขวด · สาเหตุงานช้า · แนวโน้ม · ส่งออก Excel
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,pModalOpen,pModalClose,prodById,stageNorms,slowInfo,stageTimes,reportState,render,PCOLS,jLate,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8920);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8920/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));

// 1) ลำดับขั้น: ประกอบก่อนทำสี (บอร์ดผลิต + แบนเนอร์ภาพรวมบริษัท)
eq('stage order', await pg.evaluate(() => T.PCOLS), ['wait', 'machine', 'assemble', 'paint', 'qc', 'pack', 'ready']);
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(500);
eq('company banner: ประกอบ before ทำสี', await pg.evaluate(() => { const t = [...document.querySelectorAll('.co-pipe [data-cf]')].map(e => e.dataset.cf); return t.indexOf('assemble') >= 0 && t.indexOf('assemble') < t.indexOf('paint'); }), true);

// 2) ย้ายขั้นจาก "ประกอบ" → ถามคนทำ (เลือกหลายคน) → ไป "ทำสี" และบันทึกคนทำในประวัติ
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
const pid = await pg.evaluate(() => { const p = S.prods.find(x => x.stage === 'assemble' && x.paint !== 'no'); return p && p.id; });
eq('demo has a job in ประกอบ', !!pid, true);
await pg.evaluate(id => T.pModalOpen(id), pid); await pg.waitForTimeout(400);
await pg.click('#pModal [data-padv]'); await pg.waitForTimeout(300);
eq('who picker opens', await pg.locator('#whoSheet .ws-p').count() >= 2, true);
await pg.click('#whoSheet .ws-p:has-text("ช่างเอ")'); await pg.waitForTimeout(150);
eq('two people picked', await pg.locator('#whoSheet .ws-p.on').count(), 2);
await pg.screenshot({ path: out + 'v2120-who.png' });
await pg.click('#whoSheet [data-wsok]'); await pg.waitForTimeout(900);
eq('moved to ทำสี with workers saved', await pg.evaluate(id => { const p = T.prodById(id), h = JSON.parse(p.history).pop(); return [p.stage, h.s, (h.w || []).slice().sort()]; }, pid), ['paint', 'paint', ['ช่างเอ', 'แอดมิน'].sort()]);
eq('history shows workers', await pg.locator('#pModal .pm-hw').first().innerText().then(t => /ช่างเอ/.test(t)).catch(() => false), true);
// ยกเลิกในหน้าต่างถาม = ไม่ย้าย
await pg.click('#pModal [data-padv]'); await pg.waitForTimeout(300); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
eq('cancel keeps stage', await pg.evaluate(id => T.prodById(id).stage, pid), 'paint');
await pg.evaluate(() => T.pModalClose()); await pg.waitForTimeout(300);

// 3) ติ๊กเครื่องเสร็จ → ถามคนคุมเครื่อง · เก็บเวลาเริ่ม/เสร็จ/คนทำ ต่อเครื่อง
const mid = await pg.evaluate(() => { const p = S.prods.find(x => x.stage === 'machine' && JSON.parse(x.machines).some(m => !m.d)); return p && p.id; });
eq('demo has a job on machine', !!mid, true);
await pg.evaluate(id => T.pModalOpen(id), mid); await pg.waitForTimeout(400);
const mname = await pg.evaluate(() => { const b = [...document.querySelectorAll('#pModal .mrow:not(.done)')][0]; return b && b.dataset.pmd; });
await pg.click('#pModal .mrow[data-pmd="' + mname + '"]'); await pg.waitForTimeout(300);
eq('machine who picker', await pg.locator('#whoSheet').innerText().then(t => t.indexOf(mname) >= 0), true);
await pg.click('#whoSheet .ws-p:has-text("ช่างเอ")'); await pg.click('#whoSheet .ws-p:has-text("แอดมิน")'); await pg.waitForTimeout(100);
await pg.click('#whoSheet [data-wsok]'); await pg.waitForTimeout(900);
eq('machine done with operator + start time', await pg.evaluate(([id, m]) => { const p = T.prodById(id), x = JSON.parse(p.machines).find(y => y.m === m); return [!!x.d, (x.w || []).join(), !!x.s || JSON.parse(p.history).some(h => h.s === 'machine')]; }, [mid, mname]), [true, 'ช่างเอ', true]);
await pg.evaluate(() => T.pModalClose()); await pg.waitForTimeout(300);

// 4) เตือนคอขวด: ขั้นที่งานอยู่นานกว่าเฉลี่ย × 1.5
eq('slowInfo rule', await pg.evaluate(() => {
  const now = Date.now(), iso = ms => { const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }, day = 864e5;
  const done = [1, 2, 3].map(i => ({ stage: 'shipped', history: JSON.stringify([{ t: iso(now - 20 * day), s: 'paint' }, { t: iso(now - 19 * day), s: 'qc' }]) }));
  const slow = { stage: 'paint', history: JSON.stringify([{ t: iso(now - 3 * day), s: 'paint' }]) }, fine = { stage: 'paint', history: JSON.stringify([{ t: iso(now - 1.2 * day), s: 'paint' }]) };
  const n = T.stageNorms(done.concat(slow, fine), now);
  return [Math.round(n.paint.avg * 10) / 10, !!T.slowInfo(slow, n, now), !!T.slowInfo(fine, n, now)]; }), [1, true, false]);
await pg.evaluate(() => { const now = Date.now(), iso = ms => { const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  for (let i = 0; i < 3; i++) S.prods.push({ id: 'p_x' + i, code: 'SLW-' + i, stage: 'shipped', shippedAt: iso(now - 15 * 864e5), machines: '[]', history: JSON.stringify([{ t: iso(now - 18 * 864e5), s: 'pack' }, { t: iso(now - 17.8 * 864e5), s: 'ready' }]) });
  S.prods.push({ id: 'p_slow', code: 'SLW-9', title: 'งานค้างแพ็ค', stage: 'pack', machines: '[]', enteredAt: iso(now - 9 * 864e5), history: JSON.stringify([{ t: iso(now - 4 * 864e5), s: 'pack' }]) });
  T.render(); });
await pg.waitForTimeout(500);
eq('board banner lists slow job', await pg.locator('.slow-ban').innerText().then(t => /SLW-9/.test(t)).catch(() => false), true);
eq('card has slow tag', await pg.locator('[data-pcol="pack"] .pt-slow').count() >= 1, true);
await pg.locator('.slow-ban').screenshot({ path: out + 'v2120-slow.png' }).catch(() => {});

// 5) สาเหตุที่ช้า: งานฝ่ายแบบที่เลยกำหนด
const lj = await pg.evaluate(() => { const j = S.jobs.find(x => T.jLate(x) && x.status !== 'done'); return j && j.id; });
eq('demo has a late design job', !!lj, true);
await pg.evaluate(id => T.openEditor(id), lj); await pg.waitForTimeout(700);
eq('late box shown', await pg.locator('.late-box [data-latewhy]').count(), 6);
await pg.click('.late-box [data-latewhy="cust"]'); await pg.waitForTimeout(900);
eq('reason saved', await pg.evaluate(id => S.jobs.find(j => j.id === id).lateWhy, lj), 'cust');
await pg.fill('.late-box [data-latenote]', 'รอยืนยันสี'); await pg.press('.late-box [data-latenote]', 'Tab'); await pg.waitForTimeout(900);
eq('reason note saved', await pg.evaluate(id => S.jobs.find(j => j.id === id).lateWhy, lj), 'cust|รอยืนยันสี');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

// 6) รายงาน: สาเหตุงานช้า + แนวโน้มย้อนหลัง + ดาวน์โหลด Excel
await pg.evaluate(() => { const r = T.reportState(); r.preset = 'year'; r.from = new Date().getFullYear() + '-01-01'; r.to = new Date().getFullYear() + '-12-31'; r.sec.why = true; r.sec.flow = true; T.go('report'); }); await pg.waitForTimeout(800);
eq('why section ranks รอลูกค้า', await pg.locator('.rsec-why').innerText().then(t => /รอลูกค้า/.test(t)), true);
eq('jobs table shows reason', await pg.locator('.rjobs .rwhy').count() >= 1, true);
eq('trend chart drawn (8 weeks)', [await pg.locator('.bn-trend .tr-svg').count(), await pg.locator('.bn-trend .tr-ax[text-anchor="middle"]').count()], [1, 8]);
await pg.click('[data-bntr="m"]'); await pg.waitForTimeout(500);
eq('trend monthly = 6 points', await pg.locator('.bn-trend .tr-ax[text-anchor="middle"]').count(), 6);
await pg.locator('.rsec-flow').screenshot({ path: out + 'v2120-flow.png' }).catch(() => {});
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act="xlsx"]')]);
console.log('   file: ' + dl.suggestedFilename()); const fp = out + 'v2120.xlsx'; await dl.saveAs(fp); const buf = fs.readFileSync(fp), txt = buf.toString('utf8');
eq('xlsx: zip + sheets', [buf[0] === 0x50 && buf[1] === 0x4b, dl.suggestedFilename().endsWith('.xlsx'), /sheet name="รายการงาน"/.test(txt), /sheet name="คอขวด"/.test(txt), /sheet name="สาเหตุงานช้า"/.test(txt), /รอยืนยันสี/.test(txt)], [true, true, true, true, true, true]);
// เปิดไฟล์ด้วย Python (openpyxl) ถ้ามี — ยืนยันว่า Excel อ่านได้จริง
try { const { execSync } = await import('child_process'); const o = execSync('python3 -c "import openpyxl,sys;w=openpyxl.load_workbook(sys.argv[1]);print(\'|\'.join(w.sheetnames), w[\'รายการงาน\'].max_row)" ' + JSON.stringify(fp)).toString().trim(); eq('xlsx opens in openpyxl', /^รายการงาน\|/.test(o), true); console.log('   ' + o); } catch (e) { console.log('   (skip openpyxl: ' + String(e.message).split('\n')[0] + ')'); }

console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
