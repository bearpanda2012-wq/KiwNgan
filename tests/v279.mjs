// v2.79: บันทึก/โหลดธีม (รวมไฟล์พื้นหลัง) · ส่งออก/นำเข้า
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8804);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:8804/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('settings'); }); await pg.waitForTimeout(900);
const th = () => pg.evaluate(() => JSON.parse(localStorage.getItem('kiwngan:theme') || '{}'));
eq('saved-themes box', await pg.evaluate(() => !!document.querySelector('#s-theme .ts-box #tsName')), true);
// ธีม A: กลางคืน + คลื่น + สีตัวอักษร
await pg.click('[data-themepick="night"]'); await pg.waitForTimeout(300);
await pg.click('[data-bgtab="anim"]'); await pg.click('[data-bgfx="waves"]'); await pg.waitForTimeout(300);
await pg.evaluate(() => { const a = document.querySelector('#hdC1'); a.value = '#FDE68A'; a.dispatchEvent(new Event('change', { bubbles: true })); });
const A = await th();
await pg.fill('#tsName', 'กลางคืนคลื่น'); await pg.click('[data-act="tssave"]'); await pg.waitForTimeout(400);
eq('saved shows in list as current', await pg.evaluate(() => [document.querySelectorAll('.ts-it').length, document.querySelector('.ts-it.on .ts-tx b').textContent]), [1, 'กลางคืนคลื่น']);
// ธีม B: ไฟล์รูปพื้นหลัง
await pg.click('[data-act="themereset"]'); await pg.waitForTimeout(300);
await pg.click('[data-bgtab="img"]'); await pg.setInputFiles('#bgIn', new URL('fixtures/bgtest.jpg', import.meta.url).pathname); await pg.waitForTimeout(2500);
await pg.fill('#tsName', 'รูปของฉัน'); await pg.press('#tsName', 'Enter'); await pg.waitForTimeout(800);
eq('two saved', await pg.locator('.ts-it').count(), 2);
// โหลด A กลับ
await pg.click('.ts-it:has-text("กลางคืนคลื่น") [data-tsload]'); await pg.waitForTimeout(600);
eq('load A restores exact settings', [JSON.stringify(await th()) === JSON.stringify(A), await pg.evaluate(() => !!document.querySelector('#bgLayer .fx-waves')), await pg.evaluate(() => document.documentElement.getAttribute('data-theme'))], [true, true, 'dark']);
// ระหว่างนั้นเปลี่ยนรูปพื้นหลังในเครื่อง (ทับไฟล์) แล้วโหลด B → ได้รูปของ B คืน
await pg.click('.ts-it:has-text("รูปของฉัน") [data-tsload]'); await pg.waitForTimeout(1200);
eq('load B restores its local image', await pg.evaluate(() => [document.documentElement.getAttribute('data-bgk'), /3000×2000/.test(document.querySelector('.bg-cur small').textContent)]), ['img', true]);
// บันทึกชื่อซ้ำ = อัปเดต
await pg.fill('#tsName', 'รูปของฉัน'); await pg.click('[data-act="tssave"]'); await pg.waitForTimeout(800);
eq('same name updates (no duplicate)', await pg.locator('.ts-it').count(), 2);
// ส่งออก / นำเข้า
const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act="tsexport"]')]);
const fp = await dl.path(); const exp = JSON.parse(fs.readFileSync(fp, 'utf8'));
eq('export file', [exp.kind, exp.themes.length], ['themes', 2]);
await pg.setInputFiles('#tsImport', fp); await pg.waitForTimeout(600);
eq('import adds copies (renamed)', await pg.evaluate(() => [document.querySelectorAll('.ts-it').length, [...document.querySelectorAll('.ts-tx b')].some(b => /\(2\)/.test(b.textContent))]), [4, true]);
// ลบ (ถามก่อน)
await pg.click('.ts-it >> nth=0 >> [data-tsdelask]'); await pg.waitForTimeout(200);
await pg.click('.ts-it >> nth=0 >> [data-tsdel]'); await pg.waitForTimeout(400);
eq('delete with confirm', await pg.locator('.ts-it').count(), 3);
await pg.locator('#s-theme .ts-box').screenshot({ path: new URL('out/v279-saves.png', import.meta.url).pathname });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
