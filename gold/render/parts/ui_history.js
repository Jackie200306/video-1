// ================================================================ history: every big crash since 1971 and how long it took to get back
const lg = Math.log10;
function hp2(c, x, usd) { return projVal(c, x, lg(usd)); }
function ymDate(iso) { const [y, m] = iso.split('-').map(Number); return `${y}年${m}月`; }
function crashSpan(k) {                           // when crash k is on stage
  const C = HS.crashes, c = C[k], nx = C[k + 1];
  return [c.t_peak - BAR * (k ? 0.5 : 0.25), nx ? nx.t_peak - BAR * 0.5 : HS.table];
}
function drawHistHeadline(t) {
  const C = HS.crashes;
  const items = [[HS.t0 + 0.1, C[0].t_peak - BAR * 0.25, '{1971} · 金价开始自由浮动', '美元与黄金脱钩，布雷顿森林体系瓦解，金价从 $35 起步']];
  C.forEach((c, k) => { const [a, b] = crashSpan(k); items.push([a, b, c.title.replace(c.label, '{' + c.label + '}'), c.sub]); });
  for (const [a, b, s, sub] of items) {
    if (t < a || t > b + 0.3) continue;
    const al = smooth(a + 0.12, a + 0.42, t) * (1 - smooth(b - 0.2, b + 0.08, t));
    if (al > 0.01) drawHL(s, 110, 172 + 14 * (1 - smooth(a + 0.12, a + 0.42, t)), 64, al, sub, 'GOLD  ·  历史上的大暴跌');
  }
}
function drawHistMarks(c, t) {
  const C = HS.crashes;
  C.forEach((cr, k) => {
    const [, end] = crashSpan(k);
    const fade = 1 - smooth(end - 0.05, end + 0.3, t);
    if (fade <= 0.01 || t < cr.t_peak - 0.1) return;
    // peak: marker + price tag
    const P = hp2(c, cr.peak_x, cr.peak[1]);
    if (P) {
      const u = expoOut((t - cr.t_peak) / 0.45);
      ctx.save(); ctx.globalAlpha = fade * clamp((t - cr.t_peak) / 0.12, 0, 1);
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = goldFill(-8, 8); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      const top = P.y - 26 - 34 * u;
      ctx.fillStyle = 'rgba(160,124,52,0.7)'; ctx.fillRect(P.x - 0.6, top, 1.2, P.y - 12 - top);
      const lbl = '$' + fmt(cr.peak[1]);
      halo(lbl, P.x, top - 10, F.num(50), 'center', 14); goldText(lbl, P.x, top - 10, F.num(50), 50, 'center');
      halo(ymDate(cr.peak[0]) + ' 见顶', P.x, top - 66, F.cnB(24), 'center', 10, 1);
      text(ymDate(cr.peak[0]) + ' 见顶', P.x, top - 66, F.cnB(24), rgba(SOFT, 1), 'center', 1);
      ctx.restore();
    }
    // low: dashed drop from the peak level + slam
    if (t >= cr.t_low - 0.2) {
      const yPk = wY(c, lg(cr.peak[1])), yB = wY(c, lg(cr.low[1]));
      const Q = proj(c, cr.low_x, yPk), B = proj(c, cr.low_x, yB);
      if (P && Q && B) {
        const grow = easeOutCubic((t - cr.t_low + 0.2) / 0.45), env = fade * (cr.t_rec ? 1 - smooth(cr.t_rec - 0.2, cr.t_rec + 0.2, t) * 0.7 : 1);
        ctx.save(); ctx.globalAlpha = env; ctx.setLineDash([3, 8]); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(176,136,60,0.7)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(lerp(P.x, Q.x, grow), lerp(P.y, Q.y, grow)); ctx.stroke();
        ctx.setLineDash([]);
        const yy = lerp(Q.y, B.y, grow);
        ctx.strokeStyle = rgba(JADE, 0.9); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(Q.x, Q.y); ctx.lineTo(B.x, yy); ctx.stroke();
        ctx.fillStyle = rgba(JADE, 0.95 * grow); ctx.beginPath(); ctx.moveTo(B.x, yy + 4); ctx.lineTo(B.x - 9, yy - 12); ctx.lineTo(B.x + 9, yy - 12); ctx.closePath(); ctx.fill();
        ctx.restore();
        const sy = clamp(B.y + 170, 360, H - 230);
        slamText('−' + Math.abs(cr.dd) + '%', B.x - 70, sy, cr.t_low, t, cr.t_rec ? cr.t_rec + 0.2 : end, 130, '最低 $' + fmt(cr.low[1]) + ' · ' + ymDate(cr.low[0]));
      }
    }
    // recovery: a bar along the old high, from the peak to the day it was taken back
    if (cr.t_rec && t >= cr.t_rec - 0.05) {
      const yPk = wY(c, lg(cr.peak[1])), R = proj(c, cr.rec_x, yPk);
      if (P && R) {
        const grow = easeOutCubic((t - cr.t_rec + 0.05) / 0.4);
        const xr = lerp(P.x, R.x, grow), yr = lerp(P.y, R.y, grow);
        ctx.save(); ctx.globalAlpha = fade;
        ctx.strokeStyle = goldFill(P.y - 10, P.y + 10); ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(xr, yr); ctx.stroke();
        for (const q of [P, { x: xr, y: yr }]) { ctx.fillStyle = rgba(GOLD, 1); ctx.fillRect(q.x - 1.5, q.y - 14, 3, 28); }
        const u = (t - cr.t_rec - 0.25) / 0.3;
        if (u > 0) {
          const mx = (P.x + R.x) / 2, my = Math.min(P.y, R.y) - 30, sc = lerp(1.6, 1, easeOutBack(u, 1.8));
          ctx.translate(mx, my); ctx.scale(sc, sc); ctx.globalAlpha = fade * clamp(u * 2, 0, 1);
          const f1 = F.cnB(32), f2 = F.num(64), s1 = '回本用了 ', w1 = width(s1, f1), w2 = width(cr.ylabel, f2);
          halo(s1, -(w1 + w2) / 2, 0, f1, 'left', 12); halo(cr.ylabel, -(w1 + w2) / 2 + w1, 4, f2, 'left', 16);
          text(s1, -(w1 + w2) / 2, 0, f1, rgba(INK, 1)); goldText(cr.ylabel, -(w1 + w2) / 2 + w1, 4, f2, 64);
          halo(ymDate(cr.rec) + ' 重回 $' + fmt(cr.peak[1]), 0, 40, F.cnB(24), 'center', 10);
          text(ymDate(cr.rec) + ' 重回 $' + fmt(cr.peak[1]), 0, 40, F.cnB(24), rgba(SOFT, 1), 'center');
        }
        ctx.restore();
      }
    }
    // 1980: the first two years alone took 65%
    if (cr.t_mid && t > cr.t_mid && t < cr.t_low) {
      const M = hp2(c, cr.mid_x, cr.mid[1]); const a = smooth(cr.t_mid, cr.t_mid + 0.2, t) * (1 - smooth(cr.t_low - 0.5, cr.t_low - 0.1, t));
      if (M && a > 0.01) {
        const s = cr.n === 2 ? '两年跌掉 65%' : '两天暴跌 13%';
        ctx.save(); ctx.globalAlpha = a; halo(s, M.x + 20, M.y + 50, F.cnB(34), 'left', 12); text(s, M.x + 20, M.y + 50, F.cnB(34), rgba(JADE_D, 1)); ctx.restore();
      }
    }
    // 2026: the open question
    if (!cr.t_rec && t > cr.t_low + 0.6 && t < HS.table + 0.3) {
      const B = hp2(c, cr.low_x, cr.low[1]); const a = smooth(cr.t_low + 0.6, cr.t_low + 0.9, t) * (1 - smooth(HS.table - 0.1, HS.table + 0.2, t));
      if (B && a > 0.01) { ctx.save(); ctx.globalAlpha = a; halo('回本要多久？', B.x - 30, B.y + 70, F.cn(48), 'right', 16); goldText('回本要多久？', B.x - 30, B.y + 70, F.cn(48), 48, 'right'); ctx.restore(); }
    }
  });
}
function drawHistFx(c, t) {
  let flash = 0;
  for (const cr of HS.crashes) {
    const P = hp2(c, cr.peak_x, cr.peak[1]);
    const ap = t - cr.t_peak;
    if (ap > -0.1 && ap < 1.6) { raysAt(P, t, cr.t_peak, cr.n === 2 ? 1.2 : 0.8); ringAt(P, ap / 0.9, GOLD, 300, 1, 4); if (ap >= 0) flash = Math.max(flash, 0.14 * Math.exp(-ap / 0.2)); }
    const al = t - cr.t_low;
    if (al > 0 && al < 1.2) { ringAt(hp2(c, cr.low_x, cr.low[1]), al / 0.8, JADE, 420, 0.33); flash = Math.max(flash, 0.1 * Math.exp(-al / 0.15)); }
    if (cr.t_rec) { const ar = t - cr.t_rec; if (ar > 0 && ar < 1.0) ringAt(hp2(c, cr.rec_x, cr.peak[1]), ar / 0.7, GOLD, 240, 1, 3); }
  }
  // the 1980 bubble bursts on the second drop
  const age = t - HS.drop, o = BUBS[1] && BUBS[1].origin;
  if (age >= 0 && age < 0.7 && o) {
    flash = Math.max(flash, 0.7 * Math.exp(-age / 0.12));
    const u = age / 0.6;
    if (u < 1) { ctx.strokeStyle = `rgba(255,252,240,${0.95 * (1 - u)})`; ctx.lineWidth = 7 * (1 - u) + 1; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + expoOut(u) * 560, 0, 7); ctx.stroke(); }
  }
  flashFill(flash);
}
function drawTable(t) {
  const t0 = HS.table; if (t < t0 - 0.15) return;
  const a = smooth(t0 - 0.15, t0 + 0.2, t) * (1 - smooth(LV.t0 - 0.25, LV.t0, t));
  if (a < 0.01) return;
  veil(t, a * 0.9);
  const P = HK.beat, C = HS.crashes, x0 = 330, x1 = 1590, y0 = 205;
  ctx.save(); ctx.globalAlpha = a;
  text('黄金历次大暴跌', W / 2, y0, F.cn(60), rgba(INK, 1), 'center', 6);
  text('最大跌幅 · 回到前高用了多久（美元/盎司）', W / 2, y0 + 50, F.cnB(28), rgba(SOFT, 1), 'center', 2);
  const cols = [x0 + 60, x0 + 470, x0 + 820, x0 + 1110], hy = y0 + 120;
  ['顶点', '见顶价', '最大跌幅', '回本用时'].forEach((s, k) => text(s, cols[k], hy, F.cnB(26), rgba(FAINT, 1), k ? 'center' : 'left', 2));
  goldRule(x0, x1, hy + 18);
  C.forEach((cr, k) => {
    const u = (t - (t0 + 0.15 + k * P / 2)) / 0.3; if (u <= 0) return;
    const y = hy + 84 + k * 82, now = !cr.t_rec;
    ctx.save(); ctx.globalAlpha = a * clamp(u * 2, 0, 1); ctx.translate(0, 18 * (1 - easeOutCubic(u)));
    if (now) { rrect(x0 - 10, y - 56, x1 - x0 + 20, 78, 12); ctx.fillStyle = 'rgba(214,150,28,0.10)'; ctx.fill(); }
    text(cr.label + (now ? '（现在）' : ''), cols[0], y, F.cn(42), rgba(INK, 1));
    text('$' + fmt(cr.peak[1]), cols[1], y, F.num(44), rgba(SOFT, 1), 'center');
    text('−' + Math.abs(cr.dd) + '%', cols[2], y, F.numI(52), rgba(JADE, 1), 'center');
    if (now) goldText('？', cols[3], y, F.cn(52), 52, 'center');
    else (cr.n === 2 ? goldText : (s, x, y2, f) => text(s, x, y2, f, rgba(INK, 1), 'center'))(cr.ylabel, cols[3], y, F.cn(46), 46, 'center');
    ctx.restore();
  });
  const u = (t - (t0 + 0.15 + 3.5 * P)) / 0.5;
  if (u > 0) { ctx.globalAlpha = a * clamp(u, 0, 1); text('快的一年多，慢的要等几十年', W / 2, hy + 84 + 6 * 82 + 30, F.cnB(40), rgba(OX, 1), 'center', 4); }
  ctx.restore();
}

// the head chip steps aside while a crash's own labels are on screen
function histChipVis(t) {
  let v = 1;
  for (const cr of HS.crashes) {
    v *= 1 - bump(t, cr.t_peak, 0.15, 1.1, 0.3);
    if (cr.t_rec) v *= 1 - bump(t, cr.t_rec, 0.2, 1.4, 0.3);
    if (cr.t_mid) v *= 1 - bump(t, cr.t_mid, 0.15, 1.0, 0.3);
  }
  return v;
}
