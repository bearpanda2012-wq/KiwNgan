const { chromium } = await import(process.env.PW);
import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = createServer((q, r) => { let p = join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml' }[extname(p)] || 'application/octet-stream' }); let body = readFileSync(p); if (p.endsWith('config.js')) body = 'window.KIWNGAN_CONFIG = {};'; if (p.endsWith('app.js')) body = body.toString().replace('window.KiwNgan = {', 'window.T={saveEditor:()=>0,go,moveJob,isCam,nextOf,jobById,uploadImages,imgsOf,closeLightbox,openEditor,openMsgPanel,renderMsgPanel,closeMsgPanel,$};window.S=S;window.M=M;window.KiwNgan = {'); r.end(body); }).listen(8765);
const b = await chromium.launch({ args: ['--no-proxy-server'] }); const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.addInitScript(() => { navigator.serviceWorker && (navigator.serviceWorker.register = () => Promise.resolve()); });
await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(800); console.log('EARLY', errs.join(' | ')); await pg.screenshot({path: new URL('out/early.png', import.meta.url).pathname}); console.log(await pg.evaluate(()=>document.body.innerText.slice(0,300)), await pg.evaluate(()=>typeof T));
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter');
await pg.waitForTimeout(1200);
await pg.evaluate(() => T.go('board')); await pg.waitForTimeout(900);
await pg.screenshot({ path: new URL('out/board.png', import.meta.url).pathname });
// numbers/colors
console.log('qno count', await pg.locator('.card .qno').count(), 'tchips', await pg.locator('.card .tchip').count());
// CAM skip: find a CAM job in doing
const res = await pg.evaluate(async () => {
  let j = S.jobs.find(x => x.status === 'doing' && T.isCam(x)) || S.jobs.find(x => x.status === 'doing');
  j.taskType = 'ทำ CAM'; const before = T.nextOf(j); await T.moveJob(j.id, 'review'); return { before, after: T.jobById(j.id).status };
});
console.log('CAM', JSON.stringify(res));
const res2 = await pg.evaluate(async () => { const j = S.jobs.find(x => x.status === 'doing' && !T.isCam(x)); await T.moveJob(j.id, 'review'); return T.jobById(j.id).status; });
console.log('CAD to review ->', res2);
// add image to a job via demo api so hover has image
await pg.evaluate(async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#e67'; x.fillRect(0,0,400,300); x.fillStyle='#fff'; x.font='60px sans-serif'; x.fillText('PANEL',80,170); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const f = new File([blob], 'a.png', { type: 'image/png' }); const j = S.jobs.find(x => x.status === 'queue'); await T.uploadImages(j.id, [f, f]); window.__jid = j.id; });
await pg.waitForTimeout(800);
const jid = await pg.evaluate(() => window.__jid);
await pg.hover(`.card[data-open="${jid}"] .code`); await pg.waitForTimeout(700);
await pg.screenshot({ path: new URL('out/hover.png', import.meta.url).pathname });
// move into hovercard and click main image
const box = await pg.locator('#hovercard .hv-main').boundingBox();
console.log('hv-main', !!box);
await pg.mouse.move(box.x + 20, box.y + 20, { steps: 8 }); await pg.waitForTimeout(400);
console.log('still shown', await pg.evaluate(() => T.$('#hovercard').classList.contains('show')));
await pg.click('#hovercard .hv-main'); await pg.waitForTimeout(500);
console.log('lightbox open', await pg.evaluate(() => !!(S.lb && T.$('#lightbox').classList.contains('open'))));
await pg.evaluate(() => T.closeLightbox());
// new job editor with drop
await pg.evaluate(() => T.openEditor()); await pg.waitForTimeout(400);
await pg.fill('#e-code', 'TEST-001');
const dt = await pg.evaluateHandle(async () => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#39c'; x.fillRect(0,0,300,300); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const d = new DataTransfer(); d.items.add(new File([blob], 'b.png', { type: 'image/png' })); return d; });
await pg.dispatchEvent('#eDrop', 'dragover', { dataTransfer: dt });
await pg.dispatchEvent('#eDrop', 'drop', { dataTransfer: dt });
await pg.waitForTimeout(400);
console.log('pending', await pg.evaluate(() => S.edit.pending.length), 'code kept', await pg.inputValue('#e-code'));
await pg.screenshot({ path: new URL('out/editor.png', import.meta.url).pathname });
await pg.click('#sheetFoot [data-act="save"]'); await pg.waitForTimeout(1500);
console.log('new job imgs', await pg.evaluate(() => { const j = S.jobs.find(x => x.code === 'TEST-001'); return j ? T.imgsOf(j.id).length : -1; }));
// optimistic edit of existing job
const ot = await pg.evaluate(async () => { const j = S.jobs.find(x => x.status === 'queue'); T.openEditor(j.id); return j.id; });
await pg.waitForTimeout(300); await pg.click('[data-act="editmode"]'); await pg.waitForTimeout(200);
await pg.fill('#e-title', 'แก้ชื่อเร็ว'); const t0 = Date.now(); await pg.click('#sheetFoot [data-act="save"]');
console.log('editor closed', await pg.evaluate(() => !S.edit), 'title', await pg.evaluate(id => T.jobById(id).title, ot));
await pg.waitForTimeout(400);
// emoji
await pg.evaluate(() => T.openMsgPanel('team')); await pg.waitForTimeout(500);
await pg.fill('#msgText', 'สวัสดี '); await pg.click('#emoBtn'); await pg.waitForTimeout(200);
await pg.screenshot({ path: new URL('out/emoji.png', import.meta.url).pathname });
await pg.click('#emoPop [data-emotab="2"]'); await pg.click('#emoPop .emo-grid button >> nth=0');
console.log('text', await pg.inputValue('#msgText'));
await pg.evaluate(() => T.renderMsgPanel());
console.log('draft kept after rerender', await pg.inputValue('#msgText'));
await pg.press('#msgText', 'Enter'); await pg.waitForTimeout(600);
console.log('last msg', await pg.evaluate(() => M.list[M.list.length - 1].text), '| box', JSON.stringify(await pg.inputValue('#msgText')));
await pg.evaluate(() => { T.closeMsgPanel(); T.go('list'); }); await pg.waitForTimeout(600); await pg.screenshot({ path: new URL('out/list.png', import.meta.url).pathname });
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(600);
console.log('type color inputs', await pg.locator('[data-d$=".color"][data-d^="taskTypes"]').count());
console.log(errs.join('\n') || 'no errors');
await b.close(); srv.close();
