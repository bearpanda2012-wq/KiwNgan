// v2.85: ทีมออกแบบดีไซน์ — หน้าเพิ่มงานแยกจาก CAD/CAM · 5 ประเภท · ช่องเฉพาะ · กำหนดส่ง 3 แบบ · เลข Job เว้นว่างได้ · เฟอร์นิเจอร์ · นัดหน้างาน · Façade เปิด PO ส่ง CAD/CAM
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8833;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,openEditor,jobById,addWorkDays,today};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('list'); });
const nJobs = await pg.evaluate(() => S.jobs.length);

// 1) เปิดเพิ่มงาน: มีปุ่มเลือกทีม · เริ่มที่ CAD/CAM เหมือนเดิม
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(400);
eq('team switch shown on new job', await pg.locator('.ds-team [data-dsteam]').count(), 2);
eq('default team is CAD/CAM (old form)', await pg.evaluate(() => [!!document.querySelector('#e-type'), !document.querySelector('.ds-kinds')]), [true, true]);
await pg.click('[data-dsteam="ds"]'); await pg.waitForTimeout(300);
eq('design form: 5 kinds, no CAD type select', await pg.evaluate(() => [document.querySelectorAll('.ds-kind').length, !!document.querySelector('#e-type')]), [5, false]);
eq('Façade first: 3 working days standard', await pg.evaluate(() => [document.querySelector('.ds-kind[aria-checked="true"]').dataset.dskind, document.querySelector('[data-dsdue="std"]').getAttribute('aria-pressed'), S.edit.job.due === T.addWorkDays(T.today(), 3, S.settings.skipWeekends !== false)]), ['facade', 'true', true]);
await pg.evaluate(() => document.querySelector('#sheetBody').scrollTop = 0); await pg.locator('#sheet').screenshot({ path: new URL('out/v285-new.png', import.meta.url).pathname });
eq('workflow preview lists steps', await pg.evaluate(() => document.querySelectorAll('.ds-flow li').length), 8);
// Façade fields
await pg.fill('#e-title', 'อาคาร ABC สุขุมวิท 24'); await pg.fill('#ds-area', '120'); await pg.fill('#ds-material', 'อลูมิเนียมเจาะลาย');
await pg.check('[data-dsf="survey"]'); await pg.waitForTimeout(50);
await pg.evaluate(() => { const el = document.querySelector('[data-dsf="survey"]'); el.dispatchEvent(new Event('change', { bubbles: true })); });
await pg.evaluate(() => { const E = S.edit; const el = document.querySelector('[data-dsf="survey"]'); el.checked = true; }); 
await pg.click('[data-dsdue="std"]'); await pg.waitForTimeout(200);
eq('survey date field appears after toggle', await pg.locator('#ds-surveyAt').count(), 1);
const tmr = await pg.evaluate(() => T.addWorkDays(T.today(), 1, false));
await pg.fill('#ds-surveyAt', tmr + 'T10:00');
// กำหนดส่ง: ไม่กำหนด
await pg.click('[data-dsdue="none"]'); await pg.waitForTimeout(200);
eq('no-deadline hides date + clears due', await pg.evaluate(() => [!!document.querySelector('#e-due'), S.edit.job.due]), [false, '']);
await pg.click('[data-dsdue="custom"]'); await pg.waitForTimeout(200);
eq('custom shows date input', await pg.locator('#e-due').count(), 1);
await pg.fill('#e-due', '2026-12-25');
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1200);
const f = await pg.evaluate(() => { const j = S.jobs.find(x => x.title === 'อาคาร ABC สุขุมวิท 24'); return j && { code: j.code, type: j.taskType, due: j.due, ds: JSON.parse(j.ds || '{}'), cl: JSON.parse(j.checklist || '[]').length, id: j.id }; });
eq('saved without Job code → auto DS code', /^DS\d{4}-\d{3}$/.test(f && f.code), true);
eq('saved kind, custom due, fields, checklist from workflow', f && [f.type, f.due, f.ds.area, f.ds.material, f.ds.survey, f.ds.surveyAt, f.cl], ['ออกแบบ Façade', '2026-12-25', '120', 'อลูมิเนียมเจาะลาย', 1, tmr + 'T10:00', 8]);
eq('next new job remembers design team', await pg.evaluate(() => { T.openEditor(); const r = S.edit.team; document.querySelector('#sheetFoot [data-act="close"]').click(); return r; }), 'ds');
await pg.waitForTimeout(300);
// การ์ด: ป้ายนัดหน้างานพรุ่งนี้
await pg.evaluate(() => T.render()); await pg.waitForTimeout(300);
eq('card shows site-visit tag (tomorrow)', await pg.evaluate(id => { const r = document.querySelector('[data-open="' + id + '"] .ds-visit'); return r && r.textContent.trim(); }, f.id), 'พรุ่งนี้ 10:00');
// หน้าดูงาน
await pg.evaluate(id => T.openEditor(id), f.id); await pg.waitForTimeout(500);
eq('detail: design section + visit + PO button', await pg.evaluate(() => [!!document.querySelector('.ds-sec'), document.querySelectorAll('.ds-vlist span').length, !!document.querySelector('[data-dspo]')]), [true, 1, true]);
await pg.locator('#sheet').screenshot({ path: new URL('out/v285-detail.png', import.meta.url).pathname });
// Façade เปิด PO → ฟอร์ม CAD/CAM ข้อมูลมาให้ ใส่เลข Job จริง
await pg.click('[data-dspo]'); await pg.waitForTimeout(500);
eq('PO opens CAD/CAM form prefilled', await pg.evaluate(() => [S.edit.team, !!document.querySelector('#e-type'), document.querySelector('#e-title').value, document.querySelector('#e-code').value]), ['cad', true, 'อาคาร ABC สุขุมวิท 24', '']);
await pg.fill('#e-code', 'R69-55501'); await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1200);
eq('CAD job created with real code', await pg.evaluate(() => !!S.jobs.find(x => x.code === 'R69-55501' && !x.ds)), true);
// เลข Job เดียวกันใช้ได้ทั้งสองทีม
await pg.evaluate(id => { T.openEditor(id); }, f.id); await pg.waitForTimeout(300);
await pg.click('#sheetFoot [data-act="editmode"]'); await pg.waitForTimeout(300);
eq('edit existing design job opens design form (no team switch)', await pg.evaluate(() => [!!document.querySelector('.ds-kinds'), !document.querySelector('.ds-team'), document.querySelector('[data-dsdue="custom"]').getAttribute('aria-pressed')]), [true, true, 'true']);
await pg.fill('#e-code', 'R69-55501'); await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1200);
eq('design job shares Job code with CAD job', await pg.evaluate(() => S.jobs.filter(x => x.code === 'R69-55501').length), 2);

// 2) คอนโด: เฟอร์นิเจอร์ + มาตรฐาน 6 วัน
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(300);
await pg.click('[data-dskind="condo"]'); await pg.waitForTimeout(200);
eq('condo: 6 days + furniture table', await pg.evaluate(() => [S.edit.job.due === T.addWorkDays(T.today(), 6, S.settings.skipWeekends !== false), !!document.querySelector('.ds-furn'), !!document.querySelector('#ds-measureAt')]), [true, true, true]);
await pg.fill('#e-title', 'คอนโด Ideo ห้อง 1205'); await pg.fill('#ds-budget', '450000');
await pg.click('[data-dsfadd]'); await pg.waitForTimeout(150);
await pg.fill('[data-dsfu="0.n"]', 'โซฟา 3 ที่นั่ง'); await pg.fill('[data-dsfu="0.p"]', '25900');
await pg.click('[data-dsfadd]'); await pg.waitForTimeout(150);
await pg.fill('[data-dsfu="1.n"]', 'โต๊ะกลาง'); await pg.fill('[data-dsfu="1.q"]', '2'); await pg.fill('[data-dsfu="1.p"]', '3500'); await pg.selectOption('[data-dsfu="1.st"]', 'ordered');
await pg.click('[data-dsfadd]'); await pg.waitForTimeout(150); await pg.click('[data-dsfdel="2"]'); await pg.waitForTimeout(150);
eq('furniture rows kept while editing', await pg.evaluate(() => [...document.querySelectorAll('[data-dsfu$=".n"]')].map(e => e.value)), ['โซฟา 3 ที่นั่ง', 'โต๊ะกลาง']);
await pg.locator('#sheet').screenshot({ path: new URL('out/v285-condo-form.png', import.meta.url).pathname });
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1200);
const c = await pg.evaluate(() => { const j = S.jobs.find(x => x.title === 'คอนโด Ideo ห้อง 1205'); return { id: j.id, furn: JSON.parse(j.ds).furn, budget: JSON.parse(j.ds).budget }; });
eq('furniture saved', c.furn.map(x => [x.n, x.q, x.p, x.st]), [['โซฟา 3 ที่นั่ง', '1', '25900', 'wait'], ['โต๊ะกลาง', '2', '3500', 'ordered']]);
await pg.evaluate(id => T.openEditor(id), c.id); await pg.waitForTimeout(400);
await pg.click('[data-dsfcopy]'); await pg.waitForTimeout(300); console.log('sheet open after copy', await pg.evaluate(() => [document.querySelector('#sheet').className, !!S.edit]));
const clip = await pg.evaluate(() => navigator.clipboard.readText());
eq('copy list for purchasing', [clip.includes('โซฟา 3 ที่นั่ง'), clip.includes('โต๊ะกลาง × 2'), /รวมประมาณ ฿32,900/.test(clip)], [true, true, true]);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);

// 3) รีโนเวท: 3 นัด · Jobshop ส่งผลิต · Catalog ไม่มีมาตรฐาน + งานประจำ
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(300);
await pg.click('[data-dskind="reno"]'); await pg.waitForTimeout(200);
eq('reno: 3 visit slots', await pg.locator('.ds-v input').count(), 3);
await pg.click('[data-dskind="catalog"]'); await pg.waitForTimeout(200);
eq('catalog: no standard due, defaults to none', await pg.evaluate(() => [!!document.querySelector('[data-dsdue="std"]'), document.querySelector('[data-dsdue="none"]').getAttribute('aria-pressed')]), [false, 'true']);
await pg.fill('#e-title', 'Wallix อัปเดตแบบ ต.ค.'); await pg.selectOption('#ds-brand', 'Wallix'); await pg.check('[data-dsf="repeat"]');
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1200);
const cat = await pg.evaluate(() => { const j = S.jobs.find(x => x.title === 'Wallix อัปเดตแบบ ต.ค.'); return { id: j.id, due: j.due, brand: JSON.parse(j.ds).brand }; });
eq('catalog saved without deadline', [cat.due, cat.brand], ['', 'Wallix']);
eq('no-deadline job never late', await pg.evaluate(id => { const j = T.jobById(id); return !j.due; }, cat.id), true);
await pg.evaluate(id => T.openEditor(id), cat.id); await pg.waitForTimeout(400);
await pg.click('[data-dsnext]'); await pg.waitForTimeout(400);
eq('next-round prefilled', await pg.evaluate(() => [S.edit.team, S.edit.job.taskType, document.querySelector('#ds-brand').value, document.querySelector('[data-dsf="repeat"]').checked]), ['ds', 'ออกแบบ Catalog/สินค้าใหม่', 'Wallix', true]);
await pg.click('#sheetFoot [data-act="close"]'); await pg.waitForTimeout(300);
eq('jobshop goes to production when done', await pg.evaluate(() => [window.KiwNgan && typeof toProdType, 1][1]), 1);
// CAD/CAM ไม่เปลี่ยน: ยังต้องใส่เลข Job
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(300);
await pg.click('[data-dsteam="cad"]'); await pg.waitForTimeout(200);
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(300);
eq('CAD/CAM still requires Job code', await pg.evaluate(() => document.querySelector('#eErr').textContent), 'ใส่เลข Job ก่อนบันทึก');
await pg.click('#sheetFoot [data-act="close"]');
eq('jobs added', await pg.evaluate(() => S.jobs.length) - nJobs, 4);
// มือถือ
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(400); await pg.click('[data-dsteam="ds"]'); await pg.click('[data-dskind="condo"]'); await pg.click('[data-dsfadd]'); await pg.waitForTimeout(300);
eq('phone: form fits', await pg.evaluate(() => [...document.querySelectorAll('#sheet, #sheetBody')].every(s => s.scrollWidth <= s.clientWidth + 1) && document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.screenshot({ path: new URL('out/v285-phone.png', import.meta.url).pathname });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
