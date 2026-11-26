#!/usr/bin/env python3
"""Data + timeline for the gold video.  Writes build/timeline.json.

Price series (USD/oz and CNY/g, daily, 2023-01-01 -> 2026-11-25):
  * 2024-03-02 -> 2026-11-25: daily XAU snapshots from the @fawazahmed0/currency-api npm
    package (one package version per day; data/xau_daily_npm.txt = date usd/oz cny/oz).
  * 2023-01-01 -> 2024-03-01: no daily feed was reachable from the build machine, so the series
    is rebuilt from widely reported closes (anchors below) and the monthly averages in
    data/gold_monthly.csv, with small deterministic noise between anchors. Approximate.
  * USD/CNY for that early stretch: data/usdcny_daily.csv (FRED DEXCHUS via datasets/exchange-rates).
Well-known intraday records replace the daily close on those days so the labels match what
people quote ($5,595.41 on 2026-01-29).
"""
import json, math, os
from datetime import date, timedelta
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OZ = 31.1034768
FPS = 60

# ------------------------------------------------------------------ data
def d(s):
    return date.fromisoformat(s)

npm = {}
for line in open(os.path.join(HERE, 'data', 'xau_daily_npm.txt')):
    ds, usd, cny = line.split()
    npm[d(ds)] = (float(usd), float(cny) / OZ)

fx = {}
for line in open(os.path.join(HERE, 'data', 'usdcny_daily.csv')):
    ds, _, v = line.strip().split(',')
    if v:
        fx[d(ds)] = float(v)

# 2023-01 -> 2024-03 anchors (USD/oz, approximate daily closes)
ANCHORS_EARLY = [
    ('2023-01-02', 1826), ('2023-01-26', 1946), ('2023-02-01', 1951), ('2023-02-03', 1865),
    ('2023-02-28', 1827), ('2023-03-08', 1814), ('2023-03-10', 1868), ('2023-03-17', 1989),
    ('2023-03-20', 1978), ('2023-04-03', 1985), ('2023-04-13', 2040), ('2023-04-19', 1994),
    ('2023-05-04', 2050), ('2023-05-17', 1981), ('2023-05-30', 1959), ('2023-06-23', 1921),
    ('2023-06-29', 1908), ('2023-07-20', 1977), ('2023-08-21', 1895), ('2023-09-01', 1940),
    ('2023-09-20', 1930), ('2023-10-05', 1820), ('2023-10-13', 1932), ('2023-10-27', 2006),
    ('2023-11-13', 1946), ('2023-11-28', 2041), ('2023-12-01', 2072), ('2023-12-04', 2029),
    ('2023-12-13', 1981), ('2023-12-27', 2077), ('2024-01-17', 2006), ('2024-02-14', 1992),
    ('2024-03-01', 2083),
]


def fx_at(day):
    for k in range(10):
        if day - timedelta(k) in fx:
            return fx[day - timedelta(k)]
    return 7.0


def build_series():
    start, end = d('2023-01-01'), max(npm)
    days = [start + timedelta(k) for k in range((end - start).days + 1)]
    rng = np.random.default_rng(2023)
    a_t = np.array([(d(s) - start).days for s, _ in ANCHORS_EARLY], float)
    a_v = np.log([v for _, v in ANCHORS_EARLY])
    out = []
    noise = 0.0
    for i, day in enumerate(days):
        if day in npm:
            usd, cny = npm[day]
        else:
            if day >= d('2024-03-02'):            # one missing day in the feed: carry forward
                usd, cny = out[-1][1], out[-1][2]
            else:
                noise = 0.82 * noise + rng.normal(0, 0.0032)
                # pinned to zero at anchors so the quoted closes stay exact
                dist = np.min(np.abs(a_t - i))
                usd = float(np.exp(np.interp(i, a_t, a_v) + noise * min(1, dist / 4)))
                cny = usd * fx_at(day) / OZ
        out.append((day.isoformat(), usd, cny))
    return out


SER = build_series()
OVERRIDE = {'2026-01-29': 5595.41}                 # intraday all-time high (spot)
SER = [(s, OVERRIDE.get(s, u), c * OVERRIDE[s] / u if s in OVERRIDE else c) for s, u, c in SER]
IDX = {s: k for k, (s, _, _) in enumerate(SER)}
PEAK = max(SER, key=lambda r: r[1])
NOW = SER[-1]

# ------------------------------------------------------------------ beat grid (We Never)
# Analysed with ../bitcoin/bgm.py onset tools: 112.8 BPM, the first drop at 17.403 s.
BEAT = 0.5319
SONG_DROP = 17.403
HOOK_BEATS_BEFORE_DROP = 6                        # start at the song's breakdown (low end drops out)
SONG_START = SONG_DROP - HOOK_BEATS_BEFORE_DROP * BEAT
DROP = HOOK_BEATS_BEFORE_DROP * BEAT              # video time of the drop  (3.191 s)


def bt(n):                                        # video time of beat n relative to the drop
    return DROP + n * BEAT


HOOK = dict(
    drop=DROP, beat=BEAT,
    peakTag=bt(-2),          # "历史最高" callout pops
    crashEnd=bt(3),          # line has fallen to today
    badge=bt(2),             # -40% badge
    title=bt(0),             # 黄金暴跌
    question=bt(4),          # 现在还能买吗？
    sub=bt(6),               # 抄底 还是 接飞刀
    rewind=bt(8),            # time rewinds to 2023
    y2023=bt(12),            # "2023" slam
)
T = bt(12) + 1.25
nF = int(round(T * FPS))

TL = dict(
    fps=FPS, nF=nF, T=T, W=1920, H=1080,
    series=dict(date=[r[0] for r in SER], usd=[round(r[1], 2) for r in SER], cny=[round(r[2], 2) for r in SER]),
    peak=dict(date=PEAK[0], usd=PEAK[1], cny=round(PEAK[2], 1), i=IDX[PEAK[0]]),
    now=dict(date=NOW[0], usd=NOW[1], cny=round(NOW[2], 1), i=len(SER) - 1),
    start=dict(date=SER[0][0], usd=SER[0][1], cny=round(SER[0][2], 1)),
    hook=HOOK,
    bgm=dict(song_start=SONG_START, song_drop=SONG_DROP, beat=BEAT,
             beats=[bt(n) for n in range(-HOOK_BEATS_BEFORE_DROP, 40) if bt(n) < T + 1]),
)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
json.dump(TL, open(os.path.join(HERE, 'build', 'timeline.json'), 'w'))
dd_usd = NOW[1] / PEAK[1] - 1
dd_cny = NOW[2] / PEAK[2] - 1
print('series %s -> %s (%d days)' % (SER[0][0], NOW[0], len(SER)))
print('peak %s  $%.2f  ¥%.1f/g' % (PEAK[0], PEAK[1], PEAK[2]))
print('now  %s  $%.2f  ¥%.1f/g   drawdown usd %.1f%%  cny %.1f%%' % (NOW[0], NOW[1], NOW[2], dd_usd * 100, dd_cny * 100))
print('song start %.3f s, drop at video %.3f s, T=%.2f s, %d frames' % (SONG_START, DROP, T, nF))
print({k: round(v, 3) for k, v in HOOK.items()})
