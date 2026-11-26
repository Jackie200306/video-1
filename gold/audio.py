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
for k in (-6, -5, -4, -3):
    add(tick(1900, 0.04), D + k * P, -30, pan=0.3 * (-1) ** k)
# a chime on every round number the climb breaks through (each lands on a beat)
NOTES = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0]
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
    bgm[:ie] = sweep_lp(bgm[:ie], 450, 19000, 1.6)
    bgm[:ie] *= db(-10 * (1 - np.arange(ie) / ie) ** 1.5)[:, None]          # and swells in
    # pre-drop: sweep a low-pass down over the last two beats and pull the level back, then leave
    # a near-silent gap so the crack is heard alone; the drop comes back full band on the burst
    a0, a1 = HK['peakTag'], D
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
    # level: steady under the SFX
    blk = int(0.4 * SR)
    r = np.sqrt(np.mean(bgm[: len(bgm) // blk * blk].reshape(-1, blk, 2) ** 2, axis=(1, 2)))
    bgm *= 0.24 / np.percentile(r[r > 1e-4], 70)
    # ducking under loud SFX
    env = np.abs(sfx).max(1)
    rel = math.exp(-1 / (0.3 * SR))
    e = signal.lfilter([1 - rel], [1, -rel], env)
    duck = 1 - 0.35 * np.clip(e / (np.percentile(env, 99.5) + 1e-6), 0, 1)
    bgm *= duck[:, None]
    bgm *= np.clip(t / 0.12, 0, 1)[:, None]
    out = sfx * 0.9 + bgm
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
