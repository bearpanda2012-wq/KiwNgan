// เครื่องมือวาดบนจอชุดใหม่ (ห้องทีม + โทรตัวต่อตัว): 7 เครื่องมือ · 10 สี · 4 ขนาด · ลูกศร/กรอบ/วงกลม · ยางลบ · ปุ่มลัด
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8863;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);

await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove());
  const V = KiwNgan.V, S = KiwNgan.S, c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#345'; g.fillRect(0, 0, 640, 360);
  window.__sent = { ฝน: [], ต้น: [] };
  const peer = n => ({ key: n, name: n, state: 'connected', pc: { close() {} }, video: n === 'ฝน' ? c.captureStream(5) : null, dc: { readyState: 'open', send: x => window.__sent[n].push(JSON.parse(x)) } });
  Object.assign(V, { on: true, view: true, since: 1, peers: { ฝน: peer('ฝน'), ต้น: peer('ต้น') },
    members: [{ name: S.me, mic: false, share: '', since: 3, admin: true }, { name: 'ฝน', mic: true, share: 'screen', since: 1 }, { name: 'ต้น', mic: true, share: '', since: 2 }] });
  KiwNgan.renderRoom();
}); await pg.waitForTimeout(600);
const RB = '#roomInkBar';
eq('room: 8 tools (+ข้อความ)', await pg.$$eval(RB + ' [data-room="tool"]', a => a.map(x => x.dataset.v)), ['laser', 'pen', 'hl', 'arrow', 'rect', 'oval', 'text', 'erase']);
eq('room: no sub panel before tool', await pg.locator(RB + ' .ink-sub').count(), 0);
await pg.click(RB + ' [data-v="pen"]'); await pg.waitForTimeout(150);
eq('room: 10 colors', await pg.locator(RB + ' [data-room="color"]').count(), 10);
eq('room: 4 sizes', await pg.locator(RB + ' [data-room="size"]').count(), 4);
await pg.click(RB + ' [data-room="size"][data-v="4"]'); await pg.click(RB + ' [data-room="color"][data-v="#8B5CF6"]'); await pg.waitForTimeout(100);
eq('room: size+color chosen', await pg.evaluate(() => [KiwNgan.V.size, KiwNgan.V.color]), [4, '#8B5CF6']);
eq('pref remembered', await pg.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /inkPref/.test(k))))), { c: '#8B5CF6', w: 4 });
await pg.locator('#roomStage').screenshot({ path: out + 'ink-kit-room.png' });
const bx = await pg.locator('#roomInk').boundingBox();
const drag = async (x0, y0, x1, y1, n = 6) => { await pg.mouse.move(bx.x + bx.width * x0, bx.y + bx.height * y0); await pg.mouse.down(); for (let i = 1; i <= n; i++) await pg.mouse.move(bx.x + bx.width * (x0 + (x1 - x0) * i / n), bx.y + bx.height * (y0 + (y1 - y0) * i / n)); await pg.mouse.up(); await pg.waitForTimeout(120); };
await drag(.1, .2, .3, .3);
let sent = await pg.evaluate(() => window.__sent['ฝน'].filter(m => m.t === 'b').pop());
eq('room: b carries kind+size', [sent.k, sent.w, sent.c], ['pen', 4, '#8B5CF6']);
// ลูกศร (ปุ่มลัด A) · กรอบ · วงกลม · ไฮไลต์
for (const [key, kind] of [['a', 'arrow'], ['r', 'rect'], ['o', 'oval'], ['h', 'hl']]) { await pg.keyboard.press(key); await pg.waitForTimeout(60); await drag(.4, .3, .7, .6); }
const board = await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => !s.a).map(s => [s.k, s.pts.length]));
eq('room: kinds drawn', board.map(x => x[0]), ['pen', 'arrow', 'rect', 'oval', 'hl']);
eq('room: shapes keep 2 points', board.filter(x => ['arrow', 'rect', 'oval'].includes(x[0])).map(x => x[1]), [2, 2, 2]);
await pg.keyboard.press(']'); await pg.keyboard.press('['); await pg.keyboard.press('['); await pg.waitForTimeout(60);
eq('room: [ ] size keys', await pg.evaluate(() => KiwNgan.V.size), 2);
await pg.keyboard.press('2'); eq('room: number key = color', await pg.evaluate(() => KiwNgan.V.color), '#FF7A1A');
await pg.locator('#roomStage').screenshot({ path: out + 'ink-shapes-room.png' });
// ต้นวาดมาด้วย → ยางลบลบเส้นของต้นได้ และส่งบอกทุกคน
await pg.evaluate(() => { const V = KiwNgan.V; KiwNgan.rinkRecv(JSON.stringify({ t: 'b', s: 'ฝน', id: 't1', c: '#22C55E', l: 0, k: 'pen', w: 3, x: .85, y: .85 }), V.peers['ต้น']); KiwNgan.rinkRecv(JSON.stringify({ t: 'm', s: 'ฝน', id: 't1', x: .95, y: .9 }), V.peers['ต้น']); KiwNgan.rinkRecv(JSON.stringify({ t: 'e', s: 'ฝน', id: 't1' }), V.peers['ต้น']); });
await pg.keyboard.press('e'); await pg.waitForTimeout(80);
eq('room: eraser has no sub panel', await pg.locator(RB + ' .ink-sub').count(), 0);
const rr = await pg.evaluate(() => { const box = document.querySelector('#roomInk').parentNode, v = document.querySelector('#roomVid'), W = box.clientWidth, H = box.clientHeight, k = v.videoWidth ? Math.min(W / v.videoWidth, H / v.videoHeight) : 0; return k ? { x: (W - v.videoWidth * k) / 2, y: (H - v.videoHeight * k) / 2, w: v.videoWidth * k, h: v.videoHeight * k } : { x: 0, y: 0, w: W, h: H }; });
await pg.mouse.click(bx.x + rr.x + rr.w * .9, bx.y + rr.y + rr.h * .875); await pg.waitForTimeout(150);
eq('room: erased other person stroke', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.some(s => s.a === 'ต้น')), false);
sent = await pg.evaluate(() => window.__sent['ต้น'].filter(m => m.t === 'del').pop());
eq('room: del tells owner', sent && [sent.a, sent.id], ['ต้น', 't1']);
// ต้นได้รับ del ของเส้นตัวเอง (มุมมองเครื่องต้น: a = ชื่อตัวเอง → คีย์ '')
eq('room: unknown color falls back', await pg.evaluate(() => { KiwNgan.rinkRecv(JSON.stringify({ t: 'b', s: 'ฝน', id: 'x9', c: 'red;x', l: 0, x: .5, y: .5 }), KiwNgan.V.peers['ต้น']); return KiwNgan.V.ink['ฝน'].strokes.find(s => s.id === 'ต้น|x9').c; }), '#FF3B5C');
await pg.keyboard.press('Escape'); await pg.waitForTimeout(60);
eq('room: Esc stops drawing', await pg.evaluate(() => KiwNgan.V.tool), '');
// ---- โทรตัวต่อตัว (คนดู): แถบเดียวกัน
await pg.evaluate(() => { const V = KiwNgan.V; V.on = false; V.view = false; KiwNgan.renderRoom();
  const R = KiwNgan.R, c = document.createElement('canvas'); c.width = 640; c.height = 360; c.getContext('2d').fillRect(0, 0, 640, 360);
  window.__s1 = []; Object.assign(R, { role: 'view', state: 'live', src: 'screen', name: 'ฝน', peer: 'ฝน', remote: c.captureStream(5), dc: { readyState: 'open', send: x => window.__s1.push(JSON.parse(x)) } });
  KiwNgan.renderRtc(); const v = document.querySelector('#rtcVideo'); if (v) v.srcObject = R.remote;
}); await pg.waitForTimeout(700);
const IB = '#rtcInkBar';
eq('1:1: same 8 tools', await pg.$$eval(IB + ' [data-rtc="tool"]', a => a.map(x => x.dataset.v)), ['laser', 'pen', 'hl', 'arrow', 'rect', 'oval', 'text', 'erase']);
await pg.click(IB + ' [data-v="arrow"]'); await pg.waitForTimeout(120);
eq('1:1: colors + sizes', [await pg.locator(IB + ' [data-rtc="color"]').count(), await pg.locator(IB + ' [data-rtc="size"]').count()], [10, 4]);
await pg.screenshot({ path: out + 'ink-kit-1to1.png' });
const cb = await pg.locator('#rtcInk').boundingBox();
const vbox = await pg.evaluate(() => { const v = document.querySelector('#rtcVideo'); return [v.videoWidth, v.videoHeight]; });
await pg.mouse.move(cb.x + cb.width * .3, cb.y + cb.height * .3); await pg.mouse.down(); for (let i = 1; i <= 6; i++) await pg.mouse.move(cb.x + cb.width * (.3 + i * .05), cb.y + cb.height * (.3 + i * .04)); await pg.mouse.up(); await pg.waitForTimeout(150);
sent = await pg.evaluate(() => window.__s1.filter(m => m.t === 'b').pop());
eq('1:1: arrow sent with size', sent && [sent.k, sent.w], ['arrow', 2]);
eq('1:1: arrow 2 pts', await pg.evaluate(() => KiwNgan.R.ink.strokes.map(s => [s.k, s.pts.length])), [['arrow', 2]]);
// อีกฝ่ายวาดเส้น → ย้อนของเรา ลบเฉพาะของเรา · ยางลบลบของเขาได้
await pg.evaluate(() => { const R = KiwNgan.R, ch = { readyState: 'open', send: x => window.__s1.push(JSON.parse(x)) }; KiwNgan.rtcDc(ch); ch.onmessage({ data: JSON.stringify({ t: 'b', id: 'h1', c: '#FFD60A', l: 0, k: 'rect', w: 3, x: .6, y: .6 }) }); ch.onmessage({ data: JSON.stringify({ t: 'm', id: 'h1', x: .8, y: .8 }) }); ch.onmessage({ data: JSON.stringify({ t: 'e', id: 'h1' }) }); });
await pg.click(IB + ' [data-rtc="undo"]'); await pg.waitForTimeout(100);
eq('1:1: undo only mine', await pg.evaluate(() => KiwNgan.R.ink.strokes.map(s => s.id)), ['h1']);
await pg.click(IB + ' [data-v="erase"]'); await pg.waitForTimeout(100);
const rb = await pg.evaluate(() => { const box = document.querySelector('#rtcInk').parentNode, v = document.querySelector('#rtcVideo'), W = box.clientWidth, H = box.clientHeight, k = Math.min(W / v.videoWidth, H / v.videoHeight); return { x: (W - v.videoWidth * k) / 2, y: (H - v.videoHeight * k) / 2, w: v.videoWidth * k, h: v.videoHeight * k }; });
await pg.mouse.click(cb.x + rb.x + rb.w * .8, cb.y + rb.y + rb.h * .7); await pg.waitForTimeout(120);
eq('1:1: eraser removed peer rect', await pg.evaluate(() => KiwNgan.R.ink.strokes.length), 0);
eq('1:1: del sent', await pg.evaluate(() => window.__s1.some(m => m.t === 'del' && m.id === 'h1')), true);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
