"""Procedural sound-effect synthesis (shared with ../bitcoin/audio.py). Every sound is made
here from noise and oscillators, so there are no third-party samples to license."""
import math
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(1234)


def db(x):
    return 10 ** (x / 20)

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


