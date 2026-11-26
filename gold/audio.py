#!/usr/bin/env python3
"""Sound for the gold video: procedural SFX on the beat grid + the BGM.

  python3 audio.py [song]   -> build/mix.wav   (SFX only when no song is given)

The song starts at its breakdown (TL.bgm.song_start) so its first drop (17.40 s into the song)
lands exactly on the bubble burst. During the "时间倒回" rewind the music itself plays backwards
at 2x like a DJ rewind, then resumes forward on the bar where "2023" slams in, so the beat grid
never slips.
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from scipy import signal
from sfx_lib import *          # noqa: F401,F403  (SR, rng, db, tt, bp, lp, hp, sweep_tone, sounds)

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
HK, T = TL['hook'], TL['T']
D, P = HK['drop'], HK['beat']
N = int(math.ceil(T * SR)) + SR
L = np.zeros(N); R = np.zeros(N); FX_L = np.zeros(N); FX_R = np.zeros(N)


def add(sig, t0, gain_db=0.0, pan=0.0, send=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]; i0 = 0
    sig = sig[:N - i0] * db(gain_db)
    gl, gr = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    L[i0:i0 + len(sig)] += sig * gl * 1.414; R[i0:i0 + len(sig)] += sig * gr * 1.414
    if send:
        FX_L[i0:i0 + len(sig)] += sig * gl * send; FX_R[i0:i0 + len(sig)] += sig * gr * send


def tink(n=6, spread=0.12):
    """tiny glass cracks right before the burst"""
    out = np.zeros(int((spread + 0.3) * SR))
    for _ in range(n):
        t0 = rng.uniform(0, spread); f = rng.uniform(3500, 8000); d = rng.uniform(0.02, 0.08)
        tk = tt(d); s = np.sin(2 * np.pi * f * tk) * np.exp(-tk / (d / 4))
        s += hp(rng.normal(0, 1, len(tk)), 5000) * np.exp(-tk / 0.004) * 0.5
        i = int(t0 * SR); out[i:i + len(s)] += s * rng.uniform(0.3, 0.8)
    return out


def bubble_stretch(dur):
    """a rubbery inflating tone under the climb"""
    t = tt(dur); u = t / dur
    f = 90 * (420 / 90) ** (u ** 1.6) * (1 + 0.02 * np.sin(2 * np.pi * 6 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return lp(s, 1800) * u ** 1.5 * np.minimum(1, (dur - t) / 0.02)


def thump(f0=70, dur=0.5):
    t = tt(dur)
    s = np.sin(2 * np.pi * (f0 * t - 30 * t * t)) * np.exp(-t / 0.12) * np.minimum(1, t / 0.003)
    return np.tanh(s * 1.5 + lp(rng.normal(0, 1, len(t)), 300) * np.exp(-t / 0.03))


def rewind_sfx(dur):
    """tape-rewind squeal: band-passed noise + a warbling chirp that speeds up"""
    t = tt(dur); u = t / dur
    noise = bp(rng.normal(0, 1, len(t)), 1200, 6000) * 0.35
    f = 600 + 2600 * u ** 0.7 + 200 * np.sin(2 * np.pi * (8 + 16 * u) * t)
    chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    flutter = (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * (14 + 30 * u) * t)))
    e = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.04)
    return (noise + chirp) * flutter * e


# ----------------------------------------------------------------- SFX timeline
add(bubble_stretch(D - 0.1), 0.0, -24, send=0.1)
add(riser(D - 0.05, True), 0.0, -23, send=0.2)
for k in (-6, -5):
    add(tick(1900, 0.04), D + k * P, -30, pan=0.3 * (-1) ** k)
for k in (-4, -3, -2, -1):                                    # slow motion: a heartbeat on each beat
    add(heartbeat(0.9), D + k * P - 0.01, -15 + (k + 4) * 1.5)
# a chime on every round number the climb breaks through (each lands on a beat)
NOTES = [1046.5, 1174.7, 1318.5, 1396.9, 1568.0, 1760.0, 2093.0]
for k, m in enumerate([m for m in HK['climb'] if m['level'] and m['level'] < 1200]):
    add(bell(NOTES[k], 1.4, 0.6), m['t'], -22, pan=0.25, send=0.3)
    add(pop(), m['t'], -22, pan=0.3)
add(pop(), HK['peakTag'], -17, pan=0.25)
add(bell(1318.5, 2.0, 0.8), HK['peakTag'] + 0.02, -21, pan=0.2, send=0.35)
add(tink(), D - 0.17, -18, pan=0.15)
# the burst: glass + weight + a falling whistle down to today's price
add(glass_shatter(1.4), D - 0.005, -6, send=0.35)
add(impact(1.0), D, -9, send=0.4)
add(whoosh(0.5, 3500, 250), D + 0.02, -18)
add(fall_whistle(HK['crashEnd'] - D), D + 0.05, -19, pan=0.15)
add(thump(55, 0.6), HK['crashEnd'], -12)
# -39.5% badge
add(thump(80, 0.4), HK['badge'], -14); add(pop(), HK['badge'] + 0.01, -16, pan=-0.2)
# 现在 / 还能 / 买吗？
add(whoosh(0.35, 400, 3200), HK['question'] - 0.25, -22, pan=0.2)
for k, dl in enumerate((0, 0.5, 1.0)):
    add(thump(70 + 12 * k, 0.4), HK['question'] + dl * P, -13 + 2 * (k == 2))
    add(pop(), HK['question'] + dl * P, -18, pan=(k - 1) * 0.4)
# chips: 抄底？ 还是 接飞刀？
for k in range(3):
    add(pop(), HK['sub'] + 0.0875 * k, -17, pan=(k - 1) * 0.5)
# rewind
rw = HK['y2023'] - HK['rewind']
add(whoosh(0.7, 3000, 250), HK['rewind'] - 0.2, -17, send=0.2)
for k in range(int(rw / (P / 2))):                           # clock ticking on the eighth notes
    add(tick(1500 if k % 2 == 0 else 1150, 0.04), HK['rewind'] + k * P / 2, -27 - (k % 2) * 3, pan=0.2 * (-1) ** k)
# 2023
add(impact(0.8), HK['y2023'], -11, send=0.4)
add(bell(880, 2.6, 0.8), HK['y2023'] + 0.01, -17, send=0.45)
add(shimmer(1.2, 50), HK['y2023'], -20, pan=0.2, send=0.3)

# ================================================================= full video
if TL.get('full'):
    TLN, NS, HS, LV, INF, OUT = TL['timeline'], TL['nowsec'], TL['history'], TL['lev'], TL['infl'], TL['outro']
    BAR = 4 * P
    def card(t0, pan=0.35, g=0):
        add(whoosh(0.32, 500, 4000), t0 - 0.22, -27 + g, pan=pan); add(pop(), t0, -19 + g, pan=pan)
    for ch in TLN['chapters']:
        add(whoosh(0.45, 300, 2500), ch['t'] - 0.25, -24, pan=-0.3)
    BELLS = [1318.5, 1568.0, 1760.0, 2093.0]
    nm = 0
    for e in TLN['events']:
        t0, k = e['t'], e['kind']
        card(t0)
        if k == 'milestone':
            add(bell(BELLS[nm % 4], 1.6, 0.7), t0 + 0.02, -20, pan=0.2, send=0.35); nm += 1
        elif k == 'shock':
            add(thump(68, 0.5), t0, -15); add(tick(900, 0.06), t0 + 0.01, -24)
        elif k == 'info':
            add(tick(1250, 0.05), t0 + 0.01, -24, pan=0.3)
        elif k in ('dip',):
            add(thump(60, 0.45), t0, -17)
        elif k == 'bounce':
            add(bell(1046.5, 1.4, 0.6), t0 + 0.02, -22, pan=0.2, send=0.3)
        elif k == 'peak':
            add(riser(BAR * 0.5, True), t0 - BAR * 0.5, -22, send=0.2)
            add(bell(880, 3.0, 1.0), t0, -12, send=0.45); add(bell(1318.5, 3.0, 0.8), t0 + 0.02, -15, send=0.45)
            add(shimmer(1.4, 60), t0, -17, pan=0.2, send=0.3); add(impact(0.5), t0, -16, send=0.4)
        elif k == 'crash':
            big = e['date'] == '2026-01-30'
            add(fall_whistle(0.7), t0 - 0.7, -24, pan=0.1)
            if big:
                add(glass_shatter(1.1), t0 - 0.005, -11, send=0.35)
            add(impact(0.9 if big else 0.7), t0, -10 if big else -13, send=0.4)
            if e['date'] in ('2025-10-21', '2026-01-30'):
                add(thump(80, 0.4), t0 + 0.03, -14)
    # the landing and the drawdown
    add(thump(55, 0.6), NS['card'], -12)
    add(thump(80, 0.4), NS['card'] + 2 * P, -14); add(pop(), NS['card'] + 2 * P + 0.01, -16, pan=-0.2)
    add(whoosh(1.4, 2200, 250), NS['overview'] - 0.1, -21, send=0.3)
    # ¥756/克 -> $/盎司, row by row
    for k in range(5):
        add(pop(), NS['convert'] + k * P, -18 + (k == 3) * 2, pan=(k - 2) * 0.2)
        if k in (1, 2):
            add(tick(1700, 0.05), NS['convert'] + k * P, -24)
    add(bell(1568, 2.2, 0.8), NS['convert'] + 3 * P + 0.01, -17, send=0.4)
    add(shimmer(1.0, 40), NS['convert'] + 3 * P, -21, pan=0.2, send=0.3)
    # 现在，可以入场了吗？
    add(whoosh(0.35, 400, 3200), NS['question'] - 0.25, -22, pan=0.2)
    for k, dl in enumerate((0, 0.5, 1.0)):
        add(thump(70 + 12 * k, 0.4), NS['question'] + dl * P, -13 + 2 * (k == 2))
        add(pop(), NS['question'] + dl * P, -18, pan=(k - 1) * 0.4)
    add(thump(58, 0.6), NS['sub'], -11); add(impact(0.5), NS['sub'], -17, send=0.3)      # 先别急。
    add(whoosh(0.35, 400, 3200), NS['sub2'] - 0.25, -21, pan=0.2)                     # 让我们看看…
    for k, dl in enumerate((0, 0.5, 1.0)):
        add(pop(), NS['sub2'] + dl * P, -17 + (k == 2) * 2, pan=(k - 1) * 0.4)
    add(thump(72, 0.4), NS['sub2'] + P, -14); add(bell(1318.5, 2.0, 0.7), NS['sub2'] + P + 0.01, -19, send=0.4)
    # back to 1971: whoosh, clock running backwards, the cut
    rw = NS['cut'] - NS['rewind']
    add(whoosh(0.8, 3000, 250), NS['rewind'], -17, send=0.2)
    for k in range(int(rw / (P / 2))):
        add(tick(1500 if k % 2 == 0 else 1150, 0.04), NS['rewind'] + 0.15 + k * P / 2, -27 - (k % 2) * 3, pan=0.2 * (-1) ** k)
    add(whoosh(2.2, 150, 2600), NS['cut'] - 2.2, -18, send=0.4)
    add(impact(0.7), NS['cut'], -14, send=0.4); add(bell(660, 2.4, 0.6), NS['cut'] + 0.01, -21, send=0.45)
    # history: peaks ring, lows hit, recoveries chime
    for cr in HS['crashes']:
        tp, tl_ = cr['t_peak'], cr['t_low']
        card(tp - BAR * 0.5 + 0.12, pan=-0.3, g=-2)
        add(bell(1046.5 if cr['n'] != 2 else 880, 2.4, 0.9), tp, -16 if cr['n'] != 2 else -13, send=0.45)
        add(shimmer(1.0, 40), tp, -21, pan=0.2, send=0.3)
        if cr['n'] != 2:
            add(fall_whistle(min(1.2, tl_ - tp)), tl_ - min(1.2, tl_ - tp), -23, pan=0.1)
            add(impact(0.75), tl_, -12, send=0.4)
        else:
            add(thump(60, 0.6), tl_, -14)
        add(thump(80, 0.4), tl_ + 0.02, -15)
        if cr.get('t_mid'):
            add(impact(0.6), cr['t_mid'], -15, send=0.3)
        if cr.get('t_rec'):
            tr = cr['t_rec']
            # the big 「回本用了 N 年」 card
            add(whoosh(0.3, 600, 4000), tr - 0.1, -24, pan=-0.3)
            add(impact(0.5), tr + 0.12, -15, send=0.4); add(thump(76, 0.4), tr + 0.12, -14)
            add(bell(1318.5, 2.2, 0.8), tr + 0.13, -14, send=0.45); add(bell(1760, 2.0, 0.6), tr + 0.15, -18, send=0.45)
            add(shimmer(1.2, 50), tr + 0.12, -18, pan=0.2, send=0.3)
        else:
            add(thump(60, 0.6), tl_ + 0.45, -13); add(bell(523, 2.4, 0.6), tl_ + 0.46, -18, send=0.45)
    # the 1980 bubble: inflates over the breakdown, bursts on the second drop
    tb0, DR = HS['bubble'], HS['drop']
    add(bubble_stretch(DR - tb0 - 0.1), tb0, -25, send=0.1)
    add(riser(DR - tb0 - 0.05, True), tb0, -24, send=0.2)
    add(tink(), DR - 0.17, -18, pan=0.15)
    add(glass_shatter(1.4), DR - 0.005, -6, send=0.35)
    add(impact(1.0), DR, -9, send=0.4)
    add(whoosh(0.5, 3500, 250), DR + 0.02, -18)
    # the table
    for k in range(6):
        add(tick(1900 - 80 * k, 0.04), HS['table'] + 0.15 + k * P / 2, -22, pan=(k - 2.5) * 0.15)
    add(pop(), HS['table'] + 0.15 + 3.5 * P, -17)
    # leverage, slide by slide: a soft pop under every line that appears
    add(whoosh(0.5, 300, 3000), LV['t0'] - 0.2, -20, send=0.2); add(thump(64, 0.5), LV['t0'], -13)
    add(pop(), LV['kw'], -16); add(bell(1318.5, 2.0, 0.7), LV['kw'] + 0.01, -19, send=0.4)
    add(whoosh(0.4, 400, 3000), LV['s1'] - 0.2, -22, pan=-0.3)
    for key in ('s1', 's2', 's2b', 's3', 's4'):
        add(pop(), LV[key], -17, pan=0.25)
    add(thump(90, 0.4), LV['s1'], -16); add(thump(70, 0.5), LV['s2'], -15)
    add(riser(0.6, False), LV['s3b'] - 0.05, -24); add(bell(1568, 1.8, 0.7), LV['s3b'] + 0.05, -17, send=0.4); add(shimmer(1.0, 40), LV['s3b'] + 0.05, -21)
    add(thump(56, 0.6), LV['s4'], -12)
    add(fall_whistle(0.6), LV['s4b'] - 0.05, -21); add(impact(0.6), LV['s4b'] + 0.1, -15, send=0.35)
    add(whoosh(0.3, 600, 4000), LV['you'] - 0.15, -23, pan=-0.3); add(pop(), LV['you'], -16, pan=-0.3)
    add(whoosh(0.3, 600, 4000), LV['broker'] - 0.15, -23, pan=0.3)
    for k in range(3):
        add(pop(), LV['broker'] + 2 * k * P, -16 + (k == 2), pan=0.3)
    add(thump(62, 0.45), LV['broker'] + 4 * P, -15)
    add(impact(0.9), LV['force'], -10, send=0.4); add(thump(50, 0.7), LV['force'] + 0.01, -12); add(tick(800, 0.08), LV['force'] + 2 * P, -22)
    add(whoosh(0.4, 400, 3000), LV['cascade'] - 0.2, -22, pan=-0.3)
    for k in range(4):
        t0 = LV['cascade'] + k * 2 * P
        add(impact(0.5 + 0.1 * k), t0, -16 + k, send=0.35); add(thump(85 - 8 * k, 0.4), t0, -15)
        add(glass_shatter(0.3 + 0.1 * k), t0 + 0.01, -22 + k, pan=0.3 - 0.2 * k)
    add(fall_whistle(6 * P), LV['cascade'] + P, -22, pan=0.1)
    add(whoosh(0.8, 300, 2500), LV['cascade'] + 8 * P - 0.1, -21, send=0.2)
    add(thump(60, 0.6), LV['final'], -11); add(impact(0.6), LV['final'], -15, send=0.4); add(pop(), LV['final'] + 2 * P, -18)
    # outro
    add(whoosh(0.5, 300, 3000), OUT['t0'] - 0.2, -20, send=0.2); add(thump(64, 0.5), OUT['q'], -13); add(pop(), OUT['q'], -17)
    for k, key in enumerate(('p1', 'p2', 'p3')):
        add(whoosh(0.3, 600, 4000), OUT[key] - 0.2, -25, pan=-0.4); add(pop(), OUT[key], -17, pan=-0.2)
        add(bell([1046.5, 1318.5, 1568.0][k], 1.8, 0.6), OUT[key] + 0.02, -21, send=0.35)
    # the closing card, line by line
    add(whoosh(0.6, 2500, 300), OUT['final'] - 0.3, -22, send=0.2)
    add(pop(), OUT['final'], -17); add(pop(), OUT['final'] + 2 * P, -16)
    add(thump(64, 0.5), OUT['final'] + 4 * P, -12); add(bell(880, 3.5, 0.8), OUT['final'] + 4 * P, -14, send=0.5)
    add(shimmer(1.6, 60), OUT['final'] + 4 * P, -18, pan=0.2, send=0.3)
    # section cuts: a soft whoosh into each
    for tc in (LV['t0'], OUT['t0']):
        add(whoosh(0.6, 2500, 300), tc - 0.3, -22, send=0.2)

# reverb
ir_t = tt(1.6); ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.4); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
L += signal.fftconvolve(FX_L, ir)[:N] * 0.6; R += signal.fftconvolve(FX_R, np.roll(ir, 211))[:N] * 0.6
n = int(T * SR)
sfx = np.stack([L, R], 1)[:n]
sfx = hp(sfx.T, 25).T

# ----------------------------------------------------------------- BGM
song_path = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('BGM')
t = np.arange(n) / SR
if song_path:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', song_path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    song = np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64)
    s0 = TL['bgm']['song_start']
    i_s = int(round(s0 * SR))
    if TL.get('music'):
        # spliced song: segments of the song laid end to end, 25 ms equal-gain crossfades on the bar lines
        bgm = np.zeros((n, 2)); xf = int(0.025 * SR)
        for k, sg in enumerate(TL['music']):
            v0, a0, ln = int(round(sg['v0'] * SR)), int(round(sg['s0'] * SR)), int(round(sg['dur'] * SR))
            pre = xf if k else 0
            seg = song[max(0, a0 - pre):a0 + ln + xf].copy()
            w = np.ones(len(seg))
            if pre: w[:pre] = np.linspace(0, 1, pre)
            if k < len(TL['music']) - 1: w[-xf:] = np.linspace(1, 0, xf)
            st = v0 - pre
            e = min(n, st + len(seg))
            bgm[max(0, st):e] += (seg * w[:, None])[max(0, -st):e - st]
    else:
        bgm = song[i_s:i_s + n].copy()
    if len(bgm) < n:
        bgm = np.concatenate([bgm, np.zeros((n - len(bgm), 2))])
    # intro: the music opens up from a muffled low-pass over the first three beats
    def sweep_lp(seg, f0, f1, curve=1.0):
        out = seg.copy(); blk_ = 256; zi = None
        for k in range(0, len(seg), blk_):
            u = (k / len(seg)) ** curve
            sos = signal.butter(2, f0 * (f1 / f0) ** u, 'low', fs=SR, output='sos')
            if zi is None:
                zi = signal.sosfilt_zi(sos)[:, :, None] * seg[0][None, None, :]
            out[k:k + blk_], zi = signal.sosfilt(sos, seg[k:k + blk_], axis=0, zi=zi)
        return out
    ie = int(3 * P * SR)
    bgm *= np.clip(t / 0.6, 0, 1)[:, None] ** 1.5                           # short, full-band fade-in
    # pre-drop: sweep a low-pass down over the last two beats and pull the level back, then leave
    # a near-silent gap so the crack is heard alone; the drop comes back full band on the burst
    a0, a1 = HK['slowmo'], D
    i0, i1 = int(a0 * SR), int(a1 * SR)
    blk_ = 256
    zi = np.zeros((1, 2, 2))
    seg = bgm[i0:i1].copy()
    for k in range(0, len(seg), blk_):
        u = (k / len(seg))
        fc = 14000 * (380 / 14000) ** (u ** 1.4)
        sos = signal.butter(2, fc, 'low', fs=SR, output='sos')
        if k == 0:
            zi = signal.sosfilt_zi(sos)[:, :, None] * seg[0][None, None, :]
        seg[k:k + blk_], zi = signal.sosfilt(sos, seg[k:k + blk_], axis=0, zi=zi)
    bgm[i0:i1] = seg
    g = np.ones(len(t))
    m = (t >= a0) & (t < a1)
    g[m] = db(-7 * ((t[m] - a0) / (a1 - a0)) ** 1.5)
    gap = (t >= D - 0.2) & (t < D)
    g[gap] *= db(-16 * np.clip((t[gap] - (D - 0.2)) / 0.06, 0, 1))
    bgm *= g[:, None]
    if TL.get('full'):
        DR = TL['history']['drop']
        gap2 = (t >= DR - 0.18) & (t < DR)
        bgm[gap2] *= db(-14 * np.clip((t[gap2] - (DR - 0.18)) / 0.05, 0, 1))[:, None]
    # level: steady under the SFX
    blk = int(0.4 * SR)
    r = np.sqrt(np.mean(bgm[: len(bgm) // blk * blk].reshape(-1, blk, 2) ** 2, axis=(1, 2)))
    bgm *= 0.24 / np.percentile(r[r > 1e-4], 70)
    # ducking under loud SFX
    env = np.abs(sfx).max(1)
    rel = math.exp(-1 / (0.3 * SR))
    e = signal.lfilter([1 - rel], [1, -rel], env)
    duck = 1 - 0.20 * np.clip(e / (np.percentile(env, 99.5) + 1e-6), 0, 1)
    bgm *= duck[:, None]
    bgm *= np.clip(t / 0.12, 0, 1)[:, None]
    out = sfx * 0.9 * db(-2) + bgm * db(2)                      # effects -2 dB, music +2 dB
else:
    out = sfx
out *= np.clip((T - t) / 0.5, 0, 1)[:, None]                  # preview tail
peak = np.abs(out).max()
out = np.tanh(out / peak * 1.25) / np.tanh(1.25) * db(-1.0)
p = os.path.join(HERE, 'build', 'mix.wav')
with wave.open(p, 'wb') as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
    wf.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', p, '%.2fs' % (n / SR), 'bgm' if song_path else 'sfx only')
