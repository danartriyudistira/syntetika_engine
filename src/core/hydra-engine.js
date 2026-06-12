const Hydra = typeof window !== 'undefined' ? window.Hydra : null

const PASSTHROUGH_FRAG = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() {
    gl_FragColor = texture2D(u_tex, v_uv);
}`

const PASSTHROUGH_VERT = `attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

export class HydraEngine {
    constructor() {
        this.hydra = null
        this._canvas = null
        this._gl = null
        this.enabled = false
        this.currentCode = ''
        this.onError = null
        this._passthroughProg = null
        this._vbo = null
        this._vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
        this._syncTimer = null
        this._audioData = { bass: 0, mid: 0, high: 0, level: 0 }
    }

    init(canvas, gl) {
        if (!Hydra) {
            console.warn('HydraEngine: Hydra not available (hydra-synth not loaded)')
            return false
        }
        this._canvas = canvas
        this._gl = gl
        this._initPassthrough()

        const hydraCanvas = document.createElement('canvas')
        hydraCanvas.width = canvas.width
        hydraCanvas.height = canvas.height
        hydraCanvas.style.display = 'none'
        document.body.appendChild(hydraCanvas)
        this._hydraCanvas = hydraCanvas

        try {
            this.hydra = new Hydra({
                canvas: hydraCanvas,
                autoLoop: true,
                detectAudio: false,
                makeGlobal: false,
                numSources: 4,
                numOutputs: 4,
            })
        } catch (err) {
            console.error('HydraEngine: init failed', err)
            this.onError?.(err)
            hydraCanvas.remove()
            this._hydraCanvas = null
            return false
        }

        this.enabled = true
        return true
    }

    _initPassthrough() {
        const gl = this._gl
        if (!gl) return

        const vert = gl.createShader(gl.VERTEX_SHADER)
        gl.shaderSource(vert, PASSTHROUGH_VERT)
        gl.compileShader(vert)

        const frag = gl.createShader(gl.FRAGMENT_SHADER)
        gl.shaderSource(frag, PASSTHROUGH_FRAG)
        gl.compileShader(frag)

        this._passthroughProg = gl.createProgram()
        gl.attachShader(this._passthroughProg, vert)
        gl.attachShader(this._passthroughProg, frag)
        gl.linkProgram(this._passthroughProg)

        gl.deleteShader(vert)
        gl.deleteShader(frag)

        this._vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo)
        gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW)
    }

    evaluateCode(code, extraContext = {}) {
        if (!this.hydra || !this.enabled) return
        this.currentCode = code
        try {
            const synth = this.hydra.synth
            synth.hush()

            const contextKeys = []
            const contextVals = []
            for (const k of Object.keys(synth)) {
                contextKeys.push(k)
                contextVals.push(synth[k])
            }

            extraContext = { ...this._audioData, ...extraContext }
            const paramsDecl = Object.keys(extraContext).length
                ? 'var params = ' + JSON.stringify(extraContext) + ';\n'
                : ''

            const fn = new Function(...contextKeys, paramsDecl + code)
            fn(...contextVals)
        } catch (err) {
            console.error('Hydra eval error:', err)
            this.onError?.(err)
        }
    }

    renderToMain() {
        if (!this.enabled || !this._hydraCanvas || !this._gl || !this._passthroughProg) return

        const gl = this._gl
        const w = this._canvas.width
        const h = this._canvas.height
        if (w === 0 || h === 0) return

        gl.useProgram(this._passthroughProg)
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo)

        if (this._posLoc === undefined) {
            this._posLoc = gl.getAttribLocation(this._passthroughProg, 'a_position')
            this._texLoc = gl.getUniformLocation(this._passthroughProg, 'u_tex')
        }
        gl.enableVertexAttribArray(this._posLoc)
        gl.vertexAttribPointer(this._posLoc, 2, gl.FLOAT, false, 0, 0)

        let tex = this._hydraTexture
        if (!tex) {
            tex = gl.createTexture()
            this._hydraTexture = tex
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._hydraCanvas)
        } else {
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this._hydraCanvas)
        }

        gl.uniform1i(this._texLoc, 0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    getTexture() {
        return this._hydraTexture || null
    }

    getCanvas() {
        return this._hydraCanvas || null
    }

    setSize(width, height) {
        if (this._hydraCanvas) {
            this._hydraCanvas.width = width
            this._hydraCanvas.height = height
        }
        if (this.hydra) {
            try { this.hydra.setResolution(width, height) } catch (e) { console.warn("HydraEngine: setResolution error", e); }
        }
    }

    setAudioData(data) {
        this._audioData.bass = data.bass ?? 0
        this._audioData.mid = data.mid ?? 0
        this._audioData.high = data.high ?? 0
        this._audioData.level = data.level ?? 0
    }

    setEnabled(enabled) {
        this.enabled = enabled
        if (!enabled && this.hydra) {
            try { this.hydra.synth.hush() } catch (e) { console.warn("HydraEngine: setEnabled hush error", e); }
        }
    }

    setCode(code) {
        this.currentCode = code
    }

    destroy() {
        if (this.hydra) {
            try { this.hydra.synth.hush() } catch (e) { console.warn("HydraEngine: destroy hush error", e); }
        }
        if (this._hydraCanvas && this._hydraCanvas.parentNode) {
            this._hydraCanvas.parentNode.removeChild(this._hydraCanvas)
        }
        if (this._hydraTexture && this._gl) {
            this._gl.deleteTexture(this._hydraTexture)
        }
        if (this._vbo && this._gl) {
            this._gl.deleteBuffer(this._vbo)
        }
        if (this._passthroughProg && this._gl) {
            this._gl.deleteProgram(this._passthroughProg)
        }
        this._hydraTexture = null
        this._hydraCanvas = null
        this._vbo = null
        this._passthroughProg = null
        this._gl = null
        this._canvas = null
        this.hydra = null
        this.enabled = false
    }
}
