# Icons

To generate PNG icons from the SVG, you can use any of these methods:

## Method 1: Using ImageMagick
```bash
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 32x32 icon32.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

## Method 2: Using Inkscape
```bash
inkscape icon.svg --export-filename=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-filename=icon32.png --export-width=32 --export-height=32
inkscape icon.svg --export-filename=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-filename=icon128.png --export-width=128 --export-height=128
```

## Method 3: Online converter
Upload icon.svg to https://cloudconvert.com/svg-to-png

For now, you can use the SVG file directly in development, or generate PNGs using one of the methods above.
