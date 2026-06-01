import { clamp, isNoteName } from "./utils.js";
import { DRUM_VOICE_ORDER } from "./constants.js";

export const SEQUENCER_MODES = ["drum", "bass", "melody", "other"];
export const DRUM_SOUND_STYLES = ["default", "glitch", "noise", "abstract"];
export const BASS_SOUND_STYLES = ["hard-bass", "sub", "lead", "pad"];
export const MELODY_SOUND_STYLES = ["vintage", "glass", "lead", "pad"];
export const OTHER_SOUND_STYLES = ["bass", "lead", "stab", "fx"];
export { DRUM_VOICE_ORDER } from "./constants.js";

// Maps new hardware-aware style names to existing audio synthesis engines
export function resolveSoundStyle(mode, style) {
    const modeAliases = {
        bass: { "hard-bass": "default", "sub": "sub", "lead": "acid", "pad": "pluck" },
        melody: { "vintage": "default", "glass": "bell", "lead": "lead", "pad": "pad" },
        other: { "bass": "moog", "lead": "plucky", "stab": "stabby", "fx": "fm" },
    };
    const aliases = modeAliases[mode];
    if (aliases && aliases[style]) return aliases[style];
    return style;
}
export const BANK_COUNT = 8;
export const PRESET_COUNT = 8;
export const DRUM_STEP_COUNT = 64;
export const NOTE_STEP_COUNT = 256;
export const DRUM_TRACK_COUNT = DRUM_VOICE_ORDER.length;

export function createEmptyMemory() {
    return {
        drum: Array.from({ length: BANK_COUNT }, () => Array.from({ length: PRESET_COUNT }, () => Array.from({ length: DRUM_TRACK_COUNT }, () => Array(DRUM_STEP_COUNT).fill(false)))),
        bass: Array.from({ length: BANK_COUNT }, () => Array.from({ length: PRESET_COUNT }, () => Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C1" })))),
        melody: Array.from({ length: BANK_COUNT }, () => Array.from({ length: PRESET_COUNT }, () => Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C2" })))),
        other: Array.from({ length: BANK_COUNT }, () => Array.from({ length: PRESET_COUNT }, () => Array.from({ length: NOTE_STEP_COUNT }, () => ({ active: false, note: "C2" }))))
    };
}

export function normalizeMemory(memory) {
    const clean = createEmptyMemory();
    if (!memory) return clean;
    const isLegacySlotMemory = Array.isArray(memory.drum?.[0]?.[0]) && typeof memory.drum?.[0]?.[0]?.[0] === "boolean";
    const isLegacyBankMemory = !isLegacySlotMemory && Array.isArray(memory.drum?.[0]?.[0]) && memory.drum[0][0].length < DRUM_TRACK_COUNT;

    for (let bank = 0; bank < BANK_COUNT; bank += 1) {
        for (let slot = 0; slot < PRESET_COUNT; slot += 1) {
            for (let track = 0; track < DRUM_TRACK_COUNT; track += 1) {
                for (let step = 0; step < DRUM_STEP_COUNT; step += 1) {
                    const sourceTrack = legacyDrumTrack(track);
                    clean.drum[bank][slot][track][step] = Boolean(isLegacySlotMemory
                        ? memory.drum?.[slot]?.[sourceTrack]?.[step]
                        : isLegacyBankMemory
                            ? memory.drum?.[bank]?.[slot]?.[sourceTrack]?.[step]
                            : memory.drum?.[bank]?.[slot]?.[track]?.[step]);
                }
            }
            for (let step = 0; step < NOTE_STEP_COUNT; step += 1) {
                const saved = isLegacySlotMemory
                    ? memory.bass?.[slot]?.[step]
                    : memory.bass?.[bank]?.[slot]?.[step];
                clean.bass[bank][slot][step] = {
                    active: Boolean(saved?.active),
                    note: isNoteName(saved?.note) ? saved.note : "C1"
                };
                const savedMelody = isLegacySlotMemory
                    ? memory.melody?.[slot]?.[step]
                    : memory.melody?.[bank]?.[slot]?.[step];
                clean.melody[bank][slot][step] = {
                    active: Boolean(savedMelody?.active),
                    note: isNoteName(savedMelody?.note) ? savedMelody.note : "C2"
                };
                const savedOther = isLegacySlotMemory
                    ? memory.other?.[slot]?.[step]
                    : memory.other?.[bank]?.[slot]?.[step];
                clean.other[bank][slot][step] = {
                    active: Boolean(savedOther?.active),
                    note: isNoteName(savedOther?.note) ? savedOther.note : "C2"
                };
            }
        }
        if (isLegacySlotMemory) break;
    }
    return clean;
}

function legacyDrumTrack(track) {
    return [0, 1, -1, -1, -1, 2, 3][track] ?? track;
}

export function createSelectorMap(value) {
    return SEQUENCER_MODES.reduce((map, mode) => {
        map[mode] = value;
        return map;
    }, {});
}

export function normalizeSelectorMap(savedMap, legacyValue, max) {
    const legacy = Number.isInteger(legacyValue) ? clamp(legacyValue, 0, max - 1) : 0;
    return SEQUENCER_MODES.reduce((map, mode) => {
        const savedValue = savedMap?.[mode];
        map[mode] = Number.isInteger(savedValue) ? clamp(savedValue, 0, max - 1) : legacy;
        return map;
    }, {});
}

export function createBooleanMap(value) {
    return SEQUENCER_MODES.reduce((map, mode) => {
        map[mode] = Boolean(value);
        return map;
    }, {});
}

export function normalizeBooleanMap(savedMap, defaults) {
    return SEQUENCER_MODES.reduce((map, mode) => {
        map[mode] = typeof savedMap?.[mode] === "boolean" ? savedMap[mode] : defaults[mode];
        return map;
    }, {});
}

export function activePattern(state, kind) {
    return state.memory[kind][activeBankFor(state, kind)][activeSlotFor(state, kind)];
}

export function setActivePattern(state, kind, pattern) {
    state.memory[kind][activeBankFor(state, kind)][activeSlotFor(state, kind)] = pattern;
}

export function getLoopLength(state, kind) {
    const bank = activeBankFor(state, kind);
    const slot = activeSlotFor(state, kind);
    const val = state.presetLoopLengths?.[kind]?.[bank]?.[slot];
    const defaultVal = kind === "drum" ? 16 : 64;
    return (kind === "drum" ? [16, 32, 64] : [16, 32, 64, 128, 256]).includes(val) ? val : defaultVal;
}

export function setLoopLength(state, kind, value) {
    const bank = activeBankFor(state, kind);
    const slot = activeSlotFor(state, kind);
    state.presetLoopLengths[kind][bank][slot] = value;
}

export function getTrackRate(state, kind) {
    const bank = activeBankFor(state, kind);
    const slot = activeSlotFor(state, kind);
    const rate = state.presetTrackRates?.[kind]?.[bank]?.[slot];
    return [0.5, 1, 2].includes(rate) ? rate : 1;
}

export function setTrackRate(state, kind, value) {
    const bank = activeBankFor(state, kind);
    const slot = activeSlotFor(state, kind);
    state.presetTrackRates[kind][bank][slot] = value;
}

export function activeBankFor(state, kind = state.mode) {
    return safeSelectorValue(state.activeBanks?.[kind], BANK_COUNT);
}

export function activeSlotFor(state, kind = state.mode) {
    return safeSelectorValue(state.activeSlots?.[kind], PRESET_COUNT);
}

function safeSelectorValue(value, max) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(Math.trunc(number), 0, max - 1) : 0;
}
