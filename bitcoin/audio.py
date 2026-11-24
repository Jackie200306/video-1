#!/usr/bin/env python3
"""Procedural sound effects for the Bitcoin life-line video (no music, no voice).

Reads build/timeline.json and writes build/sfx.wav. Every sound is synthesised
here, so there are no third-party samples to license.
"""
import json, math, os, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
rng = np.random.default_rng(1234)

TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
T = TL['T']
N = int(math.ceil(T * SR)) + SR
L = np.zeros(N); R = np.zeros(N)
FX_L = np.zeros(N); FX_R = np.zeros(N)       # reverb send


def db(x):
    return 10 ** (x / 20)


def add(sig, t0, gain_db=0.0, pan=0.0, send=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]; i0 = 0
    sig = sig[:N - i0] * db(gain_db)
    gl, gr = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    L[i0:i0 + len(sig)] += sig * gl * 1.414
    R[i0:i0 + len(sig)] += sig * gr * 1.414
    if send:
        FX_L[i0:i0 + len(sig)] += sig * gl * send
        FX_R[i0:i0 + len(sig)] += sig * gr * send


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env_ad(n, a, d_tau):
    t = np.arange(n) / SR
    e = np.exp(-np.maximum(t - a, 0) / d_tau)
    e[t < a] = t[t < a] / max(a, 1e-4)
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def sweep_tone(f0, f1, dur, curve='exp'):
    t = tt(dur)
    if curve == 'exp':
        f = f0 * (f1 / f0) ** (t / dur)
    else:
        f = f0 + (f1 - f0) * (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ----------------------------------------------------------------- sounds
def ecg_beep(freq=985, dur=0.13):
    t = tt(dur)
    e = np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.03)
    return (np.sin(2 * np.pi * freq * t) + 0.12 * np.sin(2 * np.pi * 2 * freq * t)) * e


def heartbeat(strength=1.0):
    """lub-dub: two low thumps."""
    out = np.zeros(int(0.6 * SR))
    for off, f, g in [(0.0, 58, 1.0), (0.24, 70, 0.7)]:
        t = tt(0.3)
        s = np.sin(2 * np.pi * (f * t - 18 * t * t)) * np.exp(-t / 0.07) * np.minimum(1, t / 0.006)
        s += 0.3 * lp(rng.normal(0, 1, len(t)), 180) * np.exp(-t / 0.03)
        i = int(off * SR); out[i:i + len(s)] += s * g
    return out * strength


def pop():
    t = tt(0.09)
    s = sweep_tone(520, 1300, 0.09) * np.exp(-t / 0.03) * np.minimum(1, t / 0.002)
    click = hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t / 0.004) * 0.4
    return s * 0.7 + click


def whoosh(dur=0.45, f0=300, f1=3500, rev=False):
    n = int(dur * SR)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    seg = 512
    for k in range(0, n, seg):
        u = k / n
        f = f0 * (f1 / f0) ** (u if not rev else 1 - u)
        chunk = noise[max(0, k - 2048):k + seg]
        y = bp(chunk, max(40, f * 0.6), min(SR / 2 - 100, f * 1.6))
        out[k:k + seg] = y[-len(out[k:k + seg]):]
    t = np.arange(n) / n
    e = np.sin(np.pi * t) ** 1.5 if not rev else np.sin(np.pi * t) ** 1.2
    return out * e * 2.2


def riser(dur=1.6, big=False):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    noise = rng.normal(0, 1, n)
    out = np.zeros(n); seg = 1024
    for k in range(0, n, seg):
        f = 400 * (6000 / 400) ** (k / n)
        chunk = noise[max(0, k - 4096):k + seg]
        y = bp(chunk, f * 0.7, min(f * 1.4, SR / 2 - 200))
        out[k:k + seg] = y[-len(out[k:k + seg]):]
    tone = sweep_tone(180, 900 if not big else 1200, dur) * 0.35
    tone += sweep_tone(181.5, 905 if not big else 1206, dur) * 0.35       # slight detune
    e = u ** 2.2
    return (out * 1.6 + tone) * e


def bell(f=1046.5, dur=2.6, bright=1.0):
    t = tt(dur)
    parts = [(1.0, 1.0, 1.6), (2.76, 0.5, 0.7), (5.40, 0.28 * bright, 0.35), (8.93, 0.14 * bright, 0.18), (2.0, 0.3, 1.0)]
    s = np.zeros(len(t))
    for ratio, amp, tau in parts:
        s += amp * np.sin(2 * np.pi * f * ratio * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    s *= np.minimum(1, t / 0.002)
    return s * 0.6


def shimmer(dur=1.2, n=40):
    out = np.zeros(int((dur + 0.3) * SR))
    for _ in range(n):
        t0 = rng.uniform(0, dur * 0.8); f = rng.uniform(2500, 7500); d = rng.uniform(0.05, 0.25)
        t = tt(d)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / (d / 3)) * np.minimum(1, t / 0.002)
        i = int(t0 * SR); out[i:i + len(s)] += s * rng.uniform(0.2, 0.6) * (1 - t0 / dur)
    return out * 0.5


def glass_shatter(strength=1.0):
    dur = 1.3; n = int(dur * SR); out = np.zeros(n)
    t = tt(dur)
    # initial crack
    crack = hp(rng.normal(0, 1, n), 1500) * np.exp(-t / 0.018) * 1.2
    crack += hp(rng.normal(0, 1, n), 4000) * np.exp(-t / 0.12) * 0.25
    out += crack
    # tinkling shards
    for _ in range(int(70 * strength)):
        t0 = abs(rng.normal(0, 0.18)) ; f = rng.uniform(2200, 9000); d = rng.uniform(0.03, 0.18)
        tk = tt(d)
        s = np.sin(2 * np.pi * f * tk) * np.exp(-tk / (d / 4))
        i = int(t0 * SR)
        if i + len(s) < n:
            out[i:i + len(s)] += s * rng.uniform(0.1, 0.45) * math.exp(-t0 / 0.4)
    return out * strength


def fall_whistle(dur=1.2):
    t = tt(dur)
    s = sweep_tone(1400, 160, dur) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
    s = s * np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.08)
    rumble = lp(rng.normal(0, 1, len(t)), 220) * (t / dur) ** 1.5 * 2.5
    return s * 0.35 + rumble * 0.5


def impact(strength=1.0, dur=2.4):
    t = tt(dur)
    boom = np.sin(2 * np.pi * (75 * t - 22 * t ** 2 * (t < 0.9) - 9.9 * (t >= 0.9) * (t - 0.9))) * np.exp(-t / 0.55)
    boom *= np.minimum(1, t / 0.003)
    thump = lp(rng.normal(0, 1, len(t)), 400) * np.exp(-t / 0.06) * 2.5
    crunch = bp(rng.normal(0, 1, len(t)), 800, 5000) * np.exp(-t / 0.09) * 0.6
    debris = np.zeros(len(t))
    for _ in range(int(30 * strength)):
        t0 = rng.uniform(0.05, 0.9); d = rng.uniform(0.01, 0.05)
        tk = tt(d); s = bp(rng.normal(0, 1, len(tk)), 1500, 6000) * np.exp(-tk / (d / 3))
        i = int(t0 * SR); debris[i:i + len(s)] += s * rng.uniform(0.1, 0.35) * math.exp(-t0 / 0.5)
    s = np.tanh((boom * 1.6 + thump + crunch) * 1.4) * 0.8 + debris * 0.5
    return s * strength


def tick(freq=1250, dur=0.05):
    t = tt(dur)
    return np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.012) * np.minimum(1, t / 0.002)


def typewriter():
    t = tt(0.05)
    return hp(rng.normal(0, 1, len(t)), 2500) * np.exp(-t / 0.008) * 0.6 + np.sin(2 * np.pi * 300 * t) * np.exp(-t / 0.01) * 0.3


# ----------------------------------------------------------------- timeline
fps = TL['fps']
D = np.array(TL['frames']['D'])
tf = np.arange(len(D)) / fps
t_now = TL['t_now']

def time_at_day(d):
    k = np.argmax(D >= d)
    return tf[k]

# ECG intro beats (must match BEATS in scene.js)
for b in (-178, -86):
    add(ecg_beep(), time_at_day(b) - 0.01, -15, pan=-0.1)
    add(heartbeat(0.5), time_at_day(b) - 0.02, -16)
# genesis: brighter beep + heartbeat
add(ecg_beep(1046, 0.22), time_at_day(0) - 0.01, -12, send=0.25)
add(heartbeat(0.8), time_at_day(0) - 0.02, -12)

# year crossings: quiet monitor blip
for y in TL['years']:
    if y['year'] >= 2010 and y['t'] < t_now:
        add(tick(1320), y['t'], -26, pan=0.2)

# rail crossings (new order of magnitude): soft rising chime
for r in TL['rails']:
    if r['t'] and 2.5 < r['t'] < t_now:
        add(bell(1568, 1.2, 0.5), r['t'], -24, pan=0.3, send=0.3)

for e in TL['events']:
    te = e['t']
    k = e['kind']
    if k in ('info', 'milestone', 'start'):
        ta = e['ta']
        add(whoosh(0.32, 500, 4000), ta - 0.22, -27, pan=0.4)
        add(pop(), ta, -19, pan=0.35)
        if k == 'milestone':
            add(bell(1318.5, 1.6, 0.7), ta + 0.03, -20, pan=0.2, send=0.35)
            add(bell(1760, 1.6, 0.6), ta + 0.12, -22, pan=0.25, send=0.35)
        if e.get('flash'):                                    # 1011 liquidation cascade
            add(glass_shatter(0.8), te - 0.05, -14, send=0.3)
            add(impact(0.9), te, -10, send=0.35)
    elif k == 'peak':
        big, minor = e.get('big'), e.get('minor')
        rdur = 2.4 if big else (1.2 if minor else 1.7)
        add(riser(rdur, big), te - rdur, -20 if not minor else -25, send=0.2)
        add(bell(1046.5 if not big else 880, 3.0, 1.0), te, -7 if big else (-16 if minor else -12), send=0.45)
        if big:
            add(impact(0.5), te, -14, send=0.5)                 # weight under the all-time high
            add(bell(1318.5, 3.0, 0.8), te + 0.02, -12, send=0.5)
        add(bell(1568, 2.2, 0.8), te + 0.01, -19 if not big else -15, send=0.45)
        add(shimmer(1.4 if big else 1.0, 60 if big else 35), te, -16 if not minor else -21, pan=0.2, send=0.3)
        add(heartbeat(0.6), te, -16)
        # bubble bursts, then the line falls
        tb = e['t_break']
        add(glass_shatter(1.2 if big else (0.6 if minor else 1.0)), tb, -12 if not minor else -17, pan=-0.1, send=0.35)
    elif k == 'bottom':
        minor = e.get('minor')
        sev = min(1.0, abs(e['dd']) / 0.85)
        # falling whistle from the preceding peak break (or 1.2 s before) down to the impact
        prev_peaks = [p for p in TL['events'] if p['kind'] == 'peak' and p['t'] < te]
        tb = prev_peaks[-1]['t_break'] if prev_peaks else te - 1.2
        fdur = te - tb
        if not (0.4 < fdur < 3.0) or minor:
            fdur = 0.9 if not minor else 0.6
        add(fall_whistle(fdur), te - fdur, -20 if not minor else -25, pan=0.1)
        add(whoosh(0.5, 3000, 200, rev=False), te - 0.42, -20)
        add(impact(0.75 + 0.45 * sev if not minor else 0.6), te, -6 if not minor else -12, send=0.4)
        add(pop(), te + 0.02, -22, pan=0.35)
    elif k == 'now':
        add(pop(), e['ta'], -17, pan=0.35)
        add(ecg_beep(985, 0.13), e['ta'], -18)

# ending: draw lines, overview pull-back, "假如买入1万元" reveal, final text
E = TL['end']
HAS_BGM = os.path.exists(os.path.join(HERE, 'build', 'bgm_sync.json'))
add(whoosh(0.6, 2000, 300), t_now + 0.05, -22, pan=0.3)
add(whoosh(2.6, 150, 2500), t_now + 2.0, -15, send=0.4)
# question pops in, then a quiet clock while the viewer thinks
add(whoosh(0.4, 400, 3000), E['q'] - 0.3, -22, pan=0.2)
add(pop(), E['q'] + 0.1, -16)
if not HAS_BGM:
    for kk, tk in enumerate(np.arange(E['q'] + 0.7, E['rev'] - 0.1, 0.5)):
        add(tick(1500 if kk % 2 == 0 else 1150, 0.04), tk, -24, pan=0.15 * (-1) ** kk)
    rdur = E['rev'] - (E['q'] + 0.6)
    add(riser(rdur, True), E['rev'] - rdur, -24, send=0.2)
# the drop: the amount appears and rolls up, then lands with coins
add(impact(1.0), E['rev'], -8 if not HAS_BGM else -14, send=0.4)
add(bell(880, 2.5, 0.8), E['rev'], -16, send=0.4)
cnt = E['rev_count']
for kk in range(22):                                    # rolling counter, fast -> slow
    u = 1 - (1 - kk / 22) ** (1 / 3)                    # inverse of easeOutCubic spacing
    add(tick(2200 + 40 * kk, 0.03), E['rev'] + u * cnt, -24, pan=0.3 * math.sin(kk))
tl_ = E['rev'] + cnt
add(bell(1046.5, 3.0, 1.0), tl_, -10, send=0.5)
add(bell(1568, 2.4, 0.8), tl_ + 0.01, -14, send=0.5)
add(shimmer(1.6, 80), tl_, -12, pan=0.2, send=0.3)
coins = np.zeros(int(1.8 * SR))
for _ in range(60):
    t0 = abs(rng.normal(0, 0.35)); f = rng.uniform(3000, 7000); d = rng.uniform(0.04, 0.12)
    tk_ = tt(d); s_ = np.sin(2 * np.pi * f * tk_) * np.exp(-tk_ / (d / 4)) + 0.5 * np.sin(2 * np.pi * f * 1.48 * tk_) * np.exp(-tk_ / (d / 5))
    i = int(t0 * SR)
    if i + len(s_) < len(coins):
        coins[i:i + len(s_)] += s_ * rng.uniform(0.2, 0.5)
add(coins, tl_ + 0.05, -16, pan=-0.1, send=0.3)
# back down to the present, final line, "你敢买吗？"
add(whoosh(1.6, 2500, 200), E['fin'] - 0.4, -19, send=0.3)
for kk in range(14):
    add(typewriter(), E['fin'] + 0.35 + kk * 0.075, -26, pan=(kk - 7) / 14)
hb_period = json.load(open(os.path.join(HERE, 'build', 'bgm_sync.json')))['beat_period'] * 2 if HAS_BGM else 0.92
for kk, tb in enumerate(np.arange(E['fin'] + (0 if HAS_BGM else 0.2), E['end'] - 0.3, hb_period)):
    if abs(tb - E['slam']) > 0.25:
        add(heartbeat(1.0), tb, -9 - max(0, kk - 5) * 2 - (6 if HAS_BGM else 0))
add(impact(1.1), E['slam'], -6, send=0.5)
add(bell(440, 4.0, 0.6), E['slam'], -17, send=0.6)

# ambient rain bed (very quiet), fades in and out
n = N
rain = lp(hp(rng.normal(0, 1, n), 400), 5000) * 0.18
drops = np.zeros(n)
for _ in range(int(T * 18)):
    i = int(rng.uniform(0, n - 2000)); d = int(rng.uniform(80, 400))
    drops[i:i + d] += rng.normal(0, 1, d) * np.exp(-np.arange(d) / (d / 4)) * rng.uniform(0.1, 0.5)
rain += hp(drops, 1500) * 0.3
fade = np.clip(np.arange(n) / SR / 1.5, 0, 1) * np.clip((T - np.arange(n) / SR) / 1.5, 0, 1)
rg = db(-27 if not HAS_BGM else -36)
L += rain * fade * rg; R += np.roll(rain, 997) * fade * rg

# ----------------------------------------------------------------- reverb + master
ir_t = tt(1.8)
ir = rng.normal(0, 1, len(ir_t)) * np.exp(-ir_t / 0.45)
ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
L += signal.fftconvolve(FX_L, ir)[:N] * 0.6
R += signal.fftconvolve(FX_R, np.roll(ir, 211))[:N] * 0.6

mix = np.stack([L, R], 1)[:int(T * SR)]
mix = hp(mix.T, 25).T
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * db(-1.0)
out = os.path.join(HERE, 'build', 'sfx.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out, '%.1fs' % (len(mix) / SR), 'raw peak %.2f' % peak)
