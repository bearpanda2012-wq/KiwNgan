// v2.75.2: แตะแจ้งเตือนแล้วไปที่ข้อความ/งานนั้น
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,openEditor,saveJob,prodsAll,pushNav,M};window.S=S;window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8796);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { if (!sessionStorage.getItem('kn-init')) { localStorage.clear(); sessionStorage.setItem('kn-init', '1'); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
const login = async (name, admin) => {
  await pg.evaluate(() => Object.keys(localStorage).filter(k => /token/.test(k)).forEach(k => localStorage.removeItem(k))); await pg.goto('http://127.0.0.1:8796/index.html'); await pg.waitForTimeout(700);
  if (admin) { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', name); } else await pg.click('.who:has-text("' + name + '")');
  await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
};
await pg.goto('http://127.0.0.1:8796/index.html'); await pg.waitForTimeout(800);
await login('แอดมิน', true); await pg.waitForTimeout(1500);
const info = await pg.evaluate(() => T.M.list.map(m => ({ id: m.id, to: m.to, from: m.from, kind: m.kind })));
eq('demo has messages', info.length > 1, true);
const dm = info.find(m => m.to !== 'team' && m.kind !== 'help') || info[0];
await pg.evaluate(id => T.pushNav('#msg/' + id + '/team/'), dm.id); await pg.waitForTimeout(1100);
eq('chat opened', await pg.evaluate(() => document.querySelector('#msgPanel').classList.contains('open')), true);
eq('right room + message highlighted', await pg.evaluate(id => { const el = document.querySelector('#msgPanel [data-mid="' + id + '"]'); return !!el && el.classList.contains('bub-flash'); }, dm.id), true);
// start-up deep link (app was closed): #msg/<id>
await pg.goto('http://127.0.0.1:8796/index.html?from=push#msg/' + encodeURIComponent(dm.id) + '//'); await pg.waitForTimeout(3000);
eq('cold start opens chat at message', await pg.evaluate(id => !!document.querySelector('#msgPanel.open [data-mid="' + id + '"]'), dm.id), true);
eq('hash cleaned', await pg.evaluate(() => location.hash + location.search), '');
// job link
const code = await pg.evaluate(() => T.prodsAll()[0].code);
await pg.evaluate(c => T.pushNav('#job/' + encodeURIComponent(c)), code); await pg.waitForTimeout(900);
eq('job notification opens job', await pg.evaluate(c => document.body.innerText.indexOf(c) >= 0 && !!document.querySelector('.co-modal.open, #coModal.open, .modal.open, [class*="open"] .mono'), code), true);
// service worker url builder
const sw = fs.readFileSync(root + 'sw.js', 'utf8');
const urlOf = new Function('APP', sw.match(/const enc = encodeURIComponent;[\s\S]*?return APP \+ '\?from=push#' \+ h; };/)[0] + '; return urlOf;')('https://x/');
eq('sw url: direct message', urlOf('msg', { from: 'หมี', code: 'หมี', mid: 'm_1' }), 'https://x/?from=push#msg/m_1/' + encodeURIComponent('u:หมี') + '/' + encodeURIComponent('หมี'));
eq('sw url: team', urlOf('msg', { from: 'หมี', code: 'หมี', mid: 'm_2', team: true }), 'https://x/?from=push#msg/m_2/team/' + encodeURIComponent('หมี'));
eq('sw url: job comment', urlOf('cmt', { code: '69-001' }), 'https://x/?from=push#job/69-001');
// แจ้งเตือนสรุปเช้า → หน้าภาพรวม + หน้าต่างสรุป (ไม่ไปหน้าข้อความ)
await pg.evaluate(() => document.querySelector('#view').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
await pg.evaluate(() => T.pushNav('#digest')); await pg.waitForTimeout(800);
eq('digest tap → company view + summary window', await pg.evaluate(() => [S.view, !!document.querySelector('#dgView.open .dgv-list li'), document.querySelector('#msgPanel.open') ? 'chat' : 'no chat']), ['flow', true, 'no chat']);
await pg.click('#dgView [data-dgvx]'); await pg.waitForTimeout(400);
eq('sw url: digest + pending', [urlOf('digest', {}), urlOf('pend', null)], ['https://x/?from=push#digest', 'https://x/?from=push#push']);
// รูปผู้ใช้มุมขวาบน → บัญชีของฉัน (ทั้งจากหน้าอื่น และตอนอยู่หน้าตั้งค่าเอง)
for (const v of ['prod', 'settings']) {
  await pg.evaluate(() => document.querySelector('#view').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await pg.keyboard.press('Escape'); await pg.evaluate(v => T.go(v), v); await pg.waitForTimeout(700);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.click('.hero-me'); await pg.waitForTimeout(900);
  eq('avatar → my account (from ' + v + ')', await pg.evaluate(() => { const s = document.querySelector('#s-me'); const r = s && s.getBoundingClientRect(); return [S.view, !!s && r.top < innerHeight && r.bottom > 0]; }), ['settings', true]);
}
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
