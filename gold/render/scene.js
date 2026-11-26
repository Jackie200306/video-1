'use strict';
/* Gold video — deterministic canvas renderer (opening hook).
   renderFrame(i) draws frame i of build/timeline.json; every frame is a pure function of i,
   so frames can be rendered in parallel. ?theme=cream|sun|blue picks the look. */

const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const THEME_NAME = new URLSearchParams(location.search).get('theme') || 'cream';

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const easeOutCubic = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeInCubic = u => Math.pow(clamp(u, 0, 1), 3);
const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const easeOutBack = (u, s = 1.9) => { u = clamp(u, 0, 1); const c3 = s + 1; return 1 + c3 * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fmt = n => Math.round(n).toLocaleString('en-US');
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function cnDate(iso, withDay = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return withDay ? `${y}年${m}月${d}日` : `${y}年${m}月`;
}

// ---------------------------------------------------------------- themes
const THEMES = {
  // 香槟奶油：浅色杂志风
  cream: {
    label: '香槟奶油',
    ink: [42, 32, 23], soft: [122, 104, 82], grid: [150, 118, 62], gridA: 0.13,
    gold: [214, 158, 46], goldHi: [246, 200, 92], glow: [232, 176, 60], glowA: 0.55,
    up: [217, 55, 47], down: [12, 156, 102],
    titleFont: 'SerifBlack', qFont: 'SerifBlack', numFont: 'Barlow',
    card: [255, 255, 255], cardA: 0.92, cardShadow: [120, 88, 36], cardInk: [42, 32, 23],
    shard: [255, 252, 240], shardA: 0.65, shardEdge: [150, 110, 40], crack: [70, 52, 30], crackA: 0.7,
    flash: [255, 255, 255], dim: [251, 246, 236],
    titleStroke: null, mood: [70, 110, 100], moodA: 0.07,
  },
  // 金色暖阳：明亮渐变 + 光芒，短视频大字风
  sun: {
    label: '金色暖阳',
    ink: [74, 40, 4], soft: [120, 72, 18], grid: [255, 255, 255], gridA: 0.28,
    gold: [255, 250, 232], goldHi: [255, 255, 255], glow: [255, 170, 0], glowA: 0.9,
    up: [229, 57, 53], down: [10, 160, 100],
    titleFont: 'NotoBlack', qFont: 'NotoBlack', numFont: 'Barlow',
    card: [255, 255, 255], cardA: 0.88, cardShadow: [150, 80, 0], cardInk: [74, 40, 4],
    shard: [255, 255, 255], shardA: 0.7, shardEdge: [255, 255, 255], crack: [255, 255, 255], crackA: 0.95,
    flash: [255, 255, 255], dim: [255, 226, 150],
    titleStroke: [92, 46, 0], mood: [40, 90, 110], moodA: 0.2,
  },
  // 宝石蓝财经：电视财经新闻风（中等亮度蓝，不是黑底）
  blue: {
    label: '宝石蓝财经',
    ink: [255, 255, 255], soft: [200, 220, 255], grid: [255, 255, 255], gridA: 0.12,
    gold: [255, 200, 61], goldHi: [255, 236, 160], glow: [255, 190, 40], glowA: 0.75,
    up: [255, 82, 82], down: [43, 224, 143],
    titleFont: 'NotoBlack', qFont: 'NotoBlack', numFont: 'Barlow',
    card: [255, 255, 255], cardA: 0.97, cardShadow: [5, 20, 60], cardInk: [18, 44, 100],
    shard: [220, 236, 255], shardA: 0.55, shardEdge: [255, 255, 255], crack: [255, 255, 255], crackA: 0.9,
    flash: [255, 255, 255], dim: [24, 62, 140],
    titleStroke: null, mood: [0, 20, 50], moodA: 0.18,
  },
};
const TH = THEMES[THEME_NAME] || THEMES.cream;

// ---------------------------------------------------------------- data
let TL, FPS, S, N, HK, PEAK, NOW, DATE0;
const dayIdx = iso => Math.round((Date.parse(iso) - DATE0) / 86400000);
function priceAt(x) {                         // fractional day index -> {cny, usd}
  const i = clamp(Math.floor(x), 0, N - 1), j = Math.min(N - 1, i + 1), f = clamp(x - i, 0, 1);
  return { cny: lerp(S.cny[i], S.cny[j], f), usd: lerp(S.usd[i], S.usd[j], f) };
}

// ---------------------------------------------------------------- static layers
let GRAIN, BOKEH, SHARDS, CRACKS, STREAKS, DUST;
function makeGrain() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d'); const img = g.createImageData(512, 512); const R = mulberry32(7);
  for (let k = 0; k < img.data.length; k += 4) {
    const v = 128 + (R() - 0.5) * 90;
    img.data[k] = v; img.data[k + 1] = v * 0.97; img.data[k + 2] = v * 0.9; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function prepStatic() {
  GRAIN = makeGrain();
  let R = mulberry32(11);
  BOKEH = Array.from({ length: 34 }, () => ({ x: R() * W, y: R() * H, r: 12 + R() * 60, s: 10 + R() * 40, a: 0.08 + R() * 0.22, ph: R() * 6.28 }));
  DUST = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, r: 1 + R() * 2.6, s: 8 + R() * 26, a: 0.15 + R() * 0.5, ph: R() * 6.28 }));
  R = mulberry32(23);
  SHARDS = Array.from({ length: 46 }, (_, k) => {
    const a = (k / 46) * Math.PI * 2 + (R() - 0.5) * 0.4;
    const n = R() < 0.5 ? 3 : 4, sz = 14 + R() * 46;
    const pts = Array.from({ length: n }, (_, q) => {
      const ang = (q / n) * Math.PI * 2 + (R() - 0.5) * 1.0; const rr = sz * (0.55 + R() * 0.6);
      return [Math.cos(ang) * rr, Math.sin(ang) * rr];
    });
    return { a, v: 520 + R() * 1250, vr: (R() - 0.5) * 16, rot0: R() * 6.28, pts, r0: 0.75 + R() * 0.3, life: 0.8 + R() * 0.6 };
  });
  R = mulberry32(31);
  CRACKS = [];
  for (let k = 0; k < 15; k++) {
    let ang = (k / 15) * Math.PI * 2 + (R() - 0.5) * 0.35;
    const len = 380 + R() * 1300; const pts = [[0, 0]]; let x = 0, y = 0, L = 0;
    while (L < len) {
      const st = 26 + R() * 60; ang += (R() - 0.5) * 0.55; x += Math.cos(ang) * st; y += Math.sin(ang) * st; L += st; pts.push([x, y, L]);
      if (R() < 0.12 && L < len * 0.7) {             // branch
        let ba = ang + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6), bx = x, by = y; const bp = [[bx, by, L]]; let bl = L;
        for (let q = 0; q < 3 + R() * 5; q++) { const s2 = 20 + R() * 40; ba += (R() - 0.5) * 0.6; bx += Math.cos(ba) * s2; by += Math.sin(ba) * s2; bl += s2; bp.push([bx, by, bl]); }
        CRACKS.push({ pts: bp, w: 1.6, len: bl });
      }
    }
    CRACKS.push({ pts, w: 2.6 + R() * 2, len });
  }
  R = mulberry32(41);
  STREAKS = Array.from({ length: 26 }, () => ({ y: R() * H, l: 200 + R() * 700, v: 2400 + R() * 3600, ph: R() * W * 2, w: 1 + R() * 3, a: 0.15 + R() * 0.35 }));
}

// ---------------------------------------------------------------- per-frame state
function state(t) {
  const D = HK.drop, P = HK.beat;
  const iBuild0 = dayIdx('2025-08-01'), iPk = PEAK.i, iNow = NOW.i;
  let h;
  // accelerating climb toward the peak
  if (t < HK.peakTag) h = lerp(iBuild0, iPk, Math.pow(t / HK.peakTag, 1.35));
  else if (t < D) h = iPk;
  else if (t < HK.crashEnd) h = lerp(iPk, iNow, easeInOut((t - D) / (HK.crashEnd - D)) * 0.35 + 0.65 * (1 - Math.pow(1 - (t - D) / (HK.crashEnd - D), 2.2)));
  else if (t < HK.rewind) h = iNow;
  else if (t < HK.y2023) h = lerp(iNow, 0, easeInOut((t - HK.rewind) / (HK.y2023 - HK.rewind - 0.1)));
  else h = lerp(0, dayIdx('2023-02-20'), easeOutCubic((t - HK.y2023) / 1.4));
  h = clamp(h, 0, iNow);

  // camera keyframes: [t, x0, x1, y0, y1]
  const K = [
    [0, '2025-06-01', '2026-04-30', 650, 1300],
    [D - 0.02, '2025-06-16', '2026-05-16', 650, 1300],
    [D + 0.25, '2025-06-16', '2026-05-16', 650, 1300],
    [HK.crashEnd + 0.1, '2025-06-16', '2026-12-28', 650, 1300],
    [HK.rewind, '2025-06-16', '2026-12-28', 650, 1300],
    [HK.rewind + 1.15, '2022-12-01', '2026-12-31', 300, 1330],
    [HK.y2023 - 0.05, '2022-11-20', '2024-02-10', 300, 1330],
  ].map(k => [k[0], dayIdx(k[1]), dayIdx(k[2]), k[3], k[4]]);
  let v = K[K.length - 1];
  for (let k = 0; k < K.length - 1; k++) {
    if (t >= K[k][0] && t < K[k + 1][0]) {
      const u = easeInOut((t - K[k][0]) / (K[k + 1][0] - K[k][0]));
      v = K[k].map((x, q) => lerp(x, K[k + 1][q], u)); break;
    }
  }
  if (t < 0) v = K[0];
  // push-in toward the peak during the build, released by the drop
  const zoom = 1 + 0.07 * smooth(0, D - 0.05, t) * (1 - smooth(D, D + 0.12, t));
  // screen shake
  const sh = shakeAt(t);
  return { t, h, x0: v[1], x1: v[2], y0: v[3], y1: v[4], zoom, sh };
}
function shakeAt(t) {
  let a = 0;
  const hit = (t0, amp, dur) => { if (t >= t0 && t < t0 + dur) a += amp * Math.pow(1 - (t - t0) / dur, 2); };
  hit(HK.drop, 26, 0.7); hit(HK.question, 7, 0.3); hit(HK.y2023, 14, 0.45);
  if (t > HK.drop - 0.22 && t < HK.drop) a += 2.5 * (t - (HK.drop - 0.22)) / 0.22;   // tremble before the burst
  return { x: a * Math.sin(t * 97.3) * Math.cos(t * 41.1), y: a * Math.sin(t * 83.9 + 1.3) };
}

// ---------------------------------------------------------------- chart geometry
const PL = 150, PR = 1770, PT = 270, PB = 960;
let VIEW;
const X = d => PL + (d - VIEW.x0) / (VIEW.x1 - VIEW.x0) * (PR - PL);
const Y = p => PB - (p - VIEW.y0) / (VIEW.y1 - VIEW.y0) * (PB - PT);

// ---------------------------------------------------------------- background
function drawBackground(st) {
  const t = st.t;
  const mood = smooth(HK.drop, HK.drop + 0.8, t) * (1 - smooth(HK.rewind, HK.rewind + 1.2, t));
  if (THEME_NAME === 'sun') {
    const g = ctx.createRadialGradient(W * 0.52, H * 0.3, 40, W * 0.52, H * 0.42, 1250);
    g.addColorStop(0, '#FFF6D2'); g.addColorStop(0.35, '#FFD978'); g.addColorStop(0.75, '#F8B23E'); g.addColorStop(1, '#EE8F2A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // light rays
    ctx.save(); ctx.translate(W * 0.52, -120); ctx.rotate(t * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 16; k++) {
      ctx.rotate(Math.PI * 2 / 16);
      const gr = ctx.createLinearGradient(0, 0, 0, 1500); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, 1500); ctx.lineTo(70, 1500); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // bokeh drifting up
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const b of BOKEH) {
      const y = ((b.y - t * b.s) % (H + 200) + H + 200) % (H + 200) - 100, x = b.x + Math.sin(t * 0.6 + b.ph) * 20;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      gr.addColorStop(0, `rgba(255,255,240,${b.a})`); gr.addColorStop(0.7, `rgba(255,250,220,${b.a * 0.5})`); gr.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
    }
    ctx.restore();
  } else if (THEME_NAME === 'blue') {
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#2F6FD6'); g.addColorStop(0.55, '#1F53B0'); g.addColorStop(1, '#173F8E');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // glossy diagonal light sweeps
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const x = ((t * 60 + k * 760) % (W + 1200)) - 600;
      const gr = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
      gr.addColorStop(0, 'rgba(120,180,255,0)'); gr.addColorStop(0.5, 'rgba(120,180,255,0.10)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 220, 0); ctx.lineTo(x + 220, 0); ctx.lineTo(x - 160, H); ctx.lineTo(x - 600, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // dot matrix
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 30; y < H; y += 40) for (let x = 30; x < W; x += 40) { ctx.fillRect(x, y, 2, 2); }
    // soft top light
    const tg = ctx.createRadialGradient(W * 0.5, -200, 50, W * 0.5, -200, 1100);
    tg.addColorStop(0, 'rgba(180,215,255,0.35)'); tg.addColorStop(1, 'rgba(180,215,255,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FDF9F0'); g.addColorStop(1, '#F2E6CD');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * 0.6, H * 0.35, 100, W * 0.6, H * 0.35, 1300);
    rg.addColorStop(0, 'rgba(255,236,190,0.55)'); rg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.07; ctx.globalCompositeOperation = 'multiply';
    const pat = ctx.createPattern(GRAIN, 'repeat'); ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore();
    // floating gold dust
    for (const b of DUST) {
      const y = ((b.y - t * b.s) % (H + 40) + H + 40) % (H + 40) - 20, x = b.x + Math.sin(t * 0.7 + b.ph) * 14;
      ctx.fillStyle = rgba([212, 160, 60], b.a * 0.6); ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
    }
  }
  if (mood > 0) { ctx.fillStyle = rgba(TH.mood, TH.moodA * mood); ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- chart
function niceStep(span) { const raw = span / 6; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function drawGrid(st, alpha) {
  const step = niceStep(VIEW.y1 - VIEW.y0);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.font = '30px BarlowSemi'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let p = Math.ceil(VIEW.y0 / step) * step; p <= VIEW.y1; p += step) {
    const y = Y(p); if (y < PT - 20) continue;
    ctx.strokeStyle = rgba(TH.grid, TH.gridA); ctx.lineWidth = 1.5; ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PR, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = rgba(TH.soft, 0.85); ctx.fillText('¥' + fmt(p), PR + 14, y);
  }
  // date axis
  const span = VIEW.x1 - VIEW.x0;
  ctx.strokeStyle = rgba(TH.grid, TH.gridA * 2.2); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PL, PB); ctx.lineTo(PR, PB); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '26px NotoMed';
  const d0 = new Date(DATE0 + VIEW.x0 * 86400000), d1 = new Date(DATE0 + VIEW.x1 * 86400000);
  const monthly = span < 700;
  for (let y = d0.getUTCFullYear(); y <= d1.getUTCFullYear(); y++) {
    for (let m = 0; m < 12; m++) {
      if (!monthly && m !== 0) continue;
      if (monthly && span > 420 && m % 2) continue;
      const di = (Date.UTC(y, m, 1) - DATE0) / 86400000; const x = X(di);
      if (x < PL - 5 || x > PR + 5) continue;
      ctx.fillStyle = rgba(TH.soft, m === 0 ? 0.95 : 0.7);
      ctx.fillRect(x - 1, PB, 2, m === 0 ? 12 : 7);
      ctx.fillText(m === 0 ? `${y}年` : `${m + 1}月`, x, PB + 16);
    }
  }
  ctx.restore();
}
function linePath(i0, i1) {
  ctx.beginPath();
  const a = Math.max(0, Math.floor(i0)), b = Math.min(N - 1, i1);
  const stepPx = (PR - PL) / (VIEW.x1 - VIEW.x0);
  const stride = stepPx < 0.7 ? 2 : 1;
  let first = true;
  for (let i = a; i <= Math.floor(b); i += stride) { const x = X(i), y = Y(S.cny[i]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
  const pe = priceAt(b); ctx.lineTo(X(b), Y(pe.cny));
}
function drawSeries(st, alpha) {
  const h = st.h, iPk = PEAK.i;
  const i0 = Math.max(0, Math.floor(VIEW.x0) - 2);
  if (h <= i0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const segs = [[i0, Math.min(h, iPk), TH.gold, TH.glow], [iPk, h, TH.down, TH.down]];
  for (const [a, b, col, glow] of segs) {
    if (b <= a) continue;
    // area
    linePath(a, b); ctx.lineTo(X(b), PB); ctx.lineTo(X(Math.max(a, Math.floor(a))), PB); ctx.closePath();
    const ag = ctx.createLinearGradient(0, PT, 0, PB); ag.addColorStop(0, rgba(glow, THEME_NAME === 'sun' ? 0.32 : 0.26)); ag.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = ag; ctx.fill();
    // glow + line
    linePath(a, b); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = rgba(glow, TH.glowA); ctx.shadowBlur = 26; ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 7; ctx.stroke();
    ctx.shadowBlur = 0;
    if (col === TH.gold) { linePath(a, b); ctx.strokeStyle = rgba(TH.goldHi, 0.9); ctx.lineWidth = 2.5; ctx.stroke(); }
  }
  // head
  const p = priceAt(h), hx = X(h), hy = Y(p.cny);
  const c = h > iPk + 0.5 ? TH.down : TH.gold;
  const pulse = beatPulse(st.t);
  ctx.fillStyle = rgba(c, 0.25); ctx.beginPath(); ctx.arc(hx, hy, 20 + 10 * pulse, 0, 7); ctx.fill();
  ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 24; ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.arc(hx, hy, 11, 0, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, 7); ctx.fill();
  ctx.restore();
  return { hx, hy };
}
function beatPulse(t) {
  let best = 0;
  for (const b of TL.bgm.beats) { const d = t - b; if (d >= 0 && d < 0.3) best = Math.max(best, Math.pow(1 - d / 0.3, 2)); }
  return best;
}

// ---------------------------------------------------------------- bubble / burst
function bubbleRadius(t) {
  const p = priceAt(stateCache.h).cny;
  return 34 + 120 * clamp((p - 760) / (1250 - 760), 0, 1) + 3 * Math.sin(t * 13) + 5 * beatPulse(t);
}
let stateCache;
function drawBubble(st) {
  const t = st.t, D = HK.drop;
  if (t >= D || t < 0.15) return;
  const p = priceAt(st.h), x = X(st.h), y = Y(p.cny);
  let r = bubbleRadius(t) * smooth(0.15, 0.6, t);
  let jx = 0, jy = 0;
  if (t > D - 0.25) { const k = (t - (D - 0.25)) / 0.25; jx = Math.sin(t * 160) * 3 * k; jy = Math.cos(t * 140) * 3 * k; r *= 1 + 0.04 * k; }
  const cx = x + jx, cy = y + jy;
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.72, 'rgba(255,255,255,0.10)'); g.addColorStop(0.93, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0.65)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  // iridescent rim
  const cg = ctx.createConicGradient(t * 0.8, cx, cy);
  ['rgba(255,120,200,0.55)', 'rgba(120,200,255,0.55)', 'rgba(140,255,180,0.5)', 'rgba(255,230,120,0.55)', 'rgba(255,120,200,0.55)'].forEach((c, k, a) => cg.addColorStop(k / (a.length - 1), c));
  ctx.strokeStyle = cg; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.stroke();
  if (THEME_NAME === 'cream') { ctx.strokeStyle = 'rgba(150,110,40,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.46, r * 0.2, r * 0.09, -0.75, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.42, cy + r * 0.5, r * 0.05, 0, 7); ctx.fill();
  // hairline cracks right before the burst
  if (t > D - 0.16) {
    const k = (t - (D - 0.16)) / 0.16; const R = mulberry32(5);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    for (let q = 0; q < 5; q++) {
      let a = R() * 6.28, px = cx + Math.cos(a) * r * 0.2, py = cy + Math.sin(a) * r * 0.2; ctx.beginPath(); ctx.moveTo(px, py);
      for (let s = 0; s < 4 * k; s++) { a += (R() - 0.5) * 1.2; px += Math.cos(a) * r * 0.22; py += Math.sin(a) * r * 0.22; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  }
  // label
  ctx.font = `${Math.round(r * 0.3)}px NotoBold`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = THEME_NAME === 'blue' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.75)';
  if (r > 90) { ctx.globalAlpha = smooth(90, 130, r); ctx.fillText('泡沫', cx, cy - r * 0.62); }
  ctx.restore();
}
function drawBurst(st) {
  const t = st.t, D = HK.drop; const tau = t - D;
  if (tau < 0 || tau > 1.6) return;
  const pk = { x: X(PEAK.i), y: Y(PEAK.cny) };
  // impact point is where the bubble was (camera at drop time)
  const o = BURST_ORIGIN;
  ctx.save();
  // shockwave rings
  for (const [d0, sp, w] of [[0, 1400, 10], [0.05, 900, 5]]) {
    const u = tau - d0; if (u < 0 || u > 0.55) continue;
    ctx.strokeStyle = rgba(TH.shardEdge, 0.8 * (1 - u / 0.55)); ctx.lineWidth = w * (1 - u / 0.55) + 1;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r + u * sp, 0, 7); ctx.stroke();
  }
  // screen cracks
  if (tau < 1.0) {
    const grow = easeOutCubic(tau / 0.09), fade = 1 - smooth(0.45, 1.0, tau);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const pass of [0, 1]) {
      for (const c of CRACKS) {
        const lim = c.len * grow; ctx.beginPath(); let started = false;
        for (const p of c.pts) {
          if ((p[2] || 0) > lim) break;
          if (!started) { ctx.moveTo(o.x + p[0], o.y + p[1]); started = true; } else ctx.lineTo(o.x + p[0], o.y + p[1]);
        }
        if (pass === 0) { ctx.strokeStyle = THEME_NAME === 'cream' ? rgba([255, 255, 255], 0.9 * fade) : rgba([40, 20, 0], 0.25 * fade); ctx.lineWidth = c.w + 3; }
        else { ctx.strokeStyle = rgba(TH.crack, TH.crackA * fade); ctx.lineWidth = c.w; }
        ctx.stroke();
      }
    }
  }
  // shards
  for (const s of SHARDS) {
    const u = tau; if (u > s.life) continue;
    const dist = s.v * u * (1 - 0.35 * u), x = o.x + Math.cos(s.a) * (o.r * s.r0 + dist), y = o.y + Math.sin(s.a) * (o.r * s.r0 + dist) + 0.5 * 2200 * u * u;
    const al = 1 - smooth(s.life * 0.55, s.life, u);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot0 + s.vr * u);
    ctx.beginPath(); s.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = rgba(TH.shard, TH.shardA * al); ctx.fill();
    ctx.strokeStyle = rgba(TH.shardEdge, 0.9 * al); ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.pts[0][0] * 0.6, s.pts[0][1] * 0.6); ctx.lineTo(s.pts[1][0] * 0.6, s.pts[1][1] * 0.6);
    ctx.strokeStyle = rgba([255, 255, 255], 0.8 * al); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
let BURST_ORIGIN = { x: 0, y: 0, r: 150 };

// ---------------------------------------------------------------- text helpers
function txt(s, x, y, o) {
  ctx.font = `${o.size}px ${o.font}`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 18; ctx.shadowOffsetY = o.oy || 6; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw || 10; ctx.strokeText(s, x, y); }
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (o.stroke2) { ctx.strokeStyle = o.stroke2; ctx.lineWidth = o.sw2 || 4; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.fill; ctx.fillText(s, x, y);
  return ctx.measureText(s).width;
}
function measure(s, size, font) { ctx.font = `${size}px ${font}`; return ctx.measureText(s).width; }
// a run of [text, color] pieces, each with the theme's title treatment
function titleRun(pieces, x, y, size, font, align = 'left', strokeCol = TH.titleStroke) {
  const tot = pieces.reduce((a, p) => a + measure(p[0], size, font), 0);
  let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  for (const [s, col, extra] of pieces) {
    const o = { size, font, fill: rgba(col, 1) };
    if (strokeCol) { o.stroke = rgba(strokeCol, 1); o.sw = size * 0.16; o.shadow = 'rgba(90,40,0,0.45)'; o.blur = 20; o.oy = 8; }
    else if (THEME_NAME === 'blue') { o.shadow = 'rgba(0,15,50,0.45)'; o.blur = 24; o.oy = 8; }
    else { o.shadow = 'rgba(120,88,36,0.18)'; o.blur = 18; o.oy = 6; }
    if (extra) Object.assign(o, extra);
    cx += txt(s, cx, y, o);
  }
  return tot;
}

// ---------------------------------------------------------------- HUD panel (top right)
function drawPanel(st, alpha) {
  if (alpha <= 0) return;
  const p = priceAt(st.h);
  let cny = p.cny, usd = p.usd;
  if (Math.abs(st.h - PEAK.i) < 0.5) { cny = PEAK.cny; usd = PEAK.usd; }
  const iso = new Date(DATE0 + Math.round(st.h) * 86400000).toISOString().slice(0, 10);
  const after = st.h > PEAK.i + 0.5;
  const col = after ? TH.down : (THEME_NAME === 'sun' ? [200, 110, 0] : THEME_NAME === 'blue' ? [176, 120, 0] : [176, 118, 20]);
  const x = 1780, y = 64, w = 430, hgt = after && st.t < HK.rewind ? 222 : 182;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = rgba(TH.cardShadow, 0.22); ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  rrect(x - w, y, w, hgt, 22); ctx.fillStyle = rgba(TH.card, TH.cardA); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = rgba(col, 1); ctx.fillRect(x - w, y + 26, 7, hgt - 52);
  txt(cnDate(iso), x - w + 34, y + 48, { size: 28, font: 'NotoMed', fill: rgba(TH.cardInk, 0.62) });
  const wNum = txt('¥' + fmt(cny), x - w + 30, y + 128, { size: 92, font: 'Barlow', fill: rgba(col, 1) });
  txt('/克', x - w + 38 + wNum, y + 126, { size: 30, font: 'NotoBold', fill: rgba(TH.cardInk, 0.75) });
  txt('$' + fmt(usd) + ' / 盎司', x - w + 34, y + 166, { size: 34, font: 'BarlowSemi', fill: rgba(TH.cardInk, 0.7) });
  if (after && st.t < HK.rewind) {
    const dd = (cny / PEAK.cny - 1) * 100;
    txt('较最高点  ' + (dd >= 0 ? '+' : '') + dd.toFixed(1) + '%', x - w + 34, y + 204, { size: 30, font: 'NotoBold', fill: rgba(TH.down, 1) });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- scene pieces
function drawHeader(st, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  const c = THEME_NAME === 'blue' ? [255, 255, 255] : TH.ink;
  if (THEME_NAME === 'blue') {
    rrect(PL - 4, 58, 132, 50, 8); ctx.fillStyle = '#E53935'; ctx.fill();
    txt('金价', PL + 62, 96, { size: 34, font: 'NotoBlack', fill: '#fff', align: 'center' });
    txt('国际现货黄金 · 人民币/克', PL + 146, 96, { size: 32, font: 'NotoBold', fill: rgba(c, 0.92) });
  } else {
    ctx.fillStyle = rgba(TH.gold, 1); ctx.fillRect(PL, 70, 8, 34);
    txt('国际现货黄金 · 人民币/克', PL + 22, 100, { size: 32, font: 'NotoBold', fill: rgba(c, 0.85) });
  }
  ctx.restore();
}
function drawPeakPin(st, alpha) {
  if (alpha <= 0 || PEAK.i > st.h + 0.5) return;
  const x = X(PEAK.i), y = Y(PEAK.cny);
  if (x < PL - 40 || x > PR + 40) return;
  const t = st.t, u = easeOutBack((t - HK.peakTag) / 0.3);
  if (u <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha * clamp((t - HK.peakTag) / 0.12, 0, 1);
  const lx = x, ly = y - 46 - 16 * (1 - u);
  ctx.translate(lx, ly); ctx.scale(0.7 + 0.3 * u, 0.7 + 0.3 * u);
  // chip
  const label = '历史最高', wl = measure(label, 30, 'NotoBlack') + 30;
  const val = '¥' + fmt(PEAK.cny) + '/克 · $' + fmt(PEAK.usd), wv = measure(val, 34, 'Barlow') + 26;
  const tw = wl + wv;
  ctx.shadowColor = rgba(TH.cardShadow, 0.25); ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rrect(-tw / 2, -54, tw, 54, 12); ctx.fillStyle = rgba(TH.card, 0.96); ctx.fill(); ctx.shadowColor = 'transparent';
  rrect(-tw / 2, -54, wl, 54, 12); ctx.fillStyle = rgba(TH.up, 1); ctx.fill(); ctx.fillRect(-tw / 2 + wl - 12, -54, 12, 54);
  txt(label, -tw / 2 + wl / 2, -16, { size: 30, font: 'NotoBlack', fill: '#fff', align: 'center' });
  txt(val, -tw / 2 + wl + 13, -14, { size: 34, font: 'Barlow', fill: rgba(TH.cardInk, 1) });
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(0, 14); ctx.closePath(); ctx.fillStyle = rgba(TH.card, 0.96); ctx.fill();
  ctx.restore();
  // date under the chip
}
function drawDrawdown(st, alpha) {
  const t = st.t; if (t < HK.badge - 0.3 || alpha <= 0) return;
  const xP = X(PEAK.i), yP = Y(PEAK.cny), xN = X(NOW.i), yN = Y(NOW.cny);
  const u = clamp((t - (HK.badge - 0.3)) / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = alpha;
  // dashed level of the high
  ctx.setLineDash([10, 10]); ctx.strokeStyle = rgba(TH.up, 0.7); ctx.lineWidth = 2.5;
  const xa = xN + 34;
  ctx.beginPath(); ctx.moveTo(xP + 16, yP); ctx.lineTo(lerp(xP + 16, xa + 14, u), yP); ctx.stroke(); ctx.setLineDash([]);
  // down arrow
  const ya = lerp(yP, yN, easeOutCubic((t - HK.badge + 0.15) / 0.35));
  if (t > HK.badge - 0.15) {
    ctx.strokeStyle = rgba(TH.down, 1); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(xa, yP); ctx.lineTo(xa, ya); ctx.stroke();
    ctx.fillStyle = rgba(TH.down, 1); ctx.beginPath(); ctx.moveTo(xa - 15, ya - 20); ctx.lineTo(xa + 15, ya - 20); ctx.lineTo(xa, ya + 4); ctx.closePath(); ctx.fill();
  }
  // badge
  const b = easeOutBack((t - HK.badge) / 0.32, 2.4);
  if (b > 0) {
    const dd = (NOW.cny / PEAK.cny - 1) * 100;
    const s = '-' + Math.abs(dd).toFixed(1) + '%';
    const bx = xa - 30, by = lerp(yP, yN, 0.5) + 10;
    ctx.translate(bx, by); ctx.scale(b, b);
    const w = measure(s, 130, 'Barlow') + 60;
    ctx.shadowColor = rgba(TH.down, 0.45); ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    rrect(-w, -112, w, 150, 26); ctx.fillStyle = rgba(TH.down, 1); ctx.fill(); ctx.shadowColor = 'transparent';
    txt(s, -w / 2, 8, { size: 130, font: 'Barlow', fill: '#fff', align: 'center' });
    txt('从最高点跌下来', -w / 2, -126, { size: 30, font: 'NotoBold', fill: rgba(THEME_NAME === 'blue' ? [255, 255, 255] : TH.ink, 0.85), align: 'center' });
  }
  ctx.restore();
}
function drawTitle(st, alpha) {
  const t = st.t, D = HK.drop; if (t < D || alpha <= 0) return;
  const u = (t - D) / 0.2, s = lerp(1.7, 1, easeOutBack(u, 1.4));
  const y = 250, x = PL;
  ctx.save(); ctx.globalAlpha = alpha * clamp(u * 2, 0, 1);
  ctx.translate(x, y); ctx.scale(s, s);
  const size = 150, font = TH.titleFont;
  const ink = THEME_NAME === 'sun' ? [255, 255, 255] : THEME_NAME === 'blue' ? [255, 255, 255] : TH.ink;
  // the title cracks in two right after it lands
  const split = easeOutCubic((t - D - 0.06) / 0.18) * 5;
  const tot = measure('黄金暴跌', size, font);
  const crack = [[-20, -60], [tot * 0.3, -40], [tot * 0.45, -78], [tot * 0.62, -52], [tot * 0.8, -88], [tot + 30, -70]];
  for (const side of [0, 1]) {
    ctx.save(); ctx.beginPath();
    if (side === 0) { ctx.moveTo(-40, -220); crack.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(tot + 60, -220); }
    else { ctx.moveTo(-40, 80); crack.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(tot + 60, 80); }
    ctx.closePath(); ctx.clip();
    ctx.translate(side ? -split : split, side ? split * 0.6 : -split * 0.6);
    titleRun([['黄金', ink], ['暴跌', TH.down]], 0, 0, size, font, 'left');
    ctx.restore();
  }
  if (split > 0.5) {
    ctx.strokeStyle = rgba(THEME_NAME === 'cream' ? [255, 255, 255] : [255, 255, 255], 0.9); ctx.lineWidth = 3;
    ctx.beginPath(); crack.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
  ctx.restore();
}
function drawQuestion(st) {
  const t = st.t, Q = HK.question, P = HK.beat;
  if (t < Q - 0.1) return 0;
  const out = smooth(HK.rewind, HK.rewind + 0.3, t);
  if (out >= 1) return 0;
  const dimA = smooth(Q - 0.1, Q + 0.15, t) * (1 - out);
  ctx.save();
  ctx.fillStyle = rgba(TH.dim, (THEME_NAME === 'blue' ? 0.72 : 0.78) * dimA); ctx.fillRect(0, 0, W, H);
  const cy = 560 - out * 60;
  ctx.globalAlpha = 1 - out;
  const parts = [['现在', 0], ['还能', 0.5], ['买吗', 1.0], ['？', 1.0]];
  const size = 190, font = TH.qFont;
  const ink = THEME_NAME === 'cream' ? TH.ink : [255, 255, 255];
  const qcol = THEME_NAME === 'blue' ? TH.gold : THEME_NAME === 'sun' ? [255, 236, 60] : TH.up;
  const tot = parts.reduce((a, p) => a + measure(p[0], size, font), 0);
  let x = W / 2 - tot / 2;
  const pulse = beatPulse(t);
  for (const [s, dl] of parts) {
    const w = measure(s, size, font); const u = (t - (Q + dl * P)) / 0.22;
    if (u > 0) {
      const sc = easeOutBack(u, 2.2) * (s === '？' ? 1 + 0.12 * pulse : 1);
      ctx.save(); ctx.translate(x + w / 2, cy); ctx.scale(sc, sc);
      if (s === '？') ctx.rotate(0.12 * Math.sin(t * 9) * pulse);
      titleRun([[s, s === '？' ? qcol : ink]], 0, size * 0.35, size, font, 'center');
      ctx.restore();
    }
    x += w;
  }
  // chips: 抄底？ 还是 接飞刀？
  const su = (t - HK.sub) / 0.25;
  if (su > 0) {
    const y = cy + 200; const items = [['抄底？', TH.up], ['还是', null], ['接飞刀？', TH.down]];
    const fs = 64; const pad = 34, gap = 26;
    const ws = items.map(([s, c]) => measure(s, fs, 'NotoBlack') + (c ? pad * 2 : 0));
    let xx = W / 2 - (ws.reduce((a, b) => a + b, 0) + gap * 2) / 2;
    items.forEach(([s, c], k) => {
      const uu = easeOutBack(su - k * 0.35, 2.0);
      if (uu > 0) {
        ctx.save(); ctx.translate(xx + ws[k] / 2, y); ctx.scale(uu, uu);
        if (c) {
          ctx.shadowColor = rgba(c, 0.4); ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
          rrect(-ws[k] / 2, -58, ws[k], 96, 48); ctx.fillStyle = rgba(c, 1); ctx.fill(); ctx.shadowColor = 'transparent';
          txt(s, 0, 12, { size: fs, font: 'NotoBlack', fill: '#fff', align: 'center' });
        } else txt(s, 0, 12, { size: fs * 0.8, font: 'NotoBold', fill: rgba(ink, 0.8), align: 'center' });
        ctx.restore();
      }
      xx += ws[k] + gap;
    });
  }
  ctx.restore();
  return dimA;
}
function drawRewind(st) {
  const t = st.t, R0 = HK.rewind, R1 = HK.y2023;
  if (t < R0 || t > R1 + 0.2) return;
  const a = smooth(R0, R0 + 0.15, t) * (1 - smooth(R1 - 0.15, R1 + 0.05, t));
  ctx.save(); ctx.globalAlpha = a;
  // streaks running right -> left
  const sc = THEME_NAME === 'blue' ? [255, 255, 255] : THEME_NAME === 'sun' ? [255, 255, 255] : [160, 120, 50];
  for (const s of STREAKS) {
    const x = W + 400 - ((s.ph + (t - R0) * s.v) % (W + 1200));
    const g = ctx.createLinearGradient(x, 0, x + s.l, 0); g.addColorStop(0, rgba(sc, s.a)); g.addColorStop(1, rgba(sc, 0));
    ctx.fillStyle = g; ctx.fillRect(x, s.y, s.l, s.w);
  }
  // rewind badge
  const cx = W / 2, cy = 150; const pulse = 0.5 + 0.5 * Math.sin((t - R0) * 14);
  const label = '时间倒回';
  const w = 120 + measure(label, 64, 'NotoBlack') + 50;
  ctx.shadowColor = rgba(TH.cardShadow, 0.3); ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
  rrect(cx - w / 2, cy - 56, w, 112, 56); ctx.fillStyle = rgba(TH.card, 0.95); ctx.fill(); ctx.shadowColor = 'transparent';
  const ic = rgba(TH.up, 0.75 + 0.25 * pulse);
  for (const dx of [0, 38]) { ctx.beginPath(); const x0 = cx - w / 2 + 56 + dx; ctx.moveTo(x0 + 36, cy - 26); ctx.lineTo(x0, cy); ctx.lineTo(x0 + 36, cy + 26); ctx.closePath(); ctx.fillStyle = ic; ctx.fill(); }
  txt(label, cx - w / 2 + 150, cy + 23, { size: 64, font: 'NotoBlack', fill: rgba(TH.cardInk, 1) });
  ctx.restore();
}
function draw2023(st) {
  const t = st.t, T0 = HK.y2023; if (t < T0 - 0.02) return;
  const u = (t - T0) / 0.25;
  ctx.save();
  const s = lerp(1.6, 1, easeOutBack(u, 1.6)); ctx.globalAlpha = clamp(u * 3, 0, 1);
  ctx.translate(W / 2, 520); ctx.scale(s, s);
  const ink = THEME_NAME === 'cream' ? TH.ink : [255, 255, 255];
  titleRun([['2023', THEME_NAME === 'cream' ? [196, 140, 30] : ink]], 0, 0, 300, 'Barlow', 'center');
  ctx.restore();
  const v = easeOutCubic((t - T0 - 0.3) / 0.4);
  if (v > 0) {
    ctx.save(); ctx.globalAlpha = v;
    titleRun([['故事从这里开始', THEME_NAME === 'cream' ? TH.ink : [255, 255, 255]]], W / 2, 640 + 20 * (1 - v), 64, TH.qFont, 'center');
    ctx.restore();
  }
}
function drawDisclaimer() {
  ctx.save(); ctx.font = '24px NotoMed'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = rgba(THEME_NAME === 'blue' ? [255, 255, 255] : TH.ink, 0.45);
  ctx.fillText('历史不代表未来 · 不构成投资建议', W - 40, H - 24); ctx.restore();
}
function drawFlash(t) {
  const D = HK.drop; let a = 0;
  if (t >= D && t < D + 0.3) a = 0.75 * Math.pow(1 - (t - D) / 0.3, 2);
  if (t >= HK.y2023 && t < HK.y2023 + 0.22) a = Math.max(a, 0.35 * Math.pow(1 - (t - HK.y2023) / 0.22, 2));
  if (a > 0) { ctx.fillStyle = rgba(TH.flash, a); ctx.fillRect(0, 0, W, H); }
  if (t < 0.12) { ctx.fillStyle = rgba(TH.dim, 1 - t / 0.12); ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- frame
function renderFrame(i) {
  const t = i / FPS;
  const st = state(t); stateCache = st;
  VIEW = st;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground(st);
  ctx.save(); ctx.translate(st.sh.x, st.sh.y);
  // chart (with the build-up push-in)
  const chartA = 1;
  const hp = priceAt(st.h);
  ctx.save();
  if (st.zoom !== 1) { const zx = X(st.h), zy = Y(hp.cny); ctx.translate(zx, zy); ctx.scale(st.zoom, st.zoom); ctx.translate(-zx, -zy); }
  drawGrid(st, 1);
  drawSeries(st, chartA);
  drawBubble(st);
  drawPeakPin(st, 1 - smooth(HK.rewind, HK.rewind + 0.4, t));
  ctx.restore();
  drawDrawdown(st, 1 - smooth(HK.rewind, HK.rewind + 0.3, t));
  drawBurst(st);
  drawHeader(st, 1 - smooth(HK.drop - 0.05, HK.drop + 0.05, t) + smooth(HK.y2023, HK.y2023 + 0.3, t));
  drawPanel(st, 1);
  drawTitle(st, 1 - smooth(HK.rewind, HK.rewind + 0.3, t));
  drawQuestion(st);
  drawRewind(st);
  draw2023(st);
  ctx.restore();
  drawFlash(t);
  drawDisclaimer();
}
window.renderFrame = renderFrame;

// ---------------------------------------------------------------- boot
(async () => {
  TL = await (await fetch('/build/timeline.json')).json();
  FPS = TL.fps; S = TL.series; N = S.date.length; HK = TL.hook; PEAK = TL.peak; NOW = TL.now;
  DATE0 = Date.parse(S.date[0]);
  S.cny[PEAK.i] = PEAK.cny; S.usd[PEAK.i] = PEAK.usd;
  const fams = ['NotoBlack', 'NotoBold', 'NotoMed', 'SerifBlack', 'SerifBold', 'Barlow', 'BarlowSemi', 'Playfair'];
  await Promise.all(fams.map(f => document.fonts.load(`40px ${f}`, '黄金暴跌现在还能买吗？抄底接飞刀时间倒回故事从这里开始国际现货人民币克历史最高较点年月日盎司泡沫跌下来来0123456789$¥%,.-')));
  prepStatic();
  // burst origin depends on camera state just before the drop
  const tb = HK.drop - 1 / FPS; const st = state(tb); stateCache = st; VIEW = st;
  const zx = X(st.h), zy = Y(priceAt(st.h).cny);
  BURST_ORIGIN = { x: zx, y: zy, r: bubbleRadius(tb) * st.zoom };
  window.READY = true;
})();
