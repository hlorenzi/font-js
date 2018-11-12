export class Vec2
{
	constructor(x, y)
	{
		this.x = x
		this.y = y
	}
	
	
	clone()
	{
		return new Vec2(this.x, this.y)
	}


	magn()
	{
		return Math.sqrt(this.dot(this))
	}


	magnSqr()
	{
		return this.dot(this)
	}


	norm()
	{
		const magn = this.magn()
		
		return new Vec2(
			this.x / magn,
			this.y / magn)
	}


	add(other)
	{
		return new Vec2(
			this.x + other.x,
			this.y + other.y)
	}


	sub(other)
	{
		return new Vec2(
			this.x - other.x,
			this.y - other.y)
	}


	neg()
	{
		return new Vec2(
			-this.x,
			-this.y)
	}


	scale(f)
	{
		return new Vec2(
			this.x * f,
			this.y * f)
	}


	mul(other)
	{
		return new Vec2(
			this.x * other.x,
			this.y * other.y)
	}


	dot(other)
	{
		return (this.x * other.x + this.y * other.y)
	}


	cross(other)
	{
		return this.x * other.y - this.y * other.x
	}
	
	
	clockwisePerpendicular()
	{
		return new Vec2(
			this.y,
			-this.x)
	}
	
	
	lerp(other, amount)
	{
		return new Vec2(
			this.x + (other.x - this.x) * amount,
			this.y + (other.y - this.y) * amount)
	}
	
	
	min(other)
	{
		if (other == null)
			return this
		
		return new Vec2(
			Math.min(this.x, other.x),
			Math.min(this.y, other.y))
	}
	
	
	max(other)
	{
		if (other == null)
			return this
		
		return new Vec2(
			Math.max(this.x, other.x),
			Math.max(this.y, other.y))
	}
	
	
	project(other)
	{
		return other.scale(this.dot(other) / other.dot(other))
	}
	
	
	projectionFactor(other)
	{
		return this.dot(other) / other.dot(other)
	}

	
	projectAlongLine(lineNormal)
	{
		return this.sub(this.project(lineNormal))
	}
	
	
	asArray()
	{
		return [this.x, this.y]
	}
	
	
	isFinite()
	{
		return isFinite(this.x) && isFinite(this.y)
	}
}