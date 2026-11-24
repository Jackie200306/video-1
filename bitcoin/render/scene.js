'use strict';
/* Bitcoin "life line" — deterministic canvas renderer.
   renderFrame(i) draws frame i of build/timeline.json. Everything is a pure
   function of the frame index so frames can be rendered in parallel. */

const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

let TL, F, LOGP, COL, ATH, FD, NDAYS, KY, FPS, EV, T_NOW, T_END;
const ORANGE = [255, 150, 38], RED = [255, 52, 64], GOLD = [255, 205, 110], ECGC = [140, 235, 255];
const DIM = [255, 170, 95];

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const bump = (t, t0, rise, hold, fall) => smooth(t0 - rise, t0, t) * (1 - smooth(t0 + hold, t0 + hold + fall, t));
const easeOutCubic = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeOutBack = (u, s = 1.9) => { u = clamp(u, 0, 1); const c3 = s + 1; return 1 + c3 * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;
function hash(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function fmtPrice(p) {
  if (p < 0.01) return '$' + p.toFixed(5);
  if (p < 1) return '$' + p.toFixed(3);
  if (p < 100) return '$' + p.toFixed(2);
  return '$' + Math.round(p).toLocaleString('en-US');
}
function dayToDate(d) { const t = Date.UTC(2009, 0, 3) + Math.floor(d) * 86400000; return new Date(t); }
function ymStr(d) { const x = dayToDate(d); return x.getUTCFullYear() + '.' + String(x.getUTCMonth() + 1).padStart(2, '0'); }
function cnDate(iso) { const [y, m, dd] = iso.split('-').map(Number); return `${y}年${m}月${dd}日`; }

// ECG beats before the genesis block (offset in decades)
const BEATS = [-178, -86, 0];
function ecg(d) {
  let y = 0;
  for (const b of BEATS) {
    const x = d - b;
    if (x < -16 || x > 20) continue;
    const amp = b === 0 ? 1.35 : 0.85;
    y += amp * (0.07 * Math.exp(-(((x + 8) / 2.4) ** 2)) - 0.12 * Math.exp(-(((x + 1.5) / 0.6) ** 2)) +
      0.9 * Math.exp(-((x / 0.7) ** 2)) - 0.26 * Math.exp(-(((x - 1.4) / 0.7) ** 2)) +
      0.15 * Math.exp(-(((x - 9) / 3.2) ** 2)));
  }
  return y * 0.2;
}
function lpAt(d) {                      // log10 price (with ECG blips before data)
  if (d < FD) return LOGP[0] + (d < 24 ? ecg(d) : 0);
  const x = d - FD, i = Math.floor(x);
  if (i >= NDAYS - 1) return LOGP[NDAYS - 1];
  const f = x - i; return LOGP[i] * (1 - f) + LOGP[i + 1] * f;
}
function colAt(d) {
  if (d < 0) return -1; if (d < FD) return -0.5;
  const i = clamp(Math.round(d - FD), 0, NDAYS - 1); return COL[i];
}
function lineColor(c) { return c === -1 ? ECGC : c === -0.5 ? DIM : mixc(ORANGE, RED, c); }

// ---------------------------------------------------------------- camera
function camAt(i) {
  i = clamp(i, 0, TL.nF - 1);
  const yaw = F.yaw[i], pitch = F.pitch[i], dist = F.dist[i];
  const sp = Math.sin(pitch), cp = Math.cos(pitch), sY = Math.sin(yaw), cY = Math.cos(yaw);
  const Lx = F.Lx[i], Ly = F.Ly[i];
  const tanV = Math.tan(TL.fovY / 2);
  return {
    i, Lx, Ly, dist, sy: F.sy[i], ov: F.ov[i], endf: F.endf[i], cl: F.cl[i],
    C: [Lx + dist * sY * cp, Ly + dist * sp, -dist * cY * cp],
    f: [-sY * cp, -sp, cY * cp], r: [cY, 0, sY], u: [-sY * sp, cp, cY * sp],
    tanV, tanH: tanV * W / H, cr: Math.cos(F.roll[i]), sr: Math.sin(F.roll[i]),
    shx: F.shx[i], shy: F.shy[i], D: F.D[i],
  };
}
function proj(c, X, Y, Z = 0) {
  const dx = X - c.C[0], dy = Y - c.C[1], dz = Z - c.C[2];
  const zc = dx * c.f[0] + dy * c.f[1] + dz * c.f[2];
  if (zc < 2) return null;
  const xc = dx * c.r[0] + dz * c.r[2];
  const yc = dx * c.u[0] + dy * c.u[1] + dz * c.u[2];
  let px = (xc / zc / c.tanH) * W / 2, py = -(yc / zc / c.tanV) * H / 2;
  const rx = px * c.cr - py * c.sr, ry = px * c.sr + py * c.cr;
  return { x: W / 2 + rx + c.shx, y: H / 2 + ry + c.shy, z: zc, s: c.dist / zc };
}
const wY = (c, lp) => (lp - c.cl) * KY * c.sy;
function projDay(c, d) { return proj(c, d, wY(c, lpAt(d)), 0); }

// ---------------------------------------------------------------- static layers
let SKY_FAR, SKY_NEAR, CLOUDS;
function makeSkyline(w, h, seed, near) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const R = mulberry32(seed);
  let x = -20;
  while (x < w) {
    const bw = (near ? 70 : 46) + R() * (near ? 150 : 110);
    let bh = near ? 26 + R() * 95 : 50 + R() * 150;
    if (R() < 0.12) bh *= 1.45;
    const top = h - bh;
    g.fillStyle = near ? '#05070e' : '#0c1225';
    g.fillRect(x, top, bw - 3, bh);
    if (R() < 0.35) { g.fillRect(x + bw * 0.3, top - 16 - R() * 26, bw * 0.35, 30); }
    if (R() < 0.18) { g.fillRect(x + bw * 0.48, top - 60 - R() * 50, 3, 80); }
    const cols = Math.floor((bw - 12) / (near ? 15 : 11)), rows = Math.floor((bh - 14) / (near ? 19 : 14));
    const lit = 0.07 + R() * 0.2;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      if (R() > lit) continue;
      const warm = R();
      const a = near ? 0.3 + R() * 0.4 : 0.12 + R() * 0.22;
      g.fillStyle = warm < 0.8 ? `rgba(255,${(175 + R() * 50) | 0},${(95 + R() * 40) | 0},${a})` : `rgba(170,200,255,${a * 0.8})`;
      g.fillRect(x + 7 + k * (near ? 15 : 11), top + 9 + r * (near ? 19 : 14), near ? 7 : 5, near ? 10 : 7);
    }
    x += bw + R() * 8;
  }
  return c;
}
function makeClouds(w, h, seed) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const R = mulberry32(seed);
  g.filter = 'blur(38px)';
  for (let k = 0; k < 70; k++) {
    const x = R() * w, y = h * (0.15 + R() * 0.7), rx = 120 + R() * 320, ry = 30 + R() * 70;
    g.fillStyle = `rgba(${(70 + R() * 40) | 0},${(80 + R() * 40) | 0},${(130 + R() * 50) | 0},${0.08 + R() * 0.12})`;
    for (const ox of [-w, 0, w]) { g.beginPath(); g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.filter = 'none';
  return c;
}

// ---------------------------------------------------------------- init
async function init() {
  TL = await (await fetch('/build/timeline.json')).json();
  F = TL.frames; LOGP = TL.logp; COL = TL.col; ATH = TL.ath; FD = TL.first_day; NDAYS = LOGP.length;
  KY = TL.KY; FPS = TL.fps; T_NOW = TL.t_now; T_END = TL.T;
  await Promise.all(['64px NotoBlack', '40px NotoBold', '30px NotoMed', '40px Barlow', '30px BarlowSemi']
    .map(f => document.fonts.load(f, '比特币诞生价格历史0123456789$.,%')));
  SKY_FAR = makeSkyline(3600, 330, 11, false);
  SKY_NEAR = makeSkyline(3600, 200, 29, true);
  CLOUDS = makeClouds(3000, 700, 5);
  BOKEH = makeBokeh();
  prepEvents();
  window.READY = true;
}

function frameOf(t) { return clamp(Math.round(t * FPS), 0, TL.nF - 1); }

function prepEvents() {
  EV = TL.events.map((e, k) => Object.assign({}, e, { k }));
  for (const e of EV) {
    e.tend = e.kind === 'now' ? T_NOW + 2.6 : e.ta + Math.max(2.3, e.H + 1.0);
    e.lp = lpAt(e.day);
    if (e.kind === 'peak') e.badge = '历史新高';
    else if (e.kind === 'bottom') e.badge = Math.round(e.dd * 100) + '%';
    else if (e.kind === 'milestone') e.badge = '里程碑';
    else if (e.kind === 'start') e.badge = '起点';
    else if (e.kind === 'now') e.badge = '现在';
    // where the card sits vertically: head height at appearance
    const c = camAt(frameOf(e.ta + 0.05));
    const hp = projDay(c, F.D[frameOf(e.ta + 0.05)]);
    e.cardY = hp ? hp.y : H * 0.45;
    e.cardX = hp ? hp.x : W * 0.6;
  }
  for (let k = 0; k < EV.length - 1; k++) EV[k].tend = Math.min(EV[k].tend, EV[k + 1].ta + 1.5);
  const nowE = EV.find(e => e.kind === 'now');
  nowE.title = fmtPrice(Math.pow(10, LOGP[NDAYS - 1]));
  const athMax = Math.max(...ATH);
  nowE.sub = '较最高点 ' + Math.round((Math.pow(10, LOGP[NDAYS - 1]) / athMax - 1) * 100) + '%';
}

// ---------------------------------------------------------------- background
function drawSky(c, t, head) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#03050d'); g.addColorStop(0.5, '#0a1024'); g.addColorStop(0.8, '#171a33'); g.addColorStop(1, '#1d1626');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // clouds (two parallax layers)
  const cw = CLOUDS.width;
  for (let L = 0; L < 2; L++) {
    const off = ((-(c.Lx * (L ? 0.11 : 0.05)) - t * (L ? 9 : 5)) % cw + cw) % cw;
    ctx.globalAlpha = L ? 0.9 : 0.6;
    const y = L ? 120 : 20;
    ctx.drawImage(CLOUDS, off - cw, y, cw, 700); ctx.drawImage(CLOUDS, off, y, cw, 700);
  }
  ctx.globalAlpha = 1;
  // warm glow travelling with the head
  if (head) {
    const col = lineColor(colAt(c.D));
    const rg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 900);
    rg.addColorStop(0, rgba(col, 0.13)); rg.addColorStop(0.5, rgba(col, 0.04)); rg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }
  // city haze
  const hz = ctx.createLinearGradient(0, H * 0.55, 0, H);
  hz.addColorStop(0, 'rgba(255,120,60,0)'); hz.addColorStop(1, 'rgba(255,110,50,0.10)');
  ctx.fillStyle = hz; ctx.fillRect(0, H * 0.55, W, H * 0.45);
}
function drawSkyline(c, t, near) {
  const img = near ? SKY_NEAR : SKY_FAR, w = img.width;
  const off = ((-c.Lx * (near ? 0.55 : 0.22)) % w + w) % w;
  const y = near ? H - img.height + 16 : H - img.height + 4;
  ctx.globalAlpha = near ? 1 : 0.95;
  ctx.drawImage(img, off - w, y); ctx.drawImage(img, off, y);
  ctx.globalAlpha = 1;
  if (!near) {
    const fg = ctx.createLinearGradient(0, H - 230, 0, H);
    fg.addColorStop(0, 'rgba(18,20,40,0)'); fg.addColorStop(1, 'rgba(14,14,30,0.6)');
    ctx.fillStyle = fg; ctx.fillRect(0, H - 230, W, 230);
  }
}
let BOKEH;
function makeBokeh() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.35)'); rg.addColorStop(0.9, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  return c;
}
function drawBokeh(c, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const span = W + 600;
  for (let k = 0; k < 22; k++) {
    const depth = 0.6 + 1.4 * hash(k * 4.1);
    const r = 18 + 70 * hash(k * 2.3) * depth;
    const x = (((hash(k * 7.7) * span - c.Lx * 0.9 * depth - t * 6 * depth) % span) + span) % span - 300;
    const y = H * (0.15 + 0.8 * hash(k * 9.3)) + Math.sin(t * 0.4 + k) * 12;
    const warm = hash(k * 1.9) < 0.7;
    const a = (0.025 + 0.05 * hash(k * 5.5)) * (1 - 0.6 * c.endf);
    ctx.globalAlpha = a;
    ctx.filter = 'none';
    ctx.drawImage(BOKEH, x - r, y - r, r * 2, r * 2);
    if (warm) { ctx.globalAlpha = a * 0.8; ctx.fillStyle = 'rgba(255,150,60,1)'; }
  }
  ctx.restore();
}
function drawRain(t) {
  ctx.save(); ctx.lineCap = 'round';
  for (let L = 0; L < 2; L++) {
    ctx.strokeStyle = L ? 'rgba(190,205,255,0.17)' : 'rgba(150,170,230,0.10)';
    ctx.lineWidth = L ? 1.5 : 1.0;
    ctx.beginPath();
    const N = L ? 80 : 150;
    for (let k = 0; k < N; k++) {
      const a = hash(k * 3.17 + L * 101), b = hash(k * 7.71 + L * 53), sp = 0.75 + 0.5 * hash(k * 1.37 + L * 9);
      const vy = (L ? 1700 : 1150) * sp, vx = -0.2 * vy, len = (L ? 40 : 24) * sp;
      const period = (H + 240) / vy;
      const ph = ((t / period + b) % 1);
      const cyc = Math.floor(t / period + b);
      const x0 = hash(k * 5.3 + cyc * 1.91 + L) * (W + 400) - 100;
      const y = ph * (H + 240) - 120, x = x0 + vx * ph * period;
      ctx.moveTo(x, y); ctx.lineTo(x - vx / vy * len, y - len);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- rails & years
const RAIL_LABEL = { '-4': '$0.0001', '-3': '$0.001', '-2': '$0.01', '-1': '$0.1', 0: '$1', 1: '$10', 2: '$100', 3: '$1,000', 4: '$10,000', 5: '$100,000' };
function drawRails(c, t) {
  const Dh = c.D;
  const ctr = c.cl + c.Ly / (KY * c.sy), half = c.dist * c.tanV / (KY * c.sy) * 1.6;
  ctx.save();
  for (const r of TL.rails) {
    const k = r.k;
    if (k < ctr - half || k > ctr + half) continue;
    const Y = wY(c, k);
    const a = proj(c, Dh - 6000, Y), b = proj(c, Dh + c.dist * 0.75, Y);
    if (!b) continue;
    const ax = a ? a : proj(c, Dh - 300, Y); if (!ax) continue;
    const reached = r.t !== null && t >= r.t;
    const flash = r.t !== null ? bump(t, r.t, 0.02, 0.15, 1.2) : 0;
    const baseA = (reached ? 0.20 : 0.11) * (1 - c.endf * 0.6);
    const g = ctx.createLinearGradient(ax.x, ax.y, b.x, b.y);
    g.addColorStop(0, 'rgba(200,210,255,0)'); g.addColorStop(0.6, `rgba(200,210,255,${baseA})`); g.addColorStop(1, `rgba(200,210,255,${baseA * 0.5})`);
    ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.setLineDash([9, 11]);
    ctx.beginPath(); ctx.moveTo(ax.x, ax.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (flash > 0.01) {
      ctx.setLineDash([]);
      const g2 = ctx.createLinearGradient(ax.x, ax.y, b.x, b.y);
      g2.addColorStop(0, 'rgba(255,190,90,0)'); g2.addColorStop(0.7, `rgba(255,190,90,${0.7 * flash})`); g2.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.strokeStyle = g2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax.x, ax.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // label near the right end
    const lp = proj(c, Dh + c.dist * 0.42, Y);
    if (lp && lp.y > 150 && lp.y < H - 150 && c.ov < 0.5) {
      ctx.font = `${Math.round(26 + 14 * flash)}px BarlowSemi`;
      ctx.fillStyle = flash > 0.05 ? `rgba(255,205,130,${0.5 + 0.5 * flash})` : `rgba(200,210,255,${reached ? 0.5 : 0.3})`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(RAIL_LABEL[k], lp.x, lp.y - 6);
    }
  }
  ctx.restore();
}
function drawYears(c, t) {
  const Dh = c.D;
  const Yw = c.Ly - c.dist * c.tanV * 0.58;
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  for (const y of TL.years) {
    if (y.day > Dh + 1 || y.day < -1) continue;
    const p = proj(c, Math.max(y.day, 0), Yw);
    if (!p || p.x < -80 || p.x > W + 40) continue;
    const near = Math.exp(-Math.abs(Dh - y.day) / 900);
    const fresh = bump(t, y.t, 0.01, 0.2, 1.0);
    let a = (0.22 + 0.33 * near + 0.45 * fresh) * (1 - c.endf);
    if (p.x < 640 && p.y > H - 290) a *= 0.15;
    a *= 1 - c.ov;
    const sz = clamp(30 * p.s, 16, 36);
    ctx.strokeStyle = `rgba(255,200,140,${a * 0.8})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 34 * p.s); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
    ctx.font = `${Math.round(sz)}px BarlowSemi`;
    ctx.fillStyle = `rgba(255,225,190,${a})`;
    ctx.fillText(String(y.year), p.x + 7, p.y);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the life line
function collectPoints(c) {
  const Dh = c.D, pts = [];
  let prevOff = null;
  const add = (d, lp, col) => {
    const p = proj(c, d, wY(c, lp)); if (!p) return;
    p.d = d; p.c = col;
    if (p.x < -350) { prevOff = p; return; }
    if (prevOff) { pts.push(prevOff); prevOff = null; }
    const q = pts[pts.length - 1];
    if (q && q.c === col && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) < 1.2) return;
    pts.push(p);
  };
  const dEnd = Math.min(Dh, FD);
  for (let d = -240; d < dEnd; d += (d > -200 && d < 24 && d > -200 ? 0.35 : 2)) add(d, lpAt(d), colAt(d));
  for (let k = Math.max(FD, Math.ceil(dEnd)); k < Dh; k++) add(k, LOGP[k - FD], COL[k - FD]);
  const hp = proj(c, Dh, wY(c, lpAt(Dh)));
  if (hp) { hp.d = Dh; hp.c = colAt(Dh); pts.push(hp); }
  return pts;
}
function drawLine(c, t, pts) {
  if (pts.length < 2) return;
  const Dh = c.D;
  const ov = c.ov;
  // runs of equal (colour, alpha) buckets
  const runs = []; let cur = null;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const age = Dh - p.d;
    let a = lerp(0.34, 1.0, Math.exp(-age / 170));
    a = lerp(a, 0.92, ov);
    if (p.c === -0.5) a *= 0.5;
    const cb = p.c < 0 ? p.c : Math.round(p.c * 6) / 6;
    const ab = Math.round(a * 10) / 10;
    if (!cur || cur.cb !== cb || cur.ab !== ab) {
      if (cur) cur.pts.push(p);
      cur = { cb, ab, pts: cur ? [cur.pts[cur.pts.length - 1], p] : [p], s: 0 };
      if (cur.pts.length === 2 && cur.pts[0] === p) cur.pts.shift();
      runs.push(cur);
    } else cur.pts.push(p);
  }
  for (const r of runs) { let s = 0; for (const p of r.pts) s += p.s; r.s = clamp(s / r.pts.length, 0.3, 1.6); r.col = lineColor(r.cb); }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const passes = [[30, 0.035], [15, 0.075], [7, 0.22]];
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of passes) {
    for (const r of runs) {
      if (r.pts.length < 2) continue;
      ctx.strokeStyle = rgba(r.col, a * r.ab); ctx.lineWidth = w * r.s;
      ctx.beginPath(); ctx.moveTo(r.pts[0].x, r.pts[0].y);
      for (let k = 1; k < r.pts.length; k++) ctx.lineTo(r.pts[k].x, r.pts[k].y);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const r of runs) {
    if (r.pts.length < 2) continue;
    ctx.strokeStyle = rgba(mixc(r.col, [255, 255, 255], 0.3), r.ab); ctx.lineWidth = 3.0 * r.s;
    if (r.cb === -0.5) ctx.setLineDash([6, 8]); else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(r.pts[0].x, r.pts[0].y);
    for (let k = 1; k < r.pts.length; k++) ctx.lineTo(r.pts[k].x, r.pts[k].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}
function drawFill(c, pts) {
  const Dh = c.D; if (Dh < FD) return;
  const sel = pts.filter(p => p.d > Dh - 420 && p.d >= FD);
  if (sel.length < 3) return;
  let minY = 1e9; for (const p of sel) minY = Math.min(minY, p.y);
  const col = lineColor(colAt(Dh));
  const g = ctx.createLinearGradient(0, minY, 0, H);
  g.addColorStop(0, rgba(col, 0.11 * (1 - c.ov))); g.addColorStop(0.6, rgba(col, 0.03)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(sel[0].x, H);
  for (const p of sel) ctx.lineTo(p.x, p.y);
  ctx.lineTo(sel[sel.length - 1].x, H); ctx.closePath(); ctx.fill();
}
function drawHead(c, t, hp) {
  const col = lineColor(colAt(c.D));
  const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 / 0.95)), 12);
  // light beam to the ground
  const bg = ctx.createLinearGradient(0, hp.y, 0, H);
  bg.addColorStop(0, rgba(col, 0.22)); bg.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = bg; ctx.fillRect(hp.x - 1, hp.y, 2, H - hp.y);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 230 * (1 + 0.1 * beat));
  g.addColorStop(0, rgba(col, 0.34)); g.addColorStop(0.25, rgba(col, 0.12)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp.x, hp.y, 240, 0, Math.PI * 2); ctx.fill();
  g = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 36);
  g.addColorStop(0, 'rgba(255,248,235,0.95)'); g.addColorStop(0.35, rgba(col, 0.75)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp.x, hp.y, 36, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 5.5 + 1.5 * beat, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- markers & annotations
const CYCLE = new Set(['2011-06-08', '2013-12-04', '2017-12-17', '2021-11-10', '2025-10-06']);
function drawMarkers(c, t) {
  ctx.save(); ctx.textAlign = 'center';
  for (const e of EV) {
    if (t < e.t + 0.2) continue;
    if (e.kind !== 'peak' && !(e.kind === 'bottom' && !e.minor)) continue;
    const p = projDay(c, e.day); if (!p || p.x < -60 || p.x > W + 60) continue;
    if (Math.abs(p.x - c._hx) < 30 && Math.abs(p.y - c._hy) < 30) continue;
    const cycle = CYCLE.has(e.d) || (e.kind === 'bottom' && !e.minor);
    let fade = smooth(e.t + 0.2, e.t + 1.6, t) * clamp(0.35 + 0.65 * p.s, 0.3, 1) * (1 - 0.7 * c.endf);
    if (!cycle) fade *= 1 - c.ov;
    fade *= 1 - 0.55 * smooth(TL.end.q - 0.3, TL.end.q + 0.3, t) * (1 - smooth(TL.end.fin - 0.3, TL.end.fin + 0.3, t));
    if (fade < 0.01) continue;
    const isPeak = e.kind === 'peak';
    const col = isPeak ? GOLD : RED;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
    g.addColorStop(0, rgba(col, 0.8 * fade)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba([255, 255, 255], fade); ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
    const txt = isPeak ? fmtPrice(e.p) : Math.round(e.dd * 100) + '%';
    const sz = Math.round(clamp(25 * Math.sqrt(p.s), 16, 30));
    ctx.font = `${sz}px Barlow`;
    const ty = isPeak ? p.y - 16 : p.y + sz + 12;
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(5,8,18,${0.7 * fade})`; ctx.strokeText(txt, p.x, ty);
    ctx.fillStyle = rgba(isPeak ? [255, 214, 150] : [255, 120, 120], fade); ctx.fillText(txt, p.x, ty);
  }
  ctx.restore();
}
function dashedPath(a, b, col, alpha, w = 2) {
  ctx.strokeStyle = rgba(col, alpha); ctx.lineWidth = w; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
}
function drawBrackets(c, t) {
  for (const e of EV) {
    if (e.kind !== 'bottom') continue;
    const env = smooth(e.t, e.t + 0.25, t) * (1 - smooth(e.t + 2.6, e.t + 3.4, t));
    if (env <= 0.001) continue;
    const yPk = wY(c, Math.log10(e.peak_p)), yB = wY(c, lpAt(e.day));
    const P = proj(c, e.peak_day, yPk), Q = proj(c, e.day, yPk), B = proj(c, e.day, yB);
    if (!Q || !B) continue;
    const grow = easeOutCubic((t - e.t) / 0.45);
    ctx.save();
    if (P) dashedPath(P, { x: lerp(P.x, Q.x, grow), y: lerp(P.y, Q.y, grow) }, [255, 120, 120], 0.55 * env);
    const yy = lerp(Q.y, B.y, grow);
    dashedPath(Q, { x: B.x, y: yy }, [255, 90, 90], 0.8 * env, 2.5);
    // arrow head
    ctx.fillStyle = rgba([255, 90, 90], 0.9 * env * grow);
    ctx.beginPath(); ctx.moveTo(B.x, yy + 4); ctx.lineTo(B.x - 9, yy - 12); ctx.lineTo(B.x + 9, yy - 12); ctx.closePath(); ctx.fill();
    ctx.restore();
    e._bracket = { x: B.x, y: (Q.y + B.y) / 2, top: Q.y, bot: B.y };
  }
}
function drawSlams(c, t) {
  for (const e of EV) {
    if (e.kind !== 'bottom') continue;
    const age = t - e.t;
    if (age < 0 || age > 3.6) continue;
    const big = !e.minor;
    const u = age / 0.22;
    const sc = lerp(2.3, 1.0, easeOutBack(u, 2.2));
    const settle = smooth(1.5, 2.1, age);
    const alpha = smooth(0, 0.08, age) * (1 - smooth(3.0, 3.6, age));
    const txt = Math.round(e.dd * 100) + '%';
    let x, y;
    const br = e._bracket;
    if (br) { x = br.x - 26; y = clamp((br.top + br.bot) / 2, 230, H - 330); }
    else { const p = projDay(c, e.day); x = p ? p.x - 30 : W / 2; y = p ? p.y - 60 : H / 2; }
    const size = (big ? 150 : 96) * lerp(1, 0.55, settle);
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.font = `${Math.round(size)}px Barlow`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = `rgba(20,4,8,${0.55 * alpha})`; ctx.strokeText(txt, 0, 0);
    ctx.shadowColor = `rgba(255,40,40,${0.9 * alpha})`; ctx.shadowBlur = 40;
    ctx.fillStyle = `rgba(255,70,70,${alpha})`;
    ctx.fillText(txt, 0, 0);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,220,220,${0.5 * alpha})`; ctx.strokeText(txt, 0, 0);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- particles & bursts
function drawParticles(c, t, i) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // continuous: sparks falling off the head in crashes, embers rising in rallies
  for (let j = i - 70; j <= i; j++) {
    if (j < 2) continue;
    const Dj = F.D[j], Dp = F.D[j - 1];
    if (Dj < FD) continue;
    const rate = (lpAt(Dj) - lpAt(Dp)) * FPS;         // decades per second
    let n = 0, fall = false;
    if (rate < -0.06) { n = Math.min(5, (-rate - 0.06) * 9); fall = true; }
    else if (rate > 0.10) { n = Math.min(3, (rate - 0.10) * 4); }
    n = Math.floor(n + hash(j * 1.731));
    if (!n) continue;
    const age = (i - j) / FPS;
    const anchor = proj(c, Dj, wY(c, lpAt(Dj))); if (!anchor) continue;
    for (let k = 0; k < n; k++) {
      const h1 = hash(j * 13.1 + k * 7.3), h2 = hash(j * 3.7 + k * 17.9), h3 = hash(j * 9.9 + k * 1.1);
      const life = 0.6 + 0.6 * h3;
      if (age > life) continue;
      let x, y, col;
      if (fall) {
        x = anchor.x + (h1 - 0.5) * 220 * age; y = anchor.y + (-80 * h2) * age + 0.5 * 1100 * age * age;
        col = mixc(RED, [255, 190, 90], h2);
      } else {
        x = anchor.x + (h1 - 0.5) * 80 * age - 30 * age; y = anchor.y - (60 + 120 * h2) * age;
        col = GOLD;
      }
      const a = (1 - age / life) * (fall ? 0.9 : 0.6);
      const r = fall ? 2.2 + 1.6 * h1 : 1.6 + 1.2 * h1;
      ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // coin shower when the amount lands
  {
    const E = TL.end, tl = E.rev + E.rev_count, age = t - tl;
    if (age > 0 && age < 2.2) {
      for (let k = 0; k < 120; k++) {
        const h1 = hash(k * 3.1 + 7), h2 = hash(k * 5.7 + 1), h3 = hash(k * 9.3 + 4);
        const life = 1.2 + h3; if (age > life) continue;
        const ang = -Math.PI / 2 + (h1 - 0.5) * 2.6, sp = 380 + 700 * h2;
        const x = INV_X + Math.cos(ang) * sp * age, y = INV_Y + Math.sin(ang) * sp * age + 0.5 * 1500 * age * age;
        const a = Math.pow(1 - age / life, 1.2);
        ctx.fillStyle = rgba(mixc(GOLD, [255, 255, 255], h3 * 0.5), a);
        ctx.beginPath(); ctx.ellipse(x, y, 4 + 4 * h3, (4 + 4 * h3) * Math.abs(Math.cos(age * 9 + k)), 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // bursts: peaks (gold), bubble break (shards), impacts (red debris)
  for (const e of EV) {
    const list = [];
    if (e.kind === 'peak') { list.push([e.t, e.day, 'gold']); list.push([e.t_break, e.break_day, 'shard']); }
    if (e.kind === 'bottom' || e.flash) list.push([e.t, e.day, 'red']);
    for (const [tb, dday, kind] of list) {
      const age = t - tb; if (age < 0 || age > 1.8) continue;
      const anchor = projDay(c, dday); if (!anchor) continue;
      const N = kind === 'gold' ? (e.big ? 90 : e.minor ? 30 : 55) : kind === 'shard' ? 34 : (e.minor ? 26 : 60);
      for (let k = 0; k < N; k++) {
        const h1 = hash(e.k * 91 + k * 3.3 + kind.length), h2 = hash(e.k * 17 + k * 9.1), h3 = hash(e.k * 5 + k * 1.7);
        const life = 0.8 + 0.9 * h3; if (age > life) continue;
        const ang = h1 * Math.PI * 2;
        let sp, g, col, r;
        if (kind === 'gold') { sp = 160 + 520 * h2; g = 160; col = mixc(GOLD, [255, 255, 255], h3 * 0.6); r = 1.6 + 2 * h3; }
        else if (kind === 'shard') { sp = 120 + 380 * h2; g = 900; col = mixc([255, 230, 200], ORANGE, h3); r = 1.5 + 2.5 * h3; }
        else { sp = 140 + 560 * h2; g = 1300; col = mixc(RED, [255, 170, 90], h3 * 0.5); r = 2 + 2.6 * h3; }
        const drag = Math.exp(-age * 1.6);
        const dx = Math.cos(ang) * sp * (1 - drag) / 1.6;
        const dy = Math.sin(ang) * sp * (1 - drag) / 1.6 - (kind === 'red' ? 260 * h2 * age : 0) + 0.5 * g * age * age;
        const a = Math.pow(1 - age / life, 1.3);
        ctx.fillStyle = rgba(col, a);
        if (kind === 'shard') {
          ctx.save(); ctx.translate(anchor.x + dx, anchor.y + dy); ctx.rotate(ang + age * 8 * (h2 - 0.5));
          ctx.beginPath(); ctx.moveTo(-r * 1.8, 0); ctx.lineTo(0, -r * 0.7); ctx.lineTo(r * 2.2, r * 0.4); ctx.closePath(); ctx.fill(); ctx.restore();
        } else { ctx.beginPath(); ctx.arc(anchor.x + dx, anchor.y + dy, r, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  ctx.restore();
}
function drawEffects(c, t, hp) {
  ctx.save();
  let flash = 0, flashCol = [255, 200, 120];
  for (const e of EV) {
    if (e.kind === 'peak') {
      const age = t - e.t;
      const p = projDay(c, e.day);
      if (age > -0.05 && age < 1.6 && p) {
        const scale = e.big ? 1.5 : e.minor ? 0.7 : 1.0;
        // rays
        const ra = bump(t, e.t + 0.05, 0.1, 0.25, 0.9) * 0.5 * scale;
        if (ra > 0.01) {
          ctx.globalCompositeOperation = 'lighter';
          const nR = 16, rot = t * 0.35 + e.k;
          for (let k = 0; k < nR; k++) {
            const ang = rot + k * Math.PI * 2 / nR, len = (260 + 160 * hash(k + e.k)) * scale * (0.6 + 0.4 * easeOutCubic(age / 0.6));
            const g = ctx.createLinearGradient(p.x, p.y, p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len);
            g.addColorStop(0, rgba(GOLD, ra)); g.addColorStop(1, rgba(GOLD, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + Math.cos(ang - 0.035) * len, p.y + Math.sin(ang - 0.035) * len);
            ctx.lineTo(p.x + Math.cos(ang + 0.035) * len, p.y + Math.sin(ang + 0.035) * len); ctx.closePath(); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        // ring
        const u = age / 0.9;
        if (u > 0 && u < 1) {
          ctx.strokeStyle = rgba(GOLD, (1 - u) * 0.8); ctx.lineWidth = 4 * (1 - u) + 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, 20 + 380 * scale * easeOutCubic(u), 0, Math.PI * 2); ctx.stroke();
        }
        if (age >= 0) flash = Math.max(flash, 0.20 * scale * Math.exp(-age / 0.22));
      }
      // bubble break flash
      const ab = t - e.t_break;
      if (ab > 0 && ab < 0.6) flash = Math.max(flash, 0.10 * Math.exp(-ab / 0.12));
    }
    if (e.kind === 'bottom' || e.flash) {
      const age = t - e.t;
      if (age >= 0 && age < 1.4) {
        const p = projDay(c, e.day);
        const scale = e.minor ? 0.6 : 1.0;
        const f = 0.30 * scale * Math.exp(-age / 0.18);
        if (f > flash) { flash = f; flashCol = [255, 40, 40]; }
        const u = age / 0.8;
        if (p && u < 1) {
          ctx.strokeStyle = rgba(RED, (1 - u) * 0.9); ctx.lineWidth = 6 * (1 - u) + 1;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 30 + 520 * scale * easeOutCubic(u), (30 + 520 * scale * easeOutCubic(u)) * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
  }
  if (flash > 0.003) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(flashCol, flash); ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ---------------------------------------------------------------- UI
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function drawHeadChip(c, t, hp) {
  const Dh = c.D;
  const a = smooth(-30, 2, Dh) * (1 - smooth(T_NOW - 0.4, T_NOW + 0.2, t));
  if (a < 0.01) return;
  const date = ymStr(Math.max(0, Dh));
  let pv = Math.pow(10, lpAt(Dh));
  for (const e of EV) if (e.kind === 'peak' && Math.abs(Dh - e.day) < 0.6) pv = e.p;   // show the exact top
  const price = Dh < FD ? '暂无价格' : fmtPrice(pv);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = '34px BarlowSemi'; const wd = ctx.measureText(date).width;
  ctx.font = Dh < FD ? '30px NotoBold' : '46px Barlow'; const wp = ctx.measureText(price).width;
  const pad = 16, gap = 18, bw = pad * 2 + wd + gap + wp, bh = 60;
  const x = clamp(hp.x - bw + 26, 20, W - bw - 20), y = clamp(hp.y - 34 - bh, 140, H - 200);
  ctx.fillStyle = 'rgba(8,11,24,0.78)'; roundRect(x, y, bw, bh, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,165,70,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,150,40,0.95)'; ctx.fillRect(x + pad, y + bh - 5, bw - pad * 2, 2);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = '34px BarlowSemi'; ctx.fillStyle = '#ffcf98'; ctx.fillText(date, x + pad, y + bh / 2 - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + pad + wd + gap / 2 - 1, y + 14, 2, bh - 28);
  ctx.font = Dh < FD ? '30px NotoBold' : '46px Barlow'; ctx.fillStyle = Dh < FD ? 'rgba(255,255,255,0.7)' : '#fff';
  ctx.fillText(price, x + pad + wd + gap, y + bh / 2 + 1);
  ctx.restore();
}

function measureCard(e) {
  const L = {};
  ctx.font = '27px NotoMed'; L.dw = ctx.measureText(cnDate(e.d)).width;
  let ts = e.kind === 'now' ? 96 : 58;
  let titleFont = e.kind === 'now' ? `${ts}px Barlow` : `${ts}px NotoBlack`;
  ctx.font = titleFont; L.tw = ctx.measureText(e.title).width;
  if (L.tw > 640) { ts = Math.floor(ts * 640 / L.tw); titleFont = `${ts}px NotoBlack`; ctx.font = titleFont; L.tw = ctx.measureText(e.title).width; }
  L.titleFont = titleFont; L.ts = ts;
  ctx.font = '33px NotoMed'; L.sw = e.sub ? ctx.measureText(e.sub).width : 0;
  L.pw = e.kind === 'start' && e.price ? ctx.measureText(e.price).width : 0;
  ctx.font = '27px NotoBold'; L.bw = e.badge ? ctx.measureText(e.badge).width + 26 : 0;
  L.w = Math.max(L.dw + (L.bw ? L.bw + 16 : 0), L.tw, L.sw, L.pw) + 64;
  L.h = 30 + 36 + Math.round(ts * 1.22) + (e.sub ? 48 : 0) + (L.pw ? 44 : 0) + 22;
  return L;
}
function drawCard(e, L, x, y, sc, alpha) {
  const isBottom = e.kind === 'bottom' || (e.kind === 'info' && e.flash);
  const accent = isBottom ? [255, 70, 70] : e.kind === 'peak' ? [255, 170, 50] : e.kind === 'now' ? [255, 150, 40] : [255, 150, 40];
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 30;
  const bg = ctx.createLinearGradient(0, 0, L.w, 0);
  bg.addColorStop(0, 'rgba(14,18,36,0.90)'); bg.addColorStop(1, 'rgba(10,13,28,0.72)');
  ctx.fillStyle = bg; roundRect(0, 0, L.w, L.h, 12); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(accent, 0.35); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = rgba(accent, 1); roundRect(0, 0, 6, L.h, 3); ctx.fill();
  let yy = 28;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  if (L.bw) {
    ctx.fillStyle = rgba(accent, 1); roundRect(30, yy - 3, L.bw, 38, 8); ctx.fill();
    ctx.font = '27px NotoBold'; ctx.fillStyle = isBottom ? '#fff' : '#1b1205'; ctx.fillText(e.badge, 30 + 13, yy);
  }
  ctx.font = '27px NotoMed'; ctx.fillStyle = rgba(mixc(accent, [255, 255, 255], 0.35), 0.95);
  ctx.fillText(cnDate(e.d), 30 + (L.bw ? L.bw + 16 : 0), yy + 1);
  yy += 50;
  ctx.font = L.titleFont; ctx.fillStyle = '#ffffff';
  ctx.fillText(e.title, 30, yy - (e.kind === 'now' ? 8 : 4));
  yy += Math.round(L.ts * 1.22);
  if (e.sub) {
    ctx.font = '33px NotoMed'; ctx.fillStyle = e.kind === 'now' ? '#ff8a8a' : 'rgba(255,255,255,0.82)';
    ctx.fillText(e.sub, 30, yy); yy += 48;
  }
  if (L.pw) { ctx.font = '33px NotoMed'; ctx.fillStyle = 'rgba(255,200,150,0.75)'; ctx.fillText(e.price, 30, yy); }
  ctx.restore();
}
function drawCards(c, t) {
  const vis = EV.filter(e => t >= e.ta && t < e.tend + 0.45).sort((a, b) => b.ta - a.ta);
  let slot = 0, mainBox = null;
  for (const e of vis) {
    if (!e._L) e._L = measureCard(e);
    const L = e._L;
    const appear = easeOutBack((t - e.ta) / 0.38, 1.4);
    const fadeIn = smooth(e.ta, e.ta + 0.22, t);
    const exit = smooth(e.tend, e.tend + 0.45, t);
    // base position: right of the head at appearance time
    const kOff = e.kind === 'peak' ? -L.h * 0.85 : e.kind === 'bottom' ? L.h * 0.05 : -L.h * 0.45;
    let x = clamp(e.cardX + 80, 40, W - L.w - 36);
    let y = clamp(e.cardY + kOff, 165, H - L.h - 205);
    let sc = 1, a = fadeIn * (1 - exit);
    // stacking: newer card pushes older cards up and dims them
    const newer = vis.filter(o => o.ta > e.ta);
    if (newer.length) {
      const n0 = newer[newer.length - 1];
      const u = smooth(n0.ta, n0.ta + 0.4, t);
      const nb = n0._box;
      if (nb) {
        const ty = nb.y - L.h * 0.8 - 16;
        const tyy = ty < 150 ? nb.y + nb.h + 16 : ty;
        y = lerp(y, tyy, u); x = lerp(x, nb.x, u * 0.6);
      }
      sc = lerp(1, 0.8, u); a *= lerp(1, newer.length > 1 ? 0 : 0.62, u);
    }
    if (a < 0.01) continue;
    const slide = (1 - appear) * 60;
    e._box = { x, y, h: L.h * sc, w: L.w * sc };
    // leader line from the event point to the card
    const p = e.kind === 'start' ? projDay(c, 0) : projDay(c, e.day);
    if (p) {
      ctx.save();
      const cx = x + slide, cy = y + L.h * sc * 0.5;
      const far = clamp(1 - (Math.hypot(p.x - cx, p.y - cy) - 420) / 380, 0, 1);
      a *= 1; const la = a * far;
      ctx.strokeStyle = `rgba(255,200,140,${0.55 * la})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, cx, 0.55), cy); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = `rgba(255,230,200,${la})`; ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,180,90,${0.6 * la})`; ctx.beginPath(); ctx.arc(p.x, p.y, 9 + 3 * Math.sin(t * 6), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    drawCard(e, L, x + slide, y, sc * lerp(0.92, 1, appear), a);
    slot++;
  }
}
function parseHL(s) { const out = []; let hl = false, buf = ''; for (const ch of s) { if (ch === '{' || ch === '}') { if (buf) out.push([buf, hl]); buf = ''; hl = ch === '{'; } else buf += ch; } if (buf) out.push([buf, hl]); return out; }
function drawHeadlineText(s, y, alpha, dy, size = 68) {
  const segs = parseHL(s);
  ctx.font = `${size}px NotoBlack`;
  let total = 0; for (const [txt] of segs) total += ctx.measureText(txt).width;
  let x = W / 2 - total / 2;
  ctx.save(); ctx.globalAlpha = alpha; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 22;
  for (const [txt, hl] of segs) {
    ctx.fillStyle = hl ? '#ff9b2e' : '#ffffff';
    ctx.fillText(txt, x, y + dy); x += ctx.measureText(txt).width;
  }
  ctx.restore();
}
function drawHeadline(t) {
  const chs = TL.chapters.slice();
  chs[0] = Object.assign({}, chs[0], { t: 0.35 });
  chs.push({ t: T_NOW + 2.3, text: '17 年，从 {$0.00076} 到 {$126,200}' });
  chs.push({ t: TL.end.q - 0.25, text: '假如 2010 年 7 月买入 {1 万元} 比特币' });
  const endFade = 1 - smooth(TL.end.fin - 0.5, TL.end.fin + 0.1, t);
  for (let k = 0; k < chs.length; k++) {
    const ch = chs[k], next = chs[k + 1];
    const tin = ch.t, tout = next ? next.t : 1e9;
    if (t < tin + 0.2 || t > tout + 0.25) continue;
    const ain = smooth(tin + 0.22, tin + 0.62, t), aout = smooth(tout - 0.05, tout + 0.22, t);
    const a = ain * (1 - aout) * endFade;
    if (a < 0.01) continue;
    drawHeadlineText(ch.text, 92, a, (1 - ain) * 18 - aout * 18);
  }
}
function drawHUD(c, t) {
  const Dh = c.D;
  const a = smooth(0.6, 1.4, t) * (1 - smooth(TL.end.q - 0.4, TL.end.q + 0.3, t));
  if (a < 0.01) return;
  const x = 58, y = H - 160;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(x, 0, x + 560, 0);
  g.addColorStop(0, 'rgba(10,14,30,0.72)'); g.addColorStop(1, 'rgba(10,14,30,0)');
  ctx.fillStyle = g; ctx.fillRect(x, y, 560, 112);
  ctx.fillStyle = '#ff9628'; ctx.fillRect(x, y, 4, 112);
  ctx.font = '19px NotoMed'; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('比特币 BTC · 美元价格 · 对数刻度', x, y - 12);
  ctx.font = '26px NotoMed'; ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText('历史最高', x + 24, y + 36); ctx.fillText('较最高点', x + 300, y + 36);
  let athTxt = '—', ddTxt = '—', ddCol = '#fff';
  if (Dh >= FD) {
    const i = clamp(Math.floor(Dh - FD), 0, NDAYS - 1);
    const p = Math.pow(10, lpAt(Dh)), ath = Math.max(ATH[i], p);
    athTxt = fmtPrice(ath);
    const dd = p / ath - 1;
    if (dd > -0.005) { ddTxt = '新高'; ddCol = '#ffb04a'; }
    else { ddTxt = (dd * 100).toFixed(0) + '%'; ddCol = dd < -0.3 ? '#ff5a5a' : '#ff9a8a'; }
  }
  ctx.font = '56px Barlow'; ctx.fillStyle = '#fff'; ctx.fillText(athTxt, x + 24, y + 96);
  ctx.fillStyle = ddCol; ctx.font = ddTxt === '新高' ? '46px NotoBlack' : '56px Barlow'; ctx.fillText(ddTxt, x + 300, y + 96);
  ctx.restore();
}

// ---------------------------------------------------------------- ending
function drawEndLines(c, t) {
  const a = smooth(T_NOW - 0.1, T_NOW + 0.6, t) * (1 - smooth(T_NOW + 5.0, T_NOW + 6.2, t) * 0.65) * (1 - c.ov);
  if (a < 0.01) return;
  const athE = EV.find(e => e.big);
  const Dh = c.D;
  const yA = wY(c, Math.log10(athE.p)), yHalf = wY(c, Math.log10(athE.p / 2));
  const A = projDay(c, athE.day), A2 = proj(c, Dh + 150, yA), Hh = proj(c, athE.day, yHalf), H2 = proj(c, Dh + 150, yHalf);
  const N = projDay(c, Dh), Q = proj(c, Dh, yA);
  const grow = easeOutCubic((t - T_NOW) / 0.9);
  ctx.save();
  if (A && A2) dashedPath(A, { x: lerp(A.x, A2.x, grow), y: lerp(A.y, A2.y, grow) }, GOLD, 0.7 * a, 2);
  if (Hh && H2) {
    dashedPath(Hh, { x: lerp(Hh.x, H2.x, grow), y: lerp(Hh.y, H2.y, grow) }, [255, 255, 255], 0.55 * a, 2);
    ctx.font = '26px NotoBold'; ctx.fillStyle = `rgba(255,255,255,${0.85 * a * grow})`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const s2 = '最高点的一半  ' + fmtPrice(athE.p / 2);
    ctx.fillText(s2, Math.min(H2.x + 14, W - ctx.measureText(s2).width - 30), H2.y - 20);
  }
  if (A2) {
    ctx.font = '26px NotoBold'; ctx.fillStyle = `rgba(255,214,150,${0.9 * a * grow})`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const s1 = '历史最高  ' + fmtPrice(athE.p);
    ctx.fillText(s1, Math.min(A2.x + 14, W - ctx.measureText(s1).width - 30), A2.y - 20);
  }
  if (N && Q) {
    const yy = lerp(Q.y, N.y, grow);
    dashedPath(Q, { x: N.x, y: yy }, [255, 90, 90], 0.85 * a, 2.5);
  }
  ctx.restore();
}
function drawFinal(t) {
  const t0 = TL.end.fin - 0.4;
  const dim = smooth(t0, t0 + 1.2, t);
  if (dim <= 0) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, `rgba(2,3,8,${0.55 * dim})`); g.addColorStop(1, `rgba(0,0,0,${0.85 * dim})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // line 1, revealed character by character
  const l1 = '现在再次回到不到一半的价格，';
  const t1 = TL.end.fin + 0.35;
  ctx.save(); ctx.font = '76px NotoBlack'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const widths = [...l1].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((s, v) => s + v, 0);
  let x = W / 2 - total / 2;
  [...l1].forEach((ch, k) => {
    const tk = t1 + k * 0.075;
    const u = smooth(tk, tk + 0.35, t);
    if (u > 0) {
      ctx.globalAlpha = u; ctx.fillStyle = (k >= 6 && k <= 9) ? '#ff9b2e' : '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20;
      ctx.fillText(ch, x, H * 0.39 + (1 - u) * 26);
    }
    x += widths[k];
  });
  ctx.restore();
  // line 2: slam
  const t2 = TL.end.slam;
  const age = t - t2;
  if (age > 0) {
    const sc = lerp(1.75, 1, easeOutBack(age / 0.32, 2.4));
    const al = smooth(0, 0.1, age);
    const shake = Math.exp(-age * 7) * 10;
    ctx.save(); ctx.translate(W / 2 + (hash(Math.floor(t * 60)) - 0.5) * shake, H * 0.6 + (hash(Math.floor(t * 60) + 7) - 0.5) * shake);
    ctx.scale(sc, sc);
    ctx.font = '168px NotoBlack'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = `rgba(255,140,30,${0.85 * al})`; ctx.shadowBlur = 60;
    ctx.fillStyle = `rgba(255,155,46,${al})`; ctx.fillText('你敢买吗？', 0, 0);
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,235,200,${0.6 * al})`; ctx.strokeText('你敢买吗？', 0, 0);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- "假如当时买入 1 万元"
const INV_X = 1920 * 0.685, INV_Y = 1080 * 0.555;
function fmtCNY(v) { return '¥' + Math.round(v).toLocaleString('en-US'); }
function drawInvest(c, t) {
  const E = TL.end, I = TL.invest;
  const a = smooth(E.q - 0.1, E.q + 0.5, t) * (1 - smooth(E.fin - 0.45, E.fin + 0.15, t));
  if (a < 0.01) return;
  const count = E.rev_count;
  const u = (t - E.rev) / count;                       // 0..1 while the amount rolls up
  const done = t >= E.rev + count;
  ctx.save();
  // soft dark backdrop for the text block
  const bx = INV_X, by = INV_Y;
  const bg = ctx.createRadialGradient(bx, by + 60, 40, bx, by + 60, 700);
  bg.addColorStop(0, `rgba(3,5,12,${0.62 * a})`); bg.addColorStop(1, 'rgba(3,5,12,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // gold sweep along the real path from the buy day to now
  const B = projDay(c, I.day);
  if (t > E.rev - 0.02) {
    const p = easeOutCubic(clamp(u, 0, 1));
    const dEnd = lerp(I.day, c.D, p);
    const pts = [];
    for (let d = I.day; d <= dEnd; d += 3) { const q = projDay(c, d); if (q) pts.push(q); }
    const qe = projDay(c, dEnd); if (qe) pts.push(qe);
    if (pts.length > 1) {
      ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [w, al] of [[26, 0.10], [12, 0.22], [4, 0.9]]) {
        ctx.strokeStyle = rgba(GOLD, al * a); ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      if (!done && qe) {
        const g = ctx.createRadialGradient(qe.x, qe.y, 0, qe.x, qe.y, 60);
        g.addColorStop(0, 'rgba(255,245,210,0.95)'); g.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(qe.x, qe.y, 60, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // buy marker
  if (B) {
    const pa = a * smooth(E.q, E.q + 0.4, t);
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.strokeStyle = rgba(GOLD, pa * (0.5 + 0.5 * pulse)); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(B.x, B.y, 14 + 6 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rgba([255, 255, 255], pa); ctx.beginPath(); ctx.arc(B.x, B.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '34px NotoBlack'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const lbl = '买入 ¥10,000';
    const lw = ctx.measureText(lbl).width + 30;
    const ly = B.y - 30;
    ctx.fillStyle = `rgba(255,170,50,${0.95 * pa})`; roundRect(B.x - lw / 2, ly - 50, lw, 50, 10); ctx.fill();
    ctx.fillStyle = `rgba(27,18,5,${pa})`; ctx.fillText(lbl, B.x, ly - 6);
    ctx.font = '26px BarlowSemi'; ctx.fillStyle = `rgba(255,225,190,${0.85 * pa})`;
    ctx.fillText('2010.07 · $' + I.buy_p.toFixed(3), B.x, ly - 58);
  }
  // now marker: a pulsing "?" until the reveal
  const N = projDay(c, c.D);
  if (N && !done) {
    const qa = a * (1 - smooth(E.rev - 0.05, E.rev + 0.1, t));
    ctx.font = '64px NotoBlack'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = rgba(GOLD, qa * (0.6 + 0.4 * Math.sin(t * 8))); ctx.fillText('?', N.x, N.y - 26);
  }

  // text block
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const qIn = smooth(E.q + 0.15, E.q + 0.6, t);
  const qUp = smooth(E.rev - 0.05, E.rev + 0.25, t);
  // question
  {
    const size = lerp(100, 46, qUp);
    const y = lerp(by - 10, by - 150, qUp) + (1 - qIn) * 30;
    ctx.font = `${Math.round(size)}px NotoBlack`;
    const s1 = '现在值', s2 = '多少钱', s3 = '？';
    const w1 = ctx.measureText(s1).width, w2 = ctx.measureText(s2).width, w3 = ctx.measureText(s3).width;
    let x = bx - (w1 + w2 + w3) / 2;
    ctx.textAlign = 'left'; ctx.globalAlpha = a * qIn;
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff'; ctx.fillText(s1, x, y); x += w1;
    ctx.fillStyle = '#ff9b2e'; ctx.fillText(s2, x, y); x += w2;
    ctx.fillStyle = '#ff9b2e'; ctx.fillText(s3, x, y);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // thinking timer: a ring that fills during the pause
    const tp0 = E.q + 0.6, tp1 = E.rev;
    const prog = clamp((t - tp0) / (tp1 - tp0), 0, 1);
    const ra = a * qIn * (1 - qUp);
    if (ra > 0.01) {
      const rx = bx, ry = by + 110;
      ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,255,255,${0.15 * ra})`;
      ctx.beginPath(); ctx.arc(rx, ry, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(GOLD, 0.95 * ra); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(rx, ry, 30, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
      const dots = Math.floor((t - tp0) * 2.5) % 4;
      ctx.font = '30px NotoBold'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${0.7 * ra})`;
      ctx.fillText('想一想' + '.'.repeat(Math.max(0, dots)), rx, ry + 64);
    }
  }
  // amount
  if (t >= E.rev) {
    const uu = clamp(u, 0, 1);
    const v = Math.exp(lerp(Math.log(I.rmb), Math.log(I.value), easeOutCubic(uu)));
    const pop = done ? 1 + 0.12 * Math.exp(-(t - E.rev - count) * 9) : lerp(1.35, 1, easeOutBack(clamp((t - E.rev) / 0.18, 0, 1), 2));
    ctx.save(); ctx.translate(bx, by + 10); ctx.scale(pop, pop);
    ctx.font = '150px Barlow'; ctx.textAlign = 'center';
    ctx.shadowColor = `rgba(255,170,40,${0.9 * a})`; ctx.shadowBlur = done ? 60 : 36;
    ctx.fillStyle = rgba(done ? [255, 206, 90] : [255, 230, 170], a);
    ctx.fillText(fmtCNY(v), 0, 0);
    ctx.restore();
    // ring burst when the number lands
    const ab = t - (E.rev + count);
    if (ab > 0 && ab < 1.0) {
      const k = ab / 1.0;
      ctx.strokeStyle = rgba(GOLD, (1 - k) * 0.9 * a); ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(bx, by + 10, 160 + 520 * easeOutCubic(k), 0, Math.PI * 2); ctx.stroke();
    }
    const s1a = a * smooth(E.rev + count + 0.05, E.rev + count + 0.35, t);
    if (s1a > 0.01) {
      ctx.font = '72px NotoBlack'; ctx.fillStyle = `rgba(255,255,255,${s1a})`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20;
      ctx.fillText('≈ ' + (I.value / 1e8).toFixed(1) + ' 亿元', bx, by + 140);
      ctx.shadowBlur = 0;
    }
    const s2a = a * smooth(E.rev + count + 0.35, E.rev + count + 0.7, t);
    if (s2a > 0.01) {
      ctx.font = '34px NotoMed'; ctx.fillStyle = `rgba(255,214,160,${s2a})`;
      ctx.fillText('约 ' + (I.coins / 1e4).toFixed(2) + ' 万枚比特币 · 翻了约 ' + Math.round(I.mult / 1e4) + ' 万倍', bx, by + 222);
      ctx.font = '22px NotoMed'; ctx.fillStyle = `rgba(255,255,255,${0.45 * s2a})`;
      ctx.fillText('按 2010年7月 与 2026年11月 汇率折算 · 未计手续费', bx, by + 270);
    }
  }
  ctx.restore();
  // flash on the drop and on landing
  const f = Math.max(t >= E.rev ? 0.22 * Math.exp(-(t - E.rev) / 0.15) : 0, t >= E.rev + count ? 0.16 * Math.exp(-(t - E.rev - count) / 0.2) : 0);
  if (f > 0.003) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba([255, 200, 110], f); ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ---------------------------------------------------------------- frame
function renderFrame(i) {
  const t = i / FPS;
  const c = camAt(i);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const hp = proj(c, c.D, wY(c, lpAt(c.D)));
  c._hx = hp ? hp.x : -999; c._hy = hp ? hp.y : -999;
  drawSky(c, t, hp);
  drawSkyline(c, t, false);
  drawRails(c, t);
  drawYears(c, t);
  const pts = collectPoints(c);
  drawFill(c, pts);
  drawBrackets(c, t);
  drawEndLines(c, t);
  drawLine(c, t, pts);
  drawMarkers(c, t);
  if (hp) drawHead(c, t, hp);
  drawParticles(c, t, i);
  drawSkyline(c, t, true);
  drawRain(t);
  drawBokeh(c, t);
  drawEffects(c, t, hp);
  drawSlams(c, t);
  drawCards(c, t);
  if (hp) drawHeadChip(c, t, hp);
  drawHeadline(t);
  drawHUD(c, t);
  drawInvest(c, t);
  drawFinal(t);
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // small disclaimer, bottom right, visible for the whole video
  ctx.save(); ctx.globalAlpha = 0.6 * smooth(0.4, 1.2, t); ctx.font = '20px NotoMed'; ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeText('历史不代表未来 · 不构成投资建议', W - 36, H - 28);
  ctx.fillStyle = '#fff'; ctx.fillText('历史不代表未来 · 不构成投资建议', W - 36, H - 28);
  ctx.restore();
  // fade in / out
  const fade = Math.max(1 - smooth(0, 0.7, t), smooth(T_END - 0.9, T_END - 0.05, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = renderFrame;
init();
