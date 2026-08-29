#!/usr/bin/env python3
"""Generates the pixel Luxo lamp: geometry -> label grid -> PNG previews + emitted TSX rect runs.

The grid IS the source of truth. What this previews is byte-identical to what the
React component renders (same runs, same palette keys).
"""
from __future__ import annotations
import math, subprocess, sys

W, H = 34, 38

# palette keys -> CSS color (theme keys H/Y/y resolved at runtime by the component)
FIXED = {
    "O": "#20293F",   # outline
    "S": "#C7D0E2",   # silver body
    "D": "#8B98B4",   # silver shade
    "E": "#5F6C88",   # deepest silver
    "W": "#F0F4FA",   # highlight white
    "B": "#FFDF6E",   # theme mid (bulb) — replaced at runtime
    "C": "#FFFFFF",   # theme core
    "R": "#B71C1C",   # alarm pupil
}

EMPTY = 0
BASE, ARM, HEAD = 1, 2, 3

def in_circle(x, y, cx, cy, r):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def in_ellipse(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

def in_tri(x, y, ax, ay, bx, by, cx, cy):
    def sign(px, py, qx, qy, rx, ry):
        return (px - rx) * (qy - ry) - (qx - rx) * (py - ry)
    d1 = sign(x, y, ax, ay, bx, by)
    d2 = sign(x, y, bx, by, cx, cy)
    d3 = sign(x, y, cx, cy, ax, ay)
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)

def thick_line_cells(x1, y1, x2, y2, t):
    """All cells within distance t/2 of the segment."""
    out = set()
    lo = math.floor(min(y1, y2) - t) ; hi = math.ceil(max(y1, y2) + t)
    lx = math.floor(min(x1, x2) - t) ; hx = math.ceil(max(x1, x2) + t)
    for y in range(lo, hi + 1):
        for x in range(lx, hx + 1):
            dx, dy = x2 - x1, y2 - y1
            L2 = dx * dx + dy * dy or 1
            tt = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / L2))
            px, py = x1 + tt * dx, y1 + tt * dy
            if math.hypot(x - px, y - py) <= t / 2:
                out.add((x, y))
    return out

def build_layers():
    label = [[EMPTY] * W for _ in range(H)]
    put = lambda x, y, l: (0 <= x < W and 0 <= y < H) and label[y].__setitem__(x, l)

    # ---- ARM (drawn first so the head cone is never cut) ----
    arm_cells = thick_line_cells(21, 16, 17, 27, 2.6)      # upper strut
    arm_cells |= thick_line_cells(17, 27, 24, 31.5, 2.6)   # lower strut
    for y in range(H):  # elbow disc
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, 17, 27, 2.9):
                arm_cells.add((x, y))
    for y in range(H):  # turret under the base pivot
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, 24, 31.5, 2.4):
                arm_cells.add((x, y))
    for (x, y) in arm_cells:
        put(x, y, ARM)

    # ---- HEAD: cone + socket cap + round bulb face (over the arm) ----
    head_cells = set()
    for y in range(H):
        for x in range(W):
            if in_tri(x + 0.5, y + 0.5, 21, 15, 10, 4, 10, 26):
                head_cells.add((x, y))
    neck_cells = set()
    for y in range(H):
        for x in range(W):
            if in_circle(x + 0.5, y + 0.5, 21.5, 15, 2.8):
                neck_cells.add((x, y))
    head_cells |= neck_cells
    bulb_cells = set()
    for y in range(H):
        for x in range(W):
            if in_ellipse(x + 0.5, y + 0.5, 10.5, 15, 4.0, 5.6):
                bulb_cells.add((x, y))
    rim_cells = set()
    for y in range(H):
        for x in range(W):
            if in_ellipse(x + 0.5, y + 0.5, 10.5, 15, 5.2, 6.9) and (x, y) not in bulb_cells:
                rim_cells.add((x, y))
    head_cells |= rim_cells | bulb_cells
    for (x, y) in head_cells:
        put(x, y, HEAD)

    # ---- BASE (dome, over the turret) ----
    base_cells = set()
    for y in range(H):
        for x in range(W):
            if in_ellipse(x + 0.5, y + 0.5, 24, 33.2, 8.6, 4.6) and y + 0.5 <= 33.2:
                base_cells.add((x, y))
    for (x, y) in base_cells:
        put(x, y, BASE)

    return label, {"head": head_cells, "neck": neck_cells, "bulb": bulb_cells, "rim": rim_cells}

def outline(label):
    """Any empty cell 4-adjacent to a filled cell becomes outline of that layer."""
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

LABEL, REGIONS = build_layers()
outline(LABEL)

# ---- color assignment ----
def color_at(x, y):
    l = LABEL[y][x]
    if l == EMPTY:
        return None
    if (x, y) in REGIONS["bulb"] and l in (HEAD, ARM):
        return "BULB"
    if (x, y) in REGIONS["rim"] and l == HEAD:
        return "W"
    if l == HEAD:
        if (x, y) in REGIONS["neck"]:
            return "D"
        if (x, y) in REGIONS["rim"]:
            return "W"
        if y <= 9 and x <= 15:
            return "W"
        return "D" if y >= 20 else "S"
    if l == ARM:
        return "D" if y >= 28 else "S"
    if l == BASE:
        return "D" if x >= 28 else "S"
    return "S"

def run_length_encode(colorfn, override=None):
    """Yield (layer, y, x, w, colorkey) runs."""
    runs = []
    for y in range(H):
        x = 0
        while x < W:
            key = override(x, y) if override else color_at(x, y)
            if key is None:
                x += 1
                continue
            x0 = x
            while x < W and (override(x, y) if override else color_at(x, y)) == key:
                x += 1
            runs.append((LABEL[y][x0], y, x0, x - x0, key))
    return runs

def hex_rgb(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))

def render_png(path, face=None, bulb="gold", scale=10):
    theme = {"gold": ("#FFF8DC", "#FFDF6E", "#FFB300"), "dim": ("#C7D0E2", "#9AA6BA", "#7E8AA3")}\
        .get(bulb, ("#FFF8DC", "#FFDF6E", "#FFB300"))
    def key(x, y):
        base = color_at(x, y)
        if face:
            fk = face.get((x, y))
            if fk:
                return fk
        if base == "BULB":
            return None
        return base
    # build pixel map with bulb colors + face stamped inside bulb area
    px = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if (x, y) in REGIONS["bulb"]:
                c = face.get((x, y)) if face else None
                if c in ("o", "w", "r"):
                    c = {"o": FIXED["O"], "w": "#FFFFFF", "r": FIXED["R"]}[c]
                if c is None:
                    d = math.hypot(x - 9.5, y - 14)
                    c = theme[0] if d < 3.4 else (theme[1] if y < 16 else theme[2])
                px[y][x] = hex_rgb(c)
            else:
                k = color_at(x, y)
                if k:
                    px[y][x] = hex_rgb(FIXED[k]) if k in FIXED else None
    with open("lamp.ppm", "wb") as f:
        f.write(f"P6\n{W} {H}\n255\n".encode())
        for y in range(H):
            for x in range(W):
                f.write(bytes(px[y][x] or (255, 0, 255)))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "lamp.ppm",
                    "-vf", f"scale={W*scale}:{H*scale}:flags=neighbor", path], check=True)

# ---- face stamps (bulb box x0=5,y0=10, 11 wide x 11 tall) ----
BX, BY = 5, 10
def stamp(rows, palette):
    m = {}
    for j, row in enumerate(rows):
        row = row.replace(" ", "")
        for i, ch in enumerate(row):
            if ch != ".":
                m[(BX + i, BY + j)] = palette[ch]
    return m

EYES_IDLE = [
    "...........",
    "...........",
    ".OO...OO...",
    ".OO...OO...",
    ".OO...OO...",
    "...........",
    "...........",
    "...........",
    "...OOOO....",
    "...........",
    "...........",
]
EYES_HAPPY = [
    "...........",
    "...........",
    "...........",
    ".O.....O...",
    "..O...O....",
    "...........",
    "...........",
    "...........",
    "...OOOO....",
    "...O..O....",
    "...........",
]
EYES_SLEEPY = [
    "...........",
    "...........",
    "...........",
    "...........",
    "OOO...OOO..",
    "...........",
    "...........",
    "...........",
    "...........",
    "..OOO......",
    "...........",
]
EYES_POKE = [
    "...........",
    "...........",
    ".OOO..OOO..",
    ".O.O..O.O..",
    ".O.O..O.O..",
    ".OOO..OOO..",
    "...........",
    "...........",
    "...OOOO....",
    "...........",
    "...........",
]
EYES_ALARM = [
    "...........",
    "...........",
    ".OWO..OWO..",
    ".ORO..ORO..",
    ".OWO..OWO..",
    ".OOO..OOO..",
    "...........",
    "...RRRR....",
    "....RR.....",
    "...OOOO....",
    "...........",
]
PAL_FACE = {"O": "o", "W": "w", "R": "r"}

FACES = {
    "idle": stamp(EYES_IDLE, PAL_FACE),
    "happy": stamp(EYES_HAPPY, PAL_FACE),
    "sleepy": stamp(EYES_SLEEPY, PAL_FACE),
    "poke": stamp(EYES_POKE, PAL_FACE),
    "alarm": stamp(EYES_ALARM, PAL_FACE),
}

import os
OUTDIR = os.path.dirname(os.path.abspath(__file__))

if __name__ == "__main__":
    for mood in FACES:
        render_png(f"{OUTDIR}/lamp-{mood}.png", face=FACES[mood], scale=12)
    render_png(f"{OUTDIR}/lamp-dim.png", face=FACES["sleepy"], bulb="dim", scale=12)
    print("previews written")
