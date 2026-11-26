# 黄金暴跌，现在还能买吗？· Gold crash video

1920×1080 / 60 fps, 2:39. The music is 《We Never》 from 8.89 s into the song to its end, with one
8-bar chorus phrase cut (song bars 24–32, spliced where the song repeats itself, waveform correlation
0.93, 25 ms crossfade). Every cut, card and hit sits on the beat grid (112.8 BPM). In the mix the
effects sit 2 dB lower and the music 2 dB higher than before, with lighter ducking (20%).

- `output/gold_full.mp4`: the full video.
- `output/gold_hook_fx.mp4`: the approved opening on its own.

| video | content |
|---|---|
| 0:00–0:17 | the hook (storyboard below) |
| 0:17–0:53 | 2023 → 2026 on the daily ¥/克 chart: 20 dated events, chapter titles, slams |
| 0:53–1:08 | today: ¥756/克 ≈ $3,525/盎司 (×31.1035 ÷ 6.67); 「现在，可以入场了吗？」; 「先别急。」; 「让我们看看：每次暴跌之后，多久才回本？」; rewind to 1971 |
| 1:08–1:42 | log-scale $ chart since 1971: the crashes of 1974, 1980 (its bubble bursts on the second drop), 2008, 2011, 2020 and 2026, each with its drawdown and a big 「回本用了 N 年」 card |
| 1:42–1:51 | summary table of all six, held for four bars |
| 1:51–2:20 | leverage as slides, one line at a time: 本金 1 万 + 借 9 万 = 10 万仓位; +10% doubles it; −10% (¥1,000 → ¥900) wipes it out; 「再给我一点时间」; the lender won't carry the risk; 强制平仓; 越卖越跌，越跌越卖 → 踩踏式下跌 |
| 2:20–2:30 | 所以，现在能买吗？ three takeaways |
| 2:30–2:39 | 「不要问能不能买，要问问自己：下跌的时候，能不能拿得住？」 on its own screen |

## Hook storyboard (beat-synced to 《We Never》, 112.8 BPM)

The song starts 4 bars before its first drop (8.89 s into the song, the second half of its
intro phrase) with a short full-band fade-in, so the bubble bursts on the drop (17.40 s into the
song) at 8.51 s in the video. During the rewind the music keeps playing forward.

| video time | beat | what happens |
|---|---|---|
| 0.00 | −16 | wide shot dollies in; 「黄金，一路狂飙」; the line climbs from Jul 2024 |
| 1.06 … 5.85 | −14 −12 −10 −8 −6 −5 | breaks ¥600 / 650 / 700 / 800 / 900 / 1,000 exactly on the beat (rail flash, 「突破」, chime, zoom kick) |
| 6.38 | −4 | ¥1,100 — **slow motion**: the last six days to the top take two beats, effects run at 1/4 speed, the camera pushes in and orbits, music low-passes, a heartbeat on every beat |
| 7.45 | −2 | 历史最高 ¥1,250/克 · $5,595/盎司 (2026-01-29): rays, ring, card |
| **8.51** | **drop** | bubble bursts back to real time: glass + impact, camera blown back, 「黄金暴跌」, the line falls for four beats |
| 10.64 | +4 | landing punch-in: −39.5% · 不到 10 个月，从 ¥1,250 跌到 ¥756 |
| 12.77 / 13.83 | +8 / +10 | 「现在，还能买吗？」 / 抄底，还是接飞刀？ |
| 14.89 | +12 | 让我们把时间倒回: the camera flies back along the line |
| 17.02 | +16 | 「2023 · 这一轮大涨，要从这一年说起」 |

## Build

```bash
./fetch_fonts.sh                                    # SIL OFL fonts, not committed
BGM=/path/to/we_never.m4a THEME=full ./build.sh     # -> output/gold_full.mp4 (FULL=1 timeline)
BGM=/path/to/we_never.m4a THEME=fx ./build.sh       # -> output/gold_hook_fx.mp4 (opening only)
```

`render/full.js` is assembled by `assemble.sh` from `render/parts/`:
`head.js` (helpers, palette, type), `data.js` (datasets, beat-locked head paths, the spring camera
tracks), `chart.js` (the 3D chart: line, glow, particles, bubbles), `ui_timeline.js`, `ui_history.js`,
`scenes2d.js` (leverage, inflation, outro) and `main.js` (frame loop, boot).
`render_range.sh START END` re-renders only a frame range when a change doesn't touch earlier frames.

`THEME=lux` is the current look (ivory studio light, metallic gold, deep emerald for falls,
serif type). `cream`, `sun` and `blue` are the earlier drafts in `render/scene.js`.
The BGM is not committed: it is the user's own copy of a copyrighted track.

## Data

- History: monthly averages since 1970 from `data/gold_monthly.csv` (github.com/datasets/gold-prices),
  with the commonly quoted extremes put back in: $195 (1974-12-30), $104 (1976-08-25), $850 (1980-01-21),
  $297 (1982-06), $253 (1999-07-20), $1,011 (2008-03-17), $713 (2008-10-24), $1,921 (2011-09-06),
  $1,046 (2015-12-17), $2,075 (2020-08-07), $1,615 (2022-09-28). Recovery = first time the old high
  was regained: 1978-07, 2008-01, 2009-10, 2020-07, 2023-12.
- Inflation: US CPI-U from `data/cpi_us_monthly.csv` (github.com/datasets/cpi-us), to 2026-09.
  $850 × CPI(2025-04) / CPI(1980-01) ≈ $3,505, which gold first reached on 2025-04-22.

- 2024-03-02 → 2026-11-25: daily XAU/USD and XAU/CNY snapshots from the
  `@fawazahmed0/currency-api` npm package (`data/xau_daily_npm.txt`).
- 2023-01 → 2024-03: rebuilt from reported closes and monthly averages (`prep.py`), approximate.
- The 2026-01-29 point uses the reported intraday record of $5,595.41.
- CNY per gram = USD/oz × USD/CNY ÷ 31.1035.

Not investment advice.
