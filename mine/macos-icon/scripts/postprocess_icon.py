#!/usr/bin/env python3
"""Crop generated macOS icon artwork, remove black canvas, and write 1024px RGBA PNG."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError as exc:
    raise SystemExit("Pillow is required: python3 -m pip install pillow") from exc


def build_visible_mask(image: Image.Image, transparent_threshold: int, opaque_threshold: int) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    mask = Image.new("L", (width, height), 0)
    out = mask.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            luma = max(r, g, b)
            if a <= 8 or luma <= transparent_threshold:
                value = 0
            elif luma >= opaque_threshold:
                value = 255
            else:
                value = int((luma - transparent_threshold) / (opaque_threshold - transparent_threshold) * 255)
            out[x, y] = value

    return mask


def square_bbox(bbox: tuple[int, int, int, int], image_size: tuple[int, int], pad: int) -> tuple[int, int, int, int]:
    width, height = image_size
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(width, right + pad)
    bottom = min(height, bottom + pad)

    side = max(right - left, bottom - top)
    cx = (left + right) // 2
    cy = (top + bottom) // 2
    left = max(0, min(width - side, cx - side // 2))
    top = max(0, min(height - side, cy - side // 2))
    return left, top, left + side, top + side


def fill_alpha_bbox(image: Image.Image, size: int) -> Image.Image:
    for _ in range(4):
        alpha = image.getchannel("A")
        bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
        if bbox is None or bbox == (0, 0, size, size):
            return image
        image = image.crop(bbox).resize((size, size), Image.Resampling.LANCZOS)
    return image


def main() -> int:
    parser = argparse.ArgumentParser(description="Post-process generated macOS app icon artwork.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("icon.png"))
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--transparent-threshold", type=int, default=8)
    parser.add_argument("--opaque-threshold", type=int, default=26)
    parser.add_argument("--pad", type=int, default=3)
    args = parser.parse_args()

    image = Image.open(args.input).convert("RGBA")
    visible = build_visible_mask(image, args.transparent_threshold, args.opaque_threshold)
    bbox = visible.point(lambda value: 255 if value > 24 else 0).getbbox()
    if bbox is None:
        print("FAIL no visible icon content detected", file=sys.stderr)
        return 1

    crop_box = square_bbox(bbox, image.size, args.pad)
    crop = image.crop(crop_box)
    alpha = visible.crop(crop_box).resize((args.size, args.size), Image.Resampling.LANCZOS)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.35))

    icon = crop.resize((args.size, args.size), Image.Resampling.LANCZOS)
    icon.putalpha(alpha)
    icon = fill_alpha_bbox(icon, args.size)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    icon.save(args.out)

    print(f"bbox={bbox}")
    print(f"crop={crop_box}")
    print(f"out={args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
