import { ByteReader } from "./byteReader.js"
import { Font } from "./font.js"


const inputFile = document.getElementById("inputFile")
inputFile.onchange = () =>
{
	let reader = new FileReader()
	reader.onload = () => loadFont(new Uint8Array(reader.result))
	
	reader.readAsArrayBuffer(inputFile.files[0])
}


function loadFont(buffer)
{
	let r = new ByteReader(buffer)
	let font = Font.fromReader(r)
	
	for (const warning of font.warnings)
		console.warn(warning)
	
	console.log(font)
	
	let divGlyphList = document.getElementById("divGlyphList")
	while (divGlyphList.firstChild)
		divGlyphList.removeChild(divGlyphList.firstChild)
	
	for (const glyphId of font.enumerateGlyphIds())
	{
		let glyphListItem = document.createElement("div")
		glyphListItem.className = "glyphListItem"
		
		let glyphListItemCanvas = document.createElement("canvas")
		glyphListItemCanvas.className = "glyphListItemCanvas"
		glyphListItemCanvas.width = "100"
		glyphListItemCanvas.height = "100"
		
		glyphListItem.appendChild(glyphListItemCanvas)
		divGlyphList.appendChild(glyphListItem)
		
		glyphListItem.onclick = () =>
		{
			console.log("Internal data for glyph 0x" + glyphId.toString(16) + ":")
			console.log(font.getGlyphData(glyphId))
		}
		
		let ctx = glyphListItemCanvas.getContext("2d")
		ctx.translate(50, 50)
		ctx.scale(90, 90)
		
		let geometry = font.getGlyphGeometry(glyphId)
		if (geometry != null)
		{
			ctx.translate(-(geometry.xMax + geometry.xMin) / 2, -(geometry.yMax + geometry.yMin) / 2)
			renderGlyphGeometry(ctx, geometry)
		}
		else
		{
			ctx.fillStyle = "#fee"
			ctx.fillRect(-100, -100, 200, 200)
		}
	}
}


function renderGlyphGeometry(ctx, geometry)
{
	ctx.fillStyle = geometry.isComposite ? "#f8eeff" : "#fff"
	ctx.fillRect(-100, -100, 200, 200)
	
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