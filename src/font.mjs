import { ByteReader } from "./byteReader.mjs"


export class FontCollection
{
	constructor()
	{
		this.warnings = []
		this.fonts = []
	}
	
	
	static fromBytes(bytes, preparseGlyphs = false)
	{
		return Font.fromReader(new ByteReader(bytes), preparseGlyphs)
	}
	
	
	static fromReader(r, preparseGlyphs = false)
	{
		let fontCollection = new FontCollection()
		fontCollection.data = r
		
		fontCollection.readCollectionHeader(r)
		
		for (let offset of fontCollection.offsetTables)
		{
			r.seek(offset)
			fontCollection.fonts.push(Font.fromReader(r.clone(), preparseGlyphs))			
		}
		
		return fontCollection
	}
	
	
	getFont(index)
	{
		return this.fonts[index]
	}
	
	
	readCollectionHeader(r)
	{
		const tag = r.readAsciiLength(4)
		
		if (tag == "ttcf")
		{
			this.ttcTag = tag
			this.majorVersion = r.readUInt16BE()
			this.minorVersion = r.readUInt16BE()
			this.numFonts = r.readUInt32BE()
			this.offsetTables = r.readManyUInt32BE(this.numFonts)
			
			if (this.majorVersion == 2)
			{
				this.dsigTag = r.readUInt32BE()
				this.dsigLength = r.readUInt32BE()
				this.dsigOffset = r.readUInt32BE()
			}
		}
		else
		{
			this.offsetTables = [0]
		}
	}
}


export class Font
{
	constructor()
	{
		this.warnings = []
	}
	
	
	static fromBytes(bytes, preparseGlyphs = false)
	{
		return Font.fromReader(new ByteReader(bytes), preparseGlyphs)
	}
	
	
	static fromReader(r, preparseGlyphs = false)
	{
		let font = new Font()
		font.data = r
		
		font.readOffsetTable(r)
		font.readTableRecord(r)
		font.readFontHeaderTable(r)
		font.readNamingTable(r)
		font.readHorizontalHeaderTable(r)
		font.readMaximumProfileTable(r)
		font.readHorizontalMetricsTable(r)
		font.readIndexToLocationTable(r)
		
		if (preparseGlyphs)
			font.readGlyphDataTable(r)
		
		font.readCharacterToGlyphIndexMappingTable(r)
		return font
	}
	
	
	*enumerateGlyphIds()
	{
		const count = this.getGlyphCount()
		
		for (let i = 0; i < count; i++)
			yield i
	}
	
	
	getGlyphCount()
	{
		const maxpTable = this.getTable("maxp")
		
		return maxpTable.numGlyphs
	}
	
	
	getHorizontalLineMetrics()
	{
		const headTable = this.getTable("head")
		const hheaTable = this.getTable("hhea")
		
		return {
			lineTop:    -hheaTable.ascender  / headTable.unitsPerEm,
			lineBottom: -hheaTable.descender / headTable.unitsPerEm,
			lineGap:     hheaTable.lineGap   / headTable.unitsPerEm
		}
	}
	
	
	getUnicodeMap()
	{
		const cmapTable = this.getTable("cmap")
		
		return cmapTable.unicodeToGlyphMap
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
	
	
	readNamingTable(r)
	{
		let table = this.getTable("name")
		
		r.seek(table.offset)
		
		table.format = r.readUInt16BE()
		table.count = r.readUInt16BE()
		table.stringOffset = r.readUInt16BE()
		
		table.nameRecords = []
		for (let i = 0; i < table.count; i++)
		{
			let nameRecord = { }
			nameRecord.platformID = r.readUInt16BE()
			nameRecord.encodingID = r.readUInt16BE()
			nameRecord.languageID = r.readUInt16BE()
			nameRecord.nameID = r.readUInt16BE()
			nameRecord.length = r.readUInt16BE()
			nameRecord.offset = r.readUInt16BE()
			nameRecord.string = null
			table.nameRecords.push(nameRecord)
		}
		
		if (table.format == 1)
		{
			table.langTagCount = r.readUInt16BE()
			
			table.langTagRecords = []
			for (let i = 0; i < table.langTagCount; i++)
			{
				let langTagRecord = { }
				langTagRecord.length = r.readUInt16BE()
				langTagRecord.offset = r.readUInt16BE()
				langTagRecord.string = null
				table.langTagRecords.push(langTagRecord)
			}
		}
		
		const stringDataOffset = r.getPosition()
		
		for (let nameRecord of table.nameRecords)
		{
			if ((nameRecord.platformID == 0) ||
				(nameRecord.platformID == 3 && nameRecord.encodingID == 1))
			{			
				r.seek(stringDataOffset + nameRecord.offset)
				nameRecord.string = r.readUTF16BELength(nameRecord.length / 2)
			}
		}
		
		const findMostSuitableString = (nameID) =>
		{
			let foundString = null
			for (let nameRecord of table.nameRecords)
			{
				if (nameRecord.string == null)
					continue
				
				if (nameRecord.nameID != nameID)
					continue
				
				if (nameRecord.languageID == 0)
					return nameRecord.string
				
				foundString = nameRecord.string
			}
			
			return foundString
		}
		
		this.fontCopyright        = findMostSuitableString(0)
		this.fontFamilyName       = findMostSuitableString(1)
		this.fontSubfamilyName    = findMostSuitableString(2)
		this.fontUniqueIdentifier = findMostSuitableString(3)
		this.fontFullName         = findMostSuitableString(4)
		this.fontVersionString    = findMostSuitableString(5)
		this.fontPostScriptName   = findMostSuitableString(6)
		this.fontTrademark        = findMostSuitableString(7)
		this.fontManufacturer     = findMostSuitableString(8)
	}
	
	
	readHorizontalHeaderTable(r)
	{
		let table = this.getTable("hhea")
		
		r.seek(table.offset)
		
		table.majorVersion = r.readUInt16BE()
		table.minorVersion = r.readUInt16BE()
		
		table.ascender  = r.readInt16BE()
		table.descender = r.readInt16BE()
		table.lineGap   = r.readInt16BE()
		
		table.advanceWidthMax = r.readUInt16BE()
		
		table.minLeftSideBearing  = r.readInt16BE()
		table.minRightSideBearing = r.readInt16BE()
		
		table.xMaxExtent = r.readInt16BE()
		
		table.caretSlopeRise = r.readInt16BE()
		table.caretSlopeRun = r.readInt16BE()
		table.caretOffset = r.readInt16BE()
		
		table.reserved0 = r.readInt16BE()
		table.reserved1 = r.readInt16BE()
		table.reserved2 = r.readInt16BE()
		table.reserved3 = r.readInt16BE()
		
		table.metricDataFormat = r.readInt16BE()
		
		table.numberOfHMetrics = r.readUInt16BE()
	}
	
	
	readHorizontalMetricsTable(r)
	{
		const hhea = this.getTable("hhea")
		const maxp = this.getTable("maxp")
		let   hmtx = this.getTable("hmtx")
		
		r.seek(hmtx.offset)
		
		hmtx.hMetrics = []
		for (let i = 0; i < hhea.numberOfHMetrics; i++)
		{
			let hMetric = { }
			hMetric.advanceWidth = r.readUInt16BE()
			hMetric.lsb = r.readInt16BE()
			
			hmtx.hMetrics.push(hMetric)
		}
		
		hmtx.leftSideBearings = r.readManyInt16BE(maxp.numGlyphs - hhea.numberOfHMetrics)
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
	
	
	readCharacterToGlyphIndexMappingTable(r)
	{
		let cmapTable = this.getTable("cmap")
		
		r.seek(cmapTable.offset)
		
		cmapTable.version = r.readUInt16BE()
		cmapTable.numTables = r.readUInt16BE()
		
		cmapTable.encodingRecords = []
		
		for (let i = 0; i < cmapTable.numTables; i++)
		{
			let encodingRecord = { }
			
			encodingRecord.platformID = r.readUInt16BE()
			encodingRecord.encodingID = r.readUInt16BE()
			encodingRecord.offset = r.readUInt32BE()
			encodingRecord.subtable = null
			
			cmapTable.encodingRecords.push(encodingRecord)
		}
		
		for (let encodingRecord of cmapTable.encodingRecords)
		{
			r.seek(cmapTable.offset + encodingRecord.offset)
			
			encodingRecord.subtable = { }
			encodingRecord.subtable.unicodeToGlyphMap = new Map()
			
			encodingRecord.subtable.format = r.readUInt16BE()
			
			switch (encodingRecord.subtable.format)
			{
				case 4:
					this.readCharacterToGlyphIndexMappingEncodingSubtableFormat4(r, encodingRecord.subtable)
					break
				case 12:
					this.readCharacterToGlyphIndexMappingEncodingSubtableFormat12(r, encodingRecord.subtable)
					break
			}
		}
		
		const UNICODE_PLATFORMID = 0
		const WINDOWS_PLATFORMID = 3
		const WINDOWS_UNICODEBMP_ENCODINGID = 1
		const WINDOWS_UNICODEFULL_ENCODINGID = 10
		
		cmapTable.unicodeToGlyphMap = new Map()
		
		for (let encodingRecord of cmapTable.encodingRecords)
		{
			if (encodingRecord.platformID == UNICODE_PLATFORMID ||
				(encodingRecord.platformID == WINDOWS_PLATFORMID && encodingRecord.encodingID == WINDOWS_UNICODEBMP_ENCODINGID) ||
				(encodingRecord.platformID == WINDOWS_PLATFORMID && encodingRecord.encodingID == WINDOWS_UNICODEFULL_ENCODINGID))
			{
				for (const [code, glyphId] of encodingRecord.subtable.unicodeToGlyphMap)
					cmapTable.unicodeToGlyphMap.set(code, glyphId)
			}
		}
	}
	
	
	readCharacterToGlyphIndexMappingEncodingSubtableFormat4(r, subtable)
	{
		subtable.length = r.readUInt16BE()
		subtable.language = r.readUInt16BE()
		subtable.segCountX2 = r.readUInt16BE()
		subtable.searchRange = r.readUInt16BE()
		subtable.entrySelector = r.readUInt16BE()
		subtable.rangeShift = r.readUInt16BE()
		
		subtable.endCode = r.readManyUInt16BE(subtable.segCountX2 / 2)
		
		subtable.reservedPad = r.readUInt16BE()
		
		subtable.startCode = r.readManyUInt16BE(subtable.segCountX2 / 2)
		subtable.idDelta = r.readManyInt16BE(subtable.segCountX2 / 2)
		
		const idRangeOffsetPosition = r.getPosition()
		subtable.idRangeOffset = r.readManyUInt16BE(subtable.segCountX2 / 2)
		
		for (let c = 0; c <= 0xffff; c++)
		{
			for (let i = 0; i < subtable.segCountX2 / 2; i++)
			{
				if (c > subtable.endCode[i])
					continue
				
				if (c < subtable.startCode[i])
					continue
				
				if (subtable.idRangeOffset[i] == 0)
				{
					const glyphId = (c + subtable.idDelta[i]) % 0x10000
					
					subtable.unicodeToGlyphMap.set(c, glyphId)
				}
				else
				{
					const addr =
						((subtable.idRangeOffset[i] / 2) + (c - subtable.startCode[i])) * 2 +
						(idRangeOffsetPosition + i * 2)
						
					r.seek(addr)
					
					let glyphId = r.readUInt16BE()
					if (glyphId != 0)
						glyphId = (glyphId + subtable.idDelta[i]) % 0x10000
					
					subtable.unicodeToGlyphMap.set(c, glyphId)
				}
				
				break
			}
		}
	}
	
	
	readCharacterToGlyphIndexMappingEncodingSubtableFormat12(r, subtable)
	{
		subtable.reserved = r.readUInt16BE()
		subtable.length = r.readUInt32BE()
		subtable.language = r.readUInt32BE()
		subtable.numGroups = r.readUInt32BE()
		
		subtable.groups = []
		for (let i = 0; i < subtable.numGroups; i++)
		{
			let group = { }
			group.startCharCode = r.readUInt32BE()
			group.endCharCode = r.readUInt32BE()
			group.startGlyphID = r.readUInt32BE()
			
			subtable.groups.push(group)
		}
		
		for (const group of subtable.groups)
		{
			for (let c = group.startCharCode; c <= group.endCharCode; c++)
				subtable.unicodeToGlyphMap.set(c, group.startGlyphID + c - group.startCharCode)
		}
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
	
	
	fetchGlyphOnDemand(r, glyphId)
	{
		const maxpTable = this.getTable("maxp")
		const locaTable = this.getTable("loca")
		const glyfTable = this.getTable("glyf")
		
		if (glyphId < 0 || glyphId > maxpTable.numGlyphs)
			return null
		
		if (locaTable.offsets[glyphId] == null)
			return null
		
		r.seek(glyfTable.offset + locaTable.offsets[glyphId])
		return this.readGlyph(r, glyphId)
	}
	
	
	getGlyphData(glyphId)
	{
		const glyfTable = this.getTable("glyf")
		
		return (glyfTable.glyphs ? glyfTable.glyphs[glyphId] : this.fetchGlyphOnDemand(this.data, glyphId))
	}
	
	
	getGlyphGeometry(glyphId, simplifySteps = 0)
	{
		const headTable = this.getTable("head")
		const hmtxTable = this.getTable("hmtx")
		const glyph = this.getGlyphData(glyphId)
		
		const ON_CURVE_POINT_FLAG = 0x01
		
		const scale = 1 / headTable.unitsPerEm
		
		let geometry = { }
		geometry.contours = []
		geometry.xMin = null
		geometry.yMin = null
		geometry.xMax = null
		geometry.yMax = null
		
		let hMetric = null
		if (glyphId >= hmtxTable.hMetrics.length)
			hMetric = hmtxTable.hMetrics[hmtxTable.hMetrics.length - 1]
		else
			hMetric = hmtxTable.hMetrics[glyphId]
		
		geometry.advance = (hMetric ? hMetric.advanceWidth / headTable.unitsPerEm : 0)
		
		const updateMeasures = (x, y) =>
		{
			geometry.xMin = geometry.xMin == null ? x : Math.min(geometry.xMin, x)
			geometry.xMax = geometry.xMax == null ? x : Math.max(geometry.xMax, x)
			geometry.yMin = geometry.yMin == null ? y : Math.min(geometry.yMin, y)
			geometry.yMax = geometry.yMax == null ? y : Math.max(geometry.yMax, y)
		}
		
		if (glyph != null)
		{
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
							const newX1 = (segment.x1 * component.xScale) + (segment.y1 * component.scale01) + xOffset
							const newY1 = (segment.y1 * component.yScale) + (segment.x1 * component.scale10) + yOffset
							const newX2 = (segment.x2 * component.xScale) + (segment.y2 * component.scale01) + xOffset
							const newY2 = (segment.y2 * component.yScale) + (segment.x2 * component.scale10) + yOffset
							segment.x1 = newX1
							segment.y1 = newY1
							segment.x2 = newX2
							segment.y2 = newY2
							
							if (segment.kind == "qbezier")
							{
								const newX3 = (segment.x3 * component.xScale) + (segment.y3 * component.scale01) + xOffset
								const newY3 = (segment.y3 * component.yScale) + (segment.x3 * component.scale10) + yOffset
								segment.x3 = newX3
								segment.y3 = newY3
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
		}
		
		if (simplifySteps > 0)
			geometry = Font.simplifyBezierContours(geometry, simplifySteps)
		
		return geometry
	}
	
	
	static simplifyBezierContours(geometry, steps = 100)
	{
		if (geometry == null)
			return geometry
		
		let simplifiedContours = []
		
		for (const contour of geometry.contours)
		{
			let simplifiedSegments = []
			
			for (const segment of contour)
			{
				if (segment.kind == "line")
					simplifiedSegments.push(segment)
				
				else if (segment.kind == "qbezier")
				{
					for (let i = 0; i < steps; i++)
					{
						const t1 = (i + 0) / steps
						const t2 = (i + 1) / steps
						
						const x1 = Font.qbezier(t1, segment.x1, segment.x2, segment.x3)
						const y1 = Font.qbezier(t1, segment.y1, segment.y2, segment.y3)
						const x2 = Font.qbezier(t2, segment.x1, segment.x2, segment.x3)
						const y2 = Font.qbezier(t2, segment.y1, segment.y2, segment.y3)
						
						simplifiedSegments.push({
							kind: "line",
							x1, y1, x2, y2
						})
					}
				}
			}
			
			simplifiedContours.push(simplifiedSegments)
		}
		
		geometry.contours = simplifiedContours
		return geometry
	}
	
	
	static qbezier(t, p0, p1, p2)
	{
		return (1 - t) * ((1 - t) * p0 + t * p1) + t * ((1 - t) * p1 + t * p2)
	}
}