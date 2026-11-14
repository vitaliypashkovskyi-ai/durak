"""Draws the promo pictures: promo-wide.png (1280x720) and promo-square.png (1080x1080).
Run: python -X utf8 promo/make_promo.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = r'C:\Windows\Fonts'
font = lambda name, size: ImageFont.truetype(os.path.join(F, name), size)
BOLD, BLACK, REG, SYM = 'segoeuib.ttf', 'seguibl.ttf', 'segoeui.ttf', 'seguisym.ttf'

FELT, FELT2, GOLD, RED, INK, CARD = (33, 96, 62), (16, 52, 34), (245, 197, 66), (198, 40, 40), (27, 27, 27), (255, 253, 247)
BLUE, YELLOW = (0, 87, 183), (255, 215, 0)


def felt(w, h):
    img = Image.new('RGB', (w, h), FELT2)
    px = img.load()
    cx, cy, r = w / 2, h * 0.45, math.hypot(w, h) * 0.55
    for y in range(h):
        for x in range(w):
            t = min(1, math.hypot(x - cx, y - cy) / r)
            px[x, y] = tuple(int(FELT[i] * (1 - t) + FELT2[i] * t) for i in range(3))
    return img


def card(w, label, suit, red, back=False):
    h = int(w * 1.42)
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    rad = int(w * 0.1)
    d.rounded_rectangle([0, 0, w - 1, h - 1], rad, fill=CARD, outline=(220, 214, 200), width=2)
    if back:
        step = max(8, w // 9)
        for k in range(-h, w + h, step):
            d.line([(k, 0), (k + h, h)], fill=RED, width=max(2, w // 60))
            d.line([(k + h, 0), (k, h)], fill=INK, width=max(1, w // 90))
        d.rounded_rectangle([0, 0, w - 1, h - 1], rad, outline=CARD, width=max(6, w // 14))
        d.rounded_rectangle([w // 14, w // 14, w - 1 - w // 14, h - 1 - w // 14], rad // 2, outline=RED, width=max(2, w // 50))
        return c
    col = RED if red else INK
    d.text((w * 0.1, h * 0.04), label, font=font(BOLD, int(w * 0.26)), fill=col)
    d.text((w * 0.1, h * 0.04 + w * 0.3), suit, font=font(SYM, int(w * 0.24)), fill=col)
    big = font(SYM, int(w * 0.62))
    bb = d.textbbox((0, 0), suit, font=big)
    d.text(((w - (bb[2] - bb[0])) / 2 - bb[0] + w * 0.06, (h - (bb[3] - bb[1])) / 2 - bb[1] + h * 0.06), suit, font=big, fill=col)
    return c


def paste_rot(img, part, cx, cy, angle):
    shadow = Image.new('RGBA', part.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([0, 0, part.size[0] - 1, part.size[1] - 1], int(part.size[0] * 0.1), fill=(0, 0, 0, 110))
    for p, off in ((shadow.filter(ImageFilter.GaussianBlur(8)), 10), (part, 0)):
        r = p.rotate(angle, resample=Image.BICUBIC, expand=True)
        img.paste(r, (int(cx - r.size[0] / 2 + off), int(cy - r.size[1] / 2 + off)), r)


def fan(img, cx, cy, w, spread=14):
    cards = [('Т', '♠', False), ('К', '♥', True), ('Д', '♣', False), ('В', '♦', True), ('10', '♥', True)]
    n = len(cards)
    for i, (l, s, red) in enumerate(cards):
        a = (i - (n - 1) / 2) * spread
        rad = math.radians(a)
        paste_rot(img, card(w, l, s, red), cx + math.sin(rad) * w * 1.1, cy - math.cos(rad) * w * 0.35 + abs(i - 2) * w * 0.05, -a)


def centered(d, y, text, f, fill, W):
    bb = d.textbbox((0, 0), text, font=f)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], y), text, font=f, fill=fill)
    return bb[3] - bb[1]


def pill(d, cx, y, text, f, W, left=None):
    bb = d.textbbox((0, 0), text, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad_x, pad_y = th * 1.0, th * 0.55
    if left is not None: cx = left + pad_x + tw / 2   # align the button's left edge
    x0, x1 = cx - tw / 2 - pad_x, cx + tw / 2 + pad_x
    d.rounded_rectangle([x0, y, x1, y + th + 2 * pad_y], (th + 2 * pad_y) / 2, fill=(47, 111, 214))
    d.text((cx - tw / 2 - bb[0], y + pad_y - bb[1]), text, font=f, fill='white')


def stripe(d, x, y, w, h):
    d.rounded_rectangle([x, y, x + w, y + h], h // 2, fill=BLUE)
    d.rounded_rectangle([x + w / 2, y, x + w, y + h], h // 2, fill=YELLOW)
    d.rectangle([x + w / 2, y, x + w / 2 + h, y + h], fill=YELLOW)


GAMES = 'Дурень · Покер · Тисяча · Козел · Мафія · Шпигун · Морський бій'

# ---------- wide 1280x720 ----------
W, H = 1280, 720
img = felt(W, H).convert('RGBA')
fan(img, 905, 430, 170)
paste_rot(img, card(150, '', '', False, back=True), 1120, 560, -18)
d = ImageDraw.Draw(img)
d.text((80, 120), 'Ігри UA', font=font(BLACK, 128), fill='white')
stripe(d, 84, 285, 200, 12)
d.text((80, 320), 'Карткові й компанійські ігри', font=font(BOLD, 40), fill=GOLD)
d.text((80, 372), 'з друзями прямо в Telegram', font=font(BOLD, 40), fill=GOLD)
for i, line in enumerate(['Дурень · Розписний покер · Тисяча', 'Козел · Мафія · Шпигун · Морський бій']):
    d.text((80, 450 + i * 42), line, font=font(REG, 32), fill=(225, 235, 228))
pill(d, 0, 560, 'Грати безкоштовно → @IgryUA_bot', font(BOLD, 34), W, left=80)
img.convert('RGB').save(os.path.join(HERE, 'promo-wide.png'))

# ---------- square 1080x1080 ----------
S = 1080
img = felt(S, S).convert('RGBA')
fan(img, S / 2, 560, 190, spread=13)
d = ImageDraw.Draw(img)
centered(d, 70, 'Ігри UA', font(BLACK, 150), 'white', S)
stripe(d, S / 2 - 120, 270, 240, 14)
centered(d, 790, 'Карткові й компанійські ігри в Telegram', font(BOLD, 44), GOLD, S)
centered(d, 860, GAMES, font(REG, 31), (225, 235, 228), S)
pill(d, S / 2, 930, '@IgryUA_bot', font(BOLD, 44), S)
img.convert('RGB').save(os.path.join(HERE, 'promo-square.png'))
print('ok')
