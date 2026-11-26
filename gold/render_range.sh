#!/usr/bin/env bash
# Re-render frames [START, END) of the full video in parallel chunks: build/seg_full/r_k.mp4
set -euo pipefail
cd "$(dirname "$0")"
START=$1; END=$2; WORKERS=${WORKERS:-6}
N=$((END - START)); CHUNK=$(( (N + WORKERS - 1) / WORKERS ))
rm -f build/seg_full/r_*.mp4 build/seg_full/r_*.log
pids=()
for ((k=0; k<WORKERS; k++)); do
  s=$((START + k * CHUNK)); e=$((START + (k + 1) * CHUNK)); (( e > END )) && e=$END
  THEME=full node render/capture.js video "build/seg_full/r_$k.mp4" $s $e > "build/seg_full/r_$k.log" 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
