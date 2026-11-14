# Site icon: a die on a blue-yellow tile. Writes favicon.ico, favicon.svg, icon-192/512.png and apple-touch-icon.png
# to the site root. Run: python promo/make_icon.py   (needs Pillow)
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLUE, YELLOW, WHITE, PIP, EDGE = (0, 87, 183), (255, 215, 0), (255, 253, 247), (16, 42, 92), (196, 190, 176)

def draw(size):
    S = size * 4                                   # draw big, shrink: smooth edges
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = S * 0.22
    # tile: blue top, yellow bottom (the flag)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.rectangle([0, 0, S, S // 2], fill=BLUE)
    td.rectangle([0, S // 2, S, S], fill=YELLOW)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
    im.paste(tile, (0, 0), mask)
    # the die: white rounded square with a soft shadow, five pips
    m = S * 0.17
    box = [m, m, S - m, S - m]
    sh = S * 0.03
    d.rounded_rectangle([box[0] + sh, box[1] + sh * 1.6, box[2] + sh, box[3] + sh * 1.6], radius=S * 0.12, fill=(0, 0, 0, 70))
    d.rounded_rectangle(box, radius=S * 0.12, fill=WHITE, outline=EDGE, width=max(1, int(S * 0.012)))
    w = box[2] - box[0]
    pr = w * 0.105
    for fx, fy in [(0.27, 0.27), (0.73, 0.27), (0.5, 0.5), (0.27, 0.73), (0.73, 0.73)]:
        cx, cy = box[0] + w * fx, box[1] + w * fy
        d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=PIP)
    return im.resize((size, size), Image.LANCZOS)

big = draw(512)
big.save(os.path.join(ROOT, 'icon-512.png'))
draw(192).save(os.path.join(ROOT, 'icon-192.png'))
draw(180).save(os.path.join(ROOT, 'apple-touch-icon.png'))
draw(48).save(os.path.join(ROOT, 'favicon-48.png'))
big.save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><clipPath id="t"><rect width="100" height="100" rx="22"/></clipPath></defs>
<g clip-path="url(#t)"><rect width="100" height="50" fill="#0057b7"/><rect y="50" width="100" height="50" fill="#ffd700"/></g>
<rect x="20" y="22.5" width="66" height="66" rx="12" fill="#000" opacity=".27"/>
<rect x="17" y="17" width="66" height="66" rx="12" fill="#fffdf7" stroke="#c4beb0" stroke-width="1.2"/>
<g fill="#102a5c"><circle cx="34.8" cy="34.8" r="6.9"/><circle cx="65.2" cy="34.8" r="6.9"/><circle cx="50" cy="50" r="6.9"/><circle cx="34.8" cy="65.2" r="6.9"/><circle cx="65.2" cy="65.2" r="6.9"/></g>
</svg>
'''
open(os.path.join(ROOT, 'favicon.svg'), 'w', encoding='utf-8').write(svg)
print('icons written')
