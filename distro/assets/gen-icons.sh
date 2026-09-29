#!/usr/bin/env bash
# Kidzink AI: regenerate every desktop app icon from the Kidzink mark.
#
# Source:  distro/assets/logo/kidzink-mark.svg (the kidzink.com favicon: a single-colour K).
# Output:  ui/desktop/src/images/ (icon.svg, glyph.svg, PNGs, icon.ico, icon.icns, tray templates).
# Colour:  "colors.light.primary" in ui/desktop/src/distro/brand.json.
#
# Requires rsvg-convert and ImageMagick (brew install librsvg imagemagick) and, for .icns, macOS iconutil.
# To change the logo: replace kidzink-mark.svg and re-run this script.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SRC="$REPO_ROOT/distro/assets/logo/kidzink-mark.svg"
OUT="$REPO_ROOT/ui/desktop/src/images"
BRAND="$REPO_ROOT/ui/desktop/src/distro/brand.json"

for tool in rsvg-convert magick python3; do
  command -v "$tool" >/dev/null || { echo "missing required tool: $tool" >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Builds three SVGs from the mark:
#   icon.svg   app icon: brand-coloured mark on a white rounded tile, same 2048 grid as upstream
#   glyph.svg  black mark on transparent, the source for macOS menu-bar template icons
#   update.svg glyph plus a red "update available" dot, for the tray's update state
python3 - "$SRC" "$BRAND" "$WORK" <<'PY'
import json, re, sys
src, brand, work = sys.argv[1:4]
svg = open(src).read()
color = json.load(open(brand))["colors"]["light"]["primary"]

vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
vx, vy, vw, vh = vb
paths = re.findall(r'<path\b[^>]*?\bd="([^"]+)"', svg)
if not paths:
    sys.exit(f"no <path> elements found in {src}")

def glyph(fill, box_x, box_y, box_size):
    scale = box_size / max(vw, vh)
    tx = box_x + (box_size - vw * scale) / 2 - vx * scale
    ty = box_y + (box_size - vh * scale) / 2 - vy * scale
    body = "".join(f'<path d="{d}"/>' for d in paths)
    return f'<g fill="{fill}" transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f})">{body}</g>'

def write(name, size, content):
    with open(f"{work}/{name}", "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{content}</svg>\n')

# The tile matches upstream's macOS-style geometry (1648px rounded square with a 200px margin
# on a 2048 canvas). The mark fills ~55% of the tile so it reads well at Dock and taskbar sizes.
write("icon.svg", 2048,
      '<rect x="200" y="200" width="1648" height="1648" rx="400" ry="400" fill="#ffffff"/>'
      + glyph(color, 574, 574, 900))
write("glyph.svg", 600, glyph("#000000", 40, 40, 520))
write("update.svg", 600, glyph("#000000", 20, 60, 480) + '<circle cx="480" cy="120" r="110" fill="#ff0000"/>')
PY

render() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }

cp "$WORK/icon.svg" "$OUT/icon.svg"
cp "$WORK/glyph.svg" "$OUT/glyph.svg"

render "$WORK/icon.svg" 2048 "$OUT/icon@2x.png"
render "$WORK/icon.svg" 1024 "$OUT/icon.png"
render "$WORK/icon.svg" 512 "$OUT/icon-512.png"

# macOS menu-bar icons: template images must be black plus alpha only; macOS tints them.
render "$WORK/glyph.svg" 22 "$WORK/t22.png"
render "$WORK/glyph.svg" 44 "$WORK/t44.png"
magick "$WORK/t22.png" -colorspace gray "$OUT/iconTemplate.png"
magick "$WORK/t44.png" -colorspace gray "$OUT/iconTemplate@2x.png"
render "$WORK/update.svg" 22 "$OUT/iconTemplateUpdate.png"
render "$WORK/update.svg" 44 "$OUT/iconTemplateUpdate@2x.png"

ico_inputs=()
for s in 16 24 32 48 64 128 256; do
  render "$WORK/icon.svg" "$s" "$WORK/ico-$s.png"
  ico_inputs+=("$WORK/ico-$s.png")
done
magick "${ico_inputs[@]}" "$OUT/icon.ico"

if command -v iconutil >/dev/null; then
  set_dir="$WORK/icon.iconset"
  mkdir -p "$set_dir"
  for s in 16 32 128 256 512; do
    render "$WORK/icon.svg" "$s" "$set_dir/icon_${s}x${s}.png"
    render "$WORK/icon.svg" "$((s * 2))" "$set_dir/icon_${s}x${s}@2x.png"
  done
  iconutil -c icns "$set_dir" -o "$OUT/icon.icns"
else
  echo "iconutil not found (not macOS): icon.icns left unchanged" >&2
fi

echo "Icons written to $OUT"
