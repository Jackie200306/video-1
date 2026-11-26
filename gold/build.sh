#!/usr/bin/env bash
# Gold video pipeline: data/timeline -> SFX + beat-synced BGM -> parallel frame render -> mp4.
#   BGM=path/to/we_never.m4a THEME=cream ./build.sh
#   THEME=cream|sun|blue   look (default cream)
#   AUDIO_ONLY=1           re-mix sound onto the last render of that theme
set -euo pipefail
cd "$(dirname "$0")"
WORKERS=${WORKERS:-4}
THEME=${THEME:-cream}
OUT=${OUT:-output/gold_hook_${THEME}.mp4}
mkdir -p build output
[ -f fonts/NotoSansCJKsc-Black.otf ] || ./fetch_fonts.sh

python3 prep.py
python3 audio.py ${BGM:-}
AUDIO=build/mix.wav
SEGDIR=build/seg_$THEME
if [ -z "${AUDIO_ONLY:-}" ]; then
  NF=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['nF'])")
  CHUNK=$(( (NF + WORKERS - 1) / WORKERS ))
  rm -rf "$SEGDIR"; mkdir -p "$SEGDIR"
  pids=()
  for ((k=0; k<WORKERS; k++)); do
    s=$((k * CHUNK)); e=$(( (k + 1) * CHUNK )); (( e > NF )) && e=$NF
    THEME=$THEME node render/capture.js video "$SEGDIR/seg_$k.mp4" $s $e > "$SEGDIR/seg_$k.log" 2>&1 &
    pids+=($!)
    echo "file 'seg_$k.mp4'" >> "$SEGDIR/segs.txt"
  done
  for p in "${pids[@]}"; do wait "$p"; done
fi
# loudness: one linear gain to -15 LUFS, then a look-ahead limiter catches only the hits
# (keeps the drop's dynamics, no pumping)
IN_I=$(ffmpeg -hide_banner -nostats -i "$AUDIO" -af loudnorm=print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' | python3 -c "import json,sys;print(json.load(sys.stdin)['input_i'])")
GAIN=$(python3 -c "print(round(-15 - $IN_I, 2))")
LN="volume=${GAIN}dB,alimiter=limit=0.63:level=false:attack=3:release=60"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$SEGDIR/segs.txt" -i "$AUDIO" \
  -map 0:v -map 1:a -af "$LN,aresample=48000" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
