#!/usr/bin/env python3
"""
Convert a color PNG to a layered SVG using potrace.
Each dominant color is traced as its own <g> layer, preserving
potrace's coordinate transform so paths render at the correct scale.
"""
import re
import sys
import os
import subprocess
import tempfile
from PIL import Image
import numpy as np


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def write_pbm(path: str, mask: np.ndarray) -> None:
    h, w = mask.shape
    with open(path, "wb") as f:
        f.write(f"P4\n{w} {h}\n".encode())
        row_bytes = (w + 7) // 8
        for row in mask:
            padded = np.zeros(row_bytes * 8, dtype=np.uint8)
            padded[:w] = row
            f.write(np.packbits(padded).tobytes())


def trace_layer(mask: np.ndarray, color_hex: str, tmp_dir: str, idx: int) -> str:
    """
    Trace a binary mask with potrace and return one SVG <g> element
    (with the potrace coordinate transform preserved, fill recolored).
    """
    pbm_path = os.path.join(tmp_dir, f"layer_{idx}.pbm")
    svg_path = os.path.join(tmp_dir, f"layer_{idx}.svg")
    write_pbm(pbm_path, mask)

    result = subprocess.run(
        ["potrace", "-s", "--flat", "-o", svg_path, pbm_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  potrace error layer {idx}: {result.stderr[:200]}", file=sys.stderr)
        return ""

    with open(svg_path) as f:
        content = f.read()

    # potrace outputs: <g transform="..." fill="#000000" stroke="none">..paths..</g>
    # Grab the full <g>...</g> block
    m = re.search(r'(<g\s[^>]*fill="#000000"[^>]*>.*?</g>)', content, re.DOTALL)
    if not m:
        # Fallback: grab any <g>
        m = re.search(r'(<g\b.*?>.*?</g>)', content, re.DOTALL)
    if not m:
        return ""

    g_block = m.group(1)
    # Recolor: replace fill on the <g> tag itself
    g_block = g_block.replace('fill="#000000"', f'fill="{color_hex}"')
    g_block = re.sub(r'fill="[^"]*"', f'fill="{color_hex}"', g_block, count=1)
    # Give each layer a readable id
    g_block = re.sub(r'\bid="[^"]*"', f'id="layer-{color_hex.lstrip("#")}"', g_block)
    return g_block


def quantize_image(img: Image.Image, n_colors: int) -> tuple:
    bg = Image.new("RGB", img.size, (255, 255, 255))
    if img.mode == "RGBA":
        bg.paste(img, mask=img.split()[3])
    else:
        bg.paste(img)
    quantized = bg.quantize(colors=n_colors, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    colors = [(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]) for i in range(n_colors)]
    return np.array(quantized), colors


def png_to_svg(input_path: str, output_path: str, n_colors: int = 16):
    print(f"Loading {input_path}...")
    img = Image.open(input_path)
    w, h = img.size
    print(f"  Size: {w}×{h}")

    print(f"  Quantizing to {n_colors} colors...")
    q_arr, colors = quantize_image(img, n_colors)
    used_indices = np.unique(q_arr)

    # Sort lightest → darkest so lighter fills are drawn first (behind)
    def brightness(idx):
        r, g, b = colors[idx]
        return 0.299 * r + 0.587 * g + 0.114 * b

    sorted_indices = sorted(used_indices, key=brightness, reverse=True)

    with tempfile.TemporaryDirectory() as tmp_dir:
        svg_layers = []
        for i, idx in enumerate(sorted_indices):
            r, g, b = colors[idx]
            # Skip near-white background
            if r > 240 and g > 240 and b > 240:
                print(f"  Skip white-ish layer {idx}: rgb({r},{g},{b})")
                continue
            hex_color = rgb_to_hex(r, g, b)
            mask = (q_arr == idx).astype(np.uint8)
            pixel_count = int(mask.sum())
            if pixel_count < 100:
                print(f"  Skip tiny layer {idx}: {pixel_count}px")
                continue
            print(f"  Tracing {hex_color} ({pixel_count}px)…")
            g_element = trace_layer(mask, hex_color, tmp_dir, i)
            if g_element:
                svg_layers.append(g_element)
            else:
                print(f"    (no paths extracted)")

        print(f"\n  Assembling SVG with {len(svg_layers)} layers…")
        # potrace viewBox uses the same pixel dimensions as the input
        layers_str = "\n".join(svg_layers)
        svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1"
     width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <title>Forge — StudyForge Mascot Character Sheet</title>
  <desc>Auto-traced from forge-character-sheet.png via potrace color-layer method.</desc>
  <rect width="{w}" height="{h}" fill="#ffffff"/>
{layers_str}
</svg>"""
        with open(output_path, "w") as f:
            f.write(svg)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\nDone ✓  {output_path}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    input_png = sys.argv[1] if len(sys.argv) > 1 else "forge-character-sheet.png"
    output_svg = sys.argv[2] if len(sys.argv) > 2 else input_png.replace(".png", ".svg")
    n_colors = int(sys.argv[3]) if len(sys.argv) > 3 else 16
    png_to_svg(input_png, output_svg, n_colors)
