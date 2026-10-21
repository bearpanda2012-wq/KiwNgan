// ทดลอง: แอนิเมชันวนทุกตัวอัปเดต N ครั้ง/วินาที (ยังวนตลอด) โดยแก้ animation-timing-function ใน CSSOM
window.__stepLoops = (fps, all) => {
  const PAINT = new Set(), comp = /^(transform|opacity|offset.*|translate|scale|rotate|animation-timing-function|visibility)$/;
  const sheets = [...document.styleSheets].filter(s => { try { return !!s.cssRules; } catch (e) { return false; } });
  const walk = (rules, fn) => { for (const r of rules) { if (r.cssRules && !(r instanceof CSSKeyframesRule)) walk(r.cssRules, fn); fn(r); } };
  sheets.forEach(s => walk(s.cssRules, r => { if (r instanceof CSSKeyframesRule) { for (const k of r.cssRules) for (let i = 0; i < k.style.length; i++) if (!comp.test(k.style[i])) { PAINT.add(r.name); break; } } }));
  let n = 0;
  const sec = v => { v = String(v).trim(); return /ms$/.test(v) ? parseFloat(v) / 1000 : parseFloat(v) || 0; };
  sheets.forEach(s => walk(s.cssRules, r => { if (!(r instanceof CSSStyleRule)) return; const st = r.style, nm = st.animationName; if (!nm || nm === 'none') return;
    const names = nm.split(','), durs = (st.animationDuration || '0s').split(','), its = (st.animationIterationCount || '1').split(','), tfs = (st.animationTimingFunction || 'ease').split(/,(?![^(]*\))/);
    let ch = false; const out = names.map((x, i) => { const tf = (tfs[i % tfs.length] || 'ease').trim(), it = (its[i % its.length] || '1').trim(), d = sec(durs[i % durs.length]);
      if (it === 'infinite' && d > 0 && (all || PAINT.has(x.trim())) && !/^steps/.test(tf)) { ch = true; n++; return 'steps(' + Math.max(4, Math.round(d * fps)) + ', end)'; } return tf; });
    if (ch) st.animationTimingFunction = out.join(', '); }));
  return { paint: PAINT.size, changed: n };
};
