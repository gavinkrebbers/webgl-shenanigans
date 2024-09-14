const vertexShaderSource = `
attribute vec4 a_position;
void main() {
    gl_Position = vec4(a_position.xy, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 iResolution;
// uniform float iTime;
uniform vec3 ro; 

const float EPSILON = 0.001;
const float MAX_DIST = 100.0;
const int MAX_STEPS = 100;
uniform float Power;

float SDF(vec3 pos, out int steps) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    for (int i = 0; i < 30; i++) {
        r = length(z);
        steps = i;
        if (r > 4.0) break;

        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr = pow(r, Power - 1.0) * Power * dr + 1.0;

        float zr = pow(r, Power);
        theta = theta * Power;
        phi = phi * Power;

        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
        z += pos;
    }

    return 0.5 * log(r) * r / dr;
}

vec3 normal(vec3 point) {
    vec2 e = vec2(EPSILON, 0.0);
    int steps = 0;

    return normalize(
        SDF(point, steps) - vec3(
            SDF(point + e.xyy, steps),
            SDF(point + e.yxy, steps),
            SDF(point + e.yyx, steps)
        )
    );
}

float march(vec3 ro, vec3 rd, out int steps) {
    float depth = 0.0;

    for (int i = 0; i < MAX_STEPS; ++i) {
        float dist = SDF(ro + depth * rd, steps);

        if (dist < EPSILON) return depth;

        depth += dist;

        if (depth > MAX_DIST) return MAX_DIST;
    }

    return MAX_DIST;
}




void main() {
    vec2 xy = gl_FragCoord.xy - iResolution.xy / 2.0;
    // vec3 ro = vec3(0.0, 0.5 * sin(iTime), 2.0 + sin(iTime / 3.0));
    // vec3 ro = vec3(0.0, 0.0, 4.0 );
    vec3 rd = normalize(vec3(xy, -iResolution.y / tan(radians(50.0) / 2.0)));
    int steps = 0;

    float dist = march(ro, rd, steps);

    if (dist < MAX_DIST) {
        gl_FragColor = vec4(vec3(clamp(float(steps) / 20.0, 0.0, 1.0)), 1.0);
        return;
    }

    gl_FragColor = vec4(vec3(0.0), 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('An error occurred linking the program: ' + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;



}

function main() {
    const canvas = document.getElementById('webglCanvas');
    const gl = canvas.getContext('webgl');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const PowerLocation = gl.getUniformLocation(program, 'Power');
    const roLocation = gl.getUniformLocation(program, 'ro');


    let cameraPosition = [0.0, 0.0, 4.0];
    const moveSpeed = 0.1;

    function handleKeyDown(event) {
        console.log("working");

        switch (event.key) {
            case 'w':
                cameraPosition[2] -= moveSpeed;
                break;
            case 's':
                cameraPosition[2] += moveSpeed;
                break;
            case 'a':
                cameraPosition[0] -= moveSpeed;
                break;
            case 'd':
                cameraPosition[0] += moveSpeed;
                break;
        }
    }
    window.addEventListener('keydown', handleKeyDown);

    let mouseX = 0;
    let mouseY = 0;
    let mouseDown = false;
    gl.uniform1f(PowerLocation, 16.0);

    canvas.addEventListener('mousedown', (event) => {
        mouseDown = true;
        const rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;
    });

    canvas.addEventListener('mouseup', (event) => {
        mouseDown = false;

    });
    canvas.addEventListener('mousemove', (event) => {
        if (mouseDown) {
            const rect = canvas.getBoundingClientRect();
            mouseX = event.clientX - rect.left;
            mouseY = event.clientY - rect.top;
        }
        else {
            const sensitivity = 0.003;
            const deltaX = -(event.clientX - previousMousePos[0]);
            const deltaY = event.clientY - previousMousePos[1];
            previousMousePos = [event.clientX, event.clientY];

            yaw += deltaX * sensitivity;
            pitch -= deltaY * sensitivity;

            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
            updateCameraDir();
        }

    });





    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
        gl.uniform1f(PowerLocation, mouseX / mouseY);
        gl.uniform3fv(roLocation, cameraPosition);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

document.addEventListener('DOMContentLoaded', main);
