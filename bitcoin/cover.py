#!/usr/bin/env python3
"""Cover images: 3:4 (profile grid) and 16:9, built from a clean overview frame.

  CLEAN=1 node render/capture.js stills build/cover 5900
  python3 cover.py build/cover/f05900.png
"""
import os, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda name, size: ImageFont.truetype(os.path.join(HERE, 'fonts', name), size)
BLACK, MED = 'NotoSansCJKsc-Black.otf', 'NotoSansCJKsc-Medium.otf'
BAR = 'BarlowCondensed-Bold.ttf'
ORANGE, WHITE, SOFT = (255, 155, 46), (255, 255, 255), (214, 205, 196)


def text_runs(d, xy, runs, font, shadow=True):
    """draw [(text, color), ...] on one line starting at xy; returns end x."""
    x, y = xy
    for s, col in runs:
        if shadow:
            for dx, dy, a in ((0, 6, 150), (0, 3, 120)):
                d.text((x + dx, y + dy), s, font=font, fill=(0, 0, 0, a))
        d.text((x, y), s, font=font, fill=col)
        x += d.textlength(s, font=font)
    return x


def glow_text(base, xy, runs, font):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    for s, col in runs:
        if col == ORANGE:
            d.text((x, y), s, font=font, fill=(255, 140, 30, 200))
        x += d.textlength(s, font=font)
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(18)))


TXT = {
    'zh': dict(kicker='比特币 · 17 年生命线', l1=[('1万元', ORANGE), ('买比特币', WHITE)], l2=[('现在值多少？', WHITE)],
               sub='涨过 1.6 亿倍，又跌回一半', disc='历史不代表未来 · 不构成投资建议'),
    'en': dict(kicker='BITCOIN · A 17-YEAR LIFELINE', l1=[('¥10,000', ORANGE), (' in Bitcoin', WHITE)], l2=[("What's it worth now?", WHITE)],
               sub='Up 160 million times, then back below half', disc='Past performance is no guarantee of future results · Not investment advice'),
}
L = TXT['zh']


def fit(d, runs, size, maxw):
    while size > 40:
        f = F(BLACK, size)
        if sum(d.textlength(s, font=f) for s, _ in runs) <= maxw:
            return f
        size -= 4
    return F(BLACK, size)


def portrait(still, out):
    W, H = 1080, 1440
    img = Image.new('RGBA', (W, H), (5, 8, 20, 255))
    # atmosphere: blurred, darkened copy of the frame filling the background
    bg = still.resize((int(still.width * H / still.height), H)).crop((300, 0, 300 + W, H))
    bg = bg.filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(Image.blend(Image.new('RGBA', (W, H), (4, 6, 16, 255)), bg, 0.55))
    # chart art in the lower half, feathered into the background
    crop = ImageEnhance.Contrast(ImageEnhance.Brightness(still.crop((110, 130, 1730, 1080))).enhance(1.2)).enhance(1.12)
    art = crop.resize((W + 120, int(crop.height * (W + 120) / crop.width)))
    mask = Image.new('L', art.size, 255)
    md = ImageDraw.Draw(mask)
    for k in range(160):
        md.line([(0, k), (art.width, k)], fill=int(255 * (k / 160) ** 1.4))
    img.paste(art, (-60, H - art.height), mask)
    # top shade for the title
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(760):
        sd.line([(0, y), (W, y)], fill=(4, 6, 16, int(235 * (1 - y / 760) ** 0.8)))
    img.alpha_composite(shade)
    d = ImageDraw.Draw(img)
    # kicker
    d.rectangle((72, 118, 80, 160), fill=ORANGE)
    d.text((100, 112), L['kicker'], font=F(MED, 40), fill=SOFT)
    # title
    big = min(fit(d, L['l1'], 148, W - 120), fit(d, L['l2'], 148, W - 120), key=lambda f: f.size)
    glow_text(img, (64, 190), L['l1'], big)
    d = ImageDraw.Draw(img)
    text_runs(d, (64, 190), L['l1'], big)
    text_runs(d, (64, 190 + int(big.size * 1.25)), L['l2'], big)
    # subtitle
    yb = 190 + int(big.size * 2.45) + 30
    d.line((72, yb, 500, yb), fill=(255, 155, 46, 160), width=3)
    sf = F(MED, 48)
    while d.textlength(L['sub'], font=sf) > W - 130:
        sf = F(MED, sf.size - 2)
    text_runs(d, (70, yb + 25), [(L['sub'], SOFT)], sf, shadow=True)
    # footer
    d.text((72, H - 78), '2009 – 2026', font=F(BAR, 44), fill=(255, 214, 160))
    small = F(MED, 22 if L is TXT['zh'] else 16)
    s = L['disc']
    d.text((W - 40 - d.textlength(s, font=small), H - 62), s, font=small, fill=(255, 255, 255, 150))
    img.convert('RGB').save(out, quality=95)


def landscape(still, out):
    W, H = 1920, 1080
    img = Image.new('RGBA', (W, H), (5, 8, 20, 255))
    bg = still.filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(Image.blend(Image.new('RGBA', (W, H), (4, 6, 16, 255)), bg, 0.55))
    crop = ImageEnhance.Contrast(ImageEnhance.Brightness(still.crop((110, 130, 1730, 1080))).enhance(1.2)).enhance(1.12)
    aw = 1450
    art = crop.resize((aw, int(crop.height * aw / crop.width)))
    mask = Image.new('L', art.size, 255)
    md = ImageDraw.Draw(mask)
    for k in range(140):
        md.line([(0, k), (art.width, k)], fill=int(255 * (k / 140) ** 1.4))
    left = Image.new('L', art.size, 255)
    ld = ImageDraw.Draw(left)
    for k in range(520):
        ld.line([(k, 0), (k, art.height)], fill=int(255 * (k / 520) ** 1.6))
    from PIL import ImageChops
    img.paste(art, (W - aw + 40, H - art.height), ImageChops.multiply(mask, left))
    d = ImageDraw.Draw(img)
    d.rectangle((96, 118, 104, 156), fill=ORANGE)
    d.text((124, 112), L['kicker'], font=F(MED, 38), fill=SOFT)
    big = min(fit(d, L['l1'], 128, 1000), fit(d, L['l2'], 128, 1000), key=lambda f: f.size)
    glow_text(img, (88, 180), L['l1'], big)
    d = ImageDraw.Draw(img)
    text_runs(d, (88, 180), L['l1'], big)
    text_runs(d, (88, 180 + int(big.size * 1.25)), L['l2'], big)
    yb = 180 + int(big.size * 2.45) + 34
    d.line((96, yb, 520, yb), fill=(255, 155, 46, 160), width=3)
    sf = F(MED, 44)
    while d.textlength(L['sub'], font=sf) > 560:
        sf = F(MED, sf.size - 2)
    text_runs(d, (94, yb + 22), [(L['sub'], SOFT)], sf)
    d.text((96, H - 92), '2009 – 2026', font=F(BAR, 44), fill=(255, 214, 160))
    small = F(MED, 22 if L is TXT['zh'] else 18)
    s = L['disc']
    d.text((W - 40 - d.textlength(s, font=small), H - 44), s, font=small, fill=(255, 255, 255, 150))
    img.convert('RGB').save(out, quality=95)


if __name__ == '__main__':
    still = Image.open(sys.argv[1]).convert('RGBA')
    os.makedirs(os.path.join(HERE, 'output'), exist_ok=True)
    lang = os.environ.get('VLANG', 'zh')
    L = TXT[lang]
    sfx = '' if lang == 'zh' else '_' + lang
    portrait(still, os.path.join(HERE, 'output', 'cover_3x4%s.jpg' % sfx))
    landscape(still, os.path.join(HERE, 'output', 'cover_16x9%s.jpg' % sfx))
    print('wrote covers', lang)
