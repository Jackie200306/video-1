#!/usr/bin/env python3
"""Beat-sync a BGM track to the video.

  python3 bgm.py analyze <song>   find tempo, beat grid and the drop; choose the song offset so
                                  the drop lands exactly on the amount reveal; writes build/bgm_sync.json
  python3 bgm.py mix              build/sfx.wav + aligned, ducked song -> build/mix.wav

Optional env: DROP=<seconds into the (speed-adjusted) song> forces which drop is used;
              BGM_SPEED=0.9 slows the song like the popular 0.9x edits.
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
SYNC = os.path.join(HERE, 'build', 'bgm_sync.json')


def load(path):
    # BGM_SPEED=0.9 plays the song slowed like the popular "0.9x" edits (tempo and pitch both drop)
    sp = float(os.environ.get('BGM_SPEED', '1'))
    af = ['-af', 'asetrate=%d,aresample=%d' % (round(SR * sp), SR)] if sp != 1 else []
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ar', str(SR)] + af + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64)


def onset_env(mono, hop=512, n_fft=2048):
    f, t, Z = signal.stft(mono, SR, nperseg=n_fft, noverlap=n_fft - hop, boundary=None, padded=False)
    mag = np.log1p(np.abs(Z) * 100)
    flux = np.maximum(np.diff(mag, axis=1), 0)
    full = np.concatenate([[0], flux.sum(0)])
    low = np.concatenate([[0], flux[(f >= 30) & (f <= 160)].sum(0)])
    rms = np.sqrt(np.mean(np.abs(Z) ** 2, axis=0))
    times = (np.arange(len(full)) * hop + n_fft / 2) / SR
    return times, full, low, rms


def tempo_and_beats(times, env, lo=70, hi=180):
    hop_t = times[1] - times[0]
    e = env - env.mean()
    ac = np.correlate(e, e, 'full')[len(e) - 1:]
    lags = np.arange(len(ac)) * hop_t
    ok = (lags >= 60 / hi) & (lags <= 60 / lo)
    # weight toward 90-150 BPM to avoid octave errors
    bpm = 60 / np.maximum(lags, 1e-9)
    w = np.exp(-0.5 * (np.log2(bpm / 120) / 0.6) ** 2)
    k = np.argmax(np.where(ok, ac * w, -np.inf))
    if 0 < k < len(ac) - 1:                               # parabolic refinement
        a, b, c = ac[k - 1], ac[k], ac[k + 1]
        k = k + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    period = k * hop_t
    # refine the period and phase against the onset envelope (constant tempo grid)
    best = (-1, period, 0)
    for p in np.linspace(period * 0.995, period * 1.005, 21):
        for ph in np.arange(0, p, hop_t):
            idx = np.round((ph + np.arange(0, times[-1] - ph, p)) / hop_t).astype(int)
            idx = idx[idx < len(env)]
            sc = env[idx].mean()
            if sc > best[0]:
                best = (sc, p, ph)
    _, period, phase = best
    beats = phase + np.arange(0, (times[-1] - phase) / period) * period
    return period, beats


def analyze(song_path):
    TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
    t_rev, T = TL['end']['rev'], TL['T']
    x = load(song_path)
    mono = x.mean(1)
    L = len(mono) / SR
    times, full, low, rms = onset_env(mono)
    # tempo from the full-band onsets, phase biased to the kick (low band) so beats sit on the downbeat side
    def norm(e):
        e = e - signal.medfilt(e, 31)                     # keep transients, drop slow swells
        return np.maximum(e, 0) / (np.percentile(e, 97) + 1e-9)
    comb = norm(full) + 2.0 * norm(low)
    period, beats = tempo_and_beats(times, comb)
    # downbeat: the beat phase (mod 4) with most low-end onset energy
    li = np.clip(np.round(beats / (times[1] - times[0])).astype(int), 0, len(low) - 1)
    ph = int(np.argmax([low[li[k::4]].mean() for k in range(4)]))
    downbeats = beats[ph::4]
    # drop candidates: bars where loudness jumps up after a quieter stretch
    db_ = 20 * np.log10(rms + 1e-9)
    def mean_db(a, b):
        m = (times >= a) & (times < b)
        return db_[m].mean() if m.any() else -120
    cands = []
    for b in downbeats:
        if b < 4 * period or b > L - 4 * period:
            continue
        after = mean_db(b, b + 4 * period)
        before = mean_db(b - 8 * period, b)
        kick = low[min(len(low) - 1, int(round(b / (times[1] - times[0]))))]
        cands.append(dict(t=float(b), score=float(after - before + 0.002 * kick), after=float(after), before=float(before)))
    cands.sort(key=lambda c: -c['score'])
    if os.environ.get('DROP_EXACT'):
        # an exact drop time (seconds into the song), with the beat grid refit locally around it
        drop = float(os.environ['DROP_EXACT'])
        beats = drop + np.arange(-int(drop / period) - 1, int((L - drop) / period) + 1) * period
        downbeats = beats[(np.round((beats - drop) / period).astype(int)) % 4 == 0]
    elif os.environ.get('DROP'):
        want = float(os.environ['DROP'])
        drop = min(beats, key=lambda b: abs(b - want))
    else:
        # prefer a strong drop that lets the song cover the whole video without looping
        good = [c for c in cands[:8] if c['t'] - t_rev >= 0 and c['t'] - t_rev + T <= L]
        drop = (good[0] if good else cands[0])['t']
    if os.environ.get('FIT_VIDEO'):
        # keep the song from its start (or BGM_START) and retime the video instead
        offset = float(os.environ.get('BGM_START', '0'))
        t_rev = drop - offset
    else:
        offset = drop - t_rev                   # song time = video time + offset
    loop = not (offset >= 0 and offset + T <= L)
    bv = beats - offset
    info = dict(song=os.path.abspath(song_path), song_len=L, bpm=60 / period, beat_period=period,
                drop_song=float(drop), offset=float(offset), loop=bool(loop), t_rev=t_rev,
                beats_video=[float(b) for b in bv if -1 < b < T + 4],
                downbeats_video=[float(b - offset) for b in downbeats if -1 < b - offset < T + 4],
                candidates=cands[:8])
    if os.environ.get('SPLICE'):
        # SPLICE="at:lag[:xfade]" -> from video time `at` on, play the song `lag` seconds earlier
        # (e.g. jump back one repeat of the song so the reveal uses the first, better drop)
        sp = []
        for item in os.environ['SPLICE'].split(','):
            p = [float(v) for v in item.split(':')]
            sp.append(dict(at=p[0], lag=p[1], xfade=p[2] if len(p) > 2 else 0.25))
        info['splices'] = sp
    if os.environ.get('FIT_VIDEO'):
        info['target_rev'] = float(t_rev)
        info['own_breakdown'] = True                # the song already goes quiet before its drop
    if loop:
        # loop on whole bars so the beat grid continues seamlessly
        bars = int((L - downbeats[0] - 2) / (4 * period))
        info['loop_start'] = float(downbeats[0]); info['loop_len'] = float(bars * 4 * period)
        lp_ = info['loop_len']
        # constant grid anchored on the drop (the loop keeps whole bars)
        info['beats_video'] = [float(t_rev + k * period) for k in range(-int(t_rev / period) - 1, int((T - t_rev) / period) + 4)]
    os.makedirs(os.path.dirname(SYNC), exist_ok=True)
    json.dump(info, open(SYNC, 'w'), indent=1)
    print('BPM %.1f  drop at %.2fs in song  -> offset %.2fs  loop=%s' % (60 / period, drop, offset, loop))
    for c in cands[:5]:
        print('  candidate drop %.2fs  score %.1f dB' % (c['t'], c['score']))


def read_wav(p):
    w = wave.open(p)
    a = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, w.getnchannels()).astype(np.float64) / 32768
    return a


def mix():
    info = json.load(open(SYNC))
    TL = json.load(open(os.path.join(HERE, 'build', 'timeline.json')))
    T, E = TL['T'], TL['end']
    sfx = read_wav(os.path.join(HERE, 'build', 'sfx.wav'))
    n = len(sfx)
    song = load(info['song'])
    ts = np.arange(n) / SR + info['offset']              # song time for every output sample
    if info['loop']:
        a0, ll = info['loop_start'], info['loop_len']
        ts = np.where(ts < a0, ts, a0 + np.mod(ts - a0, ll))
    def take(ts_):
        i_ = np.clip(np.round(ts_ * SR).astype(int), 0, len(song) - 1)
        ok = (ts_ >= 0) & (ts_ < len(song) / SR)
        return song[i_] * ok[:, None]
    bgm = take(ts)
    t_out = np.arange(n) / SR
    for sp in info.get('splices', []):
        # sample-aligned crossfade into the earlier pass of the song (raised-cosine, gains sum to 1
        # because the two passes are strongly correlated at the splice point)
        a0, a1 = sp['at'] - sp['xfade'] / 2, sp['at'] + sp['xfade'] / 2
        w = np.clip((t_out - a0) / (a1 - a0), 0, 1)
        w = 0.5 - 0.5 * np.cos(np.pi * w)
        ts = np.where(t_out >= a0, ts - sp['lag'], ts)
        bgm = bgm * (1 - w)[:, None] + take(ts) * w[:, None]
        print('splice at %.2fs: jump back %.4fs (xfade %.2fs)' % (sp['at'], sp['lag'], sp['xfade']))
    t = np.arange(n) / SR
    # loudness: bring the music to a steady level under the SFX
    blk = int(0.4 * SR)
    r = np.sqrt(np.mean(bgm[: len(bgm) // blk * blk].reshape(-1, blk, 2) ** 2, axis=(1, 2)))
    level = np.percentile(r[r > 1e-4], 70) if np.any(r > 1e-4) else 1
    bgm *= (0.2 if info.get('native') else 0.225) / level
    # build-up into the drop: low-pass sweep + dip over the thinking pause, full band at the drop
    t0, t1 = E['q'] + 0.6, E['rev']
    m = (t >= t0 - 0.5) & (t < t1)
    if m.any() and not info.get('native') and not info.get('own_breakdown'):
        seg = bgm[m]
        lpd = signal.sosfilt(signal.butter(2, 900, 'low', fs=SR, output='sos'), seg, axis=0)
        u = np.clip((t[m] - (t0 - 0.5)) / 0.5, 0, 1)[:, None]
        bgm[m] = seg * (1 - u) + lpd * u * 0.7
    # ducking under loud SFX
    env = np.abs(sfx).max(1)
    att, rel = math.exp(-1 / (0.005 * SR)), math.exp(-1 / (0.35 * SR))
    e = signal.lfilter([1 - rel], [1, -rel], env)            # release smoothing
    ref = np.percentile(env, 99.5) + 1e-6
    duck = 1 - float(os.environ.get('DUCK', 0.4)) * np.clip(e / ref, 0, 1)
    bgm *= duck[:, None]
    # fades
    bgm *= np.clip(t / 0.8, 0, 1)[:, None] * np.clip((T - t) / 2.5, 0, 1)[:, None]
    out = sfx * 0.9 + bgm
    peak = np.abs(out).max()
    out = np.tanh(out / peak * 1.2) / np.tanh(1.2) * 10 ** (-1 / 20)
    p = os.path.join(HERE, 'build', 'mix.wav')
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    print('wrote', p)


if __name__ == '__main__':
    if sys.argv[1] == 'analyze':
        analyze(sys.argv[2])
    elif sys.argv[1] == 'mix':
        mix()
