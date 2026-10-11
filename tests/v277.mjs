// v2.77: แบนเนอร์บน/เมนูซ้ายตั้งสี-โปร่งแสงได้ · พื้นหลังภาพนิ่ง/เคลื่อนไหว/ลิงก์ออนไลน์ · เลื่อนลำดับผู้ใช้
const { chromium } = await import(process.env.PW);
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
const root = new URL('..', import.meta.url).pathname, out = new URL('out/', import.meta.url).pathname; fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(out + 'bgv.webm')) try { execSync('ffmpeg -loglevel error -y -f lavfi -i testsrc=size=320x180:rate=15 -t 2 -c:v libvpx-vp9 -b:v 200k ' + out + 'bgv.webm'); } catch (e) {}   // chromium ของ playwright ไม่มี H.264
if (!fs.existsSync(out + 'bga.gif')) fs.writeFileSync(out + 'bga.gif', Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64'));
const srv = http.createServer((q, r) => { let p = path.join(root, q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } let b = fs.readFileSync(p); if (p.endsWith('config.js')) b = 'window.KIWNGAN_CONFIG={}'; if (p.endsWith('app.js')) b = b.toString().replace('window.KiwNgan = {', 'window.T={go,bgUrlKind,bgActive,getTheme};window.S=S;window.KiwNgan = {'); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.mp4': 'video/mp4', '.webm': 'video/webm', '.gif': 'image/gif' }[path.extname(p)] || 'application/octet-stream' }); r.end(b); }).listen(8799);
const b = await chromium.launch({ args: ['--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const eq = (lbl, a, w) => { const p = JSON.stringify(a) === JSON.stringify(w); p ? ok++ : bad++; console.log((p ? 'ok  ' : 'FAIL') + ' ' + lbl + (p ? '' : ' → got ' + JSON.stringify(a) + ' want ' + JSON.stringify(w))); };
await pg.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); } catch (e) {} });
await pg.goto('http://127.0.0.1:8799/index.html'); await pg.waitForTimeout(700);
await pg.click('[data-act="adminon"]'); await pg.fill('#adminName', 'แอดมิน'); await pg.fill('#pinIn', '1234'); await pg.dispatchEvent('#pinIn', 'input'); await pg.press('#pinIn', 'Enter'); await pg.waitForTimeout(1200);
const clean = () => pg.evaluate(() => document.querySelectorAll('.ntf').forEach(e => e.remove()));
await clean(); await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(900);
const attr = n => pg.evaluate(n => document.documentElement.getAttribute(n), n);

// ---- 1. แบนเนอร์บน / เมนูซ้าย
eq('bar cards (header + sidebar)', await pg.locator('#s-theme .bar-card').count(), 2);
eq('default: no custom bar attrs', [await attr('data-hdx'), await attr('data-rlx')], [null, null]);
await pg.evaluate(() => { const a = document.querySelector('#hdC1'), b = document.querySelector('#hdC2'); a.value = '#B91C1C'; b.value = '#7C3AED'; a.dispatchEvent(new Event('change', { bubbles: true })); });
await pg.waitForTimeout(200);
eq('header custom color applied', await pg.evaluate(() => [document.documentElement.hasAttribute('data-hdx'), /185, 28, 28|0\.72549\d* 0\.1098/.test(getComputedStyle(document.querySelector('.topbar')).backgroundImage), T.getTheme().hdc]), [true, true, 'custom']);
eq('dark colors keep white text', await attr('data-hdtext'), null);
await pg.evaluate(() => { const a = document.querySelector('#hdC1'), b = document.querySelector('#hdC2'); a.value = '#FDE68A'; b.value = '#FBCFE8'; a.dispatchEvent(new Event('change', { bubbles: true })); });
await pg.waitForTimeout(200);
eq('light colors → dark text automatically', [await attr('data-hdtext'), await pg.evaluate(() => getComputedStyle(document.querySelector('.topbar h1')).color)], ['dark', 'rgb(16, 32, 43)']);
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="hdg"]'); r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); });
eq('header transparency + blur', await pg.evaluate(() => [document.documentElement.style.getPropertyValue('--hdo'), getComputedStyle(document.querySelector('.topbar')).backdropFilter]), ['60%', 'blur(12px)']);
await pg.click('[data-themeset="hdt"][data-val="light"]'); await pg.waitForTimeout(300);
eq('text override: white', await attr('data-hdtext'), 'light');
await pg.click('[data-barcol="hd"]'); await pg.waitForTimeout(300);
eq('header back to theme colors (keeps transparency)', await pg.evaluate(() => [T.getTheme().hdc, document.documentElement.style.getPropertyValue('--hd1'), document.documentElement.hasAttribute('data-hdx')]), ['theme', '', true]);
// เมนูซ้าย
await pg.evaluate(() => { const a = document.querySelector('#rlC1'), b = document.querySelector('#rlC2'); a.value = '#0F766E'; b.value = '#1E3A8A'; a.dispatchEvent(new Event('change', { bubbles: true })); });
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="rlg"]'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForTimeout(200);
eq('sidebar color + transparency', await pg.evaluate(() => { const bg = getComputedStyle(document.querySelector('.rail')).backgroundImage; return [/15, 118, 110|0\.0588\d* 0\.4627/.test(bg), document.documentElement.style.getPropertyValue('--rlo')]; }), [true, '70%']);
await pg.click('[data-themeset="sidebar"][data-val="plain"]'); await pg.waitForTimeout(300);
eq('plain sidebar: semi-transparent surface', await pg.evaluate(() => /rgba?\(.*0\.7\)|color\(srgb.* \/ 0\.7\)/.test(getComputedStyle(document.querySelector('.rail')).backgroundColor)), true);
await pg.click('[data-themeset="sidebar"][data-val="gradient"]'); await pg.waitForTimeout(200);
await pg.screenshot({ path: out + 'v277-bars.png' });
await pg.locator('#s-theme .th-grp').first().screenshot({ path: out + 'v277-barcards.png' });

// ---- 2. พื้นหลัง
eq('url kinds', await pg.evaluate(() => ['https://youtu.be/dQw4w9WgXcQ', 'https://giphy.com/gifs/cat-happy-ICOgUNjpvO0PC', 'https://x.com/a.mp4', 'https://x.com/a.jpg', 'http://x.com/a.jpg'].map(u => { const k = T.bgUrlKind(u); return k ? k.kind + (k.anim ? '*' : '') + (k.id || (k.kind === 'img' && /giphy/.test(k.url) ? ':' + k.url.split('/')[4] : '')) : null; })),
  ['yt*dQw4w9WgXcQ', 'img*:ICOgUNjpvO0PC', 'vid*', 'img', null]);
await pg.click('[data-bgtab="anim"]'); await pg.waitForTimeout(300);
eq('animated presets listed', await pg.locator('.bg-fxs button').count(), 7);
await pg.click('[data-bgfx="waves"]'); await pg.waitForTimeout(400);
eq('preset applied as layer', await pg.evaluate(() => [!!document.querySelector('#bgLayer .bgfx.fx-waves'), document.documentElement.getAttribute('data-bg'), getComputedStyle(document.querySelector('#bgLayer .fx-waves i')).animationName]), [true, 'on', 'fxWave']);
await pg.evaluate(() => { const r = document.querySelector('[data-thrange="bgdimv"]'); r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); });
eq('slider does not rebuild layer', await pg.evaluate(() => { const el = document.querySelector('#bgLayer'); el.dataset.mark = '1'; const r = document.querySelector('[data-thrange="bgbri"]'); r.value = 110; r.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelector('#bgLayer').dataset.mark; }), '1');
await pg.screenshot({ path: out + 'v277-waves.png' });
await pg.fill('#bgUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'); await pg.click('[data-act="bgurl"]'); await pg.waitForTimeout(500);
eq('YouTube link → muted looping embed', await pg.evaluate(() => { const f = document.querySelector('#bgLayer iframe'); return f ? /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*mute=1.*loop=1/.test(f.src) : false; }), true);
eq('settings shows current', await pg.evaluate(() => document.querySelector('.bg-cur small').textContent.indexOf('YouTube') >= 0), true);
eq('youtube embed has js api (for sound)', await pg.evaluate(() => /enablejsapi=1/.test(document.querySelector('#bgLayer iframe').src)), true);
eq('sound off by default + floating speaker', await pg.evaluate(() => [document.querySelector('[data-bgsound]').getAttribute('aria-pressed'), !!document.querySelector('#bgSndBtn'), document.querySelector('#bgSndBtn').className]), ['false', true, '']);
await pg.click('.bg-cur [data-bgsound]'); await pg.waitForTimeout(300);
eq('sound on → volume slider + speaker on', await pg.evaluate(() => [T.getTheme().bgsound, !!document.querySelector('[data-thrange="bgvol"]'), document.querySelector('#bgSndBtn').className]), [true, true, 'on']);
await pg.click('#bgSndBtn'); await pg.waitForTimeout(300);
eq('floating speaker mutes', await pg.evaluate(() => [T.getTheme().bgsound, document.querySelector('#bgSndBtn').className]), [false, '']);
// วิดีโอจากเครื่อง
if (fs.existsSync(out + 'bgv.webm')) {
  await pg.setInputFiles('#bgVidIn', out + 'bgv.webm'); await pg.waitForTimeout(2500);
  eq('video file → video layer', await pg.evaluate(() => { const v = document.querySelector('#bgLayer video'); return [!!v, v && v.muted, v && v.loop, T.getTheme().bgsrc]; }), [true, true, true, 'file']);
  await pg.click('.bg-cur [data-bgsound]'); await pg.waitForTimeout(500);
  eq('video sound on → unmuted', await pg.evaluate(() => [document.querySelector('#bgLayer video').muted, Math.round(document.querySelector('#bgLayer video').volume * 100)]), [false, 60]);
  await pg.evaluate(() => { const r = document.querySelector('[data-thrange="bgvol"]'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
  eq('volume slider live', await pg.evaluate(() => Math.round(document.querySelector('#bgLayer video').volume * 100)), 30);
  await pg.click('#bgSndBtn'); await pg.waitForTimeout(300);
  eq('mute from floating button', await pg.evaluate(() => document.querySelector('#bgLayer video').muted), true);
  await pg.reload(); await pg.waitForTimeout(2200);
  eq('video survives reload', await pg.evaluate(() => !!document.querySelector('#bgLayer video') && /^blob:/.test(document.querySelector('#bgLayer video').src)), true);
  await clean(); await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800);
}
// GIF คงความเคลื่อนไหว (ไม่ถูกแปลงเป็น JPG)
await pg.click('[data-bgtab="anim"]'); await pg.waitForTimeout(300);
await pg.setInputFiles('#bgVidIn', out + 'bga.gif'); await pg.waitForTimeout(1500);
eq('gif kept as gif', await pg.evaluate(() => [document.documentElement.getAttribute('data-bgk'), document.querySelector('.bg-cur small').textContent.indexOf('GIF') >= 0, !document.querySelector('#bgLayer')]), ['img', true, true]);
await pg.click('[data-act="bgremove"]'); await pg.waitForTimeout(500);
eq('remove → no background', await pg.evaluate(() => [document.documentElement.getAttribute('data-bg'), !!document.querySelector('#bgLayer'), T.bgActive()]), [null, false, null]);
await pg.click('[data-bgtab="img"]'); await pg.waitForTimeout(300);
eq('still-image tab: file + random + link', await pg.evaluate(() => [!!document.querySelector('#bgIn'), !!document.querySelector('[data-act="bgrand"]'), !!document.querySelector('#bgUrl')]), [true, true, true]);
await pg.click('[data-bgfx]').catch(() => {});
await pg.locator('#s-theme .bg-pick2').screenshot({ path: out + 'v277-bg.png' });

// ---- 3. เลื่อนลำดับผู้ใช้
await pg.evaluate(() => document.querySelector('#s-users').scrollIntoView()); await pg.waitForTimeout(300);
const names = () => pg.evaluate(() => [...document.querySelectorAll('.ulist [data-urow] [data-u="name"]')].map(i => i.value));
const n0 = await names();
eq('move buttons on each user', await pg.locator('.ulist [data-urow] .umove').count(), n0.length);
eq('first up / last down disabled', await pg.evaluate(() => { const r = document.querySelectorAll('.ulist .umove'); return [r[0].querySelector('[data-dir="-1"]').disabled, r[r.length - 1].querySelector('[data-dir="1"]').disabled]; }), [true, true]);
await pg.click('.ulist [data-urow]:nth-child(2) [data-dir="1"]'); await pg.waitForTimeout(300);
const n1 = await names();
eq('second user moved down', [n1[1], n1[2]], [n0[2], n0[1]]);
await pg.click('.ulist [data-urow]:nth-child(3) [data-dir="-1"]'); await pg.click('.ulist [data-urow]:nth-child(2) [data-dir="-1"]'); await pg.waitForTimeout(1800);
const n2 = await names();
eq('moved up twice → now first', [n2[0], n2[1]], [n0[1], n0[0]]);
await pg.reload(); await pg.waitForTimeout(1800); await clean(); await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(900);
eq('order saved (after reload)', (await names()).slice(0, 3), n2.slice(0, 3));
await pg.evaluate(() => T.go('team')); await pg.waitForTimeout(800);
eq('order used elsewhere (S.users)', await pg.evaluate(() => S.users.slice(0, 2).map(u => u.name)), n2.slice(0, 2));
await pg.evaluate(() => T.go('settings')); await pg.waitForTimeout(800);
await pg.evaluate(() => document.querySelector('#s-users').scrollIntoView()); await pg.waitForTimeout(300);
await pg.locator('#s-users').screenshot({ path: out + 'v277-users.png' });
console.log(ok + ' ok, ' + bad + ' failed'); console.log('errors', errs.length ? errs : 'none');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
