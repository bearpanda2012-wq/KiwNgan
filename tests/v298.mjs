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
// 1) v2.99: แอนิเมชันวนตลอด (ไม่หยุดเอง)
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(500);
const loops = () => pg.evaluate(() => document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running').length);
const l0 = await loops(); await pg.waitForTimeout(7000); const l1 = await loops();
console.log('running loops', l0, '→ after 7s', l1);
eq('loops still running after 7s (never auto-stop)', [l0 > 0, l1 > 0, (await rootSt())[0]], [true, true, false]);
// แถวนอกจอหยุดไว้ ในจอวิ่ง
eq('offscreen rows paused, onscreen running', await pg.evaluate(() => { const rows = [...document.querySelectorAll('.co-row')]; const vis = rows.filter(r => { const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }); const off = rows.filter(r => r.getBoundingClientRect().top > innerHeight + 400);
  return [vis.every(r => !r.hasAttribute('data-off')), off.length === 0 || off.every(r => r.hasAttribute('data-off'))]; }), [true, true]);
await pg.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight)); await pg.waitForTimeout(600);
eq('scrolled into view → runs again', await pg.evaluate(() => { const rows = [...document.querySelectorAll('.co-row')].filter(r => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }); return rows.length > 0 && rows.every(r => !r.hasAttribute('data-off')); }), true);
await pg.evaluate(() => window.scrollTo(0, 0));
// 2) แสงเรือง/แถบวิ่งใช้การ์ดจอ: ไม่มีแอนิเมชันวนที่ต้องวาดหน้าใหม่ (box-shadow/background-position/filter) บนหน้าหลัก
for (const v of ['flow', 'prod', 'board', 'home', 'list']) { await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(700);
  const paint = await pg.evaluate(() => { const ok = /^(transform|opacity|offset|easing|composite|computedOffset)$/; const bad = {}; document.getAnimations().forEach(a => { if (a.effect.getComputedTiming().iterations !== Infinity) return; const ps = new Set(); a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(p => ps.add(p))); if ([...ps].some(p => !ok.test(p))) bad[a.animationName] = 1; }); return Object.keys(bad).sort(); });
  console.log(v, 'paint loops left:', paint.join(',') || '-');
  eq(v + ': no paint-heavy loops except header drift', paint.filter(n => n !== 'heroShift'), []); }
// 3) โหมดประหยัด: ไม่เบลอ แต่แอนิเมชันยังวิ่ง
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(400);
eq('off → lite', await pg.evaluate(() => { T.setTheme({ motion: 'off', mv2: 1 }); return document.documentElement.getAttribute('data-perf'); }), 'lite');
await pg.evaluate(() => T.setTheme({ motion: 'auto', mv2: 1 }));
eq('auto: lite only if this device is weak', (await rootSt())[1], await pg.evaluate(() => T.PERF.weak ? 'lite' : ''));
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
// เครื่องช้าจริง (เครื่องทดสอบ 2 คอร์): โหมดประหยัดแต่แอนิเมชันยังวิ่ง
{ const p2 = await b.newPage({ viewport: { width: 390, height: 844 } }); await p2.goto('http://127.0.0.1:' + PORT + '/index.html'); await p2.waitForTimeout(600);
  await p2.click('[data-act="adminon"]'); await p2.fill('#adminName', 'แอดมิน'); await p2.fill('#pinIn', '1234'); await p2.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p2.waitForTimeout(2500); await p2.evaluate(() => T.go('flow')); await p2.waitForTimeout(7000);
  const r = await p2.evaluate(() => [document.documentElement.getAttribute('data-perf') || '', navigator.hardwareConcurrency, document.getAnimations().filter(a => a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running').length > 0, getComputedStyle(document.querySelector('.topbar')).backdropFilter]);
  console.log('weak device', JSON.stringify(r));
  if (r[1] <= 2) eq('weak device: lite, loops still running, no blur', [r[0], r[2], r[3] === 'none' || r[3] === ''], ['lite', true, true]);
  await p2.close(); }
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
