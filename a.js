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

precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;

uniform vec2 ANALYZER_MOUSE;

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

// we need to declare an output for the fragment shader
out vec4 outColor;

/*void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	fragColor = vec4(uv,0.5+0.5*sin(iTime),1.0);
}*/

CODE_HERE

void main() {
	vec2 fragCoord = gl_FragCoord.xy;

	mainImage(outColor, fragCoord);

	if (abs(fragCoord.x - ANALYZER_MOUSE.x) < 1. ^^
		abs(iResolution.y - fragCoord.y - ANALYZER_MOUSE.y) < 1.)
	{
		outColor = mix(outColor, vec4(1,0,0,1), 0.5);
	}
}
`;

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

var iChannel0Tex;

var gl;
var program;

var vao;

var iResolutionPos;
var iTimePos;
var iMousePos;
var iChannel0Pos;

var analyzerMousePos;
var mousePos = { "x":0, "y":0 };

function loadImage(url)
{
	var tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

	var img = new Image();
	img.addEventListener('load', function() {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		draw();
	})
	img.src = url;

	return tex;
}

function drawCode()
{
	var arr = fragmentShaderSource.split("\n");
	for (var i = 0; i < arr.length; ++i) {
		//arr[i] = arr[i].replace(" ", "&nbsp");
		//arr[i] = arr[i].replace("\t", "&nbsp &nbsp ");
		$("#code").append("<tr>  <td><pre>" + i + "</pre></td> <td><pre>" + arr[i] + "</pre></td>  </tr>");
	}
}

function init() {
	// Get A WebGL context
	var canvas = document.getElementById("c");
	gl = canvas.getContext("webgl2");
	if (!gl) {
		return;
	}

	var done = false;

	$.ajax({url: "https://www.shadertoy.com/api/v1/shaders/Ml3Gzr?key=Nd8tWz", async:false, success: function(result) {
		fragmentShaderSource = fragmentShaderSource.replace("CODE_HERE", result["Shader"]["renderpass"][0]["code"]);
	}});

	iChannel0Tex = loadImage("bricks.jpg");

	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	// create GLSL shaders, upload the GLSL source, compile the shaders
	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

	// Link the two shaders into a program
	program = createProgram(gl, vertexShader, fragmentShader);

	// look up where the vertex data needs to go.
	var positionAttributeLocation = gl.getAttribLocation(program, "a_position");

	iResolutionPos = gl.getUniformLocation(program, "iResolution");
	iTimePos = gl.getUniformLocation(program, "iTime");
	iMousePos = gl.getUniformLocation(program, "iMouse");
	iChannel0Pos = gl.getUniformLocation(program, "iChannel0");

	analyzerMousePos = gl.getUniformLocation(program, "ANALYZER_MOUSE");

	/*var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, iChannel0Tex);
	gl.generateMipmap(gl.TEXTURE_2D);*/
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Create a buffer and put three 2d clip space points in it
	var positionBuffer = gl.createBuffer();

	// Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

	var positions = [
		-1.0, -1.0,
		 1.0,  1.0,
		-1.0,  1.0,
		-1.0, -1.0,
		 1.0,  1.0,
		 1.0, -1.0,
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

	// Create a vertex array object (attribute state)
	vao = gl.createVertexArray();

	// and make it the one we're currently working with
	gl.bindVertexArray(vao);

	// Turn on the attribute
	gl.enableVertexAttribArray(positionAttributeLocation);

	// Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
	var size = 2;          // 2 components per iteration
	var type = gl.FLOAT;   // the data is 32bit floats
	var normalize = false; // don't normalize the data
	var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
	var offset = 0;        // start at the beginning of the buffer
	gl.vertexAttribPointer(
			positionAttributeLocation, size, type, normalize, stride, offset);

	//webglUtils.resizeCanvasToDisplaySize(gl.canvas);

	// Tell WebGL how to convert from clip space to pixels
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	draw();

	$("#mouseX, #time").on('input', function() {
		//console.log($("#time").val());
		draw();
	});
	$("#c").click(function(e) {
		var x = e.pageX - this.offsetLeft;
		var y = e.pageY - this.offsetTop;
		mousePos["x"] = x;
		mousePos["y"] = y;
		draw();
	});

	drawCode();
}

function draw()
{
	// Clear the canvas
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);

	// Tell it to use our program (pair of shaders)
	gl.useProgram(program);

	// Bind the attribute/buffer set we want.
	gl.bindVertexArray(vao);

	gl.uniform2f(iResolutionPos, gl.canvas.width, gl.canvas.height);
	gl.uniform1f(iTimePos, $("#time").val());
	gl.uniform4f(iMousePos, $("#mouseX").val(), 0., 0., 0.);

	gl.activeTexture(gl.TEXTURE0 + 0);
	//gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(iChannel0Pos, 0);

	gl.uniform2f(analyzerMousePos, mousePos["x"], mousePos["y"]);

	// draw
	var primitiveType = gl.TRIANGLES;
	var offset = 0;
	var count = 6;
	gl.drawArrays(primitiveType, offset, count);
}

init();