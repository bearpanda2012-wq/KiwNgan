const fs = require('fs'), crypto = require('crypto');
let reads = 0;
function mkSheet(name) {
  const data = []; // rows of arrays
  const sh = {
    name, data,
    getLastRow: () => { let n = data.length; while (n > 0 && !(data[n - 1] || []).some(v => v !== '' && v != null)) n--; return n; }, getLastColumn: () => data[0] ? data[0].length : 0, getMaxRows: () => 1000,
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues() { reads++; const out = []; for (let i = 0; i < nr; i++) { const row = data[r - 1 + i] || []; out.push(Array.from({ length: nc }, (_, k) => row[c - 1 + k] ?? '')); } return out; },
        getDisplayValues() { return this.getValues().map(r => r.map(String)); },
        getDisplayValue() { return String(this.getValues()[0][0]); },
        setValues(v) { for (let i = 0; i < v.length; i++) { data[r - 1 + i] = data[r - 1 + i] || []; for (let k = 0; k < v[i].length; k++) data[r - 1 + i][c - 1 + k] = v[i][k]; } return this; },
        setValue(v) { return this.setValues([[v]]); }, clearContent() { for (let i = 0; i < nr; i++) for (let k = 0; k < nc; k++) { if (data[r - 1 + i]) data[r - 1 + i][c - 1 + k] = ''; } return this; },
        setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }
      };
    },
    setFrozenRows() {}, hideColumns() {}, deleteRow(r) { data.splice(r - 1, 1); }, appendRow(v) { data.push(v.slice()); }
  };
  return sh;
}
const sheets = {};
const DRIVE = { files: {}, folders: {}, n: 0 };
function mkFolder(name, parent) { const id = 'fold' + (++DRIVE.n); const f = { id, name, parent, trashed: false,
  getId: () => id, getName: () => name, getUrl: () => 'https://drive/' + id, isTrashed: () => f.trashed,
  getFoldersByName: n => iter(Object.values(DRIVE.folders).filter(x => x.parent === id && x.name === n)),
  createFolder: n => mkFolder(n, id), createFile: blob => mkFile(blob.name, id, blob),
  getFilesByType: t => iter(Object.values(DRIVE.files).filter(x => x.parent === id && x.type === t)),
  getFiles: () => iter(Object.values(DRIVE.files).filter(x => x.parent === id)) }; DRIVE.folders[id] = f; return f; }
function mkFile(name, parent, blob, type) { const id = 'file' + (++DRIVE.n); const f = { id, name, parent, blob, type: type || 'image', trashed: false, created: Date.now(),
  getId: () => id, getName: () => name, setSharing() {}, setTrashed(v) { f.trashed = v; }, moveTo(fd) { f.parent = fd.getId(); },
  getParents: () => iter(f.parent ? [DRIVE.folders[f.parent]] : []), makeCopy: (n, fd) => mkFile(n, fd.getId(), null, 'sheet'), getDateCreated: () => new Date(f.created) }; DRIVE.files[id] = f; return f; }
function iter(a) { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; }
const ROOTF = mkFolder('My Drive', null); const PROJ = mkFolder('KiwNgan – Royal', ROOTF.id);
DRIVE.files['SSID'] = { id: 'SSID', parent: PROJ.id, getId: () => 'SSID', getParents: () => iter([PROJ]), moveTo(fd) { this.parent = fd.getId(); }, makeCopy: (n, fd) => mkFile(n, fd.getId(), null, 'sheet') };
global.DriveApp = { getFileById: id => { const f = DRIVE.files[id]; if (!f) throw new Error('no file'); return f; }, getFolderById: id => { const f = DRIVE.folders[id]; if (!f) throw new Error('no folder'); return f; },
  createFolder: n => mkFolder(n, ROOTF.id), getRootFolder: () => ROOTF, Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 } };
global.MimeType = { GOOGLE_SHEETS: 'sheet' };
global.ScriptApp = { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ inTimezone: () => ({ create() {} }) }) }) }) }) };
global.UrlFetchApp = { fetch() { return {}; }, fetchAll: () => [] };
const ARCH = {}; 
const ss = { getId: () => 'SSID', getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)), getSpreadsheetTimeZone: () => 'Asia/Bangkok' };
const cacheStore = {}, props = {};
const cache = {
  get: k => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { if (String(v).length > 100000) throw new Error('too big'); cacheStore[k] = String(v); },
  remove: k => { delete cacheStore[k]; }, getAll: ks => { const o = {}; ks.forEach(k => { if (k in cacheStore) o[k] = cacheStore[k]; }); return o; },
  putAll: (o) => Object.keys(o).forEach(k => cache.put(k, o[k]))
};
function mkSs(id) { const shs = {}; return { getId: () => id, getSheetByName: n => shs[n] || null, insertSheet: n => (shs[n] = mkSheet(n)), _s: shs }; }
global.SpreadsheetApp = { getActiveSpreadsheet: () => ss, openById: id => { if (id === 'SSID') return ss; return ARCH[id] || (ARCH[id] = mkSs(id)); }, create: n => { const f = mkFile(n, ROOTF.id, null, 'sheet'); ARCH[f.id] = mkSs(f.id); return ARCH[f.id]; } };
global.CacheService = { getScriptCache: () => cache };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) };
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
global.Logger = { log: (...a) => console.log('[log]', ...a) };
global.ContentService = { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } };
global.Utilities = {
  computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => b > 127 ? b - 256 : b),
  base64Encode: b => Buffer.from(b.map(x => x & 255)).toString('base64'),
  base64EncodeWebSafe: b => Buffer.from(b.map(x => x & 255)).toString('base64url'),
  getUuid: () => crypto.randomUUID(), formatDate: (d, tz, f) => { const z = new Date(d.getTime() + 7 * 3600e3).toISOString(); return f.indexOf('HH') >= 0 ? z.slice(0, 19) : z.slice(0, 10); },
  sleep: () => {}, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, newBlob: (s, type, name) => ({ name, type, getBytes: () => Array.from(Buffer.from(s)) }), base64Decode: b => Array.from(Buffer.from(b, 'base64'))
};
const src = fs.readFileSync(process.argv[2], 'utf8');
const ctx = new Function(src + '\nreturn { doPost, setup, archiveOld, backupNow, installTriggers, migrateImagesToDrive, morningReminders };')();
const call = (action, payload, token) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).t);
module.exports = { DRIVE, ARCH, ctx, call, sheets, cacheStore, props, reads: () => reads, resetReads: () => { reads = 0; } };
