// ทดลอง: ขับแอนิเมชันวนเองที่ N เฟรม/วินาที (หยุดตัวเบราว์เซอร์ แล้วเลื่อนเวลาเองทีละช่วง) — แอนิเมชันยังวิ่งตลอด แต่วาดจอน้อยลง
window.__tickLoops = fps => {
  const dt = 1000 / fps, own = new WeakSet();
  const tick = () => {
    const list = document.getAnimations();
    for (const a of list) {
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      if (!t || t.iterations !== Infinity) continue;
      if (!own.has(a)) { own.add(a); try { a.pause(); } catch (e) {} }
      else if (a.playState === 'paused') { try { a.currentTime = (a.currentTime || 0) + dt; } catch (e) {} }
    }
  };
  return setInterval(tick, dt);
};
