#!/usr/bin/env bash
# Downloads the open-source fonts used by the renderer (SIL OFL).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fonts
for f in \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Black.otf \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Bold.otf \
  notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Medium.otf \
  notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Black.otf \
  notofonts/noto-cjk/main/Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Bold.otf \
  google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf \
  google/fonts/main/ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf \
  google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf \
  google/fonts/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf \
  google/fonts/main/ofl/dmserifdisplay/DMSerifDisplay-Italic.ttf \
  google/fonts/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf; do
  n=$(basename "$f" | sed 's/%5Bwght%5D/-VF/')
  [ -f "fonts/$n" ] || curl -fsSL -o "fonts/$n" "https://raw.githubusercontent.com/$f"
done
ls -la fonts
