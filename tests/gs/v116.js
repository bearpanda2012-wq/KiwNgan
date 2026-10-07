process.argv[2] = require('path').join(__dirname, '../../backend/Code.gs');
const m = require('./mock.js'); const logs = []; const ol = console.log; console.log = (...a) => logs.push(a.join(' ')); m.ctx.setup(); console.log = ol;
const pin = (logs.join('\n').match(/PIN[^0-9]*(\d{4})/) || [])[1]; const T = m.call('login', { name: 'แอดมิน', pin }).data.token;
const j1 = m.call('saveJob', { job: { code: 'C-1', taskType: 'ทำ CAD', status: 'queue' } }, T).data.job;
const img = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
const ai = m.call('addImage', { jobId: j1.id, thumb: img, full: img }, T); console.log('addImage fileId', ai.ok && !!ai.data.image.fileId, ai.error || '');
const f = m.DRIVE.files[ai.data.image.fileId]; console.log('drive file in', m.DRIVE.folders[f.parent].name, '<', m.DRIVE.folders[m.DRIVE.folders[f.parent].parent].name);
const b = m.call('bootstrap', {}, T).data; console.log('meta fileId', b.images[0].fileId === ai.data.image.fileId, 'rt', b.rt, 'archivedBefore', JSON.stringify(b.archivedBefore));
const j2 = m.call('saveJob', { job: { code: 'C-1', taskType: 'ทำ CAM', status: 'queue' } }, T).data.job;
const ci = m.call('copyImages', { from: j1.id, to: j2.id }, T); console.log('copyImages', ci.ok, ci.data && ci.data.images.length, ci.data && ci.data.images[0].fileId === ai.data.image.fileId);
// delete image on j1: file must stay (shared with j2)
m.call('deleteImage', { id: ai.data.image.id }, T); console.log('shared file kept', !f.trashed);
m.call('deleteImage', { id: ci.data.images[0].id }, T); console.log('file trashed after last ref', f.trashed);
// archive: make an old done job
const old = m.call('saveJob', { job: { code: 'OLD-1', taskType: 'ทำ CAD', status: 'done', finishedAt: '2024-01-05T10:00' } }, T).data.job;
const n = m.ctx.archiveOld(12); console.log('archived', JSON.stringify(n));
const b2 = m.call('bootstrap', {}, T).data; console.log('old gone from main', !b2.jobs.some(j => j.code === 'OLD-1'), 'archivedBefore', b2.archivedBefore, 'others kept', b2.jobs.length);
const ar = m.call('archive', {}, T).data; console.log('archive read', ar.jobs.map(j => j.code).join(','));
m.ctx.backupNow(); console.log('backup files', Object.values(m.DRIVE.files).filter(x => /สำรอง/.test(x.name || '')).length);
m.ctx.installTriggers(); console.log('folders', Object.values(m.DRIVE.folders).map(x => x.name).join(' | '));
// legacy image migration
m.call('saveSettings', { settings: Object.assign(b.settings) }, T);
const sh = m.sheets.Images; const head = ['id','jobId','createdBy','createdAt','thumb','f0']; sh.appendRow(['i_legacy', j2.id, 'แอดมิน', '2026-10-01T10:00:00', img, img, '', '', '', '', '', '', '', '']);
const ol2 = console.log; console.log = (...a) => ol2('[gs]', ...a); m.ctx.migrateImagesToDrive(); console.log = ol2;
const lg = m.call('bootstrap', {}, T).data.images.find(x => x.id === 'i_legacy'); console.log('legacy migrated', !!lg.fileId);
