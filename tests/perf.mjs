// วัดความลื่น: เวลา render ต่อหน้า · long task ตอนนิ่ง · fps ตอนเลื่อน · ภายใต้ CPU ช้าลง (จำลองมือถือ/แท็บเล็ตรุ่นเก่า)
// ใช้: PW=... node tests/perf.mjs [throttle=4] [width=390]
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const THR = +(process.argv[2] || 4), W = +(process.argv[3] || 390), H = W < 700 ? 844 : 1024;
const root = new URL('..', import.meta.url).pathname, PORT = 8870 + (W % 7);
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,render};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: W < 1000, hasTouch: W < 1000, deviceScaleFactor: W < 1000 ? 2 : 1 });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn')) { localStorage.clear(); sessionStorage.setItem('kn', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve();
  window.__noPerfProbe = true; if (window.__FULL) {} window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
if (process.env.FULL) await pg.addInitScript(() => { try { if (!localStorage.getItem('kiwngan:theme')) localStorage.setItem('kiwngan:theme', JSON.stringify({ motion: 'full', mv2: 1 })); } catch (e) {} });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1500);
await pg.evaluate(() => document.querySelectorAll('.ntf,.chat-heads').forEach(e => e.remove()));
if (process.env.EXP) { const css = fs.readFileSync(process.env.EXP, 'utf8'); await pg.addStyleTag({ content: css }); await pg.evaluate(() => document.documentElement.setAttribute('data-perf', 'mid')); }
if (process.env.ROOTSCROLL) await pg.addStyleTag({ content: 'html,body{overflow-x:visible!important}body{overflow-x:hidden!important}' });
if (process.env.STEP) console.log('step', JSON.stringify(await pg.evaluate(fs.readFileSync(new URL('perf-step.js', import.meta.url), 'utf8') + ';window.__stepLoops(' + process.env.STEP + ',' + (process.env.STEPALL ? 'true' : 'false') + ')')));
if (process.env.TICK) await pg.evaluate(fs.readFileSync(new URL('perf-tick.js', import.meta.url), 'utf8') + ';window.__tickLoops(' + process.env.TICK + ')');
if (process.env.NOCALM) await pg.addStyleTag({ content: '[data-calm] body *,[data-calm] body *::before,[data-calm] body *::after{animation-iteration-count:infinite!important}' }).then(() => pg.evaluate(() => { const o = new MutationObserver(() => document.documentElement.removeAttribute('data-calm')); o.observe(document.documentElement, { attributes: true }); document.documentElement.removeAttribute('data-calm'); }));
const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THR }); await cdp.send('Performance.enable');
const metrics = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = n => (m.find(x => x.name === n) || {}).value || 0; return { layout: g('LayoutDuration'), style: g('RecalcStyleDuration'), script: g('ScriptDuration'), task: g('TaskDuration') }; };
const out = { thr: THR, w: W, views: {} };
for (const v of (process.env.VIEWS || 'home,flow,board,list,prod,stock,kb,team').split(',')) {
  await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(+(process.env.SETTLE || 900));
  // idle 5s: long tasks + style/layout work while doing nothing
  await pg.evaluate(() => { window.__lt = []; }); const m0 = await metrics(); await pg.waitForTimeout(5000); const m1 = await metrics();
  const idleLT = await pg.evaluate(() => window.__lt.slice());
  // scroll fps
  // เลื่อนจอแบบนิ้ว/ล้อเมาส์จริง (ผ่านเบราว์เซอร์ ไม่ใช่สคริปต์ตั้งค่า scrollTop) แล้วนับเฟรม
  await pg.evaluate(() => { document.scrollingElement.scrollTop = 0; window.__fr = []; let last = 0; const f = now => { if (last) window.__fr.push(now - last); last = now; if (!window.__frStop) requestAnimationFrame(f); }; window.__frStop = false; requestAnimationFrame(f); });
  await cdp.send('Input.synthesizeScrollGesture', { x: +(process.env.GX || Math.round(W / 2)), y: Math.round(H * 0.7), yDistance: -1800, speed: 1200, gestureSourceType: process.env.TOUCH ? 'touch' : 'mouse', repeatCount: 1 }).catch(e => console.log('gesture', e.message));
  let fps = await pg.evaluate(() => { window.__frStop = true; const fr = window.__fr.slice(2); const tot = fr.reduce((a, b) => a + b, 0); return { fps: Math.round(fr.length / (tot / 1000)), worstFrame: Math.round(Math.max(0, ...fr)), slowPct: Math.round(fr.filter(x => x > 34).length / Math.max(1, fr.length) * 100), h: Math.max(document.scrollingElement.scrollTop, document.body.scrollTop) }; });
  fps.scroller = await pg.evaluate(() => (document.body.scrollHeight - document.body.clientHeight > document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight) ? 'body' : 'root');
  const calmNow = await pg.evaluate(() => document.documentElement.hasAttribute('data-calm'));
  const rt = await pg.evaluate(() => { const t = []; for (let i = 0; i < 3; i++) { const a = performance.now(); T.render(); document.body.offsetHeight; t.push(performance.now() - a); } return Math.round(t.sort((x, y) => x - y)[1]); });
  const nodes = await pg.evaluate(() => document.querySelectorAll('*').length);
  out.views[v] = { render: rt, calm: calmNow, nodes, idleTaskMs: Math.round((m1.task - m0.task) * 1000), idleStyleMs: Math.round((m1.style - m0.style) * 1000), idleLayoutMs: Math.round((m1.layout - m0.layout) * 1000), idleLongTasks: idleLT.length, ...fps };
}
out.anim = await pg.evaluate(() => { T.go('flow'); const a = document.getAnimations(); return { running: a.length, infinite: a.filter(x => x.effect && x.effect.getTiming().iterations === Infinity).length }; });
out.errs = errs;
if (process.argv[4] === 'table') { console.log('thr', THR, 'w', W, 'settle', process.env.SETTLE || 900, 'calm', await pg.evaluate(() => document.documentElement.hasAttribute('data-calm')), 'perf', await pg.evaluate(() => document.documentElement.getAttribute('data-perf') || 'full')); console.log('view   render nodes idleTask idleStyle LT  fps worst slow'); Object.entries(out.views).forEach(([k, v]) => console.log(k.padEnd(6), String(v.render).padStart(6), String(v.nodes).padStart(5), String(v.idleTaskMs).padStart(8), String(v.idleStyleMs).padStart(9), String(v.idleLongTasks).padStart(3), String(v.fps).padStart(4), String(v.worstFrame).padStart(5), String(v.slowPct + '%').padStart(5), 'y' + v.h, v.scroller, v.calm ? 'calm' : '')); console.log('anim', JSON.stringify(out.anim), 'errs', out.errs.length); }
else console.log(JSON.stringify(out, null, 1));
await b.close(); srv.close();
