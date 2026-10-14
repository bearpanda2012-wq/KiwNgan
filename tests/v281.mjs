// v2.81: ธีมผูกกับบัญชี · หน้าต่างดูข้อมูลปิดเองเมื่อเปลี่ยนหน้า
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,closeEditor,api,render};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8806);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:8806/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1200);
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// 4) ธีมผูกกับบัญชี
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(900);
eq('sync switch on by default', await pg.evaluate(() => document.querySelector('#thSync').checked), true);
await pg.click('[data-themepick="night"]'); await pg.waitForTimeout(300);
await pg.fill('#tsName', 'ของบัญชี'); await pg.click('[data-act="tssave"]'); await pg.waitForTimeout(2200);
eq('saved to account', await pg.evaluate(async () => { const d = (await T.api().themeGet({})).data; return d && [d.theme.preset, d.saves.length]; }), ['night', 1]);
// เครื่องใหม่: ไม่มีธีมในเครื่อง → ได้ของบัญชีหลังเข้าแอป
await pg.evaluate(() => { ['theme', 'themeSaves', 'themeTs', 'themeOwner'].forEach(k => localStorage.removeItem('kiwngan:' + k)); }); await pg.reload(); await pg.waitForTimeout(2500);
eq('new device pulls account theme', await pg.evaluate(() => [JSON.parse(localStorage.getItem('kiwngan:theme') || '{}').preset, JSON.parse(localStorage.getItem('kiwngan:themeSaves') || '[]').length, document.documentElement.getAttribute('data-theme')]), ['night', 1, 'dark']);
// อีกเครื่องแก้ใหม่กว่า → เครื่องนี้เปิดแอปครั้งถัดไปได้ของใหม่
await pg.evaluate(async () => { await T.api().themeSave({ data: { ts: Date.now() + 1000, theme: { preset: 'gold' }, saves: [] } }); });
await pg.reload(); await pg.waitForTimeout(2500);
eq('newer edit from another device wins', await pg.evaluate(() => JSON.parse(localStorage.getItem('kiwngan:theme') || '{}').preset), 'gold');
// ปิดซิงก์เครื่องนี้ → แก้แล้วไม่ส่งขึ้นบัญชี
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800);
await pg.click('#thSync'); await pg.waitForTimeout(400);
await pg.click('[data-themepick="rose"]'); await pg.waitForTimeout(2200);
eq('device opt-out keeps account untouched', await pg.evaluate(async () => (await T.api().themeGet({})).data.theme.preset), 'gold');
// อีกคนเข้าบัญชีของตัวเองบนเครื่องนี้ (บัญชียังไม่มีธีม) → เริ่มจากธีมเริ่มต้น ไม่ได้ธีมของคนก่อน
await pg.evaluate(() => { localStorage.setItem('kiwngan:themeSync', 'true'); Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k)); localStorage.setItem('kiwngan:theme', JSON.stringify({ preset: 'night', mode: 'dark' })); });
await pg.reload(); await pg.waitForTimeout(800); await pg.click('.who:has-text("ต้น")'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1500);
eq('other user on same device starts from default theme', await pg.evaluate(() => [S.me, (JSON.parse(localStorage.getItem('kiwngan:theme') || '{}').preset || 'brand'), JSON.parse(localStorage.getItem('kiwngan:themeSaves') || '[]').length]), ['ต้น', 'brand', 0]);
await pg.evaluate(() => { Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k)); }); await pg.reload(); await pg.waitForTimeout(800);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.evaluate(() => { const e = document.querySelector('#pinIn'); if (e) e.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForFunction(() => !document.body.classList.contains('auth'), null, { timeout: 10000 }).catch(() => {}); await pg.waitForTimeout(1500);
eq('admin back on device gets own account theme', await pg.evaluate(() => JSON.parse(localStorage.getItem('kiwngan:theme') || '{}').preset), 'gold');
await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
// 2) เปลี่ยนหน้าแล้วหน้าต่างดูงานผลิตปิดเอง แต่หน้าต่างที่กำลังเพิ่มงานไม่ปิด
await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(700); await pg.click('[data-popen] .code'); await pg.waitForTimeout(700);
const pOpen = await pg.evaluate(() => !!document.querySelector('#pModal')); await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(500);
eq('view popup closes on navigation', [pOpen, await pg.evaluate(() => !!document.querySelector('#pModal'))], [true, false]);
await pg.evaluate(() => T.go('list')); await pg.waitForTimeout(500); await pg.click('.fab'); await pg.waitForTimeout(600); await pg.fill('#e-code', 'KEEP-1');
await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(500);
eq('editor with typing stays open', await pg.evaluate(() => [document.querySelector('#sheet').classList.contains('open'), (document.querySelector('#e-code') || {}).value]), [true, 'KEEP-1']);
await pg.click('#e-code'); await pg.keyboard.type('X'); await pg.evaluate(() => { const t = document.querySelector('#e-title') || document.querySelector('[data-e="title"]'); if (t) { t.value = 'ลูกค้าทดสอบ'; } document.querySelector('#e-code').focus(); });
await pg.evaluate(() => T.render()); await pg.waitForTimeout(300);
eq('background refresh keeps typing + cursor', await pg.evaluate(() => [document.querySelector('#e-code').value, document.activeElement && document.activeElement.id]), ['KEEP-1X', 'e-code']);
// 3) มือถือ: ป้ายแชตหดเป็นแถบเล็ก ไม่บังข้อความในรายการ · แตะเพื่อกาง · แตะที่อื่นหุบ
await pg.evaluate(() => { if (window.T.closeEditor) T.closeEditor(); document.querySelector('#sheet').classList.remove('open'); });
await pg.setViewportSize({ width: 390, height: 844 }); await pg.evaluate(() => T.go('list')); await pg.waitForTimeout(800);
const headsBox = () => pg.evaluate(() => { const vis = [...document.querySelectorAll('#chatHeads > *')].filter(c => c.offsetParent); if (!vis.length) return null; const r = vis.map(c => c.getBoundingClientRect()); return { l: Math.min(...r.map(x => x.left)), t: Math.min(...r.map(x => x.top)), b: Math.max(...r.map(x => x.bottom)), w: Math.max(...r.map(x => x.right)) - Math.min(...r.map(x => x.left)) }; });
const hb = await headsBox();
eq('collapsed edge tab is slim (≤26px)', !!hb && hb.w <= 26, true);
eq('collapsed tab covers no text', await pg.evaluate(hb => [...document.querySelectorAll('main *')].filter(e => !e.children.length && e.textContent.trim() && e.offsetParent).some(e => { const r = e.getBoundingClientRect(); return r.right > hb.l && r.top < hb.b && r.bottom > hb.t; }), hb), false);
await pg.click('.ch-tab'); await pg.waitForTimeout(500);
eq('tap tab opens heads', await pg.evaluate(() => [document.querySelector('#chatHeads').classList.contains('open'), [...document.querySelectorAll('#chatHeads .ch-head')].some(x => x.offsetParent)]), [true, true]);
await pg.mouse.click(120, 300); await pg.waitForTimeout(300);
eq('tap elsewhere folds back', await pg.evaluate(() => document.querySelector('#chatHeads').classList.contains('open')), false);
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
