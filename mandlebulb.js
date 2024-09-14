
const vertexShaderSource = `
        attribute vec4 a_position;
        void main() {
            gl_Position = vec4(a_position.xy, 0.0, 1.0);
        }
        `;

const fragmentShaderSource = `
        precision highp float;
        uniform vec2 iResolution;
        uniform vec3 ro;
        uniform mat3 cameraMatrix;
        const float EPSILON = 0.001;
        const float MAX_DIST = 200.0;
        const int MAX_STEPS = 100;
        uniform float Power;

        float SDF(vec3 pos, out int steps) {
            vec3 z = pos;
            float dr = 1.0;
            float r = 0.0;
            for (int i = 0; i < 500; i++) {
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
            vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
            vec3 rd = normalize(cameraMatrix * vec3(uv, -1.0));
            int steps = 0;
            float dist = march(ro, rd, steps);
            if (dist < MAX_DIST) {
                gl_FragColor = vec4(vec3(clamp(float(steps) / 20.0, 0.2, 1.0)), 1.0);
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
        canvas.width = window.innerWidth * devicePixelRatio;
        canvas.height = window.innerHeight * devicePixelRatio;
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
    const cameraMatrixLocation = gl.getUniformLocation(program, 'cameraMatrix');

    let cameraPosition = [0.0, 0.0, 4.0];
    let cameraSpeed = 0.01;
    // let yaw = -3.0617963267948873;
    // let pitch = -0.08879632679490058;
    let yaw = 0;
    let pitch = 0;
    let keys = {};
    let pointerLocked = false;

    let previousMousePos = [0, 0];

    const slider = document.getElementById('mySlider');
    const sliderValue = document.getElementById('sliderValue');

    function updateSliderValue() {
        const powerValue = parseFloat(slider.value);
        sliderValue.textContent = powerValue;
        gl.uniform1f(PowerLocation, powerValue);
    }

    slider.addEventListener('input', updateSliderValue);

    updateSliderValue();

    function updateCameraPosition() {
        const forward = [
            Math.cos(pitch) * Math.sin(yaw),
            Math.sin(pitch),
            -Math.cos(pitch) * Math.cos(yaw)
        ];

        const right = [
            Math.cos(yaw),
            0,
            Math.sin(yaw)
        ];

        if (keys['w']) {
            cameraPosition[0] += forward[0] * cameraSpeed;
            cameraPosition[1] += forward[1] * cameraSpeed;
            cameraPosition[2] += forward[2] * cameraSpeed;
        }
        if (keys['s']) {
            cameraPosition[0] -= forward[0] * cameraSpeed;
            cameraPosition[1] -= forward[1] * cameraSpeed;
            cameraPosition[2] -= forward[2] * cameraSpeed;
        }
        if (keys['a']) {
            cameraPosition[0] -= right[0] * cameraSpeed;
            cameraPosition[1] -= right[1] * cameraSpeed;
            cameraPosition[2] -= right[2] * cameraSpeed;
        }
        if (keys['d']) {
            cameraPosition[0] += right[0] * cameraSpeed;
            cameraPosition[1] += right[1] * cameraSpeed;
            cameraPosition[2] += right[2] * cameraSpeed;
        }
    }

    canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        pointerLocked = !!document.pointerLockElement;
    });

    window.addEventListener('keydown', (event) => {
        keys[event.key] = true;
    });

    window.addEventListener('keyup', (event) => {
        keys[event.key] = false;
    });

    // Mouse movement listener to change yaw and pitch
    window.addEventListener('mousemove', (event) => {
        if (!pointerLocked) return;

        const sensitivity = 0.002; // Adjust the sensitivity to your preference
        yaw -= event.movementX * sensitivity;
        pitch -= event.movementY * sensitivity;

        // Clamp the pitch to prevent flipping the camera upside down
        const maxPitch = Math.PI / 2 - 0.01;
        const minPitch = -Math.PI / 2 + 0.01;
        // pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    });

    function getCameraMatrix(yaw, pitch) {
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);

        return new Float32Array([
            cosYaw, 0, -sinYaw,
            sinYaw * sinPitch, cosPitch, cosYaw * sinPitch,
            sinYaw * cosPitch, -sinPitch, cosPitch * cosYaw
        ]);
    }

    function render() {
        gl.clear(gl.COLOR_BUFFER_BIT);

        updateCameraPosition();

        const cameraMatrix = getCameraMatrix(yaw, pitch);

        gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
        gl.uniform3fv(roLocation, cameraPosition);
        gl.uniformMatrix3fv(cameraMatrixLocation, false, cameraMatrix);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    render();
}

// main();


main();

