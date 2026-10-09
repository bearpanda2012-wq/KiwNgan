// การ์ดลอย: แสดงเช็กลิสต์ + คอมเมนต์ล่าสุดด้านขวา
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8792);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { localStorage.clear(); if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8792/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
await pg.evaluate(() => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go('board'); }); await pg.waitForTimeout(500);
const id = await pg.evaluate(async () => {
  const j = S.jobs.find(x => x.status === 'doing');
  await T.saveJob(Object.assign({}, j, { checklist: JSON.stringify([{ t: 'เช็กขนาดตามแบบลูกค้า', d: 1, by: 'ฝน', at: '2026-10-09T09:10' }, { t: 'ส่ง sale ตรวจ', d: 1, by: 'ต้น' }, { t: 'แก้ตามคอมเมนต์', d: 0 }, { t: 'ส่งต่อ CAM', d: 0 }]) }));
  for (const t of ['ขอบซ้ายสั้นไป 5 มม. ช่วยเช็กอีกที', 'ลูกค้าขอเปลี่ยนสีเป็นเทาด้าน', 'แก้แล้ว รอตรวจครับ']) await T.api().addComment({ jobId: j.id, text: t });
  S.cmtCount[j.id] = 3; return j.id;
});
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(400);
await pg.hover('.card[data-id="' + id + '"] .code'); await pg.waitForTimeout(1300);
eq('hover card wide', await pg.locator('#hovercard.show.wide').count(), 1);
eq('checklist rows', await pg.locator('#hovercard .hv-cl li').count(), 4);
eq('checklist count', await pg.locator('#hovercard .hv-cl .hv-n').textContent(), '2/4');
eq('comments shown', await pg.locator('#hovercard .hv-c').count(), 3);
eq('newest comment first', await pg.locator('#hovercard .hv-c p').first().textContent(), 'แก้แล้ว รอตรวจครับ');
eq('card fits screen', await pg.evaluate(() => { const r = document.querySelector('#hovercard').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 1; }), true);
await pg.locator('#hovercard').screenshot({ path: out + 'hover-cl.png' });
// งานที่ไม่มีเช็กลิสต์และคอมเมนต์ = การ์ดแบบเดิม
const plain = await pg.evaluate(() => { const j = S.jobs.find(x => x.status !== 'done' && !x.checklist && !(S.cmtCount || {})[x.id] && document.querySelector('.card[data-id="' + x.id + '"]')); return j && j.id; });
await pg.mouse.move(5, 5); await pg.waitForTimeout(500);
await pg.hover('.card[data-id="' + plain + '"] .code'); await pg.waitForTimeout(1000);
eq('plain job keeps narrow card', await pg.locator('#hovercard.show:not(.wide)').count(), 1);
// ภาพรวมบริษัท: ชี้แถวงานแล้วขึ้นการ์ดลอยเหมือนบอร์ดงาน (งานที่อยู่ฝ่ายผลิตมีส่วน "ฝ่ายผลิต")
await pg.mouse.move(5, 5); await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(1600);
eq('rows have hover job', (await pg.locator('.co-row[data-hov]').count()) > 5, true);
const prow = pg.locator('.co-row.co-machine[data-hov]').first();
await prow.hover(); await pg.waitForTimeout(1300);
eq('hover card on company row', await pg.locator('#hovercard.show').count(), 1);
eq('production section in hover', await pg.locator('#hovercard .hv-pd .hv-steps i.now').count(), 1);
await pg.screenshot({ path: out + 'hover-co.png' });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.join(' | ') || 'none');
await b.close(); srv.close(); if (bad || errs.length) process.exit(1);
