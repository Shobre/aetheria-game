#!/usr/bin/env python3
"""
build-favicon.py — generate PNGs and ICO from the SVG favicon.

Usage: python3 scripts/build-favicon.py
Outputs:
  - favicon-32x32.png     (32x32 PNG fallback)
  - apple-touch-icon.png  (180x180 iOS pin icon)
  - favicon.ico           (16/32/48 multi-resolution ICO for browser tabs)

Regenerate if assets/favicon.svg changes.
"""

import os
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG_PATH = os.path.join(ROOT, 'assets', 'favicon.svg')

PNG_32_PATH = os.path.join(ROOT, 'favicon-32x32.png')
PNG_180_PATH = os.path.join(ROOT, 'apple-touch-icon.png')
ICO_PATH = os.path.join(ROOT, 'favicon.ico')


def parse_svg_to_pixels(svg_path):
    """Parse the pixel-art SVG into a 2D array of (r, g, b) tuples.
    Only supports <rect> with shape-rendering=crispEdges (no transforms)."""
    tree = ET.parse(svg_path)
    root = tree.getroot()
    viewbox = root.get('viewBox', '0 0 32 32').split()
    vw, vh = int(float(viewbox[2])), int(float(viewbox[3]))

    pixels = [[(26, 26, 46)] * vw for _ in range(vh)]

    for elem in root:
        tag = elem.tag.split('}')[-1]
        if tag != 'rect':
            continue
        x = int(elem.get('x', 0))
        y = int(elem.get('y', 0))
        w = int(elem.get('width', 1))
        h = int(elem.get('height', 1))
        fill = elem.get('fill', '#000000')
        opacity = float(elem.get('opacity', 1.0))

        if fill.startswith('#'):
            fill = fill[1:]
            if len(fill) == 3:
                fill = ''.join(c * 2 for c in fill)
            r, g, b = int(fill[0:2], 16), int(fill[2:4], 16), int(fill[4:6], 16)
        else:
            r, g, b = 0, 0, 0

        for dy in range(h):
            for dx in range(w):
                px, py = x + dx, y + dy
                if 0 <= px < vw and 0 <= py < vh:
                    if opacity < 1.0:
                        er, eg, eb = pixels[py][px]
                        pixels[py][px] = (
                            int(er * (1 - opacity) + r * opacity),
                            int(eg * (1 - opacity) + g * opacity),
                            int(eb * (1 - opacity) + b * opacity),
                        )
                    else:
                        pixels[py][px] = (r, g, b)

    return pixels, vw, vh


def pixels_to_image(pixels, vw, vh, size):
    img = Image.new('RGB', (size, size), (26, 26, 46))
    px = img.load()
    scale = size / vw
    for y in range(vh):
        for x in range(vw):
            r, g, b = pixels[y][x]
            for dy in range(int(y * scale), int((y + 1) * scale)):
                for dx in range(int(x * scale), int((x + 1) * scale)):
                    if 0 <= dx < size and 0 <= dy < size:
                        px[dx, dy] = (r, g, b)
    return img


def main():
    if not os.path.exists(SVG_PATH):
        print(f'ERROR: {SVG_PATH} not found')
        return 1

    pixels, vw, vh = parse_svg_to_pixels(SVG_PATH)
    print(f'Parsed SVG: {vw}x{vh} grid')

    img32 = pixels_to_image(pixels, vw, vh, 32)
    img32.save(PNG_32_PATH, 'PNG', optimize=True)
    print(f'Wrote {PNG_32_PATH}')

    img180 = pixels_to_image(pixels, vw, vh, 180)
    img180.save(PNG_180_PATH, 'PNG', optimize=True)
    print(f'Wrote {PNG_180_PATH}')

    img16 = pixels_to_image(pixels, vw, vh, 16)
    img32 = pixels_to_image(pixels, vw, vh, 32)
    img48 = pixels_to_image(pixels, vw, vh, 48)
    img32.save(
        ICO_PATH,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[img16, img48],
    )
    print(f'Wrote {ICO_PATH} (16+32+48)')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
