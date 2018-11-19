import { Vec2 } from "./vec2.js"


export class FontRenderer
{
	static renderGlyph(geometry, emToPixelSize)
	{
		const width  = Math.ceil((geometry.xMax - geometry.xMin) * emToPixelSize) + 2
		const height = Math.ceil((geometry.yMax - geometry.yMin) * emToPixelSize) + 2
		
		let buffer = new Uint8Array(width * height)
		
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
		
		for (let y = 0; y < height; y++)
		{
			const yEmSpace = geometry.yMin + ((y - 1) / (height - 2)) * (geometry.yMax - geometry.yMin)
			
			for (let edge of intersectingEdges)
			{
				if (Math.min(edge.y1, edge.y2) >= yEmSpace || Math.max(edge.y1, edge.y2) < yEmSpace)
				{
					edge.xAtCurrentScanline = 0
					edge.winding = 0
					continue
				}
				
				edge.xAtCurrentScanline = edge.x1 + (yEmSpace - edge.y1) / (edge.y2 - edge.y1) * (edge.x2 - edge.x1)
				edge.winding = (edge.y2 > edge.y1) ? 1 : -1
			}
			
			intersectingEdges.sort((a, b) => a.xAtCurrentScanline - b.xAtCurrentScanline)
			
			let currentWinding = 0
			let currentIntersection = 0
			for (let x = 0; x < width; x++)
			{
				const xEmSpace = geometry.xMin + ((x - 1) / (width  - 2)) * (geometry.xMax - geometry.xMin)
				
				while (currentIntersection < intersectingEdges.length &&
					intersectingEdges[currentIntersection].xAtCurrentScanline <= xEmSpace)
				{
					currentWinding += intersectingEdges[currentIntersection].winding
					currentIntersection += 1
				}
				
				buffer[y * width + x] = (currentWinding == 0 ? 255 : 0)
			}
		}
		
		return { width, height, buffer }
	}
	
	
	static renderGlyphBySignedDistance(geometry, emToPixelSize)
	{
		const width  = Math.ceil((geometry.xMax - geometry.xMin) * emToPixelSize) + 2
		const height = Math.ceil((geometry.yMax - geometry.yMin) * emToPixelSize) + 2
		
		console.log("===")
		for (const contour of geometry.contours)
		{
			contour.winding = FontRenderer.windingValueForContour(contour)
			console.log(contour.winding)
		}
		
		let buffer = new Array(width * height).fill(255)
		
		for (let y = 0; y < height; y++)
		{
			for (let x = 0; x < width; x++)
			{
				const xEmSpace = geometry.xMin + ((x - 1) / (width  - 2)) * (geometry.xMax - geometry.xMin)
				const yEmSpace = geometry.yMin + ((y - 1) / (height - 2)) * (geometry.yMax - geometry.yMin)
				
				let distancesToContours = []
				let posDist = Infinity
				let negDist = -Infinity
				
				for (let c = 0; c < geometry.contours.length; c++)
				{
					const contour = geometry.contours[c]
					
					let minDistance = Infinity
					let minParam = 1
					for (const segment of contour)
					{
						const d = FontRenderer.signedDistanceToEdge(segment, xEmSpace, yEmSpace)
						if (Math.abs(d.dist) < Math.abs(minDistance) || (Math.abs(d.dist) == Math.abs(minDistance) && d.param < minParam))
						{
							minDistance = d.dist
							minParam = d.param
						}
					}
					
					distancesToContours[c] = minDistance
					
					if (contour.winding > 0 && minDistance >= 0 && Math.abs(minDistance) < Math.abs(posDist))
						posDist = minDistance
					if (contour.winding < 0 && minDistance <= 0 && Math.abs(minDistance) < Math.abs(negDist))
						negDist = minDistance
				}
				
				let finalDist = Infinity
				let finalWinding = 0
				
				if (posDist >= 0 && Math.abs(posDist) <= Math.abs(negDist))
				{
					finalDist = posDist
					finalWinding = 1
					for (let c = 0; c < geometry.contours.length; c++)
						if (geometry.contours[c].winding > 0 && distancesToContours[c] > finalDist && Math.abs(distancesToContours[c]) < Math.abs(negDist))
							finalDist = distancesToContours[c]
				}
				else if (negDist <= 0 && Math.abs(negDist) <= Math.abs(posDist))
				{
					finalDist = posDist
					finalWinding = -1
					for (let c = 0; c < geometry.contours.length; c++)
						if (geometry.contours[c].winding < 0 && distancesToContours[c] < finalDist && Math.abs(distancesToContours[c]) < Math.abs(posDist))
							finalDist = distancesToContours[c]
				}
				
				for (let c = 0; c < geometry.contours.length; c++)
					if (geometry.contours[c].winding != finalWinding && Math.abs(distancesToContours[c]) < Math.abs(finalDist))
						finalDist = distancesToContours[c]
				
				buffer[y * width + x] = finalDist / 0.1 + 0.5
			}
		}
		
		return { width, height, buffer }
	}
	
	
	static windingValueForContour(contour)
	{
		// From https://github.com/Chlumsky/msdfgen/blob/master/core/Contour.cpp
		const shoelace = (edge) => (edge.x2 - edge.x1) * (edge.y1 + edge.y2)
		
		let winding = 0
		for (const edge of contour)
			winding += shoelace(edge)
		
		return winding > 0 ? 1 : winding < 0 ? -1 : 0
	}
	
	
	static signedDistanceToEdge(edge, x, y)
	{
		const edgeVec = new Vec2(edge.x2 - edge.x1, edge.y2 - edge.y1)
		const posVec = new Vec2(x - edge.x1, y - edge.y1)
		
		const normalVec = edgeVec.clockwisePerpendicular()
		const isInside = normalVec.dot(posVec) <= 0
		const isInsideSign = (isInside ? -1 : 1)
		
		const projectionFactor = posVec.projectionFactor(edgeVec)
		
		if (projectionFactor <= 0)
			return { dist: posVec.sub(new Vec2(edge.x1, edge.y1)).magn() * isInside, param: Math.abs(edgeVec.dot(new Vec2(edge.x1, edge.y1).sub(new Vec2(x, y)))) }
		else if (projectionFactor >= 1)
			return { dist: posVec.sub(new Vec2(edge.x2, edge.y2)).magn() * isInside, param: Math.abs(edgeVec.dot(new Vec2(edge.x2, edge.y2).sub(new Vec2(x, y)))) }
		else
			return { dist: posVec.project(edgeVec).sub(posVec).magn() * isInside, param: 0 }
	}
}