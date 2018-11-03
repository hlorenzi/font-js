export class ByteReader
{
	constructor(bytes)
	{
		this.bytes = bytes
		this.head = 0
	}
	
	
	getLength()
	{
		return this.bytes.length
	}
	
	
	seek(index)
	{
		this.head = index
	}
	
	
	readByte()
	{
		let b = this.bytes[this.head]
		this.head += 1
		return b
	}
	
	
	readSByte()
	{
		let x = this.readByte()
		if ((x & 0x80) == 0)
			return x
		
		return -(0x100 - x)
	}
	
	
	readManyBytes(length)
	{
		let arr = []
		for (let i = 0; i < length; i++)
			arr.push(this.readByte())
		
		return arr
	}
	
	
	readUInt16BE()
	{
		let b0 = this.readByte()
		let b1 = this.readByte()
		
		let result = (b0 << 8) | b1
		
		if (result < 0)
			return 0x10000 + result
		else
			return result
	}
	
	
	readManyUInt16BE(length)
	{
		let arr = []
		for (let i = 0; i < length; i++)
			arr.push(this.readUInt16BE())
		
		return arr
	}
	
	
	readUInt16LE()
	{
		let b1 = this.readByte()
		let b0 = this.readByte()
		
		let result = (b0 << 8) | b1
		
		if (result < 0)
			return 0x10000 + result
		else
			return result
	}
	
	
	readUInt32BE()
	{
		let b0 = this.readByte()
		let b1 = this.readByte()
		let b2 = this.readByte()
		let b3 = this.readByte()
		
		let result = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
		
		if (result < 0)
			return 0x100000000 + result
		else
			return result
	}
	
	
	readManyUInt32BE(length)
	{
		let arr = []
		for (let i = 0; i < length; i++)
			arr.push(this.readUInt32BE())
		
		return arr
	}
	
	
	readUInt32LE()
	{
		let b3 = this.readByte()
		let b2 = this.readByte()
		let b1 = this.readByte()
		let b0 = this.readByte()
		
		let result = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
		
		if (result < 0)
			return 0x100000000 + result
		else
			return result
	}
	
	
	readUInt64BE()
	{
		let b0 = this.readByte()
		let b1 = this.readByte()
		let b2 = this.readByte()
		let b3 = this.readByte()
		let b4 = this.readByte()
		let b5 = this.readByte()
		let b6 = this.readByte()
		let b7 = this.readByte()
		
		let result = (b0 << 56) | (b1 << 48) | (b2 << 40) | (b3 << 32) | (b4 << 24) | (b5 << 16) | (b6 << 8) | b7
		
		if (result < 0)
			return 0x10000000000000000 + result
		else
			return result
	}
	
	
	readInt16BE()
	{
		let x = this.readUInt16BE()
		if ((x & 0x8000) == 0)
			return x
		
		return -(0x10000 - x)
	}
	
	
	readManyInt16BE(length)
	{
		let arr = []
		for (let i = 0; i < length; i++)
			arr.push(this.readInt16BE())
		
		return arr
	}
	
	
	readInt32BE()
	{
		let x = this.readUInt32BE()
		if ((x & 0x80000000) == 0)
			return x
		
		return -(0x100000000 - x)
	}
	
	
	readFloat32()
	{
		let b0 = this.readByte()
		let b1 = this.readByte()
		let b2 = this.readByte()
		let b3 = this.readByte()
		
		let buf = new ArrayBuffer(4)
		let view = new DataView(buf)

		view.setUint8(0, b0)
		view.setUint8(1, b1)
		view.setUint8(2, b2)
		view.setUint8(3, b3)

		return view.getFloat32(0)
	}
	
	
	readAsciiLength(length)
	{
		let str = ""
		for (let i = 0; i < length; i++)
			str += String.fromCharCode(this.readByte())
		
		return str
	}
	
	
	readAsciiZeroTerminated()
	{
		let str = ""
		while (true)
		{
			let c = this.readByte()
			if (c == 0)
				break
			
			str += String.fromCharCode(c)
		}
		
		return str
	}
}