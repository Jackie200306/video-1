// ---------------------------------------------------------------- static layers
let GRAIN, BOKEH_IMG, SNAP, SNAPX, SHARDS, STREAKS;
function prepStatic() {
  GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 512;
  { const g = GRAIN.getContext('2d'), img = g.createImageData(512, 512), R = mulberry32(7);
    for (let k = 0; k < img.data.length; k += 4) { const v = 128 + (R() - 0.5) * 70; img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 0.96; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0); }
  BOKEH_IMG = document.createElement('canvas'); BOKEH_IMG.width = BOKEH_IMG.height = 128;
  { const g = BOKEH_IMG.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(236,190,96,0.40)'); rg.addColorStop(0.72, 'rgba(236,190,96,0.28)'); rg.addColorStop(0.9, 'rgba(236,190,96,0.42)'); rg.addColorStop(1, 'rgba(236,190,96,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
  SNAP = document.createElement('canvas'); SNAP.width = W; SNAP.height = H; SNAPX = SNAP.getContext('2d');
  const R = mulberry32(23);
  SHARDS = Array.from({ length: 26 }, (_, k) => {
    const a = (k / 26) * Math.PI * 2 + (R() - 0.5) * 0.5, n = R() < 0.6 ? 3 : 4, sz = 18 + R() * 46;
    const pts = Array.from({ length: n }, (_, q) => { const ang = (q / n) * Math.PI * 2 + (R() - 0.5) * 0.9, rr = sz * (0.5 + R() * 0.6); return [Math.cos(ang) * rr, Math.sin(ang) * rr]; });
    return { a, v: 380 + R() * 900, vr: (R() - 0.5) * 9, rot0: R() * 6.28, pts, r0: 0.7 + R() * 0.35, life: 0.8 + R() * 0.6, glint: R() < 0.4 };
  });
  STREAKS = Array.from({ length: 16 }, () => ({ y: 120 + R() * (H - 240), l: 260 + R() * 700, v: 2600 + R() * 3000, ph: R() * W * 2, a: 0.18 + R() * 0.3 }));
}

// ---------------------------------------------------------------- background
function drawBackground(c, t, hp) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FCFAF5'); g.addColorStop(0.6, '#F6F0E4'); g.addColorStop(1, '#EDE3D0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const k = ctx.createRadialGradient(W * 0.55, -260, 80, W * 0.55, -260, 1500);
  k.addColorStop(0, 'rgba(255,255,255,0.95)'); k.addColorStop(0.5, 'rgba(255,253,246,0.35)'); k.addColorStop(1, 'rgba(255,253,246,0)');
  ctx.fillStyle = k; ctx.fillRect(0, 0, W, H);
  // warm light travelling with the head (the Bitcoin glow, as sunlight on paper)
  if (hp) {
    const col = lineCol(ddCol(c.D));
    const rg = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 800);
    rg.addColorStop(0, rgba(mixc(col, [255, 220, 150], 0.5), 0.20)); rg.addColorStop(0.45, rgba([255, 220, 150], 0.06)); rg.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
}
function drawFloor(c, t) {
  // a studio floor grid in perspective, moving with the camera
  const Yf = c.Ly - c.dist * TANV * 0.70;
  ctx.save(); ctx.lineWidth = 1;
  const st = DS.daily ? 30 : 365, x0 = Math.floor((c.D - (DS.daily ? 1100 : 16000)) / st) * st, x1 = c.D + c.dist * 0.9;
  for (let z = -c.dist * 0.45; z <= c.dist * 1.2; z += c.dist * 0.075) {
    const a = proj(c, x0, Yf, z), b = proj(c, x1, Yf, z); if (!a || !b) continue;
    const al = 0.10 * clamp(1 - (z + c.dist * 0.45) / (c.dist * 1.7), 0, 1);
    ctx.strokeStyle = `rgba(150,118,60,${al})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let x = x0; x < x1; x += st) {
    const a = proj(c, x, Yf, -c.dist * 0.45), b = proj(c, x, Yf, c.dist * 1.2); if (!a || !b) continue;
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, 'rgba(150,118,60,0.10)'); g.addColorStop(1, 'rgba(150,118,60,0)');
    ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // fade the floor into the paper at the horizon
  ctx.restore();
}
function drawBokeh(c, t) {
  t = tfx(t);
  const span = W + 600;
  for (let k = 0; k < 20; k++) {
    const depth = 0.6 + 1.4 * hash(k * 4.1), r = 16 + 64 * hash(k * 2.3) * depth;
    const x = (((hash(k * 7.7) * span - c.Lx * 0.9 * depth - t * 8 * depth) % span) + span) % span - 300;
    const y = H * (0.12 + 0.8 * hash(k * 9.3)) + Math.sin(t * 0.4 + k) * 14;
    ctx.globalAlpha = 0.10 + 0.16 * hash(k * 5.5);
    ctx.drawImage(BOKEH_IMG, x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  // gold dust
  for (let k = 0; k < 50; k++) {
    const y = ((hash(k * 3.3) * H - t * (8 + 20 * hash(k * 1.7))) % (H + 40) + H + 40) % (H + 40) - 20;
    const x = (((hash(k * 6.1) * W - c.Lx * 0.4 * (0.5 + hash(k))) % W) + W) % W;
    const tw = 0.55 + 0.45 * Math.sin(t * 3 * (0.5 + hash(k * 9)) + k);
    ctx.fillStyle = rgba([205, 165, 82], (0.2 + 0.4 * hash(k * 2.9)) * tw); ctx.beginPath(); ctx.arc(x, y, 0.8 + 2 * hash(k * 8.8), 0, 7); ctx.fill();
  }
}

// ---------------------------------------------------------------- rails (price levels) & month marks
function railLevels(c) {
  const half = c.dist * TANV / (KY * c.sy), ctr = c.cl, out = [];
  if (DS.daily) {
    const step = half > 500 ? 200 : half > 200 ? 100 : 50;
    for (let p = Math.ceil((ctr - half * 1.5) / step) * step; p <= ctr + half * 1.5; p += step) if (p > 0) out.push([p, p, '¥' + fmt(p)]);
  } else {
    const L = half > 0.45 ? [50, 100, 200, 500, 1000, 2000, 5000] : [35, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000];
    for (const u of L) { const v = Math.log10(u); if (v > ctr - half * 1.5 && v < ctr + half * 1.5) out.push([v, u, '$' + fmt(u)]); }
  }
  return out;
}
function drawRails(c, t) {
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  for (const [p, lvl, label] of railLevels(c)) {
    const back = DS.daily ? 2500 : 40000;
    const Y = wY(c, p), a = proj(c, c.D - back, Y) || proj(c, c.D - back / 8, Y), b = proj(c, c.D + c.dist * 0.75, Y);
    if (!a || !b) continue;
    const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, 'rgba(150,118,60,0)'); g.addColorStop(0.6, 'rgba(150,118,60,0.20)'); g.addColorStop(1, 'rgba(150,118,60,0.08)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    const ms = DS.daily ? HK.climb.find(k => k.level === lvl && k.level < 1200) : null;
    const flash = ms ? bump(t, ms.t, 0.02, 0.12, 0.9) : 0;
    if (flash > 0.01) {
      const g2 = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g2.addColorStop(0, 'rgba(240,178,50,0)'); g2.addColorStop(0.7, `rgba(240,178,50,${0.85 * flash})`); g2.addColorStop(1, 'rgba(240,178,50,0)');
      ctx.strokeStyle = g2; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const lp = proj(c, c.D + c.dist * 0.40, Y);
    const inTitle = t > HK.y2023 - 0.3 && t < HK.y2023 + 2.6 && lp && Math.abs(lp.x - (W / 2 + 140)) < 460 && lp.y > 120 && lp.y < 560;
    if (lp && lp.y > 150 && lp.y < H - 140 && lp.x < W - 120 && !inTitle) {
      ctx.font = F.num(Math.round(clamp(24 * lp.s, 18, 28))); ctx.fillStyle = rgba(FAINT, 0.95 * (1 - flash));
      ctx.fillText(label, lp.x, lp.y - 6);
    }
  }
  ctx.restore();
}
function drawMonths(c, t) {
  const Yw = c.Ly - c.dist * TANV * 0.56;
  const span = c.dist / 2;
  if (!DS.daily) return drawYears(c, t, Yw, span);
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const d0 = new Date(DATE0 + Math.max(0, c.D - 1200) * 86400000);
  for (let y = d0.getUTCFullYear(); y <= 2026; y++) for (let m = 0; m < 12; m++) {
    const yearly = span > 700;
    if (yearly && m) continue; if (!yearly && span > 380 && m % 3) continue;
    const d = (Date.UTC(y, m, 1) - DATE0) / 86400000; if (d > c.D + 1 || d < 0) continue;
    const p = proj(c, d, Yw); if (!p || p.x < -80 || p.x > W + 40) continue;
    const near = Math.exp(-Math.abs(c.D - d) / 500);
    let a = (0.35 + 0.5 * near) * clamp(p.s, 0.3, 1);
    if (p.x < 620 && p.y > H - 300) a *= 0.12;
    ctx.strokeStyle = `rgba(150,118,60,${a * 0.6})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 30 * p.s); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
    ctx.font = m === 0 ? F.num(Math.round(clamp(30 * p.s, 16, 34))) : F.cnB(Math.round(clamp(22 * p.s, 14, 24)));
    ctx.fillStyle = rgba(m === 0 ? SOFT : FAINT, a);
    ctx.fillText(m === 0 ? String(y) : `${m + 1}月`, p.x + 7, p.y);
  }
  ctx.restore();
}

function drawYears(c, t, Yw, span) {
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const every = span > 9000 ? 10 : span > 3000 ? 5 : span > 1200 ? 2 : 1;
  for (let y = 1970; y <= 2026; y += 1) {
    if (y % every) continue;
    const d = (Date.UTC(y, 0, 1) - DATE0) / 86400000; if (d > c.D + 1) continue;
    const p = proj(c, d, Yw); if (!p || p.x < -80 || p.x > W + 40) continue;
    const near = Math.exp(-Math.abs(c.D - d) / 6000);
    let a = (0.35 + 0.5 * near) * clamp(p.s, 0.3, 1);
    if (p.x < 620 && p.y > H - 300) a *= 0.12;
    ctx.strokeStyle = `rgba(150,118,60,${a * 0.6})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 30 * p.s); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
    ctx.font = F.num(Math.round(clamp(30 * p.s, 16, 34))); ctx.fillStyle = rgba(SOFT, a);
    ctx.fillText(String(y), p.x + 7, p.y);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the line
// daily chart: gold up to the high, jade in the fall; history: jade while under water (>8% below the high)
function ddCol(d) { return DS.daily ? (d > PEAK.i + 0.5 ? clamp(ddAt(d) / 0.06, 0, 1) : 0) : clamp((ddAt(d) - 0.08) / 0.12, 0, 1); }
function collectPoints(c) {
  const pts = []; let prevOff = null;
  const from = Math.max(0, Math.floor(c.D - 1300));      // daily only
  const add = d => {
    const p = projDay(c, d); if (!p) return;
    p.d = d; p.c = Math.round(ddCol(d) * 8) / 8;
    if (p.x < -300) { prevOff = p; return; }
    if (prevOff) { pts.push(prevOff); prevOff = null; }
    const q = pts[pts.length - 1];
    if (q && q.c === p.c && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 1.2) return;
    pts.push(p);
  };
  if (DS.daily) for (let d = from; d < c.D; d++) add(d);
  else for (let k = 0; k < DS.n && DS.X[k] < c.D; k++) add(DS.X[k]);
  add(c.D);
  return pts;
}
function strokeRuns(runs, wFn, colFn) {
  for (const r of runs) {
    if (r.pts.length < 2) continue;
    ctx.strokeStyle = colFn(r); ctx.lineWidth = wFn(r);
    ctx.beginPath(); ctx.moveTo(r.pts[0].x, r.pts[0].y);
    for (let k = 1; k < r.pts.length; k++) ctx.lineTo(r.pts[k].x, r.pts[k].y);
    ctx.stroke();
  }
}
function drawLine(c, t, pts) {
  if (pts.length < 2) return;
  const runs = []; let cur = null;
  for (const p of pts) {
    const age = (c.D - p.d) / (DS.daily ? 1 : 12);
    const a = Math.round(lerp(0.30, 1.0, Math.exp(-age / 190)) * 10) / 10;
    const tail = age < 14 ? 1 : 0;                       // comet tail near the head
    if (!cur || cur.c !== p.c || cur.a !== a || cur.tail !== tail) {
      const prev = cur ? cur.pts[cur.pts.length - 1] : null;
      cur = { c: p.c, a, tail, pts: prev ? [prev, p] : [p] }; runs.push(cur);
    } else cur.pts.push(p);
  }
  for (const r of runs) { let s = 0; for (const p of r.pts) s += p.s; r.s = clamp(s / r.pts.length, 0.35, 1.7); r.col = lineCol(r.c); }
  // speed of the head (days/s) widens the stroke a little: the line "surges"
  const sp = clamp(Math.abs(CAM.Dh[Math.min(CAM.Dh.length - 1, c.k + 1)] - CAM.Dh[Math.max(0, c.k - 1)]) * FPS / 2 / (DS.daily ? 240 : 4000), 0, 1);
  const surge = 1 + 0.45 * sp;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // soft halo (normal blending: warm light on paper)
  for (const [w, a] of [[34, 0.045], [18, 0.085], [9, 0.16]]) strokeRuns(runs, r => w * r.s * (r.tail ? surge * 1.25 : 1), r => rgba(mixc(r.col, GOLD_HALO, 0.35), a * r.a));
  // shadow + core + filament
  ctx.save(); ctx.shadowColor = 'rgba(90,60,15,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  strokeRuns(runs, r => 4.6 * r.s * (r.tail ? surge : 1), r => rgba(r.col, r.a)); ctx.restore();
  strokeRuns(runs, r => 1.6 * r.s, r => rgba(mixc(r.col, [255, 248, 220], 0.75), r.a * 0.95));
  ctx.restore();
}
function drawFill(c, pts) {
  const sel = pts.filter(p => p.d > c.D - (DS.daily ? 420 : 9000)); if (sel.length < 3) return;
  let minY = 1e9; for (const p of sel) minY = Math.min(minY, p.y);
  const col = lineCol(ddCol(c.D));
  const g = ctx.createLinearGradient(0, minY, 0, H);
  g.addColorStop(0, rgba(mixc(col, GOLD_HALO, 0.3), 0.16)); g.addColorStop(0.55, rgba(col, 0.04)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sel[0].x, H);
  for (const p of sel) ctx.lineTo(p.x, p.y);
  ctx.lineTo(sel[sel.length - 1].x, H); ctx.closePath(); ctx.fill();
}
// light pulses that run up the line into the head on every beat
function drawPulses(c, t) {
  if (t > HK.question - 0.1 && t < HK.y2023) return;
  if (TL.full && ((t > NS.convert - 0.1 && t < NS.cut + 0.6) || (HS && t > HS.table - 0.1))) return;
  for (const b of TL.bgm.beats) {
    const age = t - b; if (age < 0 || age > 0.55) continue;
    const u = easeInOut(age / 0.55), d = c.D - lerp(110, 0, u) * (DS.daily ? 1 : 15);
    if (d < DS.x0) continue;
    const p = projDay(c, d); if (!p) continue;
    const a = Math.sin(Math.PI * clamp(age / 0.55, 0, 1));
    const col = lineCol(ddCol(d));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 46 * p.s);
    g.addColorStop(0, rgba([255, 252, 236], 0.95 * a)); g.addColorStop(0.25, rgba(mixc(col, GOLD_HALO, 0.4), 0.55 * a)); g.addColorStop(1, rgba(GOLD_HALO, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 46 * p.s, 0, 7); ctx.fill();
    // short bright streak along the line behind the pulse
    const q = projDay(c, Math.max(DS.x0, d - 10 * (DS.daily ? 1 : 15)));
    if (q) { ctx.strokeStyle = rgba([255, 250, 225], 0.8 * a); ctx.lineWidth = 3 * p.s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  }
}
// twinkles sitting on the recent line
function drawTwinkles(c, t) {
  t = tfx(t);
  for (let k = 0; k < 14; k++) {
    const per = 1.6 + hash(k * 3.1), ph = (t / per + hash(k * 7.7)) % 1;
    const cyc = Math.floor(t / per + hash(k * 7.7));
    const d = c.D - (8 + hash(k * 5.3 + cyc * 1.7) * 240) * (DS.daily ? 1 : 15); if (d < DS.x0) continue;
    const p = projDay(c, d); if (!p) continue;
    const a = Math.sin(Math.PI * ph) ** 3, q = (6 + 10 * hash(k + cyc)) * p.s * a;
    ctx.strokeStyle = rgba([255, 246, 215], 0.95 * a); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(p.x - q, p.y); ctx.lineTo(p.x + q, p.y); ctx.moveTo(p.x, p.y - q); ctx.lineTo(p.x, p.y + q); ctx.stroke();
    ctx.fillStyle = rgba([255, 230, 160], 0.6 * a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
  }
}
function beatPulse(t) { let best = 0; for (const b of TL.bgm.beats) { const d = t - b; if (d >= 0 && d < 0.35) best = Math.max(best, Math.pow(1 - d / 0.35, 2)); } return best; }
function drawHead(c, t, hp) {
  const col = lineCol(ddCol(c.D)), beat = beatPulse(t);
  // light beam to the floor
  const bg = ctx.createLinearGradient(0, hp.y, 0, H);
  bg.addColorStop(0, rgba(mixc(col, GOLD_HALO, 0.3), 0.35)); bg.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = bg; ctx.fillRect(hp.x - 1, hp.y, 2, H - hp.y);
  // comet smear in the direction of travel
  const prev = projDay(c, Math.max(DS.x0, c.D - (DS.daily ? 6 : 90)));
  if (prev) {
    const dx = hp.x - prev.x, dy = hp.y - prev.y, L = Math.hypot(dx, dy);
    if (L > 4) {
      ctx.save(); ctx.translate(hp.x, hp.y); ctx.rotate(Math.atan2(dy, dx));
      const g = ctx.createLinearGradient(-Math.min(L * 3, 220), 0, 0, 0);
      g.addColorStop(0, rgba(GOLD_HALO, 0)); g.addColorStop(1, rgba(mixc(col, GOLD_HALO, 0.3), 0.45));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-Math.min(L * 1.5, 110), 0, Math.min(L * 1.5, 110), 9, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  let g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 200 * (1 + 0.15 * beat));
  g.addColorStop(0, rgba(mixc(col, GOLD_HALO, 0.4), 0.30)); g.addColorStop(0.3, rgba(GOLD_HALO, 0.10)); g.addColorStop(1, rgba(GOLD_HALO, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp.x, hp.y, 210, 0, 7); ctx.fill();
  g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 30);
  g.addColorStop(0, 'rgba(255,253,240,1)'); g.addColorStop(0.35, rgba(mixc(col, [255, 240, 200], 0.3), 0.85)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp.x, hp.y, 30, 0, 7); ctx.fill();
  ctx.save(); ctx.shadowColor = 'rgba(80,56,18,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#FFFDF4'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 6.5 + 2 * beat, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hp.x, hp.y, 6.5 + 2 * beat, 0, 7); ctx.stroke();
}

// ---------------------------------------------------------------- bubble
let BUBS = [];
function bubbleR(c, t, b) {
  b = b || BUBS[0];
  return b.rad(c) * (1 + 0.03 * Math.sin(tfx(t) * 11) + 0.04 * beatPulse(t));
}
function activeBubble(t) { for (const b of BUBS) if (t >= b.t0 && t < b.tb && DS === b.ds) return b; return null; }
function bubbleOff(c, t) { const b = activeBubble(t); return b ? bubbleR(c, t, b) * smooth(b.t0, b.t0 + 0.6, t) : 0; }
function drawBubble(c, t, hp) {
  const b = activeBubble(t); if (!b || !hp) return;
  const D = b.tb;
  let r = bubbleR(c, t, b) * smooth(b.t0, b.t0 + 0.6, t);
  let jx = 0, jy = 0;
  if (t > D - 0.22) { const k = (t - (D - 0.22)) / 0.22; jx = Math.sin(t * 160) * 3 * k; jy = Math.cos(t * 140) * 3 * k; r *= 1 + 0.04 * k; }
  if (r < 8) return;
  const cx = hp.x + jx, cy = hp.y + jy;
  ctx.save();
  ctx.shadowColor = 'rgba(110,80,30,0.18)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.7, 'rgba(255,250,236,0.12)'); g.addColorStop(0.92, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0.8)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(190,146,60,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  // a thin gold-to-rose sheen that slides round the rim
  const cg = ctx.createConicGradient(tfx(t) * 1.4, cx, cy);
  [['rgba(240,190,90,0)', 0], ['rgba(240,190,90,0.7)', 0.12], ['rgba(255,180,160,0.45)', 0.22], ['rgba(240,190,90,0)', 0.34], ['rgba(240,190,90,0)', 1]].forEach(([s, o]) => cg.addColorStop(o, s));
  ctx.strokeStyle = cg; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r - 2.5, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 3.6, 4.4); ctx.stroke();
  ctx.filter = 'blur(2px)'; ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.45, r * 0.17, r * 0.075, -0.7, 0, 7); ctx.fill(); ctx.filter = 'none';
  if (r > 80) { ctx.globalAlpha = 0.6 * smooth(80, 130, r); ctx.font = F.cnB(Math.round(r * 0.2)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(GOLD_D, 1); ctx.fillText('泡 沫', cx, cy - r * 0.6); }
  ctx.restore();
}

// ---------------------------------------------------------------- particles & bursts (Bitcoin set, re-coloured)
let BURST = null, BURSTS = [], TL_REWIND_A = 1e9, TL_REWIND_B = -1;
function drawParticles(c, t, i) {
  // embers rising off the head in rallies, sparks raining off it in the crash
  for (let j = i - 200; j <= i; j++) {
    if (j < CAM.f0 + 2) continue;
    const Dj = CAM.Dh[j - CAM.f0], Dp = CAM.Dh[j - CAM.f0 - 1];
    const tj = j / FPS, speed = Math.abs(Dj - Dp) * FPS;        // days per second
    let n = 0, fall = false;
    if (tj < HK.y2023) {
      if (tj < HK.peakTag) n = Math.min(3, speed / 70);
      else if (tj >= HK.drop && tj < HK.crashEnd) { n = Math.min(6, speed / 45); fall = true; }
    } else {
      const rate = DS.daily ? (pAt(Dj) / pAt(Dp) - 1) * FPS : (pAt(Dj) - pAt(Dp)) * 2.3026 * FPS, th = DS.daily ? 0.12 : 0.9;
      if (rate > th) n = Math.min(3, (rate - th) / th * 1.5);
      else if (rate < -th) { n = Math.min(6, (-rate - th) / th * 2.5); fall = true; }
      if (tj > TL_REWIND_A && tj < TL_REWIND_B) n = 0;
    }
    n = Math.floor(n + hash(j * 1.731)); if (!n) continue;
    if (j / FPS > HK.rewind - 0.05 && j / FPS < HK.y2023) continue;
    const age = tfx(i / FPS) - tfx(j / FPS);
    const anchor = proj(c, Dj, wY(c, pAt(Dj))); if (!anchor) continue;
    for (let k = 0; k < n; k++) {
      const h1 = hash(j * 13.1 + k * 7.3), h2 = hash(j * 3.7 + k * 17.9), h3 = hash(j * 9.9 + k * 1.1);
      const life = 0.6 + 0.7 * h3; if (age > life) continue;
      let x, y, col;
      if (fall) { x = anchor.x + (h1 - 0.5) * 240 * age; y = anchor.y - 90 * h2 * age + 0.5 * 1100 * age * age; col = mixc(JADE, GOLD, h2 * 0.6); }
      else { x = anchor.x + (h1 - 0.5) * 90 * age - 30 * age; y = anchor.y - (70 + 130 * h2) * age; col = mixc(GOLD, [255, 214, 120], h3); }
      const a = (1 - age / life) * (fall ? 0.9 : 0.75), r = fall ? 2.4 + 1.8 * h1 : 1.8 + 1.4 * h1;
      ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  // bursts
  for (const [tb, dday, kind, sc, ds, origin] of BURSTS) {
    if (ds !== DS) continue;
    const age = t - tb; if (age < 0 || age > 1.9) continue;
    const anchor = kind === 'shard' && origin ? origin : projDay(c, dday); if (!anchor) continue;
    const Nn = kind === 'gold' ? 80 : kind === 'shard' ? 70 : 50;
    for (let k = 0; k < Nn; k++) {
      const h1 = hash(k * 3.3 + kind.length * 11), h2 = hash(k * 9.1 + kind.length), h3 = hash(k * 1.7 + kind.length * 5);
      const life = 0.8 + 0.9 * h3; if (age > life) continue;
      const ang = h1 * Math.PI * 2; let sp, g, col, r;
      if (kind === 'gold') { sp = 160 + 560 * h2; g = 160; col = mixc(GOLD, [255, 226, 150], h3 * 0.7); r = 1.6 + 2.2 * h3; }
      else if (kind === 'shard') { sp = 160 + 520 * h2; g = 900; col = mixc([200, 160, 80], [255, 236, 190], h3); r = 2 + 3 * h3; }
      else { sp = 140 + 500 * h2; g = 1300; col = mixc(JADE, GOLD, h3 * 0.5); r = 2 + 2.4 * h3; }
      const drag = Math.exp(-age * 1.6);
      const dx = Math.cos(ang) * sp * (1 - drag) / 1.6 * sc, dy = (Math.sin(ang) * sp * (1 - drag) / 1.6 - (kind === 'jade' ? 240 * h2 * age : 0)) * sc + 0.5 * g * age * age;
      const a = Math.pow(1 - age / life, 1.3);
      ctx.fillStyle = rgba(col, a);
      if (kind === 'shard') {
        ctx.save(); ctx.translate(anchor.x + dx, anchor.y + dy); ctx.rotate(ang + age * 8 * (h2 - 0.5));
        ctx.beginPath(); ctx.moveTo(-r * 1.8, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(r * 2.2, r * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
      } else { ctx.beginPath(); ctx.arc(anchor.x + dx, anchor.y + dy, r, 0, 7); ctx.fill(); }
    }
  }
}
function drawGlass(t) {
  for (const b of BUBS) if (b.origin && DS === b.ds) drawGlassAt(t - b.tb, b.origin);
}
function drawGlassAt(tau, o) {
  // larger clear glass pieces of the bubble
  if (tau < 0 || tau > 1.6) return;
  for (const s of SHARDS) {
    if (tau > s.life) continue;
    const d = s.v * tau * (1 - 0.3 * tau), x = o.x + Math.cos(s.a) * (o.r * s.r0 + d), y = o.y + Math.sin(s.a) * (o.r * s.r0 + d) + 0.5 * 1900 * tau * tau;
    const al = 1 - smooth(s.life * 0.5, s.life, tau);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot0 + s.vr * tau);
    ctx.beginPath(); s.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    const g = ctx.createLinearGradient(-40, -40, 40, 40); g.addColorStop(0, `rgba(255,255,255,${0.6 * al})`); g.addColorStop(1, `rgba(255,246,226,${0.15 * al})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * al})`; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = `rgba(150,112,40,${0.4 * al})`; ctx.lineWidth = 0.8; ctx.stroke();
    if (s.glint) { ctx.strokeStyle = `rgba(225,176,70,${0.95 * al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]); ctx.lineTo(s.pts[1][0], s.pts[1][1]); ctx.stroke(); }
    ctx.restore();
  }
}
function drawEffects(c, t) {
  let flash = 0, flashCol = [255, 250, 236];
  // peak: rotating light rays + ring (Bitcoin ATH effect)
  {
    const age = t - HK.peakTag, p = projDay(c, PEAK.i);
    if (age > -0.05 && age < 1.8 && p && t < HK.drop + 0.05) {
      const ra = bump(t, HK.peakTag + 0.05, 0.1, 0.5, 0.6) * 0.55;
      if (ra > 0.01) {
        const nR = 18, rot = tfx(t) * 0.4;
        for (let k = 0; k < nR; k++) {
          const ang = rot + k * Math.PI * 2 / nR, len = (300 + 200 * hash(k + 3)) * (0.6 + 0.4 * easeOutCubic(age / 0.6));
          const g = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
          g.addColorStop(0, rgba(GOLD_HALO, ra)); g.addColorStop(1, rgba(GOLD_HALO, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(ang - 0.03) * len, p.y + Math.sin(ang - 0.03) * len);
          ctx.lineTo(p.x + Math.cos(ang + 0.03) * len, p.y + Math.sin(ang + 0.03) * len); ctx.closePath(); ctx.fill();
        }
      }
      const u = (tfx(t) - tfx(HK.peakTag)) / 0.9;
      if (u > 0 && u < 1) { ctx.strokeStyle = rgba(GOLD, (1 - u) * 0.8); ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + 380 * easeOutCubic(u), 0, 7); ctx.stroke(); }
      if (age >= 0) flash = Math.max(flash, 0.22 * Math.exp(-age / 0.22));
    }
  }
  // the burst: white flash + a clean shock ring
  {
    const age = t - HK.drop;
    if (age >= 0 && age < 0.7 && BURST) {
      flash = Math.max(flash, 0.7 * Math.exp(-age / 0.12));
      const u = age / 0.6;
      if (u < 1) { ctx.strokeStyle = `rgba(255,252,240,${0.95 * (1 - u)})`; ctx.lineWidth = 7 * (1 - u) + 1; ctx.beginPath(); ctx.arc(BURST.x, BURST.y, BURST.r + expoOut(u) * 560, 0, 7); ctx.stroke();
        ctx.strokeStyle = `rgba(200,150,60,${0.4 * (1 - u)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(BURST.x, BURST.y, BURST.r + expoOut(u) * 560 + 6, 0, 7); ctx.stroke(); }
    }
  }
  // the landing: jade impact ring flattened in perspective (Bitcoin bottom effect)
  {
    const age = t - HK.crashEnd;
    if (age >= 0 && age < 1.2) {
      const p = projDay(c, NOW.i), u = age / 0.8;
      if (p && u < 1) { ctx.strokeStyle = rgba(JADE, (1 - u) * 0.85); ctx.lineWidth = 5 * (1 - u) + 1; const R = 30 + 460 * easeOutCubic(u); ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R * 0.33, 0, 0, 7); ctx.stroke(); }
      flash = Math.max(flash, 0.16 * Math.exp(-age / 0.15)); flashCol = [235, 255, 245];
    }
  }
  if (flash > 0.003) { ctx.fillStyle = rgba(flashCol, flash); ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- text helpers
function text(s, x, y, font, fill, align = 'left', spacing = 0) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.fillStyle = fill; ctx.fillText(s, x, y); const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w;
}
function width(s, font, spacing = 0) { ctx.font = font; ctx.letterSpacing = spacing + 'px'; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
function goldText(s, x, y, font, size, align = 'left', spacing = 0) {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.shadowColor = 'rgba(96,66,16,0.30)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = goldFill(y - size * 0.82, y + size * 0.1); ctx.fillText(s, x, y);
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(110,78,20,0.55)'; ctx.lineWidth = 1.2; ctx.strokeText(s, x, y);
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}
function shadowText(s, x, y, font, fill, align = 'left', spacing = 0, sa = 0.16) {
  ctx.save(); ctx.shadowColor = `rgba(96,70,30,${sa})`; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  const w = text(s, x, y, font, fill, align, spacing); ctx.restore(); return w;
}
function halo(s, x, y, font, align = 'left', w = 12, spacing = 0) {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(249,245,236,0.92)'; ctx.lineWidth = w; ctx.filter = 'blur(2px)'; ctx.strokeText(s, x, y); ctx.restore();
}
function goldRule(x0, x1, y, a = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(190,150,70,0)'); g.addColorStop(0.5, `rgba(190,150,70,${0.9 * a})`); g.addColorStop(1, 'rgba(190,150,70,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 1.5);
}

// ---------------------------------------------------------------- UI: head chip, card, slam, HUD, headline
function drawHeadChip(c, t, hp) {
  let a = smooth(0.2, 0.6, t) * (1 - smooth(HK.question - 0.2, HK.question + 0.1, t)) + smooth(HK.rewind + 0.1, HK.rewind + 0.4, t) * (1 - smooth(HK.y2023 - 0.15, HK.y2023, t));
  if (TL.full) a += smooth(VB(13) - 0.4, VB(13), t) * (1 - smooth(NS.question - 0.3, NS.question, t))
    + smooth(HS.t0 + 0.3, HS.t0 + 0.7, t) * (1 - smooth(HS.table - 0.3, HS.table, t));
  const vis = (1 - smooth(HK.drop - 0.02, HK.drop + 0.04, t) * (1 - smooth(HK.drop + 0.55, HK.drop + 0.8, t))) * (DS.daily ? 1 : histChipVis(t));   // peak card has the floor
  if (a * vis < 0.01 || !hp) return;
  const iso = isoOf(c.D), date = iso.slice(0, 4) + '.' + iso.slice(5, 7);
  let pv = DS.price(pAt(c.D)); if (DS.daily && Math.abs(c.D - PEAK.i) < 0.6) pv = PEAK.cny;
  const price = DS.unit + fmt(pv), unit = DS.daily ? '/克' : '/盎司';
  const fd = F.num(32), fp = F.num(44), fu = F.cnB(20);
  const wd = width(date, fd), wp = width(price, fp), wu = width(unit, fu);
  const pad = 18, gap = 20, bw = pad * 2 + wd + gap + wp + wu + 6, bh = 62;
  const bo = bubbleOff(c, t), off = bo > 0 ? bo + 26 : 34;
  const x = clamp(hp.x - bw - off, 60, W - bw - 60), y = clamp(hp.y - bh / 2 - (bo > 0 ? 0 : 52), 120, H - 220);
  ctx.save(); ctx.globalAlpha = a * vis;
  ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  rrect(x, y, bw, bh, 10); ctx.fillStyle = 'rgba(255,253,248,0.94)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(190,150,70,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  const down = ddCol(c.D) > 0.5 && !(t > HK.rewind && t < HK.y2023 + 0.3);
  ctx.fillStyle = rgba(down ? JADE : GOLD, 1); ctx.fillRect(x + pad, y + bh - 6, bw - pad * 2, 2);
  text(date, x + pad, y + 42, fd, rgba(SOFT, 1));
  ctx.fillStyle = 'rgba(150,118,60,0.35)'; ctx.fillRect(x + pad + wd + gap / 2 - 0.5, y + 16, 1, bh - 32);
  text(price, x + pad + wd + gap, y + 45, fp, rgba(down ? JADE_D : INK, 1));
  text(unit, x + pad + wd + gap + wp + 4, y + 44, fu, rgba(SOFT, 1));
  ctx.restore();
}
function drawPeakCard(c, t, hp) {
  const t0 = HK.peakTag, t1 = HK.drop + 0.25;
  if (t < t0 || t > t1 + 0.4) return;
  const p = projDay(c, PEAK.i); if (!p) return;
  const appear = easeOutBack((t - t0) / 0.38, 1.3), a = smooth(t0, t0 + 0.2, t) * (1 - smooth(t1, t1 + 0.4, t));
  const w = 440, h = 186;
  const rB = t < HK.drop ? bubbleR(c, t) : 40;
  const x = clamp(p.x + rB + 60, 60, W - w - 60) + (1 - appear) * 60, y = clamp(p.y - h * 0.5, 130, H - h - 220);
  ctx.save(); ctx.globalAlpha = a;
  // leader
  ctx.strokeStyle = 'rgba(176,136,60,0.6)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, x, 0.6), y + h / 2); ctx.lineTo(x, y + h / 2); ctx.stroke();
  ctx.fillStyle = rgba(GOLD, 1); ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, 7); ctx.fill();
  ctx.translate(x, y); const sc = lerp(0.92, 1, appear); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  rrect(0, 0, w, h, 12); ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(190,150,70,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = goldFill(0, h); rrect(0, 0, 6, h, 3); ctx.fill();
  const bw = width('历史最高', F.cnB(24)) + 24;
  rrect(30, 24, bw, 36, 7); ctx.fillStyle = rgba(OX, 1); ctx.fill();
  text('历史最高', 42, 50, F.cnB(24), '#fff');
  text('2026年1月29日', 30 + bw + 14, 50, F.cnB(24), rgba(SOFT, 1));
  goldText('¥' + fmt(PEAK.cny), 30, 128, F.num(74), 74);
  text('/克', 30 + width('¥' + fmt(PEAK.cny), F.num(74)) + 8, 126, F.cnB(26), rgba(SOFT, 1));
  text('$' + fmt(PEAK.usd) + ' / 盎司 · 史上最贵', 30, 166, F.cnB(24), rgba(SOFT, 1));
  ctx.restore();
}
function drawBracket(c, t) {
  const t0 = HK.crashEnd - 0.15, env = smooth(t0, t0 + 0.25, t) * (1 - smooth(HK.rewind, HK.rewind + 0.3, t));
  if (env <= 0.001) return null;
  const yPk = wY(c, PEAK.cny), yB = wY(c, NOW.cny);
  const P = proj(c, PEAK.i, yPk), Q = proj(c, NOW.i + 12, yPk), B = proj(c, NOW.i + 12, yB);
  if (!Q || !B) return null;
  const grow = easeOutCubic((t - t0) / 0.45);
  ctx.save();
  ctx.setLineDash([3, 8]); ctx.lineCap = 'round';
  if (P) { ctx.strokeStyle = rgba([176, 136, 60], 0.7 * env); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(lerp(P.x, Q.x, grow), lerp(P.y, Q.y, grow)); ctx.stroke(); }
  ctx.setLineDash([]);
  const yy = lerp(Q.y, B.y, grow);
  ctx.strokeStyle = rgba(JADE, 0.9 * env); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(Q.x, Q.y); ctx.lineTo(B.x, yy); ctx.stroke();
  ctx.fillStyle = rgba(JADE, 0.95 * env * grow); ctx.beginPath(); ctx.moveTo(B.x, yy + 4); ctx.lineTo(B.x - 9, yy - 12); ctx.lineTo(B.x + 9, yy - 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  return { x: B.x, top: Q.y, bot: B.y };
}
function drawSlam(c, t, br) {
  const t0 = HK.crashEnd, age = t - t0; if (age < 0) return;
  const out = smooth(HK.rewind, HK.rewind + 0.3, t); if (out >= 1) return;
  const u = age / 0.24, sc = lerp(2.1, 1.0, easeOutBack(u, 2.0)), settle = smooth(0.9, 1.4, age);
  const alpha = smooth(0, 0.08, age) * (1 - out);
  const dd = Math.abs((NOW.cny / PEAK.cny - 1) * 100).toFixed(1), s = '−' + dd + '%';
  let x = W * 0.6, y = H * 0.5;
  if (br) { x = br.x - 34; y = clamp((br.top + br.bot) / 2 + 20, 260, H - 300); }
  const size = 150 * lerp(1, 0.78, settle);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc, sc);
  halo(s, 0, 0, F.numI(size), 'right', 18);
  ctx.save(); ctx.shadowColor = rgba(JADE, 0.35); ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  text(s, 0, 0, F.numI(size), rgba(JADE, 1), 'right'); ctx.restore();
  halo('从最高点回落', -6, -size * 0.78, F.cnB(28), 'right', 10, 2);
  text('从最高点回落', -6, -size * 0.78, F.cnB(28), rgba(SOFT, 1), 'right', 2);
  ctx.restore();
}
function drawHUD(c, t) {
  let a = smooth(0.4, 1.0, t) * (1 - smooth(HK.question - 0.3, HK.question, t)) + smooth(HK.y2023 + 0.3, HK.y2023 + 0.8, t);
  if (TL.full) a = t < HS.t0 ? a * (1 - smooth(NS.question - 0.3, NS.question, t)) : smooth(HS.t0 + 0.5, HS.t0 + 1.0, t) * (1 - smooth(HS.table - 0.3, HS.table, t));
  if (a < 0.01) return;
  const x = 76, y = H - 168;
  ctx.save(); ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = 'rgba(190,150,70,0.9)'; ctx.fillRect(x, y - 6, 40, 1.5);
  text(DS.daily ? 'GOLD · 国际金价 · 折合人民币/克' : 'GOLD · 国际金价 · 美元/盎司', x + 52, y, F.caps(600, 22), rgba(GOLD_D, 1), 'left', 3);
  let ath = 0;
  if (DS.daily) { for (let d = 0; d <= Math.min(N - 1, Math.floor(c.D)); d++) ath = Math.max(ath, S.cny[d]); }
  else { for (let k = 0; k < DS.n && DS.X[k] <= c.D; k++) ath = Math.max(ath, DS.U[k]); }
  const p = DS.price(pAt(c.D)), dd = (p / Math.max(ath, p) - 1) * 100;
  text('历史最高', x, y + 44, F.cnB(24), rgba(SOFT, 1)); text('较最高点', x + 230, y + 44, F.cnB(24), rgba(SOFT, 1));
  text(DS.unit + fmt(Math.max(ath, p)), x, y + 96, F.num(46), rgba(INK, 1));
  text(dd > -0.5 ? '新高' : '−' + Math.abs(dd).toFixed(1) + '%', x + 230, y + 96, dd > -0.5 ? F.cn(40) : F.num(46), rgba(dd > -0.5 ? OX : JADE, 1));
  ctx.restore();
}
function drawHeadline(t) {
  // 0 → drop: 「黄金，一路狂飙」
  const a1 = smooth(0.25, 0.65, t) * (1 - smooth(HK.drop - 0.12, HK.drop, t));
  if (a1 > 0.01) {
    ctx.save(); ctx.globalAlpha = a1;
    const f = F.cn(72), w1 = width('黄金，一路', f), x = 110, y = 170 + 16 * (1 - a1);
    ctx.fillStyle = 'rgba(190,150,70,0.9)'; ctx.fillRect(x, 70, 46, 1.5);
    text('GOLD  ·  2024 — 2026', x + 60, 79, F.caps(600, 22), rgba(GOLD_D, 1), 'left', 5);
    shadowText('黄金，一路', x, y, f, rgba(INK, 1), 'left', 0, 0.12); goldText('狂飙', x + w1, y, f, 76);
    ctx.restore();
  }
}
function drawTitle(t) {
  const D = HK.drop; if (t < D) return;
  const out = smooth(HK.rewind, HK.rewind + 0.3, t); if (out >= 1) return;
  const u = (t - D) / 0.22, sc = lerp(1.9, 1, easeOutBack(u, 1.6));
  ctx.save(); ctx.globalAlpha = clamp((t - D) / 0.06, 0, 1) * (1 - out);
  ctx.translate(W / 2, 175); ctx.scale(sc, sc);
  const f = F.cn(132), w1 = width('黄金', f), w2 = width('暴跌', f), x = -(w1 + w2) / 2;
  halo('黄金暴跌', x, 0, f, 'left', 22);
  goldText('黄金', x, 0, f, 132);
  ctx.save(); ctx.shadowColor = rgba(JADE, 0.3); ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; text('暴跌', x + w1, 0, f, rgba(JADE, 1)); ctx.restore();
  ctx.restore();
  const v = expoOut((t - HK.crashEnd) / 0.6);
  if (v > 0) {
    ctx.save(); ctx.globalAlpha = v * (1 - out);
    const y = 236 + 8 * (1 - v);
    const pieces = [['不到 10 个月，从 ', SOFT, F.cnB(32)], ['¥' + fmt(PEAK.cny), INK, F.num(36)], [' 跌到 ', SOFT, F.cnB(32)], ['¥' + fmt(NOW.cny), JADE, F.num(36)]];
    const tw = pieces.reduce((s, p) => s + width(p[0], p[2]), 0); let x = W / 2 - tw / 2;
    for (const [s, col, f] of pieces) { halo(s, x, y, f, 'left', 10); x += text(s, x, y, f, rgba(col, 1)); }
    ctx.restore();
  }
}
function drawQuestion(t) {
  const Q = HK.question, P = HK.beat; if (t < Q - 0.12) return;
  const out = smooth(HK.rewind, HK.rewind + 0.35, t); if (out >= 1) return;
  const dimA = smooth(Q - 0.12, Q + 0.25, t) * (1 - out);
  SNAPX.clearRect(0, 0, W, H); SNAPX.drawImage(cv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = dimA; ctx.filter = 'blur(12px)'; ctx.drawImage(SNAP, 0, 0); ctx.filter = 'none';
  ctx.fillStyle = `rgba(251,248,241,${0.66 * dimA})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save();
  const parts = [['现在，', 0], ['还能', 0.5], ['买吗', 1.0], ['？', 1.0]];
  const push = 1 + 0.05 * smooth(Q, HK.rewind, t);
  ctx.translate(W / 2, 560); ctx.scale(push, push); ctx.translate(-W / 2, -560);
  const size = 170, font = F.cn(size), cy = 560 - 40 * out;
  const tot = parts.reduce((a, p) => a + width(p[0], font), 0); let x = W / 2 - tot / 2;
  for (const [s, dl] of parts) {
    const w = width(s, font), u = (t - (Q + dl * P)) / 0.3;
    if (u > 0) {
      ctx.save(); ctx.globalAlpha = (1 - out) * clamp(u * 2, 0, 1);
      const sc = lerp(1.5, 1, easeOutBack(u, 1.8));
      ctx.translate(x + w / 2, cy); ctx.scale(sc, sc);
      if (s === '？') { ctx.rotate(0.1 * Math.sin(t * 9) * beatPulse(t)); goldText(s, -w / 2, 0, font, size); }
      else shadowText(s, -w / 2, 0, font, rgba(INK, 1), 'left', 0, 0.14);
      ctx.restore();
    }
    x += w;
  }
  const su = expoOut((t - HK.sub) / 0.6);
  if (su > 0) {
    ctx.save(); ctx.globalAlpha = (1 - out) * su;
    const y = cy + 150 + 14 * (1 - su), fs = F.cnB(54);
    const pieces = [['抄底', OX], ['，还是', SOFT], ['接飞刀', JADE], ['？', SOFT]];
    const tw = pieces.reduce((a, p) => a + width(p[0], fs, 2), 0); let xx = W / 2 - tw / 2;
    goldRule(xx - 220, xx - 30, y - 18, su); goldRule(xx + tw + 30, xx + tw + 220, y - 18, su);
    for (const [s, c] of pieces) xx += text(s, xx, y, fs, rgba(c, 1), 'left', 2);
    ctx.restore();
  }
  ctx.restore();
}
function drawRewind(t) {
  const R0 = HK.rewind, R1 = HK.y2023; if (t < R0 || t > R1 + 0.2) return;
  const a = smooth(R0, R0 + 0.2, t) * (1 - smooth(R1 - 0.2, R1 + 0.02, t));
  ctx.save(); ctx.globalAlpha = a;
  for (const s of STREAKS) {
    const x = -400 + ((s.ph + (t - R0) * s.v) % (W + 1200));          // streaks fly left -> right: we travel back
    const g = ctx.createLinearGradient(x, 0, x + s.l, 0); g.addColorStop(0, 'rgba(196,154,66,0)'); g.addColorStop(1, `rgba(196,154,66,${s.a})`);
    ctx.fillStyle = g; ctx.fillRect(x, s.y, s.l, 1.5);
  }
  const cx = W / 2, cy = 170, label = '让我们把时间倒回', lw = width(label, F.cn(68), 8);
  const pulse = 0.6 + 0.4 * Math.sin((t - R0) * 12);
  for (const dx of [0, 30]) {
    const x0 = cx - lw / 2 - 110 + dx; ctx.fillStyle = goldFill(cy - 52, cy - 8); ctx.globalAlpha = a * pulse;
    ctx.beginPath(); ctx.moveTo(x0 + 28, cy - 50); ctx.lineTo(x0, cy - 28); ctx.lineTo(x0 + 28, cy - 6); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = a;
  halo(label, cx + 20, cy, F.cn(68), 'center', 18, 8);
  shadowText(label, cx + 20, cy, F.cn(68), rgba(INK, 1), 'center', 8, 0.14);
  text('REWIND', cx + 20, cy + 46, F.caps(600, 24), rgba(GOLD_D, 1), 'center', 10);
  goldRule(cx - 420, cx - 190, cy + 38); goldRule(cx + 230, cx + 460, cy + 38);
  ctx.restore();
}
function draw2023(t) {
  const T0 = HK.y2023; if (t < T0 - 0.02) return;
  const fo = TL.full ? 1 - smooth(VB(13) - 0.7, VB(13) - 0.15, t) : 1; if (fo <= 0) return;
  ctx.save(); ctx.globalAlpha = fo;
  const u = (t - T0) / 0.26;
  ctx.save(); ctx.globalAlpha = clamp((t - T0) / 0.06, 0, 1) * fo;
  ctx.translate(W / 2 + 140, 420); const s = lerp(1.7, 1, easeOutBack(u, 1.5)); ctx.scale(s, s);
  halo('2023', 0, 0, F.num(250), 'center', 24, 14);
  goldText('2023', 0, 0, F.num(250), 250, 'center', 14);
  ctx.restore();
  const v = expoOut((t - T0 - 0.15) / 0.6);
  if (v > 0) {
    ctx.save(); ctx.globalAlpha = v * fo;
    const top = '2023年1月  ·  ¥' + fmt(S.cny[0]) + '/克  ·  $' + fmt(S.usd[0]) + '/盎司';
    halo(top, W / 2 + 140, 190 - 10 * (1 - v), F.cnB(28), 'center', 10, 3);
    text(top, W / 2 + 140, 190 - 10 * (1 - v), F.cnB(28), rgba(SOFT, 1), 'center', 3);
    goldRule(W / 2 - 100, W / 2 + 380, 212);
    halo('这一轮大涨，要从这一年说起', W / 2 + 140, 512 + 12 * (1 - v), F.cnB(52), 'center', 12, 4);
    shadowText('这一轮大涨，要从这一年说起', W / 2 + 140, 512 + 12 * (1 - v), F.cnB(52), rgba(INK, 1), 'center', 4, 0.12);
    ctx.restore();
  }
  ctx.restore();
}
function drawFrameRule() {
  ctx.save(); ctx.strokeStyle = 'rgba(176,138,64,0.42)'; ctx.lineWidth = 1.2; ctx.strokeRect(32.5, 32.5, W - 65, H - 65);
  ctx.strokeStyle = 'rgba(176,138,64,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(39.5, 39.5, W - 79, H - 79); ctx.restore();
}

// 「突破 ¥1,000」 pops beside the head on each milestone beat
function drawMilestones(c, t, hp) {
  if (!hp) return;
  for (const m of HK.climb) {
    if (!m.level || m.level >= 1200) continue;
    const age = t - m.t; if (age < -0.02 || age > 0.62) continue;
    const u = easeOutBack(age / 0.26, 2.2), a = smooth(-0.02, 0.06, age) * (1 - smooth(0.36, 0.5, age));
    const y = proj(c, c.D, wY(c, m.level)); if (!y) continue;
    const x = hp.x + bubbleOff(c, t) + 34, yy = y.y - 14 - 26 * easeOutCubic(age / 0.9);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, yy); ctx.scale(u, u);
    const f1 = F.cnB(30), f2 = F.num(52), w1 = width('突破 ', f1);
    halo('突破 ', 0, 0, f1, 'left', 10); halo('¥' + fmt(m.level), w1, 0, f2, 'left', 14);
    text('突破 ', 0, 0, f1, rgba(OX, 1));
    goldText('¥' + fmt(m.level), w1, 0, f2, 52);
    ctx.restore();
  }
}

// radial zoom blur on fast camera punches (scene only, type stays crisp)
function zoomBlur(c, hp) {
  const v = CAM.zv[c.k], amt = clamp((Math.abs(v) - 0.6) / 2.5, 0, 1);
  if (amt < 0.02) return;
  const fx = hp ? hp.x : W / 2, fy = hp ? hp.y : H / 2;
  SNAPX.clearRect(0, 0, W, H); SNAPX.drawImage(cv, 0, 0);
  ctx.save();
  for (let k = 1; k <= 4; k++) {
    const sc = 1 + Math.sign(-v) * 0.012 * k * amt;
    ctx.globalAlpha = 0.20 * amt;
    ctx.setTransform(sc, 0, 0, sc, fx * (1 - sc), fy * (1 - sc));
    ctx.drawImage(SNAP, 0, 0);
  }
  ctx.restore();
}

