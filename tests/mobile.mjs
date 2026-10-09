// มือถือ: ทุกหน้าต้องไม่ล้นจอแนวนอน (390px / 360px) + เก็บภาพไว้ตรวจ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/mobile/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8793);
const SHOT = process.env.SHOT === '1';
let ok = 0, bad = 0; const errs = [];
const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
// หา element ที่ล้นขอบขวาของจอ (ไม่นับที่อยู่ในกล่องที่เลื่อนแนวนอนได้เอง)
const overflow = pg => pg.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = [];
  const scrollerOf = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.clientWidth < W + 1) return p; } return null; };
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const s = getComputedStyle(el); if (s.position === 'fixed' && s.visibility === 'hidden') return;
    if (r.right > W + 1 || r.left < -1) { if (scrollerOf(el)) return; if (el.closest('[aria-hidden="true"],.sr-only,#hovercard')) return;
      bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).trim().split(/\s+/).slice(0, 2).join('.')) + ' ' + Math.round(r.left) + '→' + Math.round(r.right)); }
  });
  return { docW: document.documentElement.scrollWidth, W, bad: [...new Set(bad)].slice(0, 8) };
});
for (const vw of [390, 360]) {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: vw, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
  await pg.goto('http://127.0.0.1:8793/index.html'); await pg.waitForTimeout(700);
  const chk = async (name) => { const o = await overflow(pg); eq(vw + ' ' + name + ' fits width', o.docW <= o.W && !o.bad.length ? 'fit' : o, 'fit'); if (SHOT) await pg.screenshot({ path: out + vw + '-' + name + '.png', fullPage: true }); };
  await chk('login');
  await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1300);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
  for (const v of ['flow', 'home', 'board', 'list', 'prod', 'team', 'report', 'settings']) { await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(900); await chk(v); }
  // เปิดรายละเอียดงาน
  await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(500);
  const card = pg.locator('.card[data-id]').first();
  if (await card.count()) { await card.click(); await pg.waitForTimeout(900); await chk('job-detail'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
  // เพิ่มงานใหม่
  const nb = pg.locator('#fab, [data-act="new"]').first();
  if (await nb.count() && await nb.isVisible()) { await nb.click(); await pg.waitForTimeout(700); await chk('new-job'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
  // บอร์ดผลิต: เปิดการ์ด
  await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(600);
  const pc = pg.locator('.pcard').first();
  if (await pc.count()) { await pc.click(); await pg.waitForTimeout(700); await chk('prod-modal'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); }
  // หน้า Sale
  const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
  await pg.goto('http://127.0.0.1:8793/index.html?salek=' + key); await pg.waitForTimeout(1500); await chk('sale');
  const row = pg.locator('[data-sfopen]').first();
  if (await row.count()) { await row.click(); await pg.waitForTimeout(500); await chk('sale-open'); }
  const tab = pg.locator('[data-sfview="table"]');
  if (await tab.count()) { await tab.click(); await pg.waitForTimeout(700); await chk('sale-table'); await pg.locator('[data-sfview="flow"]').click(); await pg.waitForTimeout(300); }
  await b.close();
}
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
srv.close(); if (bad || errs.length) process.exit(1);
