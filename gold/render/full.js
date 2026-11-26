'use strict';
/* Gold video — "fx" look: the Bitcoin life-line effects (3D follow camera, glowing line, embers,
   peak rays, impact rings, cards, slams) re-lit for an ivory background, with a livelier line:
   beat pulses running up the line, a comet tail, speed-dependent width, banking camera with a
   slightly springy follow. renderFrame(i) is a pure function of i (camera precomputed at boot). */

const W = 1920, H = 1080;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------------------------------------------------------------- helpers
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
const bump = (t, t0, rise, hold, fall) => smooth(t0 - rise, t0, t) * (1 - smooth(t0 + hold, t0 + hold + fall, t));
const expoOut = u => { u = clamp(u, 0, 1); return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); };
const easeOutCubic = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const easeOutBack = (u, s = 1.7) => { u = clamp(u, 0, 1); const c3 = s + 1; return 1 + c3 * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(4)})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function hash(n) { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const fmt = n => Math.round(n).toLocaleString('en-US');
function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ---------------------------------------------------------------- palette & type
const INK = [30, 27, 23], SOFT = [128, 113, 90], FAINT = [168, 152, 126];
const GOLD = [214, 150, 28], GOLD_HALO = [240, 178, 50], GOLD_D = [122, 90, 28], GOLD_L = [255, 240, 190];
const JADE = [14, 140, 98], JADE_D = [8, 84, 60];
const OX = [150, 40, 34];
const F = {
  num: s => `${s}px DMSerif, SerifBlack`, numI: s => `italic ${s}px DMSerif, SerifBlack`,
  cn: s => `${s}px SerifBlack`, cnB: s => `${s}px SerifBold`, caps: (w, s) => `${w} ${s}px Cormorant, SerifBold`,
};
function goldFill(y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  [['#8A6420', 0], ['#C79B40', 0.22], ['#F0D58E', 0.42], ['#FFF6DA', 0.5], ['#D9B25A', 0.62], ['#A07428', 0.82], ['#C9A04C', 1]].forEach(([c, o]) => g.addColorStop(o, c));
  return g;
}
const lineCol = c => mixc(GOLD, JADE, c);

// ---------------------------------------------------------------- data
let TL, FPS, S, N, HK, PEAK, NOW, DATE0, NF, DD, TFX;
let TLN, NS, HS, LV, INF, OUT;                     // full-video sections
// effect clock: runs at 1/4 speed from the slow-motion cue to the burst, then snaps back
function slowRate(t) { return t >= HK.drop ? 1 : lerp(1, 0.25, smooth(HK.slowmo - 0.05, HK.slowmo + 0.35, t)); }
function prepTfx() { TFX = new Float64Array(NF + 2); let a = 0; for (let i = 0; i < NF + 2; i++) { TFX[i] = a; a += slowRate(i / FPS) / FPS; } }
const tfx = t => { const x = clamp(t * FPS, 0, NF), i = Math.floor(x), f = x - i; return lerp(TFX[i], TFX[i + 1], f); };
const dayIdx = iso => Math.round((Date.parse(iso) - DATE0) / 86400000);
function isoOf(d) { return new Date(DATE0 + Math.round(d) * 86400000).toISOString().slice(0, 10); }
// video time of a song bar (bar 0 = the song's first downbeat), on the same beat grid as prep.py
let SONG_BAR0, BAR;
const VB = (bar, beat = 0) => SONG_BAR0 + bar * BAR + beat * HK.beat - TL.bgm.song_start;

// ---- datasets. The daily one is ¥/克 (linear); the history one is log10($/盎司) on the same day axis
let DS, DSD, DSH;
function makeDaily() {
  const V = Float64Array.from(S.cny), n = V.length, dd = new Float64Array(n);
  let m = 0; for (let k = 0; k < n; k++) { m = Math.max(m, V[k]); dd[k] = 1 - V[k] / m; }
  return { daily: true, V, n, dd, x0: 0, x1: n - 1, val: p => p, unit: '¥', price: v => v };
}
function makeHist() {
  const X = Float64Array.from(TL.hist.x), U = TL.hist.usd, V = Float64Array.from(U, u => Math.log10(u)), n = X.length, dd = new Float64Array(n);
  let m = 0; for (let k = 0; k < n; k++) { m = Math.max(m, U[k]); dd[k] = 1 - U[k] / m; }
  return { daily: false, X, V, U, n, dd, x0: X[0], x1: X[n - 1], val: p => Math.log10(p), unit: '$', price: v => Math.pow(10, v) };
}
function hidx(x) {                                 // last hist index with X <= x
  const X = DSH.X; let lo = 0, hi = X.length - 1;
  if (x <= X[0]) return 0; if (x >= X[hi]) return hi;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; }
  return lo;
}
function vAt(ds, x) {
  if (ds.daily) { const i = clamp(Math.floor(x), 0, ds.n - 1), j = Math.min(ds.n - 1, i + 1), f = clamp(x - i, 0, 1); return lerp(ds.V[i], ds.V[j], f); }
  const i = hidx(x), j = Math.min(ds.n - 1, i + 1), f = ds.X[j] > ds.X[i] ? clamp((x - ds.X[i]) / (ds.X[j] - ds.X[i]), 0, 1) : 0;
  return lerp(ds.V[i], ds.V[j], f);
}
const pAt = x => vAt(DS, x);                       // value in the current dataset (¥/克, or log10 $)
function uAt(x) { const i = clamp(Math.floor(x), 0, N - 1), j = Math.min(N - 1, i + 1), f = clamp(x - i, 0, 1); return lerp(S.usd[i], S.usd[j], f); }
function ddAt(x) {
  if (DS.daily) return DS.dd[clamp(Math.round(x), 0, DS.n - 1)];
  return DS.dd[hidx(x)];
}
function rangeV(ds, a, b) {                        // min / max value over [a, b]
  let lo = Math.min(vAt(ds, a), vAt(ds, b)), hi = Math.max(vAt(ds, a), vAt(ds, b));
  if (ds.daily) { for (let d = Math.max(0, Math.ceil(a)); d <= Math.min(ds.n - 1, Math.floor(b)); d++) { const p = ds.V[d]; if (p < lo) lo = p; if (p > hi) hi = p; } }
  else { for (let k = hidx(a); k < ds.n && ds.X[k] <= b; k++) { if (ds.X[k] < a) continue; const p = ds.V[k]; if (p < lo) lo = p; if (p > hi) hi = p; } }
  return [lo, hi];
}

// ---------------------------------------------------------------- head paths
// monotone cubic (Fritsch–Carlson) through beat-locked keys: smooth speed, no overshoot
function monotone(keys, valKey) {
  const n = keys.length, d = [];
  for (let k = 0; k < n - 1; k++) d.push((keys[k + 1][valKey] - keys[k][valKey]) / (keys[k + 1].t - keys[k].t));
  const m = [d[0]];
  for (let k = 1; k < n - 1; k++) m.push(d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2);
  m.push(d[n - 2]);
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], r = a * a + b * b;
    if (r > 9) { const s = 3 / Math.sqrt(r); m[k] = s * a * d[k]; m[k + 1] = s * b * d[k]; }
  }
  return t => {
    let k = 0; while (k < n - 2 && t >= keys[k + 1].t) k++;
    const h = keys[k + 1].t - keys[k].t, u = clamp((t - keys[k].t) / h, 0, 1);
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    return h00 * keys[k][valKey] + h10 * h * m[k] + h01 * keys[k + 1][valKey] + h11 * h * m[k + 1];
  };
}
let climbDay, tlDay, histX;
function headDay(t) {
  const D = HK.drop, iPk = PEAK.i, iNow = NOW.i;
  let h;
  if (t < HK.peakTag) h = climbDay(Math.max(0, t));
  else if (t < D) h = iPk;
  else if (t < HK.crashEnd) { const u = (t - D) / (HK.crashEnd - D); h = lerp(iPk, iNow, 0.3 * easeInOut(u) + 0.7 * (1 - Math.pow(1 - u, 2.4))); }
  else if (t < HK.rewind) h = iNow;
  else if (t < HK.y2023) h = lerp(iNow, 0, easeInOut((t - HK.rewind) / (HK.y2023 - HK.rewind - 0.08)));
  else if (!TL.full) h = lerp(0, dayIdx('2023-03-01'), easeOutCubic((t - HK.y2023) / 1.6));
  else if (t < TLN.t1) h = tlDay(t);
  else if (t < NS.rewind) h = iNow;
  else h = lerp(iNow, 0, Math.pow(clamp((t - NS.rewind) / (NS.cut - NS.rewind), 0, 1), 2.2));
  return clamp(h, 0, iNow);
}

// ---------------------------------------------------------------- camera (precomputed, one track per chart)
const FOVY = 36 * Math.PI / 180, TANV = Math.tan(FOVY / 2), TANH = TANV * W / H, KY = 1.0;
let TRACKS = [];
function spring(target, omega, zeta = 1) {         // omega may be a number or a per-frame array
  const out = new Float64Array(target.length); let x = target[0], v = 0; const dt = 1 / FPS;
  for (let i = 0; i < target.length; i++) {
    const w = typeof omega === 'number' ? omega : omega[i];
    for (let s = 0; s < 4; s++) { const h = dt / 4, a = w * w * (target[i] - x) - 2 * zeta * w * v; v += a * h; x += v * h; }
    out[i] = x;
  }
  return out;
}
function keyed(t, keys) {                 // piecewise smooth interpolation of [t, value] keys
  if (t <= keys[0][0]) return keys[0][1];
  for (let k = 0; k < keys.length - 1; k++) if (t < keys[k + 1][0]) return lerp(keys[k][1], keys[k + 1][1], easeInOut((t - keys[k][0]) / (keys[k + 1][0] - keys[k][0])));
  return keys[keys.length - 1][1];
}
// par(t) -> {lb, hx, zoom, yaw, pitch, hyMin, hyMax, wF, wS, span}; shakes: [t0, amp, roll, decay]
function buildTrack(f0, f1, ds, headX, par, shakes, tremble) {
  const n = f1 - f0;
  const Dh = new Float64Array(n), lb = new Float64Array(n), hx = new Float64Array(n), zoom = new Float64Array(n), yawT = new Float64Array(n), pitch = new Float64Array(n);
  const hyMinA = new Float64Array(n), hyMaxA = new Float64Array(n), wF = new Float64Array(n), wS = new Float64Array(n), spanMin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (f0 + i) / FPS, p = par(t);
    Dh[i] = headX(t); lb[i] = p.lb; hx[i] = p.hx; zoom[i] = p.zoom; yawT[i] = p.yaw; pitch[i] = p.pitch;
    hyMinA[i] = p.hyMin; hyMaxA[i] = p.hyMax; wF[i] = p.wF; wS[i] = p.wS; spanMin[i] = p.span;
  }
  const LA = Math.round(0.3 * FPS), ymin = new Float64Array(n), ymax = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + LA), a = Math.min(Dh[j], Dh[i]) - lb[i], b = Math.max(Dh[j], Dh[i]);
    const r = rangeV(ds, Math.max(ds.x0, a), b); ymin[i] = r[0]; ymax[i] = r[1];
  }
  const yaw = spring(yawT, 2.2);
  const distH = new Float64Array(n), syT = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    distH[i] = lb[i] * Math.cos(yaw[i]) / ((hx[i] + 0.95) * TANH) * 0.80;
    const span = Math.max(ymax[i] - ymin[i], spanMin[i]);
    syT[i] = clamp(0.56 * 2 * distH[i] * TANV / (span * KY), 1e-4, 1e5);
  }
  const sy = Array.from(spring(Array.from(syT, Math.log), wS)).map(Math.exp);
  const dist = Array.from(spring(Array.from(distH, (d, i) => Math.log(d) - zoom[i]), 6.0, 0.62)).map(Math.exp);
  const cT = new Float64Array(n), hyLo = new Float64Array(n), hyHi = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const half = dist[i] * TANV / (KY * sy[i]), yh = vAt(ds, Dh[i]);
    const c = (ymin[i] + ymax[i]) / 2 - 0.05 * half;
    const hy = clamp((yh - c) / half, hyMinA[i], hyMaxA[i]); cT[i] = yh - hy * half;
    hyLo[i] = hyMinA[i] - 0.08; hyHi[i] = hyMaxA[i] + 0.1;
  }
  const cl = spring(cT, wF, 0.8);
  for (let i = 0; i < n; i++) {                    // hard guard: the head never leaves its band
    const half = dist[i] * TANV / (KY * sy[i]), yh = vAt(ds, Dh[i]);
    const hy = clamp((yh - cl[i]) / half, hyLo[i], hyHi[i]); cl[i] = yh - hy * half;
  }
  const bankT = new Float64Array(n);               // bank into the move
  for (let i = 0; i < n; i++) {
    const half = dist[i] * TANV / (KY * sy[i]);
    const j = Math.max(0, i - 3), v = (vAt(ds, Dh[i]) - vAt(ds, Dh[j])) / half / ((i - j) / FPS + 1e-9);
    bankT[i] = clamp(-v * 0.012, -0.045, 0.045);
  }
  const bank = spring(bankT, 2.5);
  const R = mulberry32(77 + f0); let nx = 0, ny = 0;
  const shx = new Float64Array(n), shy = new Float64Array(n), roll = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (f0 + i) / FPS; nx = 0.6 * nx + 0.4 * (R() * 2 - 1); ny = 0.6 * ny + 0.4 * (R() * 2 - 1);
    let a = 0, r = 0;
    for (const [t0, amp, rr, dec] of shakes) { if (t >= t0) { const e = Math.exp(-(t - t0) * dec); a += amp * e; r += rr * e * Math.sin((t - t0) * 26); } }
    for (const tb of tremble) if (t > tb - 0.22 && t < tb) a += 2.2 * (t - (tb - 0.22)) / 0.22;
    shx[i] = a * nx * 1.6; shy[i] = a * ny * 1.6; roll[i] = r + bank[i];
  }
  const zv = Array.from(dist, (d, i) => i ? Math.log(d / dist[i - 1]) * FPS : 0);
  return { f0, f1, ds, Dh, dist, yaw, pitch, sy, cl, hx, shx, shy, roll, zv };
}
function trackOf(i) { for (const tr of TRACKS) if (i >= tr.f0 && i < tr.f1) return tr; return TRACKS[TRACKS.length - 1]; }
let CAM;                                           // the active track (set per frame)
function camAt(i) {
  const tr = trackOf(i); i = clamp(i, tr.f0, tr.f1 - 1); const k = i - tr.f0;
  const yaw = tr.yaw[k], pitch = tr.pitch[k], dist = tr.dist[k], D = tr.Dh[k];
  const kk = tr.hx[k] * TANH, h = kk * dist / (Math.cos(yaw) + kk * Math.sin(yaw) * Math.cos(pitch));
  const Lx = D - h, Ly = 0;
  const sp = Math.sin(pitch), cp = Math.cos(pitch), sY = Math.sin(yaw), cY = Math.cos(yaw);
  return { i, k, tr, D, Lx, Ly, dist, sy: tr.sy[k], cl: tr.cl[k],
    C: [Lx + dist * sY * cp, Ly + dist * sp, -dist * cY * cp], f: [-sY * cp, -sp, cY * cp], r: [cY, 0, sY], u: [-sY * sp, cp, cY * sp],
    cr: Math.cos(tr.roll[k]), sr: Math.sin(tr.roll[k]), shx: tr.shx[k], shy: tr.shy[k] };
}
function proj(c, X, Y, Z = 0) {
  const dx = X - c.C[0], dy = Y - c.C[1], dz = Z - c.C[2];
  const zc = dx * c.f[0] + dy * c.f[1] + dz * c.f[2]; if (zc < 2) return null;
  const xc = dx * c.r[0] + dz * c.r[2], yc = dx * c.u[0] + dy * c.u[1] + dz * c.u[2];
  const px = (xc / zc / TANH) * W / 2, py = -(yc / zc / TANV) * H / 2;
  const rx = px * c.cr - py * c.sr, ry = px * c.sr + py * c.cr;
  return { x: W / 2 + rx + c.shx, y: H / 2 + ry + c.shy, z: zc, s: c.dist / zc };
}
const wY = (c, p) => (p - c.cl) * KY * c.sy;
const projDay = (c, d) => proj(c, d, wY(c, pAt(d)));
const projVal = (c, d, v) => proj(c, d, wY(c, v));

// ---- camera parameters for the daily chart (hook keys unchanged, timeline keys appended)
function parDaily(t) {
  const D = HK.drop, Q = HK.question, R0 = HK.rewind, R1 = HK.y2023, full = TL.full;
  const lbK = [[0, 150], [D - 0.3, 175], [D + 0.2, 210], [HK.crashEnd, 320], [Q - 0.2, 330], [Q + 0.6, 560], [R0 - 0.1, 560], [R0 + 0.5, 300], [R1 - 0.3, 280], [R1 + 0.3, 220]];
  const hxK = [[0, 0.20], [D, 0.18], [HK.crashEnd, 0.16], [Q, 0.16], [Q + 0.6, 0.34], [R0, 0.34], [R0 + 0.5, 0.10], [R1 - 0.2, -0.10], [R1 + 0.4, -0.36]];
  const hyMaxK = [[0, 0.12], [D - 0.4, 0.16], [D + 0.3, 0.42], [R0 + 0.6, 0.42], [R1 - 0.4, -0.28]];
  const hyMinK = [[0, -0.5], [R0 + 0.6, -0.45], [R1 - 0.4, -0.55]];
  const wFK = [[0, 3.0], [R0, 3.0], [R0 + 0.3, 7.0], [R1 - 0.2, 7.0], [R1 + 0.4, 3.0]];
  const wSK = [[0, 2.0], [R0, 2.0], [R0 + 0.3, 5.0], [R1 - 0.2, 5.0], [R1 + 0.4, 2.0]];
  if (full) {
    lbK.push([VB(13), 300], [VB(21.6), 300], [VB(22.6), 230], [VB(23.4), 230], [VB(24.3), 340], [VB(28.6), 340], [VB(29.3), 380], [VB(30.7), 1480], [NS.rewind, 1480], [NS.cut - 0.05, 2400]);
    hxK.push([VB(13), 0.14], [VB(28.6), 0.14], [VB(29.3), 0.10], [VB(30.7), 0.30], [NS.rewind, 0.30], [NS.cut - 0.05, 0.05]);
    hyMaxK.push([VB(13), 0.30], [VB(29), 0.30], [VB(30.7), 0.36]);
    hyMinK.push([VB(13), -0.5], [VB(30.7), -0.45]);
    wFK.push([NS.rewind, 3.0], [NS.rewind + 0.4, 6.0]);
    wSK.push([NS.rewind, 2.0], [NS.rewind + 0.4, 4.0]);
  }
  let z = -0.45 * (1 - smooth(0, 3.0, t));
  z += 0.22 * smooth(0.6, HK.peakTag, t) * (1 - smooth(D - 0.01, D + 0.02, t));
  for (const k of [-14, -12, -10, -8, -6, -5, -4]) { const b = D + k * HK.beat, a = t - b, amp = k <= -8 ? 0.05 : 0.07; if (a > -0.02 && a < 0.6) z += amp * smooth(-0.02, 0.05, a) * Math.exp(-Math.max(0, a - 0.05) / 0.22); }
  z += 0.58 * Math.pow(smooth(HK.slowmo - 0.1, D, t), 1.2) * (1 - smooth(D - 0.01, D + 0.02, t));
  z -= 0.38 * bump(t, D + 0.06, 0.06, 0.35, 1.1);
  z += 0.34 * bump(t, HK.crashEnd + 0.1, 0.1, 0.22, 0.45);
  z -= 0.30 * bump(t, R0 + 0.7, 0.5, 0.5, 0.7);
  z += 0.30 * bump(t, R1 + 0.06, 0.08, 0.18, 0.9);
  let yaw = (20 + 5 * Math.sin(t * 2 * Math.PI / 23)) * Math.PI / 180 - 0.12 * bump(t, HK.peakTag, 1.2, 0.6, 0.8) - 0.10 * smooth(Q, Q + 0.8, t) * (1 - smooth(R0, R0 + 0.6, t)) + 0.10 * bump(t, R0 + 1.0, 0.8, 0.4, 0.8) + 0.16 * smooth(HK.slowmo, D, t) * (1 - smooth(D, D + 0.7, t));
  if (full) {
    for (const e of TLN.events) {
      if (e.kind === 'milestone') z += 0.12 * bump(t, e.t + 0.05, 0.06, 0.12, 0.6);
      else if (e.kind === 'shock') z += 0.07 * bump(t, e.t + 0.05, 0.06, 0.12, 0.5);
      else if (e.kind === 'crash') z -= 0.16 * bump(t, e.t + 0.06, 0.05, 0.3, 1.0);
      else if (e.kind === 'peak') { z += 0.34 * smooth(e.t - BAR * 0.5, e.t, t) * (1 - smooth(e.t + 2 * HK.beat - 0.02, e.t + 2 * HK.beat + 0.03, t)); yaw += 0.10 * bump(t, e.t, 0.9, 0.3, 0.9); }
    }
    z += 0.22 * bump(t, NS.card + 0.08, 0.08, 0.2, 0.5);
    z -= 0.55 * Math.pow(smooth(NS.rewind, NS.cut, t), 1.5);
    yaw += 0.10 * smooth(VB(30), VB(30.8), t) * (1 - smooth(NS.rewind, NS.cut, t));
  }
  return { lb: keyed(t, lbK), hx: keyed(t, hxK), zoom: z, yaw, pitch: (-3 + 1.5 * Math.sin(t * 2 * Math.PI / 31)) * Math.PI / 180,
    hyMin: keyed(t, hyMinK), hyMax: keyed(t, hyMaxK), wF: keyed(t, wFK), wS: keyed(t, wSK), span: 150 };
}
function shakesDaily() {
  const L = [[HK.drop, 30, 0.022, 4.0], [HK.crashEnd, 9, 0.006, 6], [HK.y2023, 12, 0.008, 6]];
  if (TL.full) {
    for (const e of TLN.events) {
      if (e.kind === 'crash') L.push([e.t, e.date === '2026-01-30' ? 22 : 14, 0.012, 5]);
      else if (e.kind === 'shock') L.push([e.t, 7, 0.004, 6]);
    }
    L.push([NS.card, 10, 0.006, 6]);
  }
  return L;
}
// ---- the history chart (log $, 1970 -> 2026)
function parHist(t) {
  const lbK = [[VB(36), 2600], [VB(37.8), 2600], [VB(38.6), 2300], [VB(40), 2100], [VB(40.5), 3200], [VB(41.1), 7000], [VB(42.6), 7000], [VB(43.3), 2600],
    [VB(44.9), 2600], [VB(45.5), 3800], [VB(47.6), 4400], [VB(48.4), 3000], [VB(49.9), 3300], [VB(50.5), 4200], [VB(51.8), 21000]];
  const hxK = [[VB(36), 0.12], [VB(50.6), 0.14], [VB(51.8), 0.34]];
  let z = -0.35 * (1 - smooth(VB(36), VB(36.7), t));
  for (const c of HS.crashes) {
    z += 0.22 * smooth(c.t_peak - BAR * 0.5, c.t_peak, t) * (1 - smooth(c.t_peak + 0.3, c.t_peak + 0.9, t));
    z -= 0.12 * bump(t, c.t_low + 0.05, 0.06, 0.25, 0.8);
    if (c.t_rec) z += 0.10 * bump(t, c.t_rec + 0.05, 0.06, 0.2, 0.6);
  }
  z += 0.30 * smooth(HS.breakdown, HS.drop, t) * (1 - smooth(HS.drop - 0.01, HS.drop + 0.02, t));
  z -= 0.40 * bump(t, HS.drop + 0.06, 0.06, 0.35, 1.1);
  const yaw = (20 + 5 * Math.sin(t * 2 * Math.PI / 23)) * Math.PI / 180 + 0.14 * smooth(HS.breakdown, HS.drop, t) * (1 - smooth(HS.drop, HS.drop + 0.7, t));
  return { lb: keyed(t, lbK), hx: keyed(t, hxK), zoom: z, yaw, pitch: (-3 + 1.5 * Math.sin(t * 2 * Math.PI / 31)) * Math.PI / 180,
    hyMin: -0.5, hyMax: keyed(t, [[VB(36), 0.10], [VB(50.6), 0.10], [VB(51.8), 0.36]]), wF: 3.2, wS: 2.2, span: 0.32 };
}
function shakesHist() {
  const L = [[HS.drop, 30, 0.022, 4.0]];
  for (const c of HS.crashes) { if (c.n !== 2) L.push([c.t_low, 12, 0.008, 5]); if (c.t_mid) L.push([c.t_mid, 10, 0.006, 5]); }
  return L;
}
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
  // card 1: 现在，可以入场了吗？
  const q1 = 1 - smooth(NS.sub - 0.12, NS.sub + 0.05, t);
  if (q1 > 0.01) {
    const parts = [['现在，', 0], ['可以', 0.5], ['入场了吗', 1.0], ['？', 1.0]];
    const push = 1 + 0.04 * smooth(Q, NS.sub, t);
    ctx.save(); ctx.translate(W / 2, 560); ctx.scale(push, push); ctx.translate(-W / 2, -560);
    const size = 170, font = F.cn(size), cy = 600;
    const tot = parts.reduce((a, p) => a + width(p[0], font), 0); let x = W / 2 - tot / 2;
    for (const [s, dl] of parts) {
      const w = width(s, font), u = (t - (Q + dl * P)) / 0.3;
      if (u > 0) {
        ctx.save(); ctx.globalAlpha = q1 * clamp(u * 2, 0, 1);
        const sc = lerp(1.5, 1, easeOutBack(u, 1.8)); ctx.translate(x + w / 2, cy); ctx.scale(sc, sc);
        if (s === '？') { ctx.rotate(0.1 * Math.sin(t * 9) * beatPulse(t)); goldText(s, -w / 2, 0, font, size); }
        else shadowText(s, -w / 2, 0, font, rgba(INK, 1), 'left', 0, 0.14);
        ctx.restore();
      }
      x += w;
    }
    ctx.restore();
  }
  // card 2: 先别急。
  const q2 = smooth(NS.sub - 0.02, NS.sub + 0.1, t) * (1 - smooth(NS.sub2 - 0.12, NS.sub2 + 0.05, t));
  if (q2 > 0.01) {
    ctx.save(); ctx.globalAlpha = q2 * (1 - out);
    popText(() => { const f = F.cn(230), w1 = width('先别急', f), w2 = width('。', f), x = W / 2 - (w1 + w2) / 2;
      shadowText('先别急', x, 640, f, rgba(INK, 1), 'left', 0, 0.16); goldText('。', x + w1, 640, f, 230); }, t, NS.sub, W / 2, 560, 1.8);
    ctx.restore();
  }
  // card 3: 让我们看看：每次暴跌之后，多久才回本？
  const q3 = smooth(NS.sub2 - 0.02, NS.sub2 + 0.1, t) * (1 - out);
  if (q3 > 0.01) {
    ctx.save(); ctx.globalAlpha = q3;
    popText(() => text('让我们看看', W / 2, 330, F.cnB(64), rgba(SOFT, 1), 'center', 10), t, NS.sub2, W / 2, 310);
    popText(() => shadowText('每次暴跌之后，', W / 2, 520, F.cn(124), rgba(INK, 1), 'center', 6, 0.14), t, NS.sub2 + P * 0.5, W / 2, 480);
    popText(() => { const f = F.cn(150), s1 = '多久', s2 = '才', s3 = '回本', s4 = '？', ws = [s1, s2, s3, s4].map(x => width(x, f, 6)); let x = W / 2 - ws.reduce((a, b) => a + b, 0) / 2;
      x += goldText(s1, x, 720, f, 150, 'left', 6); x += shadowText(s2, x, 720, f, rgba(INK, 1), 'left', 6, 0.14); x += goldText(s3, x, 720, f, 150, 'left', 6); goldText(s4, x, 720, f, 150, 'left', 6);
    }, t, NS.sub2 + P, W / 2, 670, 1.6);
    goldRule(W / 2 - 560, W / 2 + 560, 790, smooth(NS.sub2 + P, NS.sub2 + 2 * P, t));
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
      void B; void a;
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

// 「回本用了 28 年」: a big card in the middle of the screen, held for about a bar
function recCard(t, t0, tEnd, top, mid, unit, bottom, k) {
  if (t < t0 || t > tEnd + 0.3) return;
  const u = (t - t0) / 0.32, a = clamp(u * 2.5, 0, 1) * (1 - smooth(tEnd - 0.05, tEnd + 0.25, t));
  if (a < 0.01) return;
  const cx = 640, cy = 560, w = 640, h = 420, sc = lerp(1.5, 1, easeOutBack(u, 1.7));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(sc, sc);
  // gold ring burst behind the card
  const ur = (t - t0) / 0.9;
  if (ur > 0 && ur < 1) { ctx.strokeStyle = rgba(GOLD, 0.8 * (1 - ur)); ctx.lineWidth = 6 * (1 - ur) + 1; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.5 + 260 * easeOutCubic(ur), h * 0.5 + 200 * easeOutCubic(ur), 0, 0, 7); ctx.stroke(); }
  ctx.shadowColor = 'rgba(110,80,30,0.25)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  rrect(-w / 2, -h / 2, w, h, 22); ctx.fillStyle = 'rgba(255,253,248,0.96)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(190,150,70,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = goldFill(-h / 2, h / 2); rrect(-w / 2, -h / 2, 10, h, 5); ctx.fill();
  text(top, 0, -h / 2 + 62, F.cnB(30), rgba(SOFT, 1), 'center', 2);
  goldRule(-w / 2 + 60, w / 2 - 60, -h / 2 + 84);
  text(k === 'q' ? '这一次' : '回本用了', 0, -h / 2 + 150, F.cn(54), rgba(INK, 1), 'center', 6);
  const fN = F.num(190), fU = F.cn(84), wN = width(mid, fN), wU = width(unit, fU), x0 = -(wN + wU + 8) / 2, yN = h / 2 - 92;
  const pul = 1 + 0.04 * beatPulse(t);
  ctx.save(); ctx.translate(0, yN - 60); ctx.scale(pul, pul); ctx.translate(0, -(yN - 60));
  goldText(mid, x0, yN, fN, 190); goldText(unit, x0 + wN + 8, yN, fU, 84);
  ctx.restore();
  text(bottom, 0, h / 2 - 34, F.cnB(26), rgba(SOFT, 1), 'center', 2);
  ctx.restore();
}
function drawRecCards(t) {
  const C = HS.crashes;
  C.forEach((cr, k) => {
    const nx = C[k + 1], end = nx ? Math.min(cr.t_rec ? cr.t_rec + BAR * 1.0 : 1e9, nx.t_peak - BAR * 0.3) : HS.table - 0.05;
    if (cr.t_rec) {
      const [num, unit] = cr.ylabel.split(' ');
      recCard(t, cr.t_rec + 0.12, end, '第 ' + cr.n + ' 次 · ' + cr.label + ' 年 $' + fmt(cr.peak[1]) + ' 见顶', num, unit,
        ymDate(cr.peak[0]) + ' → ' + ymDate(cr.rec) + '，才重回 $' + fmt(cr.peak[1]), 'y');
    } else {
      recCard(t, cr.t_low + 0.45, HS.table - 0.05, '第 6 次 · 2026 年 $' + fmt(cr.peak[1]) + ' 见顶', '？', '',
        '已经跌了 37%，回本要多久？', 'q');
    }
  });
}
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
    const a = fadeIO(t, L.t0, L.pic, 0.2, 0.3);
    if (a > 0.01) {
      ctx.save(); ctx.globalAlpha = a;
      popText(() => shadowText('为什么会暴跌？', W / 2, 470, F.cn(130), rgba(INK, 1), 'center', 6, 0.14), t, L.t0, W / 2, 430);
      popText(() => { const f = F.cn(84), w1 = width('关键词：', f), w2 = width('杠杆', f); const x = W / 2 - (w1 + w2) / 2;
        shadowText('关键词：', x, 640, f, rgba(SOFT, 1), 'left', 0, 0.1); goldText('杠杆', x + w1, 640, f, 84); }, t, L.kw, W / 2, 610, 1.6);
      ctx.restore();
    }
  }
  // B–E share one picture: own money vs borrowed money, the price, the two voices, the forced sale
  const pa = fadeIO(t, L.pic - 0.1, L.cascade, 0.25, 0.35);
  if (pa > 0.01) {
    ctx.save(); ctx.globalAlpha = pa;
    drawHL('{杠杆}：只有十分之一是自己的钱', 110, 190, 60, 1, null, 'GOLD  ·  暴跌的推手');
    const bx = 430, base = 930, unit = 5.4;                 // ¥1 万 = 5.4 px
    const fall = smooth(L.fall, L.fallEnd, t);               // ¥1,000 -> ¥900
    const own = 10 * (1 - fall), hOwn = own * unit, hB = 90 * unit;
    const uO = easeOutCubic((t - L.pic) / 0.35), uB = easeOutCubic((t - L.pic2) / 0.35);
    const dimPic = t > L.you ? 0.55 : 1;
    ctx.save(); ctx.globalAlpha = pa * dimPic;
    if (uO > 0) {
      ctx.save(); ctx.shadowColor = 'rgba(110,80,30,0.2)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = goldFill(base - Math.max(hOwn, 2) * uO, base); rrect(bx - 120, base - Math.max(hOwn, 2) * uO, 240, Math.max(2, hOwn * uO), 6); ctx.fill(); ctx.restore();
      const yl = base - Math.max(hOwn, 30) / 2;
      text('自己的钱', bx - 150, yl - 14, F.cnB(30), rgba(GOLD_D, 1), 'right');
      text('¥' + own.toFixed(own < 10 ? 1 : 0) + ' 万 · 1/10', bx - 150, yl + 26, F.num(34), rgba(GOLD_D, 1), 'right');
    }
    if (uB > 0) {
      const top = base - hOwn - hB * uB;
      ctx.save(); ctx.fillStyle = 'rgba(160,150,135,0.28)'; rrect(bx - 120, top, 240, hB * uB, 6); ctx.fill();
      ctx.beginPath(); rrect(bx - 120, top, 240, hB * uB, 6); ctx.clip();
      ctx.strokeStyle = 'rgba(120,108,90,0.35)'; ctx.lineWidth = 2;
      for (let k = -30; k < 40; k++) { ctx.beginPath(); ctx.moveTo(bx - 120 + k * 18, top); ctx.lineTo(bx - 120 + k * 18 + 600, top + 600); ctx.stroke(); }
      ctx.restore();
      text('借来的钱', bx - 150, top + hB * uB / 2 - 10, F.cnB(30), rgba(SOFT, 1), 'right');
      text('¥90 万 · 9/10', bx - 150, top + hB * uB / 2 + 30, F.num(34), rgba(INK, 0.8), 'right');
    }
    const u3 = (t - L.pic3) / 0.3;
    if (u3 > 0) {
      ctx.save(); ctx.globalAlpha = pa * dimPic * clamp(u3 * 2, 0, 1);
      const top = base - (own + 90) * unit;
      ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx + 150, top); ctx.lineTo(bx + 170, top); ctx.lineTo(bx + 170, base); ctx.lineTo(bx + 150, base); ctx.stroke();
      text('买入黄金', bx + 200, (top + base) / 2 - 18, F.cnB(32), rgba(SOFT, 1));
      goldText('¥' + (own + 90).toFixed(0) + ' 万', bx + 200, (top + base) / 2 + 42, F.num(64), 64);
      text('（10 倍杠杆）', bx + 200, (top + base) / 2 + 92, F.cnB(28), rgba(SOFT, 1));
      ctx.restore();
    }
    ctx.restore();
    // right column, step by step
    const rx = 1060;
    // caption: only a tenth is yours
    {
      const a2 = fadeIO(t, L.cap, L.you, 0.3, 0.3);
      if (a2 > 0.01) {
        ctx.save(); ctx.globalAlpha = pa * a2;
        popText(() => { text('你只出了 1 成，', rx, 420, F.cn(64), rgba(INK, 1)); text('另外 9 成，', rx, 520, F.cn(64), rgba(INK, 1));
          const w = width('都是', F.cn(64)); text('都是', rx, 620, F.cn(64), rgba(INK, 1)); goldText('借来的', rx + w, 620, F.cn(64), 64); }, t, L.cap, rx + 300, 520, 1.2);
        // the price drop
        if (t > L.fall - 0.1) {
          const a3 = smooth(L.fall - 0.1, L.fall + 0.2, t);
          ctx.globalAlpha = pa * a2 * a3;
          const price = lerp(1000, 900, easeInOut(fall));
          text('金价', rx, 740, F.cnB(34), rgba(SOFT, 1));
          text('¥' + fmt(price) + ' /克', rx + 90, 750, F.num(84), rgba(fall > 0.02 ? JADE : INK, 1));
          if (fall > 0.02) text('−' + (10 * fall).toFixed(0) + '%', rx + 480, 750, F.numI(84), rgba(JADE, 1));
          if (t > L.fallEnd) { const a4 = smooth(L.fallEnd, L.fallEnd + 0.3, t); ctx.globalAlpha = pa * a2 * a4;
            text('亏掉的 10 万，正好是你全部的本金', rx, 840, F.cnB(40), rgba(OX, 1)); }
        }
        ctx.restore();
      }
    }
    // you: give me time
    {
      const a2 = fadeIO(t, L.you, L.force, 0.25, 0.3);
      if (a2 > 0.01) {
        ctx.save(); ctx.globalAlpha = pa * a2;
        const u = easeOutBack((t - L.you) / 0.35, 1.6);
        ctx.translate(820, 420); ctx.scale(u, u); ctx.translate(-820, -420);
        avatar(760, 330, '你', GOLD_D);
        bubble(860, 250, 860, 180, 816, 320, GOLD);
        text('我相信它会涨回来，', 900, 318, F.cn(50), rgba(INK, 1));
        text('再给我一点时间！', 900, 390, F.cn(50), rgba(INK, 1));
        ctx.restore();
      }
    }
    // the lender: it's my money
    {
      const a2 = fadeIO(t, L.broker, L.force + 0.4, 0.25, 0.3);
      if (a2 > 0.01) {
        ctx.save(); ctx.globalAlpha = pa * a2;
        const u = easeOutBack((t - L.broker) / 0.35, 1.6);
        ctx.translate(1330, 720); ctx.scale(u, u); ctx.translate(-1330, -720);
        avatar(1770, 800, '券商', OX);
        bubble(960, 570, 740, 250, 1714, 800, OX);
        text('可那 90 万是我的钱。', 1000, 645, F.cn(50), rgba(INK, 1));
        text('万一继续跌呢？', 1000, 717, F.cn(50), rgba(INK, 1));
        text('这个风险我不陪你担。', 1000, 789, F.cn(50), rgba(OX, 1));
        ctx.restore();
      }
    }
    // forced sale
    if (t > L.force) {
      stamp('强制平仓', 1240, 520, L.force, t, 110, OX, -0.12);
      const u = (t - (L.force + P)) / 0.3;
      if (u > 0) { ctx.save(); ctx.globalAlpha = pa * clamp(u * 2, 0, 1); text('不等你，直接把你的黄金卖掉', 1240, 680, F.cn(48), rgba(OX, 1), 'center'); ctx.restore(); }
    }
    ctx.restore();
  }
  // F. the stampede: one forced sale feeds the next
  const ca = fadeIO(t, L.cascade - 0.05, L.final, 0.3, 0.3);
  if (ca > 0.01) {
    ctx.save(); ctx.globalAlpha = ca;
    drawHL('一个人被强平，会发生什么？', 110, 190, 60, 1, null, 'GOLD  ·  踩踏式下跌');
    const steps = ['卖的人太多', '金价继续下跌', '更多人被强平', '又被迫卖出'];
    const prices = ['¥900', '¥850', '¥780', '¥700'];
    const cx0 = 260, cy = 560, gap = 380;
    steps.forEach((s, k) => {
      const t0 = L.cascade + k * 2 * P, u = (t - t0) / 0.35; if (u <= 0) return;
      const x = cx0 + k * gap;
      ctx.save(); ctx.globalAlpha = ca * clamp(u * 2, 0, 1);
      const sc = easeOutBack(u, 1.8); ctx.translate(x + 150, cy); ctx.scale(sc, sc);
      ctx.shadowColor = 'rgba(110,80,30,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      rrect(-150, -70, 300, 140, 22); ctx.fillStyle = 'rgba(255,253,248,0.97)'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rgba(k % 2 ? JADE : OX, 0.85); ctx.lineWidth = 3; ctx.stroke();
      text(s, 0, 16, F.cn(44), rgba(k % 2 ? JADE_D : OX, 1), 'center');
      ctx.restore();
      if (k < 3) {                                     // arrow to the next box
        const ua = (t - (t0 + P)) / 0.3;
        if (ua > 0) { ctx.save(); ctx.globalAlpha = ca * clamp(ua * 2, 0, 1); const ax = x + 310, ay = cy;
          ctx.fillStyle = rgba(GOLD, 0.95); ctx.beginPath(); ctx.moveTo(ax, ay - 16); ctx.lineTo(ax + 40, ay); ctx.lineTo(ax, ay + 16); ctx.closePath(); ctx.fill(); ctx.restore(); }
      }
      // the price under each step keeps dropping
      ctx.save(); ctx.globalAlpha = ca * clamp(u * 2, 0, 1);
      text(prices[k], x + 150, cy + 150, F.num(64), rgba(k ? JADE : INK, 1), 'center');
      ctx.restore();
    });
    // loop back: and round it goes
    const ul = (t - (L.cascade + 8 * P)) / 0.4;
    if (ul > 0) {
      ctx.save(); ctx.globalAlpha = ca * clamp(ul * 2, 0, 1);
      const xa = cx0 + 3 * gap + 150, xb = cx0 + 150, yb = cy - 110, g = easeOutCubic(ul);
      ctx.strokeStyle = rgba(GOLD, 0.9); ctx.lineWidth = 4; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(xa, cy - 75); ctx.bezierCurveTo(xa, yb - 120, lerp(xa, xb, 0.5), yb - 140, lerp(xa, xb, g), yb - 120 + 120 * (g > 0.98 ? 1 : 0)); ctx.stroke(); ctx.setLineDash([]);
      text('越卖越跌，越跌越卖', (xa + xb) / 2, yb - 150, F.cn(50), rgba(OX, 1), 'center', 4);
      ctx.restore();
    }
    ctx.restore();
  }
  // G. 这就是踩踏式下跌
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
  if (t < INF.t0) drawLeverage(t);
  else if (t < OUT.t0) drawInflation(t);
  else if (t < OUT.final) drawOutro(t);
  else drawFinalCard(t);
}
// ================================================================ frame
function drawChartFrame(i, t) {
  const c = camAt(i); CAM = c.tr; DS = CAM.ds;
  const daily = DS === DSD;
  const hp = projDay(c, c.D);
  drawBackground(c, t, hp);
  drawFloor(c, t);
  drawBokeh(c, t);
  drawRails(c, t);
  drawMonths(c, t);
  const pts = collectPoints(c);
  drawFill(c, pts);
  drawLine(c, t, pts);
  drawTwinkles(c, t);
  drawPulses(c, t);
  if (hp) drawHead(c, t, hp);
  drawBubble(c, t, hp);
  drawParticles(c, t, i);
  drawGlass(t);
  zoomBlur(c, hp);
  let br = null;
  if (daily) {
    br = drawBracket(c, t);
    drawEffects(c, t);
    if (TL.full) { drawTimelineFx(c, t); drawCards(c, t); drawTimelineSlams(c, t); }
    drawPeakCard(c, t, hp);
  } else { drawHistFx(c, t); drawHistMarks(c, t); }
  drawHeadChip(c, t, hp);
  if (daily) drawMilestones(c, t, hp);
  drawHUD(c, t);
  if (daily) {
    drawHeadline(t);
    drawSlam(c, t, br);
    drawTitle(t);
    if (TL.full) drawChapters(t);
    drawQuestion(t);
    drawRewind(t);
    draw2023(t);
    if (TL.full) { drawConvert(t); drawQuestion2(t); drawRewind2(t); }
  } else { drawHistHeadline(t); drawRecCards(t); drawTable(t); }
}
function renderFrame(i) {
  const t = i / FPS;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (TL.full && t >= LV.t0) draw2D(t); else drawChartFrame(i, t);
  // warm vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, 520, W / 2, H * 0.45, 1250);
  vg.addColorStop(0, 'rgba(150,118,64,0)'); vg.addColorStop(1, 'rgba(150,118,64,0.16)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  drawFrameRule();
  if (!(TL.full && t >= OUT.cta)) text('历史不代表未来 · 不构成投资建议', W - 70, H - 52, F.cnB(20), rgba(FAINT, 1), 'right', 2);
  // cuts between sections: a short ivory flash on the bar line
  if (TL.full) {
    let f = 0;
    for (const tc of [NS.cut, LV.t0, INF.t0, OUT.t0, OUT.final]) f = Math.max(f, bump(t, tc, 0.12, 0.04, 0.4));
    if (f > 0.003) { ctx.fillStyle = `rgba(252,250,245,${0.92 * f})`; ctx.fillRect(0, 0, W, H); }
    if (t > OUT.fade) { ctx.fillStyle = `rgba(252,250,245,${smooth(OUT.fade, TL.T - 0.2, t)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (t < 0.15) { ctx.fillStyle = `rgba(252,250,245,${1 - t / 0.15})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = renderFrame;

(async () => {
  TL = await (await fetch('/build/timeline.json')).json();
  FPS = TL.fps; S = TL.series; N = S.date.length; HK = TL.hook; PEAK = TL.peak; NOW = TL.now; NF = TL.nF;
  DATE0 = Date.parse(S.date[0]);
  S.cny[PEAK.i] = PEAK.cny; S.usd[PEAK.i] = PEAK.usd;
  BAR = 4 * HK.beat; SONG_BAR0 = TL.bgm.song_drop - 8 * BAR;
  if (TL.full) { TLN = TL.timeline; NS = TL.nowsec; HS = TL.history; LV = TL.lev; INF = TL.infl; OUT = TL.outro; }
  const sample = '黄金暴跌现在还能买吗？，抄底还是接飞刀让我们把时间倒回这一轮大涨要从这年说起国际金价折合人民币克历史最高较点回落不到个月跌到年月日盎司泡沫史上最贵一路狂飙新高不代表未来构成投资建议·0123456789$¥%,.−'
    + '美联储继续加息利率升至承压硅谷银行倒闭业危机资金涌入避险最后一次年来巴以冲突爆发情绪温约突破高点各国央行持续买金主升浪开启中东局势级伊朗色列互相袭击冲上首降基周期特朗普胜选元走强调关税阴云下解放日全球市场恐慌三后重启涨势越陡单12随又了回担忧独立性疯狂提名沃什任主席押注更鹰派油价破百不反就职通胀走希望落空短暂弹数据降温8月首次全球股大投资者卖补保证通超预期升最低多消息突发里程碑风暴抢顶点泡沫破裂现在'
    + '可以入场先别急看历史每次之后多久才回本再时间倒回REWIND第次见放开私人地缘冲到把泡破裂机构欧债退出QE两天暴跌疫情放水暴力这一次要深用重回问号历次大幅前快慢的等几十为什么会关键词杠杆用倍借来钱本金亏损全部光券商强制掉你只群跟着推手死亡螺旋账户追加换越踩踏如果按今天购买力相当于比还贵扣除直到才所以能吗暴跌之后快的慢别加它是放大器真想闲分批拿得住会车评论区聊聊视频';
  await Promise.all(['SerifBlack', 'SerifBold', 'Cormorant'].map(f => document.fonts.load(`40px ${f}`, sample)));
  await document.fonts.load('italic 40px DMSerif', '0123456789%.−'); await document.fonts.load('40px DMSerif', '0123456789$¥,.×≈÷');
  await document.fonts.load('600 40px Cormorant', 'GOLDXAUREWINDCHAPTERONE');
  prepStatic();
  DSD = makeDaily(); DS = DSD;
  climbDay = monotone(HK.climb, 'i');
  prepTfx();
  if (TL.full) {
    DSH = makeHist();
    tlDay = monotone(TLN.keys, 'i');
    histX = monotone(HS.keys, 'x');
    TL_REWIND_A = NS.rewind; TL_REWIND_B = NS.cut;
    const fCut = Math.round(NS.cut * FPS), fLev = Math.round(LV.t0 * FPS);
    TRACKS = [buildTrack(0, fCut, DSD, headDay, parDaily, shakesDaily(), [HK.drop]),
              buildTrack(fCut, fLev, DSH, t => clamp(histX(t), DSH.x0, DSH.x1), parHist, shakesHist(), [HS.drop])];
  } else TRACKS = [buildTrack(0, NF, DSD, headDay, parDaily, shakesDaily(), [HK.drop])];
  // bubbles and their burst points (screen position just before each burst)
  BUBS = [{ t0: 0.2, tb: HK.drop, ds: DSD, rad: c => 40 + 120 * clamp((vAt(DSD, c.D) - 760) / (1250 - 760), 0, 1) }];
  if (TL.full) BUBS.push({ t0: HS.bubble, tb: HS.drop, ds: DSH, rad: c => 40 + 110 * clamp((vAt(DSH, c.D) - Math.log10(200)) / (Math.log10(850) - Math.log10(200)), 0, 1) });
  for (const b of BUBS) {
    const ib = Math.round(b.tb * FPS) - 1, cb = camAt(ib); DS = cb.tr.ds; CAM = cb.tr;
    const hb = projDay(cb, cb.D);
    b.origin = hb ? { x: hb.x, y: hb.y, r: bubbleR(cb, ib / FPS, b) } : null;
  }
  BURST = BUBS[0].origin;
  BURSTS = [[HK.peakTag, PEAK.i, 'gold', 1.0, DSD], [HK.drop, PEAK.i, 'shard', 1.0, DSD, BURST], [HK.crashEnd, NOW.i, 'jade', 0.7, DSD]];
  if (TL.full) {
    for (const e of TLN.events) {
      if (e.kind === 'peak') BURSTS.push([e.t, e.i, 'gold', 1.0, DSD]);
      else if (e.kind === 'crash') BURSTS.push([e.t, e.i, 'jade', 0.6, DSD]);
    }
    for (const cr of HS.crashes) {
      BURSTS.push([cr.t_peak, cr.peak_x, 'gold', cr.n === 2 ? 1.0 : 0.7, DSH]);
      BURSTS.push([cr.t_low, cr.low_x, 'jade', 0.6, DSH]);
      if (cr.t_rec) BURSTS.push([cr.t_rec, cr.rec_x, 'gold', 0.5, DSH]);
    }
    BURSTS.push([HS.drop, HS.crashes[1].peak_x, 'shard', 1.0, DSH, BUBS[1].origin]);
    prepTimeline();
    prepInfl();
  }
  DS = DSD; CAM = TRACKS[0];
  window.READY = true;
})();
