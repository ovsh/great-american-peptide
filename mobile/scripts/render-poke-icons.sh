#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(dirname -- "$script_dir")
image_dir="$project_dir/assets/images"
rsvg_bin=$(command -v rsvg-convert || true)

if [ -z "$rsvg_bin" ]; then
  echo "rsvg-convert is required to render Poke icon PNGs." >&2
  exit 1
fi

"$rsvg_bin" --width 1024 --height 1024 --background-color '#2FB47C' --output "$image_dir/icon.png" "$image_dir/icon-poke.svg"
"$rsvg_bin" --width 1024 --height 1024 --output "$image_dir/splash-icon.png" "$image_dir/icon-poke-glyph.svg"
"$rsvg_bin" --width 512 --height 512 --output "$image_dir/android-icon-background.png" "$image_dir/icon-poke-background.svg"
"$rsvg_bin" --width 512 --height 512 --output "$image_dir/android-icon-foreground.png" "$image_dir/icon-poke-glyph.svg"
"$rsvg_bin" --width 432 --height 432 --output "$image_dir/android-icon-monochrome.png" "$image_dir/icon-poke-glyph.svg"
"$rsvg_bin" --width 48 --height 48 --background-color '#2FB47C' --output "$image_dir/favicon.png" "$image_dir/icon-poke.svg"

echo "Rendered Poke icon PNGs with $rsvg_bin."
