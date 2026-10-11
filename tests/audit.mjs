// ตรวจทั้งระบบ: ทุกหน้า × บทบาท × จอคอม/มือถือ × สว่าง/มืด → error, ล้นจอแนวนอน, องค์ประกอบล้นกรอบ, ปุ่มเล็กเกินบนมือถือ
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/audit/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
const PORT = 8810;
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,viewsFor,openMsgPanel,coOpen};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(PORT);
const b = await chromium.launch({ args: ['--no-proxy-server'] });
const issues = []; const add = (ctx, kind, msg) => { const k = ctx + ' | ' + kind + ' | ' + msg; if (!issues.includes(k)) issues.push(k); };
const DEV = { pc: { viewport: { width: 1440, height: 900 } }, pcS: { viewport: { width: 1024, height: 700 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, small: { viewport: { width: 340, height: 700 }, isMobile: true, hasTouch: true } };
const WHO = [['admin', null], ['design', 'ต้น'], ['prod', 'ช่างเอ'], ['stock', 'คลังบี']];
const check = async (pg, ctx, mobile, scope) => {
  const r = await pg.evaluate(([mobile, scope]) => {
    const W = innerWidth, o = { hscroll: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0, wide: [], small: [], clip: [] };
    const desc = e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
    const mn = document.querySelector('main'); if (mn && mn.scrollWidth > mn.clientWidth + 2 && getComputedStyle(mn).overflowX !== 'visible') o.hscroll = o.hscroll || ('main ' + mn.scrollWidth + '/' + mn.clientWidth);
    document.querySelectorAll(scope || 'main *, .tabbar *, .topbar *').forEach(e => {
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || (!scope && cs.position === 'fixed')) return;
      const b = e.getBoundingClientRect(); if (!b.width || !b.height) return;
      if (b.right > W + 2 && !e.closest('[class*="scroll"],.board,.gantt,.qchips,.tabs,.sf-tabs,.tbl-wrap,.table-wrap,.rtable,.dg-ppl,.th-fonts,.co-trk,.ghead,.gwrap,.pm-steps,.cpx,.sp-t,.bar-grid,.chart') && !/scroll|auto/.test(getComputedStyle(e.parentElement).overflowX)) {
        let anc = e.parentElement, scrolled = false; while (anc && anc !== document.body) { if (/auto|scroll|hidden/.test(getComputedStyle(anc).overflowX)) { scrolled = true; break; } anc = anc.parentElement; }
        if (!scrolled) o.wide.push(desc(e) + ' r=' + Math.round(b.right));
      }
      if (mobile && e.matches('button,a,[role=button],input[type=checkbox],select') && !e.closest('.rt,.co-trk,.stg-dots,.bg-pos,label') && (b.width < 26 || b.height < 26)) o.small.push(desc(e) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
      if (e.matches('b,h1,h2,h3,button,.btn,label,small') && e.children.length === 0 && e.scrollWidth > e.clientWidth + 2 && cs.overflow === 'visible' && cs.whiteSpace === 'nowrap') o.clip.push(desc(e));
    });
    o.wide = o.wide.slice(0, 5); o.small = o.small.slice(0, 6); o.clip = o.clip.slice(0, 4); return o;
  }, [mobile, scope || '']);
  if (r.hscroll) add(ctx, 'HSCROLL', 'page width ' + r.hscroll);
  r.wide.forEach(w => add(ctx, 'OVERFLOW', w));
  if (r.small.length) add(ctx, 'SMALL-TAP', r.small.join(' ; '));
  r.clip.forEach(w => add(ctx, 'TEXT-SPILL', w));
};
for (const dk of Object.keys(DEV)) for (const scheme of ['light', 'dark']) for (const [role, who] of WHO) {
  if (scheme === 'dark' && (dk === 'pcS' || dk === 'small') ) continue;
  const c = await b.newContext(Object.assign({ colorScheme: scheme }, DEV[dk])); const pg = await c.newPage(); const ctx0 = dk + '/' + scheme + '/' + role;
  pg.on('pageerror', e => add(ctx0, 'JS-ERROR', e.message.slice(0, 160)));
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g|net::ERR|Failed to load resource/.test(m.text())) add(ctx0, 'CONSOLE', m.text().slice(0, 160)); });
  await pg.addInitScript(() => { try { navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
  await pg.goto('http://127.0.0.1:' + PORT + '/index.html'); await pg.waitForTimeout(800);
  await check(pg, ctx0 + '/login', dk === 'phone' || dk === 'small');
  try {
    if (!who) { await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); } else await pg.click('.who:has-text("' + who + '")');
    await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1400);
  } catch (e) { add(ctx0, 'LOGIN', e.message.slice(0, 120)); await c.close(); continue; }
  await pg.evaluate(() => document.querySelectorAll('.ntf,.coach,.tip-fly').forEach(e => e.remove()));
  const views = await pg.evaluate(() => T.viewsFor(S.user).map(v => v.id));
  for (const v of views) {
    await pg.evaluate(v => { document.querySelectorAll('.ntf').forEach(e => e.remove()); T.go(v); window.scrollTo(0, 0); }, v); await pg.waitForTimeout(700);
    await check(pg, ctx0 + '/' + v, dk === 'phone' || dk === 'small');
    if (scheme === 'light' && role === 'admin') await pg.screenshot({ path: out + dk + '-' + v + '.png', fullPage: false });
  }
  // หน้าต่างลอยที่ใช้บ่อย
  const M = dk === 'phone' || dk === 'small', POP = '#sheet *, .pm *, .modal *, [role=dialog]:not(#msgPanel) *, .co-modal *, #coModal *, #pModal *';
  const shot = async n => { if (scheme === 'light' && role === 'admin') await pg.screenshot({ path: out + dk + '-' + n + '.png' }); };
  const close = async () => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); await pg.evaluate(() => { document.querySelectorAll('[data-pclose],[data-coclose],.sheet-x,[data-act="closesheet"]').forEach(x => { if (x.offsetParent) x.click(); }); }); await pg.waitForTimeout(300); };
  try {
    await pg.evaluate(() => T.go('flow')); await pg.waitForTimeout(600);
    const code = await pg.evaluate(() => { const r = document.querySelector('[data-coopen]'); return r && r.dataset.coopen; });
    if (code) { await pg.evaluate(c => T.coOpen(c), code); await pg.waitForTimeout(900); await check(pg, ctx0 + '/job-detail', M, POP); await shot('jobdetail'); await close(); }
    await pg.evaluate(() => T.openMsgPanel()); await pg.waitForTimeout(900); await check(pg, ctx0 + '/messages', M, '#msgPanel *'); await shot('messages'); await close();
    if (await pg.evaluate(() => T.viewsFor(S.user).some(v => v.id === 'prod'))) { await pg.evaluate(() => T.go('prod')); await pg.waitForTimeout(700); const pc = await pg.$('[data-popen]'); if (pc) { await pc.click(); await pg.waitForTimeout(900); await check(pg, ctx0 + '/prod-job', M, POP); await shot('prodjob'); await close(); } }
    if (await pg.evaluate(() => T.viewsFor(S.user).some(v => v.id === 'stock'))) { await pg.evaluate(() => T.go('stock')); await pg.waitForTimeout(700); const sc = await pg.$('[data-sopen]'); if (sc) { await sc.click(); await pg.waitForTimeout(900); await check(pg, ctx0 + '/stock-item', M, POP); await shot('stockitem'); await close(); } }
  } catch (e) { add(ctx0, 'POPUP-STEP', e.message.slice(0, 140)); }
  if (role !== 'stock') {
    await pg.evaluate(() => T.go(S.user.role === 'prod' ? 'prod' : 'list')); await pg.waitForTimeout(500);
    const fab = await pg.$('.fab:visible'); if (fab) { await fab.click(); await pg.waitForTimeout(700); await check(pg, ctx0 + '/editor', dk === 'phone' || dk === 'small', '#sheet *, .pm *, [role=dialog] *'); if (scheme === 'light' && role === 'admin') await pg.screenshot({ path: out + dk + '-editor.png' }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(400); }
  }
  await c.close();
}
// หน้า Sale
for (const dk of ['pc', 'phone']) { const c = await b.newContext(DEV[dk]); const pg = await c.newPage(); pg.on('pageerror', e => add(dk + '/sale', 'JS-ERROR', e.message.slice(0, 160)));
  await pg.goto('http://127.0.0.1:' + PORT + '/index.html?sale=demo'); await pg.waitForTimeout(1500); await check(pg, dk + '/sale', dk === 'phone'); await c.close(); }
fs.writeFileSync(out + 'issues.txt', issues.join('\n'));
console.log(issues.length + ' issues'); console.log(issues.join('\n'));
await b.close(); srv.close();
