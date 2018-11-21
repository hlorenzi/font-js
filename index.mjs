import { Font } from "./src/font.mjs"
import { FontRenderer } from "./src/fontRenderer.mjs"
import fs from "fs"
import minimist from "minimist"
import PNG from "pngjs"


const usage =
`
Usage:
	font-inspect <FONT-FILE> [options]

Options:
	--glyphs GLYPH-LIST  (default "U+0..U+ff")
		The list of glyphs to extract.
		You can use decimal glyph IDs (#1234), hex Unicode codepoints (U+1abcd), ranges (..), and commas.
		You can also just use an asterisk (*) to specify all glyphs.
		Example: "U+0..U+7f,#500..#650,U+1e000"
		
	--mode MODE  (default "png-grayscale")
		The kind of information to extract from glyphs.
		Available modes:
		
		"json"
			JSON file containing the character mapping, metrics and full geometry data.
			
		"json-simplified"
			JSON file as above but with simplified geometry data consisting only
			of straight lines.
			
		"png-binary"
			PNG file with a black-and-white rasterization of the glyph, along with
			a JSON file as above, with metrics relative to the generated image.
			
		"png-grayscale"
			PNG file with a 256-level grayscale rasterization of the glyph, along with
			a JSON file as above, with metrics relative to the generated image.
			
		"png-distance"
			PNG file with a distance field rasterization of the glyph, along with
			a JSON file as above, with metrics relative to the generated image.
			
	--out OUTPUT-FILENAME  (default "./glyph{glyphid}")
		The output filename to use for generated files.
		The correct file extension will be appended automatically.
		You can include the following tags to be replaced at output time:
		
		"{glyphid}" Decimal glyph ID of the current glyph, without the # prefix.
		"{unicode}" Hex Unicode codepoint of the current glyph, without the U+ prefix.
		
	--size SIZE  (default 256)
		The size of 1 font unit in pixels (usually the height of a line of text)
		for image generation.
		
	--use-alpha  (default no)
		Use the alpha channel in generated images, instead of the color channels.
`

const exitWithUsage = () =>
{
	console.error(usage)
	process.exit(0)
}

// Parse command line arguments.
const opts = minimist(process.argv.slice(2))

if (opts._.length != 1)
	exitWithUsage()

const argFontFile = opts._[0]
const argSize = opts.size || 256
const argOut = opts.out || "./glyph{glyphid}"

// Load the font file.
const bytes = fs.readFileSync(argFontFile)
const font = Font.fromBytes(bytes)

// Load the glyph list.
const argGlyphList = []
if (!opts.glyphs || opts.glyphs == "*")
{
	for (const id of font.enumerateGlyphIds())
		argGlyphList.push(id)
}

// Render glyphs.
for (const glyphId of argGlyphList)
{
	console.log("glyph " + glyphId + "...")
	
	//const glyphId = font.getUnicodeMap().get("M".codePointAt(0))
	const geometry = font.getGlyphGeometry(glyphId, 100)
	const image = FontRenderer.renderGlyph(geometry, argSize)

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
	
	let outputFilename = argOut
		.replace(/\{glyphid\}/, glyphId.toString().padStart(6))

	fs.writeFileSync(outputFilename + ".png", PNG.PNG.sync.write(png))
}