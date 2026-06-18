---
name: macos-icon
description: Create, refine, validate, post-process, and export macOS app icons from generated or existing raster artwork. Use when Codex needs to make an Electron, Swift, Xcode, or other macOS app icon; prompt image models for 1024x1024 macOS-style icon artwork; remove black or transparent icon padding; make rounded-corner app-icon PNGs; check transparent borders, square shape, resolution, and artwork occupancy; or generate .icns files with iconutil.
---

# macOS Icon

## HIG Baseline

Apple HIG app-icon guidance for iOS, iPadOS, and macOS:

- Layout shape: square.
- Icon shape after system masking: rounded rectangle (square).
- Layout size: `1024x1024 px`.
- Keep primary content centered so system masking does not truncate it.
- Provide square, unmasked layers for Apple’s system/icon-composer pipeline; the system applies the final rounded mask.
- For Electron/local `.icns` delivery, a final PNG may use alpha in the outside rounded corners, but it must not contain transparent or black outer padding.

Reference: https://developer.apple.com/design/human-interface-guidelines/app-icons

## Image Prompt

When generating initial artwork with `gpt-image-2` or the built-in image tool, put the production constraints in the prompt. Do not rely on the model to infer app-icon geometry.

```text
Create a macOS app icon source image.
Canvas/output: exactly 1024x1024 pixels, square layout.
Icon geometry: macOS app-icon style; layout shape is Square; intended icon shape after system masking is Rounded rectangle (square).
Alpha: include an alpha channel if supported, with transparency only outside the rounded-corner icon shape. No transparent outer padding.
Composition: artwork fills the safe area; if visual occupancy would be below 85%, enlarge the artwork. Keep primary content centered.
Style: clean, simple, elegant, legible at small Dock sizes.
Avoid: text, letters, watermarks, screenshots, busy details, black square canvas, inset icon tile, transparent border, drop shadow extending beyond the icon canvas.
```

If the generator returns an RGB PNG or bakes the rounded tile into a black square canvas, treat that as normal model drift and fix it locally.

## Workflow

1. Generate or locate source artwork.
2. Normalize to `1024x1024` PNG.
3. If the model output has a black edge, black square canvas, or inset tile, post-process it:
   ```bash
   python /Users/weixu/skills/macos-icon/scripts/postprocess_icon.py input.png --out icon.png
   ```
4. Validate:
   ```bash
   python /Users/weixu/skills/macos-icon/scripts/validate_icon.py icon.png
   ```
5. If validation reports transparent border, low resolution, non-square shape, or occupancy `<85%`, fix and validate again.
6. Preview on a medium gray background to catch black-edge artifacts.
7. Create `App.iconset` with standard macOS sizes:
   ```bash
   mkdir -p App.iconset
   for size in 16 32 128 256 512; do
     sips -z "$size" "$size" icon.png --out "App.iconset/icon_${size}x${size}.png"
     sips -z "$((size * 2))" "$((size * 2))" icon.png --out "App.iconset/icon_${size}x${size}@2x.png"
   done
   iconutil -c icns App.iconset
   ```
8. Save project-bound outputs in the workspace, commonly:
   - `resources/icon.png`
   - `resources/icon.icns`

## Post-Processing Pattern

Use Pillow when the model produces an otherwise-good icon inside an unwanted black/transparent canvas:

1. Load original PNG as RGBA.
2. Detect the visible rounded tile/artwork by thresholding non-background pixels.
3. Crop to the visible bounding box and square it around the center.
4. Resize crop to `1024x1024`.
5. Rebuild alpha so only the outside rounded-corner area is transparent.
6. Save `icon.png`, then regenerate `.icns`.

## Fixes

- **Transparent border or padding:** crop to the alpha bounding box, resize back to `1024x1024`, and preserve only intentional rounded-corner alpha.
- **Black edge around icon:** treat it as baked-in artwork, not Dock padding. Crop or mask it out, then preview on gray.
- **Inset icon tile:** crop/enlarge so the icon body fills the canvas safe area.
- **Non-square source:** crop or pad to square, then resize to `1024x1024`.
- **Low resolution:** regenerate at `1024x1024`; upscale only as a last resort.
- **Low occupancy:** enlarge visible artwork until the bounding box covers at least `85%` of the canvas.

## Visual QA

- Check at `32x32` and `64x64` for recognizability.
- Verify corners on gray, light, and dark backgrounds.
- Prefer one memorable metaphor, large simple forms, and restrained depth.
