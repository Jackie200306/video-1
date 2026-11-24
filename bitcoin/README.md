# 比特币的生命线 · Bitcoin life-line video

A 1920×1080 / 60 fps animated history of the Bitcoin price, from the genesis block
(2009-01-03) to 2026-11-24. It has sound effects only: no background music and no voiceover.

- The price line glows like a heart monitor trace. It has no axes or frame. The camera
  follows the leading point and pushes in at all-time highs. At crashes it pulls back and shakes.
- Every key event gets a card with its date, title and a one-line explanation. Each all-time
  high is marked with its price and each major bottom with its drawdown.
- The sound effects are ECG beeps, risers and bells at peaks, glass breaking when a bubble
  bursts, a falling whistle and an impact boom at crash bottoms, whooshes, and a heartbeat
  at the end.
- The closing line 「现在再次回到不到一半的价格，你敢买吗？」 is on-screen text only.

## Build

```bash
./fetch_fonts.sh   # Noto Sans SC + Barlow Condensed (SIL OFL), ~50 MB, not committed
./build.sh         # -> output/bitcoin_lifeline.mp4
```

Requirements: Python 3 with numpy and scipy, Node with Playwright and Chromium, and ffmpeg.

| file | role |
|---|---|
| `prep.py` | builds the daily price series and the event list, the time warp (slow motion at events) and the per-frame 3D camera, then writes `build/timeline.json` |
| `render/scene.js` | deterministic canvas renderer. `renderFrame(i)` draws frame *i* |
| `render/capture.js` | headless Chromium frame capture piped to ffmpeg |
| `audio.py` | procedural sound effect synthesis timed from the same timeline |
| `build.sh` | renders in parallel, then muxes and normalizes loudness |

## Data

- **2010-07-18 → 2026-05-24**: daily closes from Coin Metrics community data
  (`data/coinmetrics_btc.csv`, from github.com/coinmetrics/data).
- **2009-10 → 2010-07**: early quotes that are widely cited: New Liberty Standard $0.00076,
  the pizza day at about $0.004, and the July 2010 tenfold jump.
- **2026-05-25 → 2026-11-24**: rebuilt from reported levels, because no daily feed was
  reachable from the build machine. The anchors are:
  - the June 2026 drop below $60k;
  - month-end closes of $58.6k (Jun), $62.8k (Jul), $78.5k (Aug), $83.6k (Sep) and $77.4k (Oct);
  - $84.8k on Sep 21;
  - the Nov 21 low of about $55.1k;
  - about $60.2k on Nov 24.

  Between anchors the series is interpolated with small deterministic noise. Treat it as
  approximate.
- On a few famous days the close is replaced by the well-known intraday extreme, so the
  numbers match what people quote. Examples are $31.91 (2011-06), $19,783 (2017-12),
  $68,990 (2021-11) and $126,200 (2025-10-06). The full list is in `prep.py`.

The video is a historical review and is not investment advice.
