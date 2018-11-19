import { Font } from "./src/font.mjs"
import { FontRenderer } from "./src/fontRenderer.mjs"
import fs from "fs"
import PNG from "pngjs"

const bytes = fs.readFileSync("C:/Windows/Fonts/arial.ttf")
const font = Font.fromBytes(bytes)
const glyphId = font.getUnicodeMap().get("M".codePointAt(0))
const geometry = font.getGlyphGeometry(glyphId, 100)
const image = FontRenderer.renderGlyph(geometry, 500)

let png = new PNG.PNG({ width: image.width, height: image.height, colorType: 6 })
for (let y = 0; y < image.height; y++)
{
	for (let x = 0; x < image.width; x++)
	{
		const i = (y * image.width + x)
		png.data[i * 4 + 0] = 0
		png.data[i * 4 + 1] = 0
		png.data[i * 4 + 2] = 0
		png.data[i * 4 + 3] = 255 - image.buffer[i]
	}
}

fs.writeFileSync("./test.png", PNG.PNG.sync.write(png))