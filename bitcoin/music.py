#!/usr/bin/env python3
"""Original royalty-free BGM, composed to the video's timeline (112 BPM, A minor).

  python3 music.py grid     write build/bgm_sync.json: a beat grid whose downbeat is the amount
                            reveal, so prep.py snaps the question / landing / final hit to beats
  python3 music.py render   synthesise build/bgm_orig.wav using the (snapped) timeline

Everything is synthesised here (no samples), so the track is free to use anywhere.
Progression: Fmaj7 - G - Em7 - Am, bar 0 = the drop = the moment the amount appears.
"""
import json, math, os, sys, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
BPM = 112.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
SYNC = os.path.join(HERE, 'build', 'bgm_sync.json')
OUT = os.path.join(HERE, 'build', 'bgm_orig.wav')
rng = np.random.default_rng(112)


def grid():
    TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
    rev, T = TL['end']['rev'], TL['T'] + 3
    k0 = -int(rev / BEAT) - 1
    beats = [rev + k * BEAT for k in range(k0, int((T - rev) / BEAT) + 2)]
    downs = [b for i, b in enumerate(beats) if (i + k0) % 4 == 0]
    json.dump(dict(song=OUT, native=True, bpm=BPM, beat_period=BEAT, offset=0.0, loop=False,
                   drop_song=rev, t_rev=rev, beats_video=beats, downbeats_video=downs),
              open(SYNC, 'w'), indent=1)
    print('grid written: %.1f BPM, drop on %.2fs' % (BPM, rev))


# ------------------------------------------------------------------ synthesis helpers
def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(freq, n, phase=0.0):
    dt = freq / SR
    ph = (phase + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt; t = ph[m] / dt; y[m] -= t + t - t * t - 1
    m = ph > 1 - dt; t = (ph[m] - 1) / dt; y[m] -= t * t + t + t + 1
    return y


def env_adsr(n, a, d, s, r, gate):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > gate
    e[rel] *= np.exp(-(t[rel] - gate) / max(r, 1e-4))
    return e


def lp(x, f, order=2):
    f = min(f, SR * 0.45)
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


class Track:
    def __init__(self, n):
        self.buf = np.zeros((n, 2))

    def add(self, t0, sig, gain=1.0, pan=0.0):
        i0 = int(round(t0 * SR))
        if sig.ndim == 1:
            gl, gr = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
            sig = np.stack([sig * gl, sig * gr], 1) * 1.414
        if i0 < 0:
            sig = sig[-i0:]; i0 = 0
        n = min(len(sig), len(self.buf) - i0)
        if n > 0:
            self.buf[i0:i0 + n] += sig[:n] * gain


# instruments ------------------------------------------------------------
def supersaw(m, dur, rel=0.25, voices=7, detune=1.0, cutoff=5000, a=0.01):
    n = int((dur + rel) * SR)
    f = mtof(m)
    out = np.zeros((n, 2))
    cents = np.linspace(-24, 24, voices) * detune
    for k, c in enumerate(cents):
        v = saw(f * 2 ** (c / 1200), n, rng.random())
        pan = (k / (voices - 1)) * 2 - 1
        out[:, 0] += v * (1 - pan) * 0.5; out[:, 1] += v * (1 + pan) * 0.5
    out = lp(out, cutoff, 2) / voices * 2.2
    return out * env_adsr(n, a, 0.4, 0.75, rel, dur)[:, None]


def pluck(m, dur, bright=1.0):
    n = int((dur + 0.6) * SR)
    f = mtof(m)
    x = saw(f, n, rng.random()) * 0.6 + saw(f * 1.005, n, rng.random()) * 0.4
    hi = lp(x, 7000 * bright); lo_ = lp(x, 900)
    t = np.arange(n) / SR
    k = np.exp(-t / 0.08)
    y = hi * k + lo_ * (1 - k)
    return y * np.exp(-t / (0.35 + 0.15 * bright)) * np.minimum(1, t / 0.003)


def keys(m, dur, vel=1.0):
    """2-op FM electric piano."""
    n = int((dur + 1.2) * SR)
    f = mtof(m); t = np.arange(n) / SR
    idx = 1.6 * vel * np.exp(-t / 0.35) + 0.25
    mod = np.sin(2 * np.pi * f * t) * idx
    tine = 0.08 * vel * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * f * t + mod) + tine
    e = np.exp(-t / 1.1) * np.minimum(1, t / 0.002)
    e[t > dur] *= np.exp(-(t[t > dur] - dur) / 0.25)
    return y * e * 0.5


def pad(m, dur):
    n = int((dur + 1.5) * SR)
    f = mtof(m)
    x = np.zeros((n, 2))
    for c, pan in ((-9, -0.8), (-3, -0.3), (3, 0.3), (9, 0.8)):
        v = saw(f * 2 ** (c / 1200), n, rng.random())
        x[:, 0] += v * (1 - pan) * 0.5; x[:, 1] += v * (1 + pan) * 0.5
    x = lp(hp(x, 180), 1600) * 0.3
    return x * env_adsr(n, 0.6, 1.0, 0.9, 1.2, dur)[:, None]


def bass(m, dur, sub_only=False):
    n = int((dur + 0.12) * SR)
    f = mtof(m); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * f * t)
    y = sub if sub_only else sub + 0.45 * lp(saw(f, n), 420)
    y = np.tanh(y * 1.3)
    e = np.minimum(1, t / 0.004) * np.where(t > dur, np.exp(-(t - dur) / 0.04), 1)
    return y * e * 0.8


def kick(big=False):
    d = 0.5 if not big else 0.9
    t = np.arange(int(d * SR)) / SR
    f = 46 + 110 * np.exp(-t / 0.045)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.22 if not big else 0.45))
    y += 0.4 * hp(rng.normal(0, 1, len(t)), 3000) * np.exp(-t / 0.003)
    return np.tanh(y * 1.6) * 0.9


def clap():
    t = np.arange(int(0.35 * SR)) / SR
    nz = bp(rng.normal(0, 1, len(t)), 900, 6000)
    e = np.zeros_like(t)
    for off in (0.0, 0.011, 0.022):
        m = t >= off
        e[m] += np.exp(-(t[m] - off) / (0.008 if off < 0.02 else 0.12))
    return nz * e * 0.5


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    t = np.arange(int(d * SR)) / SR
    return hp(rng.normal(0, 1, len(t)), 7500) * np.exp(-t / (0.08 if open_ else 0.015)) * 0.25


def snare():
    t = np.arange(int(0.2 * SR)) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    nz = bp(rng.normal(0, 1, len(t)), 1500, 8000) * np.exp(-t / 0.07)
    return (body * 0.5 + nz) * 0.45


def crash():
    t = np.arange(int(2.5 * SR)) / SR
    x = hp(rng.normal(0, 1, (len(t), 2)), 4000) * np.exp(-t / 0.9)[:, None]
    return x * 0.22


def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    x = rng.normal(0, 1, n); out = np.zeros(n); seg = 1024
    for k in range(0, n, seg):
        f = 300 * (9000 / 300) ** (k / n)
        y = bp(x[max(0, k - 4096):k + seg], f * 0.7, min(f * 1.4, SR * 0.45))
        out[k:k + seg] = y[-len(out[k:k + seg]):]
    tone = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (u * 2)) / SR) * 0.3
    return (out * 1.4 + tone) * u ** 2


def downlifter(dur=1.5):
    n = int(dur * SR); t = np.arange(n) / SR
    y = lp(rng.normal(0, 1, n), 6000) * np.exp(-t / 0.5)
    return y * 0.4


# ------------------------------------------------------------------ composition
PROG = [('F', [53, 57, 60, 64], 41), ('G', [55, 59, 62, 67], 43), ('Em', [52, 55, 59, 62], 40), ('Am', [57, 60, 64, 67], 45)]
MEL_A = [(0, .75, 76), (.75, .75, 72), (1.5, .5, 69), (2, 1, 72), (3, 1, 74),
         (4, .75, 74), (4.75, .75, 71), (5.5, .5, 67), (6, 1, 71), (7, .5, 72), (7.5, .5, 74),
         (8, .75, 71), (8.75, .75, 67), (9.5, .5, 64), (10, .5, 67), (10.5, .5, 71), (11, 1, 74),
         (12, 1.5, 76), (13.5, .5, 74), (14, .5, 72), (14.5, .5, 71), (15, 1, 69)]
MEL_B = MEL_A[:-5] + [(12, 1, 76), (13, .5, 79), (13.5, .5, 76), (14, 1, 74), (15, 1, 72)]


def render():
    TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
    E = TL['end']; T = TL['T']
    rev = E['rev']
    n = int((T + 1) * SR)
    tr = {k: Track(n) for k in ('drums', 'bass', 'chords', 'lead', 'keys', 'pad', 'fx')}

    def tb(bar, beat=0.0):
        return rev + (bar * 4 + beat) * BEAT

    first = -int(rev / BAR)                      # first bar fully inside the video
    slam_bar = round((E['slam'] - rev) / BAR)
    fin_bar = round((E['fin'] - rev) / BAR)

    def section(b):
        if b < first + 4: return 'intro'
        if b < -31: return 'verse1'
        if b < -15: return 'chorus1'
        if b < -11: return 'verse2'
        if b < -3: return 'chorus2'
        if b < 0: return 'break'
        if b < fin_bar: return 'drop'
        return 'outro'

    sc_times = []                                # kick times for side-chain
    for b in range(first, slam_bar + 3):
        name, chord, root = PROG[b % 4]
        sec = section(b)
        t0 = tb(b)
        if t0 > T:
            break
        phrase_bar = (b - first) % 4
        mel = MEL_B if ((b - first) // 4) % 2 else MEL_A
        # ---- pad / keys bed
        if sec in ('intro', 'verse1', 'verse2', 'break', 'chorus1', 'chorus2'):
            for m in chord:
                tr['pad'].add(t0, pad(m, BAR), 0.5 if sec != 'intro' else 0.6)
        if sec in ('intro', 'verse1', 'verse2', 'break'):
            arp = chord + [chord[1] + 12, chord[2] + 12]
            order = [0, 2, 1, 3, 4, 3, 2, 5]
            for k in range(8):
                if sec == 'break' and b == -1 and k >= 6:
                    continue
                tr['keys'].add(tb(b, k * 0.5), keys(arp[order[k]], 0.45, 0.8), 0.32, pan=0.3 * math.sin(k))
        if sec == 'outro':
            if b == slam_bar:
                for m in PROG[3][1]:
                    tr['pad'].add(t0, pad(m, 4.0), 0.7)
                    tr['keys'].add(t0, keys(m, 3.0, 1.0), 0.35)
            elif b < slam_bar:
                for m in chord:
                    tr['pad'].add(t0, pad(m, BAR), 0.45)
                tr['keys'].add(t0, keys(chord[0] - 12, 1.5, 0.6), 0.3)
        # ---- bass
        if sec in ('verse1', 'verse2'):
            tr['bass'].add(t0, bass(root, BEAT * 1.5, True), 0.55)
            tr['bass'].add(tb(b, 2.5), bass(root, BEAT * 1.2, True), 0.45)
        if sec in ('chorus1', 'chorus2'):
            for k in range(4):
                tr['bass'].add(tb(b, k + 0.5), bass(root, BEAT * 0.42), 0.6)
            tr['bass'].add(t0, bass(root - 12, BEAT * 0.4, True), 0.5)
        if sec == 'drop':
            tr['bass'].add(t0, bass(root - 12, BAR * 0.98, True), 0.85)
            tr['bass'].add(t0, bass(root, BAR * 0.98), 0.35)
        if sec == 'outro' and b == slam_bar:
            tr['bass'].add(t0, bass(33, 2.5, True), 0.9)
        # ---- chords / lead
        if sec in ('chorus1', 'chorus2'):
            for k, (bt, ln) in enumerate([(0, 1.5), (1.5, 1.0), (2.5, 1.5)]):
                for m in chord:
                    tr['chords'].add(tb(b, bt), supersaw(m, BEAT * ln * 0.9, rel=0.15, cutoff=3500 if sec == 'chorus1' else 4500), 0.16)
        if sec == 'drop':
            for m in chord + [chord[0] + 12]:
                tr['chords'].add(t0, supersaw(m, BAR * 0.95, rel=0.3, cutoff=6500, detune=1.3), 0.17)
            for bt in (0, 0.75, 1.5, 2.5, 3.0, 3.5):
                for m in chord:
                    tr['chords'].add(tb(b, bt), supersaw(m + 12, BEAT * 0.3, rel=0.08, cutoff=8000, voices=5), 0.07)
        if sec in ('chorus1', 'chorus2', 'drop') or (sec == 'verse1' and b >= -39):
            for (bt, ln, m) in mel:
                if phrase_bar * 4 <= bt < phrase_bar * 4 + 4:
                    tt = tb(b, bt - phrase_bar * 4)
                    soft = sec == 'verse1'
                    tr['lead'].add(tt, pluck(m, ln * BEAT, 0.6 if soft else 1.0), 0.22 if soft else 0.3, pan=-0.1)
                    if sec == 'drop':
                        tr['lead'].add(tt, supersaw(m + 12, ln * BEAT * 0.9, rel=0.1, cutoff=7000, voices=5)[:, 0], 0.08, pan=0.2)
        # ---- drums
        if sec == 'verse1':
            tr['drums'].add(t0, kick(), 0.7); tr['drums'].add(tb(b, 2.5), kick(), 0.55)
            sc_times += [t0, tb(b, 2.5)]
            if b >= -39:
                tr['drums'].add(tb(b, 1), clap(), 0.5); tr['drums'].add(tb(b, 3), clap(), 0.5)
            for k in range(8):
                tr['drums'].add(tb(b, k * 0.5), hat(), 0.35 if k % 2 else 0.22, pan=0.3)
        if sec in ('chorus1', 'chorus2', 'drop'):
            for k in range(4):
                tr['drums'].add(tb(b, k), kick(), 0.85); sc_times.append(tb(b, k))
                tr['drums'].add(tb(b, k + 0.5), hat(True), 0.45, pan=0.25)
            tr['drums'].add(tb(b, 1), clap(), 0.65); tr['drums'].add(tb(b, 3), clap(), 0.65)
            for k in range(16):
                tr['drums'].add(tb(b, k * 0.25), hat(), 0.18 + 0.1 * (k % 2), pan=-0.3)
        if sec == 'verse2':
            tr['drums'].add(t0, kick(), 0.7); tr['drums'].add(tb(b, 2), kick(), 0.6)
            sc_times += [t0, tb(b, 2)]
            tr['drums'].add(tb(b, 3), clap(), 0.4)
            for k in range(8):
                tr['drums'].add(tb(b, k * 0.5 + 0.25), hat(), 0.25, pan=0.3)
        # section starts: crash + fills
        if b in (-31, -11, 0) or b == slam_bar:
            tr['fx'].add(t0, crash(), 0.9)
        if b in (-32, -16, -12):
            for k in range(4):
                tr['drums'].add(tb(b, 3 + k * 0.25), snare(), 0.3 + 0.08 * k)
        if b == -1:                                       # build into the drop
            hits = [k * 0.5 for k in range(4)] + [2 + k * 0.25 for k in range(4)] + [3 + k * 0.125 for k in range(4)]
            for k, bt in enumerate(hits):
                tr['drums'].add(tb(b, bt), snare(), 0.18 + 0.03 * k)
            tr['fx'].add(tb(b, 0), riser(BAR - BEAT * 0.5), 0.35)
        if b == slam_bar:
            tr['drums'].add(t0, kick(True), 1.0)
        if b == -3:
            tr['fx'].add(t0, downlifter(2.0), 0.5)
    # the outro "heartbeat" kick on every other beat between fin and slam
    for t_ in np.arange(tb(fin_bar), tb(slam_bar) - 0.01, 2 * BEAT):
        tr['drums'].add(t_, kick(), 0.55)

    # ---- mix: side-chain, filters, space
    t = np.arange(n) / SR
    sc = np.ones(n)
    for s in sc_times:
        i = int(s * SR); m = min(n - i, int(BEAT * SR))
        if m > 0:
            tt = np.arange(m) / SR
            sc[i:i + m] = np.minimum(sc[i:i + m], 1 - 0.65 * np.exp(-tt / 0.11))
    for k in ('pad', 'chords', 'bass'):
        tr[k].buf *= sc[:, None] ** (0.6 if k == 'bass' else 1.0)
    # breakdown: close the filter on the bed while the viewer thinks, open at the drop
    m_ = (t >= tb(-3)) & (t < rev)
    for k in ('pad', 'keys'):
        seg = tr[k].buf[m_]
        tr[k].buf[m_] = lp(seg, 1200) * 0.9
    m_ = t >= tb(fin_bar)
    for k in ('pad', 'keys'):
        tr[k].buf[m_] = lp(tr[k].buf[m_], 1500)
    ir_t = np.arange(int(2.4 * SR)) / SR
    ir = rng.normal(0, 1, (len(ir_t), 2)) * np.exp(-ir_t / 0.6)[:, None]
    ir = lp(ir, 7000); ir /= np.sqrt((ir ** 2).sum(0))
    wet_in = tr['keys'].buf * 0.5 + tr['lead'].buf * 0.35 + tr['pad'].buf * 0.3 + tr['chords'].buf * 0.2 + tr['drums'].buf * 0.06
    wet = np.stack([signal.fftconvolve(wet_in[:, c], ir[:, c])[:n] for c in range(2)], 1)
    # ping-pong delay on the lead (3/8 note)
    dly = int(0.75 * BEAT * SR)
    lead = tr['lead'].buf.copy()
    echo = np.zeros_like(lead)
    echo[dly:, 0] += lead[:-dly, 1] * 0.32; echo[2 * dly:, 1] += lead[:-2 * dly, 0] * 0.22
    gains = dict(drums=1.0, bass=0.9, chords=0.85, lead=0.75, keys=0.8, pad=0.7, fx=0.7)
    mix = sum(tr[k].buf * g for k, g in gains.items()) + echo * 0.5 + wet * 0.35
    mix[:, :] = hp(mix, 28)
    # gentle glue + fades
    mix = np.tanh(mix / (np.percentile(np.abs(mix), 99.7) + 1e-9) * 1.1) * 0.85
    mix *= np.clip((t - tb(first)) / 1.2 + 1, 0, 1)[:, None]
    mix *= np.clip((T - t) / 2.5, 0, 1)[:, None]
    with wave.open(OUT, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
    print('wrote', OUT, '%.1fs' % (n / SR), 'bars %d..%d, drop at %.2fs' % (first, slam_bar, rev))


if __name__ == '__main__':
    {'grid': grid, 'render': render}[sys.argv[1]]()
