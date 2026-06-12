import { ShaderEngine } from "./shader-engine.js"
import { ShaderEditor } from "./shader-editor.js"
import { HydraEngine } from "./hydra-engine.js"
import { MediaManager } from "./media-manager.js"

let _state = null
let _els = null
let _saveState = null
let _bindShaderControls = null

export let shaderEngine = null
export let hydraEngine = null
export let shaderEditor = null
export let mediaManager = null

export function initVisualEngine(deps) {
    _state = deps.state
    _els = deps.els
    _saveState = deps.saveState
    _bindShaderControls = deps.bindShaderControls
}

export async function initShaders() {
    const canvas = _els.canvas
    if (!canvas) return

    shaderEngine = new ShaderEngine()
    if (!shaderEngine.init(canvas)) {
        _setEngineState("WebGL not available")
        return
    }

    hydraEngine = new HydraEngine()
    hydraEngine.onError = (err) => {
        const errEl = document.getElementById("hydra-error")
        if (errEl) {
            errEl.textContent = String(err.message || err)
            errEl.hidden = false
        }
    }
    if (!hydraEngine.init(canvas, shaderEngine.gl)) {
        console.warn('HydraEngine init failed, hydra features disabled')
    }

    if (_state.canvasWidth > 0 && _state.canvasHeight > 0) {
        shaderEngine.setForcedResolution(_state.canvasWidth, _state.canvasHeight)
        hydraEngine.setSize(_state.canvasWidth, _state.canvasHeight)
    }

    shaderEngine.onFpsUpdate = (fps) => {
        if (_els.fpsCounter) _els.fpsCounter.textContent = fps + " FPS"
    }
    if (!_state.visualEnabled) shaderEngine.setEnabled(false)

    mediaManager = new MediaManager(shaderEngine)
    mediaManager.loadFromStorage()

    shaderEditor = new ShaderEditor({
        onSwitch: (id) => {
            const shader = shaderEditor.getShaderById(id)
            if (shader && shaderEngine) {
                shaderEngine.compileShader(shader.source)
            }
            _state.activeShaderId = id
            _saveState()
            if (_bindShaderControls) _bindShaderControls()
        },
        onActivate: (id) => {
            _state.visualMode = "isf"
            if (_bindShaderControls) _bindShaderControls()
            _saveState()
        },
        onShadersChange: () => {
            if (_els.shaderGalleryHost) shaderEditor.renderGallery(_els.shaderGalleryHost)
        }
    })
    await shaderEditor.init()
    if (_els.shaderGalleryHost) shaderEditor.renderGallery(_els.shaderGalleryHost)
    shaderEngine.startLoop()

    shaderEngine._renderOverride = () => {
        if (!hydraEngine || !hydraEngine.enabled) return
        if (_state.visualMode === "hydra") {
            hydraEngine.renderToMain()
        }
    }
    shaderEngine._preRender = () => {
        if (!hydraEngine || !hydraEngine.enabled) return
        if (_state.visualMode === "hybrid") {
            const tex = hydraEngine.getTexture()
            if (tex) {
                shaderEngine._customTextures['hydraOutput'] = tex
            }
        }
    }
}

function _setEngineState(msg) {
    const el = document.getElementById("engine-state")
    if (el) el.textContent = msg
}

export function setAudioData(data) {
    if (shaderEngine) shaderEngine.setAudioData(data)
    if (shaderEditor?.previewEngine) shaderEditor.previewEngine.setAudioData(data)
    if (hydraEngine?.enabled) hydraEngine.setAudioData(data)
}
