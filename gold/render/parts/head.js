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

