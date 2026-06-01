import {
    SEQUENCER_MODES,
    BANK_COUNT,
    PRESET_COUNT,
    DRUM_TRACK_COUNT,
    activePattern as getActivePattern,
    setActivePattern as setActivePatternInStore,
    getLoopLength,
    setLoopLength as setLoopLengthInStore,
    setTrackRate as setTrackRateInStore,
} from "./pattern-store.js";
import { SCALE_DEFINITIONS, DRUM_RANDOM_GENRES, PITCH_GENERATOR_STYLES, PITCH_GENERATOR_ROLES, PITCH_GENERATOR_MODES, MIDI_NOTE_NAMES } from "./constants.js";
import { clamp, noteNameToMidi, midiNoteName, isNoteName } from "./utils.js";

export const ACTIONS = {
    SET_BPM: "set-bpm",
    SET_MODE: "set-mode",
    GENERATE: "generate",
    SWITCH_BANK: "switch-bank",
    SWITCH_PRESET: "switch-preset",
    SWITCH_ALL_PRESETS: "switch-all-presets",
    SET_LOOP_LENGTH: "set-loop-length",
    SET_TRACK_RATE: "set-track-rate",
    SET_SCALE: "set-scale",
    SET_ROOT: "set-root",
    SET_DRUM_GENRE: "set-drum-genre",
    SET_SOUND: "set-sound",
    SET_MIXER: "set-mixer",
    CLEAR_PATTERN: "clear-pattern",
    TOGGLE_PLAY: "toggle-play",
    TOGGLE_INTERNAL_AUDIO: "toggle-internal-audio",
    GENERATE_DRUM: "generate-drum",
    APPLY_PITCH_STYLE: "apply-pitch-style",
    SHIFT_PITCH: "shift-pitch",
    SET_DRUM_VOICE: "set-drum-voice",
    SET_SELECTED_NOTE: "set-selected-note",
    COMPOSE: "compose",
};

export class AIBridge {
    constructor({ state, randomizer, audio, sequencer, commit } = {}) {
        if (!state) throw new Error("AIBridge: state is required");
        this.state = state;
        this.randomizer = randomizer;
        this.audio = audio;
        this.sequencer = sequencer;
        this.commit = commit || (() => {});

        this.undoStack = [];
        this.redoStack = [];
        this.maxUndo = 30;

        this._onChangeCallbacks = [];
        this._onActionCallbacks = [];
        this._onErrorCallbacks = [];
    }

    // ── Snapshot ──────────────────────────────────────

    getSnapshot() {
        const s = this.state;
        const playing = this.sequencer?.isRunning() ?? false;
        const currentSteps = this.sequencer?.steps ? { ...this.sequencer.steps } : {};

        return {
            transport: {
                bpm: s.bpm,
                playing,
                currentSteps,
                stepDurationMs: this.sequencer?.stepDurationMs() ?? (60000 / s.bpm) / 4,
                mode: s.mode,
            },
            scale: {
                id: s.noteScale,
                root: s.noteRoot,
                definition: SCALE_DEFINITIONS.find((sc) => sc.id === s.noteScale) || null,
            },
            drumGenre: s.drumRandomGenre,
            activeBanks: { ...s.activeBanks },
            activeSlots: { ...s.activeSlots },
            mixer: { ...s.mixer },
            sounds: {
                drum: s.drumSound,
                bass: s.bassSound,
                melody: s.melodySound,
                other: s.otherSound,
            },
            generator: {
                modes: { ...s.pitchGeneratorModes },
                roles: { ...s.pitchGeneratorRoles },
                styles: { ...s.pitchGeneratorStyles },
            },
            randomRole: s.randomRole,
            internalAudio: { ...s.internalAudio },
            patterns: this.getPatternSummary(),
            visual: {
                activeShaderId: s.activeShaderId,
            },
        };
    }

    getPatternSummary() {
        const summary = {};
        for (const kind of SEQUENCER_MODES) {
            const pattern = getActivePattern(this.state, kind);
            if (!pattern) {
                summary[kind] = null;
                continue;
            }
            const loopLen = getLoopLength(this.state, kind);
            if (kind === "drum") {
                const activeCount = pattern.reduce((sum, track) => sum + track.slice(0, loopLen).filter(Boolean).length, 0);
                const banks = this.state.activeBanks?.drum ?? 0;
                const slots = this.state.activeSlots?.drum ?? 0;
                summary[kind] = {
                    type: "drum",
                    tracks: DRUM_TRACK_COUNT,
                    steps: pattern[0]?.length || 0,
                    loopLength: loopLen,
                    activeSteps: activeCount,
                    density: loopLen > 0 ? (activeCount / (DRUM_TRACK_COUNT * loopLen)) : 0,
                    location: `B${banks + 1}P${slots + 1}`,
                };
            } else {
                const activeSteps = pattern.slice(0, loopLen).filter((c) => c?.active).length;
                const banks = this.state.activeBanks?.[kind] ?? 0;
                const slots = this.state.activeSlots?.[kind] ?? 0;
                summary[kind] = {
                    type: "note",
                    steps: pattern.length,
                    loopLength: loopLen,
                    activeSteps,
                    density: loopLen > 0 ? (activeSteps / loopLen) : 0,
                    location: `B${banks + 1}P${slots + 1}`,
                };
            }
        }
        return summary;
    }

    describe(path) {
        if (path === "bpm") return `${this.state.bpm} BPM`;
        if (path === "mode") return this.state.mode;
        if (path === "scale") {
            const sc = SCALE_DEFINITIONS.find((s) => s.id === this.state.noteScale);
            return `${sc?.label || "Chromatic"} (${this.state.noteRoot})`;
        }
        if (path === "drumGenre") {
            const g = DRUM_RANDOM_GENRES.find((x) => x.id === this.state.drumRandomGenre);
            return g?.label || "Default";
        }
        if (path.startsWith("pattern/")) {
            const kind = path.split("/")[1];
            const sum = this.getPatternSummary()[kind];
            if (!sum) return `No pattern for ${kind}`;
            return `${kind}: ${sum.activeSteps} active steps (${(sum.density * 100).toFixed(0)}% density) at ${sum.location}`;
        }
        if (path.startsWith("mixer/")) {
            const kind = path.split("/")[1];
            return `${this.state.mixer?.[kind] ?? 0}%`;
        }
        if (path === "generator") {
            const mode = this.state.mode;
            const gMode = this.state.pitchGeneratorModes?.[mode] || "explore";
            const gRole = this.state.pitchGeneratorRoles?.[mode] || "bass";
            const gStyle = this.state.pitchGeneratorStyles?.[mode] || "root-pulse";
            return `${gMode} / ${gRole} / ${gStyle}`;
        }
        return path;
    }

    // ── Undo / Redo ───────────────────────────────────

    _saveUndo() {
        this.undoStack.push({ state: JSON.parse(JSON.stringify(this.state)) });
        if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
        this.redoStack = [];
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    undo() {
        if (!this.undoStack.length) return false;
        this.redoStack.push({ state: JSON.parse(JSON.stringify(this.state)) });
        const prev = this.undoStack.pop();
        Object.assign(this.state, prev.state);
        this.commit();
        this._emitChange("undo");
        return true;
    }

    redo() {
        if (!this.redoStack.length) return false;
        this.undoStack.push({ state: JSON.parse(JSON.stringify(this.state)) });
        const next = this.redoStack.pop();
        Object.assign(this.state, next.state);
        this.commit();
        this._emitChange("redo");
        return true;
    }

    // ── Execute ───────────────────────────────────────

    execute(action) {
        const handler = this._getHandler(action.type);
        if (!handler) {
            this._emitError(action, new Error(`Unknown action type: ${action.type}`));
            return { ok: false, error: `Unknown action type: ${action.type}` };
        }
        try {
            this._saveUndo();
            handler.call(this, action);
            this.commit();
            this._emitAction(action);
            this._emitChange("action", action);
            return { ok: true };
        } catch (err) {
            this._emitError(action, err);
            return { ok: false, error: err.message };
        }
    }

    executeBatch(actions) {
        if (!Array.isArray(actions) || !actions.length) return { ok: false, error: "empty batch" };
        const results = [];
        this._saveUndo();
        for (const action of actions) {
            const handler = this._getHandler(action.type);
            if (!handler) {
                this._emitError(action, new Error(`Unknown action type: ${action.type}`));
                results.push({ ok: false, error: `Unknown action type: ${action.type}`, action });
                continue;
            }
            try {
                handler.call(this, action);
                this._emitAction(action);
                results.push({ ok: true, action });
            } catch (err) {
                this._emitError(action, err);
                results.push({ ok: false, error: err.message, action });
            }
        }
        this.commit();
        this._emitChange("batch", actions);
        return { ok: results.every((r) => r.ok), results };
    }

    _getHandler(type) {
        const handlers = {
            [ACTIONS.SET_BPM]: this._handleSetBpm,
            [ACTIONS.SET_MODE]: this._handleSetMode,
            [ACTIONS.GENERATE]: this._handleGenerate,
            [ACTIONS.SWITCH_BANK]: this._handleSwitchBank,
            [ACTIONS.SWITCH_PRESET]: this._handleSwitchPreset,
            [ACTIONS.SWITCH_ALL_PRESETS]: this._handleSwitchAllPresets,
            [ACTIONS.SET_LOOP_LENGTH]: this._handleSetLoopLength,
            [ACTIONS.SET_TRACK_RATE]: this._handleSetTrackRate,
            [ACTIONS.SET_SCALE]: this._handleSetScale,
            [ACTIONS.SET_ROOT]: this._handleSetRoot,
            [ACTIONS.SET_DRUM_GENRE]: this._handleSetDrumGenre,
            [ACTIONS.SET_SOUND]: this._handleSetSound,
            [ACTIONS.SET_MIXER]: this._handleSetMixer,
            [ACTIONS.CLEAR_PATTERN]: this._handleClearPattern,
            [ACTIONS.TOGGLE_PLAY]: this._handleTogglePlay,
            [ACTIONS.TOGGLE_INTERNAL_AUDIO]: this._handleToggleInternalAudio,
            [ACTIONS.GENERATE_DRUM]: this._handleGenerateDrum,
            [ACTIONS.APPLY_PITCH_STYLE]: this._handleApplyPitchStyle,
            [ACTIONS.SHIFT_PITCH]: this._handleShiftPitch,
            [ACTIONS.SET_DRUM_VOICE]: this._handleSetDrumVoice,
            [ACTIONS.SET_SELECTED_NOTE]: this._handleSetSelectedNote,
        };
        return handlers[type];
    }

    _handleSetBpm(action) {
        this.state.bpm = clamp(Math.round(Number(action.bpm) || this.state.bpm), 60, 220);
    }

    _handleSetMode(action) {
        if (SEQUENCER_MODES.includes(action.mode)) {
            this.state.mode = action.mode;
        }
    }

    _handleGenerate(action) {
        if (!this.randomizer) return;
        const kind = action.mode || this.state.mode;
        const pattern = getActivePattern(this.state, kind);
        if (!pattern) return;
        this.randomizer.apply({
            mode: kind,
            role: action.role || this.state.randomRole,
            pattern,
            loopLength: getLoopLength(this.state, kind),
            scale: SCALE_DEFINITIONS.find((s) => s.id === (action.scale || this.state.noteScale)),
            root: action.root || this.state.noteRoot,
            drumGenre: action.drumGenre || this.state.drumRandomGenre,
            genre: action.drumGenre || this.state.drumRandomGenre,
            generatorMode: action.generatorMode || this.state.pitchGeneratorModes[kind === "drum" ? "bass" : kind],
            generatorRole: action.generatorRole || this.state.pitchGeneratorRoles[kind === "drum" ? "bass" : kind],
            generatorStyle: action.generatorStyle || this.state.pitchGeneratorStyles[kind === "drum" ? "bass" : kind],
        });
        setActivePatternInStore(this.state, kind, pattern);
    }

    _handleSwitchBank(action) {
        const mode = action.mode || this.state.mode;
        const bank = clamp(Number(action.bank), 0, BANK_COUNT - 1);
        this.state.activeBanks[mode] = bank;
    }

    _handleSwitchPreset(action) {
        const mode = action.mode || this.state.mode;
        const slot = clamp(Number(action.slot), 0, PRESET_COUNT - 1);
        this.state.activeSlots[mode] = slot;
    }

    _handleSwitchAllPresets(action) {
        const slot = clamp(Number(action.slot), 0, PRESET_COUNT - 1);
        for (const mode of SEQUENCER_MODES) {
            this.state.activeSlots[mode] = slot;
        }
    }

    _handleSetLoopLength(action) {
        const mode = action.mode || this.state.mode;
        const allowed = mode === "drum" ? [16, 32, 64] : [64, 128, 256];
        const length = allowed.includes(Number(action.length)) ? Number(action.length) : (mode === "drum" ? 16 : 64);
        setLoopLengthInStore(this.state, mode, length);
    }

    _handleSetTrackRate(action) {
        const mode = action.mode || this.state.mode;
        const rate = [0.5, 1, 2].includes(Number(action.rate)) ? Number(action.rate) : 1;
        setTrackRateInStore(this.state, mode, rate);
    }

    _handleSetScale(action) {
        if (SCALE_DEFINITIONS.some((s) => s.id === action.scaleId)) {
            this.state.noteScale = action.scaleId;
        }
    }

    _handleSetRoot(action) {
        if (MIDI_NOTE_NAMES.includes(action.root)) {
            this.state.noteRoot = action.root;
        }
    }

    _handleSetDrumGenre(action) {
        if (DRUM_RANDOM_GENRES.some((g) => g.id === action.genre)) {
            this.state.drumRandomGenre = action.genre;
        }
    }

    _handleSetSound(action) {
        const validSounds = {
            drum: ["default", "glitch", "noise", "abstract"],
            bass: ["hard-bass", "sub", "lead", "pad"],
            melody: ["vintage", "glass", "lead", "pad"],
            other: ["bass", "lead", "stab", "fx"],
        };
        const kind = action.mode || this.state.mode;
        const options = validSounds[kind];
        if (options && options.includes(action.sound)) {
            this.state[`${kind}Sound`] = action.sound;
        }
    }

    _handleSetMixer(action) {
        const mode = action.mode;
        if (SEQUENCER_MODES.includes(mode)) {
            this.state.mixer[mode] = clamp(Math.round(Number(action.level) || 0), 0, 100);
        }
    }

    _handleClearPattern(action) {
        const modes = action.mode ? [action.mode] : SEQUENCER_MODES;
        for (const kind of modes) {
            const pattern = getActivePattern(this.state, kind);
            if (!pattern) continue;
            if (kind === "drum") {
                for (let t = 0; t < pattern.length; t++) {
                    for (let s = 0; s < pattern[t].length; s++) pattern[t][s] = false;
                }
            } else {
                const defaultNote = kind === "bass" ? "C1" : "C2";
                for (let s = 0; s < pattern.length; s++) {
                    pattern[s] = { active: false, note: defaultNote };
                }
            }
            setActivePatternInStore(this.state, kind, pattern);
        }
    }

    _handleTogglePlay() {
        this._emitAction({ type: "toggle-play" });
    }

    _handleToggleInternalAudio(action) {
        const mode = action.mode;
        if (SEQUENCER_MODES.includes(mode) && typeof action.enabled === "boolean") {
            this.state.internalAudio[mode] = action.enabled;
        }
    }

    _handleGenerateDrum(action) {
        if (!this.randomizer) return;
        const pattern = getActivePattern(this.state, "drum");
        if (!pattern) return;
        const genre = DRUM_RANDOM_GENRES.some((g) => g.id === action.genre) ? action.genre : this.state.drumRandomGenre;
        this.randomizer.apply({
            mode: "drum",
            role: "generate",
            pattern,
            loopLength: getLoopLength(this.state, "drum"),
            drumGenre: genre,
        });
        setActivePatternInStore(this.state, "drum", pattern);
    }

    _handleApplyPitchStyle(action) {
        const kind = action.mode || this.state.mode;
        if (kind === "drum") return;
        if (action.generatorMode && PITCH_GENERATOR_MODES.includes(action.generatorMode)) {
            this.state.pitchGeneratorModes[kind] = action.generatorMode;
        }
        if (action.generatorRole && PITCH_GENERATOR_ROLES.includes(action.generatorRole)) {
            this.state.pitchGeneratorRoles[kind] = action.generatorRole;
            const styles = PITCH_GENERATOR_STYLES[action.generatorRole];
            if (styles && !styles.includes(this.state.pitchGeneratorStyles[kind])) {
                this.state.pitchGeneratorStyles[kind] = styles[0];
            }
        }
        if (action.generatorStyle) {
            const role = action.generatorRole || this.state.pitchGeneratorRoles[kind];
            const styles = PITCH_GENERATOR_STYLES[role];
            if (styles && styles.includes(action.generatorStyle)) {
                this.state.pitchGeneratorStyles[kind] = action.generatorStyle;
            }
        }
    }

    _handleShiftPitch(action) {
        const kind = action.mode || this.state.mode;
        if (kind === "drum") return;
        const pattern = getActivePattern(this.state, kind);
        if (!pattern) return;
        const semitones = Number(action.semitones) || 0;
        for (const step of pattern) {
            if (!step || !isNoteName(step.note)) continue;
            step.note = midiNoteName(clamp(noteNameToMidi(step.note) + semitones, 0, 127));
        }
        setActivePatternInStore(this.state, kind, pattern);
    }

    _handleSetDrumVoice(action) {
        const lane = Number(action.lane);
        if (lane < 0 || lane > 3) return;
        const options = [
            ["kick"],
            ["snare", "clap"],
            ["tom-hi", "tom-lo"],
            ["hat-close", "hat-open"],
        ];
        if (options[lane].includes(action.voice)) {
            this.state.drumVoices[lane] = action.voice;
        }
    }

    _handleSetSelectedNote(action) {
        const kind = action.mode || this.state.mode;
        if (kind === "drum") return;
        const pattern = getActivePattern(this.state, kind);
        if (!pattern) return;
        const step = Number(action.step);
        if (!Number.isInteger(step) || step < 0 || step >= pattern.length) return;
        const note = action.note;
        if (!isNoteName(note)) return;
        pattern[step] = {
            active: action.active !== undefined ? Boolean(action.active) : pattern[step]?.active !== false,
            note,
        };
        setActivePatternInStore(this.state, kind, pattern);
    }

    // ── Preview ───────────────────────────────────────

    previewNote(kind, value) {
        if (!this.audio) return;
        try {
            if (kind === "drum") {
                const track = Number(value);
                const voice = ["kick", "snare", "clap", "tom-hi", "tom-lo", "hat-close", "hat-open"][track] || "kick";
                this.audio.playDrum(voice, this.state.drumSound);
            } else if (kind === "bass") {
                this.audio.playBass(value, this.state.bassSound);
            } else if (kind === "melody") {
                this.audio.playMelody(value, this.state.melodySound);
            } else if (kind === "other") {
                this.audio.playOther(value, this.state.otherSound);
            }
        } catch {
        }
    }

    // ── Events ────────────────────────────────────────

    onChange(callback) { this._onChangeCallbacks.push(callback); return this; }

    onAction(callback) { this._onActionCallbacks.push(callback); return this; }

    onError(callback) { this._onErrorCallbacks.push(callback); return this; }

    _emitChange(type, action) {
        const snapshot = this.getSnapshot();
        for (const cb of this._onChangeCallbacks) {
            try { cb(type, snapshot, action); } catch {}
        }
    }

    _emitAction(action) {
        for (const cb of this._onActionCallbacks) {
            try { cb(action); } catch {}
        }
    }

    _emitError(action, error) {
        for (const cb of this._onErrorCallbacks) {
            try { cb(action, error); } catch {}
        }
    }
}
