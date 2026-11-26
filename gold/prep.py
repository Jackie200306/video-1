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
HOOK_BEATS_BEFORE_DROP = 16                       # 4 bars: the second half of the song's intro phrase
SONG_START = SONG_DROP - HOOK_BEATS_BEFORE_DROP * BEAT
DROP = HOOK_BEATS_BEFORE_DROP * BEAT              # video time of the drop  (3.191 s)


def bt(n):                                        # video time of beat n relative to the drop
    return DROP + n * BEAT


HOOK = dict(
    drop=DROP, beat=BEAT,
    peakTag=bt(-2),          # "历史最高" callout pops
    slowmo=bt(-4),           # slow motion from ¥1,100 into the high, until the burst
    crashEnd=bt(4),          # line has fallen to today
    badge=bt(3),             # -40% badge
    title=bt(0),             # 黄金暴跌
    question=bt(8),          # 现在还能买吗？ (one bar to read the fall)
    sub=bt(10),              # 抄底 还是 接飞刀
    rewind=bt(12),           # time rewinds to 2023
    y2023=bt(16),            # "2023" slam
)
# the climb is choreographed on the beat: each round-number level is crossed on a beat
def first_cross(level, after='2024-07-01'):
    for k in range(IDX[after], len(SER)):
        if SER[k][2] >= level:
            return SER[k][0]
CLIMB = [(-16, '2024-07-01', None)] + [(n, first_cross(l), l) for n, l in ((-14, 600), (-12, 650), (-10, 700), (-8, 800), (-6, 900), (-5, 1000), (-4, 1100))] + [(-2, PEAK[0], 1200)]
HOOK['climb'] = [dict(t=bt(n), date=dd, i=IDX[dd], level=l) for n, dd, l in CLIMB]
T = bt(16) + 1.7

# ================================================================== full video (FULL=1)
FULL = os.environ.get('FULL') == '1'
BAR = 4 * BEAT
SONG_BAR0 = SONG_DROP - 8 * BAR                   # song time of the song's first downbeat (bar 0)
SONG_LEN = 185.351


def VB(bar, beat=0.0):                            # video time of song bar `bar` (+ beats)
    return SONG_BAR0 + bar * BAR + beat * BEAT - SONG_START


EXTRA = {}
if FULL:
    T = SONG_LEN - SONG_START                     # to the end of the song
    # ---- 2023 -> 2026 timeline: (date, bar, kind, title, sub). The head reaches each date on its bar.
    EV = [
        ('2023-02-01', 13, 'info', '美联储继续加息', '利率升至 4.5%–4.75%，金价承压'),
        ('2023-03-10', 14, 'shock', '硅谷银行倒闭', '银行业危机，资金涌入黄金避险'),
        ('2023-07-26', 15.5, 'info', '美联储最后一次加息', '利率 5.25%–5.5%，22 年来最高'),
        ('2023-10-07', 16.5, 'shock', '巴以冲突爆发', '避险情绪升温，一个月涨约 10%'),
        ('2024-03-04', 18, 'milestone', '突破历史高点', '各国央行持续买金，主升浪开启'),
        ('2024-04-12', 19, 'shock', '中东局势升级', '伊朗、以色列互相袭击，金价冲上 $2,400'),
        ('2024-09-18', 20.5, 'info', '美联储首次降息', '一次降 50 个基点，降息周期开启'),
        ('2024-11-06', 21.5, 'dip', '特朗普胜选', '美元走强，金价回调约 8%'),
        ('2025-03-14', 23, 'milestone', '首次突破 $3,000', '关税阴云下，避险资金涌入'),
        ('2025-04-02', 24, 'shock', '“解放日”关税', '全球市场恐慌，三周后冲上 $3,500'),
        ('2025-09-17', 26, 'info', '美联储重启降息', '金价突破 $3,700'),
        ('2025-10-08', 27, 'milestone', '首次突破 $4,000', '涨势越来越陡'),
        ('2025-10-21', 27.5, 'crash', '单日暴跌 6%', '12 年来最大单日跌幅，随后又涨了回来'),
        ('2026-01-26', 29.5, 'milestone', '首次突破 $5,000', '市场担忧美联储独立性，资金疯狂涌入'),
        ('2026-01-29', 30, 'peak', '历史最高', '1 月一个月就涨了近 30%'),
        ('2026-01-30', 30.5, 'crash', '特朗普提名沃什任美联储主席', '市场押注更鹰派，单日暴跌约 9%'),
        ('2026-02-28', 31.5, 'shock', '美伊开战', '油价破百，美元走强，黄金不涨反跌'),
        ('2026-05-22', 33, 'info', '沃什就任美联储主席', '通胀走高，降息希望落空'),
        ('2026-08-24', 34, 'bounce', '短暂反弹', '通胀数据降温，8 月涨约 10%'),
        ('2026-09-16', 35, 'crash', '美联储三年来首次加息', '利率升至 3.75%–4%'),
        ('2026-10-30', 36, 'crash', '全球股市大跌', '投资者卖黄金补保证金'),
        ('2026-11-25', 37, 'crash', '通胀超预期，加息预期升温', '跌破 $3,500，一年多来最低'),
    ]
    events = []
    for ds_, b, k, title, sub in EV:
        i = IDX[ds_]
        events.append(dict(date=ds_, i=i, t=VB(b), kind=k, title=title, sub=sub,
                           usd=SER[i][1], cny=round(SER[i][2], 1)))
    keys = [dict(t=VB(12), i=0)] + [dict(t=e['t'], i=e['i']) for e in events]
    chapters = [dict(t=VB(13) - 0.3, text='2023 · {加息风暴}'), dict(t=VB(18) - 0.3, text='2024 · {央行抢金}'),
                dict(t=VB(22.5) - 0.3, text='2025 · {一路狂飙}'), dict(t=VB(29) - 0.3, text='2026 · {疯狂的顶点}'),
                dict(t=VB(30.5), text='{泡沫破裂}'), dict(t=VB(37), text='{现在}')]
    EXTRA['timeline'] = dict(t0=VB(12), t1=VB(37), events=events, keys=keys, chapters=chapters)
    # ---- now: price in both units, then the question
    EXTRA['nowsec'] = dict(card=VB(37), overview=VB(38), convert=VB(38.5), question=VB(40), sub=VB(41.5),
                        rewind=VB(43), cut=VB(44), fx=round(NOW[2] * OZ / NOW[1], 4), oz=OZ)
    # ---- history (USD/oz, monthly averages since 1970 plus well-known extremes and the daily feed)
    D0 = d(SER[0][0])
    mon = []
    for line in open(os.path.join(HERE, 'data', 'gold_monthly.csv')):
        if line.startswith('Date'):
            continue
        ym, v = line.strip().split(',')
        if '1970-01' <= ym <= '2024-02':
            mon.append((d(ym + '-15'), float(v)))
    EXT = [('1974-12-30', 195.25), ('1976-08-25', 103.50), ('1980-01-21', 850.0), ('1982-06-21', 297.0),
           ('1999-07-20', 252.80), ('2008-03-17', 1011.25), ('2008-10-24', 712.50), ('2011-09-06', 1921.0),
           ('2015-12-17', 1046.0), ('2020-08-07', 2075.0), ('2022-09-28', 1615.0)]
    pts = {dd: v for dd, v in mon}
    for dd, v in EXT:
        pts[d(dd)] = v
    for k in range(IDX['2024-03-02'], len(SER), 4):
        pts[d(SER[k][0])] = SER[k][1]
    pts[d(PEAK[0])] = PEAK[1]; pts[d(NOW[0])] = NOW[1]
    hx = sorted(pts.items())
    EXTRA['hist'] = dict(x=[(a - D0).days for a, _ in hx], usd=[round(v, 2) for _, v in hx],
                         date=[a.isoformat() for a, _ in hx])
    X = lambda dd: (d(dd) - D0).days
    CR = [
        dict(n=1, label='1974', peak=('1974-12-30', 195), low=('1976-08-25', 104), rec='1978-07-28',
             title='第 1 次 · 1974', sub='美国放开私人买金，金价见顶后腰斩'),
        dict(n=2, label='1980', peak=('1980-01-21', 850), low=('1999-07-20', 253), rec='2008-01-02', mid=('1982-06-21', 297),
             title='第 2 次 · 1980', sub='高通胀叠加地缘危机冲到 $850，美联储把利率加到 20%，泡沫破裂'),
        dict(n=3, label='2008', peak=('2008-03-17', 1011), low=('2008-10-24', 713), rec='2009-10-06',
             title='第 3 次 · 2008', sub='金融危机，机构卖黄金补保证金'),
        dict(n=4, label='2011', peak=('2011-09-06', 1921), low=('2015-12-17', 1046), rec='2020-07-27', mid=('2013-04-15', 1348),
             title='第 4 次 · 2011', sub='欧债危机见顶，美联储退出 QE，2013 年 4 月两天暴跌 13%'),
        dict(n=5, label='2020', peak=('2020-08-07', 2075), low=('2022-09-28', 1615), rec='2023-12-04',
             title='第 5 次 · 2020', sub='疫情放水冲上 $2,075，2022 年美联储暴力加息'),
        dict(n=6, label='2026', peak=(PEAK[0], round(PEAK[1])), low=(NOW[0], round(NOW[1])), rec=None,
             title='第 6 次 · 2026（现在）', sub='这一次，要多久才能回本？'),
    ]
    # head path (bar -> date) through the crashes; the 1980 bubble bursts on the second drop (bar 48)
    HK2 = [(44, '1971-08-15'), (44.75, '1974-12-30'), (45.25, '1976-08-25'), (45.75, '1978-07-28'),
           (47.25, '1980-01-21'), (48, '1980-01-22'), (49, '1982-06-21'), (50.25, '1999-07-20'), (51.5, '2008-01-02'),
           (53, '2008-03-17'), (53.5, '2008-10-24'), (54.25, '2009-10-06'), (55.5, '2011-09-06'), (56.25, '2013-04-15'),
           (57, '2015-12-17'), (58.25, '2020-07-27'), (59.5, '2020-08-07'), (60.25, '2022-09-28'), (61, '2023-12-04'),
           (62.25, PEAK[0]), (62.75, NOW[0])]
    tmap = {dd: VB(b) for b, dd in HK2}
    for c in CR:
        c['peak_x'], c['low_x'] = X(c['peak'][0]), X(c['low'][0])
        c['t_peak'], c['t_low'] = tmap[c['peak'][0]], tmap[c['low'][0]]
        c['dd'] = {1: -47, 2: -70, 3: -30, 4: -45, 5: -22, 6: -37}[c['n']]      # as commonly quoted
        if c.get('mid'):
            c['mid_x'], c['t_mid'] = X(c['mid'][0]), tmap[c['mid'][0]]
        if c['rec']:
            c['rec_x'], c['t_rec'] = X(c['rec']), tmap[c['rec']]
            c['years'] = round((d(c['rec']) - d(c['peak'][0])).days / 365.25, 1)
            c['ylabel'] = {1: '3.5 年', 2: '28 年', 3: '1.5 年', 4: '9 年', 5: '3.3 年'}[c['n']]
    EXTRA['history'] = dict(t0=VB(44), t1=VB(64.5), keys=[dict(t=VB(b), x=X(dd)) for b, dd in HK2], crashes=CR,
                            intro=dict(t=VB(44), x=X('1971-08-15')), table=VB(63.25), breakdown=VB(47.25), drop=VB(48), bubble=VB(46.1))
    # ---- leverage explainer, inflation, outro (2D scenes), all on the bar grid
    EXTRA['lev'] = dict(t0=VB(64.5), title=VB(64.5), example=VB(65.5), fall=VB(66.5), boom=VB(67.25), cascade=VB(68),
                        loop=VB(70.25), t1=VB(72))
    cpi = {}
    for line in open(os.path.join(HERE, 'data', 'cpi_us_monthly.csv')):
        if line.startswith('Date'):
            continue
        a, b, _ = line.strip().split(',')
        if a >= '1971-01':
            cpi[a[:7]] = float(b)
    gm = {}
    for line in open(os.path.join(HERE, 'data', 'gold_monthly.csv')):
        if not line.startswith('Date'):
            ym, v = line.strip().split(',')
            gm[ym] = float(v)
    months = sorted(k for k in cpi if k <= '2026-09')
    gold_m = [35.0 if k < '1971-08' else gm.get(k) for k in months]
    last_g = NOW[1]
    gold_m = [g if g else last_g for g in gold_m]
    EXTRA['infl'] = dict(t0=VB(72), title=VB(72), chart=VB(72.5), labels=VB(75), real=VB(75.5), t1=VB(78),
                         months=months, cpi=[cpi[k] for k in months], gold=gold_m, gold_now=NOW[1],
                         cpi_1980=cpi['1980-01'], cpi_now=cpi[months[-1]])
    EXTRA['outro'] = dict(t0=VB(78), q=VB(78), p1=VB(79), p2=VB(80), p3=VB(81), cta=VB(83), fade=T - 3.0)
    print('full: T=%.2f s; timeline %.2f-%.2f, now->hist cut %.2f, lev %.2f, infl %.2f, outro %.2f' %
          (T, VB(12), VB(37), VB(44), VB(64), VB(72), VB(78)))
    for c in CR:
        print('  crash %s  %s -> %s  %d%%  rec %s (%s y)' % (c['label'], c['peak'], c['low'], c['dd'], c['rec'], c.get('years')))
nF = int(round(T * FPS))

TL = dict(
    fps=FPS, nF=nF, T=T, W=1920, H=1080,
    series=dict(date=[r[0] for r in SER], usd=[round(r[1], 2) for r in SER], cny=[round(r[2], 2) for r in SER]),
    peak=dict(date=PEAK[0], usd=PEAK[1], cny=round(PEAK[2], 1), i=IDX[PEAK[0]]),
    now=dict(date=NOW[0], usd=NOW[1], cny=round(NOW[2], 1), i=len(SER) - 1),
    start=dict(date=SER[0][0], usd=SER[0][1], cny=round(SER[0][2], 1)),
    hook=HOOK,
    bgm=dict(song_start=SONG_START, song_drop=SONG_DROP, beat=BEAT,
             beats=[bt(n) for n in range(-HOOK_BEATS_BEFORE_DROP, 400) if bt(n) < T + 1]),
    full=FULL, **EXTRA,
)
os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
json.dump(TL, open(os.path.join(HERE, 'build', 'timeline.json'), 'w'))
dd_usd = NOW[1] / PEAK[1] - 1
dd_cny = NOW[2] / PEAK[2] - 1
print('series %s -> %s (%d days)' % (SER[0][0], NOW[0], len(SER)))
print('peak %s  $%.2f  ¥%.1f/g' % (PEAK[0], PEAK[1], PEAK[2]))
print('now  %s  $%.2f  ¥%.1f/g   drawdown usd %.1f%%  cny %.1f%%' % (NOW[0], NOW[1], NOW[2], dd_usd * 100, dd_cny * 100))
print('song start %.3f s, drop at video %.3f s, T=%.2f s, %d frames' % (SONG_START, DROP, T, nF))
print({k: round(v, 3) for k, v in HOOK.items() if not isinstance(v, list)})
