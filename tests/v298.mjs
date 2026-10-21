// v2.98: ความลื่น — สงบหลังเข้าหน้า · หน้าเลื่อนที่ราก · ข้อความใหม่ไม่วาดทั้งหน้า · โหมดประหยัด
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, PORT = 8855;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render,openEditor,jobById,addWorkDays,today,PERF,setTheme,pollMessages,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.addInitScript(() => { window.__noPerfProbe = true; });   // วัดแบบเครื่องปกติ (เครื่องทดสอบมี 2 คอร์ จะถูกนับเป็นเครื่องช้า)
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234');
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
await pg.evaluate(() => document.querySelectorAll('.ntf,.chat-heads').forEach(e => e.remove()));
const rootSt = () => pg.evaluate(() => [document.documentElement.hasAttribute('data-calm'), document.documentElement.getAttribute('data-perf') || '']);
// 1) สงบหลังเข้าหน้า ~6 วิ · วาดใหม่ = ตื่น
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(500);
eq('just entered: animations running (not calm)', (await rootSt())[0], false);
const loops0 = await pg.evaluate(() => document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity).length);
await pg.waitForTimeout(6600);
eq('after ~6s: calm', (await rootSt())[0], true);
eq('calm: no endless loops left', await pg.evaluate(() => document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity && !a.effect.target.closest('.spinner,.spin,.spin-dot,.sp-ring')).length), 0);
console.log('loops before calm', loops0);
await pg.evaluate(() => T.render()); eq('render wakes', (await rootSt())[0], false);
// 2) ตั้ง "เต็ม" = วนตลอด ไม่สงบ
await pg.evaluate(() => T.setTheme({ motion: 'full', mv2: 1 })); await pg.evaluate(() => T.render()); await pg.waitForTimeout(6600);
eq('full: never calm', (await rootSt())[0], false);
await pg.evaluate(() => T.setTheme({ motion: 'auto', mv2: 1 }));
// 3) โหมดประหยัด
eq('off → lite', await pg.evaluate(() => { T.setTheme({ motion: 'off', mv2: 1 }); return document.documentElement.getAttribute('data-perf'); }), 'lite');
await pg.evaluate(() => T.setTheme({ motion: 'auto', mv2: 1 }));
eq('auto: lite only if this device is weak', (await rootSt())[1], await pg.evaluate(() => T.PERF.weak ? 'lite' : ''));
console.log('test device weak?', await pg.evaluate(() => [T.PERF.weak, T.PERF.why, navigator.hardwareConcurrency]));
// 4) หน้าเลื่อนที่ราก (ไม่ใช่ body)
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(400);
eq('root scrolls, body is not a scroll box', await pg.evaluate(() => { const b = document.body, cs = getComputedStyle(b); window.scrollTo(0, 400); b.scrollTop = 50; return [document.scrollingElement.scrollTop > 0, b.scrollTop === 0]; }), [true, true]);
eq('go() scrolls back to top', await pg.evaluate(() => { T.go('board'); return document.scrollingElement.scrollTop; }), 0);
// 5) ข้อความใหม่ไม่วาดทั้งหน้า (นอกหน้าทีม)
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(300);
const same = await pg.evaluate(async () => { const first = document.querySelector('#view').firstElementChild; await T.api().sendMessage({ to: 'team', text: 'perf test ' + Date.now() }); await T.pollMessages(); return document.querySelector('#view').firstElementChild === first; });
eq('new message on overview: page not redrawn', same, true);
// 6) มือถือ: ไม่ล้นแนวนอน
await pg.setViewportSize({ width: 390, height: 844 }); for (const v of ['home', 'flow', 'prod', 'stock']) { await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(400);
  eq(v + ': mobile no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); }
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
