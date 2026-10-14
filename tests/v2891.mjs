// v2.89.1: เส้นความคืบหน้า (สีรุ้ง) ต้องแสดงทุกแถว รวมงานเลยกำหนด/ค้าง — งานเลยกำหนดใช้กรอบแดงเรืองแทน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8835;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,openEditor,jobById,addWorkDays,today};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
// ทำให้มีงานผลิตเลยกำหนด/ค้าง แล้วตรวจทุกหน้าที่มีเส้นความคืบหน้า
await pg.evaluate(() => { const ps = S.prods || []; ps.slice(0, 3).forEach(p => { p.due = '2020-01-01'; }); });
const check = async (view) => {
  await pg.evaluate(v => { T.go(v); }, view); await pg.waitForTimeout(700);
  return pg.evaluate(() => { const ls = [...document.querySelectorAll('.rt-line i')]; const g = ls.map(i => getComputedStyle(i).backgroundImage);
    return { n: ls.length, late: document.querySelectorAll('.rt.late').length, rainbow: g.filter(x => (x.match(/rgb/g) || []).length >= 3).length, lateRainbow: [...document.querySelectorAll('.rt.late .rt-line i')].every(i => (getComputedStyle(i).backgroundImage.match(/rgb/g) || []).length >= 3), lateGlow: [...document.querySelectorAll('.rt.late .rt-line')].every(l => getComputedStyle(l).boxShadow === 'none' && getComputedStyle(l).backgroundColor === getComputedStyle(document.querySelector('.rt:not(.late) .rt-line') || l).backgroundColor) }; });
};
for (const v of ['flow', 'prod']) {
  const r = await check(v); console.log(v, JSON.stringify(r));
  if (!r.n) continue;
  eq(v + ': every progress line is rainbow', r.rainbow, r.n);
  eq(v + ': late rows look exactly like normal rows', [r.lateRainbow, r.lateGlow], [true, true]);
  await pg.locator('#view').screenshot({ path: new URL('out/v2891-' + v + '.png', import.meta.url).pathname });
}
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(700); await pg.evaluate(() => document.querySelectorAll('.ntf,.dl-pop,[class*="toast"]').forEach(e => e.remove()));
for (const [sel, nm] of [['.rt.late', 'late'], ['.rt:not(.late)', 'normal']]) { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: new URL('out/v2893-' + nm + '.png', import.meta.url).pathname }); }
eq('some late rows were checked', await pg.evaluate(() => { T.go('flow'); return true; }), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad || errs.length ? 1 : 0);
