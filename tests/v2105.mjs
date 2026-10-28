// ห้องเสียงทีม: ทุกคนชี้/วาดบนจอที่แชร์ได้ ทั้งคนแชร์และคนดู
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8861;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
// ฝนแชร์จออยู่ในห้อง เราเป็นคนดู (มีอีก 2 คน: ฝน, ต้น)
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove());
  const V = KiwNgan.V, S = KiwNgan.S, c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#345'; g.fillRect(0, 0, 640, 360);
  window.__sent = { ฝน: [], ต้น: [] };
  const peer = n => ({ key: n, name: n, state: 'connected', pc: { close() {} }, video: n === 'ฝน' ? c.captureStream(5) : null, dc: { readyState: 'open', send: x => window.__sent[n].push(JSON.parse(x)) } });
  Object.assign(V, { on: true, view: true, since: 1, peers: { ฝน: peer('ฝน'), ต้น: peer('ต้น') },
    members: [{ name: S.me, mic: false, share: '', since: 3, admin: true }, { name: 'ฝน', mic: true, share: 'screen', since: 1 }, { name: 'ต้น', mic: true, share: '', since: 2 }] });
  KiwNgan.renderRoom();
}); await pg.waitForTimeout(600);
eq('stage has ink toolbar (+ข้อความ v2.123)', await pg.locator('#roomStage #roomInkBar [data-room="tool"]').count(), 8);
eq('stage owner = sharer', await pg.getAttribute('#roomStage', 'data-owner'), 'ฝน');
await pg.click('#roomInkBar [data-v="pen"]'); await pg.waitForTimeout(150);
eq('stage in drawing mode', await pg.locator('#roomStage.drawing').count(), 1);
const bx = await pg.locator('#roomInk').boundingBox();
await pg.mouse.move(bx.x + bx.width * .3, bx.y + bx.height * .4); await pg.mouse.down();
for (let i = 1; i <= 8; i++) await pg.mouse.move(bx.x + bx.width * (.3 + i * .03), bx.y + bx.height * (.4 + i * .02));
await pg.mouse.up(); await pg.waitForTimeout(300);
eq('my stroke on sharer board', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => !s.l && !s.a).length), 1);
eq('stroke sent to sharer', await pg.evaluate(() => ['b', 'm', 'e'].every(t => window.__sent['ฝน'].some(m => m.t === t && m.s === 'ฝน'))), true);
eq('stroke sent to other viewer too', await pg.evaluate(() => window.__sent['ต้น'].some(m => m.t === 'b')), true);
// ต้น (คนดูอีกคน) วาดมา + ฝน (คนแชร์) ชี้มา → เห็นทั้งคู่
await pg.evaluate(() => { const V = KiwNgan.V; KiwNgan.rinkRecv(JSON.stringify({ t: 'b', s: 'ฝน', id: 'x1', c: '#3B82F6', l: 0, x: .6, y: .6 }), V.peers['ต้น']); KiwNgan.rinkRecv(JSON.stringify({ t: 'e', s: 'ฝน', id: 'x1' }), V.peers['ต้น']); KiwNgan.rinkRecv(JSON.stringify({ t: 'p', s: 'ฝน', x: .7, y: .3, c: '#FFB020' }), V.peers['ฝน']); });
await pg.waitForTimeout(200);
eq('other viewer stroke shown', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => s.a === 'ต้น').length), 1);
eq('sharer pointer shown', await pg.evaluate(() => !!KiwNgan.V.ink['ฝน'].ptrs['ฝน']), true);
// v2.123: เครื่องมือข้อความ — แตะจุดบนจอ พิมพ์ แล้ว Enter
await pg.click('#roomInkBar [data-v="text"]'); await pg.waitForTimeout(100);
await pg.mouse.click(bx.x + bx.width * .2, bx.y + bx.height * .2); await pg.waitForTimeout(150);
eq('text box appears', await pg.locator('#inkTxt').count(), 1);
await pg.keyboard.type('ตรงนี้แก้'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
eq('text stroke on board + sent', [await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => s.k === 'text' && s.tx === 'ตรงนี้แก้').length), await pg.evaluate(() => window.__sent['ฝน'].some(m => m.t === 'b' && m.k === 'text' && m.tx === 'ตรงนี้แก้'))], [1, true]);
{ const t0 = await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.find(s => s.k === 'text').pts[0]);
  await pg.mouse.move(bx.x + bx.width * .2 + 6, bx.y + bx.height * .2 + 6); await pg.mouse.down();
  for (let i = 1; i <= 5; i++) { await pg.mouse.move(bx.x + bx.width * (.2 + i * .06) + 6, bx.y + bx.height * .2 + 6); await pg.waitForTimeout(40); }
  await pg.mouse.up(); await pg.waitForTimeout(150);
  const t1 = await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.find(s => s.k === 'text').pts[0]);
  eq('room: text dragged + mv sent', [Math.abs(t1[0] - t0[0] - .3) < .03, await pg.evaluate(() => window.__sent['ต้น'].some(m => m.t === 'mv'))], [true, true]); }
{ await pg.mouse.click(bx.x + bx.width * .5 + 8, bx.y + bx.height * .2 + 8); await pg.waitForTimeout(150);   // ตำแหน่งข้อความหลังลาก (+0.3 ของความกว้าง)
  eq('room: tap text opens editor with old text', await pg.inputValue('#inkTxt').catch(() => null), 'ตรงนี้แก้');
  await pg.keyboard.press('Control+a'); await pg.keyboard.type('แก้แล้ว'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  eq('room: text edited + sent', [await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => s.k === 'text').map(s => s.tx)), await pg.evaluate(() => window.__sent['ต้น'].some(m => m.t === 'tx' && m.tx === 'แก้แล้ว'))], [['แก้แล้ว'], true]); }
{ const id = await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.find(s => s.k === 'text').id.slice(1));
  await pg.evaluate(id => KiwNgan.rinkRecv(JSON.stringify({ t: 'tx', s: 'ฝน', a: 'แอดมิน', id: id, tx: 'แอบแก้' }), KiwNgan.V.peers['ต้น']), id); await pg.waitForTimeout(100);
  eq('room: others cannot edit my text', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.find(s => s.k === 'text').tx), 'แก้แล้ว'); }
await pg.click('#roomInkBar [data-room="undo"]'); await pg.waitForTimeout(150);
eq('undo removes the text', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.filter(s => s.k === 'text').length), 0);
await pg.click('#roomInkBar [data-v="pen"]'); await pg.waitForTimeout(100);
await pg.locator('#roomStage').screenshot({ path: out + 'room-ink.png' });
// ย้อน = ลบเฉพาะเส้นของเรา
await pg.click('#roomInkBar [data-room="undo"]'); await pg.waitForTimeout(150);
eq('undo removes only my stroke', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.map(s => s.a)), ['ต้น']);
eq('undo broadcast', await pg.evaluate(() => window.__sent['ต้น'].some(m => m.t === 'undo')), true);
// ข้อความไปจอที่ไม่มีใครแชร์ → ไม่สนใจ
await pg.evaluate(() => KiwNgan.rinkRecv(JSON.stringify({ t: 'b', s: 'ต้น', id: 'z', c: '#FF3B5C', l: 0, x: .5, y: .5 }), KiwNgan.V.peers['ต้น']));
eq('ignore board of non-sharer', await pg.evaluate(() => !KiwNgan.V.ink['ต้น']), true);
// ล้างทั้งหมด
await pg.click('#roomInkBar [data-room="clear"]'); await pg.waitForTimeout(150);
eq('clear empties board', await pg.evaluate(() => KiwNgan.V.ink['ฝน'].strokes.length), 0);
// ฝนเลิกแชร์ → กระดานถูกล้าง
await pg.evaluate(() => { const V = KiwNgan.V; V.members[1].share = ''; });
await pg.evaluate(() => KiwNgan.V.members.length);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
