import { ByteReader } from "./byteReader.js"
import { Font } from "./font.js"


let gFont = null


const inputFile = document.getElementById("inputFile")
inputFile.onchange = () =>
{
	let reader = new FileReader()
	reader.onload = () => loadFont(new Uint8Array(reader.result))
	
	reader.readAsArrayBuffer(inputFile.files[0])
}

document.getElementById("checkboxDrawMetrics").onchange = () => refresh()


function loadFont(buffer)
{
	let r = new ByteReader(buffer)
	gFont = Font.fromReader(r)
	
	for (const warning of gFont.warnings)
		console.warn(warning)
	
	console.log(gFont)
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
	
	if (gFont == null)
		return
	
	const drawMetrics = document.getElementById("checkboxDrawMetrics").checked
	
	const glyphCount = gFont.getGlyphCount()
	for (let glyphId = 0; glyphId < glyphCount; glyphId++)
	{
		let glyphListItem = document.createElement("div")
		glyphListItem.className = "glyphListItem"
		
		let glyphListItemLabel = document.createElement("div")
		glyphListItemLabel.className = "glyphListItemLabel"
		glyphListItemLabel.innerHTML = glyphId.toString(16)
		
		let glyphListItemCanvas = document.createElement("canvas")
		glyphListItemCanvas.className = "glyphListItemCanvas"
		glyphListItemCanvas.width = "100"
		glyphListItemCanvas.height = "100"
		
		glyphListItem.appendChild(glyphListItemLabel)
		glyphListItem.appendChild(glyphListItemCanvas)
		divGlyphList.appendChild(glyphListItem)
		
		glyphListItem.onclick = () =>
		{
			console.log("Internal data for glyph 0x" + glyphId.toString(16) + ":")
			console.log(gFont.getGlyphData(glyphId))
		}
		
		let ctx = glyphListItemCanvas.getContext("2d")
		
		let geometry = gFont.getGlyphGeometry(glyphId)
		renderGlyphGeometry(ctx, geometry, drawMetrics)
	}
}


function renderGlyphGeometry(ctx, geometry, drawMetrics)
{
	ctx.fillStyle = (geometry == null ? "#fee" : geometry.isComposite ? "#f8eeff" : "#fff")
	ctx.fillRect(-100, -100, 200, 200)
	
	if (geometry == null)
		return
	
	ctx.fillStyle = "#000"
	ctx.beginPath()
	
	const scale = 90
	
	ctx.translate(50, 50)
	ctx.scale(scale, scale)
	ctx.translate(-(geometry.xMax + geometry.xMin) / 2, -(geometry.yMax + geometry.yMin) / 2)
	
	if (drawMetrics)
	{
		ctx.strokeStyle = "#080"
		ctx.lineWidth = 1 / scale
		ctx.beginPath()
		ctx.moveTo(-1000, 0)
		ctx.lineTo( 1000, 0)
		ctx.moveTo(0, -1000)
		ctx.lineTo(0,  1000)
		ctx.stroke()
	}
	
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