/* KiwNgan · ห้องเกม (โหลดเมื่อเปิดใช้เท่านั้น ไม่ทำให้แอปหนัก)
   เล่นได้ทั้งเป็นกลุ่ม (ทั้งทีม) และแบบคู่ (แชทตัวต่อตัว) ทุกเกม · คนเปิดห้อง = เจ้าของสถานะเกม (host)
   ส่งผ่านช่องเรียลไทม์ที่เข้ารหัสของแอป (KN_G.send) · ไม่มีเรียลไทม์ (โหมดทดลอง) เล่นกับบอทได้ */
(function () {
  'use strict';
  const B = window.KN_G; if (!B || window.KNGames) return;
  const esc = B.esc, $ = s => document.querySelector(s);
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const now = () => Date.now();

  /* ---------------- เกม ---------------- */
  const RPS = { r: ['✊', 'ค้อน'], p: ['✋', 'กระดาษ'], s: ['✌️', 'กรรไกร'] }, BEAT = { r: 's', p: 'r', s: 'p' };
  const MEM_EMO = ['🐻', '🐼', '🦊', '🐸', '🐵', '🐯', '🦁', '🐷', '🐙', '🦄', '🍉', '🍩'];
  const GAMES = {
    rps: {
      name: 'เป่ายิ้งฉุบ', emoji: '✊', desc: 'ออกพร้อมกันทุกคน ชนะใครได้คนละ 1 แต้ม · 5 รอบ', min: 2, max: 10,
      init: () => ({ round: 1, max: 5, picks: {}, last: null }),
      act(room, who, a, ctx) {
        const g = room.g; if (!RPS[a.pick] || g.picks[who]) return;
        g.picks[who] = a.pick;
        const live = act(room); if (!live.every(p => g.picks[p.n])) return;
        const gain = {}; live.forEach(p => { gain[p.n] = 0; live.forEach(q => { if (q !== p && BEAT[g.picks[p.n]] === g.picks[q.n]) gain[p.n]++; }); });
        live.forEach(p => { p.s += gain[p.n]; });
        g.last = { picks: Object.assign({}, g.picks), gain }; g.picks = {}; g.round++;
        if (g.round > g.max) ctx.end();
      },
      hide(g, me) { const p = {}; Object.keys(g.picks).forEach(k => { p[k] = k === me ? g.picks[k] : '?'; }); return Object.assign({}, g, { picks: p }); },
      bot(room, bot, ctx) { if (!room.g.picks[bot]) ctx.later(600 + rnd(1400), () => ctx.act(bot, { pick: 'rps'[rnd(3)] }), 'bot' + bot); },
      view(room, me) {
        const g = room.g, mine = g.picks[me];
        return '<div class="gm-sub">รอบ ' + Math.min(g.round, g.max) + ' / ' + g.max + '</div>' +
          (g.last ? '<div class="gm-reveal">' + Object.keys(g.last.picks).map(n => '<span><b>' + RPS[g.last.picks[n]][0] + '</b><small>' + esc(n) + (g.last.gain[n] ? ' +' + g.last.gain[n] : '') + '</small></span>').join('') + '</div>' : '') +
          (room.phase === 'play' ? '<div class="gm-rps">' + Object.keys(RPS).map(k => '<button type="button" data-ga="pick" data-v="' + k + '"' + (mine ? ' disabled' : '') + (mine === k ? ' class="on"' : '') + '><b>' + RPS[k][0] + '</b><small>' + RPS[k][1] + '</small></button>').join('') + '</div>' +
            '<div class="gm-hint">' + (mine ? 'ออก ' + RPS[mine][1] + ' แล้ว · รอ ' + act(room).filter(p => !g.picks[p.n]).map(p => esc(p.n)).join(', ') : 'เลือกที่จะออก (คนอื่นจะไม่เห็นจนกว่าทุกคนออกครบ)') + '</div>' : '');
      },
      done: (room, n) => room.phase === 'play' && !!room.g.picks[n]
    },
    mem: {
      name: 'จับคู่ภาพ', emoji: '🃏', desc: 'ผลัดกันเปิดการ์ด 2 ใบ เจอคู่ได้แต้มและเล่นต่อ', min: 2, max: 6, turn: true,
      init: room => { const n = act(room).length > 3 ? 10 : 8, e = shuffle(MEM_EMO.slice()).slice(0, n); return { cards: shuffle(e.concat(e)), open: [], done: {}, turn: 0, lock: false, cols: n > 8 ? 5 : 4 }; },
      act(room, who, a, ctx) {
        const g = room.g, i = +a.flip; if (g.lock || cur(room) !== who || !(i >= 0 && i < g.cards.length) || g.done[i] !== undefined || g.open.indexOf(i) >= 0) return;
        g.open.push(i); ctx.turnTimer();
        if (g.open.length < 2) return;
        const [x, y] = g.open;
        if (g.cards[x] === g.cards[y]) {
          g.done[x] = g.done[y] = who; g.open = []; pl(room, who).s++;
          if (Object.keys(g.done).length === g.cards.length) ctx.end();
        } else { g.lock = true; ctx.later(1100, () => { g.open = []; g.lock = false; next(room); ctx.turnTimer(); }); }
      },
      skip(room) { room.g.open = []; room.g.lock = false; next(room); },
      hide: g => Object.assign({}, g, { cards: g.cards.map((c, i) => g.done[i] !== undefined || g.open.indexOf(i) >= 0 ? c : '') }),
      bot(room, bot, ctx) {
        const g = room.g; if (g.lock || cur(room) !== bot) return;
        const left = g.cards.map((c, i) => i).filter(i => g.done[i] === undefined && g.open.indexOf(i) < 0);
        // บอทจำได้บ้าง: ถ้าเปิดไปแล้ว 1 ใบ มีโอกาส 50% เลือกคู่ที่ถูก
        let pick = left[rnd(left.length)];
        if (g.open.length === 1 && Math.random() < .5) { const m = left.find(i => g.cards[i] === g.cards[g.open[0]]); if (m !== undefined) pick = m; }
        ctx.later(700 + rnd(500), () => ctx.act(bot, { flip: pick }), 'bot' + bot);
      },
      view(room, me) {
        const g = room.g, my = room.phase === 'play' && cur(room) === me && !g.lock;
        return '<div class="gm-sub">' + (room.phase === 'play' ? (cur(room) === me ? '<b>ตาคุณ</b> เปิดการ์ด 2 ใบ' : 'ตาของ ' + esc(cur(room))) : '') + '</div>' +
          '<div class="gm-mem" style="--c:' + g.cols + '">' + g.cards.map((c, i) => { const d = g.done[i] !== undefined, up = d || g.open.indexOf(i) >= 0; return '<button type="button" class="' + (up ? 'up' : '') + (d ? ' done' : '') + '" data-ga="flip" data-v="' + i + '"' + (my && !up ? '' : ' disabled') + '><span>' + (up ? c : '') + '</span></button>'; }).join('') + '</div>';
      }
    },
    math: {
      name: 'คิดเลขไว', emoji: '⚡', desc: 'ทุกคนแข่งกันตอบ ใครตอบถูกก่อนได้แต้ม · 10 ข้อ', min: 2, max: 12,
      init: () => mathQ({ qn: 1, max: 10 }),
      start(room, ctx) { ctx.later(12000, () => mathReveal(room, ctx), 'q'); },
      act(room, who, a, ctx) {
        const g = room.g, i = +a.pick; if (g.reveal || g.locked[who] || !(i >= 0 && i < 4)) return;
        if (g.choices[i] === g.ans) { pl(room, who).s++; g.winner = who; mathReveal(room, ctx); }
        else { g.locked[who] = i; if (act(room).every(p => g.locked[p.n] !== undefined)) mathReveal(room, ctx); }
      },
      hide: g => g.reveal ? g : Object.assign({}, g, { ans: null }),
      bot(room, bot, ctx) { const g = room.g; if (g.reveal || g.locked[bot] !== undefined || g.botT && g.botT[bot] === g.qn) return; (g.botT = g.botT || {})[bot] = g.qn; const q = g.qn; ctx.later(2200 + rnd(5000), () => { if (room.g.qn !== q) return; ctx.act(bot, { pick: Math.random() < .7 ? room.g.choices.indexOf(room.g.ans) : rnd(4) }); }, 'bot' + bot); },
      view(room, me) {
        const g = room.g, lock = g.locked[me];
        return '<div class="gm-sub">ข้อ ' + g.qn + ' / ' + g.max + '</div><div class="gm-q">' + esc(g.text) + ' = ?</div>' +
          (room.phase === 'play' ? '<div class="gm-ch">' + g.choices.map((c, i) => '<button type="button" data-ga="pick" data-v="' + i + '"' + (g.reveal || lock !== undefined ? ' disabled' : '') + ' class="' + (g.reveal && c === g.ans ? 'ok' : lock === i ? 'bad' : '') + '">' + c + '</button>').join('') + '</div>' : '') +
          '<div class="gm-hint">' + (g.reveal ? (g.winner ? '🎉 ' + esc(g.winner) + ' ตอบถูกก่อน' : 'ไม่มีใครตอบถูก · คำตอบคือ ' + g.ans) : lock !== undefined ? 'ตอบผิด รอข้อถัดไป' : 'แตะคำตอบที่ถูกให้เร็วที่สุด') + '</div>';
      }
    },
    pig: {
      name: 'ทอยเต๋าเสี่ยงดวง', emoji: '🎲', desc: 'ทอยสะสมแต้มในตา จะเก็บหรือเสี่ยงต่อ? ทอยได้ 1 เสียแต้มตานั้น · ถึง 30 ชนะ', min: 2, max: 8, turn: true,
      init: () => ({ turn: 0, pot: 0, die: 0, target: 30, msg: '' }),
      act(room, who, a, ctx) {
        const g = room.g; if (cur(room) !== who) return;
        if (a.roll) {
          g.die = 1 + rnd(6); ctx.turnTimer();
          if (g.die === 1) { g.msg = who + ' ทอยได้ 1 เสียแต้มตานี้'; g.pot = 0; next(room); }
          else { g.pot += g.die; g.msg = who + ' ทอยได้ ' + g.die; }
        } else if (a.hold) {
          const p = pl(room, who); p.s += g.pot; g.msg = who + ' เก็บ ' + g.pot + ' แต้ม'; g.pot = 0; g.die = 0;
          if (p.s >= g.target) return ctx.end();
          next(room); ctx.turnTimer();
        }
      },
      skip(room) { const g = room.g, p = pl(room, cur(room)); if (p) p.s += g.pot; g.pot = 0; g.die = 0; g.msg = 'หมดเวลา เก็บแต้มให้อัตโนมัติ'; next(room); },
      bot(room, bot, ctx) { const g = room.g; if (cur(room) !== bot) return; ctx.later(800 + rnd(600), () => ctx.act(bot, g.pot >= 10 || pl(room, bot).s + g.pot >= g.target ? { hold: 1 } : { roll: 1 }), 'bot' + bot); },
      view(room, me) {
        const g = room.g, my = room.phase === 'play' && cur(room) === me, F = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        return '<div class="gm-sub">' + (room.phase === 'play' ? (my ? '<b>ตาคุณ</b>' : 'ตาของ ' + esc(cur(room))) + ' · ถึง ' + g.target + ' แต้มชนะ' : '') + '</div>' +
          '<div class="gm-die' + (g.die === 1 ? ' bust' : '') + '">' + (g.die ? F[g.die] : '🎲') + '</div><div class="gm-pot">แต้มในตานี้ <b>' + g.pot + '</b></div>' +
          (room.phase === 'play' ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="roll"' + (my ? '' : ' disabled') + '>🎲 ทอย</button><button type="button" class="btn" data-ga="hold"' + (my && g.pot ? '' : ' disabled') + '>เก็บแต้ม</button></div>' : '') +
          '<div class="gm-hint">' + esc(g.msg || 'ทอยได้ 2–6 สะสมต่อ · ทอยได้ 1 เสียแต้มในตา') + '</div>';
      }
    }
  };
  function mathQ(g) {
    const op = '+−×'[rnd(3)]; let a = 2 + rnd(19), b = 2 + rnd(19); if (op === '×') { a = 2 + rnd(11); b = 2 + rnd(11); } if (op === '−' && b > a) [a, b] = [b, a];
    const ans = op === '+' ? a + b : op === '−' ? a - b : a * b, set = new Set([ans]);
    while (set.size < 4) { const d = ans + (rnd(2) ? 1 : -1) * (1 + rnd(op === '×' ? 12 : 6)); if (d >= 0) set.add(d); }
    return Object.assign(g, { text: a + ' ' + op + ' ' + b, ans, choices: shuffle([...set]), locked: {}, winner: '', reveal: false, botT: {} });
  }
  function mathReveal(room, ctx) {
    const g = room.g; if (g.reveal) return; g.reveal = true; ctx.cancel('q');
    ctx.later(1800, () => { if (g.qn >= g.max) return ctx.end(); g.qn++; mathQ(g); ctx.later(12000, () => mathReveal(room, ctx), 'q'); });
  }
  /* ผู้เล่นที่ยังอยู่ · ตาปัจจุบัน */
  const act = room => room.players.filter(p => p.on);
  const pl = (room, n) => room.players.find(p => p.n === n);
  function cur(room) { const a = room.players; if (!a.length) return ''; let t = room.g.turn % a.length, k = 0; while (!a[t].on && k++ < a.length) t = (t + 1) % a.length; room.g.turn = t; return a[t].n; }
  function next(room) { const a = room.players; let t = room.g.turn, k = 0; do { t = (t + 1) % a.length; } while (!a[t].on && ++k < a.length); room.g.turn = t; }

  /* ---------------- ห้อง ---------------- */
  const G = { rooms: {}, view: '', scope: null, timers: {} };
  const me = () => B.me();
  const isHost = room => room.host === me();
  const forMe = to => to === 'team' || (Array.isArray(to) && to.indexOf(me()) >= 0);
  const sameScope = (to, sc) => to === 'team' ? sc === 'team' : Array.isArray(to) && Array.isArray(sc) && to.length === sc.length && sc.every(x => to.indexOf(x) >= 0);
  const send = (room, o) => B.send(Object.assign({ r: room.r, to: room.to }, o));
  function pub(room) {   // host: กระจายสถานะ (ซ่อนข้อมูลที่ยังไม่ควรเห็น)
    room.v = (room.v || 0) + 1; room.at = now();
    const g = GAMES[room.game], hidden = room.g && g.hide && room.phase !== 'end' ? g.hide(room.g, '') : room.g;
    send(room, { t: 'st', room: Object.assign({}, room, { g: hidden }) });
    render(); bots(room);
  }
  function ctxOf(room) {
    const key = k => room.r + ':' + (k || rnd(1e9));
    return {
      end() { room.phase = 'end'; clearAll(room, true); },
      later(ms, fn, k) { const id = key(k); clearTimeout(G.timers[id]); G.timers[id] = setTimeout(() => { delete G.timers[id]; if (!G.rooms[room.r] || room.phase !== 'play') return; fn(); pub(room); }, ms); },
      cancel(k) { const id = key(k); clearTimeout(G.timers[id]); delete G.timers[id]; },
      turnTimer() { const g = GAMES[room.game]; if (!g.skip) return; this.later(25000, () => g.skip(room), 'turn'); },
      act(who, a) { hostAct(room, who, a); }
    };
  }
  function clearAll(room, keepRoom) { Object.keys(G.timers).forEach(k => { if (k.indexOf(room.r + ':') === 0) { clearTimeout(G.timers[k]); delete G.timers[k]; } }); if (!keepRoom) delete G.rooms[room.r]; }
  function hostAct(room, who, a) {
    if (room.phase !== 'play' || !pl(room, who)) return;
    const p = pl(room, who); p.seen = now(); if (!p.on && !p.bot) p.on = true;
    GAMES[room.game].act(room, who, a, ctxOf(room)); pub(room);
  }
  function bots(room) { if (!isHost(room) || room.phase !== 'play') return; const g = GAMES[room.game]; room.players.filter(p => p.bot && p.on).forEach(p => g.bot(room, p.n, ctxOf(room))); }
  function startGame(room) {
    clearAll(room, true);
    room.players.forEach(p => { p.s = 0; }); room.phase = 'play'; room.g = GAMES[room.game].init(room);
    const c = ctxOf(room); if (GAMES[room.game].start) GAMES[room.game].start(room, c); c.turnTimer(); pub(room);
  }
  function create(game, scope) {
    const r = 'g' + now().toString(36) + rnd(1e6).toString(36);
    const room = { r, game, host: me(), to: scope, players: [{ n: me(), s: 0, on: true, seen: now() }], phase: 'lobby', g: null, v: 0 };
    G.rooms[r] = room; G.view = r; pub(room); invite(room); return room;
  }
  function invite(room) { send(room, { t: 'open', game: room.game, host: room.host, n: room.players.length }); room.inv = now(); }
  function leave(room) {
    if (isHost(room)) { send(room, { t: 'close' }); clearAll(room); }
    else { send(room, { t: 'leave', n: me() }); delete G.rooms[room.r]; }
    if (G.view === room.r) G.view = ''; B.roomsChanged(); render();
  }
  /* ---------------- รับข้อความ ---------------- */
  function recv(o) {
    if (!o || !o.r || !forMe(o.to)) return;
    let room = G.rooms[o.r];
    if (o.t === 'st' && o.room) {
      if (room && isHost(room)) return;
      B.seen(o.r, o.room);
      if (!room && G.view !== o.r && o.room.players.every(p => p.n !== me())) return;
      G.rooms[o.r] = o.room; o.room.got = now(); render(); return;
    }
    if (o.t === 'open') { B.seen(o.r, { r: o.r, game: o.game, host: o.host, to: o.to, phase: 'lobby', players: [] }); if (!room) B.invite(o); return; }
    if (o.t === 'close') { if (room && !isHost(room)) { delete G.rooms[o.r]; B.toast('ห้องเกม ' + GAMES[room.game].name + ' ปิดแล้ว'); if (G.view === o.r) G.view = ''; render(); } B.gone(o.r); return; }
    if (!room || !isHost(room)) return;
    const p = pl(room, o.n);
    if (o.t === 'join') {
      if (p) { p.on = true; p.seen = now(); }
      else if (room.phase === 'lobby' && room.players.length < GAMES[room.game].max) room.players.push({ n: o.n, s: 0, on: true, seen: now() });
      else if (room.phase !== 'lobby') room.players.push({ n: o.n, s: 0, on: true, seen: now(), late: 1 });
      pub(room);
    } else if (o.t === 'leave') { if (p) { if (room.phase === 'lobby') room.players.splice(room.players.indexOf(p), 1); else p.on = false; pub(room); } }
    else if (o.t === 'act') hostAct(room, o.n, o.a || {});
    else if (o.t === 'hello' || o.t === 'ping') { if (p) { p.seen = now(); if (!p.on) { p.on = true; pub(room); return; } } if (o.t === 'hello') pub(room); }
  }
  /* host: ส่งสถานะซ้ำเป็นระยะ (เผื่อหลุด) · ผู้เล่นเงียบเกิน 30 วิ = ออกไปแล้ว (ข้ามตา) · คนดู: ping */
  setInterval(() => {
    Object.values(G.rooms).forEach(room => {
      if (isHost(room)) {
        let ch = false; room.players.forEach(p => { if (!p.bot && p.n !== me() && p.on && now() - (p.seen || 0) > 30000) { p.on = false; ch = true; } });
        if (room.phase === 'lobby' && now() - (room.inv || 0) > 20000) invite(room);
        if (ch || now() - (room.at || 0) > 6000) pub(room);
      } else if (pl(room, me())) { send(room, { t: 'ping', n: me() }); if (now() - (room.got || now()) > 40000) { room.lost = true; render(); } }
    });
  }, 5000);

  /* ---------------- หน้าจอ ---------------- */
  function scoreRow(room) {
    const turnName = GAMES[room.game].turn && room.phase === 'play' ? cur(room) : '', done = GAMES[room.game].done;
    const best = room.phase === 'end' ? Math.max(...room.players.map(p => p.s)) : null;
    return '<div class="gm-players">' + room.players.map(p => '<span class="gm-p' + (p.n === turnName ? ' turn' : '') + (p.on ? '' : ' off') + (best !== null && p.s === best ? ' win' : '') + '">' + B.av(p.n) + '<b>' + esc(p.n) + (p.n === room.host ? ' <i title="เจ้าของห้อง">👑</i>' : '') + (done && done(room, p.n) ? ' ✓' : '') + '</b><em>' + p.s + '</em></span>').join('') + '</div>';
  }
  function roomHtml(room) {
    const g = GAMES[room.game], host = isHost(room), meIn = !!pl(room, me()), lobby = room.phase === 'lobby';
    const bestN = room.phase === 'end' ? room.players.filter(p => p.s === Math.max(...room.players.map(x => x.s))).map(p => p.n) : [];
    return '<div class="gm-top"><button type="button" class="icon-btn" data-ga="back" aria-label="กลับ">‹</button><b>' + g.emoji + ' ' + g.name + '</b><small>' + (room.to === 'team' ? 'ทั้งทีม' : 'แบบคู่') + (room.lost ? ' · ขาดการเชื่อมต่อกับเจ้าของห้อง' : '') + '</small><button type="button" class="btn sm" data-ga="leave">' + (host ? 'ปิดห้อง' : 'ออก') + '</button></div>' +
      scoreRow(room) +
      (lobby ? '<div class="gm-lobby"><p>' + esc(g.desc) + '</p><p class="gm-hint">' + room.players.length + ' คนในห้อง · ' + (room.players.length < g.min ? 'รอเพื่อนเข้าร่วม (ส่งคำชวนไปแล้ว)' : 'พร้อมเริ่มแล้ว') + '</p>' +
        (host ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="start"' + (room.players.length >= g.min ? '' : ' disabled') + '>เริ่มเกม</button>' + (room.players.length < g.max ? '<button type="button" class="btn" data-ga="bot">+ เพิ่มบอท</button>' : '') + '<button type="button" class="btn ghost" data-ga="invite">ชวนอีกครั้ง</button></div>'
          : meIn ? '<p class="gm-hint">รอ ' + esc(room.host) + ' กดเริ่มเกม</p>' : '<div class="gm-btns"><button type="button" class="btn primary" data-ga="join">เข้าร่วม</button></div>') + '</div>'
        : '<div class="gm-board">' + g.view(room, me()) + '</div>' +
          (room.phase === 'end' ? '<div class="gm-end">🏆 ' + (bestN.length > 1 ? 'เสมอ: ' : 'ผู้ชนะ: ') + bestN.map(esc).join(', ') + (host ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="again">เล่นอีกครั้ง</button><button type="button" class="btn" data-ga="lobby">เปลี่ยนเกม</button></div>' : '<p class="gm-hint">รอ ' + esc(room.host) + ' เริ่มรอบใหม่</p>') + '</div>' : '') +
          (!meIn ? '<p class="gm-hint">คุณกำลังดูอยู่ · ' + (room.phase === 'play' ? '<button type="button" class="btn sm" data-ga="join">ขอเข้าเล่น</button>' : '') + '</p>' : ''));
  }
  function lobbyHtml() {
    const sc = G.scope, open = B.openRooms(sc);
    return '<div class="gm-top"><b>🎮 ห้องเกม</b><small>' + esc(B.scopeName(sc)) + '</small><button type="button" class="icon-btn" data-ga="x" aria-label="ปิด">✕</button></div>' +
      (!B.live() ? '<div class="gm-note">ตอนนี้ยังไม่ได้เชื่อมต่อแบบเรียลไทม์ — เล่นกับบอทได้ (เพื่อนจะเข้าร่วมได้เมื่อเชื่อมต่อเรียลไทม์)</div>' : '') +
      (open.length ? '<div class="gm-sec">ห้องที่เปิดอยู่</div><div class="gm-open">' + open.map(r => '<button type="button" data-ga="enter" data-v="' + esc(r.r) + '">' + GAMES[r.game].emoji + ' <b>' + GAMES[r.game].name + '</b><small>' + esc(r.host) + (r.players && r.players.length ? ' · ' + r.players.length + ' คน' : '') + (r.phase === 'play' ? ' · กำลังเล่น' : ' · รอผู้เล่น') + '</small></button>').join('') + '</div>' : '') +
      '<div class="gm-sec">เปิดห้องใหม่ ' + (sc === 'team' ? '(ทุกคนในทีมเห็นคำชวน)' : '(ชวนแบบคู่)') + '</div><div class="gm-list">' +
      Object.keys(GAMES).map(k => '<button type="button" data-ga="new" data-v="' + k + '"><span>' + GAMES[k].emoji + '</span><b>' + GAMES[k].name + '</b><small>' + esc(GAMES[k].desc) + '</small><em>' + GAMES[k].min + '–' + GAMES[k].max + ' คน</em></button>').join('') + '</div>';
  }
  function render() {
    const el = $('#gameView'); if (!el || el.hidden) return B.roomsChanged();
    const room = G.view && G.rooms[G.view];
    if (G.view && !room) G.view = '';
    el.querySelector('.gm-card').innerHTML = room ? roomHtml(room) : lobbyHtml();
    B.roomsChanged();
  }
  function open(scope, roomId) {
    G.scope = scope || 'team';
    let el = $('#gameView');
    if (!el) {
      el = document.createElement('div'); el.id = 'gameView'; el.className = 'gm-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'ห้องเกม');
      el.innerHTML = '<div class="gm-card"></div>'; document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el) close(); const b = e.target.closest && e.target.closest('[data-ga]'); if (b && !b.disabled) onClick(b.dataset.ga, b.dataset.v); });
    }
    if (roomId) { G.view = roomId; const r = G.rooms[roomId]; if (!r) { const o = B.known(roomId); if (o) { send(o, { t: 'join', n: me() }); send(o, { t: 'hello', n: me() }); G.rooms[roomId] = Object.assign({ players: [], phase: 'lobby', g: null }, o, { got: now() }); } } }
    el.hidden = false; render();
  }
  function close() { const el = $('#gameView'); if (el) el.hidden = true; }
  function onClick(a, v) {
    const room = G.view && G.rooms[G.view];
    if (a === 'x') return close();
    if (a === 'back') { G.view = ''; return render(); }
    if (a === 'new') return void create(v, G.scope);
    if (a === 'enter') return open(G.scope, v);
    if (!room) return;
    if (a === 'leave') return leave(room);
    if (a === 'join') { send(room, { t: 'join', n: me() }); return; }
    if (a === 'invite') { invite(room); B.toast('ส่งคำชวนอีกครั้งแล้ว'); return; }
    if (isHost(room)) {
      if (a === 'start') return startGame(room);
      if (a === 'again') return startGame(room);
      if (a === 'lobby') { clearAll(room, true); G.view = ''; room.phase = 'end'; send(room, { t: 'close' }); delete G.rooms[room.r]; return render(); }
      if (a === 'bot') { const used = room.players.map(p => p.n); let i = 1; while (used.indexOf('บอท ' + i) >= 0) i++; room.players.push({ n: 'บอท ' + i, s: 0, on: true, bot: true }); return pub(room); }
    }
    const A = a === 'pick' ? { pick: GAMES[room.game] === GAMES.rps ? v : +v } : a === 'flip' ? { flip: +v } : a === 'roll' ? { roll: 1 } : a === 'hold' ? { hold: 1 } : null;
    if (!A) return;
    if (isHost(room)) hostAct(room, me(), A); else send(room, { t: 'act', n: me(), a: A });
  }

  const css = document.createElement('style');
  css.textContent = `
.gm-wrap{position:fixed;inset:0;z-index:130;display:grid;place-items:center;padding:16px;background:rgba(10,14,20,.45);backdrop-filter:blur(3px)}
.gm-wrap[hidden]{display:none}
.gm-card{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--surface,#fff);color:var(--ink,#111);border-radius:20px;box-shadow:0 24px 60px -16px rgba(0,0,0,.45);padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px}
.gm-top{display:flex;align-items:center;gap:8px}.gm-top b{font-size:17px}.gm-top small{color:var(--muted,#667);flex:1;min-width:0}
.gm-note{background:color-mix(in srgb,#F59E0B 14%,var(--surface,#fff));border-radius:12px;padding:9px 12px;font-size:13px}
.gm-sec{font-size:12.5px;font-weight:600;color:var(--muted,#667);margin-top:4px}
.gm-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gm-list button{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"e n" "e d" "e m";column-gap:10px;text-align:left;border:1px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);border-radius:14px;padding:12px;cursor:pointer;color:inherit;font:inherit}
.gm-list button:hover{border-color:var(--brand,#0B6B70)}
.gm-list span{grid-area:e;font-size:30px;line-height:1}.gm-list b{grid-area:n}.gm-list small{grid-area:d;color:var(--muted,#667);font-size:12px;line-height:1.35}.gm-list em{grid-area:m;font-style:normal;font-size:11.5px;color:var(--brand,#0B6B70);margin-top:4px}
.gm-open{display:flex;flex-direction:column;gap:6px}
.gm-open button{display:flex;align-items:center;gap:8px;text-align:left;border:1px solid var(--brand,#0B6B70);background:color-mix(in srgb,var(--brand,#0B6B70) 8%,var(--surface,#fff));border-radius:12px;padding:10px 12px;cursor:pointer;color:inherit;font:inherit}
.gm-open small{color:var(--muted,#667);margin-left:auto}
.gm-players{display:flex;flex-wrap:wrap;gap:6px}
.gm-p{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 4px;border-radius:999px;background:var(--surface-2,#f1f3f5);font-size:13px}
.gm-p .av{width:24px;height:24px;font-size:11px}
.gm-p em{font-style:normal;font-weight:700;color:var(--brand,#0B6B70);min-width:16px;text-align:right}
.gm-p.turn{box-shadow:0 0 0 2px var(--brand,#0B6B70)}.gm-p.off{opacity:.45}.gm-p.win{background:#FEF3C7}
.gm-p i{font-style:normal}
.gm-lobby p{margin:0 0 6px}.gm-hint{color:var(--muted,#667);font-size:13px;text-align:center;margin:0}
.gm-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.gm-board{display:flex;flex-direction:column;gap:10px;align-items:stretch}
.gm-sub{text-align:center;font-size:13.5px;color:var(--muted,#667);min-height:18px}
.gm-rps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.gm-rps button{border:2px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);border-radius:16px;padding:14px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit;color:inherit}
.gm-rps b{font-size:40px;line-height:1}.gm-rps button.on{border-color:var(--brand,#0B6B70);background:color-mix(in srgb,var(--brand,#0B6B70) 12%,var(--surface,#fff))}
.gm-rps button:disabled:not(.on){opacity:.4}
.gm-reveal{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.gm-reveal span{display:flex;flex-direction:column;align-items:center;background:var(--surface-2,#f6f7f9);border-radius:12px;padding:6px 10px}
.gm-reveal b{font-size:26px}.gm-reveal small{font-size:12px}
.gm-mem{display:grid;grid-template-columns:repeat(var(--c),1fr);gap:8px}
.gm-mem button{aspect-ratio:1;border-radius:12px;border:0;background:linear-gradient(135deg,var(--brand,#0B6B70),color-mix(in srgb,var(--brand,#0B6B70) 55%,#7c3aed));cursor:pointer;font-size:min(8vw,34px);display:grid;place-items:center;transition:transform .25s}
.gm-mem button.up{background:var(--surface-2,#f6f7f9);box-shadow:inset 0 0 0 2px var(--line,#e3e6ea);transform:rotateY(180deg)}
.gm-mem button.up span{transform:rotateY(180deg)}
.gm-mem button.done{opacity:.55}
.gm-mem button:disabled{cursor:default}
.gm-q{text-align:center;font-size:40px;font-weight:700;letter-spacing:.02em}
.gm-ch{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gm-ch button{font:700 24px/1 inherit;padding:16px;border-radius:14px;border:2px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);cursor:pointer;color:inherit}
.gm-ch .ok{border-color:#16A34A;background:#DCFCE7;color:#14532D}.gm-ch .bad{border-color:#DC2626;background:#FEE2E2;color:#7F1D1D}
.gm-die{text-align:center;font-size:84px;line-height:1}.gm-die.bust{color:#DC2626}
.gm-pot{text-align:center}.gm-pot b{font-size:22px;color:var(--brand,#0B6B70)}
.gm-end{text-align:center;font-weight:700;font-size:17px;padding:10px;border-radius:14px;background:#FEF3C7;color:#78350F}
@media (max-width:520px){.gm-list{grid-template-columns:1fr}.gm-card{padding:14px}.gm-q{font-size:32px}}
`;
  document.head.appendChild(css);

  window.KNGames = { open, close, recv, rooms: () => G.rooms, _G: G, GAMES };
})();
