#!/usr/bin/env python3
"""Build the Bitcoin daily price series and the full video timeline.

Outputs data/btc_daily.csv and build/timeline.json (consumed by the canvas
renderer and by the SFX synthesiser).
"""
import csv, json, math, os, sys, datetime as dt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 60
D0 = dt.date(2009, 1, 3)          # genesis block = day 0

def day(s):
    return (dt.date.fromisoformat(s) - D0).days

# --------------------------------------------------------------------------
# 1. price series
# --------------------------------------------------------------------------
def load_coinmetrics(path):
    out = {}
    for r in csv.DictReader(open(path)):
        v = r.get('PriceUSD') or r.get('ReferenceRateUSD')
        if v:
            out[r['time']] = float(v)
    return out

def bridge(anchors, rng, vol):
    """log-linear interpolation between (day, price) anchors + Brownian bridge noise."""
    res = {}
    for (d1, p1), (d2, p2) in zip(anchors[:-1], anchors[1:]):
        n = d2 - d1
        steps = rng.normal(0, vol, n)
        walk = np.concatenate([[0], np.cumsum(steps)])
        walk -= np.linspace(0, walk[-1], n + 1)          # pin both ends
        for i in range(n + 1):
            f = i / n
            res[d1 + i] = math.exp(math.log(p1) * (1 - f) + math.log(p2) * f + walk[i])
    return res

def build_series(cm_path):
    cm = load_coinmetrics(cm_path)
    rng = np.random.default_rng(20091003)
    series = {}
    # --- before the first exchange data: widely cited early quotes -------
    early = [('2009-10-05', 0.00076), ('2009-12-30', 0.0011), ('2010-03-17', 0.003),
             ('2010-05-22', 0.0041), ('2010-07-10', 0.0075), ('2010-07-17', 0.07)]
    series.update(bridge([(day(a), p) for a, p in early], rng, 0.03))
    # --- Coin Metrics daily closes -----------------------------------------
    for k, v in cm.items():
        if k >= '2010-07-18':
            series[day(k)] = v
    # --- after the last available close: rebuilt from reported levels -----
    tail = [('2026-05-24', cm['2026-05-24']), ('2026-05-28', 75200), ('2026-05-31', 73580),
            ('2026-06-03', 68000), ('2026-06-05', 59800), ('2026-06-09', 64500),
            ('2026-06-15', 66200), ('2026-06-20', 62500), ('2026-06-24', 59600),
            ('2026-06-27', 57900), ('2026-06-30', 58560), ('2026-07-05', 60200),
            ('2026-07-13', 57200), ('2026-07-20', 60300), ('2026-07-26', 61500),
            ('2026-07-31', 62810), ('2026-08-06', 66500), ('2026-08-12', 70500),
            ('2026-08-19', 74000), ('2026-08-25', 76800), ('2026-08-31', 78550),
            ('2026-09-06', 79800), ('2026-09-12', 81600), ('2026-09-21', 84800),
            ('2026-09-26', 82500), ('2026-09-30', 83550), ('2026-10-07', 86400),
            ('2026-10-14', 82800), ('2026-10-21', 79500), ('2026-10-26', 80800),
            ('2026-10-31', 77430), ('2026-11-05', 74800), ('2026-11-10', 71200),
            ('2026-11-14', 66800), ('2026-11-18', 62400), ('2026-11-20', 58600),
            ('2026-11-21', 55100), ('2026-11-22', 58300), ('2026-11-23', 61130),
            ('2026-11-24', 60200)]
    series.update(bridge([(day(a), p) for a, p in tail], rng, 0.016))
    # --- famous intraday extremes, so the counter hits the numbers people quote
    patches = {'2011-06-08': 31.91, '2011-11-18': 2.01, '2013-12-04': 1150,
               '2015-01-14': 172, '2017-12-17': 19783, '2020-03-12': 3860,
               '2021-04-14': 64800, '2021-11-10': 68990, '2022-11-21': 15500,
               '2024-03-14': 73750, '2024-12-05': 103900, '2025-01-20': 109100,
               '2025-04-07': 74500, '2025-10-06': 126200, '2025-10-10': 105000}
    for k, v in patches.items():
        series[day(k)] = v
    days = sorted(series)
    assert days == list(range(days[0], days[-1] + 1)), 'gap in series'
    return days[0], np.array([series[d] for d in days])

# --------------------------------------------------------------------------
# 2. story: events, chapters
# --------------------------------------------------------------------------
# kind: start | info | milestone | peak | bottom | now
# H = dwell seconds, sb/sa = slowdown width (days) before / after the event
EVENTS = [
    dict(d='2009-01-03', kind='start', title='比特币诞生', sub='中本聪挖出「创世区块」', price='此时还没有价格', H=1.6, sb=4, sa=30),
    dict(d='2009-10-05', kind='info', title='第一个价格', sub='1 美元能买 1309 枚比特币', H=1.5, sb=10, sa=10),
    dict(d='2010-05-22', kind='info', title='比特币披萨日', sub='1 万枚比特币，换了 2 个披萨', H=1.9, sb=8, sa=8),
    dict(d='2010-07-17', kind='milestone', title='5 天暴涨 10 倍', sub='Mt.Gox 交易所即将上线', H=1.3, sb=5, sa=6),
    dict(d='2011-02-09', kind='milestone', title='首次突破 1 美元', sub='和美元平起平坐', H=1.4, sb=8, sa=6),
    dict(d='2011-06-08', kind='peak', title='第一次泡沫', sub='4 个月暴涨 30 倍', H=2.2, sb=10, sa=5),
    dict(d='2011-06-19', kind='info', title='Mt.Gox 被黑客攻击', sub='恐慌抛售开始', H=1.0, sb=3, sa=4),
    dict(d='2011-11-18', kind='bottom', title='跌到 2 美元', sub='第一次崩盘', H=1.9, sb=2, sa=14),
    dict(d='2012-11-28', kind='info', title='第一次减半', sub='挖矿奖励 50 → 25 枚', H=1.2, sb=8, sa=8),
    dict(d='2013-04-09', kind='peak', title='塞浦路斯危机', sub='避险资金涌入，冲上 230 美元', H=1.6, sb=8, sa=4, minor=True),
    dict(d='2013-12-04', kind='peak', title='首次突破 1000 美元', sub='一年涨了 80 多倍', H=2.3, sb=12, sa=6, hold=0.6),
    dict(d='2013-12-05', kind='info', title='央行等五部委发文', sub='防范比特币风险', H=1.2, sb=2, sa=4),
    dict(d='2014-02-24', kind='info', title='Mt.Gox 破产', sub='85 万枚比特币不翼而飞', H=1.4, sb=6, sa=6),
    dict(d='2015-01-14', kind='bottom', title='跌到 172 美元', sub='漫长熊市', H=1.8, sb=2, sa=14),
    dict(d='2016-07-09', kind='info', title='第二次减半', sub='挖矿奖励 25 → 12.5 枚', H=1.2, sb=8, sa=8),
    dict(d='2017-09-14', kind='info', title='国内叫停 ICO', sub='交易所陆续关停', H=1.4, sb=4, sa=6),
    dict(d='2017-12-17', kind='peak', title='历史新高 近 2 万美元', sub='期货上线，全民疯狂', H=2.5, sb=14, sa=6),
    dict(d='2018-12-15', kind='bottom', title='跌到 3200 美元', sub='泡沫破裂', H=1.9, sb=2, sa=14),
    dict(d='2020-03-12', kind='bottom', title='新冠「黑色星期四」', sub='一天暴跌近 50%', H=2.0, sb=1.5, sa=10, flash=True, ddw=2),
    dict(d='2020-05-11', kind='info', title='第三次减半', sub='挖矿奖励 12.5 → 6.25 枚', H=1.1, sb=8, sa=8),
    dict(d='2020-12-16', kind='milestone', title='突破 2 万美元', sub='机构开始入场', H=1.4, sb=8, sa=6),
    dict(d='2021-02-08', kind='info', title='特斯拉买入 15 亿美元', sub='马斯克带货', H=1.4, sb=6, sa=6),
    dict(d='2021-04-14', kind='peak', title='Coinbase 上市', sub='冲上 6.48 万美元', H=1.7, sb=8, sa=5, minor=True),
    dict(d='2021-05-19', kind='info', title='「519」暴跌', sub='监管重拳，矿场清退', H=1.3, sb=3, sa=5),
    dict(d='2021-07-20', kind='bottom', title='跌到 3 万美元', sub='腰斩', H=1.3, sb=2, sa=8, minor=True),
    dict(d='2021-11-10', kind='peak', title='历史新高 6.9 万美元', sub='第二次冲顶', H=2.3, sb=12, sa=6),
    dict(d='2022-05-09', kind='info', title='LUNA 崩盘', sub='一周归零', H=1.4, sb=5, sa=5),
    dict(d='2022-11-21', kind='bottom', title='FTX 暴雷', sub='全球第二大交易所破产', H=2.1, sb=2, sa=14),
    dict(d='2023-03-10', kind='info', title='硅谷银行倒闭', sub='比特币逆势上涨', H=1.2, sb=6, sa=6),
    dict(d='2024-01-10', kind='milestone', title='美国现货 ETF 获批', sub='华尔街正式入场', H=1.6, sb=8, sa=6),
    dict(d='2024-03-14', kind='peak', title='历史新高 7.4 万美元', sub='ETF 疯狂吸筹', H=1.5, sb=8, sa=3, minor=True),
    dict(d='2024-04-20', kind='info', title='第四次减半', sub='挖矿奖励 6.25 → 3.125 枚', H=1.1, sb=6, sa=6),
    dict(d='2024-11-05', kind='info', title='特朗普胜选', sub='承诺打造「加密之都」', H=1.4, sb=6, sa=4),
    dict(d='2024-12-05', kind='peak', title='首次突破 10 万美元', sub='16 年，从 0 到 10 万', H=2.0, sb=10, sa=3),
    dict(d='2025-03-06', kind='info', title='美国战略比特币储备', sub='总统签署行政令', H=1.3, sb=6, sa=4),
    dict(d='2025-04-07', kind='bottom', title='关税风暴', sub='一度跌到 7.4 万', H=1.3, sb=2, sa=6, minor=True),
    dict(d='2025-10-06', kind='peak', title='历史最高 12.6 万美元', sub='比第一个价格涨了 1.6 亿倍', H=3.4, sb=14, sa=6, big=True, hold=0.9),
    dict(d='2025-10-10', kind='info', title='史上最大爆仓', sub='一天爆仓 190 亿美元', H=1.8, sb=1.2, sa=5, flash=True),
    dict(d='2026-02-05', kind='info', title='跌到 6.3 万', sub='三个月跌掉一半', H=1.3, sb=4, sa=5),
    dict(d='2026-06-05', kind='bottom', title='跌破 6 万美元', sub='ETF 资金创纪录流出', H=1.5, sb=2, sa=8, minor=True, ddw=4000),
    dict(d='2026-09-21', kind='info', title='反弹到 8.5 万', sub='资金短暂回流', H=1.2, sb=6, sa=6),
    dict(d='2026-11-21', kind='bottom', title='11 月再次暴跌', sub='ETF 一个月流出近 50 亿美元', H=1.7, sb=2, sa=2.5, ddw=4000),
    dict(d='2026-11-24', kind='now', title='现在', sub='', H=0.0, sb=3, sa=1),
]

# headline at the top of the screen; {..} is highlighted in orange
CHAPTERS = [
    ('2009-01-01', '比特币的{生命线}'),
    ('2009-09-20', '一文不值的{年代}'),
    ('2011-01-20', '第一次{泡沫}'),
    ('2011-06-19', '第一次{崩盘}'),
    ('2012-09-01', '{卷土}重来'),
    ('2013-10-01', '{千元}时代'),
    ('2013-12-12', '漫长的{寒冬}'),
    ('2016-03-01', '{牛市}重启'),
    ('2017-06-01', '{全民}疯狂'),
    ('2017-12-24', '泡沫{破裂}'),
    ('2019-03-01', '熊市{反弹}'),
    ('2020-02-25', '疫情{闪崩}'),
    ('2020-10-01', '{机构}入场'),
    ('2021-05-12', '{监管}重拳'),
    ('2021-09-15', '{二次}冲顶'),
    ('2022-01-01', '连环{暴雷}'),
    ('2023-02-01', '触底{反弹}'),
    ('2023-12-15', '华尔街{入场}'),
    ('2024-10-20', '{十万}美元'),
    ('2025-06-01', '{巅峰}时刻'),
    ('2025-10-10', '又一次{腰斩}'),
]

BASE_SPEED = [  # (date, days per second of video)
    ('2009-01-03', 300), ('2009-09-01', 280), ('2010-04-01', 170), ('2010-08-01', 125),
    ('2012-01-01', 135), ('2013-01-01', 115), ('2014-03-15', 135), ('2014-09-01', 190),
    ('2015-08-01', 190), ('2016-06-01', 150), ('2017-02-01', 120), ('2018-01-15', 190),
    ('2019-01-01', 210), ('2019-12-01', 170), ('2020-03-01', 120), ('2021-12-01', 140),
    ('2022-06-01', 165), ('2023-06-01', 185), ('2023-12-01', 130), ('2025-01-01', 130),
    ('2025-06-01', 120), ('2026-01-01', 120), ('2026-08-01', 110), ('2026-11-24', 90),
]

KY = 300.0          # world units per decade of price (x unit = 1 day)
INTRO = 2.2         # seconds of ECG flatline before the playhead starts moving
OUTRO = 13.0        # seconds after reaching "now"

def build_timeline(first_day, prices):
    last_day = first_day + len(prices) - 1
    Dend = day('2026-11-24')
    assert Dend == last_day
    # -- integrate dt/dD on a fine grid -----------------------------------
    step = 0.05
    Dg = np.arange(0, Dend + step, step)
    kd = np.array([day(a) for a, _ in BASE_SPEED], float)
    kv = np.log(np.array([v for _, v in BASE_SPEED], float))
    base = np.exp(np.interp(Dg, kd, kv)) * 1.3
    dens = 1.0 / base
    for e in EVENTS:
        if e['kind'] == 'info' and e['H'] <= 1.4 and not e.get('_trim'):
            e['H'] = round(e['H'] * 0.88, 2); e['_trim'] = True
        De = day(e['d']); H = e['H']
        if H <= 0:
            continue
        x = Dg - De
        sig = np.where(x < 0, e['sb'], e['sa'])
        # split-normal pdf, integrates to H
        norm = H * 2.0 / (math.sqrt(2 * math.pi) * (e['sb'] + e['sa']))
        dens = dens + norm * np.exp(-0.5 * (x / sig) ** 2)
        if e.get('hold'):                                   # linger right after the event
            dens = dens + e['hold'] / (math.sqrt(2 * math.pi) * 0.45) * np.exp(-0.5 * ((x - 0.1) / 0.45) ** 2)
    # smooth arrival at "now": decelerate to zero
    tg = np.concatenate([[0], np.cumsum((dens[1:] + dens[:-1]) * 0.5 * step)])
    T_run = tg[-1]
    T_total = INTRO + T_run + OUTRO
    nF = int(round(T_total * FPS))
    t = np.arange(nF) / FPS
    # playhead
    trun = np.clip(t - INTRO, 0, T_run)
    D = np.interp(trun, tg, Dg)
    pre = t < INTRO
    u = np.clip(t / INTRO, 0, 1)
    D[pre] = -235.0 * (1 - u[pre]) ** 2.2
    # ease the last 1.2 s so the head glides to a stop exactly at "now"
    for e in EVENTS:
        e['t'] = INTRO + float(np.interp(day(e['d']), Dg, tg))
        e['day'] = day(e['d'])
    t_now = INTRO + T_run
    return dict(t=t, D=D, nF=nF, T_total=T_total, t_now=t_now)

# --------------------------------------------------------------------------
# 3. camera
# --------------------------------------------------------------------------
FOV_Y = math.radians(36)
TANV = math.tan(FOV_Y / 2)
TANH = TANV * 16 / 9

def project_np(Lx, Ly, dist, yaw, pitch, X, Y):
    """same perspective camera as render/scene.js; returns NDC (x right, y up)."""
    sp, cp, sY, cY = math.sin(pitch), math.cos(pitch), math.sin(yaw), math.cos(yaw)
    C = (Lx + dist * sY * cp, Ly + dist * sp, -dist * cY * cp)
    dx, dy, dz = X - C[0], Y - C[1], -C[2]
    zc = dx * -sY * cp + dy * -sp + dz * cY * cp
    xc = dx * cY + dz * sY
    yc = dx * -sY * sp + dy * cp + dz * cY * sp
    return xc / zc / TANH, yc / zc / TANV

def spring(target, dt_, omega, x0=None):
    """critically damped spring follower over a sampled target."""
    x = target[0] if x0 is None else x0
    v = 0.0
    out = np.empty_like(target)
    for i, g in enumerate(target):
        # semi-implicit integration with substeps for stability
        for _ in range(2):
            h = dt_ / 2
            a = omega * omega * (g - x) - 2 * omega * v
            v += a * h
            x += v * h
        out[i] = x
    return out

def smoothstep(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)

def bump(t, t0, rise, hold, fall):
    """0 → 1 → 0 envelope."""
    return smoothstep(t0 - rise, t0, t) * (1 - smoothstep(t0 + hold, t0 + hold + fall, t))

def build_camera(tl, first_day, logp):
    t, D, nF = tl['t'], tl['D'], tl['nF']
    dt_ = 1.0 / FPS
    n = len(logp)
    idx = np.arange(n) + first_day

    def logp_at(d):
        return np.interp(d, idx, logp, left=logp[0])

    # running min / max over a look-back window (in days) for each frame
    lb_days = np.full(nF, 300.0)
    zoom = np.zeros(nF)            # >0 zoom in, <0 zoom out (log scale of dist)
    for e in EVENTS:
        te = e['t']
        if e['kind'] == 'peak':
            k = 0.14 if e.get('minor') else (0.42 if e.get('big') else 0.30)
            zoom += k * bump(t, te, 1.6, 0.25, 0.9)
        elif e['kind'] == 'bottom':
            k = 0.06 if e.get('minor') else 0.12
            zoom -= k * bump(t, te + 0.05, 0.25, 0.4, 1.4)
        elif e['kind'] == 'start':
            zoom += 0.0
    # look-back window (days of history kept in frame)
    lb = np.interp(D, [0, 300, 700, 1200, 2500, 6000], [240, 260, 280, 320, 340, 340])
    t_now = tl['t_now']
    ov = bump(t, t_now + 3.7, 1.7, 1.3, 1.5)            # overview pull-back
    endf = smoothstep(t_now + 5.2, t_now + 7.6, t)

    ymin = np.empty(nF); ymax = np.empty(nF); yh = logp_at(D)
    LA = int(0.35 * FPS)                               # look-ahead
    for i in range(nF):
        j = min(nF - 1, i + LA)
        a = D[j] - lb[i]; b = D[j]
        ia = int(max(0, math.floor(a - first_day))); ib = int(max(0, math.ceil(b - first_day))) + 1
        seg = logp[ia:ib] if ib > ia else logp[ia:ia + 1]
        hy = logp_at(D[j])
        lo = min(seg.min() if len(seg) else hy, hy, yh[i])
        hi = max(seg.max() if len(seg) else hy, hy, yh[i])
        ymin[i] = lo; ymax[i] = hi
    span = np.maximum(ymax - ymin, 0.3)

    yaw = np.radians(20 + 5 * np.sin(t * 2 * math.pi / 23.0))
    pitch = np.radians(-3.0 + 1.5 * np.sin(t * 2 * math.pi / 31.0))
    for e in EVENTS:
        if e['kind'] == 'peak' and not e.get('minor'):
            yaw -= np.radians(7) * bump(t, e['t'], 1.5, 0.3, 1.2)
    yaw = yaw * (1 - endf) + np.radians(12) * endf

    hx = 0.15                                         # head NDC x
    dist_h = lb * np.cos(yaw) / ((hx + 0.95) * TANH) * 0.80
    vis_h = 2 * dist_h * TANV
    sy_t = np.clip(0.58 * vis_h / (span * KY), 0.55, 2.4)
    pre = D < day('2009-10-05')
    sy_t = np.where(pre, 1.0, sy_t)
    sy_t = np.concatenate([sy_t[int(0.6 * FPS):], np.repeat(sy_t[-1], int(0.6 * FPS))])
    sy = np.exp(spring(np.log(sy_t), dt_, 1.6))

    dist = dist_h * np.exp(-zoom)
    dist = np.exp(spring(np.log(dist), dt_, 2.6))

    # vertical framing in log-price units: cl = log price at the look point.
    # World Y is (log p - cl) * KY * sy, so the y-stretch pivots on screen.
    half = dist * TANV / (KY * sy)                     # half visible height, decades
    band_c = 0.05
    c_t = (ymin + ymax) * 0.5 - band_c * half
    hy = (yh - c_t) / half
    hy_c = np.clip(hy, -0.50, 0.40)
    hy_c = np.where(pre, -0.22, hy_c)                 # ECG intro: baseline a bit low
    c_t = yh - hy_c * half
    cl = spring(c_t, dt_, 3.2)
    # hard guard: never let the head leave the frame
    hy2 = np.clip((yh - cl) / half, -0.62, 0.52)
    cl = yh - hy2 * half
    Ly = np.zeros(nF)

    k = hx * TANH
    h = k * dist / (np.cos(yaw) + k * np.sin(yaw) * np.cos(pitch))
    Lx = D - h
    Lx = Lx + endf * h * 0.85                         # final shot: head near centre

    # ---- overview: fit the whole history on screen (numeric fit) ----------
    yaw_o, pitch_o, sy_o = math.radians(24), math.radians(-4), 1.0
    cl_o = 0.5 * (logp.min() + logp.max())
    xs = np.arange(0, n, 4) + first_day
    ys = (logp[::4] - cl_o) * KY * sy_o
    xs = np.append(xs, idx[-1]); ys = np.append(ys, (logp[-1] - cl_o) * KY * sy_o)
    Lxo, Lyo, dso = xs.mean(), ys.mean(), 4000.0
    box = (-0.86, 0.78, -0.50, 0.56)
    for _ in range(60):
        nx, ny = project_np(Lxo, Lyo, dso, yaw_o, pitch_o, xs, ys)
        sc = max((nx.max() - nx.min()) / (box[1] - box[0]), (ny.max() - ny.min()) / (box[3] - box[2]))
        dso *= sc ** 0.7
        Lxo += ((nx.max() + nx.min()) / 2 - (box[0] + box[1]) / 2) * dso * TANH * 0.6
        Lyo += ((ny.max() + ny.min()) / 2 - (box[2] + box[3]) / 2) * dso * TANV * 0.6
    o = ov
    Lx = Lx * (1 - o) + Lxo * o
    Ly = Ly * (1 - o) + Lyo * o
    cl = cl * (1 - o) + cl_o * o
    dist = np.exp(np.log(dist) * (1 - o) + math.log(dso) * o)
    sy = np.exp(np.log(sy) * (1 - o) + math.log(sy_o) * o)
    yaw = yaw * (1 - o) + yaw_o * o
    pitch = pitch * (1 - o) + pitch_o * o

    # shake / roll at impacts
    shx = np.zeros(nF); shy = np.zeros(nF); roll = np.zeros(nF)
    rs = np.random.default_rng(7)
    noise_x = rs.normal(0, 1, nF); noise_y = rs.normal(0, 1, nF)
    # smooth the noise a bit (keeps shake from looking like jitter)
    ker = np.exp(-0.5 * (np.arange(-4, 5) / 1.8) ** 2); ker /= ker.sum()
    noise_x = np.convolve(noise_x, ker, 'same') * 2.2
    noise_y = np.convolve(noise_y, ker, 'same') * 2.2
    for e in EVENTS:
        if e['kind'] == 'bottom' or e.get('flash'):
            amp = 10 if e.get('minor') else 22
            if e.get('flash'):
                amp = 26
            env = np.where(t >= e['t'], np.exp(-(t - e['t']) * 4.0), 0.0)
            shx += amp * env * noise_x
            shy += amp * env * noise_y
            roll += np.radians(1.2 if not e.get('minor') else 0.5) * env * np.sin((t - e['t']) * 26)
    return dict(Lx=Lx, Ly=Ly, dist=dist, yaw=yaw, pitch=pitch, roll=roll,
                sy=sy, shx=shx, shy=shy, ov=ov, endf=endf, cl=cl)

# --------------------------------------------------------------------------
def main():
    cm = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'data', 'coinmetrics_btc.csv')
    first_day, prices = build_series(cm)
    os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
    os.makedirs(os.path.join(HERE, 'build'), exist_ok=True)
    with open(os.path.join(HERE, 'data', 'btc_daily.csv'), 'w') as f:
        f.write('date,price_usd\n')
        for i, p in enumerate(prices):
            f.write('%s,%.6g\n' % ((D0 + dt.timedelta(days=first_day + i)).isoformat(), p))
    logp = np.log10(prices)
    tl = build_timeline(first_day, prices)
    cam = build_camera(tl, first_day, logp)

    # running ATH (for drawdown display)
    ath = np.maximum.accumulate(prices)
    # trend colour 0=up(orange) .. 1=down(red), from smoothed 6-day log return
    r = np.zeros_like(logp)
    r[6:] = logp[6:] - logp[:-6]
    r = np.convolve(r, np.ones(3) / 3, 'same')
    col = np.clip(-(r + 0.012) / 0.09, 0, 1)

    # events: attach price / drawdown info
    evs = []
    for e in EVENTS:
        i = max(0, e['day'] - first_day)
        ev = dict(e)
        ev['price'] = e.get('price') or None
        ev['p'] = float(prices[i]) if e['day'] >= first_day else None
        ev['ath'] = float(ath[i]) if e['day'] >= first_day else None
        if e['kind'] == 'bottom':
            # peak that this bottom is measured from: previous running ATH
            # for minor bottoms use the max of the preceding 200 days
            lo = max(0, i - e.get('ddw', 200 if e.get('minor') else 4000))
            pk = int(lo + np.argmax(prices[lo:i + 1]))
            ev['peak_day'] = pk + first_day
            ev['peak_p'] = float(prices[pk])
            ev['dd'] = float(prices[i] / prices[pk] - 1)
        if e['kind'] == 'peak':
            j = i
            while j < len(prices) - 1 and prices[j] > 0.92 * prices[i]:
                j += 1
            ev['break_day'] = j + first_day
            ev['t_break'] = float(np.interp(j + first_day, tl['D'], tl['t']))
        evs.append(ev)
    # card appearance times, spaced at least 1 s apart so cards never pop together
    last = -9
    for ev in evs:
        lead = {'peak': 0.08, 'bottom': 0.02}.get(ev['kind'], 0.3)
        ev['ta'] = max(ev['t'] - lead, last + 1.0)
        last = ev['ta']
    chapters = [dict(day=day(a), text=s) for a, s in CHAPTERS]
    for c in chapters:
        c['t'] = float(np.interp(c['day'], tl['D'], tl['t']))
    years = []
    for y in range(2009, 2027):
        dy = day('%d-01-01' % y)
        if dy < 0:
            dy = 0
        years.append(dict(year=y, day=dy, t=float(np.interp(dy, tl['D'], tl['t']))))

    rails = []
    for k in range(-4, 6):
        hit = np.nonzero(logp >= k)[0]
        rails.append(dict(k=k, day=int(hit[0] + first_day) if len(hit) else None,
                          t=float(np.interp(hit[0] + first_day, tl['D'], tl['t'])) if len(hit) else None))
    out = dict(rails=rails, 
        fps=FPS, nF=tl['nF'], T=tl['T_total'], t_now=tl['t_now'], intro=INTRO,
        KY=KY, fovY=FOV_Y, first_day=int(first_day), D0=D0.isoformat(),
        logp=[round(float(v), 5) for v in logp],
        col=[round(float(v), 3) for v in col],
        ath=[round(float(v), 4) for v in ath],
        events=evs, chapters=chapters, years=years,
        frames={k: [round(float(v), 4) for v in a] for k, a in
                dict(D=tl['D'], **cam).items()},
    )
    with open(os.path.join(HERE, 'build', 'timeline.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('frames', tl['nF'], 'duration %.2fs' % tl['T_total'], 't_now %.2f' % tl['t_now'])
    for e in evs:
        print('%6.2fs  %s  %-6s %s' % (e['t'], e['d'], e['kind'], e['title']))

if __name__ == '__main__':
    main()
