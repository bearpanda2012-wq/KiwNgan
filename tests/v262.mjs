// v2.62: ฉลาก QR + เปิดงานจากลิงก์ · หลักฐานส่งมอบ · แจ้งเตือนของใกล้หมด · ราคา/ต้นทุนต่อ Job · คอขวดในรายงาน · เมนูเพิ่มเติมบนมือถือ · PIN Sale รายคน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const shot = n => new URL('out/' + n + '.png', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,pModalOpen,scanFrame,scanCode,scanLoadLib,stockAlerts,tabSplit,prodById,imgsOf,jobMaterials,stageTimes,reportState};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8802);
const URL0 = 'http://127.0.0.1:8802/index.html';
const b = await chromium.launch({ args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const clean = () => pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
const loginAdmin = async () => { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1300); await clean(); };
const loginAs = async n => { await pg.click('.who:has-text("' + n + '")'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter').catch(() => {}); await pg.waitForTimeout(1300); await clean(); };
const logout = async () => { await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto(URL0); await pg.waitForTimeout(800); };

await pg.goto(URL0); await pg.waitForTimeout(600); await loginAdmin();

/* ---- 1. ฉลาก QR ---- */
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(400);
const rp = await pg.evaluate(() => S.prods.find(p => p.stage === 'ready'));
await pg.evaluate(id => T.pModalOpen(id), rp.id); await pg.waitForTimeout(300);
await pg.click('#pModal [data-qrlabel]'); await pg.waitForTimeout(600);
eq('QR modal opens with QR svg', await pg.locator('#qrModal .ql-qr svg').count(), 1);
eq('label shows job code', (await pg.locator('#qrModal .ql-t b').innerText()).trim(), rp.code);
eq('link encodes ?job=', await pg.locator('#qrModal .qr-link .mono').innerText(), '127.0.0.1:8802/?job=' + encodeURIComponent(rp.code));
await pg.click('[data-qrsize="a4"]');
eq('A4 counts sheets', /จำนวนแผ่น/.test(await pg.locator('.qr-copies').innerText()), true);
await pg.click('[data-qrprint]'); await pg.waitForTimeout(200);
eq('A4 × 1 sheet prints 8 labels, no browser header', await pg.evaluate(() => { const t = document.getElementById('qrFrame').srcdoc; return [(t.match(/class="ql"/g) || []).length, /size:A4 portrait;margin:0/.test(t)]; }), [8, true]);
await pg.waitForTimeout(500);
await pg.click('[data-qrsize="label"]'); await pg.click('[data-qrn="1"]'); await pg.click('[data-qrn="1"]');
await pg.locator('#qrModal .pm-card').screenshot({ path: shot('v262-qr') });
await pg.evaluate(() => { HTMLIFrameElement.prototype.__noop = 1; });
await pg.click('[data-qrprint]'); await pg.waitForTimeout(200);
const sd = await pg.evaluate(() => { const f = document.getElementById('qrFrame'); return f ? f.srcdoc : ''; });
eq('label size × 3 prints 3 labels', [(sd.match(/class="ql"/g) || []).length, /100mm 70mm/.test(sd)], [3, true]);
await pg.waitForTimeout(500); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
eq('Esc closes QR modal, job modal stays', [await pg.locator('#qrModal').count(), await pg.locator('#pModal').count()], [0, 1]);
await pg.keyboard.press('Escape');
// machine stage: tick machines in modal
const mp = await pg.evaluate(() => S.prods.find(p => p.stage === 'machine' && JSON.parse(p.machines).some(m => !m.d)));
await pg.evaluate(id => T.pModalOpen(id), mp.id); await pg.waitForTimeout(300);
const nUndone = await pg.locator('#pModal .pm-mdone .mrow:not(.done)').count();
await pg.locator('#pModal .pm-mdone .mrow:not(.done)').first().click(); await pg.waitForTimeout(1200);
eq('modal ticks a machine done', await pg.evaluate(id => JSON.parse(T.prodById(id).machines).filter(m => !m.d).length, mp.id), nUndone - 1);
await pg.keyboard.press('Escape');
// card forward arrow: machine → all machines done → next stage; paint → ประกอบ
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(300);
const fm = await pg.evaluate(() => (S.prods.find(p => p.stage === 'machine') || {}).id);
if (fm) { await pg.click(`.pcard[data-popen="${fm}"] [data-pfwd]`); await pg.waitForTimeout(1200);
  eq('→ on machine card finishes all machines', await pg.evaluate(id => { const p = T.prodById(id); return [p.stage !== 'machine', JSON.parse(p.machines).every(m => m.d)]; }, fm), [true, true]); }
const fp = await pg.evaluate(() => (S.prods.find(p => p.stage === 'paint' && p.assy !== 'no') || {}).id);
if (fp) { await pg.click(`.pcard[data-popen="${fp}"] [data-pfwd]`); await pg.waitForTimeout(1200); eq('→ on paint card goes to ประกอบ', await pg.evaluate(id => T.prodById(id).stage, fp), 'assemble'); }
// in-app scanner: decode a real QR image of the job link → opens job
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(300);
eq('scan button on prod board', await pg.locator('.topbar [data-act="scan"]').count(), 1);
await pg.click('.topbar [data-act="scan"]'); await pg.waitForTimeout(800);
eq('scanner opens (no camera → fallback message)', await pg.locator('#scanModal .scan-card').count(), 1);
const dec = await pg.evaluate(async code => { await T.scanLoadLib(); const q = window.qrcode(0, 'M'); q.addData(location.origin + '/?job=' + encodeURIComponent(code)); q.make();
  const im = new Image(); await new Promise(r => { im.onload = r; im.src = q.createDataURL(8, 16); }); const t = await T.scanFrame(im, im.naturalWidth, im.naturalHeight); return [t.indexOf('?job=') > 0, T.scanCode(t)]; }, rp.code);
eq('jsQR decodes label → job code', dec, [true, rp.code]);
eq('plain job code also accepted', await pg.evaluate(c => T.scanCode(c.toLowerCase()), rp.code), rp.code);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
eq('Esc closes scanner', await pg.locator('#scanModal').count(), 0);
// deep link ?job=
await pg.goto(URL0.replace('index.html', '') + '?job=' + encodeURIComponent(rp.code)); await pg.waitForTimeout(2200);
eq('?job= link opens that job', await pg.evaluate(() => (document.querySelector('#pModal h3') || {}).textContent || ''), rp.code);
eq('?job= removed from address bar', await pg.evaluate(() => location.search), '');
await pg.keyboard.press('Escape');

/* ---- 4. ราคา + ต้นทุนต่อ Job ---- */
await pg.evaluate(() => T.go('stock')); await pg.waitForTimeout(400);
const sid = await pg.evaluate(() => S.stock.items[0].id);
await pg.click(`.sk-card[data-sopen="${sid}"]`); await pg.waitForTimeout(300);
await pg.click('[data-sedit]'); await pg.waitForTimeout(250);
await pg.fill('#sfPrice', '1500'); await pg.click('[data-ssave]'); await pg.waitForTimeout(1200);
eq('price saved', await pg.evaluate(id => S.stock.items.find(x => x.id === id).price, sid), 1500);
eq('item view shows value', /มูลค่าคงเหลือ/.test(await pg.locator('#sModal .sk-mins').innerText()), true);
await clean(); await pg.waitForSelector('#sModal [data-skind="out"]'); await pg.click('[data-skind="out"]'); await pg.waitForTimeout(200); await pg.fill('#smQty', '2'); await pg.fill('#smJob', rp.code); await pg.click('[data-sgo]'); await pg.waitForTimeout(1200);
await pg.keyboard.press('Escape');
eq('materials for job: 2 × ฿1,500', await pg.evaluate(c => T.jobMaterials(c).map(x => [x.qty, x.cost]), rp.code), [[2, 3000]]);
await pg.evaluate(id => T.pModalOpen(id), rp.id); await pg.waitForTimeout(300);
eq('job modal lists material + cost', [await pg.locator('#pModal .mat-list li').count(), (await pg.locator('#pModal .mat-tot b').innerText()).replace(/\s/g, '')], [1, '฿3,000']);
await pg.keyboard.press('Escape');

/* ---- 5. รายงาน: คอขวด + ต้นทุน ---- */
await pg.evaluate(() => { const r = T.reportState(); r.preset = 'custom'; r.from = '2020-01-01'; r.to = '2099-12-31'; T.go('report'); }); await pg.waitForTimeout(600);
eq('report has bottleneck section with 9 rows', await pg.locator('.rsec-flow .bn-row').count(), 9);
eq('bottleneck highlighted', await pg.locator('.rsec-flow .bn-hl').count() + await pg.locator('.rsec-flow .bn-row.hot').count(), 2);
eq('report has material cost per job', (await pg.locator('.rsec-mat tbody tr').count()) >= 1, true);
eq('report total includes ฿3,000 job', /฿3,000/.test(await pg.locator('.rsec-mat').innerText()), true);
await pg.locator('.rsec-flow').screenshot({ path: shot('v262-flow') });

/* ---- 7. PIN Sale รายคน (ตั้งที่หน้าตั้งค่า) ---- */
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(500);
const saleName = await pg.evaluate(s => s && S.settings.sales.indexOf(s) >= 0 ? s : S.settings.sales[0], rp.sale);
const si = await pg.evaluate(n => S.settings.sales.filter(Boolean).indexOf(n), saleName), sj = si === 0 ? 1 : 0;
await pg.fill('#salePinSet' + si, '4321'); await pg.click('[data-pinin="salePinSet' + si + '"]'); await pg.waitForTimeout(800);
eq('person PIN saved', await pg.evaluate(() => S.salePins), [saleName]);
await pg.fill('#salePinSet' + sj, '4321'); await pg.click('[data-pinin="salePinSet' + sj + '"]'); await pg.waitForTimeout(800);
eq('duplicate PIN rejected', await pg.evaluate(() => S.salePins.length), 1);
await pg.locator('#s-salelink').screenshot({ path: shot('v262-salepins') });

/* ---- 6. เมนูเพิ่มเติมบนมือถือ ---- */
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.go('home')); await pg.waitForTimeout(500);
eq('admin bottom bar: 4 tabs + เพิ่มเติม', [await pg.locator('#tabbar > button[data-view]').count(), await pg.locator('#tabbar .tab-more').count()], [4, 1]);
eq('bar fits one row', await pg.evaluate(() => { const t = document.getElementById('tabbar'); return t.scrollWidth <= t.clientWidth + 1 && t.getBoundingClientRect().height < 90; }), true);
await pg.click('#tabbar .tab-more'); await pg.waitForTimeout(500);
eq('more sheet lists the other 5 menus', await pg.locator('#moreSheet .ms-grid button[data-view]').count(), 5);
await pg.screenshot({ path: shot('v262-more') });
await pg.click('#moreSheet .ms-grid [data-view="report"]'); await pg.waitForTimeout(600);
eq('picked menu opens & sheet closes', [await pg.evaluate(() => S.view), await pg.locator('#moreSheet.open').count()], ['report', 0]);
eq('current menu shown in bar', await pg.locator('#tabbar [data-view="report"][aria-current="true"]').count(), 1);
await pg.setViewportSize({ width: 1360, height: 900 });

/* ---- 2. หลักฐานส่งมอบ (ฝ่ายสต็อก) + 3. แจ้งเตือนของใกล้หมด ---- */
await logout(); await loginAs('คลังบี');
eq('stock user lands on stock-ish view', ['stock', 'prod'].indexOf(await pg.evaluate(() => S.view)) >= 0, true);
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(400);
await pg.click(`.pcard[data-popen="${rp.id}"] [data-padv]`); await pg.waitForTimeout(400);
eq('ส่งแล้ว opens delivery proof dialog', await pg.locator('#shipModal .sig-box canvas').count(), 1);
await pg.fill('#shipTo', 'คุณบี ผู้รับเหมา'); await pg.fill('#shipNote', 'วางหน้าไซต์');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');
await pg.setInputFiles('#shipImg', { name: 'box.png', mimeType: 'image/png', buffer: png }); await pg.waitForTimeout(300);
eq('photo queued', await pg.locator('#shipModal .pa-im img').count(), 1);
const cv = await pg.locator('#shipSig').boundingBox();
await pg.mouse.move(cv.x + 40, cv.y + 60); await pg.mouse.down(); for (let i = 0; i < 12; i++) await pg.mouse.move(cv.x + 40 + i * 20, cv.y + 60 + Math.sin(i) * 25); await pg.mouse.up();
eq('signature drawn', await pg.locator('#shipModal .sig-box.has').count(), 1);
await pg.locator('#shipModal .pm-card').screenshot({ path: shot('v262-ship') });
await pg.click('[data-shipgo]'); await pg.waitForTimeout(2500);
const shipped = await pg.evaluate(id => { const p = T.prodById(id); return { st: p.stage, sp: JSON.parse(p.ship || '{}'), n: T.imgsOf('d_' + id).length }; }, rp.id);
eq('job shipped with proof', [shipped.st, shipped.sp.to, shipped.sp.note, !!shipped.sp.sig, shipped.n], ['shipped', 'คุณบี ผู้รับเหมา', 'วางหน้าไซต์', true, 2]);
eq('dialog closed', await pg.locator('#shipModal').count(), 0);
await pg.evaluate(id => T.pModalOpen(id), rp.id); await pg.waitForTimeout(500);
eq('job modal shows proof (photo + signature)', [await pg.locator('#pModal .ship-proof .pa-im').count(), await pg.locator('#pModal .ship-proof .shp-sig').count()], [1, 1]);
await pg.locator('#pModal .ship-proof').screenshot({ path: shot('v262-proof') });
await pg.keyboard.press('Escape');
// low-stock alert in app (another person withdrew)
const lowN = await pg.evaluate(() => { const prev = JSON.parse(JSON.stringify(S.stock)); const it = S.stock.items.find(x => +x.min > 0 && +x.qty > +x.min); prev.items.find(x => x.id === it.id).qty = it.qty; it.qty = it.min; it.updatedBy = 'ช่างเอ'; T.stockAlerts(prev); return document.querySelectorAll('.ntf.job-low').length; });
eq('stock staff gets in-app low-stock alert', lowN, 1);
eq('no alert for own withdrawals', await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); const prev = JSON.parse(JSON.stringify(S.stock)); const it = S.stock.items.find(x => +x.qty > 0); prev.items.find(x => x.id === it.id).qty = 99; it.qty = 0; it.updatedBy = S.me; T.stockAlerts(prev); return document.querySelectorAll('.ntf.job-low').length; }), 0);

/* ---- 7. Sale เข้าด้วย PIN ส่วนตัว → เห็นเฉพาะงานตัวเอง + หลักฐานส่งมอบ ---- */
await logout();
await pg.click('[data-act="saleon"]'); await pg.waitForTimeout(200); await pg.fill('#salePin', '4321'); await pg.waitForTimeout(2500);
eq('personal PIN → own sale page', await pg.evaluate(() => new URL(location.href).searchParams.get('sale')), saleName);
eq('header names the sale', /Sale /.test(await pg.locator('.sp-h small').innerText()), true);
const rows = await pg.evaluate(() => [...document.querySelectorAll('.co-row')].length);
eq('sale sees only own jobs', await pg.evaluate(n => { const d = JSON.parse(localStorage.getItem('kiwngan:demo')); const mine = new Set(d.jobs.filter(j => j.sale === n).map(j => j.code.toLowerCase()).concat((d.prods || []).filter(p => p.sale === n).map(p => p.code.toLowerCase()))); return [...document.querySelectorAll('.co-row .co-code b')].every(b => mine.has(b.textContent.trim().toLowerCase())); }, saleName), true);
if (rp.sale === saleName) {
  await pg.click('[data-sfstep="shipped"]').catch(() => {}); await pg.waitForTimeout(300);
  await pg.click(`[data-sfopen="${rp.code}"]`).catch(() => {}); await pg.waitForTimeout(400);
  eq('sale sees delivery proof', await pg.locator('.sf-ship').count(), 1);
} else console.log('(skip sale proof: job belongs to another sale)', rows);
console.log('errors', errs.join(' | ') || 'none'); if (errs.length) bad++;
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad) process.exit(1);
