'use strict';
/* Gold video — "lux" look: ivory studio light, metallic gold, deep emerald for the fall,
   high-contrast serif type, hairline rules, no boxes or pills.
   renderFrame(i) is a pure function of the frame index (parallel rendering). */

const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const expoOut = u => { u = clamp(u, 0, 1); return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); };
const easeOutCubic = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fmt = n => Math.round(n).toLocaleString('en-US');
function cnDate(iso) { const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; }

// ---------------------------------------------------------------- palette & type
const INK = [30, 27, 23], SOFT = [128, 113, 90], FAINT = [168, 152, 126];
const GOLD = [196, 154, 66], GOLD_D = [122, 90, 28], GOLD_L = [255, 244, 210];
const EM = [22, 92, 68], EM_D = [10, 52, 38], EM_L = [176, 228, 203];
const OX = [146, 38, 34];
const F = {
  num: (w, s) => `${s}px DMSerif, SerifBlack`,
  numI: (w, s) => `italic ${s}px DMSerif, SerifBlack`,
  cn: s => `${s}px SerifBlack`,
  cnB: s => `${s}px SerifBold`,
  caps: (w, s) => `${w} ${s}px Cormorant, SerifBold`,
};
function goldFill(y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  [['#8A6420', 0], ['#C79B40', 0.22], ['#F0D58E', 0.42], ['#FFF6DA', 0.5], ['#D9B25A', 0.62], ['#A07428', 0.82], ['#C9A04C', 1]]
    .forEach(([c, o]) => g.addColorStop(o, c));
  return g;
}

// ---------------------------------------------------------------- data
let TL, FPS, S, N, HK, PEAK, NOW, DATE0;
const dayIdx = iso => Math.round((Date.parse(iso) - DATE0) / 86400000);
function priceAt(x) {
  const i = clamp(Math.floor(x), 0, N - 1), j = Math.min(N - 1, i + 1), f = clamp(x - i, 0, 1);
  return { cny: lerp(S.cny[i], S.cny[j], f), usd: lerp(S.usd[i], S.usd[j], f) };
}

// ---------------------------------------------------------------- static layers
let GRAIN, DUST, SHARDS, CRACKS, STREAKS, SPARKS, SNAP, SNAPX;
function prepStatic() {
  GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 512;
  { const g = GRAIN.getContext('2d'), img = g.createImageData(512, 512), R = mulberry32(7);
    for (let k = 0; k < img.data.length; k += 4) { const v = 128 + (R() - 0.5) * 70; img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v * 0.96; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0); }
  let R = mulberry32(11);
  DUST = Array.from({ length: 46 }, () => ({ x: R() * W, y: R() * H, r: 0.8 + R() * 2.2, s: 6 + R() * 18, a: 0.25 + R() * 0.55, ph: R() * 6.28, tw: 0.5 + R() * 2 }));
  R = mulberry32(23);
  SHARDS = Array.from({ length: 30 }, (_, k) => {
    const a = (k / 30) * Math.PI * 2 + (R() - 0.5) * 0.5, n = R() < 0.6 ? 3 : 4, sz = 22 + R() * 54;
    const pts = Array.from({ length: n }, (_, q) => { const ang = (q / n) * Math.PI * 2 + (R() - 0.5) * 0.9, rr = sz * (0.5 + R() * 0.6); return [Math.cos(ang) * rr, Math.sin(ang) * rr]; });
    return { a, v: 420 + R() * 1000, vr: (R() - 0.5) * 9, rot0: R() * 6.28, pts, r0: 0.7 + R() * 0.35, life: 0.9 + R() * 0.6, glint: R() < 0.35 };
  });
  SPARKS = Array.from({ length: 90 }, () => {
    const a = R() * Math.PI * 2; return { a, v: 150 + R() * 650, r: 0.8 + R() * 2.4, life: 1.2 + R() * 1.4, drift: (R() - 0.5) * 40, ph: R() * 6.28, star: R() < 0.18 };
  });
  R = mulberry32(31);
  CRACKS = [];
  for (let k = 0; k < 9; k++) {
    let ang = (k / 9) * Math.PI * 2 + (R() - 0.5) * 0.5;
    const len = 300 + R() * 900, pts = [[0, 0, 0]]; let x = 0, y = 0, L = 0;
    while (L < len) { const st = 30 + R() * 70; ang += (R() - 0.5) * 0.45; x += Math.cos(ang) * st; y += Math.sin(ang) * st; L += st; pts.push([x, y, L]); }
    CRACKS.push({ pts, w: 1.6 + R() * 1.2, len });
  }
  R = mulberry32(41);
  STREAKS = Array.from({ length: 16 }, () => ({ y: 120 + R() * (H - 240), l: 260 + R() * 700, v: 2600 + R() * 3000, ph: R() * W * 2, a: 0.18 + R() * 0.3 }));
  SNAP = document.createElement('canvas'); SNAP.width = W; SNAP.height = H; SNAPX = SNAP.getContext('2d');
}

// ---------------------------------------------------------------- per-frame state
function state(t) {
  const D = HK.drop;
  const iBuild0 = dayIdx('2025-08-01'), iPk = PEAK.i, iNow = NOW.i;
  let h;
  if (t < HK.peakTag) h = lerp(iBuild0, iPk, Math.pow(t / HK.peakTag, 1.35));
  else if (t < D) h = iPk;
  else if (t < HK.crashEnd) { const u = (t - D) / (HK.crashEnd - D); h = lerp(iPk, iNow, 0.35 * easeInOut(u) + 0.65 * (1 - Math.pow(1 - u, 2.2))); }
  else if (t < HK.rewind) h = iNow;
  else if (t < HK.y2023) h = lerp(iNow, 0, easeInOut((t - HK.rewind) / (HK.y2023 - HK.rewind - 0.1)));
  else h = lerp(0, dayIdx('2023-02-20'), easeOutCubic((t - HK.y2023) / 1.4));
  h = clamp(h, 0, iNow);
  const K = [
    [0, '2025-06-01', '2026-04-30', 650, 1300],
    [D - 0.02, '2025-06-16', '2026-05-16', 650, 1300],
    [D + 0.25, '2025-06-16', '2026-05-16', 650, 1300],
    [HK.crashEnd + 0.1, '2025-04-01', '2026-12-28', 650, 1300],
    [HK.rewind, '2025-04-01', '2026-12-28', 650, 1300],
    [HK.rewind + 1.15, '2022-12-01', '2026-12-31', 300, 1330],
    [HK.y2023 - 0.05, '2022-11-20', '2024-02-10', 300, 1330],
  ].map(k => [k[0], dayIdx(k[1]), dayIdx(k[2]), k[3], k[4]]);
  let v = K[K.length - 1];
  for (let k = 0; k < K.length - 1; k++) {
    if (t >= K[k][0] && t < K[k + 1][0]) { const u = easeInOut((t - K[k][0]) / (K[k + 1][0] - K[k][0])); v = K[k].map((x, q) => lerp(x, K[k + 1][q], u)); break; }
  }
  const zoom = 1 + 0.05 * smooth(0, D - 0.05, t) * (1 - smooth(D, D + 0.15, t));
  return { t, h, x0: v[1], x1: v[2], y0: v[3], y1: v[4], zoom, sh: shakeAt(t) };
}
function shakeAt(t) {
  let a = 0;
  const hit = (t0, amp, dur) => { if (t >= t0 && t < t0 + dur) a += amp * Math.pow(1 - (t - t0) / dur, 2); };
  hit(HK.drop, 14, 0.55); hit(HK.y2023, 6, 0.4);
  if (t > HK.drop - 0.2 && t < HK.drop) a += 1.6 * (t - (HK.drop - 0.2)) / 0.2;
  return { x: a * Math.sin(t * 91.3) * Math.cos(t * 37.1), y: a * Math.sin(t * 79.9 + 1.3) };
}
function beatPulse(t) {
  let best = 0;
  for (const b of TL.bgm.beats) { const d = t - b; if (d >= 0 && d < 0.35) best = Math.max(best, Math.pow(1 - d / 0.35, 2)); }
  return best;
}

// ---------------------------------------------------------------- chart geometry
const PL = 150, PR = 1770, PT = 270, PB = 932;
let VIEW;
const X = d => PL + (d - VIEW.x0) / (VIEW.x1 - VIEW.x0) * (PR - PL);
const Y = p => PB - (p - VIEW.y0) / (VIEW.y1 - VIEW.y0) * (PB - PT);

// ---------------------------------------------------------------- background
function drawBackground(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FCFAF5'); g.addColorStop(0.6, '#F6F0E4'); g.addColorStop(1, '#ECE2CF');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft key light from above
  const k = ctx.createRadialGradient(W * 0.55, -260, 80, W * 0.55, -260, 1500);
  k.addColorStop(0, 'rgba(255,255,255,0.95)'); k.addColorStop(0.5, 'rgba(255,253,246,0.35)'); k.addColorStop(1, 'rgba(255,253,246,0)');
  ctx.fillStyle = k; ctx.fillRect(0, 0, W, H);
  // warm vignette
  const v = ctx.createRadialGradient(W / 2, H * 0.45, 500, W / 2, H * 0.45, 1250);
  v.addColorStop(0, 'rgba(150,118,64,0)'); v.addColorStop(1, 'rgba(150,118,64,0.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // linen grain
  ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  // floating gold dust with the odd glint
  for (const b of DUST) {
    const y = ((b.y - t * b.s) % (H + 40) + H + 40) % (H + 40) - 20, x = b.x + Math.sin(t * 0.5 + b.ph) * 12;
    const tw = 0.55 + 0.45 * Math.sin(t * b.tw * 3 + b.ph);
    ctx.fillStyle = rgba([205, 165, 82], b.a * tw * 0.7); ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
    if (b.r > 2.4) { ctx.strokeStyle = rgba([255, 240, 200], 0.5 * tw); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 7 * tw, y); ctx.lineTo(x + 7 * tw, y); ctx.moveTo(x, y - 7 * tw); ctx.lineTo(x, y + 7 * tw); ctx.stroke(); }
  }
  const mood = smooth(HK.drop, HK.drop + 0.8, t) * (1 - smooth(HK.rewind, HK.rewind + 1.2, t));
  if (mood > 0) { ctx.fillStyle = rgba([70, 96, 86], 0.05 * mood); ctx.fillRect(0, 0, W, H); }
}
function drawFrameRule() {
  ctx.save();
  ctx.strokeStyle = 'rgba(176,138,64,0.42)'; ctx.lineWidth = 1.2; ctx.strokeRect(32.5, 32.5, W - 65, H - 65);
  ctx.strokeStyle = 'rgba(176,138,64,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(39.5, 39.5, W - 79, H - 79);
  ctx.restore();
}

// ---------------------------------------------------------------- chart
function niceStep(span) { const raw = span / 6; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function drawGrid(alpha) {
  const step = niceStep(VIEW.y1 - VIEW.y0);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = F.num(500, 23);
  for (let p = Math.ceil(VIEW.y0 / step) * step; p <= VIEW.y1; p += step) {
    const y = Y(p); if (y < PT - 10 || y > PB - 4) continue;
    ctx.strokeStyle = 'rgba(120,96,52,0.10)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PL, Math.round(y) + 0.5); ctx.lineTo(PR, Math.round(y) + 0.5); ctx.stroke();
    if (y > 340) { ctx.fillStyle = rgba(FAINT, 1); ctx.fillText('¥' + fmt(p), PR + 14, y); }
  }
  ctx.strokeStyle = 'rgba(150,118,60,0.38)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(PL, PB + 0.5); ctx.lineTo(PR, PB + 0.5); ctx.stroke();
  const span = VIEW.x1 - VIEW.x0, monthly = span < 700;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const d0 = new Date(DATE0 + VIEW.x0 * 86400000), d1 = new Date(DATE0 + VIEW.x1 * 86400000);
  for (let yy = d0.getUTCFullYear(); yy <= d1.getUTCFullYear(); yy++) for (let m = 0; m < 12; m++) {
    if (!monthly && m) continue; if (monthly && span > 420 && m % 2) continue;
    const x = X((Date.UTC(yy, m, 1) - DATE0) / 86400000); if (x < PL - 5 || x > PR + 5) continue;
    ctx.fillStyle = rgba(m === 0 ? SOFT : FAINT, 1); ctx.fillRect(Math.round(x), PB, 1, m === 0 ? 10 : 6);
    ctx.font = m === 0 ? F.cnB(22) : F.cnB(20);
    ctx.fillText(m === 0 ? `${yy}` : `${m + 1}月`, x, PB + 16);
  }
  ctx.restore();
}
function linePath(a, b, dy = 0) {
  ctx.beginPath();
  const i0 = Math.max(0, Math.floor(a)), stride = (PR - PL) / (VIEW.x1 - VIEW.x0) < 0.7 ? 2 : 1;
  let first = true;
  for (let i = i0; i <= Math.floor(b); i += stride) { const x = X(i), y = Y(S.cny[i]) + dy; if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
  ctx.lineTo(X(b), Y(priceAt(b).cny) + dy);
}
// a metal rod: soft cast shadow, dark underside, body, specular top edge
function rod(a, b, body, dark, light, w) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.save(); ctx.shadowColor = 'rgba(86,60,18,0.30)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 10;
  linePath(a, b); ctx.strokeStyle = rgba(body, 1); ctx.lineWidth = w; ctx.stroke(); ctx.restore();
  linePath(a, b, w * 0.3); ctx.strokeStyle = rgba(dark, 0.85); ctx.lineWidth = w * 0.45; ctx.stroke();
  linePath(a, b); ctx.strokeStyle = rgba(body, 1); ctx.lineWidth = w * 0.7; ctx.stroke();
  linePath(a, b, -w * 0.2); ctx.strokeStyle = rgba(light, 0.95); ctx.lineWidth = w * 0.26; ctx.stroke();
}
function drawSeries(st) {
  const h = st.h, iPk = PEAK.i, i0 = Math.max(0, Math.floor(VIEW.x0) - 2);
  if (h <= i0) return;
  const segs = [[i0, Math.min(h, iPk), 'g'], [iPk, h, 'e']];
  for (const [a, b, k] of segs) {
    if (b <= a) continue;
    linePath(a, b); ctx.lineTo(X(b), PB); ctx.lineTo(X(a), PB); ctx.closePath();
    const ag = ctx.createLinearGradient(0, PT, 0, PB);
    ag.addColorStop(0, k === 'g' ? 'rgba(206,166,82,0.20)' : 'rgba(22,92,68,0.13)'); ag.addColorStop(1, 'rgba(206,166,82,0)');
    ctx.fillStyle = ag; ctx.fill();
  }
  for (const [a, b, k] of segs) {
    if (b <= a) continue;
    if (k === 'g') rod(a, b, [205, 162, 72], GOLD_D, GOLD_L, 9);
    else rod(a, b, [30, 112, 84], EM_D, EM_L, 9);
  }
  // head: a small gold sphere
  const p = priceAt(h), hx = X(h), hy = Y(p.cny), pulse = beatPulse(st.t);
  const em = h > iPk + 0.5;
  ctx.fillStyle = em ? 'rgba(22,92,68,0.14)' : 'rgba(205,162,72,0.20)';
  ctx.beginPath(); ctx.arc(hx, hy, 24 + 9 * pulse, 0, 7); ctx.fill();
  const sg = ctx.createRadialGradient(hx - 4, hy - 5, 1, hx, hy, 13);
  if (em) { sg.addColorStop(0, '#D9F3E6'); sg.addColorStop(0.45, '#2E8A66'); sg.addColorStop(1, '#0C3B2C'); }
  else { sg.addColorStop(0, '#FFF8E2'); sg.addColorStop(0.45, '#D9B25A'); sg.addColorStop(1, '#7A5A1C'); }
  ctx.save(); ctx.shadowColor = 'rgba(80,56,18,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 7); ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- bubble & burst
let stateCache, BURST = { x: 0, y: 0, r: 150 };
function bubbleRadius(t) {
  const p = priceAt(stateCache.h).cny;
  return 34 + 118 * clamp((p - 760) / (1250 - 760), 0, 1) + 2.5 * Math.sin(t * 11) + 4 * beatPulse(t);
}
function drawBubble(st) {
  const t = st.t, D = HK.drop; if (t >= D || t < 0.15) return;
  const p = priceAt(st.h); let r = bubbleRadius(t) * smooth(0.15, 0.7, t);
  let jx = 0, jy = 0;
  if (t > D - 0.22) { const k = (t - (D - 0.22)) / 0.22; jx = Math.sin(t * 160) * 2.5 * k; jy = Math.cos(t * 140) * 2.5 * k; r *= 1 + 0.035 * k; }
  const cx = X(st.h) + jx, cy = Y(p.cny) + jy;
  ctx.save();
  ctx.shadowColor = 'rgba(110,80,30,0.20)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
  const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.7, 'rgba(255,252,244,0.14)'); g.addColorStop(0.92, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0.78)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(176,138,64,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  // warm caustic at the bottom, cool reflection arc
  ctx.strokeStyle = 'rgba(232,196,120,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0.35, 1.45); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 3.6, 4.4); ctx.stroke();
  // specular
  ctx.filter = 'blur(2px)'; ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.45, r * 0.17, r * 0.075, -0.7, 0, 7); ctx.fill();
  ctx.filter = 'none';
  if (r > 80) { ctx.globalAlpha = 0.55 * smooth(80, 130, r); ctx.font = F.cnB(Math.round(r * 0.22)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(GOLD_D, 1); ctx.fillText('泡 沫', cx, cy - r * 0.6); }
  if (t > D - 0.15) {
    const k = (t - (D - 0.15)) / 0.15, R = mulberry32(5); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
    for (let q = 0; q < 5; q++) { let a = R() * 6.28, px = cx + Math.cos(a) * r * 0.15, py = cy + Math.sin(a) * r * 0.15; ctx.beginPath(); ctx.moveTo(px, py); for (let s = 0; s < 4 * k; s++) { a += (R() - 0.5) * 1.1; px += Math.cos(a) * r * 0.22; py += Math.sin(a) * r * 0.22; ctx.lineTo(px, py); } ctx.stroke(); }
  }
  ctx.restore();
}
function drawBurst(t) {
  const tau = t - HK.drop; if (tau < 0 || tau > 2.8) return;
  const o = BURST;
  ctx.save();
  // one clean shock ring
  if (tau < 0.6) { const u = tau / 0.6; ctx.strokeStyle = `rgba(255,250,236,${0.9 * (1 - u)})`; ctx.lineWidth = 6 * (1 - u) + 0.8; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + expoOut(u) * 520, 0, 7); ctx.stroke(); }
  // hairline cracks across the "glass" of the screen
  if (tau < 0.7) {
    const grow = easeOutCubic(tau / 0.08), fade = 1 - smooth(0.25, 0.7, tau);
    ctx.lineJoin = 'round';
    for (const pass of [0, 1]) for (const c of CRACKS) {
      const lim = c.len * grow; ctx.beginPath(); let started = false;
      for (const p of c.pts) { if (p[2] > lim) break; if (!started) { ctx.moveTo(o.x + p[0], o.y + p[1]); started = true; } else ctx.lineTo(o.x + p[0], o.y + p[1]); }
      ctx.strokeStyle = pass ? `rgba(255,255,255,${0.95 * fade})` : `rgba(90,66,30,${0.22 * fade})`; ctx.lineWidth = pass ? c.w : c.w + 2.5; ctx.stroke();
    }
  }
  // glass shards
  for (const s of SHARDS) {
    if (tau > s.life) continue;
    const d = s.v * tau * (1 - 0.3 * tau), x = o.x + Math.cos(s.a) * (o.r * s.r0 + d), y = o.y + Math.sin(s.a) * (o.r * s.r0 + d) + 0.5 * 1900 * tau * tau;
    const al = 1 - smooth(s.life * 0.5, s.life, tau);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot0 + s.vr * tau);
    ctx.beginPath(); s.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    const g = ctx.createLinearGradient(-40, -40, 40, 40); g.addColorStop(0, `rgba(255,255,255,${0.55 * al})`); g.addColorStop(1, `rgba(255,248,232,${0.12 * al})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * al})`; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = `rgba(150,112,40,${0.35 * al})`; ctx.lineWidth = 0.8; ctx.stroke();
    if (s.glint) { ctx.strokeStyle = `rgba(225,186,96,${0.9 * al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]); ctx.lineTo(s.pts[1][0], s.pts[1][1]); ctx.stroke(); }
    ctx.restore();
  }
  // gold dust that drifts down
  for (const s of SPARKS) {
    if (tau > s.life) continue;
    const u = tau, d = s.v * (1 - Math.exp(-u * 3)) / 3 * 3;
    const x = o.x + Math.cos(s.a) * (o.r * 0.6 + d * 0.6) + s.drift * u, y = o.y + Math.sin(s.a) * (o.r * 0.6 + d * 0.6) + 60 * u * u;
    const al = (1 - smooth(s.life * 0.55, s.life, u)) * (0.6 + 0.4 * Math.sin(u * 14 + s.ph));
    ctx.fillStyle = rgba([212, 172, 86], al); ctx.beginPath(); ctx.arc(x, y, s.r, 0, 7); ctx.fill();
    if (s.star) { ctx.strokeStyle = rgba([255, 244, 214], al); ctx.lineWidth = 1; const q = 5 + 4 * Math.sin(u * 10 + s.ph); ctx.beginPath(); ctx.moveTo(x - q, y); ctx.lineTo(x + q, y); ctx.moveTo(x, y - q); ctx.lineTo(x, y + q); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- text helpers
function text(s, x, y, font, fill, align = 'left', spacing = 0) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.fillStyle = fill; ctx.fillText(s, x, y); const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w;
}
function width(s, font, spacing = 0) { ctx.font = font; ctx.letterSpacing = spacing + 'px'; const w = ctx.measureText(s).width; ctx.letterSpacing = '0px'; return w; }
// metallic gold type with a fine dark edge and a soft cast shadow
function goldText(s, x, y, font, size, align = 'left', spacing = 0) {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.shadowColor = 'rgba(96,66,16,0.30)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.fillStyle = goldFill(y - size * 0.82, y + size * 0.1); ctx.fillText(s, x, y);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(110,78,20,0.55)'; ctx.lineWidth = 1.2; ctx.strokeText(s, x, y);
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}
function shadowText(s, x, y, font, fill, align = 'left', spacing = 0, sa = 0.16) {
  ctx.save(); ctx.shadowColor = `rgba(96,70,30,${sa})`; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  const w = text(s, x, y, font, fill, align, spacing); ctx.restore(); return w;
}
// ivory halo so type stays legible over the chart line
function halo(s, x, y, font, align = 'left', w = 12, spacing = 0) {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(249,245,236,0.92)'; ctx.lineWidth = w; ctx.filter = 'blur(2px)';
  ctx.strokeText(s, x, y); ctx.restore();
}
function goldRule(x0, x1, y, a = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, `rgba(190,150,70,0)`); g.addColorStop(0.5, `rgba(190,150,70,${0.9 * a})`); g.addColorStop(1, `rgba(190,150,70,0)`);
  ctx.fillStyle = g; ctx.fillRect(x0, y, x1 - x0, 1.5);
}

// ---------------------------------------------------------------- HUD
function drawHeader(alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(190,150,70,0.9)'; ctx.fillRect(PL, 92, 46, 1.5);
  text('GOLD  ·  XAU', PL + 62, 101, F.caps(600, 24), rgba(GOLD_D, 1), 'left', 6);
  text('国际金价 · 折合人民币/克', PL, 146, F.cnB(28), rgba(SOFT, 1));
  ctx.restore();
}
function drawPanel(st) {
  const t = st.t, p = priceAt(st.h);
  let cny = p.cny, usd = p.usd;
  if (Math.abs(st.h - PEAK.i) < 0.5) { cny = PEAK.cny; usd = PEAK.usd; }
  const iso = new Date(DATE0 + Math.round(st.h) * 86400000).toISOString().slice(0, 10);
  const after = st.h > PEAK.i + 0.5;
  const x = 1770;
  // keep grid lines from running through the numbers
  const bg = ctx.createRadialGradient(x - 200, 180, 20, x - 200, 180, 330);
  bg.addColorStop(0, 'rgba(252,250,245,0.95)'); bg.addColorStop(1, 'rgba(252,250,245,0)');
  ctx.fillStyle = bg; ctx.fillRect(x - 560, 40, 600, 330);
  const atPeak = t >= HK.peakTag && t < HK.drop;
  if (atPeak) {
    const a = expoOut((t - HK.peakTag) / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    text('历史最高  ·  ' + cnDate(iso), x, 104, F.cnB(26), rgba(OX, 1), 'right', 2);
    ctx.restore();
  } else text(cnDate(iso), x, 104, F.cnB(26), rgba(SOFT, 1), 'right', 1);
  const wu = width('/克', F.cnB(30));
  text('/克', x, 206, F.cnB(30), rgba(SOFT, 1), 'right');
  const col = after && t < HK.rewind ? rgba(EM, 1) : rgba(INK, 1);
  if (atPeak) goldText('¥' + fmt(cny), x - wu - 10, 206, F.num(800, 104), 104, 'right');
  else shadowText('¥' + fmt(cny), x - wu - 10, 206, F.num(800, 104), col, 'right', 0, 0.12);
  goldRule(x - 380, x + 30, 226);
  text('$' + fmt(usd) + '  / 盎司', x, 266, F.num(500, 32), rgba(SOFT, 1), 'right');
  if (after && t < HK.rewind) {
    const dd = (cny / PEAK.cny - 1) * 100;
    text('较最高点  ' + (dd >= 0 ? '+' : '−') + Math.abs(dd).toFixed(1) + '%', x, 310, F.cnB(28), rgba(EM, 1), 'right');
  }
}
function drawPeakPin(st, alpha) {
  if (alpha <= 0 || PEAK.i > st.h + 0.5) return;
  const x = X(PEAK.i), y = Y(PEAK.cny); if (x < PL - 40 || x > PR + 40) return;
  const t0 = HK.crashEnd - 0.3;                 // after the burst, once the camera has settled
  const u = expoOut((st.t - t0) / 0.5); if (u <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha * clamp((st.t - t0) / 0.15, 0, 1);
  // diamond marker + leader
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = goldFill(-8, 8); ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeStyle = 'rgba(110,78,20,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(-7, -7, 14, 14); ctx.restore();
  const top = y - 30 - 50 * u;
  ctx.fillStyle = 'rgba(160,124,52,0.7)'; ctx.fillRect(x - 0.6, top, 1.2, y - 14 - top);
  const ly = top - 12 + 14 * (1 - u);
  text('历史最高 · 2026.01.29', x, ly - 62, F.cnB(23), rgba(SOFT, 1), 'center', 1);
  const wN = width('¥' + fmt(PEAK.cny), F.num(800, 48)), wU = width(' /克', F.cnB(22));
  text('¥' + fmt(PEAK.cny), x - (wN + wU) / 2, ly - 10, F.num(800, 48), rgba(INK, 1));
  text(' /克', x - (wN + wU) / 2 + wN, ly - 10, F.cnB(22), rgba(SOFT, 1));
  text('$' + fmt(PEAK.usd) + ' / 盎司', x, ly + 22, F.num(500, 22), rgba(FAINT, 1), 'center');
  ctx.restore();
}
function drawDrawdown(st, alpha) {
  const t = st.t; if (t < HK.badge - 0.35 || alpha <= 0) return;
  const xP = X(PEAK.i), yP = Y(PEAK.cny), xN = X(NOW.i), yN = Y(NOW.cny), xa = xN + 40;
  const u = clamp((t - (HK.badge - 0.35)) / 0.35, 0, 1);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.setLineDash([2, 7]); ctx.strokeStyle = 'rgba(160,124,52,0.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xP + 14, yP); ctx.lineTo(lerp(xP + 14, xa + 12, easeOutCubic(u)), yP); ctx.stroke(); ctx.setLineDash([]);
  const v = expoOut((t - HK.badge + 0.15) / 0.5);
  if (v > 0) {
    const ya = lerp(yP, yN, v);
    ctx.fillStyle = rgba(EM, 1); ctx.fillRect(xa - 1, yP, 2, ya - yP);
    ctx.fillRect(xa - 9, yP, 18, 1.5);
    ctx.strokeStyle = rgba(EM, 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xa - 9, ya - 12); ctx.lineTo(xa, ya); ctx.lineTo(xa + 9, ya - 12); ctx.stroke();
  }
  const b = expoOut((t - HK.badge) / 0.55);
  if (b > 0) {
    const dd = Math.abs((NOW.cny / PEAK.cny - 1) * 100).toFixed(1);
    const by = lerp(yP, yN, 0.4) + 30 * (1 - b);
    ctx.globalAlpha = alpha * clamp(b * 1.4, 0, 1);
    halo('从最高点回落', xa - 30, by - 112, F.cnB(26), 'right', 10, 2);
    text('从最高点回落', xa - 30, by - 112, F.cnB(26), rgba(SOFT, 1), 'right', 2);
    halo('−' + dd + '%', xa - 26, by, F.numI(800, 132), 'right', 16);
    shadowText('−' + dd + '%', xa - 26, by, F.numI(800, 132), rgba(EM, 1), 'right', 0, 0.18);
  }
  ctx.restore();
}
function drawTitle(st, alpha) {
  const t = st.t, D = HK.drop; if (t < D || alpha <= 0) return;
  const u = expoOut((t - D) / 0.45), s = lerp(1.1, 1, u);
  ctx.save(); ctx.globalAlpha = alpha * clamp((t - D) / 0.12, 0, 1);
  const bl = (1 - u) * 14; if (bl > 0.3) ctx.filter = `blur(${bl.toFixed(1)}px)`;
  ctx.translate(PL, 260); ctx.scale(s, s);
  const size = 148, font = F.cn(size), split = easeOutCubic((t - D - 0.08) / 0.25) * 3.2;
  const tot = width('黄金暴跌', font);
  const crack = [[-20, -50], [tot * 0.28, -36], [tot * 0.46, -74], [tot * 0.6, -48], [tot * 0.8, -86], [tot + 30, -66]];
  for (const side of [0, 1]) {
    ctx.save(); ctx.beginPath();
    if (side === 0) { ctx.moveTo(-40, -220); crack.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(tot + 60, -220); }
    else { ctx.moveTo(-40, 80); crack.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(tot + 60, 80); }
    ctx.closePath(); ctx.clip();
    ctx.translate(side ? -split : split, side ? split * 0.6 : -split * 0.6);
    const w1 = goldText('黄金', 0, 0, font, size);
    shadowText('暴跌', w1, 0, font, rgba(EM, 1), 'left', 0, 0.2);
    ctx.restore();
  }
  if (split > 0.4) { ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); crack.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
  ctx.restore();
  // subtitle
  const v = expoOut((t - HK.badge) / 0.6);
  if (v > 0) {
    ctx.save(); ctx.globalAlpha = alpha * v;
    ctx.fillStyle = 'rgba(190,150,70,0.9)'; ctx.fillRect(PL, 312, 46 * v, 1.5);
    const months = 10;
    let x = PL + 62; const y = 322 + 6 * (1 - v);
    x += text(`不到 ${months} 个月，从 `, x, y, F.cnB(32), rgba(SOFT, 1));
    x += text('¥' + fmt(PEAK.cny), x, y, F.num(700, 34), rgba(INK, 1));
    x += text(' 跌到 ', x, y, F.cnB(32), rgba(SOFT, 1));
    text('¥' + fmt(NOW.cny), x, y, F.num(700, 34), rgba(EM, 1));
    ctx.restore();
  }
}
function drawQuestion(st) {
  const t = st.t, Q = HK.question, P = HK.beat;
  if (t < Q - 0.12) return;
  const out = smooth(HK.rewind, HK.rewind + 0.35, t); if (out >= 1) return;
  const dimA = smooth(Q - 0.12, Q + 0.25, t) * (1 - out);
  // frosted veil: blur what is behind, then wash it with ivory
  SNAPX.clearRect(0, 0, W, H); SNAPX.drawImage(cv, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = dimA; ctx.filter = 'blur(14px)'; ctx.drawImage(SNAP, 0, 0); ctx.filter = 'none';
  ctx.fillStyle = `rgba(251,248,241,${0.72 * dimA})`; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 1 - out;
  const parts = [['现在，', 0], ['还能', 0.5], ['买吗', 1.0], ['？', 1.0]];
  const size = 170, font = F.cn(size), cy = 560 - 40 * out;
  const tot = parts.reduce((a, p) => a + width(p[0], font), 0);
  let x = W / 2 - tot / 2;
  for (const [s, dl] of parts) {
    const w = width(s, font), u = expoOut((t - (Q + dl * P)) / 0.5);
    if (u > 0) {
      ctx.save(); ctx.globalAlpha = (1 - out) * clamp(u * 1.6, 0, 1);
      const bl = (1 - u) * 10; if (bl > 0.3) ctx.filter = `blur(${bl.toFixed(1)}px)`;
      const yy = cy + 34 * (1 - u);
      if (s === '？') goldText(s, x, yy, font, size); else shadowText(s, x, yy, font, rgba(INK, 1), 'left', 0, 0.14);
      ctx.restore();
    }
    x += w;
  }
  const su = expoOut((t - HK.sub) / 0.6);
  if (su > 0) {
    ctx.save(); ctx.globalAlpha = (1 - out) * su;
    const y = cy + 150 + 14 * (1 - su), fs = F.cnB(54);
    const pieces = [['抄底', OX], ['，还是', SOFT], ['接飞刀', EM], ['？', SOFT]];
    const tw = pieces.reduce((a, p) => a + width(p[0], fs, 2), 0);
    let xx = W / 2 - tw / 2;
    goldRule(xx - 220, xx - 30, y - 18, su); goldRule(xx + tw + 30, xx + tw + 220, y - 18, su);
    for (const [s, c] of pieces) xx += text(s, xx, y, fs, rgba(c, 1), 'left', 2);
    ctx.restore();
  }
  ctx.restore();
}
function drawRewind(st) {
  const t = st.t, R0 = HK.rewind, R1 = HK.y2023;
  if (t < R0 || t > R1 + 0.2) return;
  const a = smooth(R0, R0 + 0.2, t) * (1 - smooth(R1 - 0.2, R1 + 0.02, t));
  ctx.save(); ctx.globalAlpha = a;
  for (const s of STREAKS) {
    const x = W + 400 - ((s.ph + (t - R0) * s.v) % (W + 1200));
    const g = ctx.createLinearGradient(x, 0, x + s.l, 0); g.addColorStop(0, `rgba(196,154,66,${s.a})`); g.addColorStop(1, 'rgba(196,154,66,0)');
    ctx.fillStyle = g; ctx.fillRect(x, s.y, s.l, 1.5);
  }
  const cx = W / 2, cy = 190;
  const label = '时间倒回', lw = width(label, F.cn(68), 8);
  const pulse = 0.6 + 0.4 * Math.sin((t - R0) * 12);
  for (const dx of [0, 30]) {
    const x0 = cx - lw / 2 - 110 + dx;
    ctx.fillStyle = goldFill(cy - 52, cy - 8); ctx.globalAlpha = a * pulse;
    ctx.beginPath(); ctx.moveTo(x0 + 28, cy - 50); ctx.lineTo(x0, cy - 28); ctx.lineTo(x0 + 28, cy - 6); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = a;
  shadowText(label, cx + 20, cy, F.cn(68), rgba(INK, 1), 'center', 8, 0.14);
  text('REWIND', cx + 20, cy + 46, F.caps(600, 24), rgba(GOLD_D, 1), 'center', 10);
  goldRule(cx - 420, cx - 190, cy + 38); goldRule(cx + 230, cx + 460, cy + 38);
  ctx.restore();
}
function draw2023(st) {
  const t = st.t, T0 = HK.y2023; if (t < T0 - 0.02) return;
  const u = expoOut((t - T0) / 0.6);
  ctx.save(); ctx.globalAlpha = clamp((t - T0) / 0.1, 0, 1);
  const bl = (1 - u) * 16; if (bl > 0.3) ctx.filter = `blur(${bl.toFixed(1)}px)`;
  ctx.translate(W / 2, 560); ctx.scale(lerp(1.08, 1, u), lerp(1.08, 1, u));
  goldText('2023', 0, 0, F.num(900, 270), 270, 'center', 14);
  ctx.restore();
  const v = expoOut((t - T0 - 0.15) / 0.6);
  if (v > 0) {
    ctx.save(); ctx.globalAlpha = v;
    text('CHAPTER  ONE', W / 2, 300 - 10 * (1 - v), F.caps(600, 26), rgba(GOLD_D, 1), 'center', 12);
    goldRule(W / 2 - 160, W / 2 + 160, 322);
    shadowText('故事，从这里开始', W / 2, 668 + 12 * (1 - v), F.cnB(54), rgba(INK, 1), 'center', 6, 0.12);
    ctx.restore();
  }
}
function drawDisclaimer() {
  text('历史不代表未来 · 不构成投资建议', W - 70, H - 52, F.cnB(20), rgba(FAINT, 1), 'right', 2);
}
function drawFlash(t) {
  let a = 0;
  if (t >= HK.drop && t < HK.drop + 0.35) a = 0.6 * Math.pow(1 - (t - HK.drop) / 0.35, 2);
  if (t >= HK.y2023 && t < HK.y2023 + 0.3) a = Math.max(a, 0.3 * Math.pow(1 - (t - HK.y2023) / 0.3, 2));
  if (a > 0) { ctx.fillStyle = `rgba(255,252,242,${a})`; ctx.fillRect(0, 0, W, H); }
  if (t < 0.15) { ctx.fillStyle = `rgba(252,250,245,${1 - t / 0.15})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- frame
function renderFrame(i) {
  const t = i / FPS, st = state(t); stateCache = st; VIEW = st;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1;
  drawBackground(t);
  ctx.save(); ctx.translate(st.sh.x, st.sh.y);
  const hp = priceAt(st.h);
  ctx.save();
  if (st.zoom !== 1) { const zx = X(st.h), zy = Y(hp.cny); ctx.translate(zx, zy); ctx.scale(st.zoom, st.zoom); ctx.translate(-zx, -zy); }
  drawGrid(1); drawSeries(st); drawBubble(st);
  drawPeakPin(st, 1 - smooth(HK.rewind, HK.rewind + 0.4, t));
  ctx.restore();
  drawDrawdown(st, 1 - smooth(HK.rewind, HK.rewind + 0.3, t));
  drawBurst(t);
  drawHeader(1 - smooth(HK.drop - 0.05, HK.drop + 0.1, t) + smooth(HK.y2023 + 0.2, HK.y2023 + 0.6, t));
  drawPanel(st);
  drawTitle(st, 1 - smooth(HK.rewind, HK.rewind + 0.3, t));
  ctx.restore();
  drawQuestion(st);
  ctx.save(); ctx.translate(st.sh.x, st.sh.y);
  drawRewind(st); draw2023(st);
  ctx.restore();
  drawFlash(t);
  drawFrameRule();
  drawDisclaimer();
}
window.renderFrame = renderFrame;

(async () => {
  TL = await (await fetch('/build/timeline.json')).json();
  FPS = TL.fps; S = TL.series; N = S.date.length; HK = TL.hook; PEAK = TL.peak; NOW = TL.now;
  DATE0 = Date.parse(S.date[0]);
  S.cny[PEAK.i] = PEAK.cny; S.usd[PEAK.i] = PEAK.usd;
  const sample = '黄金暴跌现在还能买吗？，抄底还是接飞刀时间倒回故事从这里开始国际金价折合人民币克历史最高较点回落不到个月跌到年月日盎司泡沫不代表未来构成投资建议·0123456789$¥%,.−';
  await Promise.all(['SerifBlack', 'SerifBold', 'Playfair', 'Cormorant'].map(f => document.fonts.load(`40px ${f}`, sample)));
  await document.fonts.load('italic 40px DMSerif', '0123456789%.−'); await document.fonts.load('40px DMSerif', '0123456789$¥,.');
  await document.fonts.load('600 40px Cormorant', 'GOLDXAUREWINDCHAPTERONE');
  prepStatic();
  const tb = HK.drop - 1 / FPS, st = state(tb); stateCache = st; VIEW = st;
  BURST = { x: X(st.h), y: Y(priceAt(st.h).cny), r: bubbleRadius(tb) * st.zoom };
  window.READY = true;
})();
