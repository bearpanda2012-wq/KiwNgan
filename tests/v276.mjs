// v2.76.0: ปรับแต่งธีม (โปร่งแสง รูปพื้นหลังละเอียด ขนาด ฟอนต์ เงา ภาพเคลื่อนไหว ลาย) + ป้ายด่วน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,saveJob,prodsAll,pushNav,M};window.S=S;window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8797);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const login = async (name, admin) => {
  await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto('http://127.0.0.1:8797/index.html'); await pg.waitForTimeout(700);
  if (admin) { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', name); } else await pg.click('.who:has-text("' + name + '")');
  await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
};
await pg.goto('http://127.0.0.1:8797/index.html'); await pg.waitForTimeout(800);
await login('แอดมิน', true); await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(900);
eq('theme groups shown', await pg.locator('#s-theme .th-grp').count(), 4);   // v2.77 เพิ่มกลุ่มแบนเนอร์/เมนู
// ความโปร่งแสง
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="glass"]'); r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForTimeout(200);
eq('glass on + panel translucent', await pg.evaluate(() => [document.documentElement.hasAttribute('data-glass'), /0\.6|color\(srgb|rgba\(255, 255, 255, 0\.6/.test(getComputedStyle(document.querySelector('.app .panel')).backgroundColor), document.querySelector('[data-thout="glass"]').textContent]), [true, true, '40%']);
eq('popup windows stay opaque', await pg.evaluate(() => getComputedStyle(document.querySelector('#sheet')).getPropertyValue('--surface').trim()), '#FFFFFF');
// รูปพื้นหลังความละเอียดสูง
await pg.setInputFiles('#bgIn', out + 'bgtest.jpg'); await pg.waitForTimeout(2500);
eq('bg stored full size (not shrunk)', await pg.evaluate(() => document.querySelector('.bg-info') && document.querySelector('.bg-info').textContent.indexOf('3000×2000') >= 0), true);
eq('bg applied', await pg.evaluate(() => [document.documentElement.getAttribute('data-bg'), getComputedStyle(document.body, '::before').backgroundSize]), ['on', 'cover']);
await pg.click('[data-themeset="bgfit"][data-val="contain"]'); await pg.waitForTimeout(300);
await pg.click('[data-themeset="bgpos"][data-val="tr"]'); await pg.waitForTimeout(300);
eq('fit + position', await pg.evaluate(() => { const c = getComputedStyle(document.body, '::before'); return [c.backgroundSize, c.backgroundPosition]; }), ['contain', '100% 0%']);
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="bgblurv"]'); r.value = 0; r.dispatchEvent(new Event('input', { bubbles: true })); const d = document.querySelector('[data-thrange="bgdimv"]'); d.value = 20; d.dispatchEvent(new Event('input', { bubbles: true })); });
eq('no blur = no enlargement; dim 20%', await pg.evaluate(() => [getComputedStyle(document.body, '::before').top, getComputedStyle(document.body, '::after').opacity]), ['0px', '0.2']);
await pg.reload(); await pg.waitForTimeout(1800);
eq('bg survives reload (IndexedDB)', await pg.evaluate(() => /blob:/.test(getComputedStyle(document.documentElement).getPropertyValue('--bgimg'))), true);
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(900); await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove())); await pg.screenshot({ path: out + 'v276-glass.png' });
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800); await pg.locator('#s-theme').screenshot({ path: out + 'v276-theme.png' });
// การแสดงผล
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800);
await pg.click('[data-themeset="font"][data-val="sarabun"]'); await pg.waitForTimeout(300);
eq('font switch', await pg.evaluate(() => getComputedStyle(document.body).fontFamily.indexOf('Sarabun') >= 0), true);
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="zoom"]'); r.value = 115; r.dispatchEvent(new Event('input', { bubbles: true })); });
eq('content zoom', await pg.evaluate(() => getComputedStyle(document.querySelector('.app main')).zoom), '1.15');
await pg.click('[data-themeset="motion"][data-val="off"]'); await pg.waitForTimeout(300);
eq('motion off', await pg.evaluate(() => document.documentElement.getAttribute('data-motion')), 'off');
await pg.click('[data-act="bgremove"]'); await pg.waitForTimeout(500);
await pg.click('[data-themeset="pattern"][data-val="dots"]'); await pg.waitForTimeout(300);
eq('pattern when no image', await pg.evaluate(() => [document.documentElement.getAttribute('data-pattern'), getComputedStyle(document.body, '::before').backgroundImage.indexOf('radial-gradient') >= 0]), ['dots', true]);
await pg.screenshot({ path: out + 'v276-settings.png', fullPage: false });
// ป้ายด่วน
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(800);
eq('urgent tag vivid gradient', await pg.evaluate(() => { const t = document.querySelector('.tag.urgent'); return !t || getComputedStyle(t).backgroundImage.indexOf('gradient') >= 0; }), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
