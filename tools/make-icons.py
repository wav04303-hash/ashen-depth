# 잿빛 심연 앱 아이콘 (도트) 만들기: python3 tools/make-icons.py
# 32×32 도트 격자를 그린 뒤 정수 배율로 키운다. 게임 스프라이트와 같은 방식(1칸 테두리, 위쪽 밝게·아래쪽 어둡게).
from PIL import Image
import math, os
OUT = os.path.join(os.path.dirname(__file__), '..')
PAL = {'r':(184,51,42),'k':(52,54,61),'g':(100,104,113),'G':(155,160,169),'W':(211,215,221),'y':(217,164,65),
       'e':(255,207,138),'b':(191,196,204),'B':(238,241,244),'h':(120,80,50)}
FLAT = 'e'
HELM = [
 "..........rr..........",
 ".........rrr..........",
 "........rrrr..........",
 ".......rrrr...........",
 "......GGGGGGGGGG......",
 ".....GWWWWWWWGGGg.....",
 "....GWWWWWWWWGGGgg....",
 "....GWWWWGGGGGGGgg....",
 "....GWWGGGGGGGGGgg....",
 "....kkkkkkkkkkkkkk....",
 "....kkeeekkkkeeekk....",
 "....kkkkkkkkkkkkkk....",
 "....GGGGGGgGGGGGgg....",
 "....GWWGGGgGGGGggg....",
 "....GWGGGGgGGGGggg....",
 ".....GGGGGgGGGggg.....",
 "......gGGGgGGggg......",
 ".......ggggggggg......",
 "......yyyyyyyyyy......",
 ".....yyyyyyyyyyyy.....",
]
def grid(rows):
    w = max(len(r) for r in rows); return [list(r.ljust(w, '.')) for r in rows]
def blank(w, h): return [['.']*w for _ in range(h)]
def put(dst, src, ox, oy):
    for y, r in enumerate(src):
        for x, c in enumerate(r):
            if c != '.' and 0 <= y+oy < len(dst) and 0 <= x+ox < len(dst[0]): dst[y+oy][x+ox] = c
N = 32
g = blank(N, N)
# 칼: 왼쪽 아래 → 오른쪽 위 대각선 (투구 뒤)
for i in range(22):
    x, y = 5+i, 27-i
    g[y][x] = 'b'
    if x+1 < N: g[y][x+1] = 'B'
g[4][27] = 'B'
for (x, y) in [(3,25),(4,26),(6,28),(7,29)]: g[y][x] = 'y'   # 코등이 (칼날과 직각)
for (x, y) in [(4,28),(3,29)]: g[y][x] = 'h'               # 손잡이
g[30][2] = 'y'
put(g, grid(HELM), 5, 8)
def lit(c, k): return tuple(int(v+(255-v)*k) if k > 0 else int(v*(1+k)) for v in c)
def render(scale, bg=True, fg=True):
    size = N*scale; img = Image.new('RGBA', (size, size), (0,0,0,0)); px = img.load()
    # 배경: 잿빛 어둠 + 디더링된 원형 빛 + 불씨
    bayer = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]
    for Y in (range(N) if bg else []):
        for X in range(N):
            d = math.hypot(X-N*.52, Y-N*.45)/(N*.62)
            t = max(0, 1-d) + (bayer[(Y%4)*4+X%4]/16-.5)*.18
            band = round(t*5)/5
            base = (13,11,10); glow = (74,52,36)
            c = tuple(int(base[i]+(glow[i]-base[i])*band) for i in range(3))
            for yy in range(scale):
                for xx in range(scale): px[X*scale+xx, Y*scale+yy] = c+(255,)
    for (X, Y) in ([(3,6),(27,9),(25,24),(6,19),(29,17),(12,3)] if bg else []):
        for yy in range(scale):
            for xx in range(scale): px[X*scale+xx, Y*scale+yy] = (255,140,60,255)
    # 격자 그리기 (명암 + 테두리)
    at = lambda X, Y: 0 <= Y < N and 0 <= X < N and g[Y][X] != '.'
    def fill(X, Y, c):
        for yy in range(scale):
            for xx in range(scale): px[X*scale+xx, Y*scale+yy] = c+(255,)
    for Y in (range(N) if fg else []):
        for X in range(N):
            if at(X, Y): continue
            if at(X-1,Y) or at(X+1,Y) or at(X,Y-1) or at(X,Y+1): fill(X, Y, (11,8,7))
    for Y in (range(N) if fg else []):
        for X in range(N):
            ch = g[Y][X]
            if ch == '.': continue
            c = PAL[ch]
            if ch not in FLAT:
                if not at(X, Y-1): c = lit(c, .25)
                elif not at(X, Y+1) or not at(X+1, Y): c = lit(c, -.3)
            fill(X, Y, c)
    return img
def save(img, name, size, safe=None):
    if safe:  # maskable: 가운데 80% 안에 그림이 들어가게
        back = render(16, fg=False).resize((size, size), Image.NEAREST)
        inner = int(size*safe)//N*N
        fg = render(16, bg=False).resize((inner, inner), Image.NEAREST)
        back.alpha_composite(fg, ((size-inner)//2, (size-inner)//2)); img = back
    else:
        img = img.resize((size, size), Image.NEAREST)
    img.convert('RGB').save(os.path.join(OUT, name), optimize=True)
base = render(16)                       # 512
save(base, 'icon-512.png', 512)
save(base, 'icon-192.png', 192)
save(base, 'apple-touch-icon.png', 180)
save(base, 'icon-maskable-512.png', 512, safe=.75)
print('ok')
