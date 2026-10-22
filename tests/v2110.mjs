// ห้องเกมชุดที่ 2: ควิซคิวงาน เรียงคิวด่วน วาดภาพทายคำ เรียง 4 ทายเลขลับ ใครเร็วกว่า บิงโก · วาดทาย 2 เครื่อง
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = +(process.env.GPORT || 8866), LIST = (process.env.GL || 'quiz,sort').split(','), TWO = !!process.env.TWO;
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] });
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const errs = [];
async function page(name, w, h) {
  const ctx = await b.newContext({ viewport: { width: w || 1300, height: h || 900 } }), pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e.message));
  await pg.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
  await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
  await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
  return pg;
}

const A = await page('A');
await A.evaluate(() => document.querySelector('[data-act="msgopen"]').click()); await A.waitForTimeout(300);
await A.click('#msgPanel [data-act="games"]'); await A.waitForTimeout(700);
for (const g of LIST) {
  await A.click('#gameView [data-ga="new"][data-v="' + g + '"]'); await A.waitForTimeout(200);
  await A.click('#gameView [data-ga="bot"]'); await A.click('#gameView [data-ga="bot"]'); await A.waitForTimeout(100);
  if (g === 'bingo') await A.evaluate(() => { KNGames._G.callMs = 250; });
  await A.click('#gameView [data-ga="start"]'); await A.waitForTimeout(400);
  const t0 = Date.now(); let shot = false;
  while (Date.now() - t0 < 150000) {
    const st = await A.evaluate(() => { const r = Object.values(KNGames.rooms())[0]; return { ph: r.phase, r: r.r, drawer: r.g && r.g.drawer, word: r.g && r.g.word, lo: r.g && r.g.lo, hi: r.g && r.g.hi, gph: r.g && r.g.ph }; });
    if (st.ph === 'end') break;
    if (!shot && Date.now() - t0 > 2500) { shot = true; await A.locator('#gameView .gm-card').screenshot({ path: out + 'game-' + g + '.png' }); }
    if (g === 'draw' && st.gph === 'draw') {
      const cv = await A.$('#gameView canvas'); if (cv) { const bx = await cv.boundingBox(); await A.mouse.move(bx.x + bx.width * .3, bx.y + bx.height * .3); await A.mouse.down(); for (let i = 1; i < 8; i++) await A.mouse.move(bx.x + bx.width * (.3 + i * .05), bx.y + bx.height * (.3 + Math.sin(i) * .1)); await A.mouse.up(); }
      await A.evaluate(st => { KNGames._act(st.r, 'บอท 1', { guess: st.word }); KNGames._act(st.r, 'บอท 2', { guess: st.word }); }, st); await A.waitForTimeout(400); continue;
    }
    if (g === 'guess' && await A.$('#gameView input[data-gin="num"]')) { await A.fill('#gameView input[data-gin="num"]', String(Math.round((st.lo + st.hi) / 2))); await A.press('#gameView input[data-gin="num"]', 'Enter'); await A.waitForTimeout(300); continue; }
    const btns = await A.$$('#gameView .gm-board button:not([disabled])');
    if (btns.length) await btns[Math.floor(Math.random() * btns.length)].click().catch(() => {});
    await A.waitForTimeout(g === 'react' ? 150 : 300);
  }
  eq(g + ': finished', await A.evaluate(() => Object.values(KNGames.rooms())[0].phase), 'end');
  await A.locator('#gameView .gm-card').screenshot({ path: out + 'game-' + g + '-end.png' });
  await A.click('#gameView [data-ga="leave"]'); await A.waitForTimeout(150);
}
if (!TWO) { eq('no page errors', errs, []); console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0); }
// วาดภาพทายคำ 2 เครื่อง: คำลับเห็นเฉพาะคนวาด · เส้นที่วาดไปถึงอีกเครื่อง · ทายถูกได้แต้ม
const Bp = await page('B', 390, 844);
const relay = async (from, to) => { const q = await from.evaluate(() => { const x = window.__out || []; window.__out = []; return x; }); for (const o of q) await to.evaluate(o => KiwNgan.gameIn(o), o); };
for (const [pg, nm] of [[A, 'หมี'], [Bp, 'ฝน']]) await pg.evaluate(nm => { window.__out = []; KN_G.send = o => window.__out.push(JSON.parse(JSON.stringify(Object.assign({ k: 'g' }, o)))); KN_G.live = () => true; KN_G.me = () => nm; }, nm);
const pump = async (n = 4) => { for (let i = 0; i < n; i++) { await relay(A, Bp); await relay(Bp, A); await A.waitForTimeout(80); } };
await A.evaluate(() => KNGames.open('team')); await A.click('#gameView [data-ga="new"][data-v="draw"]'); await A.waitForTimeout(150); await pump();
await A.click('#gameView [data-ga="iall"]'); await A.waitForTimeout(150); await pump();
await Bp.click('#gInvite [data-act="gjoin"]'); await Bp.waitForTimeout(600); await pump();
await A.click('#gameView [data-ga="start"]'); await pump();
const word = await A.evaluate(() => Object.values(KNGames.rooms())[0].g.word);
eq('host drawer sees word', (await A.locator('#gameView .gm-word').innerText()).trim(), word);
eq('B does not get word', await Bp.evaluate(() => JSON.stringify(Object.values(KNGames.rooms())[0].g).includes(Object.values(KNGames.rooms())[0].g.word || '@@')), false);
eq('B sees mask', (await Bp.locator('#gameView .gm-mask').count()), 1);
const bx = await A.locator('#gameView canvas').boundingBox();
await A.mouse.move(bx.x + 50, bx.y + 50); await A.mouse.down(); for (let i = 1; i < 10; i++) await A.mouse.move(bx.x + 50 + i * 15, bx.y + 50 + i * 8); await A.mouse.up(); await A.waitForTimeout(200); await pump();
eq('ink reached B', await Bp.evaluate(() => Object.values(KNGames.rooms())[0].g.strokes.reduce((a, s) => a + s.p.length, 0) > 10), true);
await Bp.locator('#gameView .gm-card').screenshot({ path: out + 'game-draw-2p.png' });
await Bp.fill('#gameView input[data-gin="guess"]', 'ผิดแน่นอน'); await Bp.press('#gameView input[data-gin="guess"]', 'Enter'); await pump();
await Bp.fill('#gameView input[data-gin="guess"]', word); await Bp.press('#gameView input[data-gin="guess"]', 'Enter'); await pump();
eq('B guessed: +3, drawer +1', await A.evaluate(() => Object.values(KNGames.rooms())[0].players.map(p => p.s)), [1, 3]);
eq('wrong guess in log', (await A.locator('#gameView .gm-log').innerText()).includes('ผิดแน่นอน'), true);
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
