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
  /* ---------- เกมชุดที่ 2 ---------- */
  const DRAW_WORDS = ['แมว', 'หมา', 'บ้าน', 'รถยนต์', 'ต้นไม้', 'ดวงอาทิตย์', 'ปลา', 'ช้าง', 'เก้าอี้', 'โต๊ะ', 'ร่ม', 'นาฬิกา', 'แว่นตา', 'กาแฟ', 'ไอศกรีม', 'คอมพิวเตอร์', 'โทรศัพท์', 'จักรยาน', 'เครื่องบิน', 'เรือ', 'ภูเขา', 'ทะเล', 'ดอกไม้', 'หัวใจ', 'ดาว', 'พระจันทร์', 'กล้วย', 'แอปเปิ้ล', 'ไข่', 'ประตู', 'หน้าต่าง', 'บันได', 'ดินสอ', 'กรรไกร', 'ค้อน', 'ไขควง', 'สว่าน', 'เลื่อย', 'หลอดไฟ', 'ปลั๊กไฟ', 'กล่อง', 'รถบรรทุก', 'โรงงาน', 'หมวกกันน็อก', 'ถุงมือ', 'เสื้อ', 'รองเท้า', 'กระเป๋า', 'แพนด้า', 'ไก่', 'เป็ด', 'งู', 'ผีเสื้อ', 'เค้ก', 'พิซซ่า', 'ส้มตำ', 'ฝน', 'รุ้ง', 'กีตาร์', 'ฟุตบอล', 'จรวด', 'ปราสาท', 'หุ่นยนต์', 'แตงโม'];
  const normW = s => String(s || '').toLowerCase().replace(/[\s​.,!?'"]/g, '');
  const C4 = ['#EF4444', '#F59E0B', '#3B82F6', '#22C55E'];
  const PEN_C = ['#111827', '#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#FFFFFF'];
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const d8 = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + ' ' + TH_M[+m[2] - 1] : ''; };
  function fourWin(cells, W, H, i) {
    const v = cells[i], x0 = i % W, y0 = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = [i];
      for (const s of [1, -1]) { let x = x0 + dx * s, y = y0 + dy * s; while (x >= 0 && x < W && y >= 0 && y < H && cells[y * W + x] === v) { line.push(y * W + x); x += dx * s; y += dy * s; } }
      if (line.length >= 4) return line;
    }
    return null;
  }
  const fourRow = (g, c) => { for (let y = g.h - 1; y >= 0; y--) if (g.cells[y * g.w + c] === null) return y; return -1; };
  function bingoCard() {
    const card = [];
    for (let c = 0; c < 5; c++) { const nums = shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5); for (let r = 0; r < 5; r++) card[r * 5 + c] = nums[r]; }
    card[12] = 0; return card;
  }
  function bingoLine(card, marks) {
    const m = i => i === 12 || marks.indexOf(i) >= 0, L = [];
    for (let k = 0; k < 5; k++) { L.push([0, 1, 2, 3, 4].map(x => k * 5 + x)); L.push([0, 1, 2, 3, 4].map(y => y * 5 + k)); }
    L.push([0, 6, 12, 18, 24]); L.push([4, 8, 12, 16, 20]);
    return L.find(l => l.every(m)) || null;
  }
  function bingoCall(room, ctx) {
    const g = room.g, left = []; for (let n = 1; n <= 75; n++) if (g.called.indexOf(n) < 0) left.push(n);
    if (!left.length) return ctx.end();
    g.called.push(left[rnd(left.length)]); g.msg = '';
    ctx.later(G.callMs || 3000, () => bingoCall(room, ctx), 'call');
  }
  function reactGo(room, ctx) { const g = room.g; ctx.later(1800 + rnd(3200), () => { g.ph = 'go'; g.rid++; ctx.later(4000, () => reactEnd(room, ctx), 'end'); }, 'go'); }
  function reactEnd(room, ctx) {
    const g = room.g; if (g.ph === 'res') return; ctx.cancel('end');
    let win = ''; Object.keys(g.res).forEach(n => { if (!win || g.res[n] < g.res[win]) win = n; });
    if (win) pl(room, win).s++;
    g.last = { res: Object.assign({}, g.res), early: Object.assign({}, g.early), win }; g.ph = 'res';
    ctx.later(2400, () => { if (g.round >= g.max) return ctx.end(); g.round++; g.ph = 'wait'; g.res = {}; g.early = {}; reactGo(room, ctx); }, 'nx');
  }
  function drawRound(room, ctx) {
    const g = room.g, hs = g.order.filter(n => pl(room, n) && pl(room, n).on); if (!hs.length) return ctx.end();
    g.drawer = hs[g.ri % hs.length]; const left = DRAW_WORDS.filter(w => g.used.indexOf(w) < 0); g.word = left[rnd(left.length)]; g.used.push(g.word);
    g.strokes = []; g.guessed = {}; g.log = []; g.ph = 'draw'; g.shown = ''; g.ends = now() + 80000;
    ctx.later(80000, () => drawReveal(room, ctx), 'rd');
  }
  function drawReveal(room, ctx) {
    const g = room.g; if (g.ph !== 'draw') return; g.ph = 'reveal'; g.shown = g.word; g.ends = 0; ctx.cancel('rd');
    ctx.later(3200, () => { g.ri++; if (g.ri >= g.rounds) return ctx.end(); drawRound(room, ctx); }, 'nx');
  }
  /* ควิซคิวงาน: สร้างคำถามจากงานจริงในระบบ */
  function quizQ(g, jobs) {
    const kinds = [['assignee', 'ใครเป็นผู้รับผิดชอบงานนี้?'], ['sale', 'Sale ของงานนี้คือใคร?'], ['status', 'งานนี้อยู่ขั้นไหนตอนนี้?'], ['group', 'งานนี้อยู่กลุ่มงานอะไร?'], ['type', 'งานนี้เป็นงานประเภทไหน?']];
    for (let t = 0; t < 40; t++) {
      const k = kinds[rnd(kinds.length)], pool = jobs.filter(j => j[k[0]]), j = pool[rnd(pool.length)];
      if (!j || g.usedJ.indexOf(j.code + k[0]) >= 0) continue;
      const vals = [...new Set(jobs.map(x => x[k[0]]).filter(Boolean))].filter(v => v !== j[k[0]]);
      if (vals.length < 1) continue;
      const ch = shuffle([j[k[0]]].concat(shuffle(vals).slice(0, 3)));
      g.usedJ.push(j.code + k[0]);
      return Object.assign(g, { job: { code: j.code, title: j.title, due: j.due }, text: k[1], choices: ch, ans: j[k[0]], locked: {}, winner: '', reveal: false, botT: {} });
    }
    return null;
  }
  function quizReveal(room, ctx) {
    const g = room.g; if (g.reveal) return; g.reveal = true; ctx.cancel('q');
    ctx.later(2400, () => { if (g.qn >= g.max || !quizQ(g, g.jobs)) return ctx.end(); g.qn++; ctx.later(15000, () => quizReveal(room, ctx), 'q'); });
  }
  /* เรียงคิวด่วน: งานจริงที่มีกำหนดส่ง เรียงจากส่งก่อนไปส่งทีหลัง */
  function sortRound(room, ctx) {
    const g = room.g, pool = g.jobs.filter(j => j.due), dues = [...new Set(pool.map(j => j.due))];
    if (dues.length < 3) return ctx.end();
    const pickD = shuffle(dues).slice(0, Math.min(4, dues.length)), items = pickD.map(d => { const c = pool.filter(j => j.due === d); const j = c[rnd(c.length)]; return { code: j.code, title: j.title, due: j.due }; });
    Object.assign(g, { items: shuffle(items), sub: {}, ph: 'play', ends: now() + 25000, rid: (g.rid || 0) + 1 });
    ctx.later(25000, () => sortEnd(room, ctx), 'q');
  }
  function sortEnd(room, ctx) {
    const g = room.g; if (g.ph !== 'play') return; ctx.cancel('q'); g.ph = 'res'; g.ends = 0;
    const ok = Object.keys(g.sub).filter(n => g.sub[n].ok).sort((a, b) => g.sub[a].ms - g.sub[b].ms);
    ok.forEach((n, i) => { const p = pl(room, n); if (p) p.s += i === 0 ? 2 : 1; });
    g.fast = ok[0] || '';
    ctx.later(3000, () => { if (g.round >= g.max) return ctx.end(); g.round++; sortRound(room, ctx); }, 'nx');
  }
  const sortOk = (items, order) => order.length === items.length && order.every((ix, k) => k === 0 || items[order[k - 1]].due <= items[ix].due);
  const tlOf = room => room.lend || (room.g && room.g.ends) || 0;
  const tlTxt = room => { const t = tlOf(room); return t ? Math.max(0, Math.ceil((t - now()) / 1000)) + ' วิ' : ''; };
  Object.assign(GAMES, {
    quiz: {
      name: 'ควิซคิวงาน', emoji: '📋', desc: 'คำถามจากงานจริงในคิว: ใครรับผิดชอบ Sale คนไหน อยู่ขั้นไหน · แข่งกันตอบ 8 ข้อ', min: 2, max: 12, work: true,
      init: () => { const jobs = B.jobs(); const g = { qn: 1, max: 8, usedJ: [], jobs }; return quizQ(g, jobs) || Object.assign(g, { none: true, choices: [], text: 'ยังมีงานในคิวไม่พอสำหรับทำควิซ', job: {}, locked: {} }); },
      start(room, ctx) { if (room.g.none) return ctx.end(); ctx.later(15000, () => quizReveal(room, ctx), 'q'); },
      act(room, who, a, ctx) {
        const g = room.g, i = +a.pick; if (g.reveal || g.locked[who] !== undefined || !(i >= 0 && i < g.choices.length)) return;
        if (g.choices[i] === g.ans) { pl(room, who).s++; g.winner = who; quizReveal(room, ctx); }
        else { g.locked[who] = i; if (act(room).every(p => g.locked[p.n] !== undefined)) quizReveal(room, ctx); }
      },
      hide: g => Object.assign({}, g, { ans: g.reveal ? g.ans : null, jobs: [], usedJ: [] }),
      bot(room, bot, ctx) { const g = room.g; if (g.reveal || g.locked[bot] !== undefined || (g.botT || {})[bot] === g.qn) return; (g.botT = g.botT || {})[bot] = g.qn; const q = g.qn; ctx.later(3000 + rnd(6000), () => { if (room.g.qn !== q) return; ctx.act(bot, { pick: Math.random() < .5 ? room.g.choices.indexOf(room.g.ans) : rnd(room.g.choices.length) }); }, 'bot' + bot); },
      view(room, me) {
        const g = room.g, lock = g.locked[me];
        return '<div class="gm-sub">ข้อ ' + g.qn + ' / ' + g.max + '</div>' +
          (g.job && g.job.code ? '<div class="gm-job"><b class="mono">' + esc(g.job.code) + '</b><span>' + esc(g.job.title || '') + '</span>' + (g.job.due ? '<small>ส่ง ' + d8(g.job.due) + '</small>' : '') + '</div>' : '') +
          '<div class="gm-qt">' + esc(g.text) + '</div>' +
          (room.phase === 'play' ? '<div class="gm-ch txt">' + g.choices.map((c, i) => '<button type="button" data-ga="pick" data-v="' + i + '"' + (g.reveal || lock !== undefined ? ' disabled' : '') + ' class="' + (g.reveal && c === g.ans ? 'ok' : lock === i ? 'bad' : '') + '">' + esc(c) + '</button>').join('') + '</div>' : '') +
          '<div class="gm-hint">' + (g.reveal ? (g.winner ? '🎉 ' + esc(g.winner) + ' ตอบถูกก่อน' : 'ไม่มีใครตอบถูก · คำตอบคือ ' + esc(g.ans)) : lock !== undefined ? 'ตอบผิด รอข้อถัดไป' : 'แตะคำตอบที่ถูกให้เร็วที่สุด') + '</div>';
      }
    },
    sort: {
      name: 'เรียงคิวด่วน', emoji: '⏰', desc: 'งานจริงในคิว 4 งาน แตะเรียงจากกำหนดส่งก่อน → ทีหลัง เรียงถูกและไวสุดได้ 2 แต้ม · 5 รอบ', min: 2, max: 12, work: true,
      init: () => ({ jobs: B.jobs().filter(j => j.due), round: 1, max: 5, items: [], sub: {}, ph: 'play' }),
      start: (room, ctx) => sortRound(room, ctx),
      act(room, who, a, ctx) {
        const g = room.g; if (g.ph !== 'play' || g.sub[who] || !Array.isArray(a.order) || +a.rid !== g.rid) return;
        const order = a.order.map(Number).filter(i => i >= 0 && i < g.items.length);
        g.sub[who] = { ok: sortOk(g.items, order), ms: Math.max(300, Math.round(+a.ms || 99999)) };
        if (act(room).every(p => g.sub[p.n])) sortEnd(room, ctx);
      },
      hide: g => Object.assign({}, g, { jobs: [], items: g.ph === 'res' ? g.items : g.items.map(x => ({ code: x.code, title: x.title })) }),
      bot(room, bot, ctx) { const g = room.g; if (g.ph !== 'play' || g.sub[bot]) return; const rid = g.rid, ms = 4000 + rnd(9000); ctx.later(ms, () => { if (room.g.rid !== rid) return; const ord = room.g.items.map((x, i) => i).sort((a, b) => room.g.items[a].due < room.g.items[b].due ? -1 : 1); if (Math.random() < .35) ord.reverse(); ctx.act(bot, { order: ord, ms, rid }); }, 'bot' + bot); },
      view(room, me) {
        const g = room.g, k = room.r + ':' + g.rid; if (g.ph === 'play' && !G.t0[k]) G.t0[k] = performance.now();
        const sel = G.sel[k] || [], sub = g.sub[me], res = g.ph === 'res';
        const items = g.items.map((x, i) => '<button type="button" data-ga="sortp" data-v="' + i + '" class="gm-sj' + (sel.indexOf(i) >= 0 ? ' on' : '') + '"' + (res || sub || !pl(room, me) || sel.indexOf(i) >= 0 ? ' disabled' : '') + '><i>' + (sel.indexOf(i) >= 0 ? sel.indexOf(i) + 1 : '') + '</i><b class="mono">' + esc(x.code) + '</b><span>' + esc(x.title || '') + '</span>' + (res ? '<small>ส่ง ' + d8(x.due) + '</small>' : '') + '</button>').join('');
        return '<div class="gm-sub">รอบ ' + g.round + ' / ' + g.max + (g.ph === 'play' ? ' · <span data-tl>' + tlTxt(room) + '</span>' : '') + '</div>' +
          '<div class="gm-qt">แตะเรียงงานจาก <b>ส่งก่อน</b> → <b>ส่งทีหลัง</b></div><div class="gm-sort">' + items + '</div>' +
          (sel.length && !sub && !res ? '<div class="gm-btns"><button type="button" class="btn sm" data-ga="sortx">เริ่มเรียงใหม่</button></div>' : '') +
          '<div class="gm-hint">' + (res ? (g.fast ? '⚡ ' + esc(g.fast) + ' เรียงถูกไวสุด (+2)' : 'ไม่มีใครเรียงถูก') + ' · ' + Object.keys(g.sub).map(n => esc(n) + (g.sub[n].ok ? ' ✓' : ' ✗')).join(' · ') : sub ? (sub.ok ? 'ส่งแล้ว รอคนอื่น…' : 'ส่งแล้ว รอคนอื่น…') : 'แตะครบ 4 งานแล้วระบบส่งให้เอง') + '</div>';
      },
      done: (room, n) => room.phase === 'play' && room.g && room.g.sub && !!room.g.sub[n]
    },
    draw: {
      name: 'วาดภาพทายคำ', emoji: '🎨', desc: 'ผลัดกันวาด คนอื่นพิมพ์ทาย ใครทายถูกก่อนได้แต้มมากกว่า · ตาละ 80 วิ', min: 2, max: 10,
      init: room => { const order = room.players.filter(p => !p.bot).map(p => p.n); return { order, ri: 0, rounds: order.length * (order.length <= 2 ? 2 : 1), used: [], strokes: [], guessed: {}, log: [] }; },
      start: (room, ctx) => drawRound(room, ctx),
      act(room, who, a, ctx) {
        const g = room.g;
        if (a.seg) { if (who === g.drawer && g.ph === 'draw') drawSeg(g, a.seg); return 'quiet'; }
        if (a.clear) { if (who === g.drawer) g.strokes = []; return; }
        if (a.guess !== undefined) {
          if (g.ph !== 'draw' || who === g.drawer || g.guessed[who]) return;
          const t = String(a.guess).slice(0, 40);
          if (normW(t) && normW(t) === normW(g.word)) {
            const k = Object.keys(g.guessed).length; g.guessed[who] = 1; pl(room, who).s += Math.max(1, 3 - k); const d = pl(room, g.drawer); if (d) d.s++;
            g.log.push({ n: who, ok: 1 });
            if (act(room).every(p => p.n === g.drawer || g.guessed[p.n])) drawReveal(room, ctx);
          } else g.log.push({ n: who, t });
          g.log = g.log.slice(-8);
        }
      },
      peer(room, who, a) { const g = room.g; if (!g || who !== g.drawer) return; if (a.seg) drawSeg(g, a.seg); if (a.clear) g.strokes = []; paintDraw(room); },
      hide: g => Object.assign({}, g, { word: g.ph === 'reveal' ? g.word : null, wlen: g.word ? Array.from(g.word).length : 0, used: [] }),
      priv: room => room.g && room.g.ph === 'draw' ? { who: room.g.drawer, key: room.g.ri + ':' + room.g.word, d: { word: room.g.word } } : null,
      bot(room, bot, ctx) { const g = room.g; if (g.ph !== 'draw' || bot === g.drawer || g.guessed[bot]) return; const ri = g.ri; ctx.later(5000 + rnd(9000), () => { if (room.g.ri !== ri) return; ctx.act(bot, { guess: Math.random() < .3 ? room.g.word : DRAW_WORDS[rnd(DRAW_WORDS.length)] }); }, 'bot' + bot); },
      view(room, me, priv) {
        const g = room.g, mine = g.drawer === me, word = mine ? (g.word || (priv && priv.word) || '') : '';
        const head = g.ph === 'reveal' ? 'คำตอบคือ <b>' + esc(g.shown || g.word || '') + '</b>' : mine ? 'คุณวาด: <b class="gm-word">' + esc(word || '…') + '</b>' : esc(g.drawer || '') + ' กำลังวาด · ทาย: <b class="gm-mask">' + Array.from({ length: g.wlen || (g.word ? Array.from(g.word).length : 0) }, () => '_').join(' ') + '</b>';
        return '<div class="gm-sub">รอบ ' + (g.ri + 1) + ' / ' + g.rounds + ' · <span data-tl>' + tlTxt(room) + '</span></div><div class="gm-dhead">' + head + '</div>' +
          '<div class="gm-canvas"><div data-slot="cv"></div></div>' +
          (mine && g.ph === 'draw' && room.phase === 'play' ? '<div class="gm-tools">' + PEN_C.map(c => '<button type="button" data-ga="dcol" data-v="' + c + '" class="gm-dot' + (G.pen.c === c ? ' on' : '') + '" style="--c:' + c + '" aria-label="' + (c === '#FFFFFF' ? 'ยางลบ' : 'สี') + '" title="' + (c === '#FFFFFF' ? 'ยางลบ' : '') + '"></button>').join('') + '<button type="button" data-ga="dsz" data-v="1" class="gm-sz' + (G.pen.w === 1 ? ' on' : '') + '">เส้นเล็ก</button><button type="button" data-ga="dsz" data-v="2" class="gm-sz' + (G.pen.w === 2 ? ' on' : '') + '">เส้นใหญ่</button><button type="button" data-ga="dclear" class="gm-sz">ล้าง</button></div>' : '') +
          (!mine && g.ph === 'draw' && room.phase === 'play' && pl(room, me) ? (g.guessed[me] ? '<div class="gm-hint">✅ ทายถูกแล้ว รอคนอื่น</div>' : '<form class="gm-guess" data-gform="guess"><div data-slot="guess"></div><button type="submit" class="btn primary sm">ทาย</button></form>') : '') +
          '<div class="gm-log">' + g.log.slice().reverse().map(l => '<span class="' + (l.ok ? 'ok' : '') + '"><b>' + esc(l.n) + '</b> ' + (l.ok ? 'ทายถูก! 🎉' : esc(l.t)) + '</span>').join('') + '</div>';
      },
      after(card, room) { mountCanvas(card, room); mountInput(card, 'guess', 'พิมพ์คำที่ทาย แล้วกด Enter'); paintDraw(room); },
      done: (room, n) => room.phase === 'play' && room.g && room.g.guessed && !!room.g.guessed[n]
    },
    four: {
      name: 'เรียง 4', emoji: '🔴', desc: 'ผลัดกันหยอดเหรียญ เรียงสีตัวเองครบ 4 (นอน ตั้ง ทแยง) ชนะ', min: 2, max: 4, turn: true,
      init: () => ({ w: 7, h: 6, cells: Array(42).fill(null), turn: 0, win: null, last: -1 }),
      act(room, who, a, ctx) {
        const g = room.g, c = +a.drop; if (cur(room) !== who || !(c >= 0 && c < g.w)) return;
        const y = fourRow(g, c); if (y < 0) return; const i = y * g.w + c, pi = room.players.indexOf(pl(room, who));
        g.cells[i] = pi; g.last = i;
        const line = fourWin(g.cells, g.w, g.h, i);
        if (line) { g.win = { n: who, line }; pl(room, who).s++; return ctx.end(); }
        if (g.cells.every(x => x !== null)) { g.win = { n: '', line: [] }; return ctx.end(); }
        next(room); ctx.turnTimer();
      },
      skip(room) { next(room); },
      bot(room, bot, ctx) {
        const g = room.g; if (cur(room) !== bot) return; const pi = room.players.indexOf(pl(room, bot)), cols = [];
        for (let c = 0; c < g.w; c++) if (fourRow(g, c) >= 0) cols.push(c);
        const tryC = v => cols.find(c => { const i = fourRow(g, c) * g.w + c; g.cells[i] = v; const w = fourWin(g.cells, g.w, g.h, i); g.cells[i] = null; return !!w; });
        let c = tryC(pi); for (let q = 0; q < room.players.length && c === undefined; q++) if (q !== pi) c = tryC(q);
        if (c === undefined) c = cols[rnd(cols.length)];
        ctx.later(700 + rnd(500), () => ctx.act(bot, { drop: c }), 'bot' + bot);
      },
      view(room, me) {
        const g = room.g, my = room.phase === 'play' && cur(room) === me, mi = room.players.findIndex(p => p.n === me), win = g.win && g.win.line || [];
        return '<div class="gm-sub">' + (room.phase === 'play' ? (my ? '<b>ตาคุณ</b> แตะช่องที่จะหยอด' : 'ตาของ ' + esc(cur(room))) : g.win && !g.win.n ? 'เต็มกระดาน เสมอ' : '') + (mi >= 0 ? ' · สีคุณ <i class="gm-tok" style="--c:' + C4[mi] + '"></i>' : '') + '</div>' +
          '<div class="gm-four" style="--w:' + g.w + '">' + g.cells.map((v, i) => '<button type="button" data-ga="drop" data-v="' + (i % g.w) + '"' + (my ? '' : ' disabled') + ' class="' + (win.indexOf(i) >= 0 ? 'win' : '') + (i === g.last ? ' last' : '') + '"><i' + (v !== null ? ' style="--c:' + C4[v] + '"' : '') + '></i></button>').join('') + '</div>' +
          '<div class="gm-legend">' + room.players.map((p, i) => '<span><i class="gm-tok" style="--c:' + C4[i] + '"></i>' + esc(p.n) + '</span>').join('') + '</div>';
      }
    },
    guess: {
      name: 'ทายเลขลับ', emoji: '🔢', desc: 'ผลัดกันทายเลข 1–100 ระบบบอกว่ามากไปหรือน้อยไป ใครทายตรงได้แต้ม · 3 รอบ', min: 2, max: 8, turn: true,
      init: () => ({ secret: 1 + rnd(100), lo: 1, hi: 100, round: 1, max: 3, log: [], turn: 0, hit: 0 }),
      act(room, who, a, ctx) {
        const g = room.g, n = Math.round(+a.num); if (g.hit || cur(room) !== who || !(n >= g.lo && n <= g.hi)) return;
        if (n === g.secret) {
          pl(room, who).s++; g.hit = n; g.log.push(who + ' ทาย ' + n + ' → ถูกเป๊ะ! 🎯');
          ctx.later(2000, () => { if (g.round >= g.max) return ctx.end(); Object.assign(g, { secret: 1 + rnd(100), lo: 1, hi: 100, hit: 0, round: g.round + 1 }); g.log.push('— รอบ ' + g.round + ' เริ่ม —'); next(room); ctx.turnTimer(); }, 'nx');
        } else { if (n < g.secret) g.lo = n + 1; else g.hi = n - 1; g.log.push(who + ' ทาย ' + n + ' → ' + (n < g.secret ? 'น้อยไป ⬆️' : 'มากไป ⬇️')); next(room); ctx.turnTimer(); }
        g.log = g.log.slice(-7);
      },
      skip(room) { next(room); },
      hide: g => Object.assign({}, g, { secret: g.hit ? g.secret : null }),
      bot(room, bot, ctx) { const g = room.g; if (g.hit || cur(room) !== bot) return; const m = Math.round((g.lo + g.hi) / 2 + (rnd(7) - 3)); ctx.later(900 + rnd(700), () => ctx.act(bot, { num: Math.max(room.g.lo, Math.min(room.g.hi, m)) }), 'bot' + bot); },
      view(room, me) {
        const g = room.g, my = room.phase === 'play' && cur(room) === me && !g.hit;
        return '<div class="gm-sub">รอบ ' + g.round + ' / ' + g.max + ' · ' + (room.phase === 'play' ? (my ? '<b>ตาคุณ</b>' : 'ตาของ ' + esc(cur(room))) : '') + '</div>' +
          '<div class="gm-range"><b>' + g.lo + '</b><span>เลขลับอยู่ระหว่าง</span><b>' + g.hi + '</b></div>' +
          (my ? '<form class="gm-guess" data-gform="num"><div data-slot="num"></div><button type="submit" class="btn primary sm">ทาย</button></form>' : '') +
          '<div class="gm-log">' + g.log.slice().reverse().map(t => '<span>' + esc(t) + '</span>').join('') + '</div>';
      },
      after(card, room) { mountInput(card, 'num', 'ใส่เลข ' + room.g.lo + '–' + room.g.hi, 'number'); }
    },
    react: {
      name: 'ใครเร็วกว่า', emoji: '🚦', desc: 'รอจอเป็นสีเขียวแล้วแตะให้ไวที่สุด แตะก่อนโดนหักแต้ม · 5 รอบ', min: 2, max: 12,
      init: () => ({ round: 1, max: 5, ph: 'wait', rid: 0, res: {}, early: {}, last: null }),
      start: (room, ctx) => reactGo(room, ctx),
      act(room, who, a, ctx) {
        const g = room.g;
        if (a.early && g.ph === 'wait' && !g.early[who]) { g.early[who] = 1; const p = pl(room, who); p.s = Math.max(0, p.s - 1); return; }
        if (a.ms && g.ph === 'go' && g.res[who] === undefined && !g.early[who] && +a.rid === g.rid) { g.res[who] = Math.max(80, Math.min(4000, Math.round(+a.ms))); if (act(room).every(p => g.res[p.n] !== undefined || g.early[p.n])) reactEnd(room, ctx); }
      },
      bot(room, bot, ctx) { const g = room.g; if (g.ph !== 'go' || g.res[bot] !== undefined) return; const ms = 230 + rnd(380), rid = g.rid; ctx.later(ms, () => ctx.act(bot, { ms, rid }), 'bot' + bot); },
      view(room, me) {
        const g = room.g, k = room.r + ':' + g.rid; if (g.ph === 'go' && !G.t0[k]) G.t0[k] = performance.now();
        const mine = g.res[me], early = g.early[me];
        const big = g.ph === 'go' ? (mine !== undefined ? '<b>' + mine + ' ms</b><small>รอคนอื่น…</small>' : '<b>แตะ!</b>') : g.ph === 'wait' ? (early ? '<b>แตะเร็วไป −1</b><small>รอรอบหน้า</small>' : '<b>รอสีเขียว…</b><small>อย่าเพิ่งแตะ</small>') : '<b>' + (g.last && g.last.win ? esc(g.last.win) + ' ไวสุด!' : 'ไม่มีใครแตะ') + '</b>';
        return '<div class="gm-sub">รอบ ' + g.round + ' / ' + g.max + '</div>' +
          (room.phase === 'play' ? '<button type="button" class="gm-tap ' + g.ph + '" data-ga="tap"' + (pl(room, me) && mine === undefined && !early && g.ph !== 'res' ? '' : ' disabled') + '>' + big + '</button>' : '') +
          (g.last ? '<div class="gm-log">' + Object.keys(g.last.res).sort((x, y) => g.last.res[x] - g.last.res[y]).map(n => '<span' + (n === g.last.win ? ' class="ok"' : '') + '><b>' + esc(n) + '</b> ' + g.last.res[n] + ' ms</span>').join('') + Object.keys(g.last.early).map(n => '<span><b>' + esc(n) + '</b> แตะก่อน (−1)</span>').join('') + '</div>' : '');
      },
      done: (room, n) => room.phase === 'play' && room.g && room.g.res && room.g.res[n] !== undefined
    },
    bingo: {
      name: 'บิงโก', emoji: '🎱', desc: 'ระบบสุ่มเลขทุก 3 วิ แตะเลขบนการ์ดตัวเอง ครบแถว/คอลัมน์/ทแยงแล้วกด "บิงโก!" ก่อนชนะ', min: 2, max: 12,
      init: room => { const cards = {}, marks = {}; room.players.forEach(p => { cards[p.n] = bingoCard(); marks[p.n] = []; }); return { cards, marks, called: [], msg: '', winner: '' }; },
      start: (room, ctx) => ctx.later(2000, () => bingoCall(room, ctx), 'call'),
      act(room, who, a, ctx) {
        const g = room.g, card = g.cards[who]; if (!card) { g.cards[who] = bingoCard(); g.marks[who] = []; return; }
        if (a.mark !== undefined) { const i = +a.mark, m = g.marks[who]; if (!(i >= 0 && i < 25) || i === 12) return; if (m.indexOf(i) >= 0) m.splice(m.indexOf(i), 1); else if (g.called.indexOf(card[i]) >= 0) m.push(i); return; }
        if (a.bingo) {
          const valid = g.marks[who].filter(i => g.called.indexOf(card[i]) >= 0), line = bingoLine(card, valid);
          if (line) { g.winner = who; g.line = line; pl(room, who).s++; ctx.end(); } else g.msg = who + ' กดบิงโก แต่ยังไม่ครบแถว 😅';
        }
      },
      bot(room, bot, ctx) {
        const g = room.g, card = g.cards[bot]; if (!card) return;
        const todo = card.map((n, i) => i).filter(i => i !== 12 && g.called.indexOf(card[i]) >= 0 && g.marks[bot].indexOf(i) < 0);
        if (todo.length) return ctx.later(700 + rnd(1600), () => ctx.act(bot, { mark: todo[0] }), 'bot' + bot);
        if (bingoLine(card, g.marks[bot])) ctx.later(600 + rnd(1500), () => ctx.act(bot, { bingo: 1 }), 'bot' + bot);
      },
      view(room, me) {
        const g = room.g, card = g.cards[me], m = (g.marks[me] || []), last = g.called[g.called.length - 1], line = g.winner === me ? g.line || [] : [];
        return '<div class="gm-ball">' + (last ? '<b>' + 'BINGO'[Math.floor((last - 1) / 15)] + ' ' + last + '</b>' : '<b>…</b>') + '<small>' + g.called.slice(-9, -1).reverse().join(' · ') + '</small></div>' +
          (card ? '<div class="gm-bingo">' + 'BINGO'.split('').map(c => '<i>' + c + '</i>').join('') + card.map((n, i) => '<button type="button" data-ga="mark" data-v="' + i + '" class="' + (i === 12 || m.indexOf(i) >= 0 ? 'on' : '') + (line.indexOf(i) >= 0 ? ' win' : '') + '"' + (room.phase === 'play' && i !== 12 ? '' : ' disabled') + '>' + (i === 12 ? '★' : n) + '</button>').join('') + '</div>' +
            (room.phase === 'play' ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="bingo">บิงโก!</button></div>' : '') : '<p class="gm-hint">คุณกำลังดูอยู่</p>') +
          '<div class="gm-hint">' + esc(g.winner ? '🎉 ' + g.winner + ' บิงโก!' : g.msg || 'แตะเลขที่ถูกเรียกบนการ์ดของคุณ') + '</div>';
      }
    }
  });
  function drawSeg(g, s) {
    if (!s || !s.id || !Array.isArray(s.p)) return;
    const tot = g.strokes.reduce((a, x) => a + x.p.length, 0); if (tot > 16000) return;
    let st = g.strokes.find(x => x.id === s.id);
    if (!st) { st = { id: String(s.id).slice(0, 20), c: PEN_C.indexOf(s.c) >= 0 ? s.c : PEN_C[0], w: s.w === 2 ? 2 : 1, p: [] }; g.strokes.push(st); }
    for (let i = 0; i + 1 < s.p.length && st.p.length < 4000; i += 2) st.p.push(Math.max(0, Math.min(1000, s.p[i] | 0)), Math.max(0, Math.min(1000, s.p[i + 1] | 0)));
  }
  /* ผืนวาดใช้ตัวเดิมตลอด (ไม่สร้างใหม่ตอนสถานะเปลี่ยน) · คนวาดเห็นเส้นตัวเองทันที */
  function mountCanvas(card) {
    const slot = card.querySelector('[data-slot="cv"]'); if (!slot) return;
    let cv = G.keep.cv;
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = 900; cv.height = 600; cv.className = 'gm-cv'; G.keep.cv = cv;
      let cu = null, buf = [], t = 0;
      const xy = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 1000)]; };
      const flush = () => { t = 0; const rm = G.rooms[G.view]; if (!cu || !buf.length || !rm) return; const seg = { id: cu.id, c: cu.c, w: cu.w, p: buf }; buf = []; doAct(rm, { seg }); };
      cv.addEventListener('pointerdown', e => { const rm = G.rooms[G.view]; if (!rm || !rm.g || rm.g.drawer !== me() || rm.g.ph !== 'draw' || rm.phase !== 'play') return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} cu = { id: 's' + rnd(1e9).toString(36), c: G.pen.c, w: G.pen.w }; buf = xy(e); flush(); });
      cv.addEventListener('pointermove', e => { if (!cu) return; buf.push(...xy(e)); if (!t) t = setTimeout(flush, 90); });
      const up = () => { if (!cu) return; clearTimeout(t); flush(); cu = null; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    }
    slot.replaceWith(cv);
  }
  function mountInput(card, id, ph, type) {
    const slot = card.querySelector('[data-slot="' + id + '"]'); if (!slot) return;
    let el = G.keep[id];
    if (!el) { el = document.createElement('input'); el.className = 'gm-in'; el.autocomplete = 'off'; el.dataset.gin = id; G.keep[id] = el; }
    el.type = type || 'text'; el.placeholder = ph; if (type === 'number') el.inputMode = 'numeric';
    const f = G.focus === id; slot.replaceWith(el); if (f) { try { el.focus(); } catch (e) {} }
  }
  function paintDraw(room) {
    const cv = G.keep.cv; if (!cv || !cv.isConnected || !room.g) return;
    const g2 = cv.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, cv.width, cv.height); g2.lineCap = g2.lineJoin = 'round';
    (room.g.strokes || []).forEach(s => {
      g2.strokeStyle = s.c; g2.lineWidth = s.c === '#FFFFFF' ? 34 : s.w === 2 ? 12 : 4; g2.beginPath();
      for (let i = 0; i + 1 < s.p.length; i += 2) { const x = s.p[i] * cv.width / 1000, y = s.p[i + 1] * cv.height / 1000; if (i) g2.lineTo(x, y); else g2.moveTo(x, y); }
      if (s.p.length === 2) g2.lineTo(s.p[0] * cv.width / 1000 + .1, s.p[1] * cv.height / 1000);
      g2.stroke();
    });
  }

  /* ผู้เล่นที่ยังอยู่ · ตาปัจจุบัน */
  const act = room => room.players.filter(p => p.on);
  const pl = (room, n) => room.players.find(p => p.n === n);
  function cur(room) { const a = room.players; if (!a.length) return ''; let t = room.g.turn % a.length, k = 0; while (!a[t].on && k++ < a.length) t = (t + 1) % a.length; room.g.turn = t; return a[t].n; }
  function next(room) { const a = room.players; let t = room.g.turn, k = 0; do { t = (t + 1) % a.length; } while (!a[t].on && ++k < a.length); room.g.turn = t; }

  /* ---------------- ห้อง ---------------- */
  const G = { rooms: {}, view: '', scope: null, timers: {}, pen: { c: '#111827', w: 1 }, keep: {}, t0: {}, sel: {}, priv: {}, focus: '' };
  const me = () => B.me();
  const isHost = room => room.host === me();
  const forMe = to => to === 'team' || (Array.isArray(to) && to.indexOf(me()) >= 0);
  const sameScope = (to, sc) => to === 'team' ? sc === 'team' : Array.isArray(to) && Array.isArray(sc) && to.length === sc.length && sc.every(x => to.indexOf(x) >= 0);
  const send = (room, o) => B.send(Object.assign({ r: room.r, to: room.to }, o));
  function pub(room) {   // host: กระจายสถานะ (ซ่อนข้อมูลที่ยังไม่ควรเห็น)
    room.v = (room.v || 0) + 1; room.at = now();
    const g = GAMES[room.game], hidden = room.g && g.hide && room.phase !== 'end' ? g.hide(room.g, '') : room.g;
    room.tl = room.g && room.g.ends ? room.g.ends - now() : 0;
    send(room, { t: 'st', room: Object.assign({}, room, { g: hidden }) });
    // ข้อมูลลับเฉพาะคน (เช่น คำที่ต้องวาด) ส่งถึงคนนั้นคนเดียว
    const pv = room.g && room.phase === 'play' && g.priv ? g.priv(room) : null;
    if (pv && pv.who !== me() && room._pk !== pv.key) { room._pk = pv.key; B.send({ r: room.r, to: [pv.who], t: 'priv', d: pv.d }); }
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
    const res = GAMES[room.game].act(room, who, a, ctxOf(room));
    if (res === 'quiet') { if (who === me() || p.bot) send(room, { t: 'act', n: who, a }); return; }   // เส้นที่วาด: ส่งต่อแบบเบา ไม่ส่งสถานะทั้งก้อน
    pub(room);
  }
  function doAct(room, A) {
    if (isHost(room)) return hostAct(room, me(), A);
    const g = GAMES[room.game]; if (g.peer && A.seg) g.peer(room, me(), A);
    send(room, { t: 'act', n: me(), a: A });
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
      G.rooms[o.r] = o.room; o.room.got = now(); o.room.lend = o.room.tl ? now() + o.room.tl : 0; render(); return;
    }
    if (o.t === 'priv') { G.priv[o.r] = o.d; render(); return; }
    if (o.t === 'act' && room && !isHost(room)) { const g = GAMES[room.game]; if (g.peer && o.n !== me()) g.peer(room, o.n, o.a || {}); return; }
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
    else if (o.t === 'hello' || o.t === 'ping') { if (p) { p.seen = now(); if (!p.on) { p.on = true; pub(room); return; } } if (o.t === 'hello') { room._pk = ''; pub(room); } }
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

  setInterval(() => { const room = G.view && G.rooms[G.view]; if (!room) return; document.querySelectorAll('#gameView [data-tl]').forEach(x => { x.textContent = tlTxt(room); }); }, 500);
  /* ---------------- หน้าจอ ---------------- */
  function scoreRow(room) {
    const turnName = GAMES[room.game].turn && room.phase === 'play' ? cur(room) : '', done = GAMES[room.game].done;
    const best = room.phase === 'end' ? Math.max(...room.players.map(p => p.s)) : null;
    return '<div class="gm-players">' + room.players.map(p => '<span class="gm-p' + (p.n === turnName ? ' turn' : '') + (p.on ? '' : ' off') + (best !== null && p.s === best ? ' win' : '') + '">' + B.av(p.n) + '<b>' + esc(p.n) + (p.n === room.host ? ' <i title="เจ้าของห้อง">👑</i>' : '') + (done && done(room, p.n) ? ' ✓' : '') + '</b><em>' + p.s + '</em></span>').join('') + '</div>';
  }
  function privFor(room) { const g = GAMES[room.game]; if (isHost(room)) { const pv = g.priv && room.g ? g.priv(room) : null; return pv && pv.who === me() ? pv.d : null; } return G.priv[room.r] || null; }
  function roomHtml(room) {
    const g = GAMES[room.game], host = isHost(room), meIn = !!pl(room, me()), lobby = room.phase === 'lobby';
    const bestN = room.phase === 'end' ? room.players.filter(p => p.s === Math.max(...room.players.map(x => x.s))).map(p => p.n) : [];
    return '<div class="gm-top"><button type="button" class="icon-btn" data-ga="back" aria-label="กลับ">‹</button><b>' + g.emoji + ' ' + g.name + '</b><small>' + (room.to === 'team' ? 'ทั้งทีม' : 'แบบคู่') + (room.lost ? ' · ขาดการเชื่อมต่อกับเจ้าของห้อง' : '') + '</small><button type="button" class="btn sm" data-ga="leave">' + (host ? 'ปิดห้อง' : 'ออก') + '</button></div>' +
      scoreRow(room) +
      (lobby ? '<div class="gm-lobby"><p>' + esc(g.desc) + '</p><p class="gm-hint">' + room.players.length + ' คนในห้อง · ' + (room.players.length < g.min ? 'รอเพื่อนเข้าร่วม (ส่งคำชวนไปแล้ว)' : 'พร้อมเริ่มแล้ว') + '</p>' +
        (host ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="start"' + (room.players.length >= g.min ? '' : ' disabled') + '>เริ่มเกม</button>' + (room.players.length < g.max ? '<button type="button" class="btn" data-ga="bot">+ เพิ่มบอท</button>' : '') + '<button type="button" class="btn ghost" data-ga="invite">ชวนอีกครั้ง</button></div>'
          : meIn ? '<p class="gm-hint">รอ ' + esc(room.host) + ' กดเริ่มเกม</p>' : '<div class="gm-btns"><button type="button" class="btn primary" data-ga="join">เข้าร่วม</button></div>') + '</div>'
        : '<div class="gm-board">' + g.view(room, me(), privFor(room)) + '</div>' +
          (room.phase === 'end' ? '<div class="gm-end">🏆 ' + (bestN.length > 1 ? 'เสมอ: ' : 'ผู้ชนะ: ') + bestN.map(esc).join(', ') + (host ? '<div class="gm-btns"><button type="button" class="btn primary" data-ga="again">เล่นอีกครั้ง</button><button type="button" class="btn" data-ga="lobby">เปลี่ยนเกม</button></div>' : '<p class="gm-hint">รอ ' + esc(room.host) + ' เริ่มรอบใหม่</p>') + '</div>' : '') +
          (!meIn ? '<p class="gm-hint">คุณกำลังดูอยู่ · ' + (room.phase === 'play' ? '<button type="button" class="btn sm" data-ga="join">ขอเข้าเล่น</button>' : '') + '</p>' : ''));
  }
  function lobbyHtml() {
    const sc = G.scope, open = B.openRooms(sc);
    return '<div class="gm-top"><b>🎮 ห้องเกม</b><small>' + esc(B.scopeName(sc)) + '</small><button type="button" class="icon-btn" data-ga="x" aria-label="ปิด">✕</button></div>' +
      (!B.live() ? '<div class="gm-note">ตอนนี้ยังไม่ได้เชื่อมต่อแบบเรียลไทม์ — เล่นกับบอทได้ (เพื่อนจะเข้าร่วมได้เมื่อเชื่อมต่อเรียลไทม์)</div>' : '') +
      (open.length ? '<div class="gm-sec">ห้องที่เปิดอยู่</div><div class="gm-open">' + open.map(r => '<button type="button" data-ga="enter" data-v="' + esc(r.r) + '">' + GAMES[r.game].emoji + ' <b>' + GAMES[r.game].name + '</b><small>' + esc(r.host) + (r.players && r.players.length ? ' · ' + r.players.length + ' คน' : '') + (r.phase === 'play' ? ' · กำลังเล่น' : ' · รอผู้เล่น') + '</small></button>').join('') + '</div>' : '') +
      '<div class="gm-sec">เปิดห้องใหม่ ' + (sc === 'team' ? '(ทุกคนในทีมเห็นคำชวน · เล่นเป็นกลุ่ม)' : '(ชวนแบบคู่)') + '</div>' +
      [['📋 เกมคิวงาน (ใช้งานจริงในระบบ)', k => GAMES[k].work], ['🎲 เกมทั่วไป', k => !GAMES[k].work]].map(sec => '<div class="gm-sec2">' + sec[0] + '</div><div class="gm-list">' +
        Object.keys(GAMES).filter(sec[1]).map(k => '<button type="button" data-ga="new" data-v="' + k + '"' + (GAMES[k].work ? ' class="work"' : '') + '><span>' + GAMES[k].emoji + '</span><b>' + GAMES[k].name + '</b><small>' + esc(GAMES[k].desc) + '</small><em>' + GAMES[k].min + '–' + GAMES[k].max + ' คน</em></button>').join('') + '</div>').join('');
  }
  function render() {
    const el = $('#gameView'); if (!el || el.hidden) return B.roomsChanged();
    const room = G.view && G.rooms[G.view];
    if (G.view && !room) G.view = '';
    const ae = document.activeElement; G.focus = ae && ae.dataset && ae.dataset.gin || '';
    const card = el.querySelector('.gm-card'); card.innerHTML = room ? roomHtml(room) : lobbyHtml();
    if (room && room.phase !== 'lobby' && room.g && GAMES[room.game].after) GAMES[room.game].after(card, room);
    B.roomsChanged();
  }
  function open(scope, roomId) {
    G.scope = scope || 'team';
    let el = $('#gameView');
    if (!el) {
      el = document.createElement('div'); el.id = 'gameView'; el.className = 'gm-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'ห้องเกม');
      el.innerHTML = '<div class="gm-card"></div>'; document.body.appendChild(el);
      el.addEventListener('submit', e => { e.preventDefault(); const f = e.target.closest('[data-gform]'); if (f) onClick('gsub', f.dataset.gform); });
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
    if (a === 'dcol') { G.pen.c = v; return render(); }
    if (a === 'dsz') { G.pen.w = +v; return render(); }
    if (a === 'sortx') { delete G.sel[room.r + ':' + room.g.rid]; return render(); }
    if (a === 'sortp') {
      const k = room.r + ':' + room.g.rid, sel = G.sel[k] = G.sel[k] || []; if (sel.indexOf(+v) >= 0) return; sel.push(+v);
      if (sel.length === room.g.items.length) doAct(room, { order: sel.slice(), ms: Math.round(performance.now() - (G.t0[k] || performance.now())), rid: room.g.rid });
      return render();
    }
    let A = a === 'pick' ? { pick: GAMES[room.game] === GAMES.rps ? v : +v } : a === 'flip' ? { flip: +v } : a === 'roll' ? { roll: 1 } : a === 'hold' ? { hold: 1 } :
      a === 'drop' ? { drop: +v } : a === 'mark' ? { mark: +v } : a === 'bingo' ? { bingo: 1 } : a === 'dclear' ? { clear: 1 } : null;
    if (a === 'tap') { const g = room.g, k = room.r + ':' + g.rid; A = g.ph === 'go' ? { ms: Math.round(performance.now() - (G.t0[k] || performance.now())), rid: g.rid } : g.ph === 'wait' ? { early: 1 } : null; }
    if (a === 'gsub') { const inp = G.keep[v]; const val = inp ? inp.value.trim() : ''; if (!val) return; inp.value = ''; A = v === 'num' ? { num: +val } : { guess: val }; }
    if (!A) return;
    doAct(room, A);
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
.gm-sec2{font-size:13px;font-weight:700;margin-top:2px}
.gm-list button.work{border-color:color-mix(in srgb,var(--brand,#0B6B70) 45%,transparent);background:color-mix(in srgb,var(--brand,#0B6B70) 7%,var(--surface,#fff))}
.gm-job{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:10px 12px;border-radius:12px;background:var(--surface-2,#f6f7f9);border-left:4px solid var(--brand,#0B6B70)}
.gm-job b{font-size:16px}.gm-job small{color:var(--muted,#667);margin-left:auto}
.gm-qt{text-align:center;font-weight:700;font-size:17px}
.gm-ch.txt button{font-size:15px;font-weight:600;padding:12px 8px;line-height:1.3}
.gm-sort{display:flex;flex-direction:column;gap:8px}
.gm-sj{display:grid;grid-template-columns:30px auto 1fr auto;align-items:center;gap:8px;text-align:left;padding:10px 12px;border-radius:12px;border:2px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);cursor:pointer;font:inherit;color:inherit}
.gm-sj i{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;background:var(--surface,#fff);box-shadow:inset 0 0 0 2px var(--line,#e3e6ea)}
.gm-sj.on{border-color:var(--brand,#0B6B70)}.gm-sj.on i{background:var(--brand,#0B6B70);color:#fff;box-shadow:none}
.gm-sj span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted,#667);font-size:13px}.gm-sj small{color:var(--brand,#0B6B70);font-weight:600}
.gm-sj:disabled{cursor:default}
.gm-dhead{text-align:center;font-size:15px}.gm-word{color:var(--brand,#0B6B70);font-size:20px}.gm-mask{letter-spacing:.15em;font-size:18px}
.gm-canvas{border-radius:14px;overflow:hidden;box-shadow:inset 0 0 0 2px var(--line,#e3e6ea);background:#fff}
.gm-cv{display:block;width:100%;aspect-ratio:3/2;touch-action:none;cursor:crosshair}
.gm-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center}
.gm-dot{width:26px;height:26px;border-radius:50%;background:var(--c);border:2px solid #fff;box-shadow:0 0 0 1px #9aa4ae;cursor:pointer}
.gm-dot.on{box-shadow:0 0 0 3px var(--brand,#0B6B70)}
.gm-sz{border:1px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;cursor:pointer;color:inherit}.gm-sz.on{border-color:var(--brand,#0B6B70);color:var(--brand,#0B6B70);font-weight:600}
.gm-guess{display:flex;gap:8px}.gm-in{flex:1;min-width:0;border:1px solid var(--line,#d5dbe1);border-radius:10px;padding:9px 12px;font:inherit;font-size:15px;background:var(--surface,#fff);color:inherit}
.gm-log{display:flex;flex-direction:column;gap:3px;font-size:13px;max-height:150px;overflow:auto}
.gm-log span{padding:3px 8px;border-radius:8px;background:var(--surface-2,#f6f7f9)}.gm-log span.ok{background:#DCFCE7;color:#14532D}
.gm-four{display:grid;grid-template-columns:repeat(var(--w),1fr);gap:5px;padding:8px;border-radius:14px;background:#1E3A8A}
.gm-four button{aspect-ratio:1;border:0;padding:0;background:transparent;cursor:pointer;display:grid;place-items:center}
.gm-four button:disabled{cursor:default}
.gm-four i{width:84%;height:84%;border-radius:50%;background:var(--c,#0F172A);box-shadow:inset 0 3px 6px rgba(0,0,0,.35)}
.gm-four button.last i{outline:3px solid #fff;outline-offset:-3px}.gm-four button.win i{box-shadow:0 0 0 4px #FDE047}
.gm-tok{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--c);vertical-align:-2px}
.gm-legend{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;font-size:13px}.gm-legend span{display:flex;align-items:center;gap:5px}
.gm-range{display:flex;align-items:center;justify-content:center;gap:14px}.gm-range b{font-size:34px;color:var(--brand,#0B6B70)}.gm-range span{color:var(--muted,#667);font-size:13px}
.gm-tap{width:100%;min-height:200px;border:0;border-radius:18px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font:inherit;transition:background .15s}
.gm-tap b{font-size:30px}.gm-tap small{font-size:14px;opacity:.9}
.gm-tap.wait{background:#DC2626}.gm-tap.go{background:#16A34A}.gm-tap.res{background:#475569}
.gm-tap:disabled{cursor:default;filter:saturate(.8)}
.gm-ball{display:flex;flex-direction:column;align-items:center;gap:2px}.gm-ball b{font-size:30px;padding:6px 18px;border-radius:999px;background:var(--brand,#0B6B70);color:#fff}.gm-ball small{color:var(--muted,#667)}
.gm-bingo{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
.gm-bingo i{font-style:normal;text-align:center;font-weight:800;color:var(--brand,#0B6B70)}
.gm-bingo button{aspect-ratio:1;border-radius:10px;border:2px solid var(--line,#e3e6ea);background:var(--surface-2,#f6f7f9);font:700 17px/1 inherit;cursor:pointer;color:inherit}
.gm-bingo button.on{background:#FDE68A;border-color:#F59E0B}.gm-bingo button.win{background:#86EFAC;border-color:#16A34A}
@media (max-width:520px){.gm-list{grid-template-columns:1fr}.gm-card{padding:14px}.gm-q{font-size:32px}}
`;
  document.head.appendChild(css);

  window.KNGames = { open, close, recv, rooms: () => G.rooms, _G: G, GAMES, _act: (r, who, a) => hostAct(G.rooms[r], who, a) };
})();
