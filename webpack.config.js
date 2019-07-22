const path = require("path")


module.exports =
{
	mode: "production",
	entry:
	{
		main: path.resolve(__dirname, "src/main.js"),
	},
	
	output:
	{
		filename: "[name].js",
		path: path.resolve(__dirname, "webpack")
	}
}