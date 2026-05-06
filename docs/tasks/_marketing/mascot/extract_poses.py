#!/usr/bin/env python3
"""
Extract the 4 individual poses from forge-character-sheet.png and
convert each to a layered SVG via potrace.

Layout (512×512):
  Title bar:    y=21–55
  Top row:      y=58–245   (Happy | Thinking)
  Bottom row:   y=258–432  (Curious | Neutral)
  Left col:     x=13–248
  Right col:    x=249–483
  Swatches:     y=440+
"""
import re
import sys
import os
import subprocess
import tempfile
from PIL import Image
import numpy as np

POSES = [
    ("happy",    (13, 58,  248, 248)),
    ("thinking", (249, 58,  483, 248)),
    ("curious",  (13, 258, 248, 440)),
    ("neutral",  (249, 258, 483, 440)),
]

# ---------------------------------------------------------------------------
# SVG conversion helpers (same pipeline as png_to_svg.py)
# ---------------------------------------------------------------------------

def rgb_to_hex(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"


def write_pbm(path, mask):
    h, w = mask.shape
    with open(path, "wb") as f:
        f.write(f"P4\n{w} {h}\n".encode())
        row_bytes = (w + 7) // 8
        for row in mask:
            padded = np.zeros(row_bytes * 8, dtype=np.uint8)
            padded[:w] = row
            f.write(np.packbits(padded).tobytes())


def trace_layer(mask, color_hex, tmp_dir, idx):
    pbm = os.path.join(tmp_dir, f"l{idx}.pbm")
    svg = os.path.join(tmp_dir, f"l{idx}.svg")
    write_pbm(pbm, mask)
    r = subprocess.run(["potrace", "-s", "--flat", "-o", svg, pbm],
                       capture_output=True)
    if r.returncode != 0:
        return ""
    with open(svg) as f:
        content = f.read()
    m = re.search(r'(<g\s[^>]*fill="#000000"[^>]*>.*?</g>)', content, re.DOTALL)
    if not m:
        m = re.search(r'(<g\b.*?>.*?</g>)', content, re.DOTALL)
    if not m:
        return ""
    g = m.group(1)
    g = re.sub(r'fill="[^"]*"', f'fill="{color_hex}"', g, count=1)
    g = re.sub(r'\bid="[^"]*"', f'id="layer-{color_hex.lstrip("#")}"', g)
    return g


def png_to_svg(img_crop: Image.Image, out_svg: str, n_colors: int = 12):
    bg = Image.new("RGB", img_crop.size, (255, 255, 255))
    bg.paste(img_crop)
    q = bg.quantize(colors=n_colors, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette()
    colors = [(palette[i*3], palette[i*3+1], palette[i*3+2]) for i in range(n_colors)]
    q_arr = np.array(q)
    w, h = img_crop.size

    def brightness(idx):
        r, g, b = colors[idx]
        return 0.299*r + 0.587*g + 0.114*b

    sorted_idx = sorted(np.unique(q_arr), key=brightness, reverse=True)

    with tempfile.TemporaryDirectory() as tmp:
        layers = []
        for i, idx in enumerate(sorted_idx):
            r, g, b = colors[idx]
            if r > 240 and g > 240 and b > 240:
                continue
            mask = (q_arr == idx).astype(np.uint8)
            if mask.sum() < 80:
                continue
            hex_c = rgb_to_hex(r, g, b)
            g_el = trace_layer(mask, hex_c, tmp, i)
            if g_el:
                layers.append(g_el)

        svg = (
            f'<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1"\n'
            f'     width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
            f'  <rect width="{w}" height="{h}" fill="#ffffff"/>\n'
            + "\n".join(layers)
            + "\n</svg>"
        )
        with open(out_svg, "w") as f:
            f.write(svg)
    return len(layers)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    src = "docs/tasks/_marketing/mascot/forge-character-sheet.png"
    out_dir = "docs/tasks/_marketing/mascot"
    img = Image.open(src)

    for name, box in POSES:
        print(f"\n── {name.upper()} {box} ──")
        crop = img.crop(box)

        # Save PNG
        png_out = os.path.join(out_dir, f"forge-fox-{name}.png")
        crop.save(png_out)
        print(f"  PNG → {png_out}")

        # Convert to SVG
        svg_out = os.path.join(out_dir, f"forge-fox-{name}-raster.svg")
        n_layers = png_to_svg(crop, svg_out)
        kb = os.path.getsize(svg_out) / 1024
        print(f"  SVG → {svg_out}  ({n_layers} layers, {kb:.1f} KB)")

    print("\nDone.")


if __name__ == "__main__":
    main()
