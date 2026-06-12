import { AudioEngine } from "./src/core/audio.js";
import { MidiManager } from "./src/core/midi.js";
import { MatrixControlManager } from "./src/core/matrix-control.js";
import {
    hideNotePicker as hideNotePickerUi,
    notePickerContext,
    openNotePicker,
    renderNotePicker as renderNotePickerUi
} from "./src/core/note-picker-ui.js";
import { renderScalePicker as renderScalePickerUi } from "./src/core/scale-picker-ui.js";
import {
    channelMatches,
    drumIndexFromTrack,
    loadMidiConfig,
    renderMidiUI as renderMidiPanel,
    saveMidiConfig
} from "./src/core/midi-ui.js";
import { Randomizer } from "./src/core/randomizer.js";
import { SequencerEngine } from "./src/core/sequencer.js";
import { loadState, normalizeState, saveState as persistState } from "./src/core/state.js";
import { STORAGE_KEY } from "./src/core/constants.js";
import {
    ResolumeController,
    normalizeResolumeConfig
} from "./src/core/resolume.js";
import {
    BANK_COUNT,
    BASS_SOUND_STYLES,
    DRUM_SOUND_STYLES,
    DRUM_STEP_COUNT,
    DRUM_TRACK_COUNT,
    MELODY_SOUND_STYLES,
    NOTE_STEP_COUNT,
    OTHER_SOUND_STYLES,
    PRESET_COUNT,
    SEQUENCER_MODES,
    activeBankFor as selectActiveBank,
    activePattern as selectActivePattern,
    activeSlotFor as selectActiveSlot,
    getLoopLength as selectLoopLength,
    setLoopLength as assignLoopLength,
    getTrackRate as selectTrackRate,
    setTrackRate as assignTrackRate,
    setActivePattern as assignActivePattern
} from "./src/core/pattern-store.js";
import {
    CHANNEL,
    DRUM_LANE_VOICE_OPTIONS,
    DRUM_LABELS,
    DRUM_RANDOM_GENRES,
    DRUM_VOICE_INDEX,
    DRUM_VOICE_ORDER,
    DRUM_VOICES,
    MATRIX_CHANNEL,
    MIDI_NOTE_NAMES,
    NOTE_PICKER_MAX_MIDI,
    NOTE_PICKER_MIN_MIDI,
    PITCH_GENERATOR_MODES,
    PITCH_GENERATOR_ROLES,
    PITCH_GENERATOR_STYLES,
    PITCH_GENERATOR_STYLE_LABELS,
    SCALE_DEFINITIONS,
} from "./src/core/constants.js";
import { $, $$, pulseButton as flashButton, setEngineState as setEngineStateText } from "./src/core/ui.js";
import { clamp, generateNoteNames, isNoteName, midiNoteName, noteNameToMidi } from "./src/core/utils.js";
import { AIBridge } from "./src/core/ai-bridge.js";
import { AIEngine } from "./src/core/ai-engine.js";
import { generateWelcomeMessage } from "./src/core/ai-personality.js";
import { MidiKeyboardOverlay } from "./src/core/midi-keyboard-ui.js";
import { initVisualEngine, initShaders as initVisualShaders, shaderEngine as visShaderEngine, hydraEngine as visHydraEngine, shaderEditor as visShaderEditor, mediaManager as visMediaManager, setAudioData as visSetAudioData } from "./src/core/visual-engine.js";
import { initFileProject, saveAppState, exportProjectFile as exportProjectFileModule, openProjectFile as openProjectFileModule, updateProjectNameUI as updateProjectNameUIModule } from "./src/core/file-project.js";
import { mountAIChat } from "./src/core/ai-controller.js";

(async () => {
    "use strict";

    if (!window.performance) {
        window.performance = { now: () => Date.now() };
    }

    const els = {
        body: document.body,
        app: $("#app-container"),
        leftPanelToggle: $("#left-panel-toggle"),
        rightPanelToggle: $("#right-panel-toggle"),
        fileMenuToggle: $("#file-menu-toggle"),
        fileMenu: $("#file-menu"),
        projectOpenInput: $("#project-open-input"),
        playBtn: $("#playBtn"),
        bpmVal: $("#bpmVal"),
        bpmDownBtn: $("#bpmDownBtn"),
        bpmUpBtn: $("#bpmUpBtn"),
        tapTempoBtn: $("#tapTempoBtn"),
        resyncBtn: $("#resyncBtn"),
        nudgeDownBtn: $("#nudgeDownBtn"),
        nudgeUpBtn: $("#nudgeUpBtn"),
        engineState: $("#engine-state"),
        grid: $("#grid-container"),
        canvasContainer: $("#canvas-container"),
        drumBarControls: $("#drum-bar-controls"),
        noteBarControls: $("#note-bar-controls"),
        tieToggleBtn: $("#tieToggleBtn"),
        moduleTitle: $("#module-title"),
        patternMatrixTitle: $("#pattern-matrix-title"),
        patternMatrixHost: $("#pattern-matrix-host"),
        uiModeBtns: $("#ui-mode-btns"),
        internalAudioBtns: $("#internal-audio-btns"),
        visualToggle: $("#visual-toggle"),
        fpsCounter: $("#fps-counter"),
        popupVisualBtn: $("#popup-visual-btn"),
        mediaLoadBtn: $("#media-load-btn"),
        mediaFileInput: $("#media-file-input"),
        aspectToggle: $("#aspect-toggle"),
        aspectMenu: $("#aspect-menu"),
        aspectCustomWidth: $("#aspect-custom-width"),
        aspectCustomHeight: $("#aspect-custom-height"),
        aspectCustomApply: $("#aspect-custom-apply"),
        canvasResWidth: $("#canvas-res-width"),
        canvasResHeight: $("#canvas-res-height"),
        canvasResApply: $("#canvas-res-apply"),
        audioSoundSummaryBtn: $("#audio-sound-summary-btn"),
        audioSoundDetail: $("#audio-sound-detail"),
        audioMixerSummaryBtn: $("#audio-mixer-summary-btn"),
        audioMixerDetail: $("#audio-mixer-detail"),
        mixerInputs: $$("[data-mixer]"),
        mixerValues: $$("[data-mixer-value]"),
        drumSoundBtns: $("#drum-sound-btns"),
        bassSoundBtns: $("#bass-sound-btns"),
        melodySoundBtns: $("#melody-sound-btns"),
        otherSoundBtns: $("#other-sound-btns"),
        bankBtns: $("#bank-btns"),
        presetBtns: $("#preset-btns"),
        randomBtn: $("#randomBtn"),
        scaleBtn: $("#scaleBtn"),
        scalePopup: $("#scale-popup"),
        scaleClose: $("#scale-close"),
        scaleRootBtns: $("#scale-root-btns"),
        scaleOptionList: $("#scale-option-list"),
        randomRoleBtns: $("#random-role-btns"),
        trackRateBtns: $("#track-rate-btns"),
        pitchGeneratorPanel: $("#pitch-generator-panel"),
        generatorSummaryBtn: $("#generator-summary-btn"),
        generatorDetail: $("#generator-detail"),
        generatorModeBtns: $("#generator-mode-btns"),
        generatorRoleBtns: $("#generator-role-btns"),
        generatorStyleBtns: $("#generator-style-btns"),
        pitchToolBtns: $("#pitch-tool-btns"),
        clearBtn: $("#clearBtn"),
        copyBtn: $("#copyBtn"),
        pasteBtn: $("#pasteBtn"),
        undoBtn: $("#undoBtn"),
        redoBtn: $("#redoBtn"),
        modeBtns: $$(".btn-mode"),
        midiModal: $("#midi-modal"),
        midiPanic: $("#midi-panic"),
        midiClose: $("#midi-close"),
        midiDeviceRouting: $("#midi-device-routing"),
        midiMapSummaryBtn: $("#midi-map-summary-btn"),
        midiMapDetail: $("#midi-map-detail"),
        midiRows: $("#midi-mapping-rows"),
        midiStatus: $("#midi-status"),
        resolumeSummaryBtn: $("#resolume-summary-btn"),
        resolumeDetail: $("#resolume-detail"),
        resolumeEnabled: $("#resolume-enabled"),
        resolumeHost: $("#resolume-host"),
        resolumePort: $("#resolume-port"),
        resolumeTestBtn: $("#resolume-test-btn"),
        resolumeDetectBtn: $("#resolume-detect-btn"),
        resolumeMatrixTrigger: $("#resolume-matrix-trigger"),
        resolumeDeckTrigger: $("#resolume-deck-trigger"),
        resolumeDashboardPulse: $("#resolume-dashboard-pulse"),
        resolumePulseAmount: $("#resolume-pulse-amount"),
        resolumePulseLength: $("#resolume-pulse-length"),
        resolumePulseDebounce: $("#resolume-pulse-debounce"),
        resolumeOscHost: $("#resolume-osc-host"),
        resolumeOscPort: $("#resolume-osc-port"),
        resolumeOscBridgeUrl: $("#resolume-osc-bridge-url"),
        resolumeClipTargetBtns: $$("[data-resolume-clip-target]"),
        resolumeStatus: $("#resolume-status"),
        notePicker: $("#note-picker"),
        canvas: $("#visual-canvas"),
        shaderEditorModal: $("#shader-editor-modal"),
        shaderEditorHost: $("#shader-editor-host"),
        shaderGalleryHost: $("#shader-gallery-host")
    };

    const isMonitor = new URLSearchParams(location.search).get("monitor") === "1";

    let state = loadState();
    let midiConfig = loadMidiConfig();
    let audio = null;
    let sequencer = null;
    let randomizer = null;
    let copiedPattern = null;
    let learningTrack = null;
    let leftPanelCollapsed = false;
    let rightPanelCollapsed = false;
    let audioSoundPanelOpen = false;
    let audioMixerPanelOpen = false;
    let resolumePanelOpen = false;
    let shaderEngine = null;
    let shaderEditor = null;
    let hydraEngine = null;
    let mediaManager = null;
    let aiEngine = null;
    let shaderAudioInterval = null;
    let midiMapPanelOpen = false;
    let midi = null;
    let resolume = null;
    let matrixControl = null;
    let tapTimes = [];
    let saveStateTimer = null;
    let patternEditGesture = null;
    let _heldNote = { bass: null, melody: null, other: null };
    const _stepHighlighted = new Set();
    let popupVisualWindow = null;
    let popupVisualActive = false;
    let popupVisualAliveCheck = null;
    let popupVisualReadyTimeout = null;
    let lastSequencerErrorAt = 0;
    let generatorPanelOpen = false;
    let midiKeyboard = null;
    const SAVE_STATE_DEBOUNCE_MS = 350;

    resolume = new ResolumeController(state.resolume, setResolumeStatus);


    function saveState(options = {}) {
        const {
            immediate = false
        } = options;

        if (immediate) {
            flushSaveState();
            return;
        }

        if (saveStateTimer) window.clearTimeout(saveStateTimer);
        saveStateTimer = window.setTimeout(() => {
            saveStateTimer = null;
            persistProjectState(state);
        }, SAVE_STATE_DEBOUNCE_MS);
    }

     function flushSaveState() {
         if (saveStateTimer) {
             window.clearTimeout(saveStateTimer);
             saveStateTimer = null;
         }
        persistProjectState(state);
     }

    function persistProjectState(nextState) {
        try {
            persistState(nextState);
            return true;
        } catch (error) {
            console.error("Failed to save project state:", error);
            setEngineState(error?.name === "QuotaExceededError" ? "Save failed - storage full" : "Save failed");
            return false;
        }
    }

    function syncMatrixState() {
        matrixControl?.syncState();
    }

    function activePattern(kind) {
        return selectActivePattern(state, kind);
    }

    function setActivePattern(kind, pattern) {
        assignActivePattern(state, kind, pattern);
    }

    function getLoopLength(kind) {
        return selectLoopLength(state, kind);
    }

    function selectorValue(value, max) {
        const number = Number(value);
        return Number.isFinite(number) ? clamp(Math.trunc(number), 0, max - 1) : null;
    }

    function activeBankFor(kind = state.mode) {
        return selectActiveBank(state, kind);
    }

    function activeSlotFor(kind = state.mode) {
        return selectActiveSlot(state, kind);
    }

    function saveMidi() {
        saveMidiConfig(midiConfig);
    }

    function updateShaderAudio() {
        if (!audio) return;
        const freqData = audio.getFrequencyData?.();
        if (!freqData) return;
        if (shaderEngine) shaderEngine.setAudioData(freqData);
        if (shaderEditor?.previewEngine) shaderEditor.previewEngine.setAudioData(freqData);
        if (hydraEngine?.enabled) hydraEngine.setAudioData(freqData);
        if (popupVisualActive) sendToPopupVisual({ type: 'audio', ...freqData });
    }

    async function initShaders() {
        initVisualEngine({
            state,
            els,
            saveState,
            bindShaderControls
        });
        await initVisualShaders();
        shaderEngine = visShaderEngine;
        hydraEngine = visHydraEngine;
        shaderEditor = visShaderEditor;
        mediaManager = visMediaManager;
    }

    function syncPopupState() {
        if (!popupVisualActive) return;
        const shader = shaderEditor?.getActiveShader();
        const hydraEditor = document.getElementById("hydra-code-editor");
        const hydraCode = hydraEditor?.value || "";
        const hydraParams = {};
        for (const p of [{ name: 'p1' }, { name: 'p2' }, { name: 'p3' }, { name: 'p4' }]) {
            const el = document.querySelector(`[data-hpv="${p.name}"]`);
            hydraParams[p.name] = el ? parseFloat(el.textContent) : 0.5;
        }
        sendToPopupVisual({
            type: 'init',
            shaderSource: shader?.source || null,
            params: shaderEngine ? { ...shaderEngine.params } : {},
            visualMode: state.visualMode || "isf",
            hydraCode,
            hydraParams,
        });
    }
    function sendToPopupVisual(data) {
        if (!popupVisualActive) return;
        if (!popupVisualWindow || popupVisualWindow.closed) {
            closePopupVisual();
            return;
        }
        try {
            popupVisualWindow.postMessage(data, '*');
        } catch (e) {
            console.warn("sendToPopupVisual failed", e);
            closePopupVisual();
        }
    }
    function openPopupVisual() {
        if (popupVisualActive || !shaderEngine || !shaderEditor) return;
        const popup = window.open('popup-visual.html', 'SyntetikaVisual', 'width=960,height=640');
        if (!popup) {
            setEngineState('Popup blocked');
            return;
        }
        popupVisualWindow = popup;
        popupVisualActive = true;
        if (shaderEngine) shaderEngine.setEnabled(false);
        els.body?.classList.add('popup-visual-mode');
        applyStateToUI();
        window.addEventListener('message', handlePopupVisualMessage);
        popupVisualAliveCheck = setInterval(() => {
            if (!popupVisualActive) return;
            if (!popupVisualWindow || popupVisualWindow.closed) {
                closePopupVisual();
                return;
            }
            sendToPopupVisual({ type: 'ping' });
        }, 3000);
        popupVisualReadyTimeout = setTimeout(() => {
            if (popupVisualActive) {
                setEngineState('Popup visual did not respond');
                closePopupVisual();
            }
        }, 5000);
    }
    function handlePopupVisualMessage(event) {
        if (event.source !== popupVisualWindow) return;
        const data = event.data;
        if (!data || !data.type) return;
        if (data.type === 'popup-closed') {
            closePopupVisual();
        } else if (data.type === 'popup-ready') {
            if (popupVisualReadyTimeout) {
                clearTimeout(popupVisualReadyTimeout);
                popupVisualReadyTimeout = null;
            }
            syncPopupState();
        }
    }
    function closePopupVisual() {
        if (!popupVisualActive) return;
        popupVisualActive = false;
        if (popupVisualAliveCheck) {
            clearInterval(popupVisualAliveCheck);
            popupVisualAliveCheck = null;
        }
        if (popupVisualReadyTimeout) {
            clearTimeout(popupVisualReadyTimeout);
            popupVisualReadyTimeout = null;
        }
        if (popupVisualWindow && !popupVisualWindow.closed) {
            try {
                popupVisualWindow.postMessage({ type: 'close' }, '*');
                popupVisualWindow.close();
            } catch (e) {
                console.warn("closePopupVisual: failed to close popup", e);
            }
        }
        popupVisualWindow = null;
        window.removeEventListener('message', handlePopupVisualMessage);
        els.body?.classList.remove('popup-visual-mode');
        if (shaderEngine && state.visualEnabled) {
            shaderEngine.setEnabled(true);
        }
        applyVisualMode();
        applyStateToUI();
    }

    function renderTriggerPopup(paramName, popupEl) {
        const TRIGGER_SOURCES = [
            { id: "", label: "—" },
            { id: "kick", label: "Kick" },
            { id: "snare", label: "Snare" },
            { id: "hat", label: "Hat" },
            { id: "clap", label: "Clap" },
            { id: "bass", label: "Bass" },
            { id: "melody", label: "Melody" },
            { id: "mono", label: "Mono" },
        ];
        const def = getParamDef(paramName);
        const current = midiConfig.shaderTriggers?.find((m) => m.paramName === paramName);
        popupEl.innerHTML = `
            <div class="trigger-popup-header">Trigger Source</div>
            <div class="trigger-popup-list">
                ${TRIGGER_SOURCES.map((s) => `
                    <button class="trigger-popup-item${current?.source === s.id ? " active" : ""}" data-source="${s.id}" type="button">${s.label}</button>
                `).join("")}
            </div>
            ${current?.source ? `
            <div class="trigger-popup-invert">
                <button class="trigger-popup-item invert-btn${current.reverse ? " active" : ""}" data-invert type="button">↕ Invert</button>
            </div>` : ""}
        `;
        popupEl.querySelectorAll(".trigger-popup-item").forEach((btn) => {
            btn.addEventListener("click", () => {
                const source = btn.dataset.source;
                const existing = midiConfig.shaderTriggers.find((m) => m.paramName === paramName);
                if (source) {
                    if (existing) {
                        existing.source = source;
                    } else {
                        midiConfig.shaderTriggers.push({ paramName, source, rangeStart: def.min, rangeMax: def.max, reverse: false });
                    }
                } else {
                    if (existing) {
                        midiConfig.shaderTriggers = midiConfig.shaderTriggers.filter((m) => m.paramName !== paramName);
                    }
                }
                saveMidi();
                bindShaderControls();
            });
        });
        const invBtn = popupEl.querySelector("[data-invert]");
        if (invBtn) {
            invBtn.addEventListener("click", () => {
                const mapping = midiConfig.shaderTriggers.find((m) => m.paramName === paramName);
                if (mapping) {
                    mapping.reverse = !mapping.reverse;
                    invBtn.classList.toggle("active");
                    saveMidi();
                }
            });
        }
    }

    function bindShaderControls() {
        const container = $("#shader-controls");
        if (!container) return;

        function rebuild() {
            const shader = shaderEditor?.getActiveShader();
            if (!shader) return;
            const engine = shaderEngine;
            if (!engine) return;
            const inputs = engine.getInputDefs();
            const params = engine.params;

            container.innerHTML = inputs.map((inp, i) => {
                const id = "sp-" + i;
                const val = params[inp.name] ?? inp.def;
                const trigger = midiConfig.shaderTriggers?.find((m) => m.paramName === inp.name);
                const triggerLabel = trigger ? trigger.source : "M";

                function valDisplay(v) {
                    if (inp.type === 'color') return `R:${Number(v[0]).toFixed(2)} G:${Number(v[1]).toFixed(2)} B:${Number(v[2]).toFixed(2)} A:${Number(v[3]).toFixed(2)}`;
                    if (inp.type === 'point2D') return `X:${Number(v[0]).toFixed(3)} Y:${Number(v[1]).toFixed(3)}`;
                    return Number(v).toFixed(3);
                }

                if (trigger) {
                    const rs = trigger.rangeStart ?? inp.min;
                    const rm = trigger.rangeMax ?? inp.max;
                    const rMin = inp.min, rMax = inp.max, rSpan = rMax - rMin || 1;
                    const fillL = ((Math.min(rs, rm) - rMin) / rSpan) * 100;
                    const fillR = ((rMax - Math.max(rs, rm)) / rSpan) * 100;
                    const curPct = ((val - rMin) / rSpan) * 100;
                    return `<div class="shader-control-row" style="position:relative">
                        <label>${inp.name}</label>
                        <div class="dual-range-ctrl" data-param="${inp.name}">
                            <div class="dual-range-track">
                                <div class="dual-range-fill" style="left:${fillL}%;right:${fillR}%"></div>
                                <div class="dual-range-current" data-param="${inp.name}" style="left:${curPct}%"></div>
                            </div>
                            <input type="range" class="dual-range-thumb idle-knob" data-target="rangeStart" min="${rMin}" max="${rMax}" step="${rSpan / 1000}" value="${rs}">
                            <input type="range" class="dual-range-thumb peak-knob" data-target="rangeMax" min="${rMin}" max="${rMax}" step="${rSpan / 1000}" value="${rm}">
                        </div>
                        <span class="shader-control-val" data-param="${inp.name}">${valDisplay(val)}</span>
                        <button class="mini-btn shader-trigger-btn linked" data-trigger-param="${inp.name}" type="button">${triggerLabel}</button>
                    </div>`;
                }

                if (inp.values && inp.values.length > 0) {
                    const labels = inp.labels || inp.values;
                    return `<div class="shader-control-row" style="position:relative">
                        <label for="${id}">${inp.name}</label>
                        <select id="${id}" class="shader-select">
                            ${inp.values.map((v, vi) => `
                                <option value="${v}" ${v === val ? 'selected' : ''}>${labels[vi] ?? v}</option>
                            `).join('')}
                        </select>
                        <span class="shader-control-val" id="${id}-val">${valDisplay(val)}</span>
                        <button class="mini-btn shader-trigger-btn" data-trigger-param="${inp.name}" type="button">${triggerLabel}</button>
                    </div>`;
                }

                if (inp.type === 'color') {
                    const labels = ['R','G','B','A'];
                    return `<div class="shader-control-row" style="position:relative">
                        <label>${inp.name}</label>
                        <div class="shader-vec-controls" data-param="${inp.name}" data-type="color">
                            ${labels.map((l, ci) => `
                                <div class="shader-vec-slot">
                                    <span class="vec-label">${l}</span>
                                    <input type="range" id="${id}-${ci}" min="${inp.min}" max="${inp.max}" step="0.01" value="${val[ci]}">
                                </div>
                            `).join('')}
                        </div>
                        <span class="shader-control-val" data-param="${inp.name}">${valDisplay(val)}</span>
                    </div>`;
                }

                if (inp.type === 'point2D') {
                    const labels = ['X','Y'];
                    return `<div class="shader-control-row" style="position:relative">
                        <label>${inp.name}</label>
                        <div class="shader-vec-controls" data-param="${inp.name}" data-type="point2D">
                            ${labels.map((l, ci) => `
                                <div class="shader-vec-slot">
                                    <span class="vec-label">${l}</span>
                                    <input type="range" id="${id}-${ci}" min="${inp.min}" max="${inp.max}" step="0.01" value="${val[ci]}">
                                </div>
                            `).join('')}
                        </div>
                        <span class="shader-control-val" data-param="${inp.name}">${valDisplay(val)}</span>
                    </div>`;
                }

                return `<div class="shader-control-row" style="position:relative">
                    <label for="${id}">${inp.name}</label>
                    <input type="range" id="${id}" min="${inp.min}" max="${inp.max}" step="0.01" value="${val}">
                    <span class="shader-control-val" id="${id}-val">${valDisplay(val)}</span>
                    <button class="mini-btn shader-trigger-btn" data-trigger-param="${inp.name}" type="button">${triggerLabel}</button>
                </div>`;
            }).join("");

            inputs.forEach((inp, i) => {
                const id = "sp-" + i;
                const trigger = midiConfig.shaderTriggers?.find((m) => m.paramName === inp.name);
                if (trigger) {
                    const ctrl = container.querySelector(`.dual-range-ctrl[data-param="${inp.name}"]`);
                    const valEl = container.querySelector(`.shader-control-val[data-param="${inp.name}"]`);
                    const idleKnob = ctrl?.querySelector(".idle-knob");
                    const peakKnob = ctrl?.querySelector(".peak-knob");
                    [idleKnob, peakKnob].forEach((knob) => {
                        if (!knob) return;
                        knob.addEventListener("input", () => {
                            const target = knob.dataset.target;
                            let rs = parseFloat(ctrl.querySelector(".idle-knob").value);
                            let rm = parseFloat(ctrl.querySelector(".peak-knob").value);
                            const def = getParamDef(inp.name);
                            const rMin = def.min, rMax = def.max;
                            if (rs > rm) {
                                if (target === "rangeStart") { rm = rs; ctrl.querySelector(".peak-knob").value = rm; }
                                else { rs = rm; ctrl.querySelector(".idle-knob").value = rs; }
                            }
                            trigger.rangeStart = rs;
                            trigger.rangeMax = rm;
                            const current = target === "rangeStart" ? rs : rm;
                            engine.setParam(inp.name, current);
                            if (valEl) valEl.textContent = Number(current).toFixed(3);
                            updateDualRangeFill(ctrl, rs, rm, current, rMin, rMax);
                            if (paramDecayTimers[inp.name]) {
                                clearInterval(paramDecayTimers[inp.name]);
                                delete paramDecayTimers[inp.name];
                            }
                            if (hydraEngine?.enabled && (state.visualMode === "hydra" || state.visualMode === "hybrid")) {
                                const editor = document.getElementById("hydra-code-editor");
                                if (editor && editor.value.trim()) {
                                    evaluateHydraWithParams(editor.value.trim());
                                }
                            }
                            saveMidi();
                        });
                    });
                    if (valEl) {
                        valEl.textContent = Number(params[inp.name] ?? inp.def).toFixed(3);
                    }
                } else if (inp.type === 'color' || inp.type === 'point2D') {
                    const labels = inp.type === 'color' ? ['R','G','B','A'] : ['X','Y'];
                    const n = labels.length;
                    const vecCont = container.querySelector(`.shader-vec-controls[data-param="${inp.name}"]`);
                    const valEl = container.querySelector(`.shader-control-val[data-param="${inp.name}"]`);
                    if (vecCont) {
                        for (let ci = 0; ci < n; ci++) {
                            const slider = vecCont.querySelector(`#${id}-${ci}`);
                            if (slider) {
                                slider.addEventListener("input", () => {
                                    const arr = [...(engine.params[inp.name] ?? inp.def)];
                                    arr[ci] = parseFloat(slider.value);
                                    engine.setParam(inp.name, arr);
                                    if (valEl) {
                                        const labels2 = inp.type === 'color' ? ['R','G','B','A'] : ['X','Y'];
                                        valEl.textContent = arr.map((v, k) => `${labels2[k]}:${Number(v).toFixed(2)}`).join(' ');
                                    }
                                    if (hydraEngine?.enabled && (state.visualMode === "hydra" || state.visualMode === "hybrid")) {
                                        const editor = document.getElementById("hydra-code-editor");
                                        if (editor && editor.value.trim()) {
                                            evaluateHydraWithParams(editor.value.trim());
                                        }
                                    }
                                });
                            }
                        }
                    }
                } else {
                    const slider = document.getElementById(id);
                    const valEl = document.getElementById(id + "-val");
                    if (slider) {
                        slider.addEventListener("input", () => {
                            const v = parseFloat(slider.value);
                            if (valEl) valEl.textContent = v.toFixed(3);
                            engine.setParam(inp.name, v);
                            if (paramDecayTimers[inp.name]) {
                                clearInterval(paramDecayTimers[inp.name]);
                                delete paramDecayTimers[inp.name];
                            }
                            if (hydraEngine?.enabled && (state.visualMode === "hydra" || state.visualMode === "hybrid")) {
                                const editor = document.getElementById("hydra-code-editor");
                                if (editor && editor.value.trim()) {
                                    evaluateHydraWithParams(editor.value.trim());
                                }
                            }
                        });
                    }
                }
            });

            container.querySelectorAll(".shader-trigger-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const existing = container.querySelector(".trigger-popup");
                    if (existing) existing.remove();

                    const popup = document.createElement("div");
                    popup.className = "trigger-popup";
                    btn.after(popup);
                    renderTriggerPopup(btn.dataset.triggerParam, popup);
                });
            });

            document.addEventListener("click", closeTriggerPopup, { once: true });
        }

        function updateDualRangeFill(ctrl, rs, rm, current, rMin, rMax) {
            const fill = ctrl?.querySelector(".dual-range-fill");
            const curEl = ctrl?.querySelector(".dual-range-current");
            const span = (rMax - rMin) || 1;
            const min = Math.min(rs, rm);
            const max = Math.max(rs, rm);
            if (fill) {
                fill.style.left = ((min - rMin) / span * 100) + "%";
                fill.style.right = ((rMax - max) / span * 100) + "%";
            }
            if (curEl) {
                const pct = Math.max(0, Math.min(100, ((current - rMin) / span) * 100));
                curEl.style.left = pct + "%";
            }
        }

        function closeTriggerPopup(e) {
            if (e.target.closest(".trigger-popup") || e.target.closest(".shader-trigger-btn")) return;
            const popup = container.querySelector(".trigger-popup");
            if (popup) popup.remove();
            document.removeEventListener("click", closeTriggerPopup);
        }

        rebuild();
        container._rebuildShaderControls = rebuild;
    }

    async function init() {
        matrixControl = new MatrixControlManager({
            channelName: MATRIX_CHANNEL,
            getState: publicPerformanceState,
            onCommand: handleMatrixCommand,
            isControl: false
        });
        matrixControl.start();

        if (isMonitor) {
            document.body.classList.add("monitor-mode");
            bindMonitorEvents();
            await initShaders();
            audio = new AudioEngine();
            audio.setMixerLevels(state.mixer);
            applyVisualMode();
            return;
        }

        mountWorkspaceLayout();
        await initShaders();
        audio = new AudioEngine();
        audio.setMixerLevels(state.mixer);
        randomizer = new Randomizer();
        midi = new MidiManager({
            onMessage: handleMidiMessage,
            onStateChange: handleMidiStateChange
        });
        sequencer = new SequencerEngine({
            getBpm: () => state.bpm,
            getLoopLength,
            getRate: (kind) => trackRate(kind),
            onTick: runStep,
            onError: handleSequencerError,
            audioCtx: audio?.ctx || null
        });

        const aiBridge = new AIBridge({
            state,
            randomizer,
            audio,
            sequencer,
            commit: () => {
                applyStateToUI();
                renderGrid();
                saveState();
                syncMatrixState();
            }
        });
        aiBridge.onAction((action) => {
            if (action.type === "toggle-play") togglePlay();
            if (action.type === "stop") {
                if (state.playing) togglePlay();
            }
        });
        window.__aiBridge = aiBridge;

        aiEngine = new AIEngine(aiBridge);
        window.__aiEngine = aiEngine;
        if (shaderEditor) shaderEditor.aiEngine = aiEngine;
        initFileProject({
            els,
            state,
            sequencer,
            shaderEditor,
            shaderEngine,
            clearHeldNotes,
            flashFileMenuLabel,
            setEngineState
        });
        mountAIChat(aiEngine, {
            getState: () => state,
            randomizer,
            activePattern,
            getLoopLength,
            renderGrid,
            saveState,
            currentScaleDefinition,
            welcomeMessage: generateWelcomeMessage()
        });

        const handleKbNoteOn = (midi, noteName, velocity, isRecording) => {
            const kind = state.mode;
            if (kind === "drum") return;
            const triggerFn = kind === "bass" ? triggerBass : kind === "melody" ? triggerMelody : triggerOther;
            triggerFn(noteName, velocity);
            if (isRecording && sequencer?.isRunning()) {
                const step = sequencer.currentStep(kind);
                const pattern = activePattern(kind);
                if (pattern && pattern[step] !== undefined) {
                    window.__aiBridge?.saveUndo();
                    pattern[step] = { active: true, note: noteName, tie: false };
                    const cell = document.querySelector(`.step[data-edit-kind="${kind}"][data-edit-step="${step}"]`);
                    if (cell) {
                        cell.classList.add("bass-active");
                        cell.classList.remove("tie");
                        let noteEl = cell.querySelector(".step-note");
                        if (!noteEl) {
                            noteEl = document.createElement("span");
                            noteEl.className = "step-note";
                            cell.appendChild(noteEl);
                        }
                        noteEl.textContent = noteName;
                    }
                    saveState();
                    updateUndoButtons();
                }
            }
        };
        const handleKbNoteOff = (midi, noteName) => {
            const kind = state.mode;
            if (kind === "drum") return;
            audio.releaseNote(kind);
            sendMidiNoteOff(kind, noteName);
        };

        midiKeyboard = new MidiKeyboardOverlay({
            onNoteOn: (midi, noteName, velocity) => {
                handleKbNoteOn(midi, noteName, velocity, midiKeyboard?.isRecording());
            },
            onNoteOff: (midi, noteName) => {
                handleKbNoteOff(midi, noteName);
            },
            onRecordChange: (recording) => {
                applyStateToUI();
            },
            onOpenChange: (open) => {
                applyStateToUI();
            }
        });
        const overlayEl = document.getElementById("midi-keyboard-overlay");
        if (overlayEl) midiKeyboard.mount(overlayEl);

        bindEvents();
        applyStateToUI();
        applyVisualMode();
        bindHydraParams();
        loadVisualFromPreset(activeSlotFor(state.mode));
        updateVisualPresetStatus();
        renderGrid();
        renderNotePicker();
        renderScalePicker();
        initMIDI();
        syncHydraUI();
    }

    function syncHydraUI() {
        const editor = document.getElementById("hydra-code-editor");
        if (!editor) return;
        const slot = activeSlotFor(state.mode);
        const preset = state.visualPresets[slot];
        if (preset && preset.hydraCode) {
            editor.value = preset.hydraCode;
        }
    }

    function mountWorkspaceLayout() {
        if (els.patternMatrixHost && els.patternMatrixTitle && els.presetBtns) {
            els.patternMatrixHost.append(els.patternMatrixTitle, els.presetBtns);
        }
    }

    function bindMonitorEvents() {
        document.addEventListener("keydown", handleGlobalShortcut);
        document.addEventListener("keydown", handlePatternMatrixShortcut);
        bindFileMenu();
    }

    function bindEvents() {
        els.playBtn?.addEventListener("click", togglePlay);
        els.bpmDownBtn?.addEventListener("click", () => setBpm(state.bpm - 1));
        els.bpmUpBtn?.addEventListener("click", () => setBpm(state.bpm + 1));
        els.tapTempoBtn?.addEventListener("click", tapTempo);
        els.resyncBtn?.addEventListener("click", resyncTransport);
        els.nudgeDownBtn?.addEventListener("click", () => nudgeTempo(-1));
        els.nudgeUpBtn?.addEventListener("click", () => nudgeTempo(1));
        els.leftPanelToggle?.addEventListener("click", () => toggleSidePanel("left"));
        els.rightPanelToggle?.addEventListener("click", () => toggleSidePanel("right"));
        bindFileMenu();

        els.uiModeBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-ui-mode]");
            if (button) switchUiMode(button.dataset.uiMode);
        });

        els.internalAudioBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-internal-audio]");
            if (button) toggleInternalAudio(button.dataset.internalAudio);
        });

        els.audioSoundSummaryBtn?.addEventListener("click", () => {
            audioSoundPanelOpen = !audioSoundPanelOpen;
            applyStateToUI();
        });

        els.audioMixerSummaryBtn?.addEventListener("click", () => {
            audioMixerPanelOpen = !audioMixerPanelOpen;
            applyStateToUI();
        });

        els.visualToggle?.addEventListener("click", () => {
            state.visualEnabled = !state.visualEnabled;
            if (shaderEngine) shaderEngine.setEnabled(state.visualEnabled);
            applyStateToUI();
            saveState();
        });

        els.aspectToggle?.addEventListener("click", (event) => {
            event.stopPropagation();
            if (els.aspectMenu) {
                els.aspectMenu.classList.toggle("open");
                els.aspectToggle.setAttribute("aria-expanded", els.aspectMenu.classList.contains("open") ? "true" : "false");
            }
        });

        els.popupVisualBtn?.addEventListener("click", () => {
            if (popupVisualActive) {
                closePopupVisual();
            } else {
                openPopupVisual();
            }
        });

        document.getElementById("midi-kb-toggle")?.addEventListener("click", () => {
            if (midiKeyboard?.isActive()) {
                midiKeyboard?.hide();
            } else {
                midiKeyboard?.show();
            }
        });
        els.mediaLoadBtn?.addEventListener("click", () => {
            els.mediaFileInput?.click();
        });

        els.mediaFileInput?.addEventListener("change", async () => {
            const file = els.mediaFileInput?.files?.[0];
            if (!file || !mediaManager) return;
            els.mediaLoadBtn.textContent = "...";
            try {
                const mediaId = await mediaManager.importMedia(file);
                els.mediaLoadBtn.textContent = "✓";
                setTimeout(() => { els.mediaLoadBtn.textContent = "Load Media"; }, 2000);
                const tex = await mediaManager.getTexture(mediaId);
                if (tex && shaderEngine) {
                    const imageInputs = shaderEngine.getInputDefs().filter(i => i.type === 'image');
                    if (imageInputs.length > 0) {
                        shaderEngine.setTexture(imageInputs[0].name, tex);
                    }
                }
            } catch (err) {
                console.error("Media import failed:", err);
                els.mediaLoadBtn.textContent = "✗";
                setTimeout(() => { els.mediaLoadBtn.textContent = "Load Media"; }, 2000);
            }
            els.mediaFileInput.value = "";
        });

        document.addEventListener("click", (event) => {
            const aspectBtn = event.target.closest("[data-visual-aspect]");
            if (aspectBtn) {
                const aspect = aspectBtn.dataset.visualAspect;
                state.visualAspect = aspect;
                if (aspect === "custom") {
                    const w = parseInt(els.aspectCustomWidth?.value, 10) || 1920;
                    const h = parseInt(els.aspectCustomHeight?.value, 10) || 1080;
                    state.visualAspectWidth = w;
                    state.visualAspectHeight = h;
                }
                if (els.aspectMenu) els.aspectMenu.classList.remove("open");
                applyStateToUI();
                saveState();
                return;
            }
            if (els.aspectMenu && !event.target.closest(".aspect-control")) {
                els.aspectMenu.classList.remove("open");
                if (els.aspectToggle) els.aspectToggle.setAttribute("aria-expanded", "false");
            }
        });

        els.aspectCustomApply?.addEventListener("click", () => {
            const w = parseInt(els.aspectCustomWidth?.value, 10) || 1920;
            const h = parseInt(els.aspectCustomHeight?.value, 10) || 1080;
            state.visualAspect = "custom";
            state.visualAspectWidth = w;
            state.visualAspectHeight = h;
            if (els.aspectMenu) els.aspectMenu.classList.remove("open");
            applyStateToUI();
            saveState();
        });

        els.canvasResApply?.addEventListener("click", () => {
            const w = parseInt(els.canvasResWidth?.value, 10) || 0;
            const h = parseInt(els.canvasResHeight?.value, 10) || 0;
            state.canvasWidth = Math.max(0, w);
            state.canvasHeight = Math.max(0, h);
            if (shaderEngine) shaderEngine.setForcedResolution(state.canvasWidth, state.canvasHeight);
            if (hydraEngine) hydraEngine.setSize(
                state.canvasWidth > 0 ? state.canvasWidth : (els.canvas?.clientWidth || 1920),
                state.canvasHeight > 0 ? state.canvasHeight : (els.canvas?.clientHeight || 1080)
            );
            if (els.aspectMenu) els.aspectMenu.classList.remove("open");
            applyStateToUI();
            saveState();
        });

        els.resolumeSummaryBtn?.addEventListener("click", () => {
            resolumePanelOpen = !resolumePanelOpen;
            applyStateToUI();
        });

        els.midiMapSummaryBtn?.addEventListener("click", () => {
            midiMapPanelOpen = !midiMapPanelOpen;
            applyStateToUI();
        });

        [
            els.resolumeEnabled,
            els.resolumeHost,
            els.resolumePort,
            els.resolumeMatrixTrigger,
            els.resolumeDeckTrigger,
            els.resolumeDashboardPulse,
            els.resolumePulseAmount,
            els.resolumePulseLength,
            els.resolumePulseDebounce,
            els.resolumeOscHost,
            els.resolumeOscPort,
            els.resolumeOscBridgeUrl
        ].forEach((input) => input?.addEventListener("change", updateResolumeConfigFromUI));
        els.resolumeClipTargetBtns.forEach((button) => {
            button.addEventListener("click", () => toggleResolumeClipTarget(button));
        });

        els.resolumeTestBtn?.addEventListener("click", async () => {
            updateResolumeConfigFromUI(false);
            await resolume?.test();
            applyStateToUI();
            saveState();
        });

        els.resolumeDetectBtn?.addEventListener("click", async () => {
            updateResolumeConfigFromUI(false);
            const result = await resolume?.autoDetect();
            if (result?.ok) state.resolume.host = result.host;
            applyStateToUI();
            saveState();
        });

        els.mixerInputs.forEach((input) => {
            input.addEventListener("input", () => updateMixer(input, false));
            input.addEventListener("change", () => updateMixer(input, true));
        });

        els.drumSoundBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-drum-sound]");
            if (button) switchDrumSound(button.dataset.drumSound);
        });

        els.bassSoundBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-bass-sound]");
            if (button) switchBassSound(button.dataset.bassSound);
        });

        els.melodySoundBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-melody-sound]");
            if (button) switchMelodySound(button.dataset.melodySound);
        });

        els.otherSoundBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-other-sound]");
            if (button) switchOtherSound(button.dataset.otherSound);
        });

        els.modeBtns.forEach((button) => {
            button.addEventListener("click", () => switchMode(button.dataset.mode));
        });

        els.bankBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-bank]");
            if (button) switchBank(Number(button.dataset.bank));
        });

        els.presetBtns?.addEventListener("click", (event) => {
            const globalButton = event.target.closest("[data-global-preset]");
            if (globalButton) {
                switchAllPresets(Number(globalButton.dataset.globalPreset));
                return;
            }
            const button = event.target.closest("[data-preset]");
            if (button) switchPreset(Number(button.dataset.preset), button.dataset.presetKind || state.mode);
        });

        els.randomRoleBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-random-role]");
            if (button) switchRandomRole(button.dataset.randomRole);
        });

        els.trackRateBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-track-rate]");
            if (button) switchTrackRate(Number(button.dataset.trackRate));
        });

        els.generatorSummaryBtn?.addEventListener("click", () => {
            generatorPanelOpen = !generatorPanelOpen;
            applyStateToUI();
        });

        els.generatorModeBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-generator-mode]");
            if (button) switchPitchGeneratorMode(button.dataset.generatorMode);
        });

        els.generatorRoleBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-generator-role]");
            if (button) switchPitchGeneratorRole(button.dataset.generatorRole);
        });

        els.generatorStyleBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-generator-style]");
            if (button) switchPitchGeneratorStyle(button.dataset.generatorStyle);
        });

        els.pitchToolBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-pitch-shift]");
            if (button) shiftSelectedPitch(Number(button.dataset.pitchShift));
        });

        els.drumBarControls?.addEventListener("click", (event) => {
            const followButton = event.target.closest("[data-drum-follow]");
            if (followButton) { toggleDrumFollowPage(); return; }
            const loopButton = event.target.closest("[data-drum-loop]");
            if (loopButton) { setDrumLoopLength(Number(loopButton.dataset.drumLoop)); return; }
            const pageButton = event.target.closest("[data-drum-page]");
            if (pageButton) setDrumPage(Number(pageButton.dataset.drumPage));
        });
        els.noteBarControls?.addEventListener("click", (event) => {
            const mode = state.mode;
            if (mode === "drum") return;
            const followButton = event.target.closest("[data-note-follow]");
            if (followButton) { toggleNoteFollowPage(mode); return; }
            const loopButton = event.target.closest("[data-note-loop]");
            if (loopButton) { setNoteLoopLength(mode, Number(loopButton.dataset.noteLoop)); return; }
            const pageButton = event.target.closest("[data-note-page]");
            if (pageButton) setNotePage(mode, Number(pageButton.dataset.notePage));
        });
        els.randomBtn?.addEventListener("click", randomize);
        els.scaleBtn?.addEventListener("click", toggleScalePopup);
        els.scaleClose?.addEventListener("click", hideScalePopup);
        els.scaleRootBtns?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-scale-root]");
            if (button) selectScaleRoot(button.dataset.scaleRoot);
        });
        els.scaleOptionList?.addEventListener("click", (event) => {
            const scaleButton = event.target.closest("[data-scale-id]");
            if (scaleButton) selectScale(scaleButton.dataset.scaleId);
            const genreButton = event.target.closest("[data-drum-genre]");
            if (genreButton) selectDrumGenre(genreButton.dataset.drumGenre);
        });
        els.tieToggleBtn?.addEventListener("click", toggleTieMode);
        els.clearBtn?.addEventListener("click", clearAll);
        els.copyBtn?.addEventListener("click", copyPattern);
        els.pasteBtn?.addEventListener("click", pastePattern);
        els.undoBtn?.addEventListener("click", () => performUndo());
        els.redoBtn?.addEventListener("click", () => performRedo());
        els.midiPanic?.addEventListener("click", () => panicMidi());
        els.midiClose?.addEventListener("click", () => toggleMidiModal(false));
        els.midiModal?.addEventListener("click", (event) => {
            if (event.target === els.midiModal) toggleMidiModal(false);
        });

        window.addEventListener("beforeunload", () => {
            if (shaderAudioInterval) {
                clearInterval(shaderAudioInterval);
                shaderAudioInterval = null;
            }
            midi?.stopClockStream();
            flushSaveState();
        });
        window.addEventListener("pointermove", paintPatternStepAtPointer);
        window.addEventListener("pointerup", finishPatternEditGesture);
        window.addEventListener("pointercancel", finishPatternEditGesture);
        document.addEventListener("keydown", handleGlobalShortcut);
        document.addEventListener("keydown", handlePatternMatrixShortcut);
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".file-control")) closeFileMenu();
            if (!event.target.closest("#scale-popup") && !event.target.closest("#scaleBtn")) hideScalePopup();
            if (!event.target.closest("#note-picker") && !event.target.closest(".step")) {
                hideNotePicker();
            }
        });

        document.addEventListener("shader-editor-open", (event) => {
            if (!els.shaderEditorModal || !els.shaderEditorHost) return;
            const shaderId = event.detail?.shaderId || shaderEditor?.activeId;
            if (!shaderId || !shaderEditor) return;
            shaderEditor.openEditor(shaderId, els.shaderEditorHost);
            els.shaderEditorModal.classList.add("open");
            els.shaderEditorModal.style.display = "flex";
        });

        document.addEventListener("shader-editor-close", () => {
            if (els.shaderEditorModal) {
                els.shaderEditorModal.classList.remove("open");
                els.shaderEditorModal.style.display = "none";
            }
        });

        if (els.shaderEditorModal) {
            els.shaderEditorModal.addEventListener("click", (event) => {
                if (event.target === els.shaderEditorModal) {
                    document.dispatchEvent(new CustomEvent("shader-editor-close"));
                }
            });
        }

        const hydraRunBtn = document.getElementById("hydra-run-btn");
        hydraRunBtn?.addEventListener("click", () => {
            runHydraCode();
        });

        const hydraClearBtn = document.getElementById("hydra-clear-btn");
        hydraClearBtn?.addEventListener("click", () => {
            if (hydraEngine) {
                try { hydraEngine.hydra?.synth?.hush(); } catch (e) { console.warn("Hydra: hush error", e); }
                hydraEngine.setCode('');
            }
            const editor = document.getElementById("hydra-code-editor");
            if (editor) editor.value = '';
            const errEl = document.getElementById("hydra-error");
            if (errEl) errEl.hidden = true;
        });

        const hydraRandomBtn = document.getElementById("hydra-random-btn");
        hydraRandomBtn?.addEventListener("click", () => {
            const code = generateRandomHydraCode();
            const editor = document.getElementById("hydra-code-editor");
            if (editor) editor.value = code;
            if (state.visualMode === "hydra" || state.visualMode === "hybrid") {
                evaluateHydraWithParams(code);
            }
            syncPopupState();
        });

        const hydraSaveBtn = document.getElementById("hydra-save-btn");
        hydraSaveBtn?.addEventListener("click", () => {
            saveVisualToSlot(activeSlotFor(state.mode));
            saveState();
            updateVisualPresetStatus();
            hydraSaveBtn.classList.add("flash");
            setTimeout(() => hydraSaveBtn.classList.remove("flash"), 300);
        });

        document.querySelectorAll("[data-visual-tab]").forEach((tab) => {
            tab.addEventListener("click", () => {
                document.querySelectorAll("[data-visual-tab]").forEach((t) => t.classList.remove("active"));
                tab.classList.add("active");
                const tabName = tab.dataset.visualTab;
                document.querySelectorAll("[data-visual-tab-content]").forEach((content) => {
                    content.hidden = content.dataset.visualTabContent !== tabName;
                });
                if (tabName === "hydra") {
                    state.visualMode = "hydra";
                    applyVisualMode();
                    saveState();
                } else if (tabName === "shaders") {
                    state.visualMode = "isf";
                    applyVisualMode();
                    saveState();
                }
            });
        });

        document.querySelectorAll("[data-visual-mode]").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("[data-visual-mode]").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                state.visualMode = btn.dataset.visualMode;
                applyVisualMode();
                saveState();
            });
        });

        const hydraEditor = document.getElementById("hydra-code-editor");
        hydraEditor?.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                runHydraCode();
            }
        });

    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)]
    }
    function rng(min, max, fixed = 2) {
        return Number((Math.random() * (max - min) + min).toFixed(fixed))
    }

    function generateRandomHydraCode() {
        function pRef(i, scale = 1) { return `(p${i} * ${scale})` }
        function pMix(a, b, i) { return `(${a} + p${i} * (${b} - ${a}))` }

        const sources = [
            () => `osc(${pMix(3, 50, 1)}, ${pRef(2, 0.5)}, ${pMix(0.1, 1, 3)})`,
            () => `noise(${pMix(1, 10, 1)}, ${pRef(2, 0.5)})`,
            () => `voronoi(${pMix(2, 20, 1)}, ${pRef(2, 0.5)}, ${pMix(0.3, 1, 3)})`,
            () => `shape(${pick([3, 4, 5, 6, 8, 12])}, ${pMix(0.3, 1, 2)}, ${pMix(0.01, 0.3, 4)})`,
            () => `gradient(${pMix(0.1, 2, 1)})`,
            () => `solid(${pRef(1, 1)}, ${pRef(2, 1)}, ${pRef(3, 1)}, ${pMix(0.3, 1, 4)})`,
        ]

        const transforms = [
            (src) => `${src}.rotate(${pRef(4, 6.28)}, ${pRef(2, 0.5)})`,
            (src) => `${src}.scale(${pMix(0.5, 3, 1)}, ${pMix(0.5, 3, 2)})`,
            (src) => `${src}.pixelate(${pMix(5, 50, 1)}, ${pMix(5, 50, 2)})`,
            (src) => `${src}.kaleid(${'Math.floor(' + pMix(3, 8, 4) + ')'})`,
            (src) => `${src}.repeat(${pMix(2, 6, 1)}, ${pMix(2, 6, 2)})`,
            (src) => `${src}.repeatX(${pMix(2, 8, 1)}, ${pRef(2, 0.5)})`,
            (src) => `${src}.repeatY(${pMix(2, 8, 1)}, ${pRef(2, 0.5)})`,
            (src) => `${src}.scroll(${pRef(1, 0.5)}, ${pRef(2, 0.5)})`,
            (src) => `${src}.scrollX(${pRef(1, 0.2)})`,
            (src) => `${src}.scrollY(${pRef(1, 0.2)})`,
        ]

        const colorFx = [
            (src) => `${src}.posterize(${'Math.floor(' + pMix(2, 8, 4) + ')'}, ${pRef(2, 1)})`,
            (src) => `${src}.shift(${pRef(1, 0.2)}, ${pRef(2, 0.2)}, ${pRef(3, 0.2)})`,
            (src) => `${src}.invert(${pMix(0.5, 1, 1)})`,
            (src) => `${src}.contrast(${pMix(0.5, 2, 1)})`,
            (src) => `${src}.brightness(${pMix(0.5, 2, 1)})`,
            (src) => `${src}.saturate(${pRef(1, 2)})`,
            (src) => `${src}.hue(${pRef(4, 6.28)})`,
            (src) => `${src}.colorama(${pMix(0.2, 1.5, 1)})`,
            (src) => `${src}.thresh(${pMix(0.1, 0.6, 1)}, ${pMix(0.01, 0.2, 4)})`,
        ]

        const modSources = [
            () => `osc(${pMix(3, 30, 1)}, ${pRef(2, 0.3)}, ${pMix(0.1, 0.8, 3)})`,
            () => `noise(${pMix(1, 8, 1)}, ${pRef(2, 0.3)})`,
            () => `voronoi(${pMix(3, 15, 1)}, ${pRef(2, 0.3)}, ${pMix(0.3, 0.8, 3)})`,
            () => `gradient(${pMix(0.1, 1.5, 1)})`,
            () => `shape(${pick([3, 4, 6])}, ${pMix(0.5, 1, 2)}, ${pMix(0.05, 0.2, 4)})`,
        ]

        const isMod = Math.random() < 0.45
        const isColor = Math.random() < 0.6
        const isTime = Math.random() < 0.15
        const numTransforms = Math.floor(Math.random() * 3) + 1

        let code = pick(sources)()

        if (isTime && (code.startsWith('osc(') || code.startsWith('noise('))) {
            code = code.replace(/\(([^,]+),[^)]+\)/, (_, first) => {
                const parts = code.match(/\(([^)]+)\)/)[1].split(',').map(s => s.trim())
                if (parts.length >= 1) {
                    return `(() => ${parts[0]} + Math.sin(time) * ${pMix(5, 20, 4)}), ${parts[1] || 0}`
                }
                return first
            })
            code = code.replace(/\)$/, '), () => Math.sin(time * 0.5) * 0.5 + 0.5')
        }

        const usedTransforms = new Set()
        for (let i = 0; i < numTransforms; i++) {
            let idx
            do { idx = Math.floor(Math.random() * transforms.length) } while (usedTransforms.has(idx))
            usedTransforms.add(idx)
            code = transforms[idx](code)
        }

        if (isMod) {
            const modSrc = pick(modSources)()
            const modType = pick(['modulate', 'modulateScale', 'modulatePixelate', 'modulateRotate', 'modulateKaleid'])
            if (modType === 'modulateKaleid') {
                code = `${code}.${modType}(${modSrc}, ${'Math.floor(' + pMix(3, 8, 4) + ')'})`
            } else {
                code = `${code}.${modType}(${modSrc}, ${pRef(1, 1)})`
            }
        }

        if (isColor && Math.random() < 0.7) {
            code = pick(colorFx)(code)
        }

        code = `${code}.out()`

        if (isTime && !code.includes('time')) {
            code = code.replace(/\.out\(\)$/, '.out(o0)')
            code = `speed = ${pMix(0.5, 2, 1)}\n${code}`
        }

        return code
    }

    const hydraParamDefs = [
        { name: 'p1', label: 'P1', min: 0, max: 2, step: 0.01, def: 0.5 },
        { name: 'p2', label: 'P2', min: 0, max: 2, step: 0.01, def: 0.5 },
        { name: 'p3', label: 'P3', min: 0, max: 2, step: 0.01, def: 0.5 },
        { name: 'p4', label: 'P4', min: 0, max: 2, step: 0.01, def: 0.5 },
    ]
    const hydraParamValues = {}

    function setHydraParamImmediate(paramName, value) {
        hydraParamValues[paramName] = value
        const hpEl = document.querySelector(`[data-hpv="${paramName}"]`)
        if (hpEl) hpEl.textContent = Number(value).toFixed(2)
        const slider = document.querySelector(`input[data-hp="${paramName}"]`)
        if (slider) slider.value = value
        const ctrl = document.querySelector(`.hydra-dual-ctrl[data-param="${paramName}"]`)
        const curEl = ctrl?.querySelector(".dual-range-current")
        if (curEl) {
            const def = hydraParamDefs.find((d) => d.name === paramName) || { min: 0, max: 2 }
            const pct = (value - def.min) / (def.max - def.min) * 100
            curEl.style.left = Math.max(0, Math.min(100, pct)) + "%"
        }
        if (hydraEngine?.enabled && (state.visualMode === 'hydra' || state.visualMode === 'hybrid')) {
            const editor = document.getElementById('hydra-code-editor')
            if (editor && editor.value.trim()) {
                evaluateHydraWithParams(editor.value.trim())
            }
        }
    }

    function getHydraParamDef(paramName) {
        return hydraParamDefs.find((d) => d.name === paramName) || { min: 0, max: 2 }
    }

    function bindHydraParams() {
        const container = document.getElementById("hydra-params")
        if (!container) return

        function rebuild() {
            container.innerHTML = hydraParamDefs.map((p) => {
                const val = hydraParamValues[p.name] ?? p.def
                hydraParamValues[p.name] = val
                const trigger = midiConfig.shaderTriggers?.find((m) => m.paramName === p.name)
                const triggerLabel = trigger ? trigger.source : "M"

                if (trigger) {
                    const rs = trigger.rangeStart ?? p.min
                    const rm = trigger.rangeMax ?? p.max
                    const rMin = p.min, rMax = p.max, rSpan = rMax - rMin || 1
                    const fillL = ((Math.min(rs, rm) - rMin) / rSpan) * 100
                    const fillR = ((rMax - Math.max(rs, rm)) / rSpan) * 100
                    const curPct = ((val - rMin) / rSpan) * 100
                    return `<div class="hydra-param-row" style="position:relative">
                        <label>${p.label}</label>
                        <div class="hydra-dual-ctrl dual-range-ctrl" data-param="${p.name}">
                            <div class="dual-range-track">
                                <div class="dual-range-fill" style="left:${fillL}%;right:${fillR}%"></div>
                                <div class="dual-range-current" data-param="${p.name}" style="left:${curPct}%"></div>
                            </div>
                            <input type="range" class="dual-range-thumb idle-knob" data-target="rangeStart" min="${rMin}" max="${rMax}" step="${rSpan / 1000}" value="${rs}">
                            <input type="range" class="dual-range-thumb peak-knob" data-target="rangeMax" min="${rMin}" max="${rMax}" step="${rSpan / 1000}" value="${rm}">
                        </div>
                        <span class="hp-val" data-hpv="${p.name}">${Number(val).toFixed(2)}</span>
                        <button class="mini-btn shader-trigger-btn linked" data-trigger-param="${p.name}" type="button">${triggerLabel}</button>
                    </div>`
                }

                return `<div class="hydra-param-row" style="position:relative">
                    <label>${p.label}</label>
                    <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" data-hp="${p.name}">
                    <span class="hp-val" data-hpv="${p.name}">${Number(val).toFixed(2)}</span>
                    <button class="mini-btn shader-trigger-btn" data-trigger-param="${p.name}" type="button">${triggerLabel}</button>
                </div>`
            }).join('')

            container.querySelectorAll('input[data-hp]').forEach((sl) => {
                sl.addEventListener('input', () => {
                    const name = sl.dataset.hp
                    const v = parseFloat(sl.value)
                    hydraParamValues[name] = v
                    const valEl = container.querySelector(`[data-hpv="${name}"]`)
                    if (valEl) valEl.textContent = v.toFixed(2)
                    if (hydraEngine?.enabled && (state.visualMode === 'hydra' || state.visualMode === 'hybrid')) {
                        const editor = document.getElementById('hydra-code-editor')
                        if (editor && editor.value.trim()) {
                            evaluateHydraWithParams(editor.value.trim())
                        }
                    }
                })
                sl.addEventListener('change', () => {
                    const name = sl.dataset.hp
                    const v = parseFloat(sl.value)
                    hydraParamValues[name] = v
                    if (hydraEngine?.enabled && (state.visualMode === 'hydra' || state.visualMode === 'hybrid')) {
                        const editor = document.getElementById('hydra-code-editor')
                        if (editor && editor.value.trim()) {
                            evaluateHydraWithParams(editor.value.trim())
                        }
                    }
                })
            })

            container.querySelectorAll(".shader-trigger-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation()
                    const existing = container.querySelector(".trigger-popup")
                    if (existing) existing.remove()

                    const popup = document.createElement("div")
                    popup.className = "trigger-popup"
                    btn.after(popup)
                    renderHydraTriggerPopup(btn.dataset.triggerParam, popup)
                    document.addEventListener("click", closeHydraTriggerPopup, { once: true })
                })
            })

            container.querySelectorAll(".idle-knob, .peak-knob").forEach((knob) => {
                knob.addEventListener("input", () => {
                    const ctrl = knob.closest(".hydra-dual-ctrl")
                    if (!ctrl) return
                    const paramName = ctrl.dataset.param
                    const target = knob.dataset.target
                    let rs = parseFloat(ctrl.querySelector(".idle-knob").value)
                    let rm = parseFloat(ctrl.querySelector(".peak-knob").value)
                    const def = getHydraParamDef(paramName)
                    const rMin = def.min, rMax = def.max
                    if (rs > rm) {
                        if (target === "rangeStart") { rm = rs; ctrl.querySelector(".peak-knob").value = rm }
                        else { rs = rm; ctrl.querySelector(".idle-knob").value = rs }
                    }
                    const mapping = midiConfig.shaderTriggers?.find((m) => m.paramName === paramName)
                    if (mapping) {
                        mapping.rangeStart = rs
                        mapping.rangeMax = rm
                    }
                    const current = target === "rangeStart" ? rs : rm
                    hydraParamValues[paramName] = current
                    const valEl = container.querySelector(`[data-hpv="${paramName}"]`)
                    if (valEl) valEl.textContent = Number(current).toFixed(2)
                    const fill = ctrl.querySelector(".dual-range-fill")
                    const curEl = ctrl.querySelector(".dual-range-current")
                    const span = (rMax - rMin) || 1
                    if (fill) {
                        fill.style.left = ((Math.min(rs, rm) - rMin) / span * 100) + "%"
                        fill.style.right = ((rMax - Math.max(rs, rm)) / span * 100) + "%"
                    }
                    if (curEl) {
                        const pct = Math.max(0, Math.min(100, ((current - rMin) / span) * 100))
                        curEl.style.left = pct + "%"
                    }
                    if (hydraEngine?.enabled && (state.visualMode === 'hydra' || state.visualMode === 'hybrid')) {
                        const editor = document.getElementById('hydra-code-editor')
                        if (editor && editor.value.trim()) {
                            evaluateHydraWithParams(editor.value.trim())
                        }
                    }
                    saveMidi()
                })
            })
        }

        function closeHydraTriggerPopup(e) {
            if (e.target.closest(".trigger-popup") || e.target.closest(".shader-trigger-btn")) return
            const popup = container.querySelector(".trigger-popup")
            if (popup) popup.remove()
            document.removeEventListener("click", closeHydraTriggerPopup)
        }

        rebuild()
    }

    function renderHydraTriggerPopup(paramName, popupEl) {
        const TRIGGER_SOURCES = [
            { id: "", label: "—" },
            { id: "kick", label: "Kick" },
            { id: "snare", label: "Snare" },
            { id: "hat", label: "Hat" },
            { id: "clap", label: "Clap" },
            { id: "bass", label: "Bass" },
            { id: "melody", label: "Melody" },
            { id: "mono", label: "Mono" },
        ]
        const current = midiConfig.shaderTriggers?.find((m) => m.paramName === paramName)
        popupEl.innerHTML = `
            <div class="trigger-popup-header">Trigger Source</div>
            <div class="trigger-popup-list">
                ${TRIGGER_SOURCES.map((s) => `
                    <button class="trigger-popup-item${current?.source === s.id ? " active" : ""}" data-source="${s.id}" type="button">${s.label}</button>
                `).join("")}
            </div>
            ${current?.source ? `
            <div class="trigger-popup-invert">
                <button class="trigger-popup-item invert-btn${current.reverse ? " active" : ""}" data-invert type="button">↕ Invert</button>
            </div>` : ""}
        `
        popupEl.querySelectorAll(".trigger-popup-item").forEach((btn) => {
            btn.addEventListener("click", () => {
                const source = btn.dataset.source
                const def = getHydraParamDef(paramName)
                if (!midiConfig.shaderTriggers) midiConfig.shaderTriggers = []
                const existing = midiConfig.shaderTriggers.find((m) => m.paramName === paramName)
                if (source) {
                    if (existing) {
                        existing.source = source
                    } else {
                        midiConfig.shaderTriggers.push({ paramName, source, rangeStart: def.min, rangeMax: def.max, reverse: false })
                    }
                } else {
                    if (existing) {
                        midiConfig.shaderTriggers = midiConfig.shaderTriggers.filter((m) => m.paramName !== paramName)
                    }
                }
                saveMidi()
                bindHydraParams()
            })
        })
        const invBtn = popupEl.querySelector("[data-invert]")
        if (invBtn) {
            invBtn.addEventListener("click", () => {
                const mapping = midiConfig.shaderTriggers.find((m) => m.paramName === paramName)
                if (mapping) {
                    mapping.reverse = !mapping.reverse
                    invBtn.classList.toggle("active")
                    saveMidi()
                }
            })
        }
    }

    function evaluateHydraWithParams(code) {
        if (!hydraEngine) return;
        const shaderParams = shaderEngine?.params || {}
        let fullCode = code
        for (const [k, v] of Object.entries(hydraParamValues)) {
            const re = new RegExp('\\b' + k + '\\b', 'g')
            fullCode = fullCode.replace(re, v)
        }
        hydraEngine.evaluateCode(fullCode, shaderParams)
    }

    function runHydraCode() {
        const editor = document.getElementById("hydra-code-editor");
        if (!editor || !hydraEngine) return;
        const code = editor.value.trim();
        if (!code) return;
        const errEl = document.getElementById("hydra-error");
        if (errEl) errEl.hidden = true;
        evaluateHydraWithParams(code);
        syncPopupState();
    }

    function applyVisualMode() {
        if (!shaderEngine || !hydraEngine) return;
        const mode = state.visualMode || "isf";
        if (mode === "hydra") {
            shaderEngine.setEnabled(true);
            hydraEngine.setEnabled(true);
            shaderEngine._renderOverride = () => {
                if (hydraEngine && hydraEngine.enabled) {
                    hydraEngine.renderToMain();
                }
            };
            shaderEngine._preRender = null;
            bindShaderControls();
            bindHydraParams();
            const code = document.getElementById("hydra-code-editor");
            if (code && code.value.trim()) {
                evaluateHydraWithParams(code.value);
            }
        } else if (mode === "hybrid") {
            shaderEngine.setEnabled(true);
            hydraEngine.setEnabled(true);
            shaderEngine._renderOverride = null;
            shaderEngine._preRender = () => {
                if (hydraEngine && hydraEngine.enabled) {
                    const tex = hydraEngine.getTexture();
                    if (tex) {
                        shaderEngine._customTextures['hydraOutput'] = tex;
                    }
                }
            };
            bindShaderControls();
            bindHydraParams();
        } else {
            shaderEngine.setEnabled(state.visualEnabled !== false);
            hydraEngine.setEnabled(false);
            shaderEngine._renderOverride = null;
            shaderEngine._preRender = null;
        }
        syncPopupState();
    }

    function bindFileMenu() {
        els.fileMenuToggle?.addEventListener("click", toggleFileMenu);
        els.fileMenu?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-file-action]");
            if (button) handleFileMenuAction(button.dataset.fileAction);
        });
        els.projectOpenInput?.addEventListener("change", openProjectFile);
        document.addEventListener("click", (event) => {
            if (!event.target.closest(".file-control")) closeFileMenu();
        });
    }

    function handleGlobalShortcut(event) {
        if (shouldIgnoreGlobalShortcut(event)) return;

        const digitSlot = digitSlotFromEvent(event);
        if (event.key === "Escape") {
            closeFileMenu();
        }
        if (event.shiftKey && digitSlot !== null) {
            event.preventDefault();
            runShortcutCommand("switch-all-presets", { slot: digitSlot });
            return;
        }

        if (event.code === "Space") {
            event.preventDefault();
            if (event.shiftKey) {
                runShortcutCommand("toggle-play");
                return;
            }
            if (event.ctrlKey) {
                runShortcutCommand("tap-tempo");
                return;
            }
            runShortcutCommand("resync");
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            runShortcutCommand("nudge", { value: -1 });
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            runShortcutCommand("nudge", { value: 1 });
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            runShortcutCommand("bpm-delta", { value: 1 });
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            runShortcutCommand("bpm-delta", { value: -1 });
        }

        if ((event.ctrlKey || event.metaKey) && event.key === "z") {
            event.preventDefault();
            if (event.shiftKey) { performRedo(); return; }
            performUndo();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && (event.key === "y")) {
            event.preventDefault();
            performRedo();
            return;
        }
    }

    function shouldIgnoreGlobalShortcut(event) {
        if (event.repeat) return true;
        const target = event.target;
        const tag = target?.tagName?.toLowerCase();
        if (target?.isContentEditable || ["input", "select", "textarea"].includes(tag)) return true;
        if (!isMonitor && els.midiModal?.classList.contains("open")) return true;
        if (!isMonitor && els.notePicker?.classList.contains("open")) return true;
        if (!isMonitor && els.scalePopup?.classList.contains("open")) return true;
        if (!isMonitor && midiKeyboard?.isActive()) return true;
        return false;
    }

    function digitSlotFromEvent(event) {
        const match = /^Digit([1-8])$/.exec(event.code);
        if (match) return Number(match[1]) - 1;
        if (!/^[1-8]$/.test(event.key)) return null;
        return Number(event.key) - 1;
    }

    function runShortcutCommand(command, payload = {}) {
        if (isMonitor) {
            matrixControl?.sendCommand(command, payload);
            return;
        }
        handleMatrixCommand(command, payload);
    }

    function handlePatternMatrixShortcut(event) {
        if (shouldIgnorePatternShortcut(event)) return;

        const presetShortcut = presetShortcutForEvent(event);
        if (!presetShortcut) return;
        event.preventDefault();
        runShortcutCommand("switch-preset", presetShortcut);
    }

    function shouldIgnorePatternShortcut(event) {
        if (event.defaultPrevented) return true;
        if (event.repeat) return true;
        const target = event.target;
        const tag = target?.tagName?.toLowerCase();
        if (target?.isContentEditable || ["input", "select", "textarea"].includes(tag)) return true;
        if (els.midiModal?.classList.contains("open")) return true;
        if (els.notePicker?.classList.contains("open")) return true;
        if (els.scalePopup?.classList.contains("open")) return true;
        if (midiKeyboard?.isActive()) return true;
        return false;
    }

    function presetShortcutForEvent(event) {
        if (event.ctrlKey || event.altKey || event.metaKey) return null;
        const key = event.key.toLowerCase();
        const maps = {
            drum: "zxcvbnm,",
            bass: "asdfghjk",
            melody: "qwertyui",
            other: "12345678"
        };
        for (const [kind, keys] of Object.entries(maps)) {
            const slot = keys.indexOf(key);
            if (slot !== -1) return { kind, slot };
        }
        return null;
    }

    async function togglePlay() {
        if (!audio?.ctx) {
            setEngineState("Audio unavailable");
            return;
        }

        try {
            await audio.resume();
        } catch (error) {
            handleSequencerError(error, { source: "audio-resume" });
            setEngineState("Audio blocked");
            return;
        }
        if (!sequencer?.isRunning()) {
            sequencer?.start();
            if (els.playBtn) els.playBtn.textContent = "Stop";
            if (els.playBtn) els.playBtn.classList.add("playing");
            setEngineState("Playing");
            if (midiConfig.clockOutput && midiConfig.outputID) {
                midi?.sendMidiStart(midiConfig.outputID);
                midi?.startClockStream(midiConfig.outputID, state.bpm);
            }
        } else {
            sequencer?.stop();
            if (midiConfig.clockOutput && midiConfig.outputID) {
                midi?.sendMidiStop(midiConfig.outputID);
            }
            midi?.stopClockStream();
            els.playBtn.textContent = "Play";
            els.playBtn.classList.remove("playing");
            setEngineState("Ready");
            clearCurrentSteps();
            clearHeldNotes();
        }
        syncMatrixState();
    }

    function setBpm(value) {
        state.bpm = clamp(Math.round(Number(value) || state.bpm), 60, 220);
        if (sequencer?.isRunning() && midiConfig.clockOutput && midiConfig.outputID) {
            midi?.startClockStream(midiConfig.outputID, state.bpm);
        }
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function tapTempo() {
        const now = performance.now();
        tapTimes = tapTimes.filter((time) => now - time < 2200);
        tapTimes.push(now);
        if (tapTimes.length < 2) return;

        const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
        const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
        setBpm(60000 / average);
    }

    function nudgeTempo(direction) {
        if (!sequencer?.isRunning()) return;
        sequencer.nudge(direction > 0 ? -18 : 18);
        syncMatrixState();
    }

    function resyncTransport() {
        if (!sequencer) return;
        sequencer.resync();
        clearCurrentSteps();
        syncMatrixState();
    }

    function runStep(steps) {
        clearCurrentSteps();
        const drumPattern = activePattern("drum");
        const bassPattern = activePattern("bass");
        const melodyPattern = activePattern("melody");
        const otherPattern = activePattern("other");

        tickEventsFor(steps, "drum").forEach(({ step, time }) => {
            for (let track = 0; track < DRUM_VOICE_ORDER.length; track += 1) {
                const voice = drumVoiceFromTrack(track);
                const lane = drumLaneForVoice(voice);
                const active = drumPattern[track]?.[step];
                const drumPage = Math.floor(step / 16);
                if (state.mode === "drum" && state.drumFollowPage && drumPage !== state.drumPage) {
                    state.drumPage = drumPage;
                    renderGrid();
                }
                if (drumPage === state.drumPage && drumVoice(lane) === voice) {
                    const el = $(`#d-s-${lane}-${step % 16}`);
                    if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
                }
                if (active) {
                    if (internalAudioEnabled("drum")) triggerAudioSafely("drum", () => audio.playDrum(voice, state.drumSound, time));
                    sendMidiOut(track, time);
                    pulseResolume(voice);
                    if (shaderEngine) shaderEngine.triggerDrumVoice(voice);
                    applyParamTriggers(voice);
                    pulseLogo("drum", voice);
                }
            }
        });

        tickEventsFor(steps, "bass").forEach(({ step, time }) => {
            const bassCell = bassPattern[step];
            const bassPage = Math.floor(step / 64);
            if (state.mode === "bass" && state.bassFollowPage && bassPage !== state.bassPage) {
                state.bassPage = bassPage;
                renderGrid();
            }
            if (bassPage === state.bassPage) {
                const el = $(`#b-s-${step}`);
                if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
            }
            if (bassCell?.active) {
                const velocity = 0x50 + (step % 16 === 0 ? 0x30 : step % 8 === 0 ? 0x20 : step % 4 === 0 ? 0x10 : 0);
                const prevHeld = _heldNote.bass;
                const isTied = state.tieMode.bass && bassCell.tie;
                if (isTied && prevHeld && prevHeld.note === bassCell.note) {
                    // Tie continuation
                } else {
                    if (prevHeld) {
                        audio.releaseNote("bass", time);
                        sendMidiNoteOff("bass", prevHeld.note, time);
                        _heldNote.bass = null;
                    }
                    if (isTied) {
                        audio.noteOn("bass", bassCell.note, time);
                        sendMidiNoteOn("bass", bassCell.note, velocity, time);
                        _heldNote.bass = { note: bassCell.note, step };
                    } else {
                        triggerBass(bassCell.note, velocity, time);
                    }
                    if (shaderEngine) shaderEngine.trigger("bass", noteNameToMidi(bassCell.note) / 127);
                }
            } else if (_heldNote.bass) {
                audio.releaseNote("bass", time);
                sendMidiNoteOff("bass", _heldNote.bass.note, time);
                _heldNote.bass = null;
            }
        });

        tickEventsFor(steps, "melody").forEach(({ step, time }) => {
            const melodyCell = melodyPattern[step];
            const melodyPage = Math.floor(step / 64);
            if (state.mode === "melody" && state.melodyFollowPage && melodyPage !== state.melodyPage) {
                state.melodyPage = melodyPage;
                renderGrid();
            }
            if (melodyPage === state.melodyPage) {
                const el = $(`#m-s-${step}`);
                if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
            }
            if (melodyCell?.active) {
                const velocity = 0x50 + (step % 16 === 0 ? 0x30 : step % 8 === 0 ? 0x20 : step % 4 === 0 ? 0x10 : 0);
                const prevHeld = _heldNote.melody;
                const isTied = state.tieMode.melody && melodyCell.tie;
                if (isTied && prevHeld && prevHeld.note === melodyCell.note) {
                    // Tie continuation
                } else {
                    if (prevHeld) {
                        audio.releaseNote("melody", time);
                        sendMidiNoteOff("melody", prevHeld.note, time);
                        _heldNote.melody = null;
                    }
                    if (isTied) {
                        audio.noteOn("melody", melodyCell.note, time);
                        sendMidiNoteOn("melody", melodyCell.note, velocity, time);
                        _heldNote.melody = { note: melodyCell.note, step };
                    } else {
                        triggerMelody(melodyCell.note, velocity, time);
                    }
                    if (shaderEngine) shaderEngine.trigger("melody", noteNameToMidi(melodyCell.note) / 127);
                }
            } else if (_heldNote.melody) {
                audio.releaseNote("melody", time);
                sendMidiNoteOff("melody", _heldNote.melody.note, time);
                _heldNote.melody = null;
            }
        });

        tickEventsFor(steps, "other").forEach(({ step, time }) => {
            const otherCell = otherPattern[step];
            const otherPage = Math.floor(step / 64);
            if (state.mode === "other" && state.otherFollowPage && otherPage !== state.otherPage) {
                state.otherPage = otherPage;
                renderGrid();
            }
            if (otherPage === state.otherPage) {
                const el = $(`#o-s-${step}`);
                if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
            }
            if (otherCell?.active) {
                const velocity = 0x50 + (step % 16 === 0 ? 0x30 : step % 8 === 0 ? 0x20 : step % 4 === 0 ? 0x10 : 0);
                const prevHeld = _heldNote.other;
                const isTied = state.tieMode.other && otherCell.tie;
                if (isTied && prevHeld && prevHeld.note === otherCell.note) {
                    // Tie continuation
                } else {
                    if (prevHeld) {
                        audio.releaseNote("other", time);
                        sendMidiNoteOff("other", prevHeld.note, time);
                        _heldNote.other = null;
                    }
                    if (isTied) {
                        audio.noteOn("other", otherCell.note, time);
                        sendMidiNoteOn("other", otherCell.note, velocity, time);
                        _heldNote.other = { note: otherCell.note, step };
                    } else {
                        triggerOther(otherCell.note, velocity, time);
                    }
                    if (shaderEngine) shaderEngine.trigger("other", noteNameToMidi(otherCell.note) / 127);
                }
            } else if (_heldNote.other) {
                audio.releaseNote("other", time);
                sendMidiNoteOff("other", _heldNote.other.note, time);
                _heldNote.other = null;
            }
        });
    }

    function tickEventsFor(steps, kind) {
        const value = steps?.[kind];
        if (Array.isArray(value)) return value;
        if (Number.isInteger(value)) return [{ kind, step: value, delayMs: 0 }];
        return [];
    }

    function pulseLogo(kind, voice) {
        const logoEl = document.getElementById("syntetika-logo");
        if (!logoEl || !logoEl.classList.contains("visible")) return;
        const isHat = voice === "hat-close" || voice === "hat-open";
        const isDrum = kind === "drum" && !isHat;
        logoEl.classList.remove("pulse", "pulse-drum", "pulse-hat");
        requestAnimationFrame(() => {
            if (isHat) {
                logoEl.classList.add("pulse-hat");
            } else if (isDrum) {
                logoEl.classList.add("pulse-drum");
            } else {
                logoEl.classList.add("pulse");
            }
        });
    }

    function triggerDrum(track, velocity, time) {
        const voice = drumVoiceFromTrack(track);
        const lane = drumLaneForVoice(voice);
        if (internalAudioEnabled("drum")) triggerAudioSafely("drum", () => audio.playDrum(voice, state.drumSound, time));
        sendMidiOut(track, time);
        pulseResolume(voice);
        if (shaderEngine) shaderEngine.triggerDrumVoice(voice);
        applyParamTriggers(voice);
        if (popupVisualActive) sendToPopupVisual({ type: 'trigger-voice', voice });
        pulseLogo("drum");
    }

    function triggerBass(note, velocity, time) {
        if (internalAudioEnabled("bass")) triggerAudioSafely("bass", () => audio.playBass(note, state.bassSound, time));
        sendBassMidi(note, velocity, time);
        pulseResolume("bass");
        if (shaderEngine) shaderEngine.trigger("bass", noteNameToMidi(note) / 127);
        applyParamTriggers("bass");
        if (popupVisualActive) sendToPopupVisual({ type: 'trigger-kind', kind: 'bass', notePitch: noteNameToMidi(note) / 127 });
        pulseLogo("bass");
    }

    function triggerMelody(note, velocity, time) {
        if (internalAudioEnabled("melody")) triggerAudioSafely("melody", () => audio.playMelody(note, state.melodySound, time));
        sendMelodyMidi(note, velocity, time);
        pulseResolume("melody");
        if (shaderEngine) shaderEngine.trigger("melody", noteNameToMidi(note) / 127);
        applyParamTriggers("melody");
        if (popupVisualActive) sendToPopupVisual({ type: 'trigger-kind', kind: 'melody', notePitch: noteNameToMidi(note) / 127 });
        pulseLogo("melody");
    }

    function triggerOther(note, velocity, time) {
        if (internalAudioEnabled("other")) triggerAudioSafely("other", () => audio.playOther(note, state.otherSound, time));
        sendOtherMidi(note, velocity, time);
        pulseResolume("other");
        if (shaderEngine) shaderEngine.trigger("other", noteNameToMidi(note) / 127);
        applyParamTriggers("other");
        if (popupVisualActive) sendToPopupVisual({ type: 'trigger-kind', kind: 'other', notePitch: noteNameToMidi(note) / 127 });
        pulseLogo("other");
    }

    function triggerAudioSafely(label, callback) {
        try {
            callback?.();
        } catch (error) {
            handleSequencerError(error, { source: `${label}-audio` });
        }
    }

    function handleSequencerError(error, context = {}) {
        const now = performance.now();
        if (now - lastSequencerErrorAt < 1200) return;
        lastSequencerErrorAt = now;
        console.error("Syntetika Engine sequencer error", context, error);
        setEngineState("Sequencer recovered");
    }

    function internalAudioEnabled(kind) {
        return state.internalAudio?.[kind] !== false;
    }

    function stepDurationMs() {
        return sequencer?.stepDurationMs() ?? (60000 / state.bpm) / 4;
    }

    function renderGrid() {
        if (!els.grid) return;
        els.grid.innerHTML = "";
        els.moduleTitle.textContent = state.mode === "drum" ? "DrumBrute Impact" : state.mode === "bass" ? "Model D" : state.mode === "melody" ? "Kobol Expander" : "Monostation";

        if (state.mode === "drum") {
            const drumPattern = activePattern("drum");
            const pageOffset = state.drumPage * 16;
            DRUM_LABELS.forEach((_, track) => {
                const row = createRow(drumVoiceLabel(track), track > 0);
                const labelEl = row.querySelector(".label");
                labelEl.title = track > 0 ? `Switch to ${nextDrumVoiceLabel(track)}` : "Kick";
                if (track > 0) {
                    labelEl.addEventListener("click", () => toggleDrumVoice(track));
                    labelEl.addEventListener("keydown", (event) => {
                        if (!isStepKeyboardToggle(event)) return;
                        event.preventDefault();
                        toggleDrumVoice(track);
                    });
                }
                const voiceTrack = drumTrackForLane(track);
                for (let step = 0; step < 16; step += 1) {
                    const patternStep = pageOffset + step;
                    const cell = createStep(`d-s-${track}-${step}`);
                    cell.classList.toggle("active", drumPattern[voiceTrack]?.[patternStep]);
                    bindDrumStepEditor(cell, drumPattern, voiceTrack, patternStep);
                    row.appendChild(cell);
                }
                els.grid.appendChild(row);
            });
        } else {
            renderNoteSequencer(state.mode);
        }

        applyStateToUI();
        markCurrentSteps();
    }

    function renderNoteSequencer(kind) {
        const isMelody = kind === "melody";
        const isOther = kind === "other";
        const editKey = isMelody ? "melodyEditMode" : isOther ? "otherEditMode" : "editMode";
        const idPrefix = isMelody ? "m" : isOther ? "o" : "b";
        const labels = ["16 Step", "32 Step", "64 Step", state[editKey] ? "Edit On" : "Edit Off"];
        const notePattern = activePattern(kind);
        const pageOff = notePageOffset(kind);
        const curLoopLen = getLoopLength(kind);

        labels.forEach((label, rowIndex) => {
            const row = createRow(label, true);
            const labelEl = row.querySelector(".label");
            const lens = [16, 32, 64];
            if (rowIndex < 3 && curLoopLen === lens[rowIndex]) labelEl.classList.add("active-mode");
            if (rowIndex === 3 && state[editKey]) labelEl.classList.add("active-mode");
            labelEl.addEventListener("click", () => {
                if (rowIndex < 3) {
                    setNoteLoopLength(kind, lens[rowIndex]);
                    return;
                }
                state[editKey] = !state[editKey];
                renderGrid();
                saveState();
            });

            for (let step = 0; step < 16; step += 1) {
                const index = pageOff + rowIndex * 16 + step;
                const data = notePattern[index] || { active: false, note: "C1" };
                const cell = createStep(`${idPrefix}-s-${index}`);
                cell.classList.toggle("bass-active", data.active);
                cell.classList.toggle("tie", data.tie);
                if (data.active) {
                    const note = document.createElement("span");
                    note.className = "step-note";
                    note.textContent = data.note;
                    cell.appendChild(note);
                }
                bindNoteStepEditor(cell, kind, data, index, editKey);
                row.appendChild(cell);
            }
            els.grid.appendChild(row);
        });
    }

    function bindDrumStepEditor(cell, drumPattern, track, step) {
        cell.dataset.editKind = "drum";
        cell.dataset.editTrack = String(track);
        cell.dataset.editStep = String(step);
        cell.addEventListener("pointerdown", (event) => {
            if (!isPrimaryPointer(event)) return;
            event.preventDefault();
            hideNotePicker();
            if (!patternEditGesture) window.__aiBridge?.saveUndo();
            const value = !drumPattern[track][step];
            patternEditGesture = { kind: "drum", value, lastTrack: track, lastStep: step };
            updateDrumStepCell(cell, drumPattern, track, step, value, true);
        });
        cell.addEventListener("pointerenter", (event) => {
            if (!isPaintGesture(event, "drum")) return;
            updateDrumStepCell(cell, drumPattern, track, step, patternEditGesture.value, patternEditGesture.value);
        });
        cell.addEventListener("keydown", (event) => {
            if (!isStepKeyboardToggle(event)) return;
            event.preventDefault();
            if (!patternEditGesture) window.__aiBridge?.saveUndo();
            updateDrumStepCell(cell, drumPattern, track, step, !drumPattern[track][step], true);
            saveState();
            updateUndoButtons();
        });
    }

    function bindNoteStepEditor(cell, kind, data, index, editKey) {
        cell.dataset.editKind = kind;
        cell.dataset.editStep = String(index);
        cell.addEventListener("pointerdown", (event) => {
            if (!isPrimaryPointer(event)) return;
            event.preventDefault();
            if (state.tieMode[kind] && data.active && (event.shiftKey || event.ctrlKey)) {
                finishPatternEditGesture();
                data.tie = !data.tie;
                cell.classList.toggle("tie", data.tie);
                saveState();
                updateUndoButtons();
                return;
            }
             if (state[editKey] && data.active) {
                 finishPatternEditGesture();
                 showNotePicker(kind, index, event.currentTarget);
                 return;
             }
             if (!patternEditGesture) window.__aiBridge?.saveUndo();
             hideNotePicker();
             if (state.tieMode[kind] && data.active) {
                 const newTie = !data.tie;
                 data.tie = newTie;
                 cell.classList.toggle("tie", newTie);
                 patternEditGesture = { kind, subKind: "tie", value: newTie, lastStep: index };
             } else {
                 const value = !data.active;
                 patternEditGesture = { kind, subKind: "active", value, lastStep: index };
                 updateNoteStepCell(cell, kind, data, value, true);
             }

        });

        cell.addEventListener("pointerenter", (event) => {
            if (!isPaintGesture(event, kind)) return;
            if (patternEditGesture.subKind === "tie") {
                if (data.active) {
                    data.tie = patternEditGesture.value;
                    cell.classList.toggle("tie", data.tie);
                }
            } else {
                updateNoteStepCell(cell, kind, data, patternEditGesture.value, patternEditGesture.value);
            }
        });
        cell.addEventListener("keydown", (event) => {
            if (!isStepKeyboardToggle(event)) return;
            event.preventDefault();
            if (state.tieMode[kind] && data.active && event.shiftKey) {
                data.tie = !data.tie;
                cell.classList.toggle("tie", data.tie);
                saveState();
                updateUndoButtons();
                return;
            }
            if (state[editKey] && data.active) {
                showNotePicker(kind, index, event.currentTarget);
                return;
            }
            if (!patternEditGesture) window.__aiBridge?.saveUndo();
            updateNoteStepCell(cell, kind, data, !data.active, true);
            saveState();
            updateUndoButtons();
        });
    }

    function paintPatternStepAtPointer(event) {
        if (!patternEditGesture || (event.buttons & 1) !== 1) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".step[data-edit-kind]");
        if (!target || target.dataset.editKind !== patternEditGesture.kind) return;
        applyPatternGestureToCell(target, patternEditGesture.value);
    }

    function applyPatternGestureToCell(cell, value) {
        const kind = cell.dataset.editKind;
        const step = Number(cell.dataset.editStep);
        if (!Number.isInteger(step)) return;
        if (kind === "drum") {
            const track = Number(cell.dataset.editTrack);
            if (!Number.isInteger(track)) return;
            paintDrumStepRange(track, step, value);
            patternEditGesture.lastTrack = track;
            patternEditGesture.lastStep = step;
            return;
        }
        if (!SEQUENCER_MODES.includes(kind) || kind === "drum") return;
        if (patternEditGesture.subKind === "tie") {
            paintTieStepRange(kind, step, value);
        } else {
            paintNoteStepRange(kind, step, value);
        }
        patternEditGesture.lastStep = step;
    }

    function paintDrumStepRange(track, step, value) {
        const pattern = activePattern("drum");
        const sameTrack = patternEditGesture?.lastTrack === track;
        const start = sameTrack && Number.isInteger(patternEditGesture.lastStep)
            ? Math.min(patternEditGesture.lastStep, step)
            : step;
        const end = sameTrack && Number.isInteger(patternEditGesture.lastStep)
            ? Math.max(patternEditGesture.lastStep, step)
            : step;
        for (let nextStep = start; nextStep <= end; nextStep += 1) {
            const nextCell = document.querySelector(`.step[data-edit-kind="drum"][data-edit-track="${track}"][data-edit-step="${nextStep}"]`);
            if (nextCell) updateDrumStepCell(nextCell, pattern, track, nextStep, value, value);
        }
    }

    function paintNoteStepRange(kind, step, value) {
        const pattern = activePattern(kind);
        const start = Number.isInteger(patternEditGesture?.lastStep)
            ? Math.min(patternEditGesture.lastStep, step)
            : step;
        const end = Number.isInteger(patternEditGesture?.lastStep)
            ? Math.max(patternEditGesture.lastStep, step)
            : step;
        for (let nextStep = start; nextStep <= end; nextStep += 1) {
            const data = pattern[nextStep];
            const nextCell = document.querySelector(`.step[data-edit-kind="${kind}"][data-edit-step="${nextStep}"]`);
            if (data && nextCell) updateNoteStepCell(nextCell, kind, data, value, value);
        }
    }

    function paintTieStepRange(kind, step, value) {
        const pattern = activePattern(kind);
        const start = Number.isInteger(patternEditGesture?.lastStep)
            ? Math.min(patternEditGesture.lastStep, step) : step;
        const end = Number.isInteger(patternEditGesture?.lastStep)
            ? Math.max(patternEditGesture.lastStep, step) : step;
        for (let nextStep = start; nextStep <= end; nextStep += 1) {
            const data = pattern[nextStep];
            const nextCell = document.querySelector(`.step[data-edit-kind="${kind}"][data-edit-step="${nextStep}"]`);
            if (data && nextCell && data.active) {
                data.tie = Boolean(value);
                nextCell.classList.toggle("tie", data.tie);
            }
        }
    }

    function updateDrumStepCell(cell, drumPattern, track, step, value, shouldPreview = false) {
        const nextValue = Boolean(value);
        const changed = drumPattern[track][step] !== nextValue;
        drumPattern[track][step] = nextValue;
        cell.classList.toggle("active", nextValue);
        if (nextValue && (changed || shouldPreview)) triggerPreview("drum", track);
    }

    function drumVoice(track) {
        const options = DRUM_LANE_VOICE_OPTIONS[track] || DRUM_LANE_VOICE_OPTIONS[0];
        const voice = state.drumVoices?.[track];
        return options.includes(voice) ? voice : options[0];
    }

    function drumTrackForLane(lane) {
        return DRUM_VOICE_INDEX[drumVoice(lane)] ?? 0;
    }

    function drumVoiceFromTrack(track) {
        return DRUM_VOICE_ORDER[track] || "kick";
    }

    function drumLaneForVoice(voice) {
        return DRUM_VOICES[voice]?.lane ?? 0;
    }

    function drumVoiceLabel(track) {
        return DRUM_VOICES[drumVoice(track)]?.label || DRUM_LABELS[track] || "Drum";
    }

    function nextDrumVoice(track) {
        const options = DRUM_LANE_VOICE_OPTIONS[track] || [];
        if (options.length < 2) return drumVoice(track);
        const current = drumVoice(track);
        const index = options.indexOf(current);
        return options[(index + 1) % options.length];
    }

    function nextDrumVoiceLabel(track) {
        return DRUM_VOICES[nextDrumVoice(track)]?.label || "";
    }

    function toggleDrumVoice(track) {
        const options = DRUM_LANE_VOICE_OPTIONS[track] || [];
        if (options.length < 2) return;
        const nextVoice = nextDrumVoice(track);
        state.drumVoices[track] = nextVoice;
        renderGrid();
        renderMidiUI();
        saveState();
    }

    function updateNoteStepCell(cell, kind, data, value, shouldPreview = false) {
        const nextValue = Boolean(value);
        const changed = data.active !== nextValue;
        data.active = nextValue;
        if (!nextValue) {
            data.tie = false;
            cell.classList.remove("tie");
        }
        cell.classList.toggle("bass-active", nextValue);
        cell.querySelector(".step-note")?.remove();
        if (nextValue) {
            const note = document.createElement("span");
            note.className = "step-note";
            note.textContent = data.note;
            cell.appendChild(note);
        }
        if (nextValue && (changed || shouldPreview)) triggerPreview(kind, data.note);
    }

    function finishPatternEditGesture() {
        if (!patternEditGesture) return;
        patternEditGesture = null;
        saveState();
        updateUndoButtons();
    }

    function isPrimaryPointer(event) {
        return event.isPrimary !== false && (event.button === 0 || event.pointerType === "touch" || event.pointerType === "pen");
    }

    function isPaintGesture(event, kind) {
        return patternEditGesture?.kind === kind && (event.buttons & 1) === 1;
    }

    function isStepKeyboardToggle(event) {
        return event.key === "Enter" || event.key === " ";
    }

    function createRow(label, clickable = false) {
        const row = document.createElement("div");
        row.className = "grid-row";
        const labelEl = document.createElement("div");
        labelEl.className = `label${clickable ? " clickable" : ""}`;
        labelEl.textContent = label;
        if (clickable) {
            labelEl.setAttribute("role", "button");
            labelEl.tabIndex = 0;
        }
        row.appendChild(labelEl);
        return row;
    }

    function createStep(id) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.id = id;
        cell.className = "step";
        return cell;
    }

    function renderNotePicker() {
        renderNotePickerUi(els.notePicker, currentScaleNoteNames(), (note) => {
            const { kind, index } = notePickerContext(els.notePicker, SEQUENCER_MODES);
            activePattern(kind)[index].note = note;
            hideNotePicker();
            triggerPreview(kind, note);
            renderGrid();
            saveState();
        });
    }

    function showNotePicker(kind, index, target) {
        const rect = target.getBoundingClientRect();
        renderNotePicker();
        openNotePicker(els.notePicker, {
            kind,
            index,
            targetRect: rect,
            selectedNote: activePattern(kind)?.[index]?.note
        });
    }

    function currentScaleNoteNames() {
        if (state.mode === "drum") return generateNoteNames(NOTE_PICKER_MIN_MIDI, NOTE_PICKER_MAX_MIDI);
        const rootIndex = MIDI_NOTE_NAMES.indexOf(state.noteRoot);
        const scale = currentScaleDefinition();
        const intervals = Array.isArray(scale?.intervals) && scale.intervals.length
            ? scale.intervals.map((interval) => ((Number(interval) % 12) + 12) % 12)
            : Array.from({ length: 12 }, (_, index) => index);
        const pitchClasses = new Set(intervals.map((interval) => (Math.max(0, rootIndex) + interval) % 12));
        return generateNoteNames(NOTE_PICKER_MIN_MIDI, NOTE_PICKER_MAX_MIDI)
            .filter((note) => pitchClasses.has(noteNameToMidi(note) % 12));
    }

    function hideNotePicker() {
        hideNotePickerUi(els.notePicker);
    }

    async function triggerPreview(kind, value) {
        if (!audio?.ctx || sequencer?.isRunning()) return;
        try {
            await audio.resume();
        } catch (error) {
            handleSequencerError(error, { source: "preview-audio-resume" });
            setEngineState("Audio blocked");
            return;
        }
        if (kind === "drum") triggerDrum(value);
        if (kind === "bass") triggerBass(value);
        if (kind === "melody") triggerMelody(value);
        if (kind === "other") triggerOther(value);
    }

    function switchMode(mode) {
        if (!SEQUENCER_MODES.includes(mode)) return;
        state.mode = mode;
        hideNotePicker();
        renderGrid();
        syncMatrixState();
        saveState();
    }

    function clampPages() {
        state.drumPage = clamp(state.drumPage, 0, drumPageCount() - 1);
        ["bass", "melody", "other"].forEach((mode) => {
            const key = notePageKey(mode);
            state[key] = clamp(state[key], 0, notePageCount(mode) - 1);
        });
    }

    function switchBank(bank) {
        const targetBank = selectorValue(bank, BANK_COUNT);
        if (targetBank === null) return;
        SEQUENCER_MODES.forEach((mode) => {
            state.activeBanks[mode] = targetBank;
        });
        clampPages();
        triggerResolumeDeck(targetBank);
        hideNotePicker();
        renderGrid();
        syncMatrixState();
        saveState();
    }

    function saveVisualToSlot(slot) {
        if (state.visualPresets[slot]?.skipVisual) return;
        const prev = state.visualPresets[slot];
        const visual = {};

        visual.shaderId = shaderEditor?.activeId || prev?.shaderId || null;
        visual.shaderName = shaderEditor?.getActiveShader()?.name
            || shaderEditor?.getActiveShader()?.label
            || shaderEditor?.getActiveShader()?.id
            || prev?.shaderName || null;
        visual.shaderSource = shaderEditor?.getActiveShader()?.source
            || prev?.shaderSource || null;
        visual.params = shaderEngine?.params
            ? { ...shaderEngine.params }
            : (prev?.params ? { ...prev.params } : {});

        const editor = document.getElementById("hydra-code-editor");
        visual.hydraCode = editor?.value || prev?.hydraCode || "";
        visual.hydraParams = { ...hydraParamValues };

        delete visual.skipVisual;
        state.visualPresets[slot] = visual;
    }

    function loadVisualFromPreset(slot) {
        const visual = state.visualPresets[slot];
        if (!visual) return;

        if (!visual.skipVisual) {
            let shader = visual.shaderId ? shaderEditor?.getShaderById(visual.shaderId) : null;
            if (!shader && visual.shaderSource && shaderEditor) {
                const sid = visual.shaderId || "__preset_" + slot;
                const sname = visual.shaderName || "Preset " + (slot + 1);
                shaderEditor.shaders.push({ id: sid, name: sname, source: visual.shaderSource });
                shader = shaderEditor.getShaderById(sid);
                shaderEditor.saveToStorage();
            }
            if (shader && shaderEditor) {
                shaderEditor.setActive(shader.id);
            }
            if (shaderEngine && visual.params) {
                for (const [name, value] of Object.entries(visual.params)) {
                    shaderEngine.setParam(name, value);
                }
            }
            bindShaderControls();
        }

        if (visual.hydraCode) {
            const editor = document.getElementById("hydra-code-editor");
            if (editor) editor.value = visual.hydraCode;
        }
        if (visual.hydraParams) {
            for (const [k, v] of Object.entries(visual.hydraParams)) {
                setHydraParamImmediate(k, v);
            }
        }
        if ((state.visualMode === "hydra" || state.visualMode === "hybrid") && visual.hydraCode) {
            evaluateHydraWithParams(visual.hydraCode);
        }
    }

    function updateVisualPresetStatus() {
        const el = $("#visual-preset-toolbar");
        if (!el) return;
        const slot = activeSlotFor();
        const shader = shaderEditor?.getActiveShader();
        const shaderName = shader?.label || shader?.name || shader?.id || "—";
        const visual = state.visualPresets[slot];
        const isLinked = !visual?.skipVisual;
        const hasShader = visual?.shaderSource || (visual?.shaderId && shaderEditor?.getShaderById(visual.shaderId));
        const hasHydra = visual?.hydraCode && visual.hydraCode.trim().length > 0;
        const modeLabels = { hydra: "H", hybrid: "H+", isf: "S" };
        const modeLabel = modeLabels[state.visualMode] || "—";
        const savedLabel = visual ? "Saved" : "Empty";
        el.innerHTML = `
            <span class="visual-preset-badge">P${slot + 1}</span>
            <span class="visual-shader-badge" style="${hasShader ? "" : "opacity:0.3"}">${hasShader ? shaderName : "—"}</span>
            <span class="visual-preset-hydra" style="${hasHydra ? "" : "opacity:0.3"}">H:${hasHydra ? "✓" : "—"}</span>
            <span class="visual-preset-mode">${modeLabel}</span>
            <span class="visual-preset-saved">${savedLabel}</span>
            <button class="mini-btn visual-save-btn" data-visual-save type="button">Save Slot</button>
            <button class="mini-btn visual-link-btn${isLinked ? " linked" : ""}" data-visual-link type="button">${isLinked ? "Link: On" : "Link: Off"}</button>
        `;
        const linkBtn = el.querySelector("[data-visual-link]");
        if (linkBtn) {
            linkBtn.addEventListener("click", () => {
                const s = activeSlotFor();
                const v = state.visualPresets[s];
                if (v?.skipVisual) {
                    delete v.skipVisual;
                } else {
                    state.visualPresets[s] = { shaderId: null, params: {}, skipVisual: true };
                }
                saveState();
                updateVisualPresetStatus();
            });
        }
        const saveBtn = el.querySelector("[data-visual-save]");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                saveVisualToSlot(activeSlotFor());
                saveState();
                saveBtn.classList.add("flash");
                setTimeout(() => saveBtn.classList.remove("flash"), 300);
                updateVisualPresetStatus();
            });
        }
    }

    function switchPreset(slot, kind = state.mode) {
        const targetMode = SEQUENCER_MODES.includes(kind) ? kind : state.mode;
        const targetSlot = selectorValue(slot, PRESET_COUNT);
        if (targetSlot === null) return;
        state.mode = targetMode;
        state.activeSlots[targetMode] = targetSlot;
        if (targetMode === "drum") {
            state.drumPage = clamp(state.drumPage, 0, drumPageCount() - 1);
        } else {
            const pageKey = notePageKey(targetMode);
            state[pageKey] = clamp(state[pageKey], 0, notePageCount(targetMode) - 1);
        }
        loadVisualFromPreset(targetSlot);
        triggerResolumeTrackClip(targetMode, targetSlot);
        hideNotePicker();
        renderGrid();
        syncMatrixState();
        saveState();
        updateVisualPresetStatus();
    }

    function switchAllPresets(slot) {
        const targetSlot = selectorValue(slot, PRESET_COUNT);
        if (targetSlot === null) return;
        SEQUENCER_MODES.forEach((mode) => {
            state.activeSlots[mode] = targetSlot;
        });
        loadVisualFromPreset(targetSlot);
        clampPages();
        triggerResolumeColumn(targetSlot);
        hideNotePicker();
        renderGrid();
        syncMatrixState();
        saveState();
        updateVisualPresetStatus();
    }

    function switchMultiplePresets(items = []) {
        const changes = items
            .map((item) => ({
                kind: item?.kind,
                slot: selectorValue(item?.slot, PRESET_COUNT)
            }))
            .filter((item) => SEQUENCER_MODES.includes(item.kind) && item.slot !== null);
        if (!changes.length) return;

        changes.forEach(({ kind, slot }) => {
            state.activeSlots[kind] = slot;
            if (kind === "drum") {
                state.drumPage = clamp(state.drumPage, 0, drumPageCount() - 1);
            } else {
                const pageKey = notePageKey(kind);
                state[pageKey] = clamp(state[pageKey], 0, notePageCount(kind) - 1);
            }
            triggerResolumeTrackClip(kind, slot);
        });
        hideNotePicker();
        renderGrid();
        syncMatrixState();
        saveState();
    }

    function switchRandomRole(role) {
        if (!["generate", "mutate", "fill"].includes(role)) return;
        state.randomRole = role;
        applyStateToUI();
        saveState();
    }

    function switchTrackRate(rate) {
        if (![0.5, 1, 2].includes(rate)) return;
        assignTrackRate(state, state.mode, rate);
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function trackRate(kind = state.mode) {
        return selectTrackRate(state, kind);
    }

    function switchPitchGeneratorMode(mode) {
        if (!isPitchMode(state.mode) || !PITCH_GENERATOR_MODES.includes(mode)) return;
        state.pitchGeneratorModes[state.mode] = mode;
        applyStateToUI();
        saveState();
    }

    function switchPitchGeneratorRole(role) {
        if (!isPitchMode(state.mode) || !PITCH_GENERATOR_ROLES.includes(role)) return;
        state.pitchGeneratorRoles[state.mode] = role;
        if (!PITCH_GENERATOR_STYLES[role]?.includes(state.pitchGeneratorStyles[state.mode])) {
            state.pitchGeneratorStyles[state.mode] = PITCH_GENERATOR_STYLES[role][0];
        }
        applyStateToUI();
        saveState();
    }

    function switchPitchGeneratorStyle(style) {
        if (!isPitchMode(state.mode)) return;
        const role = currentPitchGeneratorRole();
        if (!PITCH_GENERATOR_STYLES[role]?.includes(style)) return;
        state.pitchGeneratorStyles[state.mode] = style;
        applyStateToUI();
        saveState();
    }

    function isPitchMode(mode) {
        return mode === "bass" || mode === "melody" || mode === "other";
    }

    function currentPitchGeneratorRole() {
        return PITCH_GENERATOR_ROLES.includes(state.pitchGeneratorRoles?.[state.mode])
            ? state.pitchGeneratorRoles[state.mode]
            : state.mode === "other" ? "mono" : state.mode;
    }

    function switchUiMode(mode) {
        if (!["edit", "performance"].includes(mode)) return;
        state.uiMode = mode;
        hideNotePicker();
        applyStateToUI();
        saveState();
    }

    function toggleFileMenu() {
        const open = !els.fileMenu?.classList.contains("open");
        els.fileMenu?.classList.toggle("open", open);
        els.fileMenu?.setAttribute("aria-hidden", open ? "false" : "true");
        els.fileMenuToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function closeFileMenu() {
        els.fileMenu?.classList.remove("open");
        els.fileMenu?.setAttribute("aria-hidden", "true");
        els.fileMenuToggle?.setAttribute("aria-expanded", "false");
     }
 
     function validatePatternMatrixData(state) {
         // Validate memory structure for pattern matrix
         const modes = ["drum", "bass", "melody", "other"];
         
         for (const mode of modes) {
             if (!state.memory?.[mode]) return false;
             
             // Check banks
             if (!Array.isArray(state.memory[mode]) || state.memory[mode].length !== BANK_COUNT) return false;
             
             for (let bank = 0; bank < BANK_COUNT; bank++) {
                 if (!Array.isArray(state.memory[mode][bank]) || state.memory[mode][bank].length !== PRESET_COUNT) return false;
                 
                 for (let slot = 0; slot < PRESET_COUNT; slot++) {
                     const pattern = state.memory[mode][bank][slot];
                     
                     // Validate pattern based on mode
                     if (mode === "drum") {
                         if (!Array.isArray(pattern) || pattern.length !== DRUM_TRACK_COUNT) return false;
                         for (let track = 0; track < DRUM_TRACK_COUNT; track++) {
                             if (!Array.isArray(pattern[track]) || pattern[track].length !== DRUM_STEP_COUNT) return false;
                             // Validate each step is boolean
                             for (let step = 0; step < DRUM_STEP_COUNT; step++) {
                                 if (typeof pattern[track][step] !== "boolean") return false;
                             }
                         }
                     } else {
                         // bass, melody, other patterns
                         if (!Array.isArray(pattern) || pattern.length !== NOTE_STEP_COUNT) return false;
                         for (let step = 0; step < NOTE_STEP_COUNT; step++) {
                             const stepData = pattern[step];
                             if (typeof stepData !== "object" || stepData === null) return false;
                             if (typeof stepData.active !== "boolean") return false;
                             if (typeof stepData.note !== "string" || !isNoteName(stepData.note)) return false;
                         }
                     }
                 }
             }
         }
         
         // Validate presetLoopLengths
         if (!state.presetLoopLengths) return false;
         for (const mode of modes) {
             if (!Array.isArray(state.presetLoopLengths[mode]) || state.presetLoopLengths[mode].length !== BANK_COUNT) return false;
             for (let bank = 0; bank < BANK_COUNT; bank++) {
                 if (!Array.isArray(state.presetLoopLengths[mode][bank]) || state.presetLoopLengths[mode][bank].length !== PRESET_COUNT) return false;
                 for (let slot = 0; slot < PRESET_COUNT; slot++) {
                     const length = state.presetLoopLengths[mode][bank][slot];
                     const allowed = mode === "drum" ? [16, 32, 64] : [16, 32, 64, 128, 256];
                     if (!allowed.includes(length)) return false;
                 }
             }
         }
         
         // Validate presetTrackRates
         if (!state.presetTrackRates) return false;
         for (const mode of modes) {
             if (!Array.isArray(state.presetTrackRates[mode]) || state.presetTrackRates[mode].length !== BANK_COUNT) return false;
             for (let bank = 0; bank < BANK_COUNT; bank++) {
                 if (!Array.isArray(state.presetTrackRates[mode][bank]) || state.presetTrackRates[mode][bank].length !== PRESET_COUNT) return false;
                 for (let slot = 0; slot < PRESET_COUNT; slot++) {
                     const rate = state.presetTrackRates[mode][bank][slot];
                     if (![0.5, 1, 2].includes(rate)) return false;
                 }
             }
         }
         
         // Validate activeBanks and activeSlots
         if (!state.activeBanks || !state.activeSlots) return false;
         for (const mode of modes) {
             const bank = state.activeBanks[mode];
             const slot = state.activeSlots[mode];
             if (typeof bank !== "number" || bank < 0 || bank >= BANK_COUNT) return false;
             if (typeof slot !== "number" || slot < 0 || slot >= PRESET_COUNT) return false;
         }
         
         return true;
     }
 
     function handleFileMenuAction(action) {
         closeFileMenu();
         if (action === "new") newProject();
         if (action === "save") {
             flushSaveState();
             flashFileMenuLabel("Saved");
             setEngineState("Project saved");
         }
         if (action === "save-as") exportProjectFile();
         if (action === "open") els.projectOpenInput?.click();
         if (action === "preferences") toggleMidiModal(true);
         if (action === "help") showFileHelp();
     }

      function newProject() {
          const confirmed = window.confirm("Buat project baru kosong? Pattern saat ini akan diganti dengan preset kosong.");
          if (!confirmed) return;

          sequencer?.stop();
          clearHeldNotes();
          state = normalizeState(null);
          state.projectName = "Untitled";

         if (!validatePatternMatrixData(state)) {
             window.alert("Gagal membuat project kosong: default state tidak valid.");
             setEngineState("New project failed");
             return;
         }

         if (!persistProjectState(state)) {
             window.alert("Gagal menyimpan project kosong. Storage browser kemungkinan penuh.");
             return;
         }

         setEngineState("New project created");
         window.location.reload();
     }

     function exportProjectFile() {
         saveAppState(state);
         exportProjectFileModule();
     }

     function openProjectFile() {
          const file = els.projectOpenInput?.files?.[0];
          if (!file) return;
          openProjectFileModule(file);
          els.projectOpenInput.value = "";
     }

    function showFileHelp() {
        window.alert([
            "Syntetika Engine",
            "",
            "Aplikasi sequencer audio-reactive untuk membuat pattern drum, bassline, melody, mono, visual realtime, MIDI mapping, dan kontrol Resolume.",
            "",
            "Dibuat dengan Codex oleh danartri @danartri.",
            "",
            "File:",
            "New Project: buat project kosong.",
            "Save: simpan project di browser.",
            "Save As: export project JSON.",
            "Open: buka project JSON.",
            "Preferences: MIDI Map, MIDI routing, Resolume Link, dan OSC bridge.",
            "",
            "Shortcut:",
            "Space: Resync transport.",
            "Shift + Space: Play / Stop.",
            "Ctrl + Space: Tap Tempo.",
            "Arrow Up / Down: BPM +/-.",
            "Arrow Left / Right: Nudge timing.",
            "Shift + 1-8: All Presets 1-8.",
            "Z X C V B N M ,: Drum preset 1-8.",
            "A S D F G H J K: Bass preset 1-8.",
            "Q W E R T Y U I: Melody preset 1-8.",
            "1 2 3 4 5 6 7 8: Mono preset 1-8.",
            "Esc: tutup menu."
        ].join("\n"));
    }

    function flashFileMenuLabel(label) {
        if (!els.fileMenuToggle) return;
        const previous = els.fileMenuToggle.textContent;
        els.fileMenuToggle.textContent = label;
        window.setTimeout(() => {
            if (els.fileMenuToggle) els.fileMenuToggle.textContent = previous || "File";
        }, 900);
    }

    function toggleSidePanel(side) {
        if (side === "left") {
            leftPanelCollapsed = !leftPanelCollapsed;
        } else if (side === "right") {
            rightPanelCollapsed = !rightPanelCollapsed;
        }
        applyStateToUI();
    }

    function modeLabel(kind = state.mode) {
        return kind === "bass" ? "Model D" : kind === "melody" ? "Kobol" : kind === "other" ? "Monostation" : "DrumBrute";
    }

    function styleLabel(style) {
        return {
            default: "Default",
            glitch: "Glitch",
            noise: "Noise",
            abstract: "Abstract",
            sub: "Sub",
            lead: "Lead",
            pad: "Pad",
            "hard-bass": "Hard Bass",
            vintage: "Vintage",
            glass: "Glass",
            bass: "Bass",
            stab: "Stab",
            fx: "FX",
            acid: "Acid",
            pluck: "Pluck",
            bell: "Bell",
            moog: "Moog",
            plucky: "Plucky",
            stabby: "Stabby",
            fm: "FM"
        }[style] || String(style || "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function currentSoundStyle() {
        if (state.mode === "bass") return state.bassSound;
        if (state.mode === "melody") return state.melodySound;
        if (state.mode === "other") return state.otherSound;
        return state.drumSound;
    }

    function enabledAudioCount() {
        return SEQUENCER_MODES.filter((kind) => internalAudioEnabled(kind)).length;
    }

    function mixerSummary() {
        const mixer = state.mixer || {};
        return `Mixer: D${mixer.drum ?? 80} B${mixer.bass ?? 82} M${mixer.melody ?? 72} O${mixer.other ?? 74}`;
    }

    function toggleInternalAudio(kind) {
        if (!SEQUENCER_MODES.includes(kind)) return;
        state.internalAudio[kind] = !internalAudioEnabled(kind);
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function updateMixer(input, shouldSave) {
        const kind = input.dataset.mixer;
        if (!SEQUENCER_MODES.includes(kind)) return;
        state.mixer ||= {};
        state.mixer[kind] = clamp(Math.round(Number(input.value) || 0), 0, 100);
        audio?.setMixerLevels(state.mixer);
        applyMixerToUI();
        if (shouldSave) saveState();
    }

    function updateResolumeConfigFromUI(shouldSave = true) {
        state.resolume = normalizeResolumeConfig({
            ...state.resolume,
            enabled: Boolean(els.resolumeEnabled?.checked),
            host: els.resolumeHost?.value,
            port: Number(els.resolumePort?.value),
            matrixTrigger: Boolean(els.resolumeMatrixTrigger?.checked),
            deckTrigger: Boolean(els.resolumeDeckTrigger?.checked),
            dashboardPulse: Boolean(els.resolumeDashboardPulse?.checked),
            oscHost: els.resolumeOscHost?.value,
            oscPort: Number(els.resolumeOscPort?.value),
            oscBridgeUrl: els.resolumeOscBridgeUrl?.value,
            pulseAmount: Number(els.resolumePulseAmount?.value),
            pulseLengthMs: Number(els.resolumePulseLength?.value),
            pulseDebounceMs: Number(els.resolumePulseDebounce?.value),
            oscTargets: {
                clipTargets: resolumeClipTargetsFromUI()
            }
        });
        resolume?.setConfig(state.resolume);
        applyResolumeToUI();
        if (shouldSave) saveState();
    }

    function triggerResolumeTrackClip(kind, slot) {
        resolume?.triggerTrackClip(kind, slot);
    }

    function triggerResolumeColumn(slot) {
        resolume?.triggerColumn(slot);
    }

    function triggerResolumeDeck(slot) {
        resolume?.selectDeck(slot);
    }

    function pulseResolume(linkKey) {
        resolume?.pulse(linkKey);
    }

    function setResolumeStatus(text) {
        if (els.resolumeStatus) els.resolumeStatus.textContent = text;
    }

    function switchDrumSound(style) {
        if (!DRUM_SOUND_STYLES.includes(style)) return;
        state.drumSound = style;
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function switchBassSound(style) {
        if (!BASS_SOUND_STYLES.includes(style)) return;
        state.bassSound = style;
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function switchMelodySound(style) {
        if (!MELODY_SOUND_STYLES.includes(style)) return;
        state.melodySound = style;
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function switchOtherSound(style) {
        if (!OTHER_SOUND_STYLES.includes(style)) return;
        state.otherSound = style;
        applyStateToUI();
        syncMatrixState();
        saveState();
    }

    function randomize() {
        window.__aiBridge?.saveUndo();
        randomizer.apply({
            mode: state.mode,
            role: state.randomRole,
            pattern: activePattern(state.mode),
            loopLength: getLoopLength(state.mode),
            scale: currentScaleDefinition(),
            root: state.noteRoot,
            drumGenre: state.drumRandomGenre,
            genre: state.drumRandomGenre,
            generatorMode: isPitchMode(state.mode) ? state.pitchGeneratorModes[state.mode] : "explore",
            generatorRole: isPitchMode(state.mode) ? currentPitchGeneratorRole() : "",
            generatorStyle: isPitchMode(state.mode) ? state.pitchGeneratorStyles[state.mode] : ""
        });
        renderGrid();
        saveState();
    }

    function setDrumLoopLength(loopLength) {
        if (![16, 32, 64].includes(loopLength)) return;
        assignLoopLength(state, "drum", loopLength);
        state.drumPage = clamp(state.drumPage, 0, drumPageCount() - 1);
        renderGrid();
        saveState();
    }

    function setDrumPage(page) {
        const value = Number(page);
        if (!Number.isFinite(value)) return;
        state.drumPage = clamp(Math.trunc(value), 0, drumPageCount() - 1);
        renderGrid();
        saveState();
    }

    function toggleDrumFollowPage() {
        state.drumFollowPage = !state.drumFollowPage;
        applyStateToUI();
        saveState();
    }

    function drumPageCount() {
        return Math.max(1, Math.ceil((Number(getLoopLength("drum")) || 16) / 16));
    }

     function setNoteLoopLength(kind, loopLength) {
          if (![16, 32, 64, 128, 256].includes(loopLength)) return;
         const pageKey = notePageKey(kind);
         assignLoopLength(state, kind, loopLength);
         state[pageKey] = clamp(state[pageKey], 0, notePageCount(kind) - 1);
         renderGrid();
         saveState();
     }

    function setNotePage(kind, page) {
        const pageKey = notePageKey(kind);
        const value = Number(page);
        if (!Number.isFinite(value)) return;
        state[pageKey] = clamp(Math.trunc(value), 0, notePageCount(kind) - 1);
        renderGrid();
        saveState();
    }

    function toggleNoteFollowPage(kind) {
        const followKey = noteFollowKey(kind);
        state[followKey] = !state[followKey];
        applyStateToUI();
        saveState();
    }

    function toggleTieMode() {
        const kind = state.mode;
        if (kind === "drum") return;
        state.tieMode[kind] = !state.tieMode[kind];
        if (!state.tieMode[kind]) clearHeldNotes(kind);
        updateTieToggleUI();
        saveState();
    }

    function updateTieToggleUI() {
        if (els.tieToggleBtn) {
            const isDrum = state.mode === "drum";
            const active = !isDrum && state.tieMode[state.mode];
            els.tieToggleBtn.classList.toggle("active", active);
            els.tieToggleBtn.textContent = active ? "Tie On" : "Tie";
            els.tieToggleBtn.hidden = isDrum;
        }
    }

    function notePageCount(kind) {
        return Math.max(1, Math.ceil((Number(getLoopLength(kind)) || 64) / 64));
    }

    function notePageOffset(kind) {
        const pageKey = notePageKey(kind);
        return state[pageKey] * 64;
    }

    function notePageKey(kind) {
        if (kind === "bass") return "bassPage";
        if (kind === "melody") return "melodyPage";
        return "otherPage";
    }

    function noteFollowKey(kind) {
        if (kind === "bass") return "bassFollowPage";
        if (kind === "melody") return "melodyFollowPage";
        return "otherFollowPage";
    }

    function renderScalePicker() {
        renderScalePickerUi({
            rootHost: els.scaleRootBtns,
            optionHost: els.scaleOptionList,
            mode: state.mode,
            drumGenres: DRUM_RANDOM_GENRES,
            noteRoots: MIDI_NOTE_NAMES,
            scales: SCALE_DEFINITIONS
        });
        applyStateToUI();
    }

    function toggleScalePopup(event) {
        event?.stopPropagation();
        if (els.scalePopup?.classList.contains("open")) hideScalePopup();
        else showScalePopup();
    }

    function showScalePopup() {
        if (!els.scalePopup || !els.scaleBtn) return;
        renderScalePicker();
        const rect = els.scaleBtn.getBoundingClientRect();
        els.scalePopup.classList.add("open");
        els.scalePopup.setAttribute("aria-hidden", "false");
        const popupWidth = els.scalePopup.offsetWidth || 320;
        const popupHeight = els.scalePopup.offsetHeight || 360;
        const margin = 8;
        els.scalePopup.style.left = `${clamp(rect.left, margin, window.innerWidth - popupWidth - margin)}px`;
        els.scalePopup.style.top = `${clamp(rect.bottom + margin, margin, window.innerHeight - popupHeight - margin)}px`;
        applyStateToUI();
    }

    function hideScalePopup() {
        els.scalePopup?.classList.remove("open");
        els.scalePopup?.setAttribute("aria-hidden", "true");
    }

    function selectScaleRoot(root) {
        if (!MIDI_NOTE_NAMES.includes(root)) return;
        state.noteRoot = root;
        renderNotePicker();
        applyStateToUI();
        saveState();
    }

    function selectScale(scaleId) {
        if (!SCALE_DEFINITIONS.some((scale) => scale.id === scaleId)) return;
        state.noteScale = scaleId;
        renderNotePicker();
        applyStateToUI();
        saveState();
    }

    function selectDrumGenre(genreId) {
        if (!DRUM_RANDOM_GENRES.some((genre) => genre.id === genreId)) return;
        state.drumRandomGenre = genreId;
        applyStateToUI();
        saveState();
    }

    function currentScaleDefinition() {
        return SCALE_DEFINITIONS.find((scale) => scale.id === state.noteScale) || SCALE_DEFINITIONS[0];
    }

    function scaleButtonLabel() {
        if (state.mode === "drum") return `Genre: ${currentDrumGenre().label}`;
        return `${state.noteRoot} ${currentScaleDefinition().label}`;
    }

    function currentDrumGenre() {
        return DRUM_RANDOM_GENRES.find((genre) => genre.id === state.drumRandomGenre) || DRUM_RANDOM_GENRES[0];
    }

    function clearAll() {
        window.__aiBridge?.saveUndo();
        if (state.mode === "drum") {
            setActivePattern("drum", Array.from({ length: DRUM_VOICE_ORDER.length }, () => Array(64).fill(false)));
        } else if (state.mode === "bass") {
            setActivePattern("bass", Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C1", tie: false })));
        } else if (state.mode === "melody") {
            setActivePattern("melody", Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C2", tie: false })));
        } else {
            setActivePattern("other", Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C2", tie: false })));
        }
        clearCurrentSteps();
        renderGrid();
        saveState();
        updateUndoButtons();
    }

    function copyPattern() {
        copiedPattern = JSON.stringify(state.mode === "drum"
            ? copyCurrentDrumBar()
            : copyCurrentNotePage(state.mode));
        flashButton(els.copyBtn);
    }

    function pastePattern() {
        if (!copiedPattern) return;
        window.__aiBridge?.saveUndo();
        const data = JSON.parse(copiedPattern);
        if (state.mode === "drum") {
            pasteDrumBar(data);
            renderGrid();
            saveState();
            flashButton(els.pasteBtn);
            return;
        }
        if (data?.kind === "note-page") {
            pasteNotePage(state.mode, data);
            renderGrid();
            saveState();
            flashButton(els.pasteBtn);
            return;
        }
        function padNotePattern(arr, defaultNote) {
            return Array.from({ length: NOTE_STEP_COUNT }, (_, i) => {
                const src = arr[i] || {};
                return { active: Boolean(src.active), note: isNoteName(src.note) ? src.note : defaultNote, tie: src.tie === true };
            });
        }
        if (state.mode === "bass" && Array.isArray(data) && data.length >= 64) {
            setActivePattern("bass", padNotePattern(data, "C1"));
        }
        if (state.mode === "melody" && Array.isArray(data) && data.length >= 64) {
            setActivePattern("melody", padNotePattern(data, "C2"));
        }
        if (state.mode === "other" && Array.isArray(data) && data.length >= 64) {
            setActivePattern("other", padNotePattern(data, "C2"));
        }
        renderGrid();
        saveState();
        flashButton(els.pasteBtn);
    }

    function copyCurrentDrumBar() {
        const start = state.drumPage * 16;
        return {
            kind: "drum-bar",
            page: state.drumPage,
            voices: [...DRUM_VOICE_ORDER],
            rows: activePattern("drum").map((row) => Array.from({ length: 16 }, (_, step) => Boolean(row?.[start + step])))
        };
    }

    function pasteDrumBar(data) {
        const rows = drumBarRowsFromClipboard(data);
        if (!rows) return;
        const pattern = activePattern("drum");
        const start = state.drumPage * 16;
        for (let track = 0; track < DRUM_VOICE_ORDER.length; track += 1) {
            pattern[track] ||= Array(64).fill(false);
            for (let step = 0; step < 16; step += 1) {
                pattern[track][start + step] = Boolean(rows[track]?.[step]);
            }
        }
    }

    function drumBarRowsFromClipboard(data) {
        if (data?.kind === "drum-bar" && Array.isArray(data.rows)) {
            return data.rows.map((row) => Array.from({ length: 16 }, (_, step) => Boolean(row?.[step])));
        }
        if (Array.isArray(data) && (data.length === 4 || data.length === DRUM_VOICE_ORDER.length)) {
            const fullPattern = normalizePastedDrumPattern(data);
            return fullPattern.map((row) => Array.from({ length: 16 }, (_, step) => Boolean(row?.[step])));
        }
        return null;
    }

    function normalizePastedDrumPattern(data) {
        if (data.length === DRUM_VOICE_ORDER.length) {
            return data.map((row) => Array.from({ length: 64 }, (_, step) => Boolean(row?.[step])));
        }
        const rows = Array.from({ length: DRUM_VOICE_ORDER.length }, () => Array(64).fill(false));
        const legacyTargets = [0, 1, 5, 6];
        legacyTargets.forEach((targetTrack, legacyTrack) => {
            rows[targetTrack] = Array.from({ length: 64 }, (_, step) => Boolean(data[legacyTrack]?.[step]));
        });
        return rows;
    }

    function copyCurrentNotePage(kind) {
        const pageOff = notePageOffset(kind);
        const pattern = activePattern(kind);
        const pageKey = notePageKey(kind);
        return {
            kind: "note-page",
            page: state[pageKey],
            data: pattern.slice(pageOff, pageOff + 64)
        };
    }

    function pasteNotePage(kind, data) {
        if (data?.kind !== "note-page" || !Array.isArray(data.data)) return;
        const pageOff = notePageOffset(kind);
        const pattern = activePattern(kind);
        const defaultNote = kind === "bass" ? "C1" : "C2";
        for (let i = 0; i < 64; i += 1) {
            const src = data.data[i] || {};
            pattern[pageOff + i] = { active: Boolean(src.active), note: isNoteName(src.note) ? src.note : defaultNote, tie: src.tie === true };
        }
    }

    function shiftSelectedPitch(semitones) {
        if (state.mode === "drum" || !Number.isFinite(semitones)) return;
        window.__aiBridge?.saveUndo();
        const pattern = activePattern(state.mode);
        pattern.forEach((step) => {
            if (!step || !isNoteName(step.note)) return;
            step.note = midiNoteName(clamp(noteNameToMidi(step.note) + semitones, 0, 127));
        });
        hideNotePicker();
        renderGrid();
        saveState();
        updateUndoButtons();
    }

    function applyStateToUI() {
        updateProjectNameUIModule();
        els.body?.classList.toggle("ui-edit", state.uiMode === "edit");
        els.body?.classList.toggle("ui-performance", state.uiMode === "performance");
        els.body?.classList.toggle("left-panel-collapsed", leftPanelCollapsed);
        els.body?.classList.toggle("right-panel-collapsed", rightPanelCollapsed);
        els.body?.classList.toggle("visual-disabled", !state.visualEnabled);
        if (els.visualToggle) {
            els.visualToggle.textContent = state.visualEnabled ? "Visual: On" : "Visual: Off";
            els.visualToggle.classList.toggle("visual-off", !state.visualEnabled);
        }
        const logoEl = document.getElementById("syntetika-logo");
        if (logoEl) {
            const showLogo = (!state.visualEnabled && state.visualMode !== "hydra") || popupVisualActive;
            logoEl.classList.toggle("visible", showLogo);
        }
        document.querySelectorAll("[data-visual-mode]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.visualMode === state.visualMode);
        });
        if (els.fpsCounter && shaderEngine) {
            els.fpsCounter.textContent = shaderEngine.fps > 0 ? shaderEngine.fps + " FPS" : "-- FPS";
        }
        if (els.popupVisualBtn) {
            els.popupVisualBtn.textContent = popupVisualActive ? "Close Popup" : "Pop Up Visual";
            els.popupVisualBtn.classList.toggle("popup-active", popupVisualActive);
        }
        if (els.canvasContainer) {
            const aspect = state.visualAspect || "fill";
            els.canvasContainer.dataset.aspect = aspect;
            const wrap = document.getElementById("canvas-aspect-wrap");
            if (aspect === "custom") {
                const w = state.visualAspectWidth || 1920;
                const h = state.visualAspectHeight || 1080;
                if (wrap) wrap.style.aspectRatio = `${w} / ${h}`;
                if (els.aspectCustomWidth) els.aspectCustomWidth.value = w;
                if (els.aspectCustomHeight) els.aspectCustomHeight.value = h;
            } else {
                if (wrap) wrap.style.aspectRatio = "";
            }
            const aspectToggle = els.aspectToggle;
            if (aspectToggle) {
                const labels = { fill: "Aspect: Fill", "16-9": "Aspect: 16:9", "4-3": "Aspect: 4:3", "1-1": "Aspect: 1:1", "9-16": "Aspect: 9:16", custom: "Aspect: Custom" };
                aspectToggle.textContent = labels[aspect] || "Aspect: Fill";
            }
        }
        if (els.canvasResWidth) els.canvasResWidth.value = state.canvasWidth || 0;
        if (els.canvasResHeight) els.canvasResHeight.value = state.canvasHeight || 0;
        if (els.leftPanelToggle) {
            els.leftPanelToggle.textContent = leftPanelCollapsed ? "Menu" : "Hide";
            els.leftPanelToggle.setAttribute("aria-expanded", leftPanelCollapsed ? "false" : "true");
        }
        if (els.rightPanelToggle) {
            els.rightPanelToggle.textContent = rightPanelCollapsed ? "Visual" : "Hide";
            els.rightPanelToggle.setAttribute("aria-expanded", rightPanelCollapsed ? "false" : "true");
        }
        if (els.bpmVal) els.bpmVal.textContent = state.bpm;
        $$("[data-ui-mode]").forEach((button) => button.classList.toggle("active", button.dataset.uiMode === state.uiMode));
        els.modeBtns.forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
        $$("[data-internal-audio]").forEach((button) => {
            const kind = button.dataset.internalAudio;
            const enabled = internalAudioEnabled(kind);
            button.classList.toggle("active", enabled);
            const label = kind === "bass" ? "Bass" : kind === "other" ? "Mono" : kind.charAt(0).toUpperCase() + kind.slice(1);
            button.textContent = `${label} ${enabled ? "On" : "Off"}`;
        });
        if (els.audioSoundSummaryBtn) {
            els.audioSoundSummaryBtn.textContent = `Audio / Sound: ${enabledAudioCount()}/4 On | ${modeLabel()} ${styleLabel(currentSoundStyle())}`;
            els.audioSoundSummaryBtn.setAttribute("aria-expanded", audioSoundPanelOpen ? "true" : "false");
        }
        if (els.audioSoundDetail) els.audioSoundDetail.hidden = !audioSoundPanelOpen;
        applyMixerToUI();
        if (els.audioMixerSummaryBtn) {
            els.audioMixerSummaryBtn.textContent = mixerSummary();
            els.audioMixerSummaryBtn.setAttribute("aria-expanded", audioMixerPanelOpen ? "true" : "false");
        }
        if (els.audioMixerDetail) els.audioMixerDetail.hidden = !audioMixerPanelOpen;
        if (els.midiMapSummaryBtn) {
            const learned = midiConfig.tracks.filter((track) => Number.isInteger(track.inputNote)).length;
            els.midiMapSummaryBtn.textContent = `MIDI Map: ${learned}/${midiConfig.tracks.length} Learned`;
            els.midiMapSummaryBtn.setAttribute("aria-expanded", midiMapPanelOpen ? "true" : "false");
        }
        if (els.midiMapDetail) els.midiMapDetail.hidden = !midiMapPanelOpen;
        applyResolumeToUI();
        $$("[data-drum-sound]").forEach((button) => {
            button.classList.toggle("active", button.dataset.drumSound === state.drumSound);
        });
        $$("[data-bass-sound]").forEach((button) => {
            button.classList.toggle("active", button.dataset.bassSound === state.bassSound);
        });
        $$("[data-melody-sound]").forEach((button) => {
            button.classList.toggle("active", button.dataset.melodySound === state.melodySound);
        });
        $$("[data-other-sound]").forEach((button) => {
            button.classList.toggle("active", button.dataset.otherSound === state.otherSound);
        });
        $$("[data-sound-panel]").forEach((panel) => {
            panel.hidden = panel.dataset.soundPanel !== state.mode;
        });
        if (els.drumBarControls) els.drumBarControls.hidden = state.mode !== "drum";
        $$("[data-random-role]").forEach((button) => button.classList.toggle("active", button.dataset.randomRole === state.randomRole));
        $$("[data-track-rate]").forEach((button) => {
            button.classList.toggle("active", Number(button.dataset.trackRate) === trackRate());
        });
        if (els.randomBtn) els.randomBtn.textContent = state.randomRole === "generate" ? "Random" : state.randomRole;
        renderPitchGeneratorControls();
        if (els.scaleBtn) {
            els.scaleBtn.textContent = scaleButtonLabel();
            els.scaleBtn.disabled = false;
            els.scaleBtn.classList.toggle("active", state.mode === "drum" ? state.drumRandomGenre !== "default" : true);
        }
        $$(".btn-scale-root[data-scale-root]").forEach((button) => {
            button.classList.toggle("active", button.dataset.scaleRoot === state.noteRoot);
        });
        $$(".btn-scale-option[data-scale-id]").forEach((button) => {
            button.classList.toggle("active", button.dataset.scaleId === state.noteScale);
        });
        $$(".btn-scale-option[data-drum-genre]").forEach((button) => {
            button.classList.toggle("active", button.dataset.drumGenre === state.drumRandomGenre);
        });
        $$("[data-drum-loop]").forEach((button) => {
            button.classList.toggle("active", Number(button.dataset.drumLoop) === getLoopLength("drum"));
        });
        $$("[data-drum-page]").forEach((button) => {
            const page = Number(button.dataset.drumPage);
            const enabled = page < drumPageCount();
            button.disabled = !enabled;
            button.classList.toggle("active", enabled && page === state.drumPage);
        });
        $$("[data-drum-follow]").forEach((button) => {
            button.classList.toggle("active", Boolean(state.drumFollowPage));
        });
        const isNoteMode = state.mode !== "drum";
        if (els.noteBarControls) els.noteBarControls.hidden = !isNoteMode;
        if (isNoteMode) {
            $$("[data-note-loop]").forEach((button) => {
                button.classList.toggle("active", Number(button.dataset.noteLoop) === getLoopLength(state.mode));
            });
            $$("[data-note-page]").forEach((button) => {
                const page = Number(button.dataset.notePage);
                const enabled = page < notePageCount(state.mode);
                button.disabled = !enabled;
                const pageKey = notePageKey(state.mode);
                button.classList.toggle("active", enabled && page === state[pageKey]);
            });
            $$("[data-note-follow]").forEach((button) => {
                const followKey = noteFollowKey(state.mode);
                button.classList.toggle("active", Boolean(state[followKey]));
            });
        }
        $$("[data-pitch-shift]").forEach((button) => {
            button.disabled = state.mode === "drum";
        });
        const displayedBank = activeBankFor();
        $$("[data-bank]").forEach((button) => button.classList.toggle("active", Number(button.dataset.bank) === displayedBank));
        $$("[data-pattern-row]").forEach((row) => row.classList.toggle("active", row.dataset.patternRow === state.mode));
        $$("[data-preset-kind][data-preset]").forEach((button) => {
            const kind = button.dataset.presetKind;
            const isCurrentBank = activeBankFor(kind) === displayedBank;
            button.classList.toggle("active", isCurrentBank && Number(button.dataset.preset) === activeSlotFor(kind));
        });
        $$("[data-global-preset]").forEach((button) => {
            const slot = Number(button.dataset.globalPreset);
            const allSelected = SEQUENCER_MODES.every((mode) => activeBankFor(mode) === displayedBank && activeSlotFor(mode) === slot);
            button.classList.toggle("active", allSelected);
        });
        updateUndoButtons();
        updateTieToggleUI();
        const kbToggle = document.getElementById("midi-kb-toggle");
        if (kbToggle) kbToggle.classList.toggle("active", midiKeyboard?.isActive());
        if (els.presetBtns) els.presetBtns.hidden = midiKeyboard?.isActive() ?? false;
    }

    function renderPitchGeneratorControls() {
        const isPitch = isPitchMode(state.mode);
        if (els.pitchGeneratorPanel) els.pitchGeneratorPanel.hidden = !isPitch;
        if (!isPitch) return;

        const generatorMode = PITCH_GENERATOR_MODES.includes(state.pitchGeneratorModes?.[state.mode])
            ? state.pitchGeneratorModes[state.mode]
            : "explore";
        const generatorRole = currentPitchGeneratorRole();
        const styles = PITCH_GENERATOR_STYLES[generatorRole] || [];
        if (!styles.includes(state.pitchGeneratorStyles?.[state.mode])) {
            state.pitchGeneratorStyles[state.mode] = styles[0];
        }
        const generatorStyle = state.pitchGeneratorStyles[state.mode];
        const modeLabel = generatorMode === "structured" ? "Structured" : "Explore";
        const roleLabel = generatorRole === "mono" ? "Mono" : generatorRole.charAt(0).toUpperCase() + generatorRole.slice(1);
        const styleLabel = PITCH_GENERATOR_STYLE_LABELS[generatorStyle] || generatorStyle;

        if (els.generatorSummaryBtn) {
            els.generatorSummaryBtn.textContent = `Generator: ${modeLabel} / ${roleLabel} / ${styleLabel}`;
            els.generatorSummaryBtn.setAttribute("aria-expanded", generatorPanelOpen ? "true" : "false");
        }
        if (els.generatorDetail) els.generatorDetail.hidden = !generatorPanelOpen;

        $$("[data-generator-mode]").forEach((button) => {
            button.classList.toggle("active", button.dataset.generatorMode === generatorMode);
        });
        $$("[data-generator-role]").forEach((button) => {
            button.classList.toggle("active", button.dataset.generatorRole === generatorRole);
        });

        if (!els.generatorStyleBtns) return;
        els.generatorStyleBtns.replaceChildren(...styles.map((style) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `btn-role${style === generatorStyle ? " active" : ""}`;
            button.dataset.generatorStyle = style;
            button.textContent = PITCH_GENERATOR_STYLE_LABELS[style] || style;
            return button;
        }));
    }

    function applyMixerToUI() {
        els.mixerInputs.forEach((input) => {
            const kind = input.dataset.mixer;
            const value = clamp(Math.round(Number(state.mixer?.[kind]) || 0), 0, 100);
            if (Number(input.value) !== value) input.value = value;
        });
        els.mixerValues.forEach((label) => {
            const kind = label.dataset.mixerValue;
            label.textContent = String(clamp(Math.round(Number(state.mixer?.[kind]) || 0), 0, 100));
        });
    }

    function applyResolumeToUI() {
        if (!state.resolume) state.resolume = normalizeResolumeConfig();
        resolume?.setConfig(state.resolume);
        if (els.resolumeSummaryBtn) {
            const status = state.resolume.enabled ? `${state.resolume.host}:${state.resolume.port}` : "Off";
            els.resolumeSummaryBtn.textContent = `Resolume Link: ${status}`;
            els.resolumeSummaryBtn.setAttribute("aria-expanded", resolumePanelOpen ? "true" : "false");
        }
        if (els.resolumeDetail) els.resolumeDetail.hidden = !resolumePanelOpen;
        if (els.resolumeEnabled) els.resolumeEnabled.checked = Boolean(state.resolume.enabled);
        if (els.resolumeHost && els.resolumeHost.value !== state.resolume.host) els.resolumeHost.value = state.resolume.host;
        if (els.resolumePort && Number(els.resolumePort.value) !== state.resolume.port) els.resolumePort.value = state.resolume.port;
        if (els.resolumeMatrixTrigger) els.resolumeMatrixTrigger.checked = Boolean(state.resolume.matrixTrigger);
        if (els.resolumeDeckTrigger) els.resolumeDeckTrigger.checked = Boolean(state.resolume.deckTrigger);
        if (els.resolumeDashboardPulse) els.resolumeDashboardPulse.checked = Boolean(state.resolume.dashboardPulse);
        if (els.resolumePulseAmount && Number(els.resolumePulseAmount.value) !== state.resolume.pulseAmount) {
            els.resolumePulseAmount.value = state.resolume.pulseAmount;
        }
        if (els.resolumePulseLength && Number(els.resolumePulseLength.value) !== state.resolume.pulseLengthMs) {
            els.resolumePulseLength.value = state.resolume.pulseLengthMs;
        }
        if (els.resolumePulseDebounce && Number(els.resolumePulseDebounce.value) !== state.resolume.pulseDebounceMs) {
            els.resolumePulseDebounce.value = state.resolume.pulseDebounceMs;
        }
        if (els.resolumeOscHost && els.resolumeOscHost.value !== state.resolume.oscHost) els.resolumeOscHost.value = state.resolume.oscHost;
        if (els.resolumeOscPort && Number(els.resolumeOscPort.value) !== state.resolume.oscPort) els.resolumeOscPort.value = state.resolume.oscPort;
        if (els.resolumeOscBridgeUrl && els.resolumeOscBridgeUrl.value !== state.resolume.oscBridgeUrl) {
            els.resolumeOscBridgeUrl.value = state.resolume.oscBridgeUrl;
        }
        els.resolumeClipTargetBtns.forEach((button) => {
            const target = parseResolumeClipTarget(button.dataset.resolumeClipTarget);
        const active = Boolean(target && state.resolume.oscTargets?.clipTargets?.[`layer${target.layer}`]?.[target.clip - 1]);
            button.classList.toggle("active", active);
        });
        setResolumeStatus(resolume?.lastStatus || "Resolume idle");
    }

    function toggleResolumeClipTarget(button) {
        const target = parseResolumeClipTarget(button.dataset.resolumeClipTarget);
        if (!target) return;
        state.resolume = normalizeResolumeConfig(state.resolume);
        const layerKey = `layer${target.layer}`;
        const clips = state.resolume.oscTargets.clipTargets[layerKey];
        clips[target.clip - 1] = !clips[target.clip - 1];
        resolume?.setConfig(state.resolume);
        applyResolumeToUI();
        saveState();
    }

    function resolumeClipTargetsFromUI() {
        const clipTargets = {
            layer1: Array(8).fill(false),
            layer2: Array(8).fill(false),
            layer3: Array(8).fill(false),
            layer4: Array(8).fill(false)
        };
        els.resolumeClipTargetBtns.forEach((button) => {
            const target = parseResolumeClipTarget(button.dataset.resolumeClipTarget);
            if (target) clipTargets[`layer${target.layer}`][target.clip - 1] = button.classList.contains("active");
        });
        return clipTargets;
    }

    function parseResolumeClipTarget(value) {
        const [layer, clip] = String(value || "").split(":").map(Number);
        if (!Number.isInteger(layer) || layer < 1 || layer > 4) return null;
        if (!Number.isInteger(clip) || clip < 1 || clip > 8) return null;
        return { layer, clip };
    }

    function clearCurrentSteps() {
        _stepHighlighted.forEach((el) => el.classList.remove("current"));
        _stepHighlighted.clear();
    }

    function markCurrentSteps() {
        if (!sequencer?.isRunning()) return;

        const currentDrumStep = sequencer.currentStep("drum");
        const currentBassStep = sequencer.currentStep("bass");
        const currentMelodyStep = sequencer.currentStep("melody");
        const currentOtherStep = sequencer.currentStep("other");

        if (Math.floor(currentDrumStep / 16) === state.drumPage) {
            for (let lane = 0; lane < DRUM_LANE_VOICE_OPTIONS.length; lane += 1) {
                const el = $(`#d-s-${lane}-${currentDrumStep % 16}`);
                if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
            }
        }
        if (Math.floor(currentBassStep / 64) === state.bassPage) {
            const el = $(`#b-s-${currentBassStep}`);
            if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
        }
        if (Math.floor(currentMelodyStep / 64) === state.melodyPage) {
            const el = $(`#m-s-${currentMelodyStep}`);
            if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
        }
        if (Math.floor(currentOtherStep / 64) === state.otherPage) {
            const el = $(`#o-s-${currentOtherStep}`);
            if (el) { el.classList.add("current"); _stepHighlighted.add(el); }
        }
    }

    function toggleMidiModal(show) {
        if (show) renderMidiUI();
        els.midiModal.classList.toggle("open", show);
        els.midiModal.setAttribute("aria-hidden", show ? "false" : "true");
        if (!show) {
            learningTrack = null;
            renderMidiUI();
        }
    }

    async function initMIDI() {
        if (!midi) {
            setMidiStatus("MIDI manager belum siap. Audio internal tetap aktif.");
            renderMidiUI();
            return;
        }

        const result = await midi.init();
        if (!result.ok && result.reason === "unsupported") {
            setMidiStatus("Web MIDI tidak tersedia di browser ini. Audio internal tetap aktif.");
            renderMidiUI();
            return;
        }

        if (result.ok) {
            syncMidiDevices();
            setMidiStatus("MIDI aktif. Pilih perangkat input/output, lalu gunakan Learn untuk mapping note.");
        } else {
            setMidiStatus("Izin MIDI ditolak atau perangkat tidak tersedia. Audio internal tetap aktif.");
        }

        renderMidiUI();
    }

    function handleMidiStateChange() {
        syncMidiDevices();
        renderMidiUI();
        setMidiStatus("MIDI device berubah. Routing diperbarui otomatis.");
    }

    function syncMidiDevices() {
        if (midi?.pruneMissingDevices(midiConfig)) saveMidi();
    }

    const _activeDecays = new Map();
    let _decayRafId = null;

    function _startDecayLoop() {
        if (_decayRafId) return;
        function tick() {
            const now = performance.now();
            _activeDecays.forEach((decay, paramName) => {
                const elapsed = now - decay.startTime;
                const t = Math.min(elapsed / decay.duration, 1);
                const current = decay.fromVal + (decay.toVal - decay.fromVal) * t;
                decay.apply(paramName, current);
                if (t >= 1) _activeDecays.delete(paramName);
            });
            if (_activeDecays.size > 0) {
                _decayRafId = requestAnimationFrame(tick);
            } else {
                _decayRafId = null;
            }
        }
        _decayRafId = requestAnimationFrame(tick);
    }

    function getParamDef(paramName) {
        const defs = shaderEngine?.getInputDefs?.() ?? [];
        return defs.find((d) => d.name === paramName) || { min: 0, max: 1 };
    }

    function setShaderParamImmediate(paramName, value) {
        if (!shaderEngine) return;
        shaderEngine.setParam(paramName, value);
        if (Array.isArray(value)) {
            const inp = getParamDef(paramName);
            const labels = inp?.type === 'color' ? ['R','G','B','A'] : ['X','Y'];
            const valEl = document.querySelector(`.shader-control-val[data-param="${paramName}"]`);
            if (valEl) valEl.textContent = value.map((v, k) => `${labels[k]}:${Number(v).toFixed(2)}`).join(' ');
            if (popupVisualActive) sendToPopupVisual({ type: 'param', name: paramName, value });
            return;
        }
        const valEl = document.querySelector(`.shader-control-val[data-param="${paramName}"]`);
        const ctrl = document.querySelector(`.dual-range-ctrl[data-param="${paramName}"]`);
        const curEl = ctrl?.querySelector(".dual-range-current");
        if (valEl) valEl.textContent = Number(value).toFixed(3);
        if (curEl) {
            const def = getParamDef(paramName);
            const pct = def.max !== def.min ? ((value - def.min) / (def.max - def.min)) * 100 : 0;
            curEl.style.left = Math.max(0, Math.min(100, pct)) + "%";
        }
        if (popupVisualActive) sendToPopupVisual({ type: 'param', name: paramName, value });
    }

    function decayParam(paramName, fromVal, toVal, duration = 200) {
        _activeDecays.delete(paramName);
        setShaderParamImmediate(paramName, fromVal);
        _activeDecays.set(paramName, {
            startTime: performance.now(),
            fromVal,
            toVal,
            duration,
            apply: (name, val) => setShaderParamImmediate(name, val),
        });
        _startDecayLoop();
    }

    function decayHydraParam(paramName, fromVal, toVal, duration = 200, reverse = false) {
        _activeDecays.delete(paramName);
        const actualFrom = reverse ? toVal : fromVal;
        const actualTo = reverse ? fromVal : toVal;
        setHydraParamImmediate(paramName, actualFrom);
        _activeDecays.set(paramName, {
            startTime: performance.now(),
            fromVal: actualFrom,
            toVal: actualTo,
            duration,
            apply: (name, val) => setHydraParamImmediate(name, val),
        });
        _startDecayLoop();
    }

    function handleMidiTrigger(paramName) {
        const mapping = midiConfig.shaderTriggers?.find((m) => m.paramName === paramName);
        if (!mapping) return;
        const isHydraParam = hydraParamDefs.some((d) => d.name === paramName);
        if (isHydraParam) {
            decayHydraParam(paramName, mapping.rangeMax, mapping.rangeStart, 200, mapping.reverse);
        } else {
            if (!shaderEngine) return;
            if (mapping.reverse) {
                decayParam(paramName, mapping.rangeStart, mapping.rangeMax, 200);
            } else {
                decayParam(paramName, mapping.rangeMax, mapping.rangeStart, 200);
            }
        }
    }

    function applyParamTriggers(source) {
        if (!midiConfig.shaderTriggers) return;
        midiConfig.shaderTriggers.forEach((m) => {
            if (m.source === source) {
                handleMidiTrigger(m.paramName);
            }
        });
    }

     let _midiClockTimes = [];
     let _midiClockBpm = 0;
     let _midiClockBpmTimer = null;

     function handleMidiMessage(inputID, data) {
        const [status, b1, b2] = data;
        const command = status & 0xf0;

        // MIDI Clock input
        if (status === 0xF8) {
            const now = performance.now();
            _midiClockTimes = _midiClockTimes.filter((t) => now - t < 2000);
            if (_midiClockTimes.length > 1) {
                const intervals = [];
                for (let i = 1; i < _midiClockTimes.length; i++) {
                    intervals.push(_midiClockTimes[i] - _midiClockTimes[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const bpm = 60000 / (avgInterval * 24);
                if (bpm >= 20 && bpm <= 999) {
                    _midiClockBpm = bpm;
                    if (midiConfig.syncSource === "midi-clock") {
                        setBpm(Math.round(bpm));
                    }
                }
            }
            _midiClockTimes.push(now);
            if (_midiClockTimes.length > 100) _midiClockTimes = _midiClockTimes.slice(-50);
            if (midiConfig.midiThrough && midiConfig.outputID) {
                midi?.sendRaw(midiConfig.outputID, data);
            }
            return;
        }

        // MIDI Start
        if (status === 0xFA) {
            if (midiConfig.syncSource === "midi-clock" && !sequencer?.isRunning()) {
                togglePlay();
            }
            if (midiConfig.midiThrough && midiConfig.outputID) {
                midi?.sendRaw(midiConfig.outputID, data);
            }
            return;
        }

        // MIDI Stop
        if (status === 0xFC) {
            if (midiConfig.syncSource === "midi-clock" && sequencer?.isRunning()) {
                togglePlay();
            }
            if (midiConfig.midiThrough && midiConfig.outputID) {
                midi?.sendRaw(midiConfig.outputID, data);
            }
            return;
        }

        // MIDI Continue
        if (status === 0xFB) {
            if (midiConfig.syncSource === "midi-clock" && !sequencer?.isRunning()) {
                togglePlay();
            }
            if (midiConfig.midiThrough && midiConfig.outputID) {
                midi?.sendRaw(midiConfig.outputID, data);
            }
            return;
        }

        // MIDI Through for non-clock messages
        if (midiConfig.midiThrough && midiConfig.outputID) {
            midi?.sendRaw(midiConfig.outputID, data);
        }

        if (command !== 0x90 || b2 === 0) return;

        const channel = (status & 0x0f) + 1;
        const note = b1;
        const velocity = b2;

        if (learningTrack !== null) {
            const track = getMidiTrack(learningTrack);
            if (track) {
                midiConfig.inputID = inputID;
                track.inputChannel = channel;
                if (track.type === "drum") {
                    track.inNote = note;
                }
            }
            learningTrack = null;
            saveMidi();
            renderMidiUI();
            return;
        }

        if (midiConfig.inputID && midiConfig.inputID !== inputID) return;
        midiConfig.tracks.forEach((track) => {
            if (!channelMatches(track.inputChannel, channel)) return;
            if (track.type === "bass") {
                triggerBass(midiNoteName(note), velocity);
                return;
            }
            if (track.type === "melody") {
                triggerMelody(midiNoteName(note), velocity);
                return;
            }
            if (track.type === "other") {
                triggerOther(midiNoteName(note), velocity);
                return;
            }
            if (track.inNote !== note) return;
            if (track.type === "drum") triggerDrum(track.drumIndex ?? drumIndexFromTrack(track.id), velocity);
        });
    }

    function renderMidiUI() {
        renderMidiPanel({
            deviceRouting: els.midiDeviceRouting,
            rows: els.midiRows,
            midi,
            midiConfig,
            learningTrack,
            setLearningTrack: (nextTrack) => {
                learningTrack = nextTrack;
                renderMidiUI();
            },
            saveMidi,
            triggerPreview,
            setMidiStatus
        });
    }

    function setMidiStatus(text) {
        if (els.midiStatus) els.midiStatus.textContent = text;
    }

    function clearHeldNotes(kind) {
        const kinds = kind ? [kind] : Object.keys(_heldNote);
        kinds.forEach((k) => {
            const held = _heldNote[k];
            if (held) {
                audio.releaseNote(k);
                sendMidiNoteOff(k, held.note);
                _heldNote[k] = null;
            }
        });
    }

    function panicMidi() {
        midi?.panic();
        midi?.stopClockStream();
        clearHeldNotes();
        setMidiStatus("Panic terkirim: All Notes Off ke semua output MIDI.");
    }

    function sendMidiOut(track, time) {
        const routing = getMidiTrack(`drum-${drumVoiceFromTrack(track)}`);
        if (!midi?.isReady() || !midiConfig.outputID || !routing) return;
        const doSend = () => midi.sendNotes(midiConfig.outputID, routing.outputChannel, routing.outNotes, 0x7f, 120);
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function sendBassMidi(noteName, velocity, time) {
        const routing = getMidiTrack("bass");
        if (!midi?.isReady() || !midiConfig.outputID) return;
        const note = clamp(noteNameToMidi(noteName) + routing.transpose, 0, 127);
        const vel = velocity ?? 0x65;
        const doSend = () => midi.sendNote(midiConfig.outputID, routing.outputChannel, note, vel, Math.max(90, stepDurationMs() * 0.82));
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function sendMelodyMidi(noteName, velocity, time) {
        const routing = getMidiTrack("melody");
        if (!midi?.isReady() || !midiConfig.outputID) return;
        const note = clamp(noteNameToMidi(noteName) + routing.transpose, 0, 127);
        const vel = velocity ?? 0x6f;
        const doSend = () => midi.sendNote(midiConfig.outputID, routing.outputChannel, note, vel, Math.max(120, stepDurationMs() * 1.2));
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function sendOtherMidi(noteName, velocity, time) {
        const routing = getMidiTrack("other");
        if (!midi?.isReady() || !midiConfig.outputID) return;
        const note = clamp(noteNameToMidi(noteName) + routing.transpose, 0, 127);
        const vel = velocity ?? 0x62;
        const doSend = () => midi.sendNote(midiConfig.outputID, routing.outputChannel, note, vel, Math.max(110, stepDurationMs()));
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function sendMidiNoteOn(kind, noteName, velocity, time) {
        const trackKey = { bass: "bass", melody: "melody", other: "other" }[kind];
        const routing = getMidiTrack(trackKey);
        if (!midi?.isReady() || !midiConfig.outputID || !routing) return;
        const note = clamp(noteNameToMidi(noteName) + routing.transpose, 0, 127);
        const vel = velocity ?? 0x65;
        const doSend = () => midi.sendNoteOn(midiConfig.outputID, routing.outputChannel, note, vel);
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function sendMidiNoteOff(kind, noteName, time) {
        const trackKey = { bass: "bass", melody: "melody", other: "other" }[kind];
        const routing = getMidiTrack(trackKey);
        if (!midi?.isReady() || !midiConfig.outputID || !routing) return;
        const note = clamp(noteNameToMidi(noteName) + routing.transpose, 0, 127);
        const doSend = () => midi.sendNoteOff(midiConfig.outputID, routing.outputChannel, note);
        if (time != null && audio?.ctx) {
            const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
            if (delay > 1) { setTimeout(doSend, delay); return; }
        }
        doSend();
    }

    function handleMatrixCommand(command, payload) {
        if (command === "switch-bank") {
            if (SEQUENCER_MODES.includes(payload?.kind)) state.mode = payload.kind;
            switchBank(Number(payload?.bank));
            return;
        }
        if (command === "switch-preset") {
            switchPreset(Number(payload?.slot), payload?.kind);
            return;
        }
        if (command === "switch-all-presets") {
            switchAllPresets(Number(payload?.slot));
            return;
        }
        if (command === "switch-multiple-presets") {
            switchMultiplePresets(Array.isArray(payload?.items) ? payload.items : []);
            return;
        }
        if (command === "switch-mode") {
            if (SEQUENCER_MODES.includes(payload?.kind)) switchMode(payload.kind);
            return;
        }
        if (command === "toggle-play") {
            togglePlay();
            return;
        }
        if (command === "bpm-delta") {
            setBpm(state.bpm + Number(payload?.value || 0));
            return;
        }
        if (command === "tap-tempo") {
            tapTempo();
            return;
        }
        if (command === "resync") {
            resyncTransport();
            return;
        }
        if (command === "nudge") {
            nudgeTempo(Number(payload?.value || 0));
            return;
        }
        if (command === "toggle-internal-audio") {
            toggleInternalAudio(payload?.kind);
            return;
        }
        if (command === "switch-sound") {
            const kind = payload?.kind;
            const style = payload?.style;
            if (kind === "drum") switchDrumSound(style);
            if (kind === "bass") switchBassSound(style);
            if (kind === "melody") switchMelodySound(style);
            if (kind === "other") switchOtherSound(style);
            return;
        }
        if (command === "sync") {
            syncMatrixState();
        }
    }

    function publicState() {
        return {
            mode: state.mode,
            bpm: state.bpm,
            trackRates: SEQUENCER_MODES.reduce((map, mode) => { map[mode] = trackRate(mode); return map; }, {}),
            transportRunning: Boolean(sequencer?.isRunning()),
            internalAudio: state.internalAudio,
            sounds: {
                drum: state.drumSound,
                bass: state.bassSound,
                melody: state.melodySound,
                other: state.otherSound
            },
            activeBanks: state.activeBanks,
            activeSlots: state.activeSlots
        };
    }

    function publicPerformanceState() {
        return {
            mode: state.mode,
            bpm: state.bpm,
            trackRates: SEQUENCER_MODES.reduce((map, mode) => { map[mode] = trackRate(mode); return map; }, {}),
            transportRunning: Boolean(sequencer?.isRunning()),
            internalAudio: {
                drum: state.internalAudio?.drum !== false,
                bass: state.internalAudio?.bass !== false,
                melody: state.internalAudio?.melody !== false,
                other: state.internalAudio?.other !== false
            },
            sounds: {
                drum: state.drumSound,
                bass: state.bassSound,
                melody: state.melodySound,
                other: state.otherSound
            },
            activeBanks: {
                drum: activeBankFor("drum"),
                bass: activeBankFor("bass"),
                melody: activeBankFor("melody"),
                other: activeBankFor("other")
            },
            activeSlots: {
                drum: activeSlotFor("drum"),
                bass: activeSlotFor("bass"),
                melody: activeSlotFor("melody"),
                other: activeSlotFor("other")
            }
        };
    }

    function setEngineState(text) {
        setEngineStateText(els.engineState, text);
    }

    function getMidiTrack(id) {
        return midiConfig.tracks.find((track) => track.id === id);
    }


    function performUndo() {
        if (!window.__aiBridge?.undo()) return;
        updateUndoButtons();
    }

    function performRedo() {
        if (!window.__aiBridge?.redo()) return;
        updateUndoButtons();
    }

    function updateUndoButtons() {
        const bridge = window.__aiBridge;
        if (els.undoBtn) els.undoBtn.disabled = !bridge?.canUndo();
        if (els.redoBtn) els.redoBtn.disabled = !bridge?.canRedo();
    }

    window.SyntetikaEngine = {
        getState: () => structuredClone(state),
        clearAll,
        randomize,
        switchMode,
        switchBank,
        switchPreset
    };

    window.SyntetikaEngineMatrix = {
        getState: () => structuredClone(publicPerformanceState()),
        command: handleMatrixCommand
    };

    window.AudioReactiveFX = window.SyntetikaEngine;
    window.AudioReactiveFXMatrix = window.SyntetikaEngineMatrix;

    await init();
})();
