const DECAY_RATE = 0.92;
const FAST_DECAY = 0.85;

const VERTEX_SHADER_SOURCE = `
    attribute vec2 a_position;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

const ISF_DECL = `uniform float TIME;
uniform vec2 RENDERSIZE;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_audioLevel;

uniform float u_trigger_drum;
uniform float u_trigger_bass;
uniform float u_trigger_melody;
uniform float u_trigger_other;
uniform float u_trigger_kick;
uniform float u_trigger_snare;
uniform float u_trigger_hat;
uniform float u_trigger_clap;
uniform float u_note_pitch;
uniform float u_trigger_track;

#define isf_FragNormCoord (gl_FragCoord.xy / RENDERSIZE)
`;

function parseISFHeader(source) {
    const match = source.match(/\/\*\{([\s\S]*?)\}\*\//);
    if (!match) return { inputs: [] };
    try {
        const json = JSON.parse('{' + match[1] + '}');
        const inputs = Array.isArray(json.INPUTS) ? json.INPUTS : [];
        const validTypes = ['float','bool','long','event','color','point2D','image'];
        return {
            inputs: inputs.filter(i => validTypes.includes(i.TYPE)).map(i => {
                const type = i.TYPE;
                const name = i.NAME;
                let def, min, max, values, labels;
                if (type === 'color') {
                    const d = i.DEFAULT;
                    def = d ? [d[0]??0, d[1]??0, d[2]??0, d[3]??1] : [0, 0, 0, 1];
                    min = 0; max = 1;
                } else if (type === 'point2D') {
                    const d = i.DEFAULT;
                    def = d ? [d[0]??0, d[1]??0] : [0, 0];
                    min = i.MIN ?? -1; max = i.MAX ?? 1;
                } else if (type === 'bool') {
                    def = i.DEFAULT ? 1 : 0;
                    min = 0; max = 1;
                } else {
                    def = i.DEFAULT ?? 0;
                    min = i.MIN ?? 0;
                    max = i.MAX ?? 1;
                }
                if (Array.isArray(i.VALUES)) {
                    values = i.VALUES;
                    min = Math.min(...values);
                    max = Math.max(...values);
                    if (i.LABELS && Array.isArray(i.LABELS)) labels = i.LABELS;
                }
                return { name, type, def, min, max, values, labels };
            })
        };
    } catch { return { inputs: [] }; }
}

export class ShaderEngine {
    constructor() {
        this.gl = null;
        this.canvas = null;
        this.program = null;
        this.vertices = null;
        this.compileError = null;
        this.running = false;
        this.rafId = null;
        this.startTime = 0;
        this.audioData = { bass: 0, mid: 0, high: 0, level: 0 };
        this.uniforms = {};
        this.params = {};
        this.inputDefs = [];
        this.triggers = {
            drum: 0, bass: 0, melody: 0, other: 0,
            kick: 0, snare: 0, hat: 0, clap: 0,
        };
        this.notePitch = 0;
        this.lastTrack = 0;
        this.isWebGL2 = false;
        this._contextLost = false;
        this._resizeObserver = null;
        this._frameCount = 0;
        this._lastFpsTime = 0;
        this.fps = 0;
        this._enabled = true;
        this._fpsLimit = 0;
        this._lastFrameTime = 0;
        this._minFrameInterval = 0;
        this._onFpsUpdate = null;
        this._customTextures = {};
        this._contextRestoredCallbacks = [];
        this._boundContextLost = (e) => this._handleContextLost(e);
        this._boundContextRestored = () => this._handleContextRestored();
        this._lastSource = null;
    }

    set onFpsUpdate(cb) { this._onFpsUpdate = cb; }

    get enabled() { return this._enabled; }

    setEnabled(enabled) {
        this._enabled = enabled;
        if (!this.canvas) return;
        if (enabled) {
            this.startLoop();
        } else {
            this.stopLoop();
        }
    }

    setFpsLimit(fps) {
        this._fpsLimit = Math.max(0, Math.min(120, fps));
        this._minFrameInterval = this._fpsLimit > 0 ? 1000 / this._fpsLimit : 0;
    }

    trigger(kind, notePitch = 0) {
        if (!this._enabled) return;
        if (kind === "drum") {
            this.triggers.drum = 1;
        } else if (kind === "bass") {
            this.triggers.bass = 1;
            this.notePitch = notePitch;
            this.lastTrack = 1;
        } else if (kind === "melody") {
            this.triggers.melody = 1;
            this.notePitch = notePitch;
            this.lastTrack = 2;
        } else if (kind === "other") {
            this.triggers.other = 1;
            this.notePitch = notePitch;
            this.lastTrack = 3;
        }
    }

    triggerDrumVoice(voice) {
        if (!this._enabled) return;
        if (voice === "kick") this.triggers.kick = 1;
        else if (voice === "snare") this.triggers.snare = 1;
        else if (voice === "hat-close" || voice === "hat-open") this.triggers.hat = 1;
        else if (voice === "clap") this.triggers.clap = 1;
        this.triggers.drum = 1;
        this.lastTrack = 0;
    }

    decayTriggers() {
        if (!this.program) return;
        for (const key of Object.keys(this.triggers)) {
            this.triggers[key] *= key === "drum" ? FAST_DECAY : DECAY_RATE;
            if (this.triggers[key] < 0.001) this.triggers[key] = 0;
        }
        if (this.notePitch > 0) {
            this.notePitch *= 0.98;
            if (this.notePitch < 0.001) this.notePitch = 0;
        }
    }

    setParam(name, value) {
        this.params[name] = value;
    }

    getInputDefs() {
        return this.inputDefs;
    }

    _handleContextLost(event) {
        event.preventDefault();
        this._contextLost = true;
        this.stopLoop();
        this.running = false;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    _handleContextRestored() {
        this._contextLost = false;
        const opts = {
            antialias: false, alpha: false,
            premultipliedAlpha: false, preserveDrawingBuffer: false
        };
        let gl = this.canvas?.getContext("webgl2", opts);
        this.isWebGL2 = !!gl;
        if (!gl) gl = this.canvas?.getContext("webgl", opts);
        if (!gl) return;
        this.gl = gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);

        this._vbo = null;
        this._customTextures = {};
        this._setupResizeObserver();

        const shaderOk = this._lastSource ? this.compileShader(this._lastSource) : false;
        this.startTime = performance.now();
        this._lastFpsTime = performance.now();
        this._frameCount = 0;
        this.fps = 0;

        this.running = true;
        if (this._enabled) this.startLoop();
        this._contextRestoredCallbacks.forEach(cb => cb());
    }

    _setupResizeObserver() {
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (!this.canvas) return;
        this._resizeObserver = new ResizeObserver(() => {
            if (!this.gl || !this.canvas) return;
            const w = this.canvas.clientWidth;
            const h = this.canvas.clientHeight;
            if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
                this.canvas.width = w;
                this.canvas.height = h;
                this.gl.viewport(0, 0, w, h);
            }
        });
        this._resizeObserver.observe(this.canvas);
    }

    init(canvas) {
        this.canvas = canvas;
        const opts = {
            antialias: false,
            alpha: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false
        };
        let gl = canvas.getContext("webgl2", opts);
        this.isWebGL2 = !!gl;
        if (!gl) gl = canvas.getContext("webgl", opts);
        if (!gl) return false;
        this.gl = gl;
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        this.vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        this.startTime = performance.now();
        this._lastFpsTime = performance.now();
        this._frameCount = 0;
        this.fps = 0;
        this._lastFrameTime = 0;
        this._contextLost = false;
        this.running = true;
        this._enabled = true;

        canvas.addEventListener("webglcontextlost", this._boundContextLost);
        canvas.addEventListener("webglcontextrestored", this._boundContextRestored);
        this._setupResizeObserver();
        return true;
    }

    compileShader(source) {
        const gl = this.gl;
        if (!gl) return false;
        this.compileError = null;
        this._lastSource = source;

        const header = parseISFHeader(source);
        this.inputDefs = header.inputs;

        const glslBody = source.replace(/\/\*\{[\s\S]*?\}\*\//, "").trim();

        let decls = ISF_DECL;
        for (const inp of header.inputs) {
            const glslType = inp.type === 'color' ? 'vec4' : inp.type === 'point2D' ? 'vec2' : inp.type === 'long' ? 'int' : inp.type === 'bool' ? 'bool' : inp.type === 'image' ? 'sampler2D' : 'float';
            decls += `uniform ${glslType} ${inp.name};\n`;
            if (inp.type !== 'image') {
                this.params[inp.name] = inp.def;
            }
        }
        const fullSource = decls + "\n" + glslBody;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, VERTEX_SHADER_SOURCE);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            this.compileError = "Vertex: " + gl.getShaderInfoLog(vertexShader);
            gl.deleteShader(vertexShader);
            console.error("ShaderEngine vertex compile error:", this.compileError);
            return false;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, 'precision highp float;\n' + fullSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            this.compileError = "Fragment: " + gl.getShaderInfoLog(fragmentShader);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            console.error("ShaderEngine fragment compile error:", this.compileError);
            return false;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            this.compileError = "Link: " + gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            console.error("ShaderEngine link error:", this.compileError);
            return false;
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        if (this.program) gl.deleteProgram(this.program);
        this.program = program;

        const uniformNames = [
            "TIME", "RENDERSIZE",
            "u_bass", "u_mid", "u_high", "u_audioLevel",
            "u_trigger_drum", "u_trigger_bass", "u_trigger_melody", "u_trigger_other",
            "u_trigger_kick", "u_trigger_snare", "u_trigger_hat", "u_trigger_clap",
            "u_note_pitch", "u_trigger_track",
            ...header.inputs.map(i => i.name),
        ];
        this.uniforms = {};
        for (const name of uniformNames) {
            this.uniforms[name] = gl.getUniformLocation(program, name);
        }

        this.compileError = null;
        return true;
    }

    setAudioData(data) {
        this.audioData.bass = data.bass ?? 0;
        this.audioData.mid = data.mid ?? 0;
        this.audioData.high = data.high ?? 0;
        this.audioData.level = data.level ?? 0;
    }

    resize() {
        if (!this.gl || !this.canvas) return;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        if (w > 0 && h > 0 && (this.canvas.width !== w || this.canvas.height !== h)) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.gl.viewport(0, 0, w, h);
        }
    }

    render() {
        if (!this._enabled || this._contextLost) return;
        if (document.hidden) { this.decayTriggers(); return; }

        if (this._fpsLimit > 0) {
            const now = performance.now();
            const elapsed = now - this._lastFrameTime;
            if (elapsed < this._minFrameInterval) return;
            this._lastFrameTime = now;
        }

        const gl = this.gl;
        if (!gl || !this.program) { this.decayTriggers(); return; }
        this.resize();
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (w === 0 || h === 0) { this.decayTriggers(); return; }

        gl.useProgram(this.program);

        if (!this._vbo) {
            this._vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        }
        const positionLoc = gl.getAttribLocation(this.program, "a_position");
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        const U = this.uniforms;
        if (U.TIME !== null) gl.uniform1f(U.TIME, (performance.now() - this.startTime) / 1000);
        if (U.RENDERSIZE !== null) gl.uniform2f(U.RENDERSIZE, w, h);
        if (U.u_bass !== null) gl.uniform1f(U.u_bass, this.audioData.bass);
        if (U.u_mid !== null) gl.uniform1f(U.u_mid, this.audioData.mid);
        if (U.u_high !== null) gl.uniform1f(U.u_high, this.audioData.high);
        if (U.u_audioLevel !== null) gl.uniform1f(U.u_audioLevel, this.audioData.level);

        if (U.u_trigger_drum !== null) gl.uniform1f(U.u_trigger_drum, this.triggers.drum);
        if (U.u_trigger_bass !== null) gl.uniform1f(U.u_trigger_bass, this.triggers.bass);
        if (U.u_trigger_melody !== null) gl.uniform1f(U.u_trigger_melody, this.triggers.melody);
        if (U.u_trigger_other !== null) gl.uniform1f(U.u_trigger_other, this.triggers.other);
        if (U.u_trigger_kick !== null) gl.uniform1f(U.u_trigger_kick, this.triggers.kick);
        if (U.u_trigger_snare !== null) gl.uniform1f(U.u_trigger_snare, this.triggers.snare);
        if (U.u_trigger_hat !== null) gl.uniform1f(U.u_trigger_hat, this.triggers.hat);
        if (U.u_trigger_clap !== null) gl.uniform1f(U.u_trigger_clap, this.triggers.clap);
        if (U.u_note_pitch !== null) gl.uniform1f(U.u_note_pitch, this.notePitch);
        if (U.u_trigger_track !== null) gl.uniform1f(U.u_trigger_track, this.lastTrack);

        for (const inp of this.inputDefs) {
            if (inp.type === 'image') continue;
            const loc = U[inp.name];
            if (loc !== null) {
                const val = this.params[inp.name] ?? inp.def;
                if (inp.type === 'color') {
                    gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
                } else if (inp.type === 'point2D') {
                    gl.uniform2f(loc, val[0], val[1]);
                } else if (inp.type === 'long' || inp.type === 'bool') {
                    gl.uniform1i(loc, Math.round(val));
                } else {
                    gl.uniform1f(loc, val);
                }
            }
        }

        let texUnit = 0;
        for (const inp of this.inputDefs) {
            if (inp.type === 'image') {
                const tex = this._customTextures[inp.name];
                const loc = U[inp.name];
                if (tex && loc !== null) {
                    gl.activeTexture(gl.TEXTURE0 + texUnit);
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.uniform1i(loc, texUnit);
                    texUnit++;
                }
            }
        }

        this.decayTriggers();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this._frameCount++;
        const now = performance.now();
        if (now - this._lastFpsTime >= 1000) {
            this.fps = Math.round(this._frameCount / ((now - this._lastFpsTime) / 1000));
            this._frameCount = 0;
            this._lastFpsTime = now;
            if (this._onFpsUpdate) this._onFpsUpdate(this.fps);
        }
    }

    startLoop() {
        if (this.rafId) return;
        const loop = () => {
            if (!this.running) return;
            this.render();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    stopLoop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    setTexture(name, texture) {
        this._customTextures[name] = texture;
    }

    removeTexture(name) {
        delete this._customTextures[name];
    }

    createTextureFromImage(image) {
        const gl = this.gl;
        if (!gl) return null;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    deleteTexture(texture) {
        if (this.gl && texture) this.gl.deleteTexture(texture);
    }

    onContextRestored(callback) {
        if (typeof callback === 'function') {
            this._contextRestoredCallbacks.push(callback);
        }
    }

    destroy() {
        this.stopLoop();
        this.running = false;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this.gl) {
            if (this._vbo) {
                this.gl.deleteBuffer(this._vbo);
                this._vbo = null;
            }
            if (this.program) this.gl.deleteProgram(this.program);
            this.program = null;
            for (const key of Object.keys(this._customTextures)) {
                this.gl.deleteTexture(this._customTextures[key]);
            }
            this._customTextures = {};
        }
        if (this.canvas) {
            this.canvas.removeEventListener("webglcontextlost", this._boundContextLost);
            this.canvas.removeEventListener("webglcontextrestored", this._boundContextRestored);
        }
        this.gl = null;
        this.canvas = null;
    }
}
