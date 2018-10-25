export class Font
{
	constructor()
	{
		this.warnings = []
	}
	
	
	static fromReader(r)
	{
		let font = new Font()
		font.readOffsetTable(r)
		font.readTableRecord(r)
		font.readFontHeaderTable(r)
		font.readMaximumProfileTable(r)
		font.readIndexToLocationTable(r)
		font.readGlyphDataTable(r)
		return font
	}
	
	
	*enumerateGlyphIds()
	{
		const glyfTable = this.getTable("glyf")
		
		for (let i = 0; i < glyfTable.glyphs.length; i++)
			yield i
	}
	
	
	warnIf(condition, message)
	{
		if (condition)
			this.warnings.push(message)
	}
	
	
	getTable(tag)
	{
		const table = this.tables.find(t => t.tableTag == tag)
		if (table == null)
			throw "missing table `" + tag + "`"
		
		return table
	}
	
	
	get usesTrueTypeOutlines()
	{
		return this.sfntVersion != "OTTO"
	}
	
	
	readOffsetTable(r)
	{
		this.sfntVersion   = r.readAsciiLength(4)
		this.numTables     = r.readUInt16BE()
		this.searchRange   = r.readUInt16BE()
		this.entrySelector = r.readUInt16BE()
		this.rangeShift    = r.readUInt16BE()
	}
	
	
	readTableRecord(r)
	{
		this.tables = []
		
		for (let i = 0; i < this.numTables; i++)
		{
			let table = { }
			table.tableTag = r.readAsciiLength(4)
			table.checkSum = r.readUInt32BE()
			table.offset   = r.readUInt32BE()
			table.length   = r.readUInt32BE()
			
			this.tables.push(table)
		}
	}
	
	
	readFontHeaderTable(r)
	{
		let table = this.getTable("head")
		
		r.seek(table.offset)
		
		table.majorVersion = r.readUInt16BE()
		table.minorVersion = r.readUInt16BE()
		table.fontRevision = r.readUInt32BE()
		
		table.checkSumAdjustment = r.readUInt32BE()
		table.magicNumber = r.readUInt32BE()
		table.flags = r.readUInt16BE()
		table.unitsPerEm = r.readUInt16BE()
		
		table.created  = r.readUInt64BE()
		table.modified = r.readUInt64BE()
		
		table.xMin = r.readInt16BE()
		table.yMin = r.readInt16BE()
		table.xMax = r.readInt16BE()
		table.yMax = r.readInt16BE()
		
		table.macStyle = r.readUInt16BE()
		table.lowestRecPPEM = r.readUInt16BE()
		table.fontDirectionHint = r.readInt16BE()
		table.indexToLocFormat = r.readInt16BE()
		table.glyphDataFormat = r.readInt16BE()
		
		if (table.indexToLocFormat != 0 && table.indexToLocFormat != 1)
			throw "invalid `head` indexToLocFormat"
	}
	
	
	readMaximumProfileTable(r)
	{
		let table = this.getTable("maxp")
		
		r.seek(table.offset)
		
		if (!this.usesTrueTypeOutlines)
		{
			table.version = r.readUInt32BE()
			this.warnIf(table.version != 0x5000, "invalid `maxp` version")
			
			table.numGlyphs = r.readUInt16BE()
		}
		else
		{
			table.version = r.readUInt32BE()
			this.warnIf(table.version != 0x10000, "invalid `maxp` version")
				
			table.numGlyphs = r.readUInt16BE()
			table.maxPoints = r.readUInt16BE()
			table.maxContours = r.readUInt16BE()
			table.maxCompositePoints = r.readUInt16BE()
			table.maxCompositeContours = r.readUInt16BE()
			table.maxZones = r.readUInt16BE()
			table.maxTwilightPoints = r.readUInt16BE()
			table.maxStorage = r.readUInt16BE()
			table.maxFunctionDefs = r.readUInt16BE()
			table.maxInstructionDefs = r.readUInt16BE()
			table.maxStackElements = r.readUInt16BE()
			table.maxSizeOfInstructions = r.readUInt16BE()
			table.maxComponentElements = r.readUInt16BE()
			table.maxComponentDepth = r.readUInt16BE()
		}
	}
	
	
	readIndexToLocationTable(r)
	{
		const headTable = this.getTable("head")
		const maxpTable = this.getTable("maxp")
		let   locaTable = this.getTable("loca")
		
		const locaEntryNum = maxpTable.numGlyphs + 1
		
		r.seek(locaTable.offset)
		
		if (headTable.indexToLocFormat == 0)
			locaTable.offsets = r.readManyUInt16BE(locaEntryNum).map(i => i * 2)
		
		else if (headTable.indexToLocFormat == 1)
			locaTable.offsets = r.readManyUInt32BE(locaEntryNum)
		
		for (let i = 1; i < locaTable.offsets.length; i++)
		{
			if (locaTable.offsets[i] < locaTable.offsets[i - 1])
				throw "invalid `loca` offsets entry"
		}
			
		for (let i = 0; i < locaTable.offsets.length - 1; i++)
		{
			if (locaTable.offsets[i] == locaTable.offsets[i + 1])
				locaTable.offsets[i] = null
		}
	}
	
	
	readGlyphDataTable(r)
	{
		const maxpTable = this.getTable("maxp")
		const locaTable = this.getTable("loca")
		let   glyfTable = this.getTable("glyf")
		
		glyfTable.glyphs = []
		
		for (let i = 0; i < maxpTable.numGlyphs; i++)
		{
			if (locaTable.offsets[i] != null)
			{
				r.seek(glyfTable.offset + locaTable.offsets[i])
				glyfTable.glyphs.push(this.readGlyph(r, i))
			}
			else
				glyfTable.glyphs.push(null)
		}
	}
	
	
	readGlyph(r, glyphId)
	{
		let glyph = { }
		
		glyph.numberOfContours = r.readInt16BE()
		
		glyph.xMin = r.readInt16BE()
		glyph.yMin = r.readInt16BE()
		glyph.xMax = r.readInt16BE()
		glyph.yMax = r.readInt16BE()
		
		if (glyph.numberOfContours >= 0)
			this.readGlyphSimple(r, glyph)
		
		else
			this.readGlyphComposite(r, glyph, glyphId)
		
		return glyph
	}
	
	
	readGlyphSimple(r, glyph)
	{
		glyph.endPtsOfContours = r.readManyUInt16BE(glyph.numberOfContours)
		for (let i = 1; i < glyph.endPtsOfContours.length; i++)
		{
			if (glyph.endPtsOfContours[i] < glyph.endPtsOfContours[i - 1])
				throw "invalid glyph endPtsOfContours entry"
		}
		
		glyph.instructionLength = r.readUInt16BE()
		glyph.instructions = r.readManyBytes(glyph.instructionLength)
		
		const numPoints = glyph.endPtsOfContours[glyph.numberOfContours - 1] + 1
		
		const X_SHORT_VECTOR_FLAG = 0x02
		const Y_SHORT_VECTOR_FLAG = 0x04
		const REPEAT_FLAG = 0x08
		const X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR_FLAG = 0x10
		const Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR_FLAG = 0x20
		
		// Read flags while expanding it to the logical flag array
		glyph.flags = []
		
		while (glyph.flags.length < numPoints)
		{
			const flag = r.readByte()
			glyph.flags.push(flag)
			
			if ((flag & REPEAT_FLAG) != 0)
			{
				const repeatCount = r.readByte()
				for (let i = 0; i < repeatCount; i++)
					glyph.flags.push(flag)
			}
		}
		
		// Read X coordinates
		glyph.xCoordinates = []
		
		let xCurrent = 0
		for (let i = 0; i < numPoints; i++)
		{
			const flag = glyph.flags[i]
			
			if ((flag & X_SHORT_VECTOR_FLAG) != 0)
			{
				const displacement = r.readByte()
				const sign = (flag & X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR_FLAG) != 0 ? 1 : -1
				xCurrent += displacement * sign
			}
			
			else if ((flag & X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR_FLAG) == 0)
				xCurrent += r.readInt16BE()
			
			glyph.xCoordinates.push(xCurrent)
		}
		
		// Read Y coordinates
		glyph.yCoordinates = []
		
		let yCurrent = 0
		for (let i = 0; i < numPoints; i++)
		{
			const flag = glyph.flags[i]
			
			if ((flag & Y_SHORT_VECTOR_FLAG) != 0)
			{
				const displacement = r.readByte()
				const sign = (flag & Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR_FLAG) != 0 ? 1 : -1
				yCurrent += displacement * sign
			}
			
			else if ((flag & Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR_FLAG) == 0)
				yCurrent += r.readInt16BE()
			
			glyph.yCoordinates.push(yCurrent)
		}
	}
	
	
	readGlyphComposite(r, glyph, glyphId)
	{
		const ARG_1_AND_2_ARE_WORDS_FLAG = 0x0001
		const ARGS_ARE_XY_VALUES_FLAG = 0x0002
		const WE_HAVE_A_SCALE_FLAG = 0x0008
		const MORE_COMPONENTS_FLAG = 0x0020
		const WE_HAVE_AN_X_AND_Y_SCALE_FLAG = 0x0040
		const WE_HAVE_A_TWO_BY_TWO_FLAG = 0x0080
		const WE_HAVE_INSTRUCTIONS = 0x0100
		
		glyph.components = []
		
		while (true)
		{
			let component = { }
			glyph.components.push(component)
			
			component.flags = r.readUInt16BE()
			component.glyphIndex = r.readUInt16BE()
			
			component.xScale = 1
			component.yScale = 1
			component.scale01 = 0
			component.scale10 = 0
			
			if ((component.flags & ARG_1_AND_2_ARE_WORDS_FLAG) != 0)
			{
				component.argument1 = r.readInt16BE()
				component.argument2 = r.readInt16BE()
			}
			else
			{
				component.argument1 = r.readSByte()
				component.argument2 = r.readSByte()
			}
			
			if ((component.flags & ARGS_ARE_XY_VALUES_FLAG) == 0)
				this.warnings.push("glyph 0x" + glyphId.toString(16) + ": unsupported cleared ARGS_ARE_XY_VALUES flag")
				
			if ((component.flags & WE_HAVE_A_SCALE_FLAG) != 0)
			{
				component.xScale = component.yScale = this.readF2Dot14(r)
			}
			
			else if ((component.flags & WE_HAVE_AN_X_AND_Y_SCALE_FLAG) != 0)
			{
				component.xScale = this.readF2Dot14(r)
				component.yScale = this.readF2Dot14(r)
			}
			
			else if ((component.flags & WE_HAVE_A_TWO_BY_TWO_FLAG) != 0)
			{
				component.xScale  = this.readF2Dot14(r)
				component.scale01 = this.readF2Dot14(r)
				component.scale10 = this.readF2Dot14(r)
				component.yScale  = this.readF2Dot14(r)
			}
			
			if ((component.flags & MORE_COMPONENTS_FLAG) == 0)
				break
		}
		
		// Uses flag of last component?
		//if ((component.flags & WE_HAVE_INSTRUCTIONS_FLAG) != 0)
		//{
		//	
		//}
	}
	
	
	readF2Dot14(r)
	{
		const raw = r.readUInt16BE()
		
		const rawIntegerPart = (raw & 0xc000) >> 14
		const rawFractionalPart = (raw & 0x3fff)
		
		const integerPart = (rawIntegerPart & 0x2) ? (2 - rawIntegerPart) : rawIntegerPart
		const fractionalPart = rawFractionalPart / 16384
		
		return integerPart + fractionalPart
	}
	
	
	getGlyphData(glyphId)
	{
		const glyfTable = this.getTable("glyf")
		
		return glyfTable.glyphs[glyphId]
	}
	
	
	getGlyphGeometry(glyphId)
	{
		const headTable = this.getTable("head")
		const glyfTable = this.getTable("glyf")
		const glyph = glyfTable.glyphs[glyphId]
		
		const ON_CURVE_POINT_FLAG = 0x01
		
		const scale = 1 / headTable.unitsPerEm
		
		let geometry = { }
		geometry.contours = []
		geometry.xMin = null
		geometry.yMin = null
		geometry.xMax = null
		geometry.yMax = null
		
		let updateMeasures = (x, y) =>
		{
			geometry.xMin = Math.min(geometry.xMin, x)
			geometry.xMax = Math.max(geometry.xMax, x)
			geometry.yMin = Math.min(geometry.yMin, y)
			geometry.yMax = Math.max(geometry.yMax, y)
		}
		
		if (glyph == null)
			return null
		
		geometry.isComposite = (glyph.numberOfContours <= 0)
		
		// Simple glyph
		if (!geometry.isComposite)
		{
			for (let i = 0; i < glyph.endPtsOfContours.length; i++)
			{
				const firstPoint = (i == 0 ? 0 : glyph.endPtsOfContours[i - 1] + 1)
				const lastPoint = glyph.endPtsOfContours[i]
				
				let segments = []
				
				const pointsInContour = (lastPoint + 1 - firstPoint)
				
				for (let p = firstPoint; p <= lastPoint; p++)
				{
					const pNext = (p - firstPoint + 1)                   % pointsInContour + firstPoint
					const pPrev = (p - firstPoint - 1 + pointsInContour) % pointsInContour + firstPoint
					
					let x     =  scale * glyph.xCoordinates[p]
					let y     = -scale * glyph.yCoordinates[p]
					let xNext =  scale * glyph.xCoordinates[pNext]
					let yNext = -scale * glyph.yCoordinates[pNext]
					let xPrev =  scale * glyph.xCoordinates[pPrev]
					let yPrev = -scale * glyph.yCoordinates[pPrev]
					
					if ((glyph.flags[p] & ON_CURVE_POINT_FLAG) == 0)
					{
						if ((glyph.flags[pPrev] & ON_CURVE_POINT_FLAG) == 0)
						{
							xPrev = (xPrev + x) / 2
							yPrev = (yPrev + y) / 2
						}
						
						if ((glyph.flags[pNext] & ON_CURVE_POINT_FLAG) == 0)
						{
							xNext = (xNext + x) / 2
							yNext = (yNext + y) / 2
						}
						
						segments.push({
							kind: "qbezier",
							x1: xPrev, y1: yPrev,
							x2: x,     y2: y,
							x3: xNext, y3: yNext
						})
					}
					else if ((glyph.flags[pNext] & ON_CURVE_POINT_FLAG) != 0)
					{
						segments.push({
							kind: "line",
							x1: x,     y1: y,
							x2: xNext, y2: yNext
						})
					}
				}
				
				geometry.contours.push(segments)
			}
		}
		
		// Composite glyph
		else
		{
			const ARGS_ARE_XY_VALUES_FLAG = 0x0002
			
			for (const component of glyph.components)
			{
				const componentGeometry = this.getGlyphGeometry(component.glyphIndex)
				if (componentGeometry == null)
					continue
				
				if ((component.flags & ARGS_ARE_XY_VALUES_FLAG) == 0)
					return null
					
				const xOffset =  scale * component.argument1
				const yOffset = -scale * component.argument2
				
				for (const contour of componentGeometry.contours)
				{
					for (const segment of contour)
					{
						// FIXME: scale01 and scale10 not being used correctly?
						segment.x1 = (segment.x1 * component.xScale) + (segment.y1 * component.scale01)
						segment.y1 = (segment.y1 * component.yScale) + (segment.x1 * component.scale10)
						segment.x2 = (segment.x2 * component.xScale) + (segment.y2 * component.scale01)
						segment.y2 = (segment.y2 * component.yScale) + (segment.x2 * component.scale10)
						
						if (segment.kind == "qbezier")
						{
							segment.x3 = (segment.x3 * component.xScale) + (segment.y3 * component.scale01)
							segment.y3 = (segment.y3 * component.yScale) + (segment.x3 * component.scale10)
						}
						
						segment.x1 += xOffset
						segment.y1 += yOffset
						segment.x2 += xOffset
						segment.y2 += yOffset
						
						if (segment.kind == "qbezier")
						{
							segment.x3 += xOffset
							segment.y3 += yOffset
						}
					}
					
					geometry.contours.push(contour)
				}
			}
		}
		
		for (const contour of geometry.contours)
		{
			for (const segment of contour)
			{
				updateMeasures(segment.x1, segment.y1)
				updateMeasures(segment.x2, segment.y2)
				
				if (segment.kind == "qbezier")
					updateMeasures(segment.x3, segment.y3)
			}
		}
		
		return geometry
	}
}