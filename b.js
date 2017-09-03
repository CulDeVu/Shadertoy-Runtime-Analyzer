
var vShader = `#version 300 es

layout(location=0) in vec4 position;

void main() {
    gl_Position = position;
}`;

var fShader = `#version 300 es
precision highp float;

uniform shadertoy_uniforms {
    vec2 iResolution;
    float iTime;
    vec4 iMouse;
};

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

out vec4 outColor;

// for analyzer purposes
uniform vec2 analyzer_mouse;
int analyzer_counter = 0;
vec4 analyzer_output = vec4(1337,1337,1337,1337);

CODE_HERE

ENTRY_POINT_HERE`;

var previewEntryPoint = `
void main() {
	vec2 fragCoord = gl_FragCoord.xy;

    mainImage(outColor, fragCoord);
    outColor.w = 1.;

	if (abs(fragCoord.x - analyzer_mouse.x) < 2. ^^
		abs(iResolution.y - fragCoord.y - analyzer_mouse.y) < 2.)
	{
		outColor = mix(outColor, vec4(1,0,0,1), 0.5);
	}
}`;

var varWatchEntryPoint = `
void main() {
	vec2 fragCoord = vec2(analyzer_mouse.x, iResolution.y - analyzer_mouse.y);

	mainImage(outColor, fragCoord);

	outColor = analyzer_output;// + outColor*1.e-30;
}`

function loadVarWatchSource(linenum, name, components)
{
	var varWatchFragSource = fShader.replace("ENTRY_POINT_HERE", varWatchEntryPoint);
	var arr = varWatchFragSource.split("\n");

	var s = "if(int(gl_FragCoord.x+0.1)==analyzer_counter) { analyzer_output";
	if (components == 1)
		s += ".x";
	else if (components == 2)
		s += ".xy";
	else if (components == 3)
		s += ".xyz";
	s += "=" + name + "; } analyzer_counter+=1;"

	arr.splice(linenum, 0, s);
	varWatchFragSource = arr.join("\n");
	//console.log(varWatchFragSource);
	return varWatchFragSource;
}

function drawCode(source)
{
	$("#code").html("");
	var arr = source.split("\n");

	for (var i = 0; i < arr.length; ++i) {

		var s = arr[i];
		$("#code").append("<tr class='code-row code-row-" + i + "' row='" + i + "'>  <td><pre>" + i + "</pre></td> <td><pre>" + s + "</pre></td>  </tr>");
	}
}

function reloadWatchShader()
{
    if (watch_program != null)
        watch_program.delete();
    console.log(window.getSelection().toString());

    var selectionText = window.getSelection().toString();
    var inputboxTex = $('#watch_text').val();

    if (selectionText == "" && inputboxTex == "") {
        watch_shader = fShader.replace("ENTRY_POINT_HERE", varWatchEntryPoint);
    }
    else if (selectionText == "") {
        var compNum = parseInt($("#watch_compNum").val());
        var linenum = parseInt($('.code-row-selected').first().attr('row'));
        var name = inputboxTex;
        console.log(linenum);

        watch_shader = loadVarWatchSource(linenum + 1, name, compNum);
    }
    else {
        var compNum = parseInt($("#watch_compNum").val());
        var linenum = parseInt($(window.getSelection().anchorNode).parents().eq(2).attr("row"));
        var name = selectionText;

        watch_shader = loadVarWatchSource(linenum + 1, name, compNum);
    }
    //console.log(watch_shader);
    
    watch_program = app.createProgram(vShader, watch_shader);
    
    watch_drawCall = app.createDrawCall(watch_program, triangleArray)
    .texture("iChannel0", iChannel0Tex)
    .texture("iChannel1", iChannel0Tex)
    .texture("iChannel2", iChannel0Tex)
    .uniformBlock("shadertoy_uniforms", shadertoy_uniforms_buf)
    .uniform("analyzer_mouse", [0,0]);
    watch_drawCall.uniform("analyzer_mouse", analyzer_mouse);
}

const WATCH_DIM_X = 128;
const WATCH_DIM_Y = 1;

var preview_shader;
var watch_shader;

var preview_program;
var watch_program = null;

var preview_drawCall;
var watch_drawCall;

var shadertoy_uniforms_buf;

var analyzer_mouse = [0, 0];
var watch_mouse = [0, 0];
var analyzer_data = null;
var analyzer_clickable = [];
var watch_clicked = 0;

var shader_url = "voxel.fs";

// Set up PicoGL and context
var canvas = document.getElementById("preview");
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

var app = PicoGL.createApp(canvas)
.clearColor(0.5, 0.5, 0.5, 1);

const ext = app.gl.getExtension("EXT_color_buffer_float");
if (!ext) {
    alert("need EXT_color_buffer_float to work");
}

// Load the main shader. This should only happen once per page
$.ajax({url: shader_url, async:false, cache:false, success: function(result) {
    var shadertoyRaw = result;
    fShader = fShader.replace("CODE_HERE", shadertoyRaw);
}});

preview_shader = fShader.replace("ENTRY_POINT_HERE", previewEntryPoint);
preview_program = app.createProgram(vShader, preview_shader);
drawCode(preview_shader);

// create the main square model that we'll be using
var positions = app.createVertexBuffer(PicoGL.FLOAT, 2, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
]));

var triangleArray = app.createVertexArray()
.vertexAttributeBuffer(0, positions);

// Set up uniforms and stuff
shadertoy_uniforms_buf = app.createUniformBuffer([
    PicoGL.FLOAT_VEC2,
    PicoGL.FLOAT,
    PicoGL.FLOAT_VEC4,
])
.set(0, [canvas.width, canvas.width])
.set(1, 0)
.set(2, [0,0,0,0])
.update();

var iChannel0Tex = app.createTexture2D(new Uint8Array([0, 0, 255, 255]), 1, 1);

var preview_drawCall = app.createDrawCall(preview_program, triangleArray)
.texture("iChannel0", iChannel0Tex)
.texture("iChannel1", iChannel0Tex)
.texture("iChannel2", iChannel0Tex)
.uniformBlock("shadertoy_uniforms", shadertoy_uniforms_buf)
.uniform("analyzer_mouse", [0,0]);

// Set up watch buffers and shaders and stuff
var watch_fb = app.createFramebuffer(WATCH_DIM_X, WATCH_DIM_Y)
.colorTarget(0, { type: PicoGL.FLOAT, internalFormat: PicoGL.RGBA32F });

reloadWatchShader();

// Load the images that are needed
var image = new Image();
image.onload = function() {
    iChannel0Tex = app.createTexture2D(image);

    preview_drawCall
    .texture("iChannel0", iChannel0Tex)
    .texture("iChannel1", iChannel0Tex)
    .texture("iChannel2", iChannel0Tex);

    drawAll();
}
image.src = "bricks.jpg";

// Drawing code
var drawAll = function() {
    app.clear();

    app.drawFramebuffer(watch_fb).clearColor(7, 8, 9, 10).clear();
    watch_drawCall.draw();

    app.defaultDrawFramebuffer().clearColor(0.0, 0.0, 0.0, 1.0).clear();
    preview_drawCall.draw();

    {
        app.readFramebuffer(watch_fb);
		
		analyzer_data = new Float32Array(WATCH_DIM_X * 4);
		app.gl.readPixels(0, 0, WATCH_DIM_X, 1, app.gl.RGBA, app.gl.FLOAT, analyzer_data);
		//console.log(analyzer_data);
    }
    
    drawGraph();
}

// All UI callbacks
$("#mouseX, #time").on('input', function() {
    shadertoy_uniforms_buf
    .set(1, $("#time").val())
    .set(2, [$("#mouseX").val(), 0, 0, 0])
    .update();

    drawAll();
});
$("#preview").click(function(e) {
    var x = e.pageX - this.offsetLeft;
    var y = e.pageY - this.offsetTop;
    analyzer_mouse = [x, y];
    preview_drawCall.uniform("analyzer_mouse", analyzer_mouse);
    watch_drawCall.uniform("analyzer_mouse", analyzer_mouse);
    drawAll();
});
$("#analyzer_var").on('click', function(e) {
    reloadWatchShader();
    drawAll();
});
$("#varVisualizer").on('mousemove', function(e) {
    var x = e.pageX - this.offsetLeft;
    var y = e.pageY - this.offsetTop;
    watch_mouse = [x, y];

    var best_score = Math.pow(20, 2);
    var best_id = watch_clicked;
    for (var i = 0; i < analyzer_clickable.length; ++i) {
        var score = Math.pow(analyzer_clickable[i][1] - x, 2) + Math.pow(analyzer_clickable[i][2] - y, 2);
        if (score < best_score) {
            best_score = score;
            best_id = i;
        }
    }

    watch_clicked = best_id;
    drawGraph();
})
$('.code-row').on('click', function(e) {
    $('.code-row-selected').not(this).removeClass('code-row-selected');
    $(this).toggleClass('code-row-selected');
});

drawAll();

function drawGraphImp(ctx, data, mouse_clicked) {
    var canvas = ctx.canvas;

    var minH = 0;
    var maxH = 1;
    var maxInd = 0;
    var hwidth, hheight;
    clickable = [];

    for (var i = 0; i < data.length; ++i) {
        if (data[i][0] == 1337) {
            maxInd = i;
            break;
        }
    }

    function findMin(comp) {
        for (var i = 0; i < maxInd; ++i) {
            minH = Math.min(minH, data[i][comp]);
            maxH = Math.max(maxH, data[i][comp]);
        }
    }

    function xPos(x) {
        return (x - hwidth) * ctx.canvas.width / (2.0 * hwidth*1.1) + ctx.canvas.width/2.0;
    }
    function yPos(y) {
        return ctx.canvas.height - ( (y - hheight - minH) * ctx.canvas.height /  (2.0 * (hheight+0.001)*1.1) + ctx.canvas.height/2.0 );
    }

    function drawSingleComponent(comp, color) {
        ctx.fillStyle = color;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(xPos(0), yPos(0));
        for (var i = 0; i < maxInd; ++i) {
            var x = xPos(i);
            var y = yPos(data[i][comp]);
            ctx.lineTo(xPos(i), yPos(data[i][comp]));
            clickable.push([ i, x, y ]);
        }
        ctx.lineTo(xPos(maxInd-1), yPos(0));
        ctx.closePath();
        ctx.fill();
    }
    function draw2(comp, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalCompositeOperation = 'source-over';
        ctx.moveTo(xPos(0), yPos(data[0][comp]));
        for (var i = 1; i < maxInd; ++i) {
            ctx.lineTo(xPos(i), yPos(data[i][comp]));
        }
        ctx.stroke();
    
        //ctx.fillStyle = "#f00";
        ctx.strokeStyle = color;
        ctx.fillStyle = "#fff";
        ctx.globalCompositeOperation = 'source-over';
        for (var i = 0; i < maxInd; ++i) {
            var x = xPos(i);
            var y = yPos(data[i][comp]);
            ctx.fillRect(x - 3, y - 3, 6, 6);
            ctx.strokeRect(x - 3, y - 3, 6, 6);
        }
    }
    function addToClickable(comp) {
        for (var i = 0; i < maxInd; ++i) {
            var x = xPos(i);
            var y = yPos(data[i][comp]);
            clickable.push([ i, x, y ]);
        }
    }

    findMin(0);
    if (data[0][1] != 1337) findMin(1);
    if (data[0][2] != 1337) findMin(2);

    hwidth = Math.max((maxInd-1) / 2.0, 1);
    hheight = (maxH - minH) / 2.0;

    {
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(xPos(0), yPos(0));
        ctx.lineTo(xPos(maxInd - 1), yPos(0));
        ctx.stroke();
    }

    addToClickable(0);
    addToClickable(1);
    addToClickable(2);

    /*drawSingleComponent(0, '#900');
    if (data[0][1] != 1337)
        drawSingleComponent(1, '#090');
    if (data[0][2] != 1337)
        drawSingleComponent(2, '#00b');*/

    if (0 <= mouse_clicked && mouse_clicked < clickable.length)
    {
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(xPos(clickable[mouse_clicked][0]), yPos(maxH));
        ctx.lineTo(xPos(clickable[mouse_clicked][0]), yPos(minH));
        ctx.stroke();
    }

    draw2(0, '#900');
    if (data[0][1] != 1337)
        draw2(1, '#090');
    if (data[0][2] != 1337)
        draw2(2, '#009');

    return clickable;
}

function drawGraph()
{
    var visual = document.getElementById("varVisualizer");
    visual.width = visual.clientWidth;
    visual.height = visual.clientHeight;
    var ctx = visual.getContext("2d");
    if (!ctx)
        console.log(ctx);

    var data = [];
    for (var i = 0; i < analyzer_data.length; i += 4) {
        data.push([
            analyzer_data[i + 0],
            analyzer_data[i + 1],
            analyzer_data[i + 2],
            analyzer_data[i + 3]
        ]);
    }

    analyzer_clickable = drawGraphImp(ctx, data, watch_clicked);
    if (analyzer_clickable == null)
        return;
    if (analyzer_clickable.length == 0)
        return;
    if (watch_clicked >= analyzer_clickable.length)
        return;
    //console.log(analyzer_clickable);

    /*ctx.beginPath();
    ctx.strokeStyle = '#0a0';
    ctx.moveTo(watch_mouse[0], watch_mouse[1]);
    ctx.lineTo(analyzer_clickable[watch_clicked][1], analyzer_clickable[watch_clicked][2]);
    ctx.stroke();*/
    var clicked_id = analyzer_clickable[watch_clicked][0];

    var s = 'Iter ' + clicked_id + ': (' + 
        analyzer_data[4 * clicked_id + 0] + ', ' +
        analyzer_data[4 * clicked_id + 1] + ', ' +
        analyzer_data[4 * clicked_id + 2] + ', ' +
        analyzer_data[4 * clicked_id + 3] + ')';
    $('#rawVisualizer').html(s);
}

// DEBUG SHIT
if (true)
{
    watch_program.delete();
    watch_shader = loadVarWatchSource(195, "center", 3);

    watch_program = app.createProgram(vShader, watch_shader);

    watch_drawCall = app.createDrawCall(watch_program, triangleArray)
    .texture("iChannel0", iChannel0Tex)
    .texture("iChannel1", iChannel0Tex)
    .texture("iChannel2", iChannel0Tex)
    .uniformBlock("shadertoy_uniforms", shadertoy_uniforms_buf)
    .uniform("analyzer_mouse", [0,0]);

    watch_drawCall.uniform("analyzer_mouse", analyzer_mouse);
}