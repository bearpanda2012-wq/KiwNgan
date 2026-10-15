// v2.96.2: งานที่ส่งแล้วค้างในภาพรวมบริษัท/บอร์ดผลิต 20 วัน (นับแยกแต่ละงานจากวันที่ส่ง)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8853;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,openEditor,jobById,addWorkDays,today};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
// ตั้งวันที่ส่งของงานผลิต 3 งาน: 3 วัน · 15 วัน · 25 วันก่อน
const codes = await pg.evaluate(() => { const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
  const ps = S.prods.slice(0, 3); [3, 15, 25].forEach((n, i) => { ps[i].stage = 'shipped'; ps[i].shippedAt = d(n) + 'T10:00:00'; }); return ps.map(p => p.code); });
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('flow'); }); await pg.waitForTimeout(800);
await pg.click('[data-cf="shipped"]').catch(() => {}); await pg.waitForTimeout(500);
const shown = await pg.evaluate(cs => cs.map(c => !!document.querySelector('.co-row[data-coopen="' + c + '"]')), codes);
eq('overview: shipped 3d & 15d shown, 25d hidden', shown, [true, true, false]);
eq('labels say 20 วัน', await pg.evaluate(() => [/ส่งแล้ว 20 วัน/.test(document.querySelector('.kpi.k-done').textContent), /ส่งแล้ว 20 วัน/.test(document.querySelector('.qchips').textContent)]), [true, true]);
eq('search still finds 25d job', await pg.evaluate(async c => { const i = document.querySelector('#view input[type=search]'); i.value = c; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 700)); return !!document.querySelector('.co-row[data-coopen="' + c + '"]'); }, codes[2]), true);
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(600);
eq('prod board: shipped list says 20 วันล่าสุด', await pg.evaluate(() => /ส่งแล้ว 20 วันล่าสุด \(\d+\)/.test((document.querySelector('[data-pship]') || {}).textContent || '')), true);
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
