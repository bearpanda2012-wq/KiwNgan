// หน้าเข้าระบบ: ติดตั้งแอป · QR แยก iPhone / Android · เปิดจาก QR ขึ้นวิธีของเครื่องนั้น · LINE เด้งออกเบราว์เซอร์
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8862;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] });
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const errs = [];
async function open(opts, url) {
  const ctx = await b.newContext(opts), pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
  await pg.goto('http://127.0.0.1:' + PORT + url); await pg.waitForTimeout(900); return pg;
}
const base = 'http://127.0.0.1:' + PORT + '/';
// คอม: กดวิธีติดตั้ง → QR 2 อัน (iPhone + Android) ลิงก์ต่างกัน
let pg = await open({ viewport: { width: 1400, height: 900 } }, '/index.html');
await pg.click('[data-act="insthelp"]'); await pg.waitForTimeout(150);
await pg.click('[data-insttab="mobile"]'); await pg.waitForTimeout(600);
eq('desktop: 2 QR cards', await pg.locator('.inst-qrs .qr-box svg').count(), 2);
eq('desktop: QR os', await pg.$$eval('.qr-box[data-qr]', a => a.map(x => x.dataset.qr)), ['ios', 'android']);
// ถอด QR จริงด้วย jsQR (vendor) → ต้องเป็นลิงก์แอป + ระบบ + openExternalBrowser
await pg.addScriptTag({ url: base + 'vendor/jsqr.js' });
const dec = await pg.evaluate(async () => Promise.all([...document.querySelectorAll('.qr-box[data-qr] svg')].map(svg => new Promise(res => {
  const img = new Image(), c = document.createElement('canvas'); c.width = c.height = 400;
  img.onload = () => { const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 400); g.drawImage(img, 40, 40, 320, 320); const d = g.getImageData(0, 0, 400, 400); const r = jsQR(d.data, 400, 400); res(r ? r.data : null); };
  const x = svg.cloneNode(true); x.setAttribute('width', 320); x.setAttribute('height', 320); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(x));
}))));
eq('desktop: QR decodes', dec, [base + '?install=ios&openExternalBrowser=1', base + '?install=android&openExternalBrowser=1']);
eq('desktop: print button', await pg.locator('[data-act="instprint"]').count(), 1);
await pg.locator('.lg-install').screenshot({ path: out + 'inst-desktop.png' });
await pg.click('[data-insttab="desktop"]'); await pg.waitForTimeout(150);
eq('desktop tab warns about shortcut', (await pg.locator('.inst-note').innerText()).includes('สร้างทางลัด'), true);
// iPhone มาจาก QR: เปิดวิธี iPhone เลย ไม่มี QR · ลิงก์ถูกล้างพารามิเตอร์
const iphone = { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true };
pg = await open(iphone, '/?install=ios&openExternalBrowser=1');
eq('ios: panel open', await pg.locator('.inst-panel').count(), 1);
eq('ios: first card ios', await pg.getAttribute('.inst-panel > .inst-card', 'data-os'), 'ios');
eq('ios: no QR on phone', await pg.locator('.qr-box[data-qr]').count(), 0);
eq('ios: url cleaned', await pg.evaluate(() => location.href), base);
eq('ios: no in-app warning in Safari', await pg.locator('.inst-warn').count(), 0);
await pg.locator('.lg-install').screenshot({ path: out + 'inst-ios.png' });
// Android
pg = await open({ viewport: { width: 412, height: 900 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', hasTouch: true, isMobile: true }, '/?install=android&openExternalBrowser=1');
eq('android: first card android', await pg.getAttribute('.inst-panel > .inst-card', 'data-os'), 'android');
eq('android: other os in details', await pg.locator('.inst-other .inst-card[data-os="ios"]').count(), 1);
// LINE ในแอป: ไม่มีพารามิเตอร์ → เด้งเพิ่ม openExternalBrowser · มีคำเตือน
const line = Object.assign({}, iphone, { userAgent: iphone.userAgent + ' Line/14.9.0' });
pg = await open(line, '/?install=ios');
eq('line: warning shown', (await pg.locator('.inst-warn').innerText().catch(() => '')).includes('LINE'), true);
eq('line: redirected once then cleaned', await pg.evaluate(() => location.href), base);
eq('no page errors', errs, []);
console.log(ok + ' ok, ' + bad + ' fail'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
