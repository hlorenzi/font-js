import { Font } from "./src/font.mjs"
import { FontRenderer } from "./src/fontRenderer.mjs"
import { parseGlyphRange } from "./glyphRangeParser.mjs"
import fs from "fs"
import minimist from "minimist"
import PNG from "pngjs"


const usage =
`
Usage:
	font-inspect <FONT-FILE> [options]

Options:
	--glyphs GLYPH_LIST  (default "U+0..U+ff")
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
			
	--out OUTPUT_FILENAME  (default "./glyph[glyphid]")
		The output filename to use for generated files.
		The correct file extension will be appended automatically.
		You can include the following tags to be replaced at output time:
		
		"[glyphid]" Decimal glyph ID of the current glyph, without the # prefix.
		"[unicode]" Hex Unicode codepoint of the current glyph, without the U+ prefix.
		
	--size SIZE  (default 256)
		The size of 1 font unit in pixels (usually the height of a line of text)
		for image generation.
		
	--use-alpha
		Use the alpha channel in generated images, instead of the color channels.
		
	--gamma VALUE  (default 2.2)
		The gamma correction value to divide accumulated color samples for
		grayscale image outputs.
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
const argSize = parseInt(opts.size) || 256
const argOut = opts.out || "./glyph[glyphid]"
const argMode = opts.mode || "png-grayscale"
const argUseAlpha = !!opts["use-alpha"]
const argGamma = parseFloat(opts.gamma) || 2.2

// Load the font file.
const bytes = fs.readFileSync(argFontFile)
const font = Font.fromBytes(bytes)

// Load the glyph list.
let argGlyphList = parseGlyphRange(opts.glyphs || "*")
if (!argGlyphList)
{
	argGlyphList = { unicodeCodepoints: [], glyphIds: [] }
	for (const id of font.enumerateGlyphIds())
		argGlyphList.glyphIds.push(id)
}

// Render glyphs.
for (const glyphId of argGlyphList.glyphIds)
{
	console.log("glyph #" + glyphId + "...")
	
	//const glyphId = font.getUnicodeMap().get("M".codePointAt(0))
	const geometry = font.getGlyphGeometry(glyphId, 100)
	const image =
		argMode == "png-grayscale" ?
		FontRenderer.renderGlyphGrayscale(geometry, argSize, { gammaCorrection: argGamma }) :
		FontRenderer.renderGlyph(geometry, argSize)

	let png = new PNG.PNG({ width: image.width, height: image.height, colorType: 6 })
	for (let y = 0; y < image.height; y++)
	{
		for (let x = 0; x < image.width; x++)
		{
			const i = (y * image.width + x)
			
			if (argUseAlpha)
			{
				png.data[i * 4 + 0] = 255
				png.data[i * 4 + 1] = 255
				png.data[i * 4 + 2] = 255
				png.data[i * 4 + 3] = image.buffer[i]
			}
			else
			{
				png.data[i * 4 + 0] = image.buffer[i]
				png.data[i * 4 + 1] = image.buffer[i]
				png.data[i * 4 + 2] = image.buffer[i]
				png.data[i * 4 + 3] = 255
			}
		}
	}
	
	let outputFilename = argOut
		.replace(/\[glyphid\]/, glyphId.toString())

	fs.writeFileSync(outputFilename + ".png", PNG.PNG.sync.write(png))
}