#!/usr/bin/env bash
# Full pipeline: data/timeline -> SFX -> parallel frame render -> final mp4.
set -euo pipefail
cd "$(dirname "$0")"
WORKERS=${WORKERS:-4}
OUT=${OUT:-output/bitcoin_lifeline.mp4}

[ -f fonts/NotoSansCJKsc-Black.otf ] || ./fetch_fonts.sh
python3 prep.py > build/timeline.log
python3 audio.py

NF=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['nF'])")
CHUNK=$(( (NF + WORKERS - 1) / WORKERS ))
rm -f build/seg_*.mp4 build/segs.txt
pids=()
for ((k=0; k<WORKERS; k++)); do
  s=$((k * CHUNK)); e=$(( (k + 1) * CHUNK )); (( e > NF )) && e=$NF
  node render/capture.js video "build/seg_$k.mp4" $s $e > "build/seg_$k.log" 2>&1 &
  pids+=($!)
  echo "file 'seg_$k.mp4'" >> build/segs.txt
done
for p in "${pids[@]}"; do wait "$p"; done

mkdir -p output
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs.txt -i build/sfx.wav \
  -map 0:v -map 1:a -af "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=200:makeup=1.5,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
