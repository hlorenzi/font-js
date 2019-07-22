# font

[📱 Try a glyph viewer right now in your browser!](https://hlorenzi.github.io/font-js)

Utilities and a CLI for extracting glyphs and metadata from font files.

Currently allows loading TrueType or OpenType fonts or font collections,
and extracting metadata and glyph geometry.  

The command-line interface allows for extracting black-and-white,
grayscale, and signed distance field PNG renderings, and JSON metadata.

Run the command-line interface without arguments to check all the
available options.

Run via npx: `npx @hlorenzi/font`

Install with: `npm install @hlorenzi/font`

## Command-line Examples

```shell
# Extracts all glyphs from "arial.ttf" into PNG and JSON files.
npx @hlorenzi/font arial.ttf -o "output/unicode_[unicode]"

# Set glyph range.
npx @hlorenzi/font arial.ttf -o "output/unicode_[unicode]" --glyphs="u+30..u+39"

# Set output mode.
npx @hlorenzi/font arial.ttf -o "output/unicode_[unicode]" --img-mode="png-sdf"
```

## Package Example

```js
import { FontCollection, GlyphRenderer } from "@hlorenzi/font"
import fs from "fs"

// Load font file.
const fontBuffer = fs.readFileSync("arial.ttf")

// Load font collection and get first font.
const fontCollection = FontCollection.fromBytes(fontBuffer)
const font = fontCollection.fonts[0]

// Find glyph for Unicode character "a" and get its geometry,
// simplifying each bézier curve into 100 line segments.
const glyphIndex = font.getGlyphIndexForUnicode("a".charCodeAt(0))
const glyphGeometry = font.getGlyphGeometry(glyphIndex, 100)

// Render into a black-and-white buffer with scale factor 1 EM = 30 pixels,
// then crop empty borders and print to the console.
const glyphImage = GlyphRenderer.render(glyphGeometry, 30).cropped()
console.log(glyphImage.printToString())
```