#!/usr/bin/env bash
# Full pipeline: data/timeline -> (BGM beat sync) -> SFX -> parallel frame render -> final mp4.
#   ./build.sh                      SFX only
#   BGM=path/to/song.mp3 ./build.sh  beat-synced BGM: the song's drop lands on the amount reveal
#   BGM=song.m4a FIT_VIDEO=1 DROP_EXACT=102.5 ./build.sh   keep the song from 0:00 and retime the video so
#                                    the reveal lands on the drop at 102.5 s of the song
#   AUDIO_ONLY=1 ...                 re-mix audio onto the last rendered frames (no re-render)
set -euo pipefail
cd "$(dirname "$0")"
WORKERS=${WORKERS:-4}
OUT=${OUT:-output/bitcoin_lifeline.mp4}
mkdir -p build output

[ -f fonts/NotoSansCJKsc-Black.otf ] || ./fetch_fonts.sh
rm -f build/bgm_sync.json
python3 prep.py > build/timeline.log
AUDIO=build/sfx.wav
if [ -n "${BGM:-}" ]; then
  python3 bgm.py analyze "$BGM"           # tempo, beats, drop -> song offset
  python3 prep.py > build/timeline.log    # snap question / landing / final hit to the beat grid
fi
python3 audio.py
if [ -n "${BGM:-}" ]; then python3 bgm.py mix; AUDIO=build/mix.wav; fi

if [ -z "${AUDIO_ONLY:-}" ]; then
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
fi

if [ -n "${AUDIO_ONLY:-}" ] && [ -f "$OUT" ]; then
  # picture unchanged: keep the existing video stream, only replace the sound (takes seconds)
  ffmpeg -y -loglevel error -i "$OUT" -i "$AUDIO" -map 0:v -map 1:a -c:v copy \
    -af "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=200:makeup=1.5,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000" \
    -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT.tmp.mp4" && mv "$OUT.tmp.mp4" "$OUT"
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"; exit 0
fi
ffmpeg -y -loglevel error -f concat -safe 0 -i build/segs.txt -i "$AUDIO" \
  -map 0:v -map 1:a -af "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=200:makeup=1.5,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000" \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
