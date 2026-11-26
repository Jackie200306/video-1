# 黄金暴跌，现在还能买吗？· Gold crash video (work in progress)

1920×1080 / 60 fps. So far only the opening hook (~10.8 s) is built:
`output/gold_hook_lux.mp4`.

## Hook storyboard (beat-synced to 《We Never》, 112.8 BPM)

| video time | beat | what happens |
|---|---|---|
| 0.00 | song 14.21 s (breakdown) | gold line climbs from Aug 2025; a glass bubble inflates around the price |
| 2.13 | −2 | the peak: 历史最高 ¥1,250/克 · $5,595/盎司 (2026-01-29); music low-passes and pulls back |
| 2.99 | — | near-silent gap, the bubble cracks |
| **3.19** | **drop (song 17.40 s)** | bubble bursts: glass shatter + impact, 「黄金暴跌」, the line falls to today |
| 4.26 | +2 | −39.5% from the high · 不到 10 个月，从 ¥1,250 跌到 ¥756 |
| 5.32 | +4 | 「现在，还能买吗？」 one word per half-beat |
| 6.38 | +6 | 抄底，还是接飞刀？ |
| 7.45 | +8 | 时间倒回: the chart rewinds and the music plays backwards at 2x |
| 9.57 | +12 | 「2023 · 故事，从这里开始」 the music resumes on the bar |

## Build

```bash
./fetch_fonts.sh                                   # SIL OFL fonts, not committed
BGM=/path/to/we_never.m4a THEME=lux ./build.sh     # -> output/gold_hook_lux.mp4
```

`THEME=lux` is the current look (ivory studio light, metallic gold, deep emerald for falls,
serif type). `cream`, `sun` and `blue` are the earlier drafts in `render/scene.js`.
The BGM is not committed: it is the user's own copy of a copyrighted track.

## Data

- 2024-03-02 → 2026-11-25: daily XAU/USD and XAU/CNY snapshots from the
  `@fawazahmed0/currency-api` npm package (`data/xau_daily_npm.txt`).
- 2023-01 → 2024-03: rebuilt from reported closes and monthly averages (`prep.py`), approximate.
- The 2026-01-29 point uses the reported intraday record of $5,595.41.
- CNY per gram = USD/oz × USD/CNY ÷ 31.1035.

Not investment advice.
