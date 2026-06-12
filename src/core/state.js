import {
    DEFAULT_DRUM_VOICES,
    DRUM_LANE_VOICE_OPTIONS,
    DRUM_RANDOM_GENRES,
    MIDI_NOTE_NAMES,
    PITCH_GENERATOR_MODES,
    PITCH_GENERATOR_ROLES,
    PITCH_GENERATOR_STYLES,
    SCALE_DEFINITIONS,
    STORAGE_KEY
} from "./constants.js";
import { clamp } from "./utils.js";
import {
    BANK_COUNT,
    BASS_SOUND_STYLES,
    DRUM_SOUND_STYLES,
    MELODY_SOUND_STYLES,
    OTHER_SOUND_STYLES,
    PRESET_COUNT,
    SEQUENCER_MODES,
    createBooleanMap,
    createEmptyMemory,
    createSelectorMap,
    normalizeBooleanMap,
    normalizeMemory,
    normalizeSelectorMap,
    resolveLegacySoundStyle
} from "./pattern-store.js";
import { createResolumeConfigDefaults, normalizeResolumeConfig } from "./resolume.js";

export function loadState() {
    try {
        return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
        return normalizeState(null);
    }
}

const STATE_KEYS = new Set([
    "bpm","mode","uiMode","internalAudio","presetTrackRates","mixer",
    "drumSound","bassSound","melodySound","otherSound",
    "activeBanks","activeSlots","presetLoopLengths",
    "drumPage","drumFollowPage","drumVoices",
    "bassPage","bassFollowPage","melodyPage","melodyFollowPage",
    "otherPage","otherFollowPage",
    "editMode","melodyEditMode","otherEditMode",
    "tieMode","drumRandomGenre","noteScale","noteRoot",
    "notePickerOctaves","randomRole",
    "pitchGeneratorModes","pitchGeneratorRoles","pitchGeneratorStyles",
    "resolume","memory",
        "activeShaderId","visualPresets","visualEnabled","visualAspect","visualAspectWidth","visualAspectHeight",
        "canvasWidth","canvasHeight",
        "visualMode","projectName"
]);

export function normalizeState(saved) {
    const defaults = {
        bpm: 120,
        mode: "drum",
        uiMode: "edit",
        internalAudio: createBooleanMap(true),
        presetTrackRates: createPresetTrackRates(),
        mixer: createMixerDefaults(),
        drumSound: "default",
        bassSound: "default",
        melodySound: "default",
        otherSound: "moog",
        activeBanks: createSelectorMap(0),
        activeSlots: createSelectorMap(0),
        presetLoopLengths: createPresetLoopLengths(),
        drumPage: 0,
        drumFollowPage: true,
        drumVoices: [...DEFAULT_DRUM_VOICES],
        bassPage: 0,
        bassFollowPage: true,
        melodyPage: 0,
        melodyFollowPage: true,
        otherPage: 0,
        otherFollowPage: true,
        editMode: false,
        melodyEditMode: false,
        otherEditMode: false,
        tieMode: { bass: false, melody: false, other: false },
        drumRandomGenre: "default",
        noteScale: "chromatic",
        noteRoot: "C",
        notePickerOctaves: createNotePickerOctaves(),
        randomRole: "generate",
        pitchGeneratorModes: createPitchGeneratorModeMap(),
        pitchGeneratorRoles: createPitchGeneratorRoleMap(),
        pitchGeneratorStyles: createPitchGeneratorStyleMap(),
        resolume: createResolumeConfigDefaults(),
        memory: createEmptyMemory(),
        projectName: "Untitled"
    };

    const shaderDefaults = {
        activeShaderId: null,
        visualPresets: Array.from({ length: 8 }, () => null),
        visualEnabled: true,
        visualAspect: "fill",
        visualAspectWidth: 1920,
        visualAspectHeight: 1080,
        canvasWidth: 0,
        canvasHeight: 0,
        visualMode: "hydra",
    };

    if (!saved || typeof saved !== "object") return { ...defaults, ...shaderDefaults };

    // First pass: normalize bank/slot selectors and memory
    const activeBanks = normalizeSelectorMap(saved.activeBanks, saved.activeBank, BANK_COUNT);
    const activeSlots = normalizeSelectorMap(saved.activeSlots, saved.activeSlot, PRESET_COUNT);
    const memory = normalizeMemory(saved.memory);

    // Per-preset loop lengths with legacy migration from old global keys
    const hasLegacyLoops = "drumLoopLen" in saved || "bassLoopLen" in saved;
    const presetLoopLengths = createPresetLoopLengths();
    SEQUENCER_MODES.forEach((mode) => {
        const allowed = mode === "drum" ? [16, 32, 64] : [16, 32, 64, 128, 256];
        const defaultVal = mode === "drum" ? 16 : 64;
        for (let bank = 0; bank < BANK_COUNT; bank += 1) {
            for (let slot = 0; slot < PRESET_COUNT; slot += 1) {
                let value;
                if (saved.presetLoopLengths?.[mode]?.[bank]?.[slot] !== undefined) {
                    value = saved.presetLoopLengths[mode][bank][slot];
                } else if (hasLegacyLoops) {
                    const key = mode === "drum" ? "drumLoopLen" : `${mode}LoopLen`;
                    value = saved[key];
                }
                presetLoopLengths[mode][bank][slot] = allowed.includes(value) ? value : defaultVal;
            }
        }
    });

    // Per-preset track rates with legacy migration
    const hasLegacyRates = "trackRates" in saved;
    const presetTrackRates = createPresetTrackRates();
    SEQUENCER_MODES.forEach((mode) => {
        for (let bank = 0; bank < BANK_COUNT; bank += 1) {
            for (let slot = 0; slot < PRESET_COUNT; slot += 1) {
                let value;
                if (saved.presetTrackRates?.[mode]?.[bank]?.[slot] !== undefined) {
                    value = saved.presetTrackRates[mode][bank][slot];
                } else if (hasLegacyRates) {
                    value = saved.trackRates?.[mode];
                }
                presetTrackRates[mode][bank][slot] = [0.5, 1, 2].includes(value) ? value : 1;
            }
        }
    });

    // Compute page loop lengths from the active preset
    const drumLoopForPage = presetLoopLengths.drum[activeBanks.drum][activeSlots.drum];
    const bassLoopForPage = presetLoopLengths.bass[activeBanks.bass][activeSlots.bass];
    const melodyLoopForPage = presetLoopLengths.melody[activeBanks.melody][activeSlots.melody];
    const otherLoopForPage = presetLoopLengths.other[activeBanks.other][activeSlots.other];

    return {
        ...defaults,
        // Only spread known keys from saved (ignore legacy keys that accumulated)
        ...Object.fromEntries(
            Object.entries(saved).filter(([key]) => STATE_KEYS.has(key))
        ),
        // Override spread with properly normalized values
        presetLoopLengths,
        presetTrackRates,
        activeBanks,
        activeSlots,
        memory,
        uiMode: ["edit", "performance"].includes(saved.uiMode) ? saved.uiMode : defaults.uiMode,
        internalAudio: normalizeBooleanMap(saved.internalAudio, defaults.internalAudio),
        mixer: normalizeMixer(saved.mixer, defaults.mixer),
        drumSound: DRUM_SOUND_STYLES.includes(saved.drumSound) ? saved.drumSound : defaults.drumSound,
        bassSound: BASS_SOUND_STYLES.includes(saved.bassSound) ? saved.bassSound : (
            BASS_SOUND_STYLES.includes(resolveLegacySoundStyle("bass", saved.bassSound))
            ? resolveLegacySoundStyle("bass", saved.bassSound)
            : defaults.bassSound
        ),
        melodySound: MELODY_SOUND_STYLES.includes(saved.melodySound) ? saved.melodySound : (
            MELODY_SOUND_STYLES.includes(resolveLegacySoundStyle("melody", saved.melodySound))
            ? resolveLegacySoundStyle("melody", saved.melodySound)
            : defaults.melodySound
        ),
        otherSound: OTHER_SOUND_STYLES.includes(saved.otherSound) ? saved.otherSound : (
            OTHER_SOUND_STYLES.includes(resolveLegacySoundStyle("other", saved.otherSound))
            ? resolveLegacySoundStyle("other", saved.otherSound)
            : defaults.otherSound
        ),
        drumRandomGenre: isDrumGenreId(saved.drumRandomGenre) ? saved.drumRandomGenre : defaults.drumRandomGenre,
        noteScale: isScaleId(saved.noteScale) ? saved.noteScale : defaults.noteScale,
        noteRoot: MIDI_NOTE_NAMES.includes(saved.noteRoot) ? saved.noteRoot : defaults.noteRoot,
        notePickerOctaves: normalizeNotePickerOctaves(saved.notePickerOctaves, defaults.notePickerOctaves),
        randomRole: ["generate", "mutate", "fill"].includes(saved.randomRole) ? saved.randomRole : defaults.randomRole,
        pitchGeneratorModes: normalizePitchGeneratorModes(saved.pitchGeneratorModes, defaults.pitchGeneratorModes),
        pitchGeneratorRoles: normalizePitchGeneratorRoles(saved.pitchGeneratorRoles, defaults.pitchGeneratorRoles),
        pitchGeneratorStyles: normalizePitchGeneratorStyles(saved.pitchGeneratorStyles, defaults.pitchGeneratorStyles),
        resolume: normalizeResolumeConfig(saved.resolume, defaults.resolume),
        // Page normalization using active preset's loop length
        drumPage: normalizeDrumPage(saved.drumPage, drumLoopForPage),
        drumFollowPage: typeof saved.drumFollowPage === "boolean" ? saved.drumFollowPage : defaults.drumFollowPage,
        drumVoices: normalizeDrumVoices(saved.drumVoices, defaults.drumVoices),
        bassPage: normalizeNotePage(saved.bassPage, bassLoopForPage),
        bassFollowPage: typeof saved.bassFollowPage === "boolean" ? saved.bassFollowPage : defaults.bassFollowPage,
        melodyPage: normalizeNotePage(saved.melodyPage, melodyLoopForPage),
        melodyFollowPage: typeof saved.melodyFollowPage === "boolean" ? saved.melodyFollowPage : defaults.melodyFollowPage,
        otherPage: normalizeNotePage(saved.otherPage, otherLoopForPage),
        otherFollowPage: typeof saved.otherFollowPage === "boolean" ? saved.otherFollowPage : defaults.otherFollowPage,
        tieMode: normalizeTieMode(saved.tieMode, defaults.tieMode),
        activeShaderId: typeof saved.activeShaderId === "string" ? saved.activeShaderId : shaderDefaults.activeShaderId,
        visualMode: ["isf", "hydra", "hybrid"].includes(saved.visualMode) ? saved.visualMode : shaderDefaults.visualMode,
        visualPresets: normalizeVisualPresets(saved.visualPresets, shaderDefaults.visualPresets),
        visualEnabled: typeof saved.visualEnabled === "boolean" ? saved.visualEnabled : shaderDefaults.visualEnabled,
        visualAspect: ["fill", "16-9", "4-3", "1-1", "9-16", "custom"].includes(saved.visualAspect) ? saved.visualAspect : shaderDefaults.visualAspect,
        visualAspectWidth: Number.isFinite(Number(saved.visualAspectWidth)) ? Math.round(Number(saved.visualAspectWidth)) : shaderDefaults.visualAspectWidth,
        visualAspectHeight: Number.isFinite(Number(saved.visualAspectHeight)) ? Math.round(Number(saved.visualAspectHeight)) : shaderDefaults.visualAspectHeight,
        canvasWidth: Number.isFinite(Number(saved.canvasWidth)) ? Math.max(0, Math.round(Number(saved.canvasWidth))) : shaderDefaults.canvasWidth,
        canvasHeight: Number.isFinite(Number(saved.canvasHeight)) ? Math.max(0, Math.round(Number(saved.canvasHeight))) : shaderDefaults.canvasHeight,
    };
}

function createPresetLoopLengths() {
    return SEQUENCER_MODES.reduce((map, mode) => {
        const defaultVal = mode === "drum" ? 16 : 64;
        map[mode] = Array.from({ length: BANK_COUNT }, () => Array(PRESET_COUNT).fill(defaultVal));
        return map;
    }, {});
}

function createPresetTrackRates() {
    return SEQUENCER_MODES.reduce((map, mode) => {
        map[mode] = Array.from({ length: BANK_COUNT }, () => Array(PRESET_COUNT).fill(1));
        return map;
    }, {});
}

function createPitchGeneratorModeMap() {
    return {
        bass: "structured",
        melody: "structured",
        other: "structured"
    };
}

function createPitchGeneratorRoleMap() {
    return {
        bass: "bass",
        melody: "melody",
        other: "mono"
    };
}

function createPitchGeneratorStyleMap() {
    return {
        bass: "root-pulse",
        melody: "motif",
        other: "stab"
    };
}

function normalizePitchGeneratorModes(savedModes, defaults) {
    return ["bass", "melody", "other"].reduce((modes, kind) => {
        modes[kind] = PITCH_GENERATOR_MODES.includes(savedModes?.[kind]) ? savedModes[kind] : defaults[kind];
        return modes;
    }, {});
}

function normalizePitchGeneratorRoles(savedRoles, defaults) {
    return ["bass", "melody", "other"].reduce((roles, kind) => {
        roles[kind] = PITCH_GENERATOR_ROLES.includes(savedRoles?.[kind]) ? savedRoles[kind] : defaults[kind];
        return roles;
    }, {});
}

function normalizePitchGeneratorStyles(savedStyles, defaults) {
    const allStyles = new Set(Object.values(PITCH_GENERATOR_STYLES).flat());
    return ["bass", "melody", "other"].reduce((styles, kind) => {
        const savedStyle = typeof savedStyles?.[kind] === "string" ? savedStyles[kind] : savedStyles?.[kind]?.style;
        styles[kind] = allStyles.has(savedStyle) ? savedStyle : defaults[kind];
        return styles;
    }, {});
}

function normalizeDrumVoices(savedVoices, defaults) {
    return DRUM_LANE_VOICE_OPTIONS.map((options, index) => (
        options.includes(savedVoices?.[index]) ? savedVoices[index] : defaults[index]
    ));
}

function normalizeDrumPage(savedPage, loopLength) {
    const maxPage = Math.max(0, Math.ceil((Number(loopLength) || 16) / 16) - 1);
    const value = Number(savedPage);
    return Number.isFinite(value) ? clamp(Math.trunc(value), 0, maxPage) : 0;
}

function normalizeNotePage(savedPage, loopLength) {
    const maxPage = Math.max(0, Math.ceil((Number(loopLength) || 64) / 64) - 1);
    const value = Number(savedPage);
    return Number.isFinite(value) ? clamp(Math.trunc(value), 0, maxPage) : 0;
}

function createNotePickerOctaves() {
    return {
        bass: 1,
        melody: 4,
        other: 3
    };
}

function normalizeNotePickerOctaves(savedOctaves, defaults) {
    return ["bass", "melody", "other"].reduce((octaves, kind) => {
        const value = Number(savedOctaves?.[kind]);
        octaves[kind] = Number.isFinite(value) ? clamp(Math.round(value), -1, 9) : defaults[kind];
        return octaves;
    }, {});
}

function isScaleId(scaleId) {
    return SCALE_DEFINITIONS.some((scale) => scale.id === scaleId);
}

function isDrumGenreId(genreId) {
    return DRUM_RANDOM_GENRES.some((genre) => genre.id === genreId);
}

function createMixerDefaults() {
    return {
        drum: 80,
        bass: 82,
        melody: 72,
        other: 74
    };
}

function normalizeMixer(savedMixer, defaults) {
    const mixer = SEQUENCER_MODES.reduce((normalized, mode) => {
        const value = Number(savedMixer?.[mode]);
        normalized[mode] = Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : defaults[mode];
        return normalized;
    }, {});
    const allMuted = SEQUENCER_MODES.every((mode) => mixer[mode] <= 0);
    return allMuted ? { ...defaults } : mixer;
}

function normalizeTieMode(saved, defaults) {
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        return { bass: saved.bass === true, melody: saved.melody === true, other: saved.other === true };
    }
    return { ...defaults };
}

function normalizeVisualPresets(saved, defaults) {
    if (!Array.isArray(saved)) return defaults;
    return saved.map((item, i) => {
        if (!item || typeof item !== "object") return defaults[i] ?? null;
        return {
            shaderId: typeof item.shaderId === "string" ? item.shaderId : null,
            shaderSource: typeof item.shaderSource === "string" ? item.shaderSource : null,
            shaderName: typeof item.shaderName === "string" ? item.shaderName : null,
            params: item.params && typeof item.params === "object" ? { ...item.params } : {},
            skipVisual: item.skipVisual === true,
            hydraCode: typeof item.hydraCode === "string" ? item.hydraCode : "",
            hydraParams: item.hydraParams && typeof item.hydraParams === "object" ? { ...item.hydraParams } : null,
        };
    });
}

let _prevCachedSerialized = null;

export function saveState(state, onSync) {
    const serialized = JSON.stringify(state);
    if (serialized === _prevCachedSerialized) return;
    _prevCachedSerialized = serialized;
    localStorage.setItem(STORAGE_KEY, serialized);
    onSync?.();
}
