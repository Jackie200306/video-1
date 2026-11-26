// ================================================================ 2D scenes: leverage & liquidation cascade, inflation, outro
function bg2D(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FCFAF5'); g.addColorStop(0.6, '#F6F0E4'); g.addColorStop(1, '#EDE3D0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const k = ctx.createRadialGradient(W * 0.55, -260, 80, W * 0.55, -260, 1500);
  k.addColorStop(0, 'rgba(255,255,255,0.95)'); k.addColorStop(0.5, 'rgba(255,253,246,0.35)'); k.addColorStop(1, 'rgba(255,253,246,0)');
  ctx.fillStyle = k; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  drawBokeh({ Lx: t * 40 }, t);
}
const fadeIO = (t, a, b, fi = 0.3, fo = 0.3) => smooth(a, a + fi, t) * (1 - smooth(b - fo, b, t));
const pop = (t, t0, d = 0.3, s = 1.8) => easeOutBack((t - t0) / d, s);
function popText(fn, t, t0, cx, cy, from = 1.35) {
  const u = (t - t0) / 0.3; if (u <= 0) return;
  ctx.save(); ctx.globalAlpha *= clamp(u * 2, 0, 1);
  const sc = lerp(from, 1, easeOutBack(u, 1.8)); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  fn(); ctx.restore();
}
function stamp(s, x, y, t0, t, size = 150, col = OX, rot = -0.12) {
  const u = (t - t0) / 0.18; if (u <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const sc = lerp(2.4, 1, easeOutCubic(u)); ctx.scale(sc, sc);
  ctx.globalAlpha *= clamp(u * 3, 0, 1);
  const f = F.cn(size), w = width(s, f, 10) + 70, h = size * 1.25;
  ctx.strokeStyle = rgba(col, 0.92); ctx.lineWidth = 9; rrect(-w / 2, -h / 2 - size * 0.35, w, h, 16); ctx.stroke();
  ctx.lineWidth = 3; rrect(-w / 2 + 12, -h / 2 - size * 0.35 + 12, w - 24, h - 24, 10); ctx.stroke();
  text(s, 0, 0, f, rgba(col, 0.95), 'center', 10);
  ctx.restore();
}
// ---------------------------------------------------------------- leverage
function drawLeverage(t) {
  const P = HK.beat, L = LV;
  // A. 为什么会暴跌？ -> 关键词：杠杆
  {
    const a = fadeIO(t, L.t0, L.example + 0.2, 0.2, 0.35);
    if (a > 0.01) {
      ctx.save(); ctx.globalAlpha = a;
      popText(() => shadowText('为什么会暴跌？', W / 2, 470, F.cn(130), rgba(INK, 1), 'center', 6, 0.14), t, L.t0, W / 2, 430);
      popText(() => { const f = F.cn(84), w1 = width('关键词：', f), w2 = width('杠杆', f); const x = W / 2 - (w1 + w2) / 2;
        shadowText('关键词：', x, 640, f, rgba(SOFT, 1), 'left', 0, 0.1); goldText('杠杆', x + w1, 640, f, 84); }, t, L.t0 + 2 * P, W / 2, 610, 1.6);
      ctx.restore();
    }
  }
  // B. the 10x example
  const exA = fadeIO(t, L.example, L.cascade + 0.1, 0.25, 0.4);
  if (exA > 0.01) {
    ctx.save(); ctx.globalAlpha = exA;
    drawHL('用 {10 倍杠杆} 买黄金', 110, 190, 64, 1, null, 'GOLD  ·  暴跌的推手');
    const bx = 470, base = 900, unit = 5.6;                 // ¥1 万 = 5.6 px
    const fall = smooth(L.fall, L.fall + 2.2 * P, t);        // price −10%
    const own = 10 * (1 - fall), borrowed = 90, total = own + borrowed;
    const hOwn = own * unit, hB = borrowed * unit;
    const uB = easeOutCubic((t - (L.example + P)) / 0.35), uO = easeOutCubic((t - L.example) / 0.35);
    // own money (gold), then borrowed money (grey, hatched) stacked on top
    if (uO > 0) {
      ctx.save(); ctx.shadowColor = 'rgba(110,80,30,0.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = goldFill(base - hOwn * uO, base); rrect(bx - 120, base - hOwn * uO, 240, Math.max(1, hOwn * uO), 6); ctx.fill(); ctx.restore();
      if (own > 0.4) { text('本金', bx - 150, base - hOwn / 2 + 4, F.cnB(30), rgba(SOFT, 1), 'right'); text('¥' + own.toFixed(own < 10 ? 1 : 0) + ' 万', bx - 150, base - hOwn / 2 + 40, F.num(38), rgba(GOLD_D, 1), 'right'); }
    }
    if (uB > 0) {
      const top = base - hOwn - hB * uB;
      ctx.save(); ctx.fillStyle = 'rgba(160,150,135,0.28)'; rrect(bx - 120, top, 240, hB * uB, 6); ctx.fill();
      ctx.beginPath(); rrect(bx - 120, top, 240, hB * uB, 6); ctx.clip();
      ctx.strokeStyle = 'rgba(120,108,90,0.35)'; ctx.lineWidth = 2;
      for (let k = -30; k < 40; k++) { ctx.beginPath(); ctx.moveTo(bx - 120 + k * 18, top); ctx.lineTo(bx - 120 + k * 18 + 600, top + 600); ctx.stroke(); }
      ctx.restore();
      text('借来的钱', bx - 150, top + hB * uB / 2, F.cnB(30), rgba(SOFT, 1), 'right');
      text('¥90 万', bx - 150, top + hB * uB / 2 + 40, F.num(38), rgba(INK, 0.8), 'right');
    }
    // the gold you hold
    const u3 = (t - (L.example + 2 * P)) / 0.3;
    if (u3 > 0) {
      ctx.save(); ctx.globalAlpha = exA * clamp(u3 * 2, 0, 1);
      const top = base - total * unit;
      ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx + 150, top); ctx.lineTo(bx + 170, top); ctx.lineTo(bx + 170, base); ctx.lineTo(bx + 150, base); ctx.stroke();
      text('买入黄金', bx + 200, (top + base) / 2 - 18, F.cnB(32), rgba(SOFT, 1));
      goldText('¥' + total.toFixed(0) + ' 万', bx + 200, (top + base) / 2 + 42, F.num(64), 64);
      ctx.restore();
    }
    // right: price −10% and what it does to you
    const rx = 1180;
    if (t > L.fall - 0.1) {
      const a2 = smooth(L.fall - 0.1, L.fall + 0.2, t);
      ctx.save(); ctx.globalAlpha = exA * a2;
      text('金价只跌了', rx, 420, F.cnB(40), rgba(SOFT, 1));
      text('−' + (10 * fall).toFixed(1) + '%', rx, 540, F.numI(120), rgba(JADE, 1));
      text('亏损 ¥' + (10 * fall).toFixed(1) + ' 万', rx, 620, F.cnB(44), rgba(INK, 1));
      if (fall > 0.98) text('= 你的本金全部亏光', rx, 690, F.cn(50), rgba(OX, 1));
      ctx.restore();
    }
    stamp('爆仓', rx + 300, 880, L.boom, t, 120, OX, -0.14);
    const u4 = (t - (L.boom + P)) / 0.3;
    if (u4 > 0) { ctx.save(); ctx.globalAlpha = exA * clamp(u4 * 2, 0, 1); text('券商强制卖掉你的黄金', rx, 960, F.cnB(40), rgba(OX, 1)); ctx.restore(); }
    ctx.restore();
  }
  // C. the cascade: each forced sale knocks the price into the next layer of margin calls
  const caA = fadeIO(t, L.cascade, L.loop + 0.1, 0.25, 0.4);
  if (caA > 0.01) {
    ctx.save(); ctx.globalAlpha = caA;
    drawHL('一个人爆仓，{一群人}跟着爆', 110, 190, 64, 1, null, 'GOLD  ·  踩踏式下跌');
    const X0 = 300, X1 = 1480, Y0 = 300, Y1 = 900, pv = p => lerp(Y0, Y1, (100 - p) / 45);
    const layers = [[95, '20 倍杠杆'], [90, '10 倍杠杆'], [80, '5 倍杠杆'], [67, '3 倍杠杆']];
    // trigger beats: the gaps shrink as the fall accelerates
    const tr = [L.cascade + 2 * P, L.cascade + 3.5 * P, L.cascade + 4.5 * P, L.cascade + 5.25 * P];
    const tEnd = L.cascade + 6 * P;
    // price path keyed on the triggers
    const keys = [[L.cascade, 100], [tr[0], 95], [tr[1], 90], [tr[2], 80], [tr[3], 67], [tEnd, 56]];
    const priceAtT = tt => { if (tt <= keys[0][0]) return 100; for (let k = 0; k < keys.length - 1; k++) if (tt < keys[k + 1][0]) return lerp(keys[k][1], keys[k + 1][1], easeInOut((tt - keys[k][0]) / (keys[k + 1][0] - keys[k][0]))); return 56; };
    const xAt = tt => lerp(X0, X1, clamp((tt - L.cascade) / (tEnd - L.cascade + 0.3), 0, 1));
    layers.forEach(([lv, name], k) => {
      const y = pv(lv), hit = t >= tr[k], fl = hit ? bump(t, tr[k], 0.02, 0.1, 0.7) : 0;
      ctx.setLineDash([10, 10]); ctx.strokeStyle = hit ? rgba(OX, 0.55 + 0.45 * fl) : 'rgba(150,118,60,0.45)'; ctx.lineWidth = hit ? 2.5 + 3 * fl : 1.6;
      ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1 + 40, y); ctx.stroke(); ctx.setLineDash([]);
      text(name + ' · 跌 ' + (100 - lv) + '% 爆仓', X1 + 60, y + 10, F.cnB(28), rgba(hit ? OX : SOFT, 1));
      if (hit) {
        const age = t - tr[k], x = xAt(tr[k]);
        ringAt({ x, y }, age / 0.7, OX, 160, 1, 4);
        const u = easeOutBack(age / 0.25, 2.2);
        if (age < 1.6) {
          ctx.save(); ctx.globalAlpha = caA * (1 - smooth(1.1, 1.6, age)); ctx.translate(x - 20, y - 40 - 30 * easeOutCubic(age / 1.6)); ctx.scale(u, u);
          halo('强平！', 0, 0, F.cn(44), 'right', 14); text('强平！', 0, 0, F.cn(44), rgba(OX, 1), 'right');
          ctx.restore();
          // sell arrow pushing the price down
          const ay = y + 30, al = 90 * easeOutCubic(age / 0.4);
          ctx.save(); ctx.globalAlpha = caA * (1 - smooth(0.8, 1.4, age)); ctx.strokeStyle = rgba(OX, 0.9); ctx.fillStyle = rgba(OX, 0.9); ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(x + 30, ay); ctx.lineTo(x + 30, ay + al); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + 14, ay + al - 4); ctx.lineTo(x + 46, ay + al - 4); ctx.lineTo(x + 30, ay + al + 18); ctx.closePath(); ctx.fill();
          text('被迫卖出', x + 56, ay + al * 0.6, F.cnB(26), rgba(OX, 1));
          ctx.restore();
        }
      }
    });
    // the price line itself
    const tNow = Math.min(t, tEnd + 0.2);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, col] of [[18, 'rgba(240,178,50,0.12)'], [7, rgba(JADE, 0.95)], [2, 'rgba(230,255,240,0.9)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let tt = L.cascade; tt <= tNow; tt += 1 / 120) { const x = xAt(tt), y = pv(priceAtT(tt)) + 4 * Math.sin(tt * 37) * (1 - smooth(tr[0], tr[1], tt)); if (tt === L.cascade) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const hx = xAt(tNow), hy = pv(priceAtT(tNow));
    ctx.fillStyle = '#FFFDF4'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, 7); ctx.fill(); ctx.strokeStyle = rgba(JADE, 1); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    text('金价', X0 - 30, Y0 + 10, F.cnB(28), rgba(SOFT, 1), 'right');
    ctx.restore();
  }
  // D. the loop
  const loA = fadeIO(t, L.loop, L.t1, 0.3, 0.3);
  if (loA > 0.01) {
    ctx.save(); ctx.globalAlpha = loA;
    drawHL('这就是{踩踏}', 110, 190, 64, 1, null, 'GOLD  ·  死亡螺旋');
    const cx = 760, cy = 600, R = 250, nodes = ['价格下跌', '保证金不够', '强制卖出', '价格再跌'];
    const spin = (t - L.loop) * 1.3;
    ctx.strokeStyle = 'rgba(190,150,70,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    // a gold comet running round the loop
    for (let k = 0; k < 24; k++) {
      const ang = -Math.PI / 2 + spin * 2 - k * 0.05;
      ctx.fillStyle = rgba(GOLD_HALO, 0.6 * (1 - k / 24)); ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, 9 * (1 - k / 30), 0, 7); ctx.fill();
    }
    nodes.forEach((s, k) => {
      const ang = -Math.PI / 2 + k * Math.PI / 2, x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
      const u = (t - (L.loop + k * P)) / 0.3; if (u <= 0) return;
      ctx.save(); ctx.globalAlpha = loA * clamp(u * 2, 0, 1); ctx.translate(x, y); const sc = easeOutBack(u, 2); ctx.scale(sc, sc);
      const w = width(s, F.cn(40)) + 56;
      ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
      rrect(-w / 2, -40, w, 80, 40); ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rgba(k % 2 ? OX : JADE, 0.8); ctx.lineWidth = 2.5; ctx.stroke();
      text(s, 0, 14, F.cn(40), rgba(k % 2 ? OX : JADE_D, 1), 'center');
      ctx.restore();
      // arrow to the next node
      const a2 = ang + Math.PI / 4, ax = cx + Math.cos(a2) * R, ay = cy + Math.sin(a2) * R;
      ctx.save(); ctx.globalAlpha = loA * clamp(u * 2, 0, 1); ctx.translate(ax, ay); ctx.rotate(a2 + Math.PI / 2);
      ctx.fillStyle = rgba(GOLD, 0.9); ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(14, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    });
    const u5 = (t - (L.loop + 4 * P)) / 0.4;
    if (u5 > 0) {
      ctx.save(); ctx.globalAlpha = loA * clamp(u5 * 2, 0, 1);
      const x = 1180;
      text('这一轮也是这样：', x, 470, F.cnB(40), rgba(SOFT, 1));
      ['股市大跌，账户亏损', '券商追加保证金', '卖黄金换现金', '金价越跌越快'].forEach((s, k) => {
        const uu = (t - (L.loop + (4 + k * 0.5) * P)) / 0.3; if (uu <= 0) return;
        ctx.save(); ctx.globalAlpha = loA * clamp(uu * 2, 0, 1);
        text((k ? '→ ' : '') + s, x, 550 + k * 70, F.cn(46), rgba(k === 3 ? JADE_D : INK, 1)); ctx.restore();
      });
      ctx.restore();
    }
    ctx.restore();
  }
}
// ---------------------------------------------------------------- inflation
let INFL_PTS;
function prepInfl() {
  const m = INF.months, n = m.length, g0 = 35, c0 = INF.cpi[0];
  INFL_PTS = m.map((ym, k) => {
    const [y, mo] = ym.split('-').map(Number);
    return { yr: y + (mo - 1) / 12, g: INF.gold[k] / g0, c: INF.cpi[k] / c0 };
  });
  INFL_PTS.push({ yr: 2026 + 10.8 / 12, g: INF.gold_now / g0, c: INF.cpi_now / c0 });
}
function drawInflation(t) {
  const P = HK.beat, I = INF;
  const a = fadeIO(t, I.t0, I.t1, 0.3, 0.35);
  if (a < 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  drawHL('黄金，到底能不能{抗通胀}？', 110, 190, 64, 1, null, 'GOLD  ·  1971 — 2026');
  const X0 = 210, X1 = 1500, Y0 = 300, Y1 = 900;
  const xOf = yr => lerp(X0, X1, (yr - 1971) / (2027 - 1971)), yOf = v => lerp(Y1, Y0, Math.log10(v) / 2.15);
  const ua = smooth(I.chart - 0.2, I.chart + 0.2, t);
  ctx.save(); ctx.globalAlpha = a * ua;
  for (const v of [1, 2, 5, 10, 20, 50, 100]) {
    const y = yOf(v); ctx.strokeStyle = v === 1 || v === 10 || v === 100 ? 'rgba(150,118,60,0.22)' : 'rgba(150,118,60,0.09)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
    text('×' + v, X0 - 16, y + 9, F.num(26), rgba(FAINT, 1), 'right');
  }
  for (let y = 1980; y <= 2020; y += 10) { const x = xOf(y); text(String(y), x, Y1 + 40, F.num(28), rgba(SOFT, 1), 'center'); ctx.fillStyle = 'rgba(150,118,60,0.3)'; ctx.fillRect(x - 0.5, Y1, 1, 10); }
  ctx.restore();
  const prog = clamp((t - I.chart) / (I.labels - I.chart), 0, 1), yrNow = lerp(1971, 2026.9, easeInOut(prog));
  const line = (key, w, col, glow) => {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (glow) { ctx.strokeStyle = rgba(GOLD_HALO, 0.15); ctx.lineWidth = w * 4; ctx.beginPath(); INFL_PTS.forEach((p, k) => { if (p.yr > yrNow) return; const x = xOf(p.yr), y = yOf(p[key]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
    ctx.shadowColor = 'rgba(90,60,15,0.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    INFL_PTS.forEach((p, k) => { if (p.yr > yrNow) return; const x = xOf(p.yr), y = yOf(p[key]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.restore();
  };
  if (prog > 0) {
    line('c', 4, 'rgba(110,100,86,0.85)', false);
    line('g', 5, rgba(GOLD, 1), true);
    // heads
    let last = INFL_PTS[0]; for (const p of INFL_PTS) if (p.yr <= yrNow) last = p;
    for (const [key, col] of [['g', GOLD], ['c', [110, 100, 86]]]) { ctx.fillStyle = '#FFFDF4'; ctx.beginPath(); ctx.arc(xOf(last.yr), yOf(last[key]), 8, 0, 7); ctx.fill(); ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 3; ctx.stroke(); }
    text(String(Math.floor(yrNow)), X1, Y0 - 30, F.num(40), rgba(FAINT, 1), 'right');
  }
  // end labels
  const fin = INFL_PTS[INFL_PTS.length - 1];
  popText(() => { const x = xOf(fin.yr) + 26, y = yOf(fin.g); text('黄金', x, y - 30, F.cnB(30), rgba(SOFT, 1)); goldText('×' + Math.round(fin.g / 10) * 10, x, y + 34, F.num(72), 72); text('$35 → $' + fmt(INF.gold_now), x, y + 76, F.num(26), rgba(FAINT, 1)); }, t, I.labels, xOf(fin.yr) + 120, yOf(fin.g));
  popText(() => { const x = xOf(fin.yr) + 26, y = yOf(fin.c); text('物价', x, y - 30, F.cnB(30), rgba(SOFT, 1)); text('×' + fin.c.toFixed(1), x, y + 30, F.num(64), rgba(INK, 0.85)); }, t, I.labels + P, xOf(fin.yr) + 120, yOf(fin.c));
  // but: the 1980 top in today's money
  const ur = smooth(I.real - 0.1, I.real + 0.3, t);
  if (ur > 0.01) {
    const p80 = INFL_PTS.find(p => p.yr >= 1980), x80 = xOf(1980.05), y80 = yOf(850 / 35);
    const realNow = 850 * INF.cpi_now / INF.cpi_1980;
    ctx.save(); ctx.globalAlpha = a * ur;
    ringAt({ x: x80, y: y80 }, ((t - I.real) % 1.2) / 1.2, OX, 60, 1, 3);
    ctx.fillStyle = rgba(OX, 1); ctx.beginPath(); ctx.arc(x80, y80, 7, 0, 7); ctx.fill();
    const bx = 560, by = 330;
    ctx.strokeStyle = 'rgba(150,40,34,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x80, y80); ctx.lineTo(bx - 20, by + 40); ctx.stroke();
    ctx.shadowColor = 'rgba(110,80,30,0.2)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    rrect(bx - 20, by - 50, 820, 230, 14); ctx.fillStyle = 'rgba(255,253,248,0.96)'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = rgba(OX, 1); rrect(bx - 20, by - 50, 6, 230, 3); ctx.fill();
    text('但如果你在 1980 年 $850 买入：', bx + 10, by, F.cnB(34), rgba(INK, 1));
    text('按今天的购买力，相当于 $' + fmt(realNow) + '，比现在还贵', bx + 10, by + 60, F.cnB(32), rgba(SOFT, 1));
    const f1 = F.cnB(36), s1 = '扣除通胀，直到 2025 年才回本 —— ';
    text(s1, bx + 10, by + 130, f1, rgba(OX, 1));
    goldText('45 年', bx + 10 + width(s1, f1), by + 134, F.cn(52), 52);
    ctx.restore();
  }
  ctx.restore();
}
// ---------------------------------------------------------------- outro
function drawOutro(t) {
  const P = HK.beat, O = OUT;
  const a = smooth(O.t0, O.t0 + 0.35, t);
  ctx.save(); ctx.globalAlpha = a;
  popText(() => { const f = F.cn(110), w1 = width('所以，现在', f), w2 = width('能买吗', f), w3 = width('？', f), x = W / 2 - (w1 + w2 + w3) / 2;
    shadowText('所以，现在', x, 230, f, rgba(INK, 1), 'left', 0, 0.12); goldText('能买吗', x + w1, 230, f, 110); goldText('？', x + w1 + w2, 230, f, 110); }, t, O.q, W / 2, 200);
  const items = [
    [O.p1, '1', '暴跌之后回本：', '快的 1.5 年，慢的 28 年'],
    [O.p2, '2', '别加杠杆：', '它是踩踏的放大器'],
    [O.p3, '3', '真想买：', '只用闲钱，分批慢慢买'],
  ];
  items.forEach(([t0, n, h, body], k) => {
    const u = (t - t0) / 0.35; if (u <= 0) return;
    const y = 370 + k * 140, x = 400;
    ctx.save(); ctx.globalAlpha = a * clamp(u * 2, 0, 1); ctx.translate(60 * (1 - easeOutCubic(u)), 0);
    ctx.shadowColor = 'rgba(110,80,30,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    rrect(x, y - 70, 1120, 116, 16); ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = goldFill(y - 70, y + 46); rrect(x, y - 70, 8, 116, 4); ctx.fill();
    goldText(n, x + 70, y + 18, F.num(84), 84, 'center');
    const w1 = text(h, x + 140, y + 12, F.cn(46), rgba(INK, 1));
    text(body, x + 140 + w1, y + 12, F.cnB(44), rgba(k === 1 ? OX : SOFT, 1));
    ctx.restore();
  });
  const uc = (t - O.cta) / 0.4;
  if (uc > 0) {
    // the closing line: don't ask whether you can buy, ask whether you can hold
    ctx.save(); ctx.globalAlpha = a * clamp(uc * 2, 0, 1);
    const y = 862, f1 = F.cn(58), f2 = F.cn(70);
    popText(() => shadowText('不要问能不能买，', W / 2, y, f1, rgba(SOFT, 1), 'center', 4, 0.1), t, O.cta, W / 2, y - 20, 1.3);
    popText(() => { const s1 = '先问问自己：能不能', s2 = '拿得住', w1 = width(s1, f2, 2), w2 = width(s2, f2, 2), x = W / 2 - (w1 + w2) / 2;
      shadowText(s1, x, y + 92, f2, rgba(INK, 1), 'left', 2, 0.14); goldText(s2, x + w1, y + 92, f2, 70, 'left', 2);
      goldRule(x + w1 - 10, x + w1 + w2 + 10, y + 112, 1); }, t, O.cta + HK.beat, W / 2, y + 70, 1.5);
    const uf = (t - (O.cta + 3 * HK.beat)) / 0.5;
    if (uf > 0) { ctx.globalAlpha = a * clamp(uf, 0, 1); text('评论区聊聊 · 历史不代表未来，本视频不构成投资建议', W / 2, y + 150, F.cnB(26), rgba(FAINT, 1), 'center', 3); }
    ctx.restore();
  }
  ctx.restore();
}
function draw2D(t) {
  bg2D(t);
  if (t < INF.t0) drawLeverage(t);
  else if (t < OUT.t0) drawInflation(t);
  else drawOutro(t);
}
