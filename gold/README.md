# 黄金暴跌，现在还能买吗？· Gold crash video (work in progress)

1920×1080 / 60 fps. So far only the opening hook (~10.8 s) is built:
`output/gold_hook_fx.mp4` (current) and `output/gold_hook_lux.mp4` (earlier flat look).

The `fx` look (`render/scene_fx.js`) brings the Bitcoin video's effects onto the ivory background:
3D follow camera with springy banking, glowing gold line with beat pulses running into the head,
a comet tail, embers and falling sparks, peak rays and rings, impact rings, cards and slams, plus
camera moves: a wide open, beat-kick push-ins, a crash zoom on the high, the burst blowing the
camera back, a punch on the landing, and a radial zoom blur on the fast moves.

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
