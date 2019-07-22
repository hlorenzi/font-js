import { FontCollection, GlyphRenderer } from "./index.js"
import fs from "fs"
import assert from "assert"


const fontBuffer = fs.readFileSync("C:/Windows/Fonts/arial.ttf")

const fontCollection = FontCollection.fromBytes(fontBuffer)
assert(fontCollection.fonts.length > 0)

const font = fontCollection.fonts[0]
assert.equal(font.fontFamilyName, "Arial")
assert.equal(font.fontSubfamilyName, "Regular")

const glyphIndex = font.getGlyphIndexForUnicode("a".charCodeAt(0))
const glyphGeometry = font.getGlyphGeometry(glyphIndex, 100)

assert.equal(glyphGeometry.contours.length, 2)

const glyphImage = GlyphRenderer.render(glyphGeometry, 12 * 16).getDownsampled().cropped()

console.log("")
console.log("This should look like an Arial low-resolution lowercase `a`:")
console.log(glyphImage.printToString())
console.log("")

glyphImage.normalizeColorRange()

assert.deepEqual([...glyphImage.buffer],
[
	78, 209, 239, 242, 216, 74,
	198, 199, 28, 52, 224, 172,
	33, 65, 114, 152, 226, 186,
	156, 243, 218, 192, 219, 186,
	239, 147, 0, 0, 216, 186,
	219, 210, 147, 194, 243, 192,
	74, 177, 191, 141, 109, 151
])