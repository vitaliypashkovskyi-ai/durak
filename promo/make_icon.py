# Site icon: our own 3D die in the 🎲 style (white cube seen from above, red pips), transparent background.
# Writes favicon.ico, favicon.svg, favicon-48.png, icon-192/512.png and apple-touch-icon.png to the site root.
# Run: python promo/make_icon.py   (needs Pillow)
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RED, OUT = '#d32f2f', '#5a5a5a'
# faces of the cube in a 100×100 box: top (rhombus) and two sides; each face = origin + two edge vectors
C = (50, 50)                       # the near top corner
TOP = ((50, 8), (36, 22), (-36, 22))      # (origin = far corner) going to right and left
FACES = {
    'top':   ((50, 8), (36, 21), (-36, 21), '#ffffff'),
    'left':  ((14, 29), (36, 21), (0, 45), '#e6e3dc'),
    'right': ((50, 50), (36, -21), (0, 45), '#cfcac0'),
}
PIPS = {   # (u, v) in 0..1 on each face
    'top': [(0.5, 0.5)],
    'left': [(0.25, 0.25), (0.5, 0.5), (0.75, 0.75)],
    'right': [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)],
}

def face_pts(o, a, b):
    return [o, (o[0] + a[0], o[1] + a[1]), (o[0] + a[0] + b[0], o[1] + a[1] + b[1]), (o[0] + b[0], o[1] + b[1])]
def on_face(o, a, b, u, v):
    return (o[0] + a[0] * u + b[0] * v, o[1] + a[1] * u + b[1] * v)
def pip_poly(o, a, b, u, v, r=0.11, n=28):
    # a circle on the face = an ellipse after the face's slant
    return [on_face(o, a, b, u + r * math.cos(t), v + r * math.sin(t)) for t in (2 * math.pi * k / n for k in range(n))]

def draw(size):
    S = size * 4
    k = S / 100
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    sc = lambda pts: [(x * k, y * k) for x, y in pts]
    # soft shadow under the die
    d.ellipse([18 * k, 82 * k, 86 * k, 97 * k], fill=(0, 0, 0, 55))
    for name, (o, a, b, col) in FACES.items():
        d.polygon(sc(face_pts(o, a, b)), fill=col, outline=OUT, width=max(1, int(1.6 * k)))
        for u, v in PIPS[name]:
            d.polygon(sc(pip_poly(o, a, b, u, v)), fill=RED)
    return im.resize((size, size), Image.LANCZOS)

draw(512).save(os.path.join(ROOT, 'icon-512.png'))
draw(192).save(os.path.join(ROOT, 'icon-192.png'))
draw(180).save(os.path.join(ROOT, 'apple-touch-icon.png'))
draw(48).save(os.path.join(ROOT, 'favicon-48.png'))
draw(256).save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# the same drawing as SVG (sharp at any size)
def pts(p): return ' '.join(f'{x:.2f},{y:.2f}' for x, y in p)
parts = ['<ellipse cx="52" cy="89.5" rx="34" ry="7.5" fill="#000" opacity=".22"/>']
for name, (o, a, b, col) in FACES.items():
    parts.append(f'<polygon points="{pts(face_pts(o, a, b))}" fill="{col}" stroke="{OUT}" stroke-width="1.6" stroke-linejoin="round"/>')
    for u, v in PIPS[name]:
        parts.append(f'<polygon points="{pts(pip_poly(o, a, b, u, v))}" fill="{RED}"/>')
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n' + '\n'.join(parts) + '\n</svg>\n'
open(os.path.join(ROOT, 'favicon.svg'), 'w', encoding='utf-8').write(svg)
print('icons written')
