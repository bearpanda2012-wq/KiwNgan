// ห้องเกม: 4 เกม (เป่ายิ้งฉุบ จับคู่ภาพ คิดเลขไว ทอยเต๋า) · เล่นกับบอท · 2 เครื่องเล่นด้วยกันผ่านช่องเรียลไทม์ (จำลอง)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8865;
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
// เปิดกล่องข้อความ → ปุ่ม 🎮 → หน้าห้องเกม
await A.click('[data-act="msgopen"]').catch(() => A.evaluate(() => document.querySelector('[data-act="msgopen"]') && document.querySelector('[data-act="msgopen"]').click()));
await A.waitForTimeout(400);
eq('game button in chat', await A.locator('#msgPanel [data-act="games"]').count(), 1);
await A.locator('#msgPanel .mp-head').screenshot({ path: out + 'game-btn.png' });
await A.click('#msgPanel [data-act="games"]'); await A.waitForTimeout(700);
eq('11 games listed (work games first)', await A.$$eval('#gameView [data-ga="new"]', a => a.map(x => x.dataset.v)), ['quiz', 'sort', 'rps', 'mem', 'math', 'pig', 'draw', 'four', 'guess', 'react', 'bingo']);
eq('offline note (demo)', await A.locator('#gameView .gm-note').count(), 1);
await A.locator('#gameView .gm-card').screenshot({ path: out + 'games-lobby.png' });
// ทุกเกมเล่นกับบอทจนจบได้
for (const g of ['rps', 'mem', 'math', 'pig']) {
  await A.click('#gameView [data-ga="new"][data-v="' + g + '"]'); await A.waitForTimeout(200);
  eq(g + ': start disabled alone', await A.locator('#gameView [data-ga="start"]').isDisabled(), true);
  await A.click('#gameView [data-ga="bot"]'); await A.click('#gameView [data-ga="bot"]'); await A.waitForTimeout(100);
  await A.click('#gameView [data-ga="start"]'); await A.waitForTimeout(300);
  // เล่นของเราแบบสุ่มจนจบ
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const ph = await A.evaluate(() => { const r = Object.values(KNGames.rooms())[0]; return r && r.phase; });
    if (ph === 'end') break;
    const btn = await A.$('#gameView .gm-board button:not([disabled])');
    if (btn) await btn.click().catch(() => {});
    await A.waitForTimeout(g === 'math' ? 400 : 250);
  }
  eq(g + ': finished', await A.evaluate(() => Object.values(KNGames.rooms())[0].phase), 'end');
  eq(g + ': winner shown', await A.locator('#gameView .gm-end').count(), 1);
  await A.locator('#gameView .gm-card').screenshot({ path: out + 'game-' + g + '.png' });
  await A.click('#gameView [data-ga="leave"]'); await A.waitForTimeout(150);
}
// สองเครื่อง: A เปิดห้องทั้งทีม (เป่ายิ้งฉุบ) B ได้คำชวน เข้าร่วม แล้วเล่นด้วยกัน
const Bp = await page('B', 390, 844);
const relay = async (from, to) => { const q = await from.evaluate(() => { const x = window.__out || []; window.__out = []; return x; }); for (const o of q) await to.evaluate(o => KiwNgan.gameIn(o), o); return q.length; };
for (const [pg, nm] of [[A, 'หมี'], [Bp, 'ฝน']]) await pg.evaluate(nm => { window.__out = []; KN_G.send = o => window.__out.push(JSON.parse(JSON.stringify(Object.assign({ k: 'g' }, o)))); KN_G.live = () => true; KN_G.me = () => nm; }, nm);
const pump = async (n = 4) => { for (let i = 0; i < n; i++) { await relay(A, Bp); await relay(Bp, A); await A.waitForTimeout(80); } };
await A.evaluate(() => KNGames.open('team')); await A.click('#gameView [data-ga="new"][data-v="rps"]'); await A.waitForTimeout(150); await pump();
eq('B got invite', await Bp.locator('#gInvite:not([hidden]) [data-act="gjoin"]').count(), 1);
await Bp.screenshot({ path: out + 'game-invite.png' });
await Bp.click('#gInvite [data-act="gjoin"]'); await Bp.waitForTimeout(600); await pump();
eq('A sees 2 players', await A.evaluate(() => Object.values(KNGames.rooms())[0].players.map(p => p.n)), ['หมี', 'ฝน']);
await A.click('#gameView [data-ga="start"]'); await pump();
eq('B in play', await Bp.evaluate(() => Object.values(KNGames.rooms())[0].phase), 'play');
await A.click('#gameView [data-ga="pick"][data-v="r"]'); await pump();
eq('B cannot see A pick', await Bp.evaluate(() => Object.values(KNGames.rooms())[0].g.picks['หมี']), '?');
await Bp.click('#gameView [data-ga="pick"][data-v="p"]'); await pump();
const sc = await A.evaluate(() => Object.values(KNGames.rooms())[0].players.map(p => p.s));
eq('paper beats rock → ฝน +1', sc, [0, 1]);
eq('B sees result', await Bp.evaluate(() => Object.values(KNGames.rooms())[0].g.last.gain['ฝน']), 1);
await Bp.locator('#gameView .gm-card').screenshot({ path: out + 'game-rps-2p.png' });
// แบบคู่: ห้องที่ส่งถึง 2 คน — คนอื่นไม่ได้รับ
eq('pair scope filters others', await Bp.evaluate(() => { const n = Object.keys(KNGames.rooms()).length; KiwNgan.gameIn({ k: 'g', t: 'open', r: 'zz', to: ['ต้น', 'นวล'], game: 'pig', host: 'ต้น' }); return Object.keys(KNGames.rooms()).length === n && !KN_G.known('zz'); }), true);
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
