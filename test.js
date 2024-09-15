const vertexShaderSource = `
attribute vec4 aPosition;
void main() {
    gl_Position = aPosition;
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uCameraDir;

float round(float x) {
    return floor(x + 0.5);
}

vec3 roundVec3(vec3 v) {
    return vec3(
        round(v.x),
        round(v.y),
        round(v.z)
    );
}

float sphereSDF(vec3 p, float r) {
    return length(p) - r;
}

float repeat(vec3 p, float spacing) {
    vec3 repeatedP = p - spacing * roundVec3(p / spacing);
    //rad is 0.5 of all spheres 
    return sphereSDF(repeatedP, 0.5); 
}

float raymarch(vec3 ro, vec3 rd) {
    float totalDist = 0.0;
    const float maxDist = 5000.0;
    const int maxSteps = 100;
    const float epsilon = 0.001;
    const float spacing = 1.4; 

    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * totalDist;
        float dist = repeat(p, spacing);
        totalDist += dist;
        if (dist < epsilon || totalDist > maxDist) break;
    }

    return totalDist;
}

vec3 getColor(float t) {
    return mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), t);
}

void main() {
    vec2 uv = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), uCameraDir));
    vec3 up = cross(uCameraDir, right);

    vec3 rd = normalize(uv.x * right + uv.y * up + uCameraDir);

    float dist = raymarch(uCameraPos, rd);

    float shade = 1.0 / (dist + 1.0);
    shade = clamp(shade, 0.0, 1.0);

    vec3 color = getColor(shade);
    gl_FragColor = vec4(color, 1.0);
}
`;
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function main() {
    const canvas = document.getElementById('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0,
        1.0, -1.0,
        -1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        1.0, 1.0
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);

    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    // const timeLocation = gl.getUniformLocation(program, 'uTime');
    const cameraPosLocation = gl.getUniformLocation(program, 'uCameraPos');
    const cameraDirLocation = gl.getUniformLocation(program, 'uCameraDir');

    let cameraPos = [5, 8, 6];
    let cameraDir = [0, 0, -1];
    let up = [0, 1, 0];
    let right = [1, 0, 0];

    let isDragging = false;
    let previousMousePos = [0, 0];
    let yaw = -Math.PI / 2;
    let pitch = 0;

    function updateCameraDir() {
        cameraDir[0] = Math.cos(pitch) * Math.sin(yaw);
        cameraDir[1] = Math.sin(pitch);
        cameraDir[2] = -Math.cos(pitch) * Math.cos(yaw);

        right = normalize(cross(up, cameraDir));
        up = normalize(cross(cameraDir, right));
    }

    function cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    function normalize(v) {
        let len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    function render(time) {
        time *= 0.001;

        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        // gl.uniform1f(timeLocation, time);
        gl.uniform3fv(cameraPosLocation, cameraPos);
        gl.uniform3fv(cameraDirLocation, cameraDir);



        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    function handleKeyDown(event) {
        const speed = 0.1;
        if (event.key === 'w') {
            cameraPos = cameraPos.map((c, i) => c + cameraDir[i] * speed);
        } else if (event.key === 's') {
            cameraPos = cameraPos.map((c, i) => c - cameraDir[i] * speed);
        } else if (event.key === 'a') {
            cameraPos = cameraPos.map((c, i) => c - right[i] * speed);
        } else if (event.key === 'd') {
            cameraPos = cameraPos.map((c, i) => c + right[i] * speed);
        }
    }

    function handleMouseMove(event) {
        const sensitivity = 0.003;
        const deltaX = -(event.clientX - previousMousePos[0]);
        const deltaY = event.clientY - previousMousePos[1];
        previousMousePos = [event.clientX, event.clientY];

        yaw += deltaX * sensitivity;
        pitch -= deltaY * sensitivity;

        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        updateCameraDir();
    }

    function handleMouseDown(event) {
        isDragging = true;
        previousMousePos = [event.clientX, event.clientY];
    }

    function handleMouseUp() {
        isDragging = false;
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    resizeCanvas(canvas);
    window.addEventListener('resize', () => resizeCanvas(canvas));

    render();
}

function resizeCanvas(canvas) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    const gl = canvas.getContext('webgl');
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

main();
