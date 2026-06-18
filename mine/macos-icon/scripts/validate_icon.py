#!/usr/bin/env python3
"""Validate macOS icon source artwork."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required: python3 -m pip install pillow") from exc


MIN_SIZE = 1024
MIN_OCCUPANCY = 0.85
ALPHA_THRESHOLD = 8


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return mask.getbbox()


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate macOS icon source artwork.")
    parser.add_argument("icon", type=Path, help="Path to source PNG or other raster icon")
    parser.add_argument("--min-size", type=int, default=MIN_SIZE)
    parser.add_argument("--min-occupancy", type=float, default=MIN_OCCUPANCY)
    args = parser.parse_args()

    if not args.icon.exists():
        print(f"FAIL missing file: {args.icon}")
        return 2

    image = Image.open(args.icon)
    width, height = image.size
    failures: list[str] = []

    if width != height:
        failures.append(f"non-square source: {width}x{height}")

    if width < args.min_size or height < args.min_size:
        failures.append(f"low resolution source: {width}x{height}; expected at least {args.min_size}x{args.min_size}")

    bbox = alpha_bbox(image)
    if bbox is None:
        failures.append("no visible artwork: alpha channel is fully transparent")
        occupancy = 0.0
    else:
        left, top, right, bottom = bbox
        if left > 0 or top > 0 or right < width or bottom < height:
            failures.append(f"transparent outer padding: alpha bbox {bbox} inside canvas {(0, 0, width, height)}")
        occupancy = ((right - left) * (bottom - top)) / float(width * height)
        if occupancy < args.min_occupancy:
            failures.append(f"low occupancy: {occupancy:.1%}; expected at least {args.min_occupancy:.0%}")

    print(f"icon: {args.icon}")
    print(f"size: {width}x{height}")
    print(f"occupancy: {occupancy:.1%}")

    if failures:
        print("FAIL")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
