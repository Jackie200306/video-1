# 黄金暴跌，现在还能买吗？· Gold crash video (work in progress)

1920×1080 / 60 fps. So far only the opening hook (~10.8 s) is built:
`output/gold_hook_fx.mp4` (current) and `output/gold_hook_lux.mp4` (earlier flat look).

The `fx` look (`render/scene_fx.js`) brings the Bitcoin video's effects onto the ivory background:
3D follow camera with springy banking, glowing gold line with beat pulses running into the head,
a comet tail, embers and falling sparks, peak rays and rings, impact rings, cards and slams, plus
camera moves: a wide open, beat-kick push-ins, a crash zoom on the high, the burst blowing the
camera back, a punch on the landing, and a radial zoom blur on the fast moves.

## Hook storyboard (beat-synced to 《We Never》, 112.8 BPM)

The song starts 3 bars before its first drop (11.02 s into the song), opening up from a muffled
low-pass, so the bubble bursts on the drop (17.40 s into the song) at 6.38 s in the video.

| video time | beat | what happens |
|---|---|---|
| 0.00 | −12 | wide shot dollies in; 「黄金，一路狂飙」; the line climbs from Jan 2025 |
| 1.06 / 2.13 / 3.19 / 4.26 / 4.79 | −10 / −8 / −6 / −4 / −3 | the line breaks ¥700 / ¥800 / ¥900 / ¥1,000 / ¥1,100 exactly on the beat (rail flash, 「突破」, chime, zoom kick) |
| 5.32 | −2 | 历史最高 ¥1,250/克 · $5,595/盎司 (2026-01-29): crash zoom onto the bubble, rays; music low-passes and pulls back |
| **6.38** | **drop** | bubble bursts: glass + impact, camera blown back, 「黄金暴跌」, the line falls to today |
| 7.98 | +3 | landing punch-in: −39.5% · 不到 10 个月，从 ¥1,250 跌到 ¥756 |
| 8.51 / 9.57 | +4 / +6 | 「现在，还能买吗？」 / 抄底，还是接飞刀？ |
| 10.64 | +8 | 让我们把时间倒回: the camera flies back along the line (music keeps playing forward) |
| 12.77 | +12 | 「2023 · 这一轮大涨，要从这一年说起」 |

## Build

```bash
./fetch_fonts.sh                                   # SIL OFL fonts, not committed
BGM=/path/to/we_never.m4a THEME=fx ./build.sh      # -> output/gold_hook_fx.mp4
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
