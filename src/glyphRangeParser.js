export function parseGlyphRange(str)
{
	let result = { unicodeCodepoints: [], glyphIds: [] }
	
	try
	{
		let parser = new Parser(str)
		
		if (str == "*" || str == "u+*")
			return result
		
		while (!parser.isOver())
		{
			if (parser.checkMatch("u+"))
			{
				const rangeStart = parser.getUnicodeCodepoint()
				let rangeEnd = rangeStart
				if (parser.tryMatch(".."))
					rangeEnd = parser.getUnicodeCodepoint()
				
				for (let i = rangeStart; i <= rangeEnd; i++)
					result.unicodeCodepoints.push(i)
			}
			else if (parser.checkMatch("#"))
			{
				const rangeStart = parser.getGlyphId()
				let rangeEnd = rangeStart
				if (parser.tryMatch(".."))
					rangeEnd = parser.getGlyphId()
				
				for (let i = rangeStart; i <= rangeEnd; i++)
					result.glyphIds.push(i)
			}
			else
				throw ""
			
			if (!parser.tryMatch(","))
				break
		}
		
		if (!parser.isOver())
			throw ""
	}
	catch
	{
		throw "error: malformed glyph range"
	}
	
	return result
}


class Parser
{
	constructor(str)
	{
		this.str = str
		this.index = 0
		this.skipWhite()
	}
	
	
	isOver()
	{
		return this.index >= this.str.length
	}
	
	
	advance()
	{
		this.index += 1
		this.skipWhite()
	}
	
	
	skipWhite()
	{
		while (isWhitespace(this.cur()))
			this.advance()
	}
	
	
	cur()
	{
		return this.next(0)
	}
	
	
	next(n)
	{
		if (this.index + n >= this.str.length)
			return "\0"
		
		return this.str[this.index + n]
	}
	
	
	checkMatch(m)
	{
		for (let i = 0; i < m.length; i++)
		{
			if (this.next(i) != m[i])
				return false
		}
		
		return true
	}
	
	
	tryMatch(m)
	{
		if (!this.checkMatch(m))
			return false
		
		for (let i = 0; i < m.length; i++)
			this.advance()
		
		return true
	}
	
	
	match(m)
	{
		if (!this.checkMatch(m))
			throw "expected `" + m + "`"
		
		for (let i = 0; i < m.length; i++)
			this.advance()
	}
	
	
	getInt()
	{
		let value = 0
		while (isDigit(this.cur()))
		{
			value = (value * 10) + getHexDigitValue(this.cur())
			this.advance()
		}
		
		return value
	}
	
	
	getHexInt()
	{
		let value = 0
		while (isHexDigit(this.cur()))
		{
			value = (value * 10) + getHexDigitValue(this.cur())
			this.advance()
		}
		
		return value
	}
	
	
	getUnicodeCodepoint()
	{
		this.match("u+")
		
		let value = 0
		while (isHexDigit(this.cur()))
		{
			value = (value * 16) + getHexDigitValue(this.cur())
			this.advance()
		}
		
		return value
	}
	
	
	getGlyphId()
	{
		this.match("#")
		
		let value = 0
		while (isDigit(this.cur()))
		{
			value = (value * 10) + getHexDigitValue(this.cur())
			this.advance()
		}
		
		return value
	}
}


function isWhitespace(c)
{
	const code = c.charCodeAt(0)
	return code == " ".charCodeAt(0)
}


function isDigit(c)
{
	const code = c.charCodeAt(0)
	return code >= "0".charCodeAt(0) && code <= "9".charCodeAt(0)
}


function isHexDigit(c)
{
	const code = c.charCodeAt(0)
	return (code >= "0".charCodeAt(0) && code <= "9".charCodeAt(0)) ||
		(code >= "A".charCodeAt(0) && code <= "F".charCodeAt(0)) ||
		(code >= "a".charCodeAt(0) && code <= "f".charCodeAt(0))
}


function getHexDigitValue(c)
{
	const code = c.charCodeAt(0)
	
	if (code >= "0".charCodeAt(0) && code <= "9".charCodeAt(0))
		return code - "0".charCodeAt(0)
	
	else if (code >= "A".charCodeAt(0) && code <= "F".charCodeAt(0))
		return code + 10 - "A".charCodeAt(0)
	
	else if (code >= "a".charCodeAt(0) && code <= "f".charCodeAt(0))
		return code + 10 - "a".charCodeAt(0)
	
	else
		return 0
}