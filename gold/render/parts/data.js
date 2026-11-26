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
