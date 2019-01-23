import { ByteReader } from "./byteReader.mjs"
import { Font, FontCollection } from "./font.mjs"
import { FontRenderer } from "./fontRenderer.mjs"


let gFontCollection = null
let gFontIndex = 0
let gRenderGlyphTimeout = null


const inputFile = document.getElementById("inputFile")
inputFile.onchange = () =>
{
	let reader = new FileReader()
	reader.onload = () => loadFont(new Uint8Array(reader.result))
	
	reader.readAsArrayBuffer(inputFile.files[0])
}

document.getElementById("checkboxDrawMetrics").onchange = () => refresh()
document.getElementById("checkboxSortUnicode").onchange = () => refresh()
document.getElementById("checkboxCustomRender").onchange = () => refresh()


function loadFont(buffer)
{
	let r = new ByteReader(buffer)
	
	try { gFontCollection = FontCollection.fromReader(r) }
	catch (e)
	{
		window.alert("Error loading font!")
		throw e
	}
	
	for (const warning of gFontCollection.warnings)
		console.warn(warning)
	
	let selectFontIndex = document.getElementById("selectFontIndex")
	while (selectFontIndex.firstChild)
		selectFontIndex.removeChild(selectFontIndex.firstChild)
	
	for (let i = 0; i < gFontCollection.fonts.length; i++)
	{
		const familyName = gFontCollection.fonts[i].fontFamilyName
		const subfamilyName = gFontCollection.fonts[i].fontSubfamilyName
		const fullName = "[" + i + "] " +
			(familyName == null || subfamilyName == null ? "" : familyName + " " + subfamilyName)
		
		let option = document.createElement("option")
		option.innerHTML = fullName
		option.value = i
		selectFontIndex.appendChild(option)
	}
	
	selectFontIndex.selected = gFontIndex = 0
	selectFontIndex.disabled = (gFontCollection.fonts.length <= 1)
	selectFontIndex.onchange = () =>
	{
		gFontIndex = parseInt(selectFontIndex.value)
		refresh()
	}
	
	console.log(gFontCollection)
	refresh()
}


function refresh()
{
	buildGlyphList()
}


function buildGlyphList()
{
	let divGlyphList = document.getElementById("divGlyphList")
	while (divGlyphList.firstChild)
		divGlyphList.removeChild(divGlyphList.firstChild)
	
	if (gFontCollection == null)
		return
	
	let font = gFontCollection.getFont(gFontIndex)
	
	const unicodeMap = font.getUnicodeMap()
	let glyphToUnicodeMap = new Map()
	for (const [code, glyphId] of unicodeMap)
	{
		if (!glyphToUnicodeMap.has(glyphId))
			glyphToUnicodeMap.set(glyphId, code)
	}
	
	const sortByUnicode = document.getElementById("checkboxSortUnicode").checked
	
	const glyphCount = font.getGlyphCount()
	
	let glyphSlotsToAdd = []
	
	if (!sortByUnicode)
	{
		for (let glyphId = 0; glyphId < glyphCount; glyphId++)
			glyphSlotsToAdd.push({ glyphId, unicodeIndex: glyphToUnicodeMap.get(glyphId) })
	}
	else
	{
		let availableUnicode = []
		for (const [code, glyphId] of unicodeMap)
			availableUnicode.push(code)
		
		let availableGlyphsSet = new Set()
		for (let glyphId = 0; glyphId < glyphCount; glyphId++)
			availableGlyphsSet.add(glyphId)
		
		let prevUnicodeAdded = -1
		availableUnicode.sort((a, b) => a - b)
		for (const code of availableUnicode)
		{
			if (code != prevUnicodeAdded + 1 && prevUnicodeAdded >= 0)
				glyphSlotsToAdd.push({ glyphId: null, unicodeIndex: null })
			
			prevUnicodeAdded = code
			
			const glyphId = unicodeMap.get(code)
			glyphSlotsToAdd.push({ glyphId, unicodeIndex: code })
			availableGlyphsSet.delete(glyphId)
		}
		
		let availableGlyphs = []
		for (const glyphId of availableGlyphsSet)
			availableGlyphs.push(glyphId)
		
		availableGlyphs.sort((a, b) => a - b)
		
		if (availableGlyphs.length > 0)
			glyphSlotsToAdd.push({ glyphId: null, unicodeIndex: null })
		
		for (const glyphId of availableGlyphs)
			glyphSlotsToAdd.push({ glyphId, unicodeIndex: null })
	}
	
	if (gRenderGlyphTimeout != null)
		window.clearTimeout(gRenderGlyphTimeout)
	
	const useCustomRasterizer = document.getElementById("checkboxCustomRender").checked
	addGlyphSlotIterator(glyphSlotsToAdd, useCustomRasterizer ? 5 : 1000)
}


function addGlyphSlotIterator(glyphSlotsToAdd, countPerIteration, i = 0)
{
	let count = countPerIteration
	while (count > 0)
	{
		count--
		if (i >= glyphSlotsToAdd.length)
			return
		
		addGlyphSlot(glyphSlotsToAdd[i].glyphId, glyphSlotsToAdd[i].unicodeIndex)
		i++
	}
	
	gRenderGlyphTimeout = window.setTimeout(() => addGlyphSlotIterator(glyphSlotsToAdd, countPerIteration, i), 0)
}


function addGlyphSlot(glyphId, unicodeIndex)
{
	let font = gFontCollection.getFont(gFontIndex)
	
	let glyphListItem = document.createElement("div")
	glyphListItem.className = "glyphListItem"
	
	let glyphLabel = "..."
	if (glyphId != null)
		glyphLabel = "#" + glyphId.toString() + " (U+" + (unicodeIndex == null ? "????" : unicodeIndex.toString(16).padStart(4, "0")) + ")"
	
	let glyphListItemLabel = document.createElement("div")
	glyphListItemLabel.className = "glyphListItemLabel"
	glyphListItemLabel.innerHTML = glyphLabel
	
	let glyphListItemCanvas = document.createElement("canvas")
	glyphListItemCanvas.className = "glyphListItemCanvas"
	glyphListItemCanvas.width = "100"
	glyphListItemCanvas.height = "100"
	
	glyphListItem.appendChild(glyphListItemLabel)
	glyphListItem.appendChild(glyphListItemCanvas)
	divGlyphList.appendChild(glyphListItem)
	
	glyphListItem.ondblclick = () =>
	{
		if (glyphId == null)
			return
		
		console.log("Data for glyph " + glyphLabel + ":")
		console.log(font.getGlyphData(glyphId))
		console.log(font.getGlyphGeometry(glyphId))
		
		if (unicodeIndex != null)
			window.open("https://r12a.github.io/uniview/?charlist=" + String.fromCodePoint(unicodeIndex), "_blank")
	}
	
	let ctx = glyphListItemCanvas.getContext("2d")
	
	const drawMetrics = document.getElementById("checkboxDrawMetrics").checked
	const useCustomRasterizer = document.getElementById("checkboxCustomRender").checked
	
	const lineMetrics = font.getHorizontalLineMetrics()
	
	const geometry = (glyphId == null ? null : font.getGlyphGeometry(glyphId))
	
	if (useCustomRasterizer)
		renderGlyphGeometryCustom(ctx, geometry, lineMetrics, drawMetrics)
	else
		renderGlyphGeometry(ctx, geometry, lineMetrics, drawMetrics)
}


function renderGlyphGeometryCustom(ctx, geometry, lineMetrics, drawMetrics)
{
	ctx.fillStyle = (geometry == null ? "#fee" : geometry.isComposite ? "#f8eeff" : "#fff")
	ctx.fillRect(-100, -100, 200, 200)
	
	if (geometry == null)
		return
	
	const img = FontRenderer.renderGlyph(Font.simplifyBezierContours(geometry), 90, 0)

	ctx.fillStyle = "#f00"
	for (let y = 0; y < 100; y++)
	{
		for (let x = 0; x < 100; x++)
		{
			if ((x + y) % 2 == 0)
				ctx.fillRect(x, y, 1, 1)
		}
	}
	
	ctx.fillStyle = "#000"
	for (let y = 0; y < img.height; y++)
	{
		for (let x = 0; x < img.width; x++)
		{
			const value = img.buffer[y * img.width + x]
			ctx.fillStyle = value > 0 ? "#fff" : "#000"
			ctx.fillRect(x, y, 1, 1)
		}
	}
}


function renderGlyphGeometry(ctx, geometry, lineMetrics, drawMetrics)
{
	ctx.fillStyle = (geometry == null ? "#fee" : geometry.isComposite ? "#f8eeff" : "#fff")
	ctx.fillRect(-100, -100, 200, 200)
	
	if (geometry == null)
		return
	
	const scale = 1 / (lineMetrics.lineBottom - lineMetrics.lineTop + lineMetrics.lineGap * 2) * 90
	
	ctx.translate(50, 50)
	ctx.scale(scale, scale)
	
	if (drawMetrics)
		ctx.translate(-geometry.advance / 2, -(lineMetrics.lineTop + lineMetrics.lineBottom) / 2)
	else
		ctx.translate(-(geometry.xMax + geometry.xMin) / 2, -(geometry.yMax + geometry.yMin) / 2)
	
	if (drawMetrics)
	{
		ctx.fillStyle = "#fb8"
		ctx.fillRect(-1000, -1000, 2000, lineMetrics.lineTop + 1000)
		ctx.fillRect(-1000, lineMetrics.lineBottom, 2000, 1000)
		
		ctx.fillStyle = "#f96"
		ctx.fillRect(-1000, -1000, 2000, lineMetrics.lineTop - lineMetrics.lineGap + 1000)
		ctx.fillRect(-1000, lineMetrics.lineBottom + lineMetrics.lineGap, 2000, 1000)
		
		ctx.lineWidth = 1 / scale
		
		ctx.strokeStyle = "#080"
		ctx.beginPath()
		ctx.moveTo(-1000, 0)
		ctx.lineTo( 1000, 0)
		ctx.moveTo(0, -1000)
		ctx.lineTo(0,  1000)
		ctx.stroke()
		
		ctx.strokeStyle = "#00f"
		ctx.beginPath()
		ctx.moveTo(geometry.advance, -1000)
		ctx.lineTo(geometry.advance,  1000)
		ctx.stroke()
	}
	
	ctx.fillStyle = "#000"
	ctx.beginPath()
	
	for (const contour of geometry.contours)
	{
		ctx.moveTo(contour[0].x1, contour[0].y1)
		
		for (const segment of contour)
		{
			if (segment.kind == "line")
				ctx.lineTo(segment.x2, segment.y2)
			
			else if (segment.kind == "qbezier")
				ctx.quadraticCurveTo(segment.x2, segment.y2, segment.x3, segment.y3)
		}
		
		ctx.lineTo(contour[0].x1, contour[0].y1)
	}
		
	ctx.fill()
}