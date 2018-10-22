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
	console.log(buffer)
	
	let r = new ByteReader(buffer)
	let font = Font.fromReader(r)
	
	console.log(font)
}