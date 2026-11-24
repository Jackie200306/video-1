#!/usr/bin/env bash
# Downloads the open-source fonts used by the renderer (SIL OFL).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts
for f in \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Black.otf \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Medium.otf \
  google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf \
  google/fonts/main/ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf; do
  curl -fsSL -o "fonts/$(basename "$f")" "https://raw.githubusercontent.com/$f"
done
