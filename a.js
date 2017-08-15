"use strict";

var vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;

// all shaders have a main function
void main() {

	// gl_Position is a special variable a vertex shader
	// is responsible for setting
	gl_Position = a_position;
}
`;

var fragmentShaderSource = `#version 300 es

precision highp float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;

uniform vec2 ANALYZER_MOUSE;

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

// we need to declare an output for the fragment shader
out vec4 outColor;

// for analyzer purposes
int counter = 0;
vec4 analyzer_output = vec4(0,0,0,1);

CODE_HERE

ENTRY_POINT_HERE
`;

var previewEntryPoint = `
void main() {
	vec2 fragCoord = gl_FragCoord.xy;

	mainImage(outColor, fragCoord);

	if (abs(fragCoord.x - ANALYZER_MOUSE.x) < 1. ^^
		abs(iResolution.y - fragCoord.y - ANALYZER_MOUSE.y) < 1.)
	{
		outColor = mix(outColor, vec4(1,0,0,1), 0.5);
	}
}`

var varWatchEntryPoint = `
void main() {
	vec2 fragCoord = ANALYZER_MOUSE;

	mainImage(outColor, fragCoord);

	outColor = analyzer_output;
}`

var shadertoyRaw = ""

function createShader(gl, type, source) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (success) {
		return shader;
	}

	console.log(gl.getShaderInfoLog(shader));  // eslint-disable-line
	gl.deleteShader(shader);
	return undefined;
}

function createProgram(gl, vertexShader, fragmentShader) {
	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	var success = gl.getProgramParameter(program, gl.LINK_STATUS);
	if (success) {
		return program;
	}

	console.log(gl.getProgramInfoLog(program));  // eslint-disable-line
	gl.deleteProgram(program);
	return undefined;
}

function loadImage(gl, url)
{
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

	var img = new Image();
	img.addEventListener('load', function() {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		drawAll();
	})
	img.src = url;

	return tex;
}

function drawCode()
{
	var arr = fragmentShaderSource.split("\n");
	//var s = "if(int(gl_FragCoord.x+0.5)==counter){analyzer_output.xyz=sorigin}counter+=1;"
	//arr.splice(212, 0, s);
	for (var i = 0; i < arr.length; ++i) {
		//arr[i] = arr[i].replace(" ", "&nbsp");
		//arr[i] = arr[i].replace("\t", "&nbsp &nbsp ");
		$("#code").append("<tr class='code-row-" + i + "'>  <td><pre>" + i + "</pre></td> <td><pre>" + arr[i] + "</pre></td>  </tr>");
	}
}

function setupResources(gl, fragSource)
{
	var result = {};

	result.iChannel0Tex = loadImage(gl, "bricks.jpg");

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
	result.program = createProgram(gl, vertexShader, fragmentShader);

	// look up where the vertex data needs to go.
	var positionAttributeLocation = gl.getAttribLocation(result.program, "a_position");

	result.iResolutionPos = gl.getUniformLocation(result.program, "iResolution");
	result.iTimePos = gl.getUniformLocation(result.program, "iTime");
	result.iMousePos = gl.getUniformLocation(result.program, "iMouse");
	result.iChannel0Pos = gl.getUniformLocation(result.program, "iChannel0");

	result.analyzerMousePos = gl.getUniformLocation(result.program, "ANALYZER_MOUSE");

	var positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	result.vao = gl.createVertexArray();
	gl.bindVertexArray(result.vao);
	gl.enableVertexAttribArray(positionAttributeLocation);

	// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
	var size = 2;          // 2 components per iteration
	var type = gl.FLOAT;   // the data is 32bit floats
	var normalize = false; // don't normalize the data
	var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
	var offset = 0;        // start at the beginning of the buffer
	gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	return result;
}

var positions = [
	-1.0, -1.0,
	1.0,  1.0,
	-1.0,  1.0,
	-1.0, -1.0,
	1.0,  1.0,
	1.0, -1.0,
];

var preview_gl;
var preview_data;

var varWatch_gl;
var varWatch_data;

var mousePos = { "x":0, "y":0 };

function createTexture(gl, color) {
	const tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	const level = 0;
	const internalFormat = gl.RGBA32F;
	const width = 1;
	const height = 1;
	const border = 0;
	const format = gl.RGBA;
	const type = gl.FLOAT;
	const data = new Float32Array(color);
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
				  format, type, data);
	// unless we get `OES_texture_float_linear` we can not filter floating point
	// textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	
	return tex;
  }

function init() {

	//var shader_url = "https://www.shadertoy.com/api/v1/shaders/Ml3Gzr?key=Nd8tWz";
	var shader_url = "example.fs";
	
	$.ajax({url: shader_url, async:false, cache:false, success: function(result) {
		//shadertoyRaw = result["Shader"]["renderpass"][0]["code"];
		shadertoyRaw = result;
		fragmentShaderSource = fragmentShaderSource.replace("CODE_HERE", shadertoyRaw);
	}});

	drawCode();

	// PREVIEW GL SETUP
	var preview_canvas = document.getElementById("preview");
	preview_gl = preview_canvas.getContext("webgl2");
	if (!preview_gl) {
		console.log("asdfasdsfd");
		return;
	}

	var previewFragSource = fragmentShaderSource.replace("ENTRY_POINT_HERE", previewEntryPoint);
	preview_canvas.width = preview_canvas.clientWidth;
	preview_canvas.height = preview_canvas.clientHeight;

	preview_data = setupResources(preview_gl, previewFragSource);

	// PREVIEW GL SETUP
	var varWatch_canvas = document.getElementById("varWatch");
	varWatch_gl = varWatch_canvas.getContext("webgl2");
	if (!varWatch_gl) {
		return;
	}
	const ext = varWatch_gl.getExtension("EXT_color_buffer_float");
	if (!ext) {
		alert("need EXT_color_buffer_float to work");
		return;
	}

	var varWatchFragSource = fragmentShaderSource.replace("ENTRY_POINT_HERE", varWatchEntryPoint);
	{
		var arr = varWatchFragSource.split("\n");
		//var s = "\t\tif(int(gl_FragCoord.x+0.5)==counter) { analyzer_output.xyz=sorigin; } \ncounter+=1;"
		var s = "\t\tif(int(gl_FragCoord.x+0.1)==counter) { analyzer_output.xyz=v; } \ncounter+=1;"
		arr.splice(27, 0, s);
		varWatchFragSource = arr.join("\n");
		console.log(varWatchFragSource);
	}
	/*var s = "if(int(gl_FragCoord.x+0.5)==counter){analyzer_output.xyz=sorigin}counter+=1;"
	arr.splice(212, 0, s);*/
	//var previewFragSource = fragmentShaderSource.replace("ENTRY_POINT_HERE", previewEntryPoint);
	varWatch_canvas.width = varWatch_canvas.clientWidth;
	varWatch_canvas.height = varWatch_canvas.clientHeight;

	varWatch_data = setupResources(varWatch_gl, varWatchFragSource);

	var fbTex = createTexture(varWatch_gl, [15, 19, 0, -7]);
	var fb = varWatch_gl.createFramebuffer();
	varWatch_gl.bindFramebuffer(varWatch_gl.FRAMEBUFFER, fb);
	varWatch_gl.framebufferTexture2D(varWatch_gl.FRAMEBUFFER, varWatch_gl.COLOR_ATTACHMENT0, varWatch_gl.TEXTURE_2D, fbTex, 0);
	varWatch_gl.drawBuffers([varWatch_gl.COLOR_ATTACHMENT0]);

	drawAll();

	$("#mouseX, #time").on('input', function() {
		//console.log($("#time").val());
		drawAll();
	});
	$("#preview").click(function(e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		mousePos["x"] = x;
		mousePos["y"] = y;
		drawAll();
	});
	$("#analyzer_var").on('click', function(e) {
		console.log("asdfasf");
		//alert(window.getSelection());
		analyze_selection();
	});
}

function analyze_selection()
{
	console.log($(window.getSelection().anchorNode).parents().eq(2).attr("class").split(' '));
}

function drawAll()
{
	if (!preview_gl || !preview_gl)
		return;

	draw(preview_gl, preview_data);
	draw(varWatch_gl, varWatch_data);

	{
		varWatch_gl.readBuffer(varWatch_gl.COLOR_ATTACHMENT0);
		
		var pixels = new Float32Array(varWatch_gl.canvas.width * 4);
		varWatch_gl.readPixels(0, 0, varWatch_gl.canvas.width, 1, varWatch_gl.RGBA, varWatch_gl.FLOAT, pixels);
		console.log(pixels);
	}
}

function draw(gl, data)
{
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.useProgram(data.program);

	gl.bindVertexArray(data.vao);

	gl.uniform2f(data.iResolutionPos, gl.canvas.width, gl.canvas.height);
	gl.uniform1f(data.iTimePos, $("#time").val());
	gl.uniform4f(data.iMousePos, $("#mouseX").val(), 0., 0., 0.);

	gl.activeTexture(gl.TEXTURE0 + 0);
	gl.bindTexture(gl.TEXTURE_2D, data.iChannel0Tex);
	gl.uniform1i(data.iChannel0Pos, 0);

	gl.uniform2f(data.analyzerMousePos, mousePos["x"], mousePos["y"]);

	// draw
	var primitiveType = gl.TRIANGLES;
	var offset = 0;
	var count = 6;
	gl.drawArrays(primitiveType, offset, count);
}

$(document).ready(function() {
	init();
});