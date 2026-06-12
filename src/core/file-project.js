import { BANK_COUNT, DRUM_TRACK_COUNT, DRUM_STEP_COUNT, NOTE_STEP_COUNT, PRESET_COUNT, SEQUENCER_MODES } from "./pattern-store.js";
import { normalizeState, saveState as persistState } from "./state.js";
import { STORAGE_KEY } from "./constants.js";
import { isNoteName } from "./utils.js";
import { saveMidiConfig } from "./midi-ui.js";

let _els = {}
let _state = null
let _sequencer = null
let _shaderEditor = null
let _shaderEngine = null
let _clearHeldNotes = null
let _flashFileMenuLabel = null
let _setEngineState = null

export function initFileProject(deps) {
    _els = deps.els
    _state = deps.state
    _sequencer = deps.sequencer
    _shaderEditor = deps.shaderEditor
    _shaderEngine = deps.shaderEngine
    _clearHeldNotes = deps.clearHeldNotes
    _flashFileMenuLabel = deps.flashFileMenuLabel
    _setEngineState = deps.setEngineState
}

export function updateStateRef(ref) {
    _state = ref
}

function state() { return _state }

function validatePatternMatrixData(st) {
    const modes = ["drum", "bass", "melody", "other"];
    for (const mode of modes) {
        if (!st.memory?.[mode]) return false
        if (!Array.isArray(st.memory[mode]) || st.memory[mode].length !== BANK_COUNT) return false
        for (let bank = 0; bank < BANK_COUNT; bank++) {
            if (!Array.isArray(st.memory[mode][bank]) || st.memory[mode][bank].length !== PRESET_COUNT) return false
            for (let slot = 0; slot < PRESET_COUNT; slot++) {
                const pattern = st.memory[mode][bank][slot]
                if (mode === "drum") {
                    if (!Array.isArray(pattern) || pattern.length !== DRUM_TRACK_COUNT) return false
                    for (let track = 0; track < DRUM_TRACK_COUNT; track++) {
                        if (!Array.isArray(pattern[track]) || pattern[track].length !== DRUM_STEP_COUNT) return false
                        for (let step = 0; step < DRUM_STEP_COUNT; step++) {
                            if (typeof pattern[track][step] !== "boolean") return false
                        }
                    }
                } else {
                    if (!Array.isArray(pattern) || pattern.length !== NOTE_STEP_COUNT) return false
                    for (let step = 0; step < NOTE_STEP_COUNT; step++) {
                        const stepData = pattern[step]
                        if (typeof stepData !== "object" || stepData === null) return false
                        if (typeof stepData.active !== "boolean") return false
                        if (typeof stepData.note !== "string" || !isNoteName(stepData.note)) return false
                    }
                }
            }
        }
    }
    if (!st.presetLoopLengths) return false
    for (const mode of modes) {
        if (!Array.isArray(st.presetLoopLengths[mode]) || st.presetLoopLengths[mode].length !== BANK_COUNT) return false
        for (let bank = 0; bank < BANK_COUNT; bank++) {
            if (!Array.isArray(st.presetLoopLengths[mode][bank]) || st.presetLoopLengths[mode][bank].length !== PRESET_COUNT) return false
            for (let slot = 0; slot < PRESET_COUNT; slot++) {
                const length = st.presetLoopLengths[mode][bank][slot]
                const allowed = mode === "drum" ? [16, 32, 64] : [16, 32, 64, 128, 256]
                if (!allowed.includes(length)) return false
            }
        }
    }
    if (!st.presetTrackRates) return false
    for (const mode of modes) {
        if (!Array.isArray(st.presetTrackRates[mode]) || st.presetTrackRates[mode].length !== BANK_COUNT) return false
        for (let bank = 0; bank < BANK_COUNT; bank++) {
            if (!Array.isArray(st.presetTrackRates[mode][bank]) || st.presetTrackRates[mode][bank].length !== PRESET_COUNT) return false
            for (let slot = 0; slot < PRESET_COUNT; slot++) {
                const rate = st.presetTrackRates[mode][bank][slot]
                if (![0.5, 1, 2].includes(rate)) return false
            }
        }
    }
    if (!st.activeBanks || !st.activeSlots) return false
    for (const mode of modes) {
        const bank = st.activeBanks[mode]
        const slot = st.activeSlots[mode]
        if (typeof bank !== "number" || bank < 0 || bank >= BANK_COUNT) return false
        if (typeof slot !== "number" || slot < 0 || slot >= PRESET_COUNT) return false
    }
    return true
}

function flushSaveState() {
    if (_state.flushSaveState) _state.flushSaveState()
}

export function saveAppState(st) {
    persistState(st)
}

export function updateProjectNameUI() {
    const el = document.getElementById("project-name")
    if (!el) return
    const name = _state.projectName || "Untitled"
    el.textContent = name.length > 10 ? name.slice(0, 10) + ".." : name
    document.title = _state.projectName
        ? `${_state.projectName} - Syntetika Engine`
        : "Syntetika Engine - Offline Console"
}

export function handleFileMenuAction(action) {
    const { closeFileMenu, flashFileMenuLabel, setEngineState } = _getFileMenuDeps()
    closeFileMenu()
    if (action === "new") newProject()
    if (action === "save") {
        flushSaveState()
        flashFileMenuLabel("Saved")
        _setEngineState("Project saved")
    }
    if (action === "save-as") exportProjectFile()
    if (action === "open") _els.projectOpenInput?.click()
    if (action === "preferences") toggleMidiModal?.(true)
    if (action === "help") showFileHelp()
}

function _getFileMenuDeps() {
    return {
        closeFileMenu: () => {
            _els.fileMenu?.classList.remove("open")
            _els.fileMenu?.setAttribute("aria-hidden", "true")
            _els.fileMenuToggle?.setAttribute("aria-expanded", "false")
        },
        flashFileMenuLabel: (label) => {
            const el = _els.fileMenuToggle
            if (!el) return
            const orig = el.textContent
            el.textContent = label
            el.classList.add("flash")
            setTimeout(() => { el.textContent = orig; el.classList.remove("flash") }, 800)
        }
    }
}

function toggleMidiModal(open) {
    // handled by ui-controller
}

function showFileHelp() {
    window.alert(
        "Syntetika Engine - File Help\n\n" +
        "New: Buat project baru (reset pattern matrix ke default)\n" +
        "Save: Simpan state ke localStorage browser\n" +
        "Save As: Export project ke file .json\n" +
        "Open: Import file project .json\n" +
        "Preferences: Konfigurasi MIDI\n\n" +
        "Tips:\n" +
        "- Export otomatis menyertakan semua shader & hydra code\n" +
        "- File .json bisa dibagikan ke perangkat lain\n" +
        "- Max size: 50MB"
    )
}

function newProject() {
    const confirmed = window.confirm("Buat project baru kosong? Pattern saat ini akan diganti dengan preset kosong.")
    if (!confirmed) return
    _sequencer?.stop()
    if (_clearHeldNotes) _clearHeldNotes()
    const normalized = normalizeState(null)
    normalized.projectName = "Untitled"
    if (!validatePatternMatrixData(normalized)) {
        window.alert("Gagal membuat project kosong: default state tidak valid.")
        _setEngineState("New project failed")
        return
    }
    if (!persistProjectState(normalized)) {
        window.alert("Gagal menyimpan project kosong. Storage browser kemungkinan penuh.")
        return
    }
    _setEngineState("New project created")
    window.location.reload()
}

function persistProjectState(st) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(st))
        return true
    } catch {
        return false
    }
}

export function exportProjectFile() {
    flushSaveState()
    const st = _state
    if (!validatePatternMatrixData(st)) {
        window.alert("Project tidak bisa diexport karena data pattern belum valid. Coba Save lagi atau reload aplikasi.")
        return
    }
    const normalized = normalizeState(st)
    const shaderData = _collectShaderData()
    const project = {
        app: "Syntetika Engine",
        version: 3,
        exportedAt: new Date().toISOString(),
        projectName: normalized.projectName,
        state: normalized,
        midiConfig: null,
        shaders: shaderData
    }
    try {
        const midiConfigStr = localStorage.getItem("syntetika_midi_config")
        if (midiConfigStr) project.midiConfig = JSON.parse(midiConfigStr)
    } catch {}
    const blob = new Blob([JSON.stringify(project)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `syntetika-engine-project-${project.exportedAt.slice(0, 10)}.json`
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    const { flashFileMenuLabel } = _getFileMenuDeps()
    flashFileMenuLabel("Exported")
    _setEngineState("Project exported")
}

function _collectShaderData() {
    const shaders = _shaderEditor?.shaders
    if (!shaders || shaders.length === 0) return null
    const builtIn = new Set(["plasma", "fractal"])
    const custom = shaders.filter(s => !builtIn.has(s.id))
    if (custom.length === 0) return null
    return custom.map(s => ({ id: s.id, name: s.name, source: s.source }))
}

export function openProjectFile(file, midiConfigOut) {
    if (file.size > 50 * 1024 * 1024) {
        _setEngineState("File too large")
        window.alert("Ukuran file terlalu besar. Maksimal 50MB.")
        return
    }
    const reader = new FileReader()
    reader.addEventListener("error", () => {
        console.error("FileReader error:", reader.error)
        _setEngineState("Open failed - file read error")
        window.alert("Gagal membaca file: " + (reader.error?.message || "unknown error"))
    })
    reader.addEventListener("load", () => {
        try {
            const text = reader.result
            if (!text || typeof text !== "string" || text.trim().length === 0) {
                throw new Error("File kosong atau format tidak dikenal")
            }
            const project = JSON.parse(text)
            if (!project || typeof project !== "object" || Array.isArray(project)) {
                throw new Error("Invalid project file structure")
            }
            const nextState = project.state || project
            if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
                throw new Error("Invalid project state")
            }
            if (!nextState.memory || typeof nextState.memory !== "object") {
                throw new Error("State missing pattern matrix data")
            }
            const projectName = project?.projectName
                || file.name.replace(/\.json$/i, "").slice(0, 20)
            const normalizedState = normalizeState({ ...nextState, projectName })
            if (!validatePatternMatrixData(normalizedState)) {
                throw new Error("Invalid pattern matrix data - possible data corruption")
            }
            _importShaderData(project.shaders)
            if (_state) {
                Object.assign(_state, normalizedState)
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState))
            if (project?.midiConfig) {
                try {
                    saveMidiConfig(project.midiConfig)
                } catch {}
            }
            _setEngineState("Project opened")
            window.location.reload()
        } catch (error) {
            console.error("Error loading project:", error)
            _setEngineState("Open failed")
            window.alert(`Gagal memuat file project: ${error.message}`)
        }
    })
    reader.readAsText(file)
}

function _importShaderData(shaders) {
    if (!shaders || !Array.isArray(shaders) || shaders.length === 0) return
    if (!_shaderEditor) return
    try {
        const existing = JSON.parse(localStorage.getItem("syntetika_shaders") || "{}")
        const existingShaders = Array.isArray(existing.shaders) ? existing.shaders : []
        const existingIds = new Set(existingShaders.map(s => s.id))
        let changed = false
        for (const s of shaders) {
            if (!s.id || !s.source) continue
            if (!existingIds.has(s.id)) {
                existingShaders.push({ id: s.id, name: s.name || s.id, source: s.source })
                existingIds.add(s.id)
                changed = true
                if (_shaderEditor.shaders) {
                    _shaderEditor.shaders.push({ id: s.id, name: s.name || s.id, source: s.source })
                }
            }
        }
        if (changed) {
            localStorage.setItem("syntetika_shaders", JSON.stringify({
                shaders: existingShaders,
                activeId: existing.activeId || existingShaders[0]?.id || null
            }))
        }
    } catch (e) {
        console.warn("Failed to import shader data:", e)
    }
}
