import { Font } from "./src/font.mjs"
import { FontRenderer } from "./src/fontRenderer.mjs"
import { parseGlyphRange } from "./glyphRangeParser.mjs"
import fs from "fs"
import minimist from "minimist"
import PNG from "pngjs"
import path from "path"


const usage =
`
Usage:
	font-inspect <FONT_FILE> [options]

Options:
	--glyphs <GLYPH_LIST>  (default "*")
		The list of glyphs to extract.
		You can use decimal glyph IDs (#1234), hex Unicode codepoints (U+1abcd), ranges (..), and commas.
		You can also use an asterisk (*) to specify all glyphs, and (U+*) to specify all Unicode codepoints.
		Example: "U+0..U+7f,#500..#650,U+1e000"
		
	--img-mode <MODE>  (default "png-grayscale")
		The image format to which glyphs will be rendered.
		Available formats:
		
		"none"
			Does not output image files.
			
		"png-binary"
			PNG file with a black-and-white rasterization of the glyph,
			where white corresponds to areas on the inside of contours.
			Can be combined with the '--use-alpha' option.
		
		"png-grayscale"
			PNG file with a 256-level grayscale rasterization of the glyph,
			where white corresponds to areas on the inside of contours.
			Can be combined with the '--use-alpha' and '--gamma' options.
		
		"png-sdf"
			PNG file with a 256-level grayscale signed distance field,
			mapped to colors using the '--sdf-min' and '--sdf-max' options.
			Can be combined with the '--use-alpha' option.
			
	--data-mode <MODE>  (default "json")
		The data format to which glyph metadata will be extracted.
		Available formats:
		
		"none"
			Does not output glyph metadata.
			
		"json"
			JSON file containing character mapping and metrics.
			
		"json-full"
			JSON file containing character mapping, metrics, and full geometry data.
			
		"json-simplified"
			JSON file as above, but with simplified geometry data where curves have been
			converted to line segments, using the '--curve-precision' option.
			
	--out <FILENAME>  (default "./glyph_[glyphid]")
		Shortcut for both '--img-out' and '--data-out'.
		The output filename of each glyph extracted, without the file extension.
		You can include the following tags, which will automatically be replaced
		by their respective values:
		
		"[glyphid]" Decimal glyph ID of the current glyph, without the # prefix.
		"[unicode]" Hex Unicode codepoint of the current glyph, without the U+ prefix.
		
	--img-out <FILENAME>  (default "./glyph_[glyphid]")
		The output filename of image files, without the file extension.
		You can include the same tags as described above in the '--out' option.
		
	--data-out <FILENAME>  (default "./glyph_[glyphid]")
		The output filename of data files, without the file extension.
		You can include the same tags as described above in the '--out' option.
		
	--size <PIXELS>  (default 256)
		The size of 1 font unit in pixels (usually the height of a line of text)
		for image generation.
		
	--outline-min <PIXELS>
	--outline-max <PIXELS>
		Render glyphs as an outline.
		
	--sdf-min <PIXELS>
	--sdf-max <PIXELS>
		Distance range for signed distance fields.
		
	--coallesce-unicode
		For glyphs that map to many Unicode codepoints, export only one entry under
		the most common codepoint, but specify all codepoints in their data files.
		
	--use-alpha
		Use the alpha channel in generated images, instead of the color channels.
		
	--gamma <VALUE>  (default 2.2)
		The gamma correction value for grayscale image output.
		
	--curve-precision <VALUE>  (default 100)
		The number of line segments to which curves will be converted
		for rendering.
		
	--ignore-img-metrics
		Force use normalized EM units in the data output, disregarding any rendered images.
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
const argOut = opts["out"] || "./glyph_[glyphid]"
const argImgMode = opts["img-mode"] || "png-grayscale"
const argImgOut = opts["img-out"] || argOut
const argSize = parseInt(opts.size) || 256
const argDataMode = opts["data-mode"] || "json"
const argDataOut = opts["data-out"] || argOut
const argCoallesceUnicode = !!opts["coallesce-unicode"]
const argUseAlpha = !!opts["use-alpha"]
const argGamma = parseFloat(opts.gamma) || 2.2
const argCurvePrecision = parseInt(opts["curve-precision"]) || 100
const argIgnoreImgMetrics = !!opts["ignore-img-metrics"]

const argSDFMin = parseFloat(opts["sdf-min"])
const argSDFMax = parseFloat(opts["sdf-max"])
const argOutlineMin = parseFloat(opts["outline-min"])
const argOutlineMax = parseFloat(opts["outline-max"])

// Load the font file.
const bytes = fs.readFileSync(argFontFile)
const font = Font.fromBytes(bytes)

// Load the glyph list.
const unicodeMap = font.getUnicodeMap()

const argGlyphs = (opts.glyphs || "*").toLowerCase()
let argGlyphList = parseGlyphRange(argGlyphs)
if (argGlyphs == "*")
{
	for (const id of font.enumerateGlyphIds())
		argGlyphList.glyphIds.push(id)
}
else if (argGlyphs == "u+*")
{
	for (const [codepoint, glyphId] of unicodeMap)
		argGlyphList.unicodeCodepoints.push(codepoint)
}

for (const unicodeCodepoint of argGlyphList.unicodeCodepoints)
{
	if (unicodeMap.has(unicodeCodepoint))
		argGlyphList.glyphIds.push(unicodeMap.get(unicodeCodepoint))
}

argGlyphList.glyphIds = [...new Set(argGlyphList.glyphIds)]

let resolvedGlyphList = []
for (const glyphId of argGlyphList.glyphIds)
{
	if (argCoallesceUnicode)
	{
		let unicodeCodepoints = []
		for (const [codepoint, id] of unicodeMap)
		{
			if (glyphId == id)
				unicodeCodepoints.push(codepoint)
		}
		
		resolvedGlyphList.push(
		{
			glyphId,
			unicodeCodepoints
		})
	}
	else
	{
		let hadACodepoint = false
		for (const [codepoint, id] of unicodeMap)
		{
			if (glyphId == id)
			{
				hadACodepoint = true
				resolvedGlyphList.push(
				{
					glyphId,
					unicodeCodepoints: [codepoint]
				})
			}
		}
		
		if (!hadACodepoint)
			resolvedGlyphList.push(
			{
				glyphId,
				unicodeCodepoints: []
			})
	}
}

// Render glyphs.
for (const glyph of resolvedGlyphList)
{
	console.log("extracting glyph #" + glyph.glyphId + ": [" + glyph.unicodeCodepoints.map(c => "U+" + c.toString(16)).join(",") + "]...")
	
	let renderedImage = null
	if (argImgMode != "none")
	{
		const geometry = font.getGlyphGeometry(glyph.glyphId, argCurvePrecision)
		
		renderedImage = FontRenderer.renderGlyph(geometry, argSize * 16)
		
		if (argImgMode == "png-sdf")
		{
			renderedImage = renderedImage.getWithBorder(argSDFMax * 16)
			renderedImage = renderedImage.getSignedDistanceField()
			renderedImage.normalizeSignedDistance(argSDFMin * 16, argSDFMax * 16)
		}
		
		else if (!isNaN(argOutlineMin) && !isNaN(argOutlineMax))
		{
			renderedImage = renderedImage.getWithBorder(argOutlineMax * 16)
			renderedImage = renderedImage.getSignedDistanceField()
			renderedImage.outline(argOutlineMin * 16, argOutlineMax * 16)
		}
		
		renderedImage = renderedImage.getDownsampled(argImgMode == "png-sdf" ? 1 : argGamma)
		
		if (argImgMode == "png-binary")
			renderedImage.binarize()
		
		renderedImage.normalizeColorRange()

		let png = new PNG.PNG({ width: renderedImage.width, height: renderedImage.height, colorType: 6 })
		for (let y = 0; y < renderedImage.height; y++)
		{
			for (let x = 0; x < renderedImage.width; x++)
			{
				const i = (y * renderedImage.width + x)
				
				if (argUseAlpha)
				{
					png.data[i * 4 + 0] = 255
					png.data[i * 4 + 1] = 255
					png.data[i * 4 + 2] = 255
					png.data[i * 4 + 3] = renderedImage.buffer[i]
				}
				else
				{
					png.data[i * 4 + 0] = renderedImage.buffer[i]
					png.data[i * 4 + 1] = renderedImage.buffer[i]
					png.data[i * 4 + 2] = renderedImage.buffer[i]
					png.data[i * 4 + 3] = 255
				}
			}
		}
		
		const outputFilename = argImgOut
			.replace(/\[glyphid\]/g, glyph.glyphId.toString())
			.replace(/\[unicode\]/g, (glyph.unicodeCodepoints.length == 0 ? "" : glyph.unicodeCodepoints[0].toString(16)))
			
		fs.writeFileSync(outputFilename + ".png", PNG.PNG.sync.write(png))
	}
	
	if (argDataMode != "none")
	{
		const geometry = font.getGlyphGeometry(glyph.glyphId, argDataMode != "json-simplified" ? 0 : argCurvePrecision)
		geometry.xMin = geometry.xMin || 0
		geometry.xMax = geometry.xMax || 0
		geometry.yMin = geometry.yMin || 0
		geometry.yMax = geometry.yMax || 0
		geometry.advance = geometry.advance || 0
		
		let metrics =
		{
			width: geometry.xMax - geometry.xMin,
			height: geometry.yMax - geometry.yMin,
			xOrigin: 0,
			yOrigin: 0,
			xAdvance: geometry.advance,
			emToPixels: null,
		}
		
		if (renderedImage && !argIgnoreImgMetrics)
		{
			metrics =
			{
				width: renderedImage.width,
				height: renderedImage.height,
				xOrigin: renderedImage.xOrigin,
				yOrigin: renderedImage.yOrigin,
				xAdvance: renderedImage.emScale * geometry.advance,
				emToPixels: renderedImage.emScale,
			}
		}
		
		let json =
		{
			...glyph,
			...metrics,
		}
		
		if (argDataMode != "json")
			json.contours = geometry.contours
		
		const mainUnicodeCodepoint = (glyph.unicodeCodepoints.length == 0 ? null : glyph.unicodeCodepoints[0])
		
		const outputFilename = argDataOut
			.replace(/\[glyphid\]/g, glyph.glyphId.toString())
			.replace(/\[unicode\]/g, mainUnicodeCodepoint == null ? "" : mainUnicodeCodepoint.toString(16))
			
		if (argDataMode != "xml-sprsheet")
		{			
			const jsonStr = JSON.stringify(json, null, 4)
			fs.writeFileSync(outputFilename + ".json", jsonStr)
		}
		else
		{
			const filenameWithoutFolder = path.basename(outputFilename + ".png")
			const xml =
				`<sprite-sheet src="` + filenameWithoutFolder + `">
					<sprite name="` + mainUnicodeCodepoint.toString(16) + `" x="0" y="0" width="` + metrics.width + `" height="` + metrics.height + `">
						<guide name="unicode" kind="string" value="` + mainUnicodeCodepoint + `"></guide>
						<guide name="base-advance" kind="vector"  x1="` + Math.floor(metrics.xOrigin) + `"  x2="` + Math.floor(metrics.xOrigin + metrics.xAdvance) + `"  y1="` + Math.floor(metrics.yOrigin) + `"  y2="` + Math.floor(metrics.yOrigin) + `"></guide>
					</sprite>
				</sprite-sheet>`

			fs.writeFileSync(outputFilename + ".sprsheet", xml)
		}
	}
}