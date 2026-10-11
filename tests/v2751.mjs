// v2.75.1: แบนเนอร์กดแล้วเลื่อนไปคอลัมน์ · เลือกสีไม่วาดทับ · รายงานมือถือ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,saveJob,prodsAll};window.S=S;window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8795);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const login = async (name, admin) => {
  await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto('http://127.0.0.1:8795/index.html'); await pg.waitForTimeout(700);
  if (admin) { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', name); } else await pg.click('.who:has-text("' + name + '")');
  await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
};
await pg.goto('http://127.0.0.1:8795/index.html'); await pg.waitForTimeout(800);
await login('แอดมิน', true);
await pg.click('#nav [data-view="prod"]'); await pg.waitForTimeout(900);
eq('prod banner tiles clickable', await pg.locator('.pflow [data-flowgo]').count(), 7);
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.click('.pflow [data-flowgo="pcol:pack"]'); await pg.waitForTimeout(900);
eq('pack column flashes', await pg.evaluate(() => document.querySelector('[data-pcol="pack"]').classList.contains('col-flash')), true);
eq('pack column in view', await pg.evaluate(() => { const r = document.querySelector('[data-pcol="pack"]').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0; }), true);
eq('prod card uses company-style route', await pg.evaluate(() => document.querySelectorAll('.pcard .pc-rt .rt-dot.now').length === document.querySelectorAll('.pcard').length), true);
await pg.click('#nav [data-view="board"]'); await pg.waitForTimeout(900);
eq('design banner tiles clickable', await pg.locator('.flow:not(.pflow) [data-flowgo]').count(), 5);
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.click('[data-flowgo="col:done"]'); await pg.waitForTimeout(900);
eq('done column flashes', await pg.evaluate(() => document.querySelector('[data-col="done"]').classList.contains('col-flash')), true);
// theme colour: change must not rebuild the page (iOS picker closes on re-render)
await pg.goto('http://127.0.0.1:8795/index.html#settings'); await pg.waitForTimeout(900);
await pg.evaluate(() => document.querySelector('#nav [data-view="settings"]') && document.querySelector('#nav [data-view="settings"]').click()); await pg.waitForTimeout(700);
eq('colour input exists', await pg.locator('#thC1').count(), 1);
await pg.evaluate(() => { window.__c = document.querySelector('#thC1'); window.__c.focus(); window.__c.value = '#aea43e'; window.__c.dispatchEvent(new Event('input', { bubbles: true })); window.__c.dispatchEvent(new Event('change', { bubbles: true })); });
await pg.waitForTimeout(300);
eq('colour input kept (no re-render)', await pg.evaluate(() => window.__c.isConnected && document.querySelector('#thC1') === window.__c), true);
eq('custom theme selected + saved', await pg.evaluate(() => [document.querySelector('.theme-sw.custom').classList.contains('on'), JSON.parse(localStorage.getItem('kiwngan:theme')).c1]), [true, '#aea43e']);
// report on a phone: date boxes stay inside the panel
eq('clicking elsewhere ends colour pick + renders again', await pg.evaluate(async () => { document.querySelector('.snav a').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); return document.activeElement !== window.__c && !S.renderLater; }), true);
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300);
await pg.evaluate(() => T.go('report')); await pg.waitForTimeout(900);
eq('report dates inside panel', await pg.evaluate(() => { const p = document.querySelector('.rep-controls').getBoundingClientRect(); return ['#rFrom', '#rTo'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.right <= p.right + 0.5 && r.left >= p.left - 0.5; }); }), [true, true]);
eq('no horizontal page scroll', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await pg.evaluate(() => window.scrollTo(0, 0)); await pg.evaluate(() => document.querySelector('.rep-controls').scrollIntoView()); await pg.waitForTimeout(300); await pg.screenshot({ path: out + 'v2751-report.png', fullPage: false });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
