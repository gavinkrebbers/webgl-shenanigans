var speed = 1.0;
var zoom = 1.0;
var lastTime = Date.now();
var totalTime = 0;
var userRadius = 0.25;
var vertShaderText = [
    'precision mediump float;',
    '',
    'attribute vec2 vertPosition;',
    '',
    'void main()',
    '{',
    '    gl_Position = vec4(vertPosition, 0.0, 1.0);',
    '}'
].join('\n');

var fragmentShaderText =
    `precision mediump float;

uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uZoom;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    uv = (uv * 2.0 - 1.0) / uZoom;
    uv.x *= uResolution.x / uResolution.y;

    vec2 normalizedMouse = (uMouse / uResolution) * 2.0 - 1.0;

    float mouseX = normalizedMouse.x;
    float mouseY = normalizedMouse.y;
    vec2 c = vec2(
        sin(mouseX * 2.0) * cos(mouseY * 2.0),
        cos(mouseX * 2.0) * sin(mouseY * 2.0)
    );

    c += vec2(
        sin(mouseX * 1.0) * cos(mouseY * 5.0),
        cos(mouseX * 8.0) * sin(mouseY * 10.0)
    ) * 0.2;

    vec2 z = uv;
    int iterations = 0;
    const int maxIterations = 100;

    for(int i = 0; i < maxIterations; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if(length(z) > 2.0) break;
        iterations++;
    }

    float colorValue = float(iterations) / float(maxIterations);
    vec3 color = vec3(colorValue);
    gl_FragColor = vec4(color, 1.0);
}`;



var InitDemo = function () {
    var canvas = document.getElementById('webgl-canvas');
    var gl = canvas.getContext('webgl');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertShaderText);
    gl.shaderSource(fragmentShader, fragmentShaderText);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
        return;
    }

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
        return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
    }

    var fullScreenQuadVertices = [
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0
    ];

    var quadVertexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fullScreenQuadVertices), gl.STATIC_DRAW);

    var positionAttribLocation = gl.getAttribLocation(program, 'vertPosition');
    gl.vertexAttribPointer(
        positionAttribLocation,
        2,
        gl.FLOAT,
        gl.FALSE,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
    );

    gl.enableVertexAttribArray(positionAttribLocation);

    gl.useProgram(program);

    var mouseUniformLocation = gl.getUniformLocation(program, 'uMouse');
    var resolutionUniformLocation = gl.getUniformLocation(program, 'uResolution');
    var zoomUniformLocation = gl.getUniformLocation(program, 'uZoom');

    gl.uniform2f(resolutionUniformLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);

    function update() {
        var currentTime = Date.now()

        var deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        totalTime += deltaTime;
        var time = totalTime * speed;

        var radius = Math.min(gl.drawingBufferWidth, gl.drawingBufferHeight) * userRadius;
        var mouseX = canvas.width / 2 + Math.cos(time) * radius;
        var mouseY = canvas.height / 2 + Math.sin(time) * radius;

        gl.uniform2f(mouseUniformLocation, mouseX, mouseY);
        gl.uniform1f(zoomUniformLocation, zoom);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        lastTime = Date.now()
        requestAnimationFrame(update);
    }





    update();
};

function updateSpeed(value) {
    speed = parseFloat(value);
    console.log(value);
}

function updateZoom(value) {
    zoom = parseFloat(value);
    console.log(value);
}
function updateRadius(value) {
    userRadius = parseFloat(value);
    console.log(value);
}