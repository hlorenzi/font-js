export class GlyphImage
{
	constructor(width, height, emScale, xOrigin, yOrigin)
	{
		this.width = width
		this.height = height
		this.buffer = new Float64Array(width * height)
		this.emScale = emScale
		this.xOrigin = xOrigin
		this.yOrigin = yOrigin
	}
	
	
	setPixel(x, y, c)
	{
		if (x < 0 || y < 0 || x >= this.width || y >= this.height)
			return
		
		this.buffer[y * this.width + x] = c
	}
	
	
	getPixel(x, y)
	{
		if (x < 0 || y < 0 || x >= this.width || y >= this.height)
			return 0
		
		return this.buffer[y * this.width + x]
	}
	
	
	mapPixels(fn)
	{
		for (let y = 0; y < this.height; y++)
		for (let x = 0; x < this.width; x++)
			this.buffer[y * this.width + x] = fn(this.buffer[y * this.width + x])
	}
	
	
	binarize(cutoff = 0.5)
	{
		this.mapPixels(c => c > cutoff ? 1 : 0)
	}
	
	
	outline(min, max)
	{
		this.mapPixels(c => c >= min && c <= max ? 1 : 0)
	}
	
	
	normalizeColorRange()
	{
		this.mapPixels(c => Math.max(0, Math.min(255, Math.floor(c * 255))))
	}
	
	
	normalizeSignedDistance(rangeMin, rangeMax)
	{
		this.mapPixels(c => 1 - (c - rangeMin) / (rangeMax - rangeMin))
	}
	
	
	getDownsampled(gamma = 2.2)
	{
		const newImage = new GlyphImage(Math.floor(this.width / 16), Math.floor(this.height / 16), this.emScale / 16, this.xOrigin / 16, this.yOrigin / 16)
		
		for (let y = 0; y < newImage.height; y++)
		for (let x = 0; x < newImage.width; x++)
		{
			let accum = 0
			for (let yy = 0; yy < 16; yy++)
			for (let xx = 0; xx < 16; xx++)
				accum += this.getPixel(x * 16 + xx, y * 16 + yy)
			
			newImage.setPixel(x, y, Math.pow(accum / 256, 1 / gamma))
		}
		
		return newImage
	}
	
	
	getWithBorder(borderSize)
	{
		const newImage = new GlyphImage(this.width + borderSize * 2, this.height + borderSize * 2, this.emScale, this.xOrigin + borderSize, this.yOrigin + borderSize)
		
		for (let y = 0; y < newImage.height; y++)
		for (let x = 0; x < newImage.width; x++)
			newImage.setPixel(x, y, this.getPixel(x - borderSize, y - borderSize))
		
		return newImage
	}
	
	
	crop(wNew, hNew, xFrom, yFrom)
	{
		const newImage = new GlyphImage(wNew, hNew, this.emScale, this.xOrigin + xFrom, this.yOrigin + yFrom)
		
		for (let y = 0; y < newImage.height; y++)
		for (let x = 0; x < newImage.width; x++)
			newImage.setPixel(x, y, this.getPixel(x + xFrom, y + yFrom))
		
		return newImage
	}
	
	
	cropped()
	{
		let found = false
		
		let xMin = 0
		for (let x = 0; x < this.width && !found; x++)
		{
			xMin = x
			for (let y = 0; y < this.height && !found; y++)
			{
				if (this.getPixel(x, y) > 0)
					found = true
			}
		}
		
		found = false
		let xMax = this.width - 1
		for (let x = this.width - 1; x >= 0 && !found; x--)
		{
			xMax = x
			for (let y = 0; y < this.height && !found; y++)
			{
				if (this.getPixel(x, y) > 0)
					found = true
			}
		}
		
		found = false
		let yMin = 0
		for (let y = 0; y < this.height && !found; y++)
		{
			yMin = y
			for (let x = 0; x < this.width && !found; x++)
			{
				if (this.getPixel(x, y) > 0)
					found = true
			}
		}
		
		found = false
		let yMax = this.height - 1
		for (let y = this.height - 1; y >= 0 && !found; y--)
		{
			yMax = y
			for (let x = 0; x < this.width && !found; x++)
			{
				if (this.getPixel(x, y) > 0)
					found = true
			}
		}
		
		return this.crop(xMax + 1 - xMin, yMax + 1 - yMin, xMin, yMin)
	}
	
	
	getSignedDistanceField()
	{
		const calcDist = (obj) => Math.sqrt(obj.dx * obj.dx + obj.dy * obj.dy)
		const calcDistSqr = (obj) => (obj.dx * obj.dx + obj.dy * obj.dy)
		
		const getUnsignedDF = (invert) =>
		{
			const distanceBuffer = []
			for (let y = 0; y < this.height; y++)
			for (let x = 0; x < this.width; x++)
				distanceBuffer.push((invert ? this.getPixel(x, y) < 0.5 : this.getPixel(x, y) >= 0.5) ? { dx: 0, dy: 0 } : { dx: Infinity, dy: Infinity })
			
			const compare = (dCur, x, y, xOff, yOff) =>
			{
				const xx = x + xOff
				const yy = y + yOff
				if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height)
					return
				
				const dOther = distanceBuffer[yy * this.width + xx]
				const dNew = { dx: dOther.dx + xOff, dy: dOther.dy + yOff }
				if (calcDistSqr(dNew) < calcDistSqr(dCur))
				{
					dCur.dx = dNew.dx
					dCur.dy = dNew.dy
				}
			}
			
			for (let y = 0; y < this.height; y++)
			{
				for (let x = 0; x < this.width; x++)
				{
					const d = distanceBuffer[y * this.width + x]
					compare(d, x, y, -1,  0)
					compare(d, x, y,  0, -1)
					compare(d, x, y, -1, -1)
					compare(d, x, y,  1, -1)
					distanceBuffer[y * this.width + x] = d
				}

				for (let x = this.width - 1; x >= 0; x--)
				{
					const d = distanceBuffer[y * this.width + x]
					compare(d, x, y, 1, 0)
					distanceBuffer[y * this.width + x] = d
				}
			}

			for (let y = this.height - 1; y >= 0; y--)
			{
				for (let x = this.width - 1; x >= 0; x--)
				{
					const d = distanceBuffer[y * this.width + x]
					compare(d, x, y,  1, 0)
					compare(d, x, y,  0, 1)
					compare(d, x, y, -1, 1)
					compare(d, x, y,  1, 1)
					distanceBuffer[y * this.width + x] = d
				}

				for (let x = 0; x < this.width; x++)
				{
					const d = distanceBuffer[y * this.width + x]
					compare(d, x, y, -1, 0)
					distanceBuffer[y * this.width + x] = d
				}
			}
			
			return distanceBuffer
		}
		
		const outsideDF = getUnsignedDF(false)
		const insideDF = getUnsignedDF(true)
		
		const newImage = new GlyphImage(this.width, this.height, this.emScale, this.xOrigin, this.yOrigin)
		
		for (let y = 0; y < this.height; y++)
		for (let x = 0; x < this.width; x++)
		{
			const outsideD = calcDist(outsideDF[y * this.width + x])
			const insideD  = calcDist(insideDF [y * this.width + x])
			newImage.setPixel(x, y, outsideD <= 0 ? -insideD : outsideD)
		}
		
		return newImage
	}
	
	
	getSignedDistanceFieldSlow()
	{
		const newImage = new GlyphImage(this.width, this.height, this.emScale, this.xOrigin, this.yOrigin)
		
		for (let y = 0; y < this.height; y++)
		for (let x = 0; x < this.width; x++)
		{
			let minDist = Infinity
			
			const c1 = this.getPixel(x, y)
			
			const testPixel = (xx, yy) =>
			{
				const dx = xx - x
				const dy = yy - y
				const d = dx * dx + dy * dy
				if (d >= minDist * minDist)
					return
					
				const c2 = this.getPixel(xx, yy)
				
				if (c1 < 0.5 && c2 < 0.5)
					return
				
				if (c1 >= 0.5 && c2 >= 0.5)
					return
				
				minDist = Math.sqrt(d)
			}
			
			for (let t = 0; t < Math.max(this.width, this.height) && t < minDist; t++)
			{
				for (let yy = -t; yy <= t; yy++)
				{
					testPixel(x - t, y + yy)
					testPixel(x + t, y + yy)
				}
				
				for (let xx = -t; xx <= t; xx++)
				{
					testPixel(x + xx, y - t)
					testPixel(x + xx, y + t)
				}
			}
			
			const dSigned = (c1 >= 0.5 ? -1 : 1) * minDist
			newImage.setPixel(x, y, dSigned)
		}
		
		return newImage
	}
	
	
	printToString()
	{
		let str = ""
		for (let y = 0; y < this.height; y++)
		{
			for (let x = 0; x < this.width; x++)
			{
				const c = this.getPixel(x, y)
				
				if (c > 0.8) str += "█"
				else if (c > 0.6) str += "▓"
				else if (c > 0.4) str += "▒"
				else if (c > 0.2) str += "░"
				else str += " "
			}
			
			if (y < this.height - 1)
				str += "\n"
		}
		
		return str
	}
}


export class GlyphRenderer
{
	static render(geometry, emToPixelSize)
	{
		for (const contour of geometry.contours)
		for (const edge of contour)
			if (edge.kind != "line")
				throw "can only render geometries consisting of straight lines; try using the `simplifySteps` argument of `Font#getGlyphGeometry`"
		
		const snap = (x, s) => Math.floor(x * s) / s
		
		const glyphEmW = geometry.xMax - geometry.xMin
		const glyphEmH = geometry.yMax - geometry.yMin
		
		const pixelW = snap(Math.ceil(glyphEmW * emToPixelSize) + 48, 16)
		const pixelH = snap(Math.ceil(glyphEmH * emToPixelSize) + 48, 16)
		
		const pixelOffsetX = Math.ceil(-geometry.xMin * emToPixelSize) + 16
		const pixelOffsetY = Math.ceil(-geometry.yMin * emToPixelSize) + 16
		
		const render = new GlyphImage(pixelW, pixelH, emToPixelSize, pixelOffsetX, pixelOffsetY)
		
		let intersectingEdges = []
		for (const contour of geometry.contours)
		{
			for (const edge of contour)
			{
				if (edge.y1 == edge.y2)
					continue
				
				intersectingEdges.push({
					x1: edge.x1,
					y1: edge.y1,
					x2: edge.x2,
					y2: edge.y2,
					xAtCurrentScanline: 0,
					winding: 0
				})
			}
		}
		
		for (let y = 0; y < pixelH; y++)
		{
			const yEmSpace = (y - pixelOffsetY) / emToPixelSize
			
			for (let edge of intersectingEdges)
			{
				if (Math.min(edge.y1, edge.y2) >= yEmSpace || Math.max(edge.y1, edge.y2) < yEmSpace)
				{
					edge.xAtCurrentScanline = 0
					edge.winding = 0
					continue
				}
				
				edge.xAtCurrentScanline = edge.x1 + ((yEmSpace - edge.y1) / (edge.y2 - edge.y1)) * (edge.x2 - edge.x1)
				edge.winding = (edge.y2 > edge.y1) ? 1 : -1
			}
			
			intersectingEdges.sort((a, b) => a.xAtCurrentScanline - b.xAtCurrentScanline)
			
			let currentWinding = 0
			let currentIntersection = 0
			for (let x = 0; x < pixelW; x++)
			{
				const xEmSpace = (x - pixelOffsetX) / emToPixelSize
				
				while (currentIntersection < intersectingEdges.length &&
					intersectingEdges[currentIntersection].xAtCurrentScanline <= xEmSpace)
				{
					currentWinding += intersectingEdges[currentIntersection].winding
					currentIntersection += 1
				}
				
				render.setPixel(x, y, (currentWinding == 0 ? 0 : 1))
			}
		}
		
		return render
	}
}