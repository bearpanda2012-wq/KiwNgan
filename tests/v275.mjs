// v2.75: ไอคอนแบนเนอร์ขยับทุกตัว · สรุปงานประจำเช้า (ตั้งค่าแอดมิน)
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname; fs.mkdirSync(new URL('out', import.meta.url).pathname, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,api,pModalOpen,stBuyText};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8908);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route(/youtube|ytimg|fonts\.g/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const shot = n => pg.screenshot({ path: new URL('out/' + n + '.png', import.meta.url).pathname });
let ok = 0, bad = 0; const eq = (l, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + l + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
const clean = () => pg.evaluate(() => document.querySelectorAll('.ntf,.chat-heads').forEach(e => e.remove()));
const logout = async () => { await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.reload(); await pg.waitForTimeout(700); };
const loginAs = async n => { await pg.click('.who:has-text("' + n + '")'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1300); await clean(); };
const closeAll = () => pg.evaluate(() => { document.querySelectorAll('.pmodal').forEach(e => e.remove()); document.body.classList.remove('pm-open'); });
await pg.goto('http://127.0.0.1:8908/index.html'); await pg.waitForTimeout(600);

await pg.goto('http://127.0.0.1:8908/index.html'); await pg.waitForTimeout(600);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1300); await clean();
// ไอคอนแบนเนอร์ฝ่ายผลิตขยับทุกตัว (คนละท่า)
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(500);
eq('banner icons all animate (distinct)', await pg.evaluate(() => [...document.querySelectorAll('.pflow .flow-ic svg')].map(e => getComputedStyle(e).animationName)), ['icHome', 'icPress', 'icTwist', 'icRoll', 'icShield', 'icHop', 'icDrive']);
eq('column header icons animate too', await pg.evaluate(() => [...document.querySelectorAll('.pboard .col-ic svg')].every(e => getComputedStyle(e).animationName !== 'none')), true);
// สรุปประจำเช้า
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(500);
eq('settings nav has digest', await pg.locator('.snav a[href="#s-digest"]').count(), 1);
await pg.locator('#s-digest').scrollIntoViewIfNeeded();
eq('off by default', [await pg.locator('#s-digest .pill').innerText(), await pg.locator('[data-dg="on"]').isChecked()], ['ปิดอยู่', false]);
eq('preview shows summary', [/สรุปงานเช้านี้/.test(await pg.locator('.dg-ntf b').innerText()), await pg.locator('.dg-ntf li').count() >= 3], [true, true]);
eq('default recipients = admins', await pg.locator('.dg-p.on .dg-n').allInnerTexts(), ['แอดมิน']);
await pg.locator('.dg-sw').click(); await pg.waitForTimeout(150);
eq('toggle on + savebar', [await pg.locator('[data-dg="on"]').isChecked(), await pg.locator('#savebar').isVisible()], [true, true]);
await pg.click('[data-dghour="7"]'); await pg.click('[data-dgdays="sat"]'); await pg.waitForTimeout(100);
eq('hour + days chosen', [await pg.locator('.dg-chip.on').innerText(), await pg.locator('.dg-seg .on').innerText()], ['07:00', 'จันทร์–เสาร์']);
await pg.selectOption('[data-dg="hour"]', '18'); await pg.waitForTimeout(100);
eq('custom hour via select', [await pg.locator('.dg-chip.on').count(), await pg.locator('.dg-sel.on').count(), /18:00/.test(await pg.locator('.dg-mt small').innerText())], [0, 1, true]);
await pg.click('.dg-p:has-text("ช่างเอ")'); await pg.waitForTimeout(100);
eq('add recipient', (await pg.locator('.dg-p.on .dg-n').allInnerTexts()).sort(), ['ช่างเอ', 'แอดมิน'].sort());
await pg.click('.dg-p.on:has-text("แอดมิน")'); await pg.waitForTimeout(100);
await pg.click('.dg-p.on:has-text("ช่างเอ")'); await pg.waitForTimeout(200);
eq('cannot remove last recipient', await pg.locator('.dg-p.on .dg-n').allInnerTexts(), ['ช่างเอ']);
// ติ๊กวันเอง: เอาเสาร์ออก + เพิ่มอาทิตย์
await pg.click('.dg-day:has([data-dgday="6"])'); await pg.click('.dg-day:has([data-dgday="0"])'); await pg.waitForTimeout(150);
eq('custom day ticks', [await pg.locator('.dg-day.on').count(), await pg.locator('.dg-seg .on').count(), /จ\. อ\. พ\. พฤ\. ศ\. อา\./.test(await pg.locator('.dg-mt small').innerText())], [6, 0, true]);
await pg.click('[data-dgdays="wd"]'); await pg.waitForTimeout(100);
await pg.click('.dg-day:has([data-dgday="6"])'); await pg.waitForTimeout(100);
eq('ticking sat after preset → matches จันทร์–เสาร์', await pg.locator('.dg-seg .on').innerText(), 'จันทร์–เสาร์');
// เรื่องที่จะส่ง
eq('all topics on by default', [await pg.locator('.dg-t').count(), await pg.locator('.dg-t.on').count()], [7, 7]);   // v2.85.1 +นัดหน้างาน
await pg.click('.dg-t:has([data-dgtopic="stock"])'); await pg.click('.dg-t:has([data-dgtopic="shipped"])'); await pg.waitForTimeout(150);
eq('preview follows topics', [await pg.locator('.dg-t.on').count(), /วัสดุ|ใกล้หมด/.test(await pg.locator('.dg-ntf').innerText()), await pg.locator('.dg-ntf li:not(:has-text("⏱️"))').count()], [5, false, 4]);   // v2.120: บรรทัด ⏱️ งานค้างนานกว่าปกติ ขึ้นตามข้อมูล   // นัดหน้างาน: ไม่มีนัด = ไม่ขึ้นบรรทัด
for (const k of ['design', 'visit', 'prod', 'due']) await pg.click('.dg-t:has([data-dgtopic="' + k + '"])');
await pg.click('.dg-t:has([data-dgtopic="late"])'); await pg.waitForTimeout(150);
eq('cannot untick last topic', [await pg.locator('.dg-t.on').count(), await pg.locator('.dg-ntf li').count()], [1, 1]);
await pg.click('.dg-t:has([data-dgtopic="stock"])'); await pg.waitForTimeout(100);
await shot('v275-digest');
await pg.click('[data-act="savesettings"]'); await pg.waitForTimeout(800);
eq('saved to settings', await pg.evaluate(() => { const g = JSON.parse(localStorage.getItem('kiwngan:demo')).settings.digest; return [g.on, g.hour, g.days, g.to, g.topics]; }), [true, 18, [1, 2, 3, 4, 5, 6], ['ช่างเอ'], ['late', 'stock']]);
eq('pill on after save', await pg.locator('#s-digest .pill').innerText(), 'เปิดอยู่');
await pg.click('[data-act="dgsend"]'); await pg.waitForTimeout(500);
eq('demo send shows notice', /โหมดทดลอง/.test(await pg.locator('.toast').last().innerText().catch(() => '')), true);
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(300); await pg.locator('#s-digest').scrollIntoViewIfNeeded();
eq('mobile: no horizontal overflow', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
await shot('v275-digest-m');
eq('no page errors', errs, []);
console.log('v275: ' + ok + ' ok, ' + bad + ' fail'); await b.close(); srv.close(); if (bad) process.exit(1);
