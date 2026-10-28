// v2.122: ห้องเสียงทีม — แชทพิมพ์คุย · อีโมจิลอย · ยกมือ · คุณภาพสาย · บอกเข้า/ออกทันที
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8923;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(800);
// ในห้องมี ฝน, ต้น (ต่อสายแล้ว · ช่องแชทเปิดอยู่)
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove());
  const V = KiwNgan.V, S = KiwNgan.S; window.__sent = { ฝน: [], ต้น: [] };
  const peer = n => ({ key: n, name: n, state: 'connected', pc: { close() {}, getStats: async () => new Map([['x', { type: 'candidate-pair', nominated: true, state: 'succeeded', currentRoundTripTime: n === 'ฝน' ? .05 : .6 }]]) }, video: null, dc: { readyState: 'open', send() {} }, cc: { readyState: 'open', send: x => window.__sent[n].push(JSON.parse(x)) } });
  Object.assign(V, { on: true, view: true, since: 1, peers: { ฝน: peer('ฝน'), ต้น: peer('ต้น') },
    members: [{ name: S.me, mic: true, share: '', since: 3, admin: true }, { name: 'ฝน', mic: true, share: '', since: 1 }, { name: 'ต้น', mic: false, share: '', since: 2 }] });
  KiwNgan.renderRoom();
}); await pg.waitForTimeout(500);
eq('chat panel shown', await pg.locator('#roomView #roomChat #rcIn').count(), 1);
await pg.fill('#rcIn', 'ดูงาน 69-10062N หน่อย'); await pg.press('#rcIn', 'Enter'); await pg.waitForTimeout(300);
eq('my message shown + sent to both peers', [await pg.locator('#rcList .rc-m.me').count(), await pg.evaluate(() => [window.__sent['ฝน'].length, window.__sent['ต้น'].length, window.__sent['ฝน'][0].text])], [1, [1, 1, 'ดูงาน 69-10062N หน่อย']]);
eq('input cleared and keeps focus', await pg.evaluate(() => [document.querySelector('#rcIn').value, document.activeElement.id]), ['', 'rcIn']);
await pg.evaluate(() => KiwNgan.rcIn({ id: 'x1', t: 'msg', from: 'ฝน', text: 'โอเค เดี๋ยวดูให้', at: Date.now() }, 'ฝน'));
await pg.evaluate(() => KiwNgan.rcIn({ id: 'x1', t: 'msg', from: 'ฝน', text: 'โอเค เดี๋ยวดูให้', at: Date.now() }, 'ฝน'));   // ซ้ำ (มาทั้ง data channel และช่องด่วน)
await pg.waitForTimeout(200);
eq('peer message once', await pg.locator('#rcList .rc-m:not(.me)').count(), 1);
// พิมพ์ค้างไว้ แล้วห้องวาดใหม่ (มีคนเปิดไมค์) → ข้อความที่พิมพ์ไม่หาย
await pg.fill('#rcIn', 'กำลังพิมพ์'); await pg.evaluate(() => { KiwNgan.V.members[2].mic = true; KiwNgan.renderRoom(); }); await pg.waitForTimeout(200);
eq('draft survives re-render', await pg.inputValue('#rcIn'), 'กำลังพิมพ์');
// อีโมจิ + ยกมือ
await pg.click('#roomChat [data-rcx="rx"][data-v="👍"]'); await pg.waitForTimeout(150);
eq('reaction floats + sent', [await pg.locator('.rc-float').count() > 0, await pg.evaluate(() => window.__sent['ต้น'].some(m => m.t === 'rx' && m.e === '👍'))], [true, true]);
await pg.click('#roomView .rtc-tools [data-room="hand"]'); await pg.waitForTimeout(200);
eq('hand raised on my tile', [await pg.locator('#roomView .rm-tile[data-vkey="__me"] .rm-hand').count(), await pg.evaluate(() => window.__sent['ฝน'].some(m => m.t === 'hand' && m.on))], [1, true]);
await pg.evaluate(() => KiwNgan.rcIn({ id: 'h1', t: 'hand', from: 'ต้น', on: true }, 'ต้น')); await pg.waitForTimeout(200);
eq('peer hand shown', await pg.locator('#roomView .rm-tile[data-vkey="ต้น"] .rm-hand').count(), 1);
// ปิดแชท → ข้อความใหม่ขึ้นตัวเลข
await pg.click('#roomChat [data-rcx="chat"]'); await pg.waitForTimeout(200);
await pg.evaluate(() => KiwNgan.rcIn({ id: 'x2', t: 'msg', from: 'ต้น', text: 'ได้ครับ', at: Date.now() }, 'ต้น')); await pg.waitForTimeout(200);
eq('unread badge', await pg.locator('#roomView [data-room="chat"] .rc-badge').innerText().catch(() => ''), '1');
await pg.click('#roomView .rtc-tools [data-room="chat"]'); await pg.waitForTimeout(200);
eq('reopen clears badge, shows 3 msgs + 1 reaction', [await pg.locator('.rc-badge').count(), await pg.locator('#rcList .rc-m').count()], [0, 4]);
// คุณภาพสาย
await pg.evaluate(() => KiwNgan.roomQuality()); await pg.waitForTimeout(300);
eq('quality dots', await pg.evaluate(() => [...document.querySelectorAll('#roomView .rm-q')].map(e => e.className.replace('rm-q ', ''))), ['q-good', 'q-bad']);
// บอกเข้า/ออกทันที (ช่องด่วน)
await pg.evaluate(() => KiwNgan.roomPresenceIn({ k: 'room', op: 'join', m: { name: 'บอส', mic: true, since: 9 } })); await pg.waitForTimeout(200);
eq('presence join adds tile', await pg.locator('#roomView .rm-tile').count(), 4);
await pg.evaluate(() => KiwNgan.roomPresenceIn({ k: 'room', op: 'leave', m: { name: 'บอส' } })); await pg.waitForTimeout(200);
eq('presence leave removes tile', await pg.locator('#roomView .rm-tile').count(), 3);
// v2.123: อีโมจิในช่องพิมพ์ · อีโมจิลอยขึ้นในแชท · ส่งรูป (แบ่งชิ้น)
await pg.click('#roomChat [data-rcx="rx"][data-v="🎉"]'); await pg.waitForTimeout(150);
eq('reaction also logged in chat', await pg.locator('#rcList .rc-m.big p').last().innerText(), '🎉');
await pg.click('#roomChat [data-rcemo="pick"]'); await pg.waitForTimeout(100);
await pg.fill('#rcIn', 'สวัสดี '); await pg.click('#roomChat [data-rcemo="😊"]'); await pg.waitForTimeout(100);
eq('emoji inserted into input', await pg.inputValue('#rcIn'), 'สวัสดี 😊');
await pg.press('#rcIn', 'Enter'); await pg.waitForTimeout(150);
eq('emoji message sent', await pg.evaluate(() => window.__sent['ฝน'].some(m => m.t === 'msg' && m.text === 'สวัสดี 😊')), true);
const big = await pg.evaluate(async () => { const c = document.createElement('canvas'); c.width = 2400; c.height = 1600; const g = c.getContext('2d'); for (let i = 0; i < 4000; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,50%)'; g.fillRect(Math.random() * 2400, Math.random() * 1600, 40, 40); } const b = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([b], 'a.png', { type: 'image/png' })); const inp = document.querySelector('#rcFile'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); return b.size; });
await pg.waitForTimeout(1500);
const chunks = await pg.evaluate(() => window.__sent['ต้น'].filter(m => m.t === 'img'));
eq('image sent in chunks (<16k each), shown once', [chunks.length > 1, chunks.every(m => m.d.length <= 14000), await pg.locator('#rcList .rc-img').count()], [true, true, 1]);
// อีกฝั่งส่งรูปมา (สลับลำดับชิ้น)
await pg.evaluate(ch => { ch.slice().reverse().forEach(m => KiwNgan.rcIn(Object.assign({}, m, { id: 'z' + m.id, img: 'Z' + m.img, from: 'ต้น' }), 'ต้น')); }, chunks); await pg.waitForTimeout(300);
eq('peer image reassembled', await pg.locator('#rcList .rc-img').count(), 2);
await pg.click('#rcList .rc-img >> nth=1'); await pg.waitForTimeout(200);
eq('lightbox opens', await pg.locator('.rc-lb img').count(), 1);
await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
eq('lightbox closes', await pg.locator('.rc-lb').count(), 0);
await pg.screenshot({ path: out + 'v2122-room.png' });
await pg.setViewportSize({ width: 390, height: 800 }); await pg.evaluate(() => { KiwNgan.V.sig = ''; KiwNgan.renderRoom(); }); await pg.waitForTimeout(300);
await pg.screenshot({ path: out + 'v2122-room-m.png' });
eq('mobile: chat fits screen', await pg.evaluate(() => { const r = document.querySelector('#roomChat').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }), true);
console.log('errors', errs.join(' | ') || 'none');
console.log(ok + ' ok, ' + bad + ' failed');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
