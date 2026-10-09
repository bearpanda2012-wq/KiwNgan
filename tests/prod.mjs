// ฝ่ายผลิต + ภาพรวมบริษัท + ปุ่ม Sale หน้าเข้าสู่ระบบ (โหมดทดลอง)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,saveJob,prodsAll};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8790);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const login = async (name, admin) => {
  await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto('http://127.0.0.1:8790/index.html'); await pg.waitForTimeout(700);
  if (admin) { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', name); } else await pg.click('.who:has-text("' + name + '")');
  await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
};
await pg.goto('http://127.0.0.1:8790/index.html'); await pg.waitForTimeout(800);
eq('sale tile on login page', await pg.locator('.sale-tile').count(), 1);
await pg.screenshot({ path: out + 'prod-login.png' });
await login('แอดมิน', true);
eq('nav has company + production', await pg.evaluate(() => ['flow', 'prod'].map(v => !!document.querySelector('#nav [data-view="' + v + '"]'))), [true, true]);
eq('nav dept headings', await pg.locator('#nav .nav-h').allTextContents(), ['ฝ่ายแบบ', 'ฝ่ายผลิต', 'ทั่วไป']);
await pg.click('#nav [data-view="flow"]'); await pg.waitForTimeout(700);
eq('company pipeline steps', await pg.locator('.co-step').count(), 7);
const rows = await pg.locator('.co-row').count(); eq('company rows shown', rows > 5, true);
await pg.screenshot({ path: out + 'prod-company.png', fullPage: true });
await pg.click('.co-step[data-cf="machine"]'); await pg.waitForTimeout(300);
eq('filter by step', await pg.evaluate(() => [...document.querySelectorAll('.co-row .pill')].every(p => p.textContent === 'ลงเครื่อง')), true);
await pg.click('#nav [data-view="prod"]'); await pg.waitForTimeout(700);
eq('prod board 6 columns', await pg.locator('.pboard .col').count(), 6);
await pg.screenshot({ path: out + 'prod-board.png', fullPage: true });
eq('admin read-only on prod board', await pg.locator('.pboard [data-pstart],.pboard [data-padv],.pboard [data-pmt]').count(), 0);
eq('admin has no add-to-production button', await pg.evaluate(() => getComputedStyle(document.querySelector('.fab')).display), 'none');
await login('ช่างเอ'); await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
// รอผลิต → เลือก 2 เครื่อง → เริ่ม
const wid = await pg.evaluate(() => T.prodsAll().find(p => p.stage === 'wait').id);
const wc = pg.locator('.pcard[data-popen="' + wid + '"]');
await wc.locator('[data-pmt="Laser"]').click(); await wc.locator('[data-pmt="Punching"]').click(); await pg.waitForTimeout(150);
eq('2 machines picked', await wc.locator('.mchip.on').count(), 2);
await wc.locator('[data-pstart]').click(); await pg.waitForTimeout(900);
let pr = await pg.evaluate(id => T.prodsAll().find(p => p.id === id), wid);
eq('started on 2 machines', [pr.stage, JSON.parse(pr.machines).map(m => m.m)], ['machine', ['Laser', 'Punching']]);
const mc = pg.locator('.pcard[data-popen="' + wid + '"]');
await mc.locator('[data-pmd="Laser"]').click(); await pg.waitForTimeout(800);
eq('1/2 still on machine', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'machine');
await pg.locator('.pcard[data-popen="' + wid + '"] [data-pmd="Punching"]').click(); await pg.waitForTimeout(800);
eq('both done → paint', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'paint');
await pg.locator('.pcard[data-popen="' + wid + '"] [data-padv]').click(); await pg.waitForTimeout(800);
eq('paint → ประกอบติดตั้ง', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'assemble');
await pg.locator('.pcard[data-popen="' + wid + '"] [data-padv]').click(); await pg.waitForTimeout(800);
eq('ประกอบ → pack', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'pack');
await pg.locator('.pcard[data-popen="' + wid + '"] [data-pback]').click(); await pg.waitForTimeout(800);
eq('back → ประกอบ', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'assemble');
await pg.locator('.pcard[data-popen="' + wid + '"] [data-pback]').click(); await pg.waitForTimeout(800);
eq('back → paint', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'paint');
// ข้ามประกอบ: ทำสีเสร็จแล้วไปแพ็คเลย
await pg.evaluate(id => T.prodsAll().find(p => p.id === id).id, wid);
await pg.locator('.pcard[data-popen="' + wid + '"] .code').click(); await pg.waitForTimeout(300);
await pg.click('#pModal [data-passy]'); await pg.waitForTimeout(800);
await pg.click('#pModal [data-padv]'); await pg.waitForTimeout(800);
eq('no assembly: paint → pack', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).stage, wid), 'pack');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
// machine filter chips
await pg.click('[data-pm="Router"]'); await pg.waitForTimeout(300);
eq('router filter only router jobs', await pg.evaluate(() => [...document.querySelectorAll('[data-pcol="machine"] .pcard')].every(c => !!c.querySelector('[data-pmd="Router"]'))), true);
await pg.click('[data-pm="all"]');
// modal
await pg.locator('.pcard[data-popen="' + wid + '"] .code').click(); await pg.waitForTimeout(400);
eq('detail modal open', await pg.locator('#pModal .pm-card').count(), 1);
eq('history listed', (await pg.locator('#pModal .pm-hist li').count()) >= 4, true);
await pg.locator('#pModal').screenshot({ path: out + 'prod-modal.png' });
await pg.fill('#pNote', 'สีเทาด้าน'); await pg.click('[data-pnote]'); await pg.waitForTimeout(700);
eq('note saved', await pg.evaluate(id => T.prodsAll().find(p => p.id === id).note, wid), 'สีเทาด้าน');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('modal closed', await pg.locator('#pModal').count(), 0);
// add manually
await pg.click('.fab'); await pg.waitForTimeout(300);
eq('add modal', await pg.locator('#pAddCode').count(), 1);
await pg.fill('#pAddCode', 'MAN-001'); await pg.click('[data-paddm="Router"]'); await pg.click('[data-paddsave]'); await pg.waitForTimeout(900);
eq('manual job on router', await pg.evaluate(() => { const p = T.prodsAll().find(x => x.code === 'MAN-001'); return p && [p.stage, JSON.parse(p.machines)[0].m]; }), ['machine', 'Router']);
await login('แอดมิน', true);
// CAM เสร็จ → เข้ารอผلิตเอง
const cam = await pg.evaluate(() => { const j = S.jobs.find(x => x.taskType === 'ทำ CAM' && x.status !== 'done' && !T.prodsAll().some(p => p.code === x.code)); return j && j.id; });
const n0 = await pg.evaluate(() => T.prodsAll().filter(p => p.stage === 'wait').length);
await pg.evaluate(async id => { const j = Object.assign({}, S.jobs.find(x => x.id === id), { status: 'done' }); await T.saveJob(j); }, cam); await pg.waitForTimeout(400);
await pg.evaluate(() => KiwNgan && 0).catch(() => {}); await pg.click('[data-act="refresh"]').catch(() => {}); await pg.waitForTimeout(900);
eq('CAM done → new รอผลิต card', await pg.evaluate(() => T.prodsAll().filter(p => p.stage === 'wait').length), n0 + 1);
// design card chip
await pg.click('#nav [data-view="board"]'); await pg.waitForTimeout(600);
eq('done design cards show production chip', (await pg.locator('.card .pchip').count()) > 0, true);
// settings: sale pin + machines + task type toggle
await pg.click('#nav [data-view="settings"]'); await pg.waitForTimeout(600);
eq('machines list in settings', await pg.locator('[data-d^="machines."]').count(), 4);
eq('ส่งผลิต toggles', await pg.locator('.prod-tog input:checked').count(), 2);
await pg.fill('#salePinSet', '5678'); await pg.click('[data-act="salepin"]'); await pg.waitForTimeout(500);
eq('sale pin on', await pg.locator('#s-salelink .pill.s-done').count(), 1);
// production staff
await login('ช่างเอ');
eq('prod role lands on board', await pg.evaluate(() => S.view), 'prod');
eq('prod role nav', await pg.evaluate(() => [...document.querySelectorAll('#nav [data-view]')].map(b => b.dataset.view)), ['flow', 'home', 'board', 'list', 'prod', 'team', 'settings']);
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(500);
eq('prod role sees all design jobs', await pg.evaluate(() => document.querySelectorAll('.board .card').length > 10), true);
eq('prod role cannot move/edit design cards', await pg.locator('.board .card .adv, .board .card .tbtn').count(), 0);
eq('prod role has no add-design button', await pg.evaluate(() => getComputedStyle(document.querySelector('.fab')).display), 'none');
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(400);
eq('prod role can act', (await pg.locator('.pboard [data-pstart],.pboard [data-padv]').count()) > 0, true);
// designer: read-only
await login('ต้น');
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
eq('designer read-only on prod board', await pg.locator('.pboard [data-pstart],.pboard [data-padv],.pboard [data-pmt]').count(), 0);
eq('designer no add button on prod', await pg.evaluate(() => getComputedStyle(document.querySelector('.fab')).display), 'none');
// mobile
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(600);
eq('no horizontal scroll (mobile company)', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.screenshot({ path: out + 'prod-company-m.png', fullPage: true });
await login('ช่างเอ'); await pg.waitForTimeout(300);
eq('no horizontal scroll (mobile prod)', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.screenshot({ path: out + 'prod-board-m.png', fullPage: true });
// sale tile → PIN → sale page
await pg.setViewportSize({ width: 1400, height: 900 });
await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto('http://127.0.0.1:8790/index.html'); await pg.waitForTimeout(700);
await pg.click('.sale-tile'); await pg.fill('#salePin', '0000'); await pg.press('#salePin', 'Enter'); await pg.waitForTimeout(400);
eq('wrong sale pin', await pg.locator('#saleForm .err').textContent(), 'PIN ไม่ถูกต้อง');
await pg.fill('#salePin', '5678'); await pg.press('#salePin', 'Enter'); await pg.waitForTimeout(1500);
eq('sale page opened', /salek=/.test(pg.url()), true);
eq('sale overview pipeline', await pg.locator('.sf-wrap .co-step').count(), 7);
eq('sale overview rows', (await pg.locator('.sf-list .co-row').count()) > 5, true);
await pg.waitForTimeout(1200); await pg.screenshot({ path: out + 'prod-sale.png', fullPage: true });
await pg.click('.sf-wrap .co-step[data-sfstep="machine"]'); await pg.waitForTimeout(300);
eq('sale filter by stage', await pg.evaluate(() => [...document.querySelectorAll('.sf-list .co-row .pill')].every(p => p.textContent === 'ลงเครื่อง')), true);
await pg.locator('.sf-list .co-row').first().click(); await pg.waitForTimeout(400);
eq('row expands with details', await pg.locator('.sf-item.open .sf-det .sf-prod').count(), 1);
await pg.locator('.sf-item.open').screenshot({ path: out + 'prod-sale-open.png' });
await pg.click('[data-sfview="table"]'); await pg.waitForTimeout(400);
eq('table view still has production strip', await pg.locator('.sp-pf').count(), 7);
eq('rows show production stage', (await pg.locator('.sp-prod').count()) > 0, true);
await pg.click('[data-sfview="flow"]');
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(400);
eq('sale overview no horizontal scroll (mobile)', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.screenshot({ path: out + 'prod-sale-m.png', fullPage: true });
console.log(ok + ' ok, ' + bad + ' failed');
console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close();
if (bad || errs.length) process.exit(1);
