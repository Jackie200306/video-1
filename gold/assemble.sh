#!/usr/bin/env bash
# Concatenates the renderer parts into render/full.js (the full-length video)
cd "$(dirname "$0")"
cat render/parts/head.js render/parts/data.js render/parts/chart.js render/parts/ui_timeline.js \
    render/parts/ui_history.js render/parts/scenes2d.js render/parts/main.js > render/full.js
