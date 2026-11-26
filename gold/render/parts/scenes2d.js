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
// ---------------------------------------------------------------- leverage (one idea at a time)
function bubble(x, y, w, h, tailX, tailY, col) {
  ctx.save(); ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  rrect(x, y, w, h, 28); ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 3; ctx.stroke();
  const bx = clamp(tailX, x + 50, x + w - 50), by = tailY < y ? y : y + h;
  ctx.beginPath(); ctx.moveTo(bx - 22, by); ctx.lineTo(tailX, tailY); ctx.lineTo(bx + 22, by); ctx.closePath();
  ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,253,248,1)'; ctx.fillRect(bx - 20, by - (tailY < y ? -2 : 4), 40, 6);
  ctx.restore();
}
function avatar(x, y, label, col) {
  ctx.save(); ctx.shadowColor = 'rgba(110,80,30,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(x, y, 54, 0, 7); ctx.fill(); ctx.restore();
  text(label, x, y + 17, F.cn(label.length > 1 ? 34 : 50), '#fff', 'center');
}
function drawLeverage(t) {
  const P = HK.beat, L = LV;
  // A. 为什么会暴跌？ -> 关键词：杠杆
  {
    const a = fadeIO(t, L.t0, L.s1, 0.2, 0.3);
    if (a > 0.01) {
      ctx.save(); ctx.globalAlpha = a;
      popText(() => shadowText('为什么会暴跌？', W / 2, 470, F.cn(130), rgba(INK, 1), 'center', 6, 0.14), t, L.t0, W / 2, 430);
      popText(() => { const f = F.cn(84), w1 = width('关键词：', f), w2 = width('杠杆', f); const x = W / 2 - (w1 + w2) / 2;
        shadowText('关键词：', x, 640, f, rgba(SOFT, 1), 'left', 0, 0.1); goldText('杠杆', x + w1, 640, f, 84); }, t, L.kw, W / 2, 610, 1.6);
      ctx.restore();
    }
  }
  // B. slide 1: 1 万本金 x 10 倍杠杆, what +10% and -10% do. Lines appear one by one and stay.
  const sa = fadeIO(t, L.s1 - 0.1, L.you, 0.25, 0.35);
  if (sa > 0.01) {
    ctx.save(); ctx.globalAlpha = sa;
    drawHL('{10 倍杠杆}，到底意味着什么？', 110, 190, 60, 1, null, 'GOLD  ·  暴跌的推手');
    // the stack: own money (gold) under borrowed money (grey). 1 万 = 52 px
    const bx = 400, base = 930, unit = 52;
    const up = smooth(L.s3b, L.s3b + 0.6, t) * (1 - smooth(L.s4 - 0.1, L.s4 + 0.3, t));   // +10% shown, then put back
    const dn = smooth(L.s4b, L.s4b + 0.6, t);                                               // -10%
    const own = 1 + up - dn, total = 10 + up - dn;
    const uO = easeOutCubic((t - L.s1) / 0.35), uB = easeOutCubic((t - L.s2) / 0.4);
    if (uO > 0) {
      const h = Math.max(own, 0.02) * unit * uO;
      ctx.save(); ctx.shadowColor = 'rgba(110,80,30,0.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = goldFill(base - h, base); rrect(bx - 120, base - h, 240, Math.max(h, 2), 6); ctx.fill(); ctx.restore();
      if (up > 0.02) { ctx.fillStyle = rgba(OX, 0.85 * up); rrect(bx - 120, base - h, 240, unit * up, 6); ctx.fill(); }
      const yl = base - Math.max(h, 40) / 2;
      text('本金', bx - 150, yl - 12, F.cnB(30), rgba(GOLD_D, 1), 'right');
      text('¥' + own.toFixed(own % 1 ? 1 : 0).replace(/\.0$/, '') + ' 万', bx - 150, yl + 30, F.num(40), rgba(own < 0.05 ? JADE : GOLD_D, 1), 'right');
    }
    if (uB > 0) {
      const hO = Math.max(own, 0.02) * unit, top = base - hO - 9 * unit * uB;
      ctx.save(); ctx.fillStyle = 'rgba(160,150,135,0.28)'; rrect(bx - 120, top, 240, 9 * unit * uB, 6); ctx.fill();
      ctx.beginPath(); rrect(bx - 120, top, 240, 9 * unit * uB, 6); ctx.clip();
      ctx.strokeStyle = 'rgba(120,108,90,0.35)'; ctx.lineWidth = 2;
      for (let k = -30; k < 40; k++) { ctx.beginPath(); ctx.moveTo(bx - 120 + k * 18, top); ctx.lineTo(bx - 120 + k * 18 + 600, top + 600); ctx.stroke(); }
      ctx.restore();
      text('借来的', bx - 150, top + 9 * unit * uB / 2 - 12, F.cnB(30), rgba(SOFT, 1), 'right');
      text('¥9 万', bx - 150, top + 9 * unit * uB / 2 + 30, F.num(40), rgba(INK, 0.8), 'right');
      // bracket: the whole position
      const u2 = (t - L.s2b) / 0.3;
      if (u2 > 0) {
        ctx.save(); ctx.globalAlpha = sa * clamp(u2 * 2, 0, 1);
        const tp = base - total * unit;
        ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(bx + 150, tp); ctx.lineTo(bx + 170, tp); ctx.lineTo(bx + 170, base); ctx.lineTo(bx + 150, base); ctx.stroke();
        text('仓位', bx + 200, (tp + base) / 2 - 16, F.cnB(32), rgba(SOFT, 1));
        goldText('¥' + total.toFixed(total % 1 ? 1 : 0).replace(/\.0$/, '') + ' 万', bx + 200, (tp + base) / 2 + 46, F.num(68), 68);
        ctx.restore();
      }
    }
    // right column: the lines, one by one; the newest is full strength, older ones step back
    const rx = 820, fM = F.cn(62), fS = F.cnB(52), fE = F.cn(58), lines = [
      [L.s1, () => { text('① 假设你有本金 ', rx, 330, fM, rgba(INK, 1)); goldText('1 万', rx + width('① 假设你有本金 ', fM), 330, fM, 62); }],
      [L.s2, () => { text('② 开 10 倍杠杆，再借 9 万', rx, 440, fM, rgba(INK, 1)); }],
      [L.s2b, () => { text('→ 等于控制 ', rx + 64, 520, fS, rgba(SOFT, 1)); goldText('10 万的仓位', rx + 64 + width('→ 等于控制 ', fS), 520, fE, 58); }],
      [L.s3, () => { text('③ 如果金价涨 10%', rx, 630, fM, rgba(INK, 1)); }],
      [L.s3b, () => { text('→ 赚 1 万，本金', rx + 64, 710, fS, rgba(SOFT, 1)); text('翻倍！', rx + 64 + width('→ 赚 1 万，本金', fS), 710, fE, rgba(OX, 1)); }],
      [L.s4, () => { text('④ 但！万一跌 10% 呢？', rx, 820, fM, rgba(JADE_D, 1)); text('比如 ¥1,000/克 跌到 ¥900/克', rx + 64, 868, F.cnB(32), rgba(FAINT, 1)); }],
      [L.s4b, () => { text('→ 亏 1 万，本金', rx + 64, 950, fS, rgba(SOFT, 1)); text('全没了', rx + 64 + width('→ 亏 1 万，本金', fS), 950, fE, rgba(JADE, 1)); }],
    ];
    lines.forEach(([t0, fn], k) => {
      const u = (t - t0) / 0.35; if (u <= 0) return;
      const nxt = lines[k + 1] ? lines[k + 1][0] : 1e9, older = smooth(nxt, nxt + 0.4, t);
      ctx.save(); ctx.globalAlpha = sa * clamp(u * 2, 0, 1) * lerp(1, 0.45, older);
      ctx.translate(40 * (1 - easeOutCubic(u)), 0);
      fn(); ctx.restore();
    });
    ctx.restore();
  }
  // C. slide 2: the conversation, line by line, then the forced sale
  const da = fadeIO(t, L.you - 0.1, L.cascade, 0.25, 0.35);
  if (da > 0.01) {
    ctx.save(); ctx.globalAlpha = da;
    drawHL('跌 10%，本金没了，接下来呢？', 110, 190, 60, 1, null, 'GOLD  ·  暴跌的推手');
    // you
    {
      const u = easeOutBack((t - L.you) / 0.35, 1.6);
      if (u > 0) {
        ctx.save(); ctx.globalAlpha = da * clamp((t - L.you) / 0.2, 0, 1) * (t > L.broker ? 0.6 : 1);
        ctx.translate(820, 360); ctx.scale(u, u); ctx.translate(-820, -360);
        avatar(240, 360, '你', GOLD_D);
        bubble(340, 270, 980, 190, 296, 352, GOLD);
        text('我相信它会涨回来，再给我一点时间！', 390, 382, F.cn(52), rgba(INK, 1));
        ctx.restore();
      }
    }
    // the lender, three lines one after another
    {
      const u = easeOutBack((t - L.broker) / 0.35, 1.6);
      if (u > 0) {
        ctx.save(); ctx.globalAlpha = da * clamp((t - L.broker) / 0.2, 0, 1) * (t > L.force ? 0.5 : 1);
        ctx.translate(1100, 680); ctx.scale(u, u); ctx.translate(-1100, -680);
        avatar(1690, 700, '券商', OX);
        bubble(580, 520, 1010, 330, 1634, 700, OX);
        const ls = [[L.broker, '可那 9 万是我借给你的钱。', INK], [L.broker + 2 * P, '万一它继续跌呢？', INK], [L.broker + 4 * P, '这个风险，我不陪你担。', OX]];
        ls.forEach(([t0, sline, col], k) => {
          const v = (t - t0) / 0.3; if (v <= 0) return;
          ctx.save(); ctx.globalAlpha *= clamp(v * 2, 0, 1); text(sline, 630, 610 + k * 88, F.cn(54), rgba(col, 1)); ctx.restore();
        });
        ctx.restore();
      }
    }
    if (t > L.force) {
      stamp('强制平仓', W / 2, 640, L.force, t, 130, OX, -0.1);
      const u = (t - (L.force + 2 * P)) / 0.3;
      if (u > 0) { ctx.save(); ctx.globalAlpha = da * clamp(u * 2, 0, 1); text('不等你，直接把你的黄金卖掉', W / 2, 840, F.cn(56), rgba(OX, 1), 'center'); ctx.restore(); }
    }
    ctx.restore();
  }
  // D. the stampede: one forced sale feeds the next
  const ca = fadeIO(t, L.cascade - 0.05, L.final, 0.3, 0.3);
  if (ca > 0.01) {
    ctx.save(); ctx.globalAlpha = ca;
    drawHL('很多人同时被强平，会发生什么？', 110, 190, 60, 1, null, 'GOLD  ·  踩踏式下跌');
    const steps = ['卖的人太多', '金价继续下跌', '更多人被强平', '又被迫卖出'];
    const prices = ['¥900', '¥850', '¥780', '¥700'];
    const cx0 = 200, cy = 580, gap = 400;
    steps.forEach((s2, k) => {
      const t0 = L.cascade + k * 2 * P, u = (t - t0) / 0.35; if (u <= 0) return;
      const x = cx0 + k * gap;
      ctx.save(); ctx.globalAlpha = ca * clamp(u * 2, 0, 1);
      const sc = easeOutBack(u, 1.8); ctx.translate(x + 160, cy); ctx.scale(sc, sc);
      ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      rrect(-160, -78, 320, 156, 22); ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rgba(k % 2 ? JADE : OX, 0.85); ctx.lineWidth = 3; ctx.stroke();
      text(s2, 0, 18, F.cn(50), rgba(k % 2 ? JADE_D : OX, 1), 'center');
      ctx.restore();
      if (k < 3) {
        const ua = (t - (t0 + P)) / 0.3;
        if (ua > 0) { ctx.save(); ctx.globalAlpha = ca * clamp(ua * 2, 0, 1); const ax = x + 330, ay = cy;
          ctx.fillStyle = rgba(GOLD, 0.95); ctx.beginPath(); ctx.moveTo(ax, ay - 18); ctx.lineTo(ax + 44, ay); ctx.lineTo(ax, ay + 18); ctx.closePath(); ctx.fill(); ctx.restore(); }
      }
      ctx.save(); ctx.globalAlpha = ca * clamp(u * 2, 0, 1);
      text('金价 ' + prices[k], x + 160, cy + 160, F.num(60), rgba(k ? JADE : INK, 1), 'center');
      ctx.restore();
    });
    const ul = (t - (L.cascade + 8 * P)) / 0.4;
    if (ul > 0) {
      ctx.save(); ctx.globalAlpha = ca * clamp(ul * 2, 0, 1);
      const xa = cx0 + 3 * gap + 160, xb = cx0 + 160, yb = cy - 110;
      ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(xa, cy - 82); ctx.bezierCurveTo(xa, yb - 130, xb, yb - 130, xb, cy - 82); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = rgba(GOLD, 0.95); ctx.beginPath(); ctx.moveTo(xb - 14, cy - 100); ctx.lineTo(xb + 14, cy - 100); ctx.lineTo(xb, cy - 80); ctx.closePath(); ctx.fill();
      text('越卖越跌，越跌越卖', (xa + xb) / 2, yb - 160, F.cn(54), rgba(OX, 1), 'center', 4);
      ctx.restore();
    }
    ctx.restore();
  }
  // E. 这就是踩踏式下跌
  const fa = fadeIO(t, L.final - 0.05, L.t1 + 0.05, 0.25, 0.2);
  if (fa > 0.01) {
    ctx.save(); ctx.globalAlpha = fa;
    popText(() => { const f = F.cn(140), w1 = width('这就是', f), w2 = width('踩踏式下跌', f), x = W / 2 - (w1 + w2) / 2;
      shadowText('这就是', x, 560, f, rgba(INK, 1), 'left', 0, 0.14); goldText('踩踏式下跌', x + w1, 560, f, 140); }, t, L.final, W / 2, 520, 1.6);
    const u = (t - (L.final + 2 * P)) / 0.4;
    if (u > 0) { ctx.globalAlpha = fa * clamp(u * 2, 0, 1); text('这一轮也一样：股市大跌 → 补保证金 → 卖黄金换现金', W / 2, 680, F.cnB(40), rgba(SOFT, 1), 'center', 2); }
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
    shadowText('所以，现在', x, 290, f, rgba(INK, 1), 'left', 0, 0.12); goldText('能买吗', x + w1, 290, f, 110); goldText('？', x + w1 + w2, 290, f, 110); }, t, O.q, W / 2, 260);
  const items = [
    [O.p1, '1', '暴跌之后回本：', '快的 1.5 年，慢的 28 年'],
    [O.p2, '2', '别加杠杆：', '它是踩踏的放大器'],
    [O.p3, '3', '真想买：', '只用闲钱，分批慢慢买'],
  ];
  items.forEach(([t0, n, h, body], k) => {
    const u = (t - t0) / 0.35; if (u <= 0) return;
    const y = 480 + k * 160, x = 400;
    ctx.save(); ctx.globalAlpha = a * clamp(u * 2, 0, 1); ctx.translate(60 * (1 - easeOutCubic(u)), 0);
    ctx.shadowColor = 'rgba(110,80,30,0.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    rrect(x, y - 70, 1120, 116, 16); ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = goldFill(y - 70, y + 46); rrect(x, y - 70, 8, 116, 4); ctx.fill();
    goldText(n, x + 70, y + 18, F.num(84), 84, 'center');
    const w1 = text(h, x + 140, y + 12, F.cn(46), rgba(INK, 1));
    text(body, x + 140 + w1, y + 12, F.cnB(44), rgba(k === 1 ? OX : SOFT, 1));
    ctx.restore();
  });
  ctx.restore();
}
function drawFinalCard(t) {
  const O = OUT, P = HK.beat;
  const a = smooth(O.final - 0.05, O.final + 0.25, t);
  if (a < 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  popText(() => shadowText('不要问能不能买，', W / 2, 400, F.cn(76), rgba(SOFT, 1), 'center', 6, 0.1), t, O.final, W / 2, 370, 1.3);
  popText(() => shadowText('要问问自己：', W / 2, 540, F.cn(86), rgba(INK, 1), 'center', 6, 0.12), t, O.final + 2 * P, W / 2, 510, 1.4);
  popText(() => { const f = F.cn(124), s1 = '下跌的时候，能不能', s2 = '拿得住', s3 = '？', w1 = width(s1, f), w2 = width(s2, f), w3 = width(s3, f), x = W / 2 - (w1 + w2 + w3) / 2;
    shadowText(s1, x, 720, f, rgba(INK, 1), 'left', 0, 0.14); goldText(s2, x + w1, 720, f, 124); goldText(s3, x + w1 + w2, 720, f, 124);
    goldRule(x + w1 - 10, x + w1 + w2 + 10, 752, 1); }, t, O.final + 4 * P, W / 2, 680, 1.5);
  const uf = (t - (O.final + 7 * P)) / 0.5;
  if (uf > 0) { ctx.globalAlpha = a * clamp(uf, 0, 1); text('评论区聊聊 · 历史不代表未来，本视频不构成投资建议', W / 2, 900, F.cnB(28), rgba(FAINT, 1), 'center', 3); }
  ctx.restore();
}
function draw2D(t) {
  bg2D(t);
  if (t < OUT.t0) drawLeverage(t);
  else if (t < OUT.final) drawOutro(t);
  else drawFinalCard(t);
}
