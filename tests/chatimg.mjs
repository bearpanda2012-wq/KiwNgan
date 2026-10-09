// แชท: Print Screen → Ctrl+V วางรูปในกล่องข้อความ แล้วส่งให้เพื่อน
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8796);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8796/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); });
await pg.evaluate(() => { const b = document.querySelector('[data-act="msgopen"]'); if (b) b.click(); else window.KiwNgan && 0; });
await pg.waitForTimeout(300);
if (!await pg.locator('#msgText').count()) { await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /ข้อความ/.test(x.getAttribute('aria-label') || x.title || '')); b && b.click(); }); await pg.waitForTimeout(500); }
eq('message panel open', await pg.locator('#msgText').count(), 1);
await pg.click('#msgText');
// จำลองการกด Print Screen แล้ว Ctrl+V
await pg.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#2563eb'; x.fillRect(0, 0, 320, 200); x.fillStyle = '#fff'; x.fillRect(40, 40, 120, 60);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }));
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  document.querySelector('#msgText').dispatchEvent(ev);
});
await pg.waitForTimeout(600);
eq('pasted image preview', await pg.locator('#msgPanel .mp-att img').count(), 1);
await pg.fill('#msgText', 'ดูจอนี้หน่อย');
await pg.screenshot({ path: out + 'chat-paste.png' });
await pg.press('#msgText', 'Enter'); await pg.waitForTimeout(1200);
eq('preview cleared after send', await pg.locator('#msgPanel .mp-att').count(), 0);
eq('bubble shows image', await pg.locator('#msgPanel .bub.me .bub-img img').count() >= 1, true);
eq('saved with image', await pg.evaluate(() => KiwNgan.M.list.some(m => m.img && m.text === 'ดูจอนี้หน่อย' && !m.pending)), true);
// รูปอย่างเดียว ไม่มีข้อความ
await pg.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 50; c.height = 50; const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 's2.png', { type: 'image/png' }));
  document.querySelector('#msgText').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}); await pg.waitForTimeout(500);
await pg.click('#msgPanel .mp-send'); await pg.waitForTimeout(1000);
eq('image-only message sent', await pg.evaluate(() => KiwNgan.M.list.filter(m => m.img && !m.text).length), 1);
await pg.locator('#msgPanel .bub-img').first().click(); await pg.waitForTimeout(300);
eq('image viewer opens', await pg.locator('#imgView.open img').count(), 1);
await pg.screenshot({ path: out + 'chat-view.png' });
await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
eq('viewer closes', await pg.locator('#imgView.open').count(), 0);
// ไม่มีปุ่มรีโมท + คลิกนอกกล่องข้อความแล้วกล่องซ่อน
await pg.evaluate(() => { const c = document.querySelector('#msgPanel .mp-ch:not(.on)'); c && c.click(); }); await pg.waitForTimeout(300);
eq('no remote button', await pg.locator('#msgPanel [data-rtc="remote"]').count(), 0);
await pg.mouse.click(400, 500); await pg.waitForTimeout(300);
eq('click outside hides panel', await pg.locator('#msgPanel.open').count(), 0);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
