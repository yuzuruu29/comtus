#!/usr/bin/env python3
"""Generates Combot — the pixel console-buddy mascot (BMO-inspired).

Geometry -> label grid -> PNG mood previews + emitted combotGrid.ts.
What the previews show is byte-identical to what the React component renders.
"""
from __future__ import annotations
import math, os, subprocess

W, H = 36, 40

FIXED = {
    "O": "#17332E",   # outline (dark teal-black)
    "S": "#63B0A0",   # body teal
    "T": "#8FD4C3",   # body top light
    "D": "#4C8A7C",   # body dark shade
    "B": "#2E4B44",   # screen bezel
    "F": "SCREEN",    # screen fill — resolved at runtime by theme
    "Y": "#F4C542",   # d-pad yellow
    "y": "#C79A22",   # d-pad yellow dark
    "R": "#E2574B",   # red button
    "G": "#3FA34D",   # green button
    "U": "#4A7BD5",   # blue button
    "o": "#1E3B34",   # face dark
    "w": "#FFFFFF",   # face white
    "r": "#B71C1C",   # face alarm red
}

EMPTY, LEGS, ARML, ARMR, BODY, PANEL, SCREEN = 0, 1, 2, 3, 4, 5, 6

def in_rect(x, y, x0, y0, x1, y1):
    return x0 <= x <= x1 and y0 <= y <= y1

def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if not in_rect(x, y, x0, y0, x1, y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r or in_rect(x, y, x0 + r, y0, x1 - r, y1) or in_rect(x, y, x0, y0 + r, x1, y1 - r)

def in_circle(x, y, cx, cy, r):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def in_ellipse(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def thick_line_cells(x1, y1, x2, y2, t):
    out = set()
    for y in range(math.floor(min(y1, y2) - t), math.ceil(max(y1, y2) + t) + 1):
        for x in range(math.floor(min(x1, x2) - t), math.ceil(max(x1, x2) + t) + 1):
            dx, dy = x2 - x1, y2 - y1
            L2 = dx * dx + dy * dy or 1
            tt = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L2))
            if math.hypot(x - (x1 + tt * dx), y - (y1 + tt * dy)) <= t / 2:
                out.add((x, y))
    return out

def build():
    label = [[EMPTY] * W for _ in range(H)]
    put = lambda x, y, l: (0 <= x < W and 0 <= y < H) and label[y].__setitem__(x, l)

    # ---- LEGS (behind body) ----
    legs = set()
    legs |= thick_line_cells(14, 32, 13, 37, 2.4)    # left leg
    legs |= thick_line_cells(13.5, 37, 11, 37.5, 2.4)  # left foot
    legs |= thick_line_cells(22, 32, 23, 36, 2.4)    # right leg
    legs |= thick_line_cells(23, 36, 25.5, 36.5, 2.4)  # right foot
    for c in legs:
        put(*c, LEGS)

    # ---- ARMS (behind body edges) ----
    arml = thick_line_cells(8, 18, 4, 21, 2.6)       # left upper
    arml |= thick_line_cells(4, 21, 3.5, 25, 2.6)    # left forearm
    arml |= in_circle_cells(3.5, 26, 1.8)            # left hand
    for c in arml:
        put(*c, ARML)

    armr = thick_line_cells(27, 17, 31.5, 14.5, 2.6)  # right upper (raised)
    armr |= thick_line_cells(31.5, 14.5, 33, 11, 2.6)  # right forearm (wave up)
    armr |= in_circle_cells(33, 9.5, 1.8)             # right hand
    for c in armr:
        put(*c, ARMR)

    # ---- BODY ----
    body = set()
    for y in range(H):
        for x in range(W):
            if in_rounded_rect(x + 0.5, y + 0.5, 7, 5, 28, 33, 2.2):
                body.add((x, y))
    for c in body:
        put(*c, BODY)

    # ---- PANEL details (over body) ----
    panel = set()
    for cy in (9, 11, 13):        # speaker dots
        for cx in (9,):
            panel.add((cx, cy))
    for cx in range(10, 17):      # d-pad horizontal bar
        for cy in (26, 27, 28):
            panel.add((cx, cy))
    for cy in range(24, 31):      # d-pad vertical bar
        for cx in (12, 13, 14):
            panel.add((cx, cy))
    for y in range(H):            # red round button
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, 21.5, 27, 2.3):
                panel.add((x, y))
    for y in range(H):            # green small button
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, 25, 23, 1.4):
                panel.add((x, y))
    panel.update({(20, 22), (21, 22), (20, 23), (21, 23)})  # blue square
    panel.update({(11, 31), (12, 31), (13, 31)})            # slot dashes
    panel.update({(16, 31), (17, 31), (18, 31)})
    for c in panel:
        put(*c, PANEL)

    # ---- SCREEN ----
    screen = set()
    for y in range(H):
        for x in range(W):
            if in_rounded_rect(x + 0.5, y + 0.5, 10, 7, 25, 21, 1.4):
                screen.add((x, y))
    for c in screen:
        put(*c, SCREEN)

    return label

def in_circle_cells(cx, cy, r):
    out = set()
    for y in range(H):
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, cx, cy, r):
                out.add((x, y))
    return out

def outline(label):
    adds = []
    for y in range(H):
        for x in range(W):
            if label[y][x] != EMPTY:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and label[ny][nx] != EMPTY:
                    adds.append((x, y, label[ny][nx]))
                    break
    for x, y, l in adds:
        label[y][x] = l

LABEL = build()
outline(LABEL)

SCREEN_BOX = (11, 8, 24, 20)  # inner screen bounds (x0,y0,x1,y1)

def color_at(x, y):
    l = LABEL[y][x]
    if l == EMPTY:
        return None
    if l == SCREEN:
        if in_rect(x, y, *SCREEN_BOX):
            return "F"
        return "B"
    if l == BODY:
        if y <= 6:
            return "T"
        if x <= 8 or y >= 32:
            return "D"
        return "S"
    if l in (LEGS, ARML, ARMR):
        return "D" if y >= 36 else "S"
    if l == PANEL:
        if in_rect(x, y, 10, 26, 16, 28) or in_rect(x, y, 12, 24, 14, 30):
            edge = x in (10, 16) or y in (24, 30)
            return "y" if edge else "Y"
        if in_circle(x + 0.5, y + 0.5, 21.5, 27, 2.3):
            return "R"
        if in_circle(x + 0.5, y + 0.5, 25, 23, 1.4):
            return "G"
        if in_rect(x, y, 20, 22, 21, 23):
            return "U"
        return "D"  # speaker dots + slots
    return "S"

# ---- face stamps inside screen box (eyes + mouth separate groups) ----
FX0, FY0 = SCREEN_BOX[0], SCREEN_BOX[1]

def stamp(rows):
    m = {}
    for j, row in enumerate(rows):
        row = row.replace(" ", "")
        for i, ch in enumerate(row):
            if ch != ".":
                m[(FX0 + i, FY0 + j)] = ch
    return m

# screen inner is 14 wide x 13 tall
EYES_IDLE = [
    "..............",
    "..............",
    "..oo....oo....",
    "..oo....oo....",
    "..oo....oo....",
    "..............",
]
MOUTH_IDLE = [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    ".....oooo.....",
]
EYES_BLINK = [
    "..............",
    "..............",
    "..............",
    "..............",
    "..ooo..ooo....",
    "..............",
]
MOUTH_SLEEP = [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "......oo......",
]
EYES_HAPPY = [
    "..............",
    "..............",
    "..............",
    "..o......o....",
    "...o....o.....",
    "...oo..oo.....",
]
MOUTH_HAPPY = [
    "..............",
    "..............",
    "..............",
    "..............",
    ".....oooo.....",
    "....oo..oo....",
]
EYES_POKE = [
    "..............",
    "..............",
    "..ooo...ooo...",
    "..o.o...o.o...",
    "..ooo...ooo...",
    "..............",
]
MOUTH_POKE = [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "......oo......",
]
EYES_ALARM = [
    "..............",
    "..............",
    "..www...www...",
    "..wrw...wrw...",
    "..www...www...",
    "..............",
]
MOUTH_ALARM = [
    "..............",
    "..............",
    "..............",
    "....oooooo....",
    "....oooooo....",
    "..............",
]

FACES = {
    "idle":    {"eyes": stamp(EYES_IDLE),  "mouth": stamp(MOUTH_IDLE)},
    "blink":   {"eyes": stamp(EYES_BLINK), "mouth": stamp(MOUTH_IDLE)},
    "sleepy":  {"eyes": stamp(EYES_BLINK), "mouth": stamp(MOUTH_SLEEP)},
    "happy":   {"eyes": stamp(EYES_HAPPY), "mouth": stamp(MOUTH_HAPPY)},
    "poke":    {"eyes": stamp(EYES_POKE),  "mouth": stamp(MOUTH_POKE)},
    "alarm":   {"eyes": stamp(EYES_ALARM), "mouth": stamp(MOUTH_ALARM)},
}

SCAN_BARS = [
    (13, 15, 16, 3),  # x, y, w, h  (bottom-anchored bars in screen)
    (16, 12, 16, 2),
    (19, 17, 16, 1),
    (22, 14, 16, 2),
]

def hex_rgb(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

THEME_PREV = {"lit": "#D8F0DC", "dim": "#9DB8AF", "red": "#F5C9C9", "cyan": "#D3F2F8"}

def render_png(path, face=None, screen="lit", scale=12):
    fill = hex_rgb(THEME_PREV.get(screen, THEME_PREV["lit"]))
    px = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            k = color_at(x, y)
            if k == "F":
                c = (face or {}).get((x, y)) if (face and (x, y) in face) else None
                px[y][x] = hex_rgb(FIXED[c]) if c else fill
            elif k:
                px[y][x] = hex_rgb(FIXED[k])
    with open("combot.ppm", "wb") as f:
        f.write(f"P6\n{W} {H}\n255\n".encode())
        for y in range(H):
            for x in range(W):
                f.write(bytes(px[y][x] or (255, 0, 255)))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "combot.ppm",
                    "-vf", f"scale={W*scale}:{H*scale}:flags=neighbor", path], check=True)

def rle_rows(cells):
    rows = {}
    for (x, y), k in cells.items():
        rows.setdefault(y, {})[x] = k
    out = []
    for y in sorted(rows):
        xs = sorted(rows[y])
        x = xs[0]
        while x <= xs[-1]:
            if x in rows[y]:
                k = rows[y][x]
                x0 = x
                while x in rows[y]:
                    x += 1
                out.append((y, x0, x - x0, k))
            else:
                x += 1
    return out

def emit_ts(out_path):
    LAYER_NAME = {LEGS: "legs", ARML: "armL", ARMR: "armR", BODY: "body", PANEL: "panel", SCREEN: "screen"}
    body = {}
    for y in range(H):
        for x in range(W):
            k = color_at(x, y)
            if k and k != "F":
                body[(x, y)] = (LAYER_NAME[LABEL[y][x]], k)
    items = [(l, y, x, 1, k) for (x, y), (l, k) in body.items()]
    items.sort(key=lambda t: ({"legs": 0, "armL": 1, "armR": 2, "body": 3, "panel": 4, "screen": 5}[t[0]], t[1], t[2]))

    def runs_ts(runs):
        inner = ",\n    ".join('[%d, %d, %d, "%s"]' % (y, x, w, k) for (y, x, w, k) in runs)
        return "[\n    " + inner + ",\n  ]"

    lines = []
    lines.append("/** Generated by scripts/gen_combot.py — Combot console-buddy pixel grid. Do not hand-edit runs. */")
    lines.append("export const GRID_W = 36;")
    lines.append("export const GRID_H = 40;")
    lines.append('export type BodyLayer = "legs" | "armL" | "armR" | "body" | "panel" | "screen";')
    lines.append('export type FaceMood = "idle" | "blink" | "sleepy" | "happy" | "poke" | "alarm";')
    lines.append("")
    lines.append("/** [layer, y, x, width, colorKey] — colorKey F = theme screen fill */")
    lines.append('export const BODY_RUNS: readonly (readonly [BodyLayer, number, number, number, string])[] = [')
    lines.append("  " + ",\n  ".join('["%s", %d, %d, %d, "%s"]' % (l, y, x, w, k) for (l, y, x, w, k) in items) + ",")
    lines.append("];")
    lines.append("")
    lines.append("/** [y, x, width, faceKey] per expression, split for eye tracking */")
    lines.append("export const FACE_RUNS: Record<FaceMood, { eyes: readonly (readonly [number, number, number, string])[]; mouth: readonly (readonly [number, number, number, string])[] }> = {")
    for mood, fm in FACES.items():
        lines.append("  %s: {" % mood)
        lines.append("    eyes: " + runs_ts(rle_rows(fm["eyes"])) + ",")
        lines.append("    mouth: " + runs_ts(rle_rows(fm["mouth"])) + ",")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    lines.append("/** [x, y, w, h] equalizer bars shown while scanning */")
    lines.append("export const SCAN_BARS: readonly (readonly [number, number, number, number])[] = [")
    lines.append("  " + ",\n  ".join("[%d, %d, %d, %d]" % b for b in SCAN_BARS) + ",")
    lines.append("];")

    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    return len(items)

if __name__ == "__main__":
    outdir = os.path.dirname(os.path.abspath(__file__))
    render_png(f"{outdir}/combot-idle.png", face=None, screen="lit")
    render_png(f"{outdir}/combot-blink.png", face=FACES["blink"]["eyes"] | FACES["idle"]["mouth"], screen="lit")
    render_png(f"{outdir}/combot-happy.png", face=FACES["happy"]["eyes"] | FACES["happy"]["mouth"], screen="lit")
    render_png(f"{outdir}/combot-sleepy.png", face=FACES["sleepy"]["eyes"] | FACES["sleepy"]["mouth"], screen="dim")
    render_png(f"{outdir}/combot-poke.png", face=FACES["poke"]["eyes"] | FACES["poke"]["mouth"], screen="lit")
    render_png(f"{outdir}/combot-alarm.png", face=FACES["alarm"]["eyes"] | FACES["alarm"]["mouth"], screen="red")
    n = emit_ts(os.path.join(outdir, "..", "src", "components", "brand", "combotGrid.ts"))
    print(f"previews written; grid emitted ({n} body cells)")
