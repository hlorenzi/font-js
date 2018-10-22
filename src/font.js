export class Font
{
	constructor()
	{
		
	}
	
	
	static fromReader(r)
	{
		let font = new Font()
		font.readOffsetTable(r)
		font.readTableRecord(r)
		font.readFontHeaderTable(r)
		return font
	}
	
	
	getTable(tag)
	{
		const table = this.tables.find(t => t.tableTag == tag)
		if (table == null)
			throw "missing table <" + tag + ">"
		
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
	}
	
	
	readMaximumProfileTable(r)
	{
		let table = this.getTable("maxp")
		
		r.seek(table.offset)
		
		if (!this.usesTrueTypeOutlines())
		{
			table.version = r.readUInt32BE()
			table.numGlyphs = r.readUInt16BE()
		}
		else
		{
			table.version = r.readUInt32BE()
			table.numGlyphs = r.readUInt16BE()
		}
	}
}