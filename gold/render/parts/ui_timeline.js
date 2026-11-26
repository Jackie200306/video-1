// ================================================================ 2023 -> 2026 timeline, "now", rewind to 1971
let EV = [];
const KIND = {
  info: { badge: '美联储', col: [176, 136, 60] }, shock: { badge: '突发', col: OX }, milestone: { badge: '里程碑', col: GOLD },
  crash: { badge: '暴跌', col: JADE }, dip: { badge: '回调', col: JADE }, bounce: { badge: '反弹', col: GOLD }, peak: { badge: '历史最高', col: OX },
};
const SLAMS = { '2025-10-21': '单日 −6%', '2026-01-30': '单日 −9%' };
function cnDate(iso) { const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; }
function prepTimeline() {
  EV = TLN.events.map((e, k) => Object.assign({}, e, { k }));
  for (let k = 0; k < EV.length; k++) {
    const e = EV[k], nx = EV[k + 1];
    e.tend = nx ? Math.min(e.t + 3.4, nx.t + 1.1) : NS.overview + 0.2;
    if (e.kind === 'info' && !/美联储|沃什/.test(e.title)) e.badgeText = '消息';
    // card position: beside the head when the card appears
    const i0 = Math.round((e.t + 0.05) * FPS), c = camAt(i0); DS = c.tr.ds; CAM = c.tr;
    const p = projDay(c, c.D);
    e.cardX = p ? p.x : W * 0.6; e.cardY = p ? p.y : H * 0.45;
  }
}
function measureCard(e) {
  const L = {};
  L.badge = e.badgeText || KIND[e.kind].badge;
  L.bw = width(L.badge, F.cnB(24)) + 24;
  L.dw = width(cnDate(e.date), F.cnB(24));
  if (e.kind === 'peak') { L.title = '¥' + fmt(PEAK.cny) + ' /克'; L.tf = F.num(66); L.ts = 66; }
  else { L.title = e.title; L.ts = 48; L.tf = F.cn(48); }
  L.tw = width(L.title, L.tf);
  if (L.tw > 600) { L.ts = Math.floor(L.ts * 600 / L.tw); L.tf = F.cn(L.ts); L.tw = width(L.title, L.tf); }
  L.sub = e.kind === 'peak' ? '$' + fmt(PEAK.usd) + ' / 盎司 · ' + e.sub : e.sub;
  L.sw = width(L.sub, F.cnB(27));
  L.price = e.kind === 'peak' ? '' : '$' + fmt(e.usd) + ' / 盎司 · ¥' + fmt(e.cny) + ' / 克';
  L.pw = L.price ? width(L.price, F.num(26)) : 0;
  L.w = Math.max(L.bw + 14 + L.dw, L.tw, L.sw, L.pw) + 64;
  L.h = 26 + 36 + 14 + Math.round(L.ts * 1.15) + 40 + (L.price ? 38 : 0) + 18;
  return L;
}
function drawCard(e, L, x, y, sc, alpha) {
  const ac = KIND[e.kind].col;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  rrect(0, 0, L.w, L.h, 12); ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(190,150,70,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  if (e.kind === 'peak' || e.kind === 'milestone') ctx.fillStyle = goldFill(0, L.h); else ctx.fillStyle = rgba(ac, 1);
  rrect(0, 0, 6, L.h, 3); ctx.fill();
  let yy = 26;
  rrect(30, yy, L.bw, 36, 7); ctx.fillStyle = rgba(ac, 1); ctx.fill();
  text(L.badge, 42, yy + 26, F.cnB(24), '#fff');
  text(cnDate(e.date), 30 + L.bw + 14, yy + 26, F.cnB(24), rgba(SOFT, 1));
  yy += 36 + 14 + L.ts;
  if (e.kind === 'peak') goldText(L.title, 30, yy, L.tf, L.ts);
  else text(L.title, 30, yy, L.tf, rgba(INK, 1));
  yy += 44;
  text(L.sub, 30, yy, F.cnB(27), rgba(e.kind === 'crash' || e.kind === 'dip' ? JADE_D : SOFT, 1));
  if (L.price) { yy += 38; text(L.price, 30, yy, F.num(26), rgba(FAINT, 1)); }
  ctx.restore();
}
function drawCards(c, t) {
  // the newest card sits beside the head; the previous one fades out underneath it
  const vis = EV.filter(e => t >= e.t && t < e.tend + 0.45).sort((a, b) => a.t - b.t).slice(-2);
  vis.forEach((e, n) => {
    if (!e._L) e._L = measureCard(e);
    const L = e._L, newest = n === vis.length - 1;
    const appear = easeOutBack((t - e.t) / 0.36, 1.3);
    let a = smooth(e.t, e.t + 0.2, t) * (1 - smooth(e.tend, e.tend + 0.45, t));
    if (!newest) { const nw = vis[vis.length - 1]; a *= 1 - smooth(nw.t - 0.02, nw.t + 0.22, t); }
    if (a < 0.01) return;
    const x = clamp(e.cardX + 70, 60, W - L.w - 60), y = clamp(e.cardY - L.h * 0.55, 150, H - L.h - 210);
    const slide = (1 - appear) * 60;
    const p = projDay(c, e.i);
    if (p) {
      const cx = x + slide, cy = y + L.h * 0.5;
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(176,136,60,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, cx, 0.55), cy); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = rgba(KIND[e.kind].col, 1); ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = rgba(KIND[e.kind].col, 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 10 + 3 * Math.sin(t * 6), 0, 7); ctx.stroke();
      ctx.restore();
    }
    drawCard(e, L, x + slide, y, lerp(0.92, 1, appear), a);
  });
}
// chapter headline, top left (same treatment as the hook's 「黄金，一路狂飙」)
function parseHL(s) { const out = []; let hl = false, buf = ''; for (const ch of s) { if (ch === '{' || ch === '}') { if (buf) out.push([buf, hl]); buf = ''; hl = ch === '{'; } else buf += ch; } if (buf) out.push([buf, hl]); return out; }
function drawHL(s, x, y, size, a, sub, cap) {
  ctx.save(); ctx.globalAlpha = a;
  if (cap) { ctx.fillStyle = 'rgba(190,150,70,0.9)'; ctx.fillRect(x, y - size - 34, 46, 1.5); text(cap, x + 60, y - size - 25, F.caps(600, 22), rgba(GOLD_D, 1), 'left', 5); }
  let xx = x; const f = F.cn(size);
  for (const [seg, hl] of parseHL(s)) {
    halo(seg, xx, y, f, 'left', 16);
    xx += hl ? goldText(seg, xx, y, f, size) : shadowText(seg, xx, y, f, rgba(INK, 1), 'left', 0, 0.12);
  }
  if (sub) { halo(sub, x, y + 54, F.cnB(30), 'left', 10); text(sub, x, y + 54, F.cnB(30), rgba(SOFT, 1)); }
  ctx.restore();
}
function drawChapters(t) {
  const chs = TLN.chapters;
  for (let k = 0; k < chs.length; k++) {
    const ch = chs[k], nx = chs[k + 1], tout = nx ? nx.t : NS.overview + 0.4;
    if (t < ch.t || t > tout + 0.3) continue;
    const a = smooth(ch.t, ch.t + 0.4, t) * (1 - smooth(tout - 0.05, tout + 0.25, t));
    if (a > 0.01) drawHL(ch.text, 110, 170 + 14 * (1 - smooth(ch.t, ch.t + 0.4, t)), 68, a, null, 'GOLD  ·  国际金价');
  }
}
// event effects on the daily chart
function ringAt(p, u, col, R, flat = 1, w = 5) {
  if (!p || u <= 0 || u >= 1) return;
  ctx.strokeStyle = rgba(col, (1 - u) * 0.85); ctx.lineWidth = w * (1 - u) + 1;
  const r = 24 + R * easeOutCubic(u); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * flat, 0, 0, 7); ctx.stroke();
}
function raysAt(p, t, t0, scale) {
  const age = t - t0, ra = bump(t, t0 + 0.05, 0.1, 0.5, 0.7) * 0.5 * scale;
  if (!p || ra < 0.01) return;
  const nR = 18, rot = t * 0.4 + t0;
  for (let k = 0; k < nR; k++) {
    const ang = rot + k * Math.PI * 2 / nR, len = (260 + 180 * hash(k + 3)) * scale * (0.6 + 0.4 * easeOutCubic(age / 0.6));
    const g = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
    g.addColorStop(0, rgba(GOLD_HALO, ra)); g.addColorStop(1, rgba(GOLD_HALO, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(ang - 0.03) * len, p.y + Math.sin(ang - 0.03) * len);
    ctx.lineTo(p.x + Math.cos(ang + 0.03) * len, p.y + Math.sin(ang + 0.03) * len); ctx.closePath(); ctx.fill();
  }
}
function flashFill(a, col = [255, 250, 236]) { if (a > 0.003) { ctx.fillStyle = rgba(col, a); ctx.fillRect(0, 0, W, H); } }
function drawTimelineFx(c, t) {
  let flash = 0;
  for (const e of EV) {
    const age = t - e.t; if (age < -0.1 || age > 1.6) continue;
    const p = projDay(c, e.i);
    if (e.kind === 'peak') { raysAt(p, t, e.t, 1.1); ringAt(p, age / 0.9, GOLD, 380, 1, 4); flash = Math.max(flash, age >= 0 ? 0.2 * Math.exp(-age / 0.2) : 0); }
    else if (e.kind === 'crash') { ringAt(p, age / 0.8, JADE, 420, 0.33); flash = Math.max(flash, age >= 0 ? 0.12 * Math.exp(-age / 0.15) : 0); }
    else if (e.kind === 'milestone') { ringAt(p, age / 0.7, GOLD, 220, 1, 3); }
    else if (e.kind === 'shock') { ringAt(p, age / 0.7, OX, 260, 0.6, 3); }
  }
  flashFill(flash);
}
function slamText(s, x, y, t0, t, tOut, size = 120, sub = null, col = JADE) {
  const age = t - t0; if (age < 0) return;
  const out = smooth(tOut, tOut + 0.3, t); if (out >= 1) return;
  const u = age / 0.24, sc = lerp(2.0, 1.0, easeOutBack(u, 2.0)), settle = smooth(0.9, 1.4, age);
  const sz = size * lerp(1, 0.8, settle);
  ctx.save(); ctx.globalAlpha = smooth(0, 0.08, age) * (1 - out); ctx.translate(x, y); ctx.scale(sc, sc);
  halo(s, 0, 0, F.numI(sz), 'right', 18);
  ctx.save(); ctx.shadowColor = rgba(col, 0.35); ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; text(s, 0, 0, F.numI(sz), rgba(col, 1), 'right'); ctx.restore();
  if (sub) { halo(sub, -6, -sz * 0.8, F.cnB(28), 'right', 10, 2); text(sub, -6, -sz * 0.8, F.cnB(28), rgba(SOFT, 1), 'right', 2); }
  ctx.restore();
}
function drawTimelineSlams(c, t) {
  for (const e of EV) {
    const s = SLAMS[e.date]; if (!s || t < e.t || t > e.tend + 0.5) continue;
    const p = projDay(c, e.i); if (!p) continue;
    const [lbl, num] = s.split(' ');
    slamText(num, p.x - 90, clamp(p.y + 210, 340, H - 230), e.t + 0.02, t, e.tend, 96, lbl);
  }
  // the landing: bracket from the high and the drawdown
  const t0 = NS.card + HK.beat * 2;
  if (t > t0 - 0.2 && t < NS.question + 0.3) {
    const env = smooth(t0 - 0.2, t0 + 0.05, t) * (1 - smooth(NS.overview, NS.overview + 0.4, t));
    if (env > 0.01) {
      const yPk = wY(c, PEAK.cny), yB = wY(c, NOW.cny);
      const P = proj(c, PEAK.i, yPk), Q = proj(c, NOW.i + 12, yPk), B = proj(c, NOW.i + 12, yB);
      if (Q && B) {
        const grow = easeOutCubic((t - t0 + 0.2) / 0.45);
        ctx.save(); ctx.globalAlpha = env; ctx.setLineDash([3, 8]); ctx.lineCap = 'round';
        if (P) { ctx.strokeStyle = 'rgba(176,136,60,0.7)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(lerp(P.x, Q.x, grow), lerp(P.y, Q.y, grow)); ctx.stroke(); }
        ctx.setLineDash([]);
        const yy = lerp(Q.y, B.y, grow);
        ctx.strokeStyle = rgba(JADE, 0.9); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(Q.x, Q.y); ctx.lineTo(B.x, yy); ctx.stroke();
        ctx.fillStyle = rgba(JADE, 0.95 * grow); ctx.beginPath(); ctx.moveTo(B.x, yy + 4); ctx.lineTo(B.x - 9, yy - 12); ctx.lineTo(B.x + 9, yy - 12); ctx.closePath(); ctx.fill();
        ctx.restore();
        const dd = Math.abs((NOW.cny / PEAK.cny - 1) * 100).toFixed(1);
        slamText('−' + dd + '%', B.x - 34, clamp((Q.y + B.y) / 2 + 20, 300, H - 300), t0, t, NS.overview, 140, '从最高点回落');
      }
    }
  }
}
// ---- "now": the price in both units, then the question, then back to 1971
function veil(t, a) {
  if (a <= 0.003) return;
  SNAPX.clearRect(0, 0, W, H); SNAPX.drawImage(cv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a; ctx.filter = 'blur(12px)'; ctx.drawImage(SNAP, 0, 0); ctx.filter = 'none';
  ctx.fillStyle = `rgba(251,248,241,${0.66 * a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function drawConvert(t) {
  const t0 = NS.convert, P = HK.beat; if (t < t0 - 0.2 || t > NS.question + 0.5) return;
  const a = smooth(t0 - 0.2, t0 + 0.15, t) * (1 - smooth(NS.question - 0.15, NS.question + 0.2, t));
  if (a < 0.01) return;
  veil(t, a * 0.85);
  ctx.save(); ctx.globalAlpha = a;
  const cx = W / 2, rows = [
    [t0, () => { text('2026年11月25日 · 现在的金价', cx, 250, F.cnB(32), rgba(SOFT, 1), 'center', 3); }],
    [t0, () => { const w1 = width('¥' + fmt(NOW.cny), F.num(120)), w2 = width(' / 克', F.cnB(40)), x = cx - (w1 + w2) / 2;
      shadowText('¥' + fmt(NOW.cny), x, 380, F.num(120), rgba(INK, 1), 'left', 0, 0.12); text(' / 克', x + w1, 376, F.cnB(40), rgba(SOFT, 1)); }],
    [t0 + P, () => { text('×  31.1035  克 / 盎司', cx, 470, F.num(50), rgba(SOFT, 1), 'center'); }],
    [t0 + 2 * P, () => { text('÷  ' + NS.fx.toFixed(2) + '  人民币 / 美元', cx, 548, F.num(50), rgba(SOFT, 1), 'center'); }],
    [t0 + 3 * P, () => { goldRule(cx - 360, cx + 360, 590); const w1 = width('≈ $' + fmt(NOW.usd), F.num(130)), w2 = width(' / 盎司', F.cnB(42)), x = cx - (w1 + w2) / 2;
      goldText('≈ $' + fmt(NOW.usd), x, 726, F.num(130), 130); text(' / 盎司', x + w1, 722, F.cnB(42), rgba(SOFT, 1)); }],
    [t0 + 4 * P, () => { text('比最高点 $' + fmt(PEAK.usd) + ' 跌了 ' + Math.abs(Math.round((NOW.usd / PEAK.usd - 1) * 100)) + '%', cx, 800, F.cnB(36), rgba(JADE, 1), 'center', 2); }],
  ];
  for (const [ts, fn] of rows) {
    const u = (t - ts) / 0.3; if (u <= 0) continue;
    ctx.save(); ctx.globalAlpha = a * clamp(u * 2, 0, 1);
    const sc = lerp(1.25, 1, easeOutBack(u, 1.8)); ctx.translate(cx, 520); ctx.scale(sc, sc); ctx.translate(-cx, -520);
    fn(); ctx.restore();
  }
  ctx.restore();
}
function drawQuestion2(t) {
  const Q = NS.question, P = HK.beat; if (t < Q - 0.15 || t > NS.rewind + 0.4) return;
  const out = smooth(NS.rewind, NS.rewind + 0.35, t);
  const dimA = smooth(Q - 0.15, Q + 0.2, t) * (1 - out);
  veil(t, dimA);
  ctx.save();
  const parts = [['现在，', 0], ['可以', 0.5], ['入场了吗', 1.0], ['？', 1.0]];
  const push = 1 + 0.04 * smooth(Q, NS.rewind, t);
  ctx.translate(W / 2, 520); ctx.scale(push, push); ctx.translate(-W / 2, -520);
  const size = 160, font = F.cn(size), cy = 520 - 40 * out;
  const tot = parts.reduce((a, p) => a + width(p[0], font), 0); let x = W / 2 - tot / 2;
  for (const [s, dl] of parts) {
    const w = width(s, font), u = (t - (Q + dl * P)) / 0.3;
    if (u > 0) {
      ctx.save(); ctx.globalAlpha = (1 - out) * clamp(u * 2, 0, 1);
      const sc = lerp(1.5, 1, easeOutBack(u, 1.8)); ctx.translate(x + w / 2, cy); ctx.scale(sc, sc);
      if (s === '？') { ctx.rotate(0.1 * Math.sin(t * 9) * beatPulse(t)); goldText(s, -w / 2, 0, font, size); }
      else shadowText(s, -w / 2, 0, font, rgba(INK, 1), 'left', 0, 0.14);
      ctx.restore();
    }
    x += w;
  }
  const su = expoOut((t - NS.sub) / 0.6);
  if (su > 0) {
    ctx.save(); ctx.globalAlpha = (1 - out) * su;
    const y1 = cy + 140 + 14 * (1 - su);
    text('先别急。', W / 2, y1, F.cnB(52), rgba(OX, 1), 'center', 4);
    text('看看历史：黄金每次暴跌之后，多久才回本？', W / 2, y1 + 78, F.cnB(46), rgba(SOFT, 1), 'center', 2);
    goldRule(W / 2 - 520, W / 2 + 520, y1 + 112, su);
    ctx.restore();
  }
  ctx.restore();
}
function drawRewind2(t) {
  const R0 = NS.rewind + 0.15, R1 = NS.cut; if (t < R0 || t > R1 + 0.1) return;
  const a = smooth(R0, R0 + 0.25, t) * (1 - smooth(R1 - 0.12, R1, t));
  ctx.save(); ctx.globalAlpha = a;
  for (const s of STREAKS) {
    const x = -400 + ((s.ph + (t - R0) * s.v * 1.3) % (W + 1200));
    const g = ctx.createLinearGradient(x, 0, x + s.l, 0); g.addColorStop(0, 'rgba(196,154,66,0)'); g.addColorStop(1, `rgba(196,154,66,${s.a})`);
    ctx.fillStyle = g; ctx.fillRect(x, s.y, s.l, 1.5);
  }
  const cx = W / 2, cy = 470;
  halo('时间再倒回', cx, cy - 70, F.cn(62), 'center', 18, 8);
  shadowText('时间再倒回', cx, cy - 70, F.cn(62), rgba(INK, 1), 'center', 8, 0.14);
  // year counter rolling back from 2026 to 1971
  const u = easeInOut((t - R0) / (R1 - R0 - 0.05)), yr = Math.round(lerp(2026, 1971, u));
  halo(String(yr), cx, cy + 130, F.num(200), 'center', 24, 10);
  goldText(String(yr), cx, cy + 130, F.num(200), 200, 'center', 10);
  text('REWIND', cx, cy + 186, F.caps(600, 24), rgba(GOLD_D, 1), 'center', 10);
  ctx.restore();
}
