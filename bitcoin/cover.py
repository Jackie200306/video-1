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
    d.text((100, 112), '比特币 · 17 年生命线', font=F(MED, 40), fill=SOFT)
    # title
    big = F(BLACK, 148)
    glow_text(img, (64, 190), [('1万元', ORANGE), ('买比特币', WHITE)], big)
    d = ImageDraw.Draw(img)
    text_runs(d, (64, 190), [('1万元', ORANGE), ('买比特币', WHITE)], big)
    text_runs(d, (64, 375), [('现在值多少？', WHITE)], big)
    # subtitle
    d.line((72, 600, 500, 600), fill=(255, 155, 46, 160), width=3)
    text_runs(d, (70, 625), [('涨过 1.6 亿倍，又跌回一半', SOFT)], F(MED, 48), shadow=True)
    # footer
    d.text((72, H - 78), '2009 – 2026', font=F(BAR, 44), fill=(255, 214, 160))
    small = F(MED, 22)
    s = '历史不代表未来 · 不构成投资建议'
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
    d.text((124, 112), '比特币 · 17 年生命线', font=F(MED, 38), fill=SOFT)
    big = F(BLACK, 128)
    glow_text(img, (88, 180), [('1万元', ORANGE), ('买比特币', WHITE)], big)
    d = ImageDraw.Draw(img)
    text_runs(d, (88, 180), [('1万元', ORANGE), ('买比特币', WHITE)], big)
    text_runs(d, (88, 340), [('现在值多少？', WHITE)], big)
    d.line((96, 548, 520, 548), fill=(255, 155, 46, 160), width=3)
    text_runs(d, (94, 570), [('涨过 1.6 亿倍，又跌回一半', SOFT)], F(MED, 44))
    d.text((96, H - 92), '2009 – 2026', font=F(BAR, 44), fill=(255, 214, 160))
    small = F(MED, 22)
    s = '历史不代表未来 · 不构成投资建议'
    d.text((W - 40 - d.textlength(s, font=small), H - 44), s, font=small, fill=(255, 255, 255, 150))
    img.convert('RGB').save(out, quality=95)


if __name__ == '__main__':
    still = Image.open(sys.argv[1]).convert('RGBA')
    os.makedirs(os.path.join(HERE, 'output'), exist_ok=True)
    portrait(still, os.path.join(HERE, 'output', 'cover_3x4.jpg'))
    landscape(still, os.path.join(HERE, 'output', 'cover_16x9.jpg'))
    print('wrote output/cover_3x4.jpg, output/cover_16x9.jpg')
