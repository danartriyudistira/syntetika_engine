import { ACTIONS } from "./ai-bridge.js";
import { SCENE_TYPES, SCENE_DEFINITIONS, GENRE_PROFILES, SCALE_DEFINITIONS, DRUM_RANDOM_GENRES, MIDI_NOTE_NAMES } from "./constants.js";
import { SEQUENCER_MODES } from "./pattern-store.js";

const SCALE_ALIASES = {
    major: "major-ionian",
    ionian: "major-ionian",
    minor: "minor-aeolian",
    aeolian: "minor-aeolian",
    "minor pentatonic": "minor-pentatonic",
    "major pentatonic": "pentatonic-slendro",
    slendro: "pentatonic-slendro",
    "pentatonic slendro": "pentatonic-slendro",
    pelog: "pentatonic-pelog",
    "pentatonic pelog": "pentatonic-pelog",
    "pelog lima": "pelog-lima",
    "pelog nem": "pelog-nem",
    "pelog barang": "pelog-barang",
    selendro: "gamelan-selendro",
    "gamelan selendro": "gamelan-selendro",
    "whole tone": "whole-tone",
    "harmonic minor": "harmonic-minor",
    "melodic minor": "melodic-minor-jazz",
    dorian: "dorian",
    phrygian: "phrygian",
    lydian: "lydian",
    mixolydian: "mixolydian",
    locrian: "locrian",
    "major blues": "major-blues",
    "minor blues": "minor-blues",
    "hybrid blues": "hybrid-blues",
    "phrygian dominant": "phrygian-dominant",
};

const MODE_ALIASES = {
    drum: "drum",
    drums: "drum",
    bass: "bass",
    bassline: "bass",
    melody: "melody",
    melodic: "melody",
    mono: "other",
    other: "other",
    sequencer: "other",
};

const GENRE_ALIASES = {
    techno: "techno",
    house: "house",
    "drum and bass": "drum-and-bass",
    "drum & bass": "drum-and-bass",
    dnb: "drum-and-bass",
    "hip hop": "hip-hop",
    hiphop: "hip-hop",
    trap: "trap",
    breakbeat: "breakbeat",
    disco: "disco",
    dub: "dub",
    ambient: "ambient",
    acid: "acid",
    rock: "rock",
    metal: "metal",
    pop: "pop",
    funky: "funky",
    garage: "garage",
    electro: "electro",
    minimal: "minimal",
    "hard techno": "hard-techno",
    "deep house": "deep-house",
    nusantara: "techno",
    gamelan: "techno",
    jawa: "techno",
    bali: "techno",
    tradisional: "techno",
    ethnic: "techno",
};

const NOTE_ALIASES = {
    c: "C",
    "c#": "C#",
    db: "C#",
    d: "D",
    "d#": "D#",
    eb: "D#",
    e: "E",
    f: "F",
    "f#": "F#",
    gb: "F#",
    g: "G",
    "g#": "G#",
    ab: "G#",
    a: "A",
    "a#": "A#",
    bb: "A#",
    b: "B",
};

export function parseIntent(text) {
    const input = text.trim().toLowerCase();
    if (!input) return null;

    const handlers = [
        tryQuery,
        tryUndoRedo,
        tryTransport,
        tryCompose,
        tryScene,
        tryBpm,
        tryScaleRoot,
        tryGenre,
        tryMode,
        tryBankPreset,
        tryMixer,
        tryClear,
        trySound,
        tryGenerate,
        tryRandomRole,
    ];

    for (const handler of handlers) {
        const result = handler(input, text);
        if (result) return result;
    }

    return { type: "unknown", text, confidence: 0 };
}

// ── Query ────────────────────────────────────────

function tryQuery(input) {
    if (/^(what|how|describe|status|state|current|now|snapshot|summary)\b/.test(input)) {
        return { type: "query", confidence: 0.9 };
    }
    if (/^(what'?s? playing|current (state|pattern|status|setup)|describe (everything|current|pattern)|tell me about)/.test(input)) {
        return { type: "query", confidence: 0.9 };
    }
    return null;
}

// ── Undo / Redo ─────────────────────────────────

function tryUndoRedo(input) {
    if (/^undo\b/.test(input)) {
        return { type: "undo", confidence: 0.95 };
    }
    if (/^redo\b/.test(input)) {
        return { type: "redo", confidence: 0.95 };
    }
    if (/^(go back|back|revert|kembali|batalkan)/.test(input)) {
        return { type: "undo", confidence: 0.85 };
    }
    return null;
}

// ── Transport ───────────────────────────────────

function tryTransport(input, original) {
    if (/^(play|start|run|go|mulai|mainkan)\b/.test(input)) {
        return { type: "transport", action: "play", confidence: 0.95 };
    }
    if (/^(stop|pause|halt|berhenti)\b/.test(input)) {
        return { type: "transport", action: "stop", confidence: 0.95 };
    }
    if (/\b(resync|sync|reset)\b/.test(input)) {
        return { type: "transport", action: "resync", confidence: 0.85 };
    }
    if (/\b(tap tempo|tap)\b/.test(input)) {
        return { type: "transport", action: "tap", confidence: 0.85 };
    }
    return null;
}

// ── BPM ─────────────────────────────────────────

function tryBpm(input) {
    const match = input.match(/(?:set\s+)?(?:bpm|tempo|speed|kecepatan)\s*(?:to|ke|:|=)?\s*(\d{2,3})/);
    if (match) {
        const bpm = clampBpm(parseInt(match[1], 10));
        if (bpm) {
            return { type: "bpm", bpm, confidence: 0.95 };
        }
    }
    const match2 = input.match(/(?:bpm|tempo)\s*(?:up|naik|increase|faster|cepat|tambah)\b/);
    if (match2) return { type: "bpm-delta", delta: 5, confidence: 0.8 };
    const match3 = input.match(/(?:bpm|tempo)\s*(?:down|turun|decrease|slower|lambat|kurang)\b/);
    if (match3) return { type: "bpm-delta", delta: -5, confidence: 0.8 };
    return null;
}

function clampBpm(v) { return Number.isFinite(v) ? Math.max(60, Math.min(220, v)) : null; }

// ── Scene ───────────────────────────────────────

function tryScene(input) {
    const sceneWords = new Set(SCENE_TYPES);
    for (const scene of SCENE_TYPES) {
        const pattern = new RegExp(`\\b(?:switch\\s+(?:to|ke)\\s+)?${scene}\\b`);
        if (pattern.test(input)) {
            const def = SCENE_DEFINITIONS.find((s) => s.id === scene);
            return {
                type: "scene",
                scene,
                bars: def?.defaultBars || 4,
                confidence: 0.85,
            };
        }
    }
    const sceneDesc = input.match(/\b(intro|build[ -]?up|drop|break[ -]?down|outro)\b/);
    if (sceneDesc) {
        const map = { intro: "intro", build: "build", "build-up": "build", "build up": "build", drop: "drop", "break-down": "breakdown", "break down": "breakdown", breakdown: "breakdown", outro: "outro" };
        const id = map[sceneDesc[1]];
        if (id) {
            const def = SCENE_DEFINITIONS.find((s) => s.id === id);
            return { type: "scene", scene: id, bars: def?.defaultBars || 4, confidence: 0.8 };
        }
    }
    return null;
}

// ── Generate ────────────────────────────────────

function tryGenerate(input, original) {
    const genre = detectGenre(input);
    const mode = detectMode(input);
    const role = detectRole(input);

    if (genre || mode) {
        return {
            type: "generate",
            genre: genre || undefined,
            mode: mode || undefined,
            role: role || undefined,
            confidence: 0.85,
        };
    }

    if (/\b(random(ize)?|generate|buat|hasilkan|acak)\b/.test(input)) {
        return { type: "generate", confidence: 0.7 };
    }

    if (/\b(fill|isi)\b/.test(input)) {
        return { type: "fill", mode: detectMode(input), confidence: 0.8 };
    }

    if (/\b(mutate|ubah|variasi)\b/.test(input)) {
        return { type: "mutate", mode: detectMode(input), confidence: 0.8 };
    }

    return null;
}

function detectGenre(input) {
    for (const [alias, id] of Object.entries(GENRE_ALIASES)) {
        if (input.includes(alias)) return id;
    }
    for (const g of DRUM_RANDOM_GENRES) {
        if (input.includes(g.id) || input.includes(g.label.toLowerCase())) return g.id;
    }
    return null;
}

function detectMode(input) {
    for (const [alias, id] of Object.entries(MODE_ALIASES)) {
        if (input.includes(alias)) return id;
    }
    return null;
}

function detectRole(input) {
    if (/\b(generate|random|acak)\b/.test(input)) return "generate";
    if (/\b(mutate|mutasi|ubah|variasi)\b/.test(input)) return "mutate";
    if (/\b(fill|isi)\b/.test(input)) return "fill";
    return null;
}

// ── Scale / Root ────────────────────────────────

function tryScaleRoot(input) {
    const rootMatch = input.match(/(?:root|key|nada dasar|kunci)\s*(?:of|:)?\s*([a-g][#b]?)/i);
    if (rootMatch) {
        const note = NOTE_ALIASES[rootMatch[1].toLowerCase()];
        if (note) return { type: "root", root: note, confidence: 0.85 };
    }

    const noteMatch = input.match(/\b([a-g][#b]?)\s+(minor|major|dorian|phrygian|lydian|mixolydian|locrian|pentatonic|blues)\b/i);
    if (noteMatch) {
        const note = NOTE_ALIASES[noteMatch[1].toLowerCase()];
        const scaleInput = `${noteMatch[1].toLowerCase()} ${noteMatch[2].toLowerCase()}`;
        const scaleId = SCALE_ALIASES[scaleInput] || SCALE_ALIASES[noteMatch[2].toLowerCase()];
        const result = { type: "scale-root", confidence: 0.9 };
        if (note) result.root = note;
        if (scaleId) result.scaleId = scaleId;
        return result;
    }

    const scaleMatch = input.match(/(?:scale|tangga nada|mode)\s*(?:to|:)?\s*(.+)/i);
    if (scaleMatch) {
        const scaleInput = scaleMatch[1].trim().toLowerCase();
        const sid = SCALE_ALIASES[scaleInput] || SCALE_DEFINITIONS.find((s) => s.id === scaleInput || s.label.toLowerCase().includes(scaleInput))?.id;
        if (sid) return { type: "scale", scaleId: sid, confidence: 0.85 };
    }

    // Detect standalone scale name (no prefix needed)
    const rawInput = input.trim().toLowerCase();
    if (rawInput.length > 2) {
        const commonWords = new Set(["minor", "major", "blues", "modal", "scale"]);
        if (!commonWords.has(rawInput)) {
            const sid2 = SCALE_ALIASES[rawInput] ||
                SCALE_DEFINITIONS.find((s) => s.id === rawInput || s.label.toLowerCase() === rawInput)?.id;
            if (sid2) return { type: "scale", scaleId: sid2, confidence: 0.7 };
        }
    }

    return null;
}

// ── Genre ───────────────────────────────────────

function tryGenre(input) {
    if (/\bgenre\b/.test(input)) {
        const genre = detectGenre(input);
        if (genre) return { type: "genre", genre, confidence: 0.85 };
    }
    return null;
}

// ── Sound ───────────────────────────────────────

function trySound(input) {
    const soundMap = {
        "acid bass": { mode: "bass", sound: "acid" },
        "sub bass": { mode: "bass", sound: "sub" },
        "default bass": { mode: "bass", sound: "default" },
        "pluck bass": { mode: "bass", sound: "pluck" },
        "glitch": { mode: "drum", sound: "glitch" },
        "noise": { mode: "drum", sound: "noise" },
        "abstract": { mode: "drum", sound: "abstract" },
        "moog": { mode: "other", sound: "moog" },
        "plucky": { mode: "other", sound: "plucky" },
        "stabby": { mode: "other", sound: "stabby" },
    };

    for (const [key, val] of Object.entries(soundMap)) {
        if (new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(input))
            return { type: "sound", mode: val.mode, sound: val.sound, confidence: 0.9 };
    }

    if (/\b(bell|bells|lonceng|glass)\b/.test(input))
        return { type: "sound", mode: "melody", sound: "bell", confidence: 0.9 };
    if (/\b(lead|leads)\b/.test(input) && !/\bmode\b/.test(input))
        return { type: "sound", mode: "melody", sound: "lead", confidence: 0.9 };
    if (/\b(vintage)\b/i.test(input))
        return { type: "sound", mode: "melody", sound: "default", confidence: 0.8 };
    if (/\b(pad|pads)\b/.test(input))
        return { type: "sound", mode: "melody", sound: "pad", confidence: 0.9 };
    if (/\bfm\b/i.test(input))
        return { type: "sound", mode: "other", sound: "fm", confidence: 0.7 };

    const soundPattern = input.match(/(?:change|switch|set|ganti|pakai)\s+(.+?)\s+(?:sound|style|suara)\s+(?:to|ke|:)?\s*(.+)/i);
    if (soundPattern) {
        const mode = detectMode(soundPattern[1]);
        const soundName = soundPattern[2].trim().toLowerCase();
        if (mode) {
            return { type: "sound", mode, sound: soundName, confidence: 0.7 };
        }
    }

    return null;
}

// ── Mode ────────────────────────────────────────

function tryMode(input) {
    const mode = detectMode(input);
    if (mode && /\b(sound|style|suara)\b/.test(input)) return null;
    if (mode && /\b(switch|change|edit|ganti|pilih|mode|masuk|buka)\b/.test(input)) {
        return { type: "mode", mode, confidence: 0.85 };
    }
    return null;
}

// ── Bank / Preset ───────────────────────────────

function tryBankPreset(input) {
    const bankMatch = input.match(/(?:bank|\bb)\s*(\d+)/i);
    if (bankMatch) {
        const bank = clampBank(parseInt(bankMatch[1], 10) - 1);
        if (bank !== null) return { type: "bank", bank, mode: detectMode(input) || undefined, confidence: 0.9 };
    }

    const presetMatch = input.match(/(?:preset|\bp|slot|program)\s*(\d+)/i);
    if (presetMatch) {
        const slot = clampSlot(parseInt(presetMatch[1], 10) - 1);
        if (slot !== null) {
            const mode = detectMode(input);
            if (mode) return { type: "preset", slot, mode, confidence: 0.9 };
            if (/\ball\b/.test(input)) return { type: "preset-all", slot, confidence: 0.85 };
            return { type: "preset", slot, mode: undefined, confidence: 0.85 };
        }
    }
    return null;
}

function clampBank(v) { return Number.isFinite(v) ? Math.max(0, Math.min(7, v)) : null; }

function clampSlot(v) { return Number.isFinite(v) ? Math.max(0, Math.min(7, v)) : null; }

// ── Mixer ───────────────────────────────────────

function tryMixer(input) {
    const modeMap = { drum: "drum", drums: "drum", bass: "bass", bassline: "bass", melody: "melody", melodic: "melody", mono: "other", other: "other" };

    const volMatch = input.match(/(drum|drums|bass|bassline|melody|melodic|mono|other)\s*(?:volume|level|gain|keras|sound|suara)\s*(\d{1,3})/i);
    if (volMatch) {
        const mode = modeMap[volMatch[1].toLowerCase()];
        const level = clampLevel(parseInt(volMatch[2], 10));
        if (mode && level !== null) return { type: "mixer", mode, level, confidence: 0.9 };
    }

    const upMatch = input.match(/(drum|drums|bass|bassline|melody|melodic|mono|other)\s*(?:up|naik|increase|keras|louder)\b/i);
    if (upMatch) {
        const mode = modeMap[upMatch[1].toLowerCase()];
        if (mode) return { type: "mixer-delta", mode, delta: 10, confidence: 0.8 };
    }

    const downMatch = input.match(/(drum|drums|bass|bassline|melody|melodic|mono|other)\s*(?:down|turun|decrease|pelan|softer)\b/i);
    if (downMatch) {
        const mode = modeMap[downMatch[1].toLowerCase()];
        if (mode) return { type: "mixer-delta", mode, delta: -10, confidence: 0.8 };
    }

    return null;
}

function clampLevel(v) { return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null; }

// ── Clear ───────────────────────────────────────

// ── Compose (full arrangement) ─────────────────

function tryCompose(input) {
    const genreMatch = input.match(/\b(?:make|create|build|compose|arrange|generate|buat|bikin)\s+(?:a|an|the|some|full)\s+(.+?)\s+(?:track|beat|song|arrangement|komposisi|lagu|musik)\b/i);
    if (genreMatch) {
        const genreName = genreMatch[1].trim().toLowerCase();
        for (const [alias, id] of Object.entries(GENRE_ALIASES)) {
            if (genreName.includes(alias) || genreName === alias) {
                return { type: "compose", genre: id, confidence: 0.95 };
            }
        }
    }

    const simpleMatch = input.match(/\b(?:make|create|compose|arrange|generate|buat|bikin)\s+(.+?)\s+(?:track|beat|song|arrangement)\b/i);
    if (simpleMatch) {
        const genreName = simpleMatch[1].trim().toLowerCase();
        for (const [alias, id] of Object.entries(GENRE_ALIASES)) {
            if (genreName.includes(alias)) {
                return { type: "compose", genre: id, confidence: 0.9 };
            }
        }
        return { type: "compose", genre: genreName, confidence: 0.6 };
    }

    if (/\b(?:arrange|compose|full arrangement|full track)\b/.test(input)) {
        const genre = detectGenre(input);
        if (genre) return { type: "compose", genre, confidence: 0.85 };
        return { type: "compose", confidence: 0.6 };
    }

    return null;
}

function tryClear(input) {
    if (/\bclear (all|everything|semua)\b/.test(input)) {
        return { type: "clear", mode: undefined, confidence: 0.85 };
    }
    if (/\bclear\b/.test(input)) {
        const mode = detectMode(input);
        return { type: "clear", mode: mode || undefined, confidence: 0.8 };
    }
    return null;
}

// ── Random Role ─────────────────────────────────

function tryRandomRole(input) {
    if (/\b(random|generate|acak)\b/.test(input) && /\b(role|mode|fungsi)\s*(generate|acak)\b/.test(input)) {
        return { type: "random-role", role: "generate", confidence: 0.7 };
    }
    if (/\bmutate\b/.test(input) && /\b(role|mode)\b/.test(input)) {
        return { type: "random-role", role: "mutate", confidence: 0.7 };
    }
    if (/\bfill\b/.test(input) && /\b(role|mode)\b/.test(input)) {
        return { type: "random-role", role: "fill", confidence: 0.7 };
    }
    return null;
}

// ── Intent → Actions Resolver ───────────────────

export function intentToActions(intent) {
    if (!intent || intent.type === "unknown" || intent.confidence < 0.5) return null;

    switch (intent.type) {
        case "query":
            return [{ type: "query" }];

        case "undo":
            return [{ type: "undo" }];

        case "redo":
            return [{ type: "redo" }];

        case "transport":
            if (intent.action === "play") return [{ type: ACTIONS.TOGGLE_PLAY }];
            if (intent.action === "stop") return [{ type: ACTIONS.STOP }];
            return null;

        case "bpm":
            return [{ type: ACTIONS.SET_BPM, bpm: intent.bpm }];

        case "bpm-delta":
            return [{ type: ACTIONS.SET_BPM, bpm: 120 }]; // placeholder, resolved by bridge

        case "scene": {
            const def = SCENE_DEFINITIONS.find((s) => s.id === intent.scene);
            if (!def) return null;
            const actions = [];
            const profile = GENRE_PROFILES[Object.keys(GENRE_PROFILES).find((id) => id === intent.genre)];
            if (profile) {
                actions.push({ type: ACTIONS.SET_SCALE, scaleId: profile.scale });
                actions.push({ type: ACTIONS.GENERATE_DRUM, genre: profile.drumGenre });
                actions.push({ type: ACTIONS.APPLY_PITCH_STYLE, generatorMode: profile.pitchGenerator.mode, generatorRole: profile.pitchGenerator.role, generatorStyle: profile.pitchGenerator.style });
                actions.push({ type: ACTIONS.SET_SOUND, mode: "drum", sound: profile.drumGenre === "techno" ? "default" : profile.drumGenre });
                actions.push({ type: ACTIONS.SET_SOUND, mode: "bass", sound: profile.bassStyle });
                actions.push({ type: ACTIONS.SET_SOUND, mode: "melody", sound: profile.melodyStyle });
                actions.push({ type: ACTIONS.SET_SOUND, mode: "other", sound: profile.otherStyle });
                actions.push({ type: ACTIONS.GENERATE, role: "generate" });
            } else {
                actions.push({ type: ACTIONS.GENERATE, role: intent.role || "generate" });
            }
            return actions;
        }

        case "generate": {
            const profile = intent.genre ? GENRE_PROFILES[intent.genre] : null;
            const actions = [];
            if (profile) {
                actions.push({ type: ACTIONS.SET_BPM, bpm: profile.defaultTempo });
                actions.push({ type: ACTIONS.SET_SCALE, scaleId: profile.scale });
                if (intent.mode !== "drum") {
                    actions.push({ type: ACTIONS.APPLY_PITCH_STYLE, generatorMode: profile.pitchGenerator.mode, generatorRole: profile.pitchGenerator.role, generatorStyle: profile.pitchGenerator.style });
                    actions.push({ type: ACTIONS.SET_SOUND, mode: "bass", sound: profile.bassStyle });
                    actions.push({ type: ACTIONS.SET_SOUND, mode: "melody", sound: profile.melodyStyle });
                    actions.push({ type: ACTIONS.SET_SOUND, mode: "other", sound: profile.otherStyle });
                }
                actions.push({ type: ACTIONS.GENERATE_DRUM, genre: profile.drumGenre });
                if (intent.mode) {
                    actions.push({ type: ACTIONS.GENERATE, mode: intent.mode, role: intent.role || "generate" });
                }
            } else {
                if (intent.mode) {
                    actions.push({ type: ACTIONS.GENERATE, mode: intent.mode, role: intent.role || "generate" });
                } else {
                    const modes = SEQUENCER_MODES;
                    for (const mode of modes) {
                        actions.push({ type: ACTIONS.GENERATE, mode, role: intent.role || "generate" });
                    }
                }
            }
            return actions;
        }

        case "fill":
            return [{ type: ACTIONS.GENERATE, mode: intent.mode, role: "fill" }];

        case "mutate":
            return [{ type: ACTIONS.GENERATE, mode: intent.mode, role: "mutate" }];

        case "scale-root":
            return [
                ...(intent.scaleId ? [{ type: ACTIONS.SET_SCALE, scaleId: intent.scaleId }] : []),
                ...(intent.root ? [{ type: ACTIONS.SET_ROOT, root: intent.root }] : []),
            ];

        case "scale":
            return [{ type: ACTIONS.SET_SCALE, scaleId: intent.scaleId }];

        case "root":
            return [{ type: ACTIONS.SET_ROOT, root: intent.root }];

        case "genre":
            return [{ type: ACTIONS.SET_DRUM_GENRE, genre: intent.genre }];

        case "sound":
            return [{ type: ACTIONS.SET_SOUND, mode: intent.mode, sound: intent.sound }];

        case "mode":
            return [{ type: ACTIONS.SET_MODE, mode: intent.mode }];

        case "bank":
            return [{ type: ACTIONS.SWITCH_BANK, mode: intent.mode, bank: intent.bank }];

        case "preset":
            return [{ type: ACTIONS.SWITCH_PRESET, mode: intent.mode, slot: intent.slot }];

        case "preset-all":
            return [{ type: ACTIONS.SWITCH_ALL_PRESETS, slot: intent.slot }];

        case "mixer":
            return [{ type: ACTIONS.SET_MIXER, mode: intent.mode, level: intent.level }];

        case "mixer-delta":
            return [{ type: ACTIONS.SET_MIXER, mode: intent.mode }]; // delta resolved at higher level

        case "clear":
            return [{ type: ACTIONS.CLEAR_PATTERN, mode: intent.mode }];

        case "random-role":
            return [{ type: ACTIONS.GENERATE, role: intent.role }];

        case "compose":
            return [{ type: ACTIONS.COMPOSE, genre: intent.genre }];

        default:
            return null;
    }
}
