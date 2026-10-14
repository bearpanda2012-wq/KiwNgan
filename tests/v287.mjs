// v2.87: รอลง Express — บันทึกเบิก/รับในแอป · รายการรอ · ยกเลิก/ลงเอง · การ์ดสรุป 6 ใบ
// ข้อมูลจำลอง (ไม่ใช้ข้อมูลจริงของบริษัท) · ถ้ามี tests/out/exfix.json (ข้อมูลจริง ไม่ขึ้น git) จะใช้ทดสอบความเร็วด้วย
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8834;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,exStart,exSync};window.exPendText=exPendText;window.digestCalc=digestCalc;window.S=S;window.SV=SV;window.EX=EX;window.EV=EV;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };

// ---- ข้อมูลจำลองแบบเดียวกับที่ ex_pull ส่งมา ----
const real = fs.existsSync(new URL('out/exfix.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('out/exfix.json', import.meta.url))) : null;
const items = [], locs = [], moves = [];
const it = (cod, des, grp, unit, bal, unitpr) => { items.push([cod, des, '', grp, '0', unit, bal, bal * unitpr, unitpr, '20260901', unitpr, 'SUP01', '', '', '20261001', 0]); };
it('RM-SB-02-0104', 'เหล็กกล่อง 2 mm. 1"x4"', 'RM', 'ส', 5, 760); locs.push(['RM-SB-02-0104', 'RM', 5, 3800, '20261012', 0]);
it('GST-CL-FSS8083', 'สีน้ำ 4SEASON TOA8083 แบบด้าน ภายนอก', 'GST1', 'กป', 1, 174.77); locs.push(['GST-CL-FSS8083', 'GST1', 1, 174.77, '20261010', 0]);
it('NEG-001', 'ของติดลบ', 'RM', 'ผน', -2, 100); locs.push(['NEG-001', 'RM', -2, -200, '20261011', 0]);
for (let i = 0; i < 2500; i++) it('ZZ-' + String(i).padStart(5, '0'), 'เศษวัสดุ ' + i, i % 3 ? 'ZZ' : 'CU', 'ชน', i % 4 ? 0 : i % 7 + 1, 10);
items.filter(x => x[6]).forEach(x => { if (!locs.some(l => l[0] === x[0])) locs.push([x[0], x[3], x[6], x[7], '20261001', 0]); });
const td = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
moves.push(['OU6910010', td, 'RM', '6', 2, 760, 1520, '', '115', '451/16512', 'RM-SB-02-0104'], ['RR6910003', td, 'RM', '0', 7, 760, 5320, 'SUP01', '', 'เหล็กกล่อง 2 mm. 1"x4"', 'RM-SB-02-0104']);
const tabs = { units: { 'ส': 'เส้น', 'กป': 'กระป๋อง', 'ชน': 'ชิ้น', 'ผน': 'แผ่น' }, locs: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.', ZZ: 'เศษ', CU: 'วัสดุลูกค้า' }, groups: { RM: 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลืองรง.อื่น', ZZ: 'เศษวัสดุ', CU: 'ลูกค้า' }, deps: { '115': 'ฝ่ายผลิต' } };
let agentAt = new Date().toISOString(), pulls = [], extra = null;
await pg.route('https://ex.test/rest/v1/rpc/**', async route => {
  const fn = route.request().url().split('/').pop(), body = JSON.parse(route.request().postData() || '{}');
  if (body.tok !== 'exr_test_token_123456789012345') return route.fulfill({ status: 401, body: '{"message":"bad token"}' });
  let out;
  if (fn === 'ex_pull') {
    pulls.push(body.since);
    if (+body.since === 0) out = { items: items.slice(0, 2000), locs: [], tabs: {}, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: true, ver: 2000, top: 3000 };
    else if (+body.since === 2000) out = { items: items.slice(2000), locs: locs, tabs: tabs, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: false, ver: 3000, top: 3000 };
    else out = extra && +body.since === 3000 ? extra : { items: [], locs: [], tabs: {}, agent: { at: agentAt, host: 'SERVER', dir: 'ROY69' }, more: false, ver: +body.since, top: +body.since };
  } else if (fn === 'ex_recent') out = moves;
  else if (fn === 'ex_card') out = moves.filter(m => m[10] === body.cod).map(m => m.slice(0, 10).concat('ROY69'));
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
});

await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); indexedDB.deleteDatabase('kn-ex'); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('stock'); }); await pg.waitForTimeout(400);
eq('no Express tab without config', await pg.locator('.ex-tabs').count(), 0);
await pg.evaluate(() => T.exStart({ url: 'https://ex.test', key: 'k', tok: 'exr_test_token_123456789012345' })); await pg.waitForTimeout(800);
eq('tabs appear', await pg.locator('.ex-tabs [data-exsrc="ex"]').count(), 1);
await pg.click('[data-exsrc="ex"]');
await pg.waitForFunction(() => document.querySelectorAll('.ex-row').length > 0, null, { timeout: 8000 }).catch(() => {});
await pg.waitForTimeout(500);
// การ์ดสรุป 6 ใบ (รวม "สินค้าทั้งหมด")
eq('6 KPI cards incl. total + pending', await pg.evaluate(() => [...document.querySelectorAll('.ex-kpis .sk-kpi small')].map(e => e.textContent)), ['สินค้าทั้งหมด', 'มีของในคลัง', 'ใกล้หมด', 'ยอดติดลบ', 'รอลง Express', 'เคลื่อนไหว 7 วัน']);
eq('total card counts all codes', await pg.evaluate(() => document.querySelector('.sk-kpi.k-tot b').textContent), items.length.toLocaleString('th-TH'));
eq('no "ทั้งหมด" chip any more', await pg.locator('.qchip[data-exgrp="all"]').count(), 0);
await pg.click('.sk-kpi.k-tot'); await pg.waitForTimeout(250);
eq('total card filters all + pressed', await pg.evaluate(() => [EV.grp, document.querySelector('.sk-kpi.k-tot').getAttribute('aria-pressed')]), ['all', 'true']);
await pg.click('.sk-kpi.k-all'); await pg.waitForTimeout(250);
// 2.92: กดการ์ด → เลื่อนไปที่รายการ · ตัวเลขนับขึ้นจนถึงค่าจริง
await pg.setViewportSize({ width: 1400, height: 600 });
await pg.evaluate(() => scrollTo(0, 0)); await pg.click('.sk-kpi.k-mv'); await pg.waitForTimeout(900);
eq('movement card scrolls to history', await pg.evaluate(() => { const r = document.querySelector('#exHist').getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2; }), true);
await pg.evaluate(() => scrollTo(0, 0)); await pg.click('.sk-kpi.k-low'); await pg.waitForTimeout(900);
eq('low card filters + scrolls to list', await pg.evaluate(() => { const r = document.querySelector('#exList').getBoundingClientRect(); return [EV.grp, r.top >= -2 && r.top < innerHeight / 2]; }), ['low', true]);
await pg.evaluate(() => scrollTo(0, 0)); await pg.click('.sk-kpi.k-wait'); await pg.waitForTimeout(900);
eq('pending card scrolls to pending panel', await pg.evaluate(() => { const r = document.querySelector('#xpPanel').getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2; }), true);
await pg.setViewportSize({ width: 1400, height: 900 });
await pg.click('.sk-kpi.k-all'); await pg.waitForTimeout(300);
eq('count-up lands on real numbers', await pg.evaluate(() => [...document.querySelectorAll('.ex-kpis b[data-cnt]')].every(b => b.textContent.replace(/,/g, '') === b.dataset.cnt)), true);
eq('cards have meters', await pg.locator('.ex-kpis .k-bar u').count(), 6);
eq('soft palette: light card background, colored number (not white-on-color)', await pg.evaluate(() => { const c = document.querySelector('.ex-kpis .sk-kpi.k-low'), b = c.querySelector('.skt b'); const lum = s => { const m = s.match(/[\d.]+/g).map(Number); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]); }; const bgImg = getComputedStyle(c).backgroundImage; return [getComputedStyle(b).color !== 'rgb(255, 255, 255)', /gradient/.test(bgImg)]; }), [true, true]);
eq('entrance animation only on first render (no replay on 20s refresh)', await pg.evaluate(() => { const first = document.querySelector('.ex-kpis').classList.contains('in'); T.render(); return [document.querySelector('.ex-kpis').classList.contains('in')]; }), [false]);
await pg.evaluate(() => scrollTo(0, 0)); await pg.waitForTimeout(1200); await pg.locator('.ex-kpis').screenshot({ path: new URL('out/v292-kpis.png', import.meta.url).pathname });
await pg.evaluate(() => { EV.grp = 'bal'; EV.rowAnim = true; T.render(); }); await pg.waitForTimeout(900);
await pg.locator('.ex-tabs').screenshot({ path: new URL('out/v293-tabs.png', import.meta.url).pathname });
{ const bx = await pg.locator('#exList').boundingBox(); await pg.locator('#exList').scrollIntoViewIfNeeded(); const b2 = await pg.locator('#exList').boundingBox(); await pg.screenshot({ path: new URL('out/v293-list.png', import.meta.url).pathname, clip: { x: b2.x, y: Math.max(0, b2.y), width: b2.width, height: Math.min(560, 900 - Math.max(0, b2.y)) } }); }
eq('group chips + rows carry group colour', await pg.evaluate(() => [!!document.querySelector('.ex-chip .ex-cd'), getComputedStyle(document.querySelector('.ex-row')).getPropertyValue('--g').trim().startsWith('#'), document.querySelector('.ex-tabs').dataset.on]), [true, true, 'ex']);
eq('pending empty state', await pg.evaluate(() => /ไม่มีรายการรอลง/.test(document.querySelector('#xpPanel').textContent)), true);
// เปิดสินค้า → บันทึกเบิก
await pg.click('.ex-row[data-excard="RM-SB-02-0104"] .ex-n'); await pg.waitForTimeout(400);
eq('card shows pending box', await pg.locator('#exModal .ex-pbox [data-xpnew="RM-SB-02-0104"]').count(), 1);
await pg.click('#exModal [data-xpnew]'); await pg.waitForTimeout(300);
eq('pend modal opens on top', await pg.evaluate(() => !!document.querySelector('#exPend') && document.querySelector('#exPend .pm-h h3').textContent), 'บันทึกเบิกออก 1 รายการ');
eq('location preselected', await pg.evaluate(() => document.querySelector('[data-xploc="0"]').value), 'RM');
await pg.click('[data-xpsave]'); await pg.waitForTimeout(200);
eq('qty required', await pg.locator('#exPend').count(), 1);
await pg.fill('[data-xpq="0"]', '2'); await pg.fill('#xpJob', 'R69-555'); await pg.fill('#xpNote', 'หน้างาน A');
await pg.click('[data-xpsave]'); await pg.waitForTimeout(600);
eq('saved → modal closed', await pg.locator('#exPend').count(), 0);
eq('pending row stored', await pg.evaluate(() => EX.pend.map(r => [r.cod, r.kind, r.qty, r.job, r.note, r.loc, r.status])), [['RM-SB-02-0104', 'out', 2, 'R69-555', 'หน้างาน A', 'RM', 'wait']]);
eq('card shows projected balance', await pg.evaluate(() => /ยอดหลังลงครบ ≈ 3/.test(document.querySelector('#exModal .ex-pbox').textContent)), true);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('row tag รอลง −2', await pg.evaluate(() => document.querySelector('.ex-row[data-excard="RM-SB-02-0104"] .ex-pendtag').textContent), 'รอลง −2');
eq('pending KPI = 1', await pg.evaluate(() => document.querySelector('.sk-kpi.k-wait b').textContent), '1');
eq('panel lists entry', await pg.evaluate(() => document.querySelectorAll('#xpPanel .xp-list > li.st-wait').length), 1);
// หลายรายการจากที่เลือก → รับเข้า
await pg.click('.ex-row[data-excard="GST-CL-FSS8083"] .ex-ck'); await pg.click('.ex-row[data-excard="NEG-001"] .ex-ck'); await pg.waitForTimeout(200);
await pg.click('.ex-selbar [data-xpnew]'); await pg.waitForTimeout(300);
await pg.click('[data-xpkind="in"]'); await pg.fill('[data-xpq="0"]', '4'); await pg.fill('[data-xpq="1"]', '3');
eq('kind switch keeps qty', await pg.evaluate(() => [document.querySelector('#exPend h3').textContent, document.querySelector('[data-xpq="0"]').value]), ['บันทึกรับเข้า 2 รายการ', '4']);
await pg.click('[data-xpsave]'); await pg.waitForTimeout(600);
eq('3 waiting now', await pg.evaluate(() => EX.pend.filter(r => r.status === 'wait').map(r => r.kind + r.qty).sort()), ['in3', 'in4', 'out2']);
eq('copy text grouped', await pg.evaluate(() => { const t = exPendText(); return [/เบิกออก 1 รายการ/.test(t), /รับเข้า 2 รายการ/.test(t), /Job R69-555/.test(t)]; }), [true, true, true]);
// ลงแล้วเอง (ฝ่ายสต็อก/แอดมิน) + ยกเลิก
const id0 = await pg.evaluate(() => EX.pend.find(r => r.kind === 'out').id);
await pg.click('#xpPanel [data-xpdoc="' + id0 + '"]'); await pg.waitForTimeout(200);
await pg.fill('#xpDoc', 'PD6910099'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
eq('manual done with doc', await pg.evaluate(id => { const r = EX.pend.find(x => x.id === id); return [r.status, r.doc]; }, id0), ['done', 'PD6910099']);
eq('done shown in history', await pg.evaluate(() => /ลงแล้ว PD6910099/.test(document.querySelector('.xp-done').textContent)), true);
const id1 = await pg.evaluate(() => EX.pend.find(r => r.kind === 'in' && r.status === 'wait').id);
await pg.click('#xpPanel [data-xpcancel="' + id1 + '"]'); await pg.waitForTimeout(500);
eq('cancelled', await pg.evaluate(id => EX.pend.find(x => x.id === id).status, id1), 'cancel');
eq('pending KPI = 1 left', await pg.evaluate(() => document.querySelector('.sk-kpi.k-wait b').textContent), '1');
// จากหน้าคำนวณราคา → บันทึกตามจำนวน
await pg.click('[data-excalc]'); await pg.waitForTimeout(300);
eq('basis buttons fit text', await pg.evaluate(() => [...document.querySelectorAll('.ex-basis button')].every(b => b.scrollWidth <= b.clientWidth + 1)), true);
await pg.locator('.ex-calcbar').screenshot({ path: new URL('out/v2874-basis.png', import.meta.url).pathname });
eq('print and PDF are separate buttons', await pg.evaluate(() => [document.querySelector('#exCalc [data-exprint]').textContent, document.querySelector('#exCalc [data-expdf]').textContent]), ['พิมพ์', 'PDF']);
{ const G = (await import('child_process')).execSync('npm root -g').toString().trim(), libs = { 'html2canvas.min.js': G + '/html2canvas/dist/html2canvas.min.js', 'jspdf.umd.min.js': G + '/jspdf/dist/jspdf.umd.min.js' };
  if (fs.existsSync(libs['jspdf.umd.min.js'])) {
    await pg.route('https://cdnjs.cloudflare.com/**', r => { const f = libs[r.request().url().split('/').pop()]; return f ? r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }) : r.abort(); });
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click('#exCalc [data-expdf]')]);
    const out = new URL('out/v2875-calc.pdf', import.meta.url).pathname; await dl.saveAs(out);
    console.log('pdf name', dl.suggestedFilename()); eq('PDF downloaded', [/\.pdf$/i.test(dl.suggestedFilename()), fs.readFileSync(out).slice(0, 4).toString(), fs.statSync(out).size > 5000], [true, '%PDF', true]);
    const keep = await pg.evaluate(() => { const k = [...EV.sel.entries()]; [...EX.items.keys()].filter(c => c.startsWith('ZZ-')).slice(0, 90).forEach(c => EV.sel.set(c, '')); return k; });
    const [dl2] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('#exCalc [data-expdf]')]);
    const out2 = new URL('out/v2875-long.pdf', import.meta.url).pathname; await dl2.saveAs(out2);
    eq('long list → several pages', (fs.readFileSync(out2).toString('latin1').match(/\/Type \/Page[^s]/g) || []).length >= 3, true);
    await pg.evaluate(k => { EV.sel = new Map(k); }, keep); await pg.waitForTimeout(300);
  } else console.log('skip PDF (no libs)');
}
await pg.click('[data-xpfromcalc]'); await pg.waitForTimeout(300);
eq('calc → pend modal with qty prefilled', await pg.evaluate(() => [!!document.querySelector('#exCalc'), document.querySelectorAll('#exPend [data-xpq]').length, document.querySelector('[data-xpq="0"]').value]), [false, 2, '1']);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('escape closes pend modal', await pg.locator('#exPend').count(), 0);
// 2.88: คีย์เข้า Express — ตรวจก่อน · ไม่ผ่านไม่ส่ง
await pg.evaluate(() => { const t = new Date().toISOString().slice(0, 19); EX.pend.push({ id: 'k1', ts: t, cod: 'RM-SB-02-0104', kind: 'out', qty: 2, loc: 'RM', dep: '', job: 'R69-9', note: 'หน้างาน', who: 'แอดมิน', status: 'wait' }, { id: 'k2', ts: t, cod: 'RM-SB-02-0104', kind: 'out', qty: 4, loc: 'RM', dep: '', job: 'R69-9', note: '', who: 'แอดมิน', status: 'wait' }, { id: 'k3', ts: t, cod: 'GST-CL-FSS8083', kind: 'out', qty: 1, loc: 'GST1', dep: '', job: 'R69-9', note: '', who: 'แอดมิน', status: 'wait' }, { id: 'k4', ts: t, cod: 'ZZ-00001', kind: 'out', qty: 1, loc: 'ZZ', dep: '', job: '', note: '', who: 'แอดมิน', status: 'wait' }); T.render(); });
await pg.waitForTimeout(200);
eq('key button for stock', await pg.locator('#xpPanel [data-xkopen]').count(), 1);
await pg.click('#xpPanel [data-xkopen]'); await pg.waitForTimeout(300);
eq('check: ok vs blocked', await pg.evaluate(() => [document.querySelectorAll('#exKey .xk-r.ok').length, document.querySelectorAll('#exKey .xk-r.bad').length]), [2, 3]);
eq('reasons shown', await pg.evaluate(() => { const t = document.querySelector('#exKey .xk-list').textContent; return [/ยอดในคลัง RM ไม่พอ: มี 5 ต้องการ 6/.test(t), /รับเข้า: ยังคีย์อัตโนมัติไม่ได้/.test(t), /คลัง ZZ ไม่มีสินค้านี้/.test(t)]; }), [true, true, true]);
await pg.evaluate(() => { window.__nav = []; }); 
await pg.click('#exKey [data-xksend]'); await pg.waitForTimeout(300);
eq('only passing rows sent, grouped into 1 OU doc', await pg.evaluate(() => { const u = EV.xk.url, b = u.replace('kiwngan-express:', '').replace(/-/g, '+').replace(/_/g, '/'); const j = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))))); return [j.v, j.docs.length, j.docs[0].rem, j.docs[0].lines.map(l => l.cod + '@' + l.loc + 'x' + l.qty)]; }), [1, 1, 'Job R69-9 · หน้างาน', ['RM-SB-02-0104@RMx2', 'GST-CL-FSS8083@GST1x1']]);
await pg.locator('#exKey .pm-card').screenshot({ path: new URL('out/v288-key.png', import.meta.url).pathname });
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('key modal closes', await pg.locator('#exKey').count(), 0);
await pg.evaluate(() => { EX.pend = EX.pend.filter(r => !/^k\d$/.test(r.id)); T.render(); });
// สรุปเช้า (ตัวอย่างในแอป)
eq('digest preview has pending line', await pg.evaluate(() => /🧾 รอลง Express 1 รายการ/.test(digestCalc().body)), true);
await pg.evaluate(() => { scrollTo(0, 0); document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0; }); }); await pg.waitForTimeout(200); await pg.screenshot({ path: new URL('out/v287-express.png', import.meta.url).pathname }); await pg.locator('.ex-kpis').screenshot({ path: new URL('out/v287-kpis.png', import.meta.url).pathname });
await pg.click('.ex-row[data-excard="RM-SB-02-0104"] .ex-n'); await pg.waitForTimeout(300); await pg.click('#exModal [data-xpnew]'); await pg.waitForTimeout(300);
await pg.fill('[data-xpq="0"]', '1'); eq('kind buttons fit text', await pg.evaluate(() => [...document.querySelectorAll('.xp-kind button')].every(b => b.scrollWidth <= b.clientWidth + 1)), true); await pg.screenshot({ path: new URL('out/v287-pend.png', import.meta.url).pathname });
await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape');
// ผู้ใช้ที่ไม่ใช่ฝ่ายสต็อก: ดู/ค้นหาได้อย่างเดียว
await pg.evaluate(() => { EV.sel.set('RM-SB-02-0104', '3'); });
eq('non-stock: view only — no checkboxes, no selection bar, selection cleared', await pg.evaluate(() => { const real = S.user.role; S.user.role = 'user'; T.render(); const r = [document.querySelectorAll('.ex-ck').length, !!document.querySelector('.ex-selbar'), EV.sel.size, !!document.querySelector('.ex-list.ro'), getComputedStyle(document.querySelector('.ex-row')).gridTemplateColumns.split(' ').length];
  const cb = document.querySelector('.ex-row'); S.user.role = real; return r; }), [0, false, 0, true, 4]);
await pg.evaluate(() => { const real = S.user.role; S.user.role = 'user'; window.__ro = real; });
await pg.click('.ex-row[data-excard="RM-SB-02-0104"] .ex-n'); await pg.waitForTimeout(400);
eq('non-stock card: no select / record / min editor', await pg.evaluate(() => [!!document.querySelector('#exModal [data-exsel]'), !!document.querySelector('#exModal [data-xpnew]'), !!document.querySelector('#exMinIn')]), [false, false, false]);
await pg.keyboard.press('Escape'); await pg.evaluate(() => { S.user.role = window.__ro; T.render(); }); await pg.waitForTimeout(200);
eq('non-stock: no record buttons', await pg.evaluate(() => { const real = S.user.role; S.user.role = 'user'; T.render(); const r = [document.querySelectorAll('[data-xpnew],[data-xpcancel],[data-xpdoc]').length, /ดูและค้นหาได้อย่างเดียว/.test(document.querySelector('.ex-status').textContent), document.querySelectorAll('#xpPanel .xp-list li').length > 0]; S.user.role = real; T.render(); return r; }), [0, true, true]);
eq('group chips wrap inside panel', await pg.evaluate(() => { const c = document.querySelector('.ex-chips'); return c.scrollWidth <= c.clientWidth + 1 && [...c.children].every(b => b.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1); }), true);
// คลังในแอป: ผู้ใช้ทั่วไปเห็นปุ่มอะไรบ้าง (ต้องไม่มีปุ่มแก้ไข)
const roBtns = await pg.evaluate(async () => { const real = S.user.role; S.user.role = 'user'; SV.src = 'app'; T.render(); await new Promise(r => setTimeout(r, 300));
  const names = new Set(); document.querySelectorAll('#view button, #view input, #view [role=button]').forEach(b => { Object.keys(b.dataset).forEach(k => names.add(k)); if (b.tagName === 'INPUT') names.add('input:' + (b.id || b.type)); });
  const card = document.querySelector('[data-skopen],[data-sk],[data-stid],.sk-card'); let cardBtns = [];
  if (card) { card.click(); await new Promise(r => setTimeout(r, 400)); document.querySelectorAll('.pmodal button, .pmodal input').forEach(b => { Object.keys(b.dataset).forEach(k => cardBtns.push(k)); if (b.tagName === 'INPUT') cardBtns.push('input:' + (b.id || b.type)); }); document.querySelectorAll('.pmodal').forEach(m => m.remove()); document.body.classList.remove('pm-open'); }
  S.user.role = real; SV.src = 'ex'; T.render(); return [[...names].sort(), [...new Set(cardBtns)].sort()]; });
console.log('app-stock controls for non-stock user:', JSON.stringify(roBtns));
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.render()); await pg.waitForTimeout(300);
eq('mobile: no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.locator('#xpPanel').scrollIntoViewIfNeeded(); await pg.screenshot({ path: new URL('out/v287-mobile.png', import.meta.url).pathname });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad || errs.length ? 1 : 0);
