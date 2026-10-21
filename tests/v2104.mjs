// v2.104: หน้า Sale — แท็บคลังวัสดุ (Express ไม่มีราคา)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace("return { kb: this.kbList(d, { role: 'user', name: '' }, true), own:", "return { ex: { url: 'https://ex.test', key: 'k', tok: 'sale_tok_1234567890123456789012' }, kb: this.kbList(d, { role: 'user', name: '' }, true), own:").replace('window.KiwNgan = {', 'window.scanHit=scanHit;window.T={go,saveJob,api};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8878);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
await pg.goto('http://127.0.0.1:8878/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);


let calls = [];
await pg.route('https://ex.test/rest/v1/rpc/**', async route => {
  const fn = route.request().url().split('/').pop(), body = JSON.parse(route.request().postData() || '{}'); calls.push(fn);
  if (body.tok !== 'sale_tok_1234567890123456789012') return route.fulfill({ status: 401, body: '{}' });
  const ago = new Date(Date.now() - 120000).toISOString();
  const out = fn === 'ex_sale_stock' ? { items: [['RM-AL-02-0510', 'อลูมิเนียม 2 mm.5\'x10\'', 'สีเงิน', '06', 'ผน', 1], ['GST-CL-FSS8083', 'สีน้ำ 4SEASON TOA8083', '', 'GST1', 'กป', 3], ['NEG-1', 'ของติดลบ', '', '06', 'ผน', -2]], locs: [['RM-AL-02-0510', '01', 1], ['GST-CL-FSS8083', '04', 3]], tabs: { units: { 'ผน': 'แผ่น', 'กป': 'กระป๋อง' }, locs: { '01': 'แผ่นมาตราฐาน', '04': 'คลังโรงงาน' }, groups: { '06': 'วัตถุดิบ', GST1: 'วัสดุสิ้นเปลือง' } }, agent: { at: ago } }
    : fn === 'ex_sale_find' ? [['RM-AL-03-9999', 'อลูมิเนียม 3 mm. หมดแล้ว', '', '06', 'ผน', 0], ['RM-AL-02-0510', 'อลูมิเนียม 2 mm.5\'x10\'', 'สีเงิน', '06', 'ผน', 1]] : null;
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
});
const key = await pg.evaluate(async () => (await T.api().saleOpen({ pin: '1234' })).key);
await pg.goto('http://127.0.0.1:8878/index.html?salek=' + key); await pg.waitForTimeout(1500);
eq('stock tab shows', await pg.locator('[data-sfview="ex"]').count(), 1);
await pg.click('[data-sfview="ex"]'); await pg.waitForTimeout(800);
eq('in-stock rows', await pg.locator('.skx-list .ex-row').count(), 3);
eq('unit name shown', (await pg.locator('.skx-list .ex-row').first().innerText()).includes('แผ่น'), true);
eq('no price text', /฿|ทุน\/หน่วย|ราคา\s*\d/.test(await pg.locator('.skx-list').innerText()), false);
eq('freshness shown', /อัปเดต/.test(await pg.locator('.skx-h small').first().innerText()), true);
await pg.screenshot({ path: new URL('out/v2104a.png', import.meta.url).pathname });
await pg.fill('#sxQ', 'อลูมิเนียม'); await pg.waitForTimeout(900);
eq('search: in-stock + out-of-stock', [await pg.locator('.skx-list .ex-row:not(.zero)').count(), await pg.locator('.skx-list .ex-row.zero').count()], [1, 1]);
eq('out-of-stock tag', await pg.locator('.skx-list .ex-row.zero .skx-out').count(), 1);
eq('search box keeps focus', await pg.evaluate(() => document.activeElement && document.activeElement.id), 'sxQ');
await pg.screenshot({ path: new URL('out/v2104b.png', import.meta.url).pathname });
await pg.fill('#sxQ', ''); await pg.waitForTimeout(300);
await pg.click('[data-sxgrp="GST1"]'); await pg.waitForTimeout(300);
eq('rows have group color', await pg.$$eval('.skx-list .ex-row', a => a.every(r => /--g:#/.test(r.getAttribute('style')))), true);
eq('pastel KPI cards', await pg.locator('.skx-kpis .sk-kpi').count(), 3);
eq('group chip filters', await pg.locator('.skx-list .ex-row').count(), 1);
eq('only sale RPCs used', [...new Set(calls)].sort(), ['ex_sale_find', 'ex_sale_stock']);
await pg.setViewportSize({ width: 390, height: 800 }); await pg.click('[data-sxgrp=""]'); await pg.waitForTimeout(300);
await pg.screenshot({ path: new URL('out/v2104m.png', import.meta.url).pathname });
eq('no page errors', errs, []);
console.log(ok + ' passed, ' + bad + ' failed'); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
