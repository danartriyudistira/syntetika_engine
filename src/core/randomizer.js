import { MIDI_NOTE_NAMES } from "./constants.js";
import { midiNoteName, noteNameToMidi } from "./utils.js";

export class Randomizer {
    apply({
        mode,
        role,
        pattern,
        loopLength = 64,
        scale = null,
        root = "C",
        drumGenre = "default",
        genre = "techno",
        generatorMode = "explore",
        generatorRole = "",
        generatorStyle = ""
    }) {
        const notePool = mode === "drum" ? [] : createScaleNotePool(mode, scale, root, false);
        const fillNotePool = mode === "drum" ? [] : createScaleNotePool(mode, scale, root, true);
        const structuredPitch = mode !== "drum" && generatorMode === "structured";
        if (role === "mutate") {
            if (structuredPitch) {
                this.mutateStructuredPitch(pattern, {
                    generatorRole,
                    generatorStyle,
                    loopLength,
                    scale,
                    root,
                    genre
                });
                return;
            }
            this.mutate(mode, pattern, notePool, loopLength);
            return;
        }
        if (role === "fill") {
            if (structuredPitch) {
                this.fillStructuredPitch(pattern, {
                    generatorRole,
                    generatorStyle,
                    loopLength,
                    scale,
                    root,
                    genre
                });
                return;
            }
            this.fill(mode, pattern, loopLength, fillNotePool);
            return;
        }
        if (mode !== "drum" && generatorMode === "structured" && generatorRole === "bass") {
            this.generateStructuredBass(pattern, {
                style: generatorStyle,
                loopLength,
                scale,
                root,
                genre
            });
            return;
        }
        if (mode !== "drum" && generatorMode === "structured" && generatorRole === "melody") {
            this.generateStructuredMelody(pattern, {
                style: generatorStyle,
                loopLength,
                scale,
                root
            });
            return;
        }
        if (mode !== "drum" && generatorMode === "structured" && generatorRole === "mono") {
            this.generateStructuredMono(pattern, {
                style: generatorStyle,
                loopLength,
                scale,
                root
            });
            return;
        }
        this.generate(mode, pattern, notePool, drumGenre, loopLength);
    }

    generate(mode, pattern, notePool = [], drumGenre = "default", loopLength = 64) {
        if (mode === "drum") {
            this.generateDrum(pattern, drumGenre, loopLength);
            return;
        }
        this.generateNotePattern(mode, pattern, notePool);
    }

    mutate(mode, pattern, notePool = [], loopLength = 64) {
        if (mode === "drum") {
            for (let i = 0; i < 8; i += 1) {
                const track = randomInt(0, pattern.length - 1);
                const step = randomInt(0, Math.max(0, loopLength - 1));
                pattern[track][step] = !pattern[track][step];
            }
            return;
        }

        for (let i = 0; i < 8; i += 1) {
            const step = randomInt(0, pattern.length - 1);
            pattern[step] = {
                active: Math.random() < 0.55 ? !pattern[step].active : pattern[step].active,
                note: Math.random() < 0.45 ? pickNote(notePool) : pattern[step].note
            };
        }
    }

    fill(mode, pattern, loopLength = 64, notePool = []) {
        if (mode === "drum") {
            const start = Math.max(0, loopLength - 4);
            for (let step = start; step < loopLength; step += 1) {
                pattern[1][step] = Math.random() < 0.5;
                pattern[2][step] = Math.random() < 0.42;
                pattern[3][step] = Math.random() < 0.4;
                pattern[4][step] = Math.random() < 0.32;
                pattern[5][step] = Math.random() < 0.72;
                pattern[6][step] = step % 2 === 1 && Math.random() < 0.45;
                if (pattern[6][step]) pattern[5][step] = false;
            }
            return;
        }

        const start = Math.max(0, loopLength - 8);
        for (let step = start; step < loopLength; step += 1) {
            pattern[step] = {
                active: Math.random() < (mode === "other" ? 0.32 : 0.48),
                note: pickNote(notePool)
            };
        }
    }

    generateDrum(pattern, genre = "default", loopLength = 16) {
        if (genre !== "default") {
            generateGenreDrum(pattern, genre, loopLength);
            return;
        }
        for (let track = 0; track < pattern.length; track += 1) {
            for (let step = 0; step < pattern[track].length; step += 1) {
                if (step >= loopLength) {
                    pattern[track][step] = false;
                    continue;
                }
                const density = [0.32, 0.22, 0.18, 0.14, 0.1, 0.42, 0.18][track] ?? 0.16;
                pattern[track][step] = Math.random() < density;
            }
        }
    }

    generateNotePattern(mode, pattern, notePool = []) {
        const density = mode === "bass" ? 0.28 : mode === "melody" ? 0.24 : 0.2;

        for (let step = 0; step < pattern.length; step += 1) {
            pattern[step] = {
                active: Math.random() < density,
                note: pickNote(notePool)
            };
        }
    }

    generateStructuredBass(pattern, { style = "root-pulse", loopLength = 64, scale = null, root = "C", genre = "techno" } = {}) {
        const safeLoopLength = Math.max(1, Math.min(pattern.length, Number(loopLength) || 64));
        const baseNotes = createBassNoteSet(scale, root);
        const baseRootMidi = noteNameToMidi(baseNotes.root);
        const rootPc = MIDI_NOTE_NAMES.indexOf(root);
        const bars = Math.ceil(safeLoopLength / 16);

        // Reset pattern
        for (let step = 0; step < pattern.length; step += 1) {
            pattern[step] = { active: false, note: baseNotes.root, velocity: 0x60 };
        }

        // Build bass bars using the pattern cycling system
        let lastNote = baseNotes.root;
        for (let bar = 0; bar < bars; bar += 1) {
            const chordOffset = chordOffsetForBar(genre, bar);
            const notes = chordOffset ? offsetNoteSet(baseNotes, chordOffset) : baseNotes;
            const barResult = buildBassBar(style, notes, bar, lastNote);

            barResult.events.forEach((evt) => {
                const step = bar * 16 + evt.step;
                if (step >= safeLoopLength) return;

                let noteName = evt.note;
                // Apply octave jump from event
                if (evt.octaveJump) {
                    const midi = noteNameToMidi(noteName);
                    noteName = midiNoteName(Math.min(127, midi + 12));
                }
                pattern[step] = {
                    active: true,
                    note: noteName,
                    velocity: Math.min(127, Math.max(20, evt.velocity)),
                    ghost: evt.ghost || false,
                };
            });

            lastNote = barResult.lastNote;
        }

        applyPhraseRepeat(pattern, safeLoopLength);
    }

    generateStructuredMelody(pattern, { style = "motif", loopLength = 64, scale = null, root = "C" } = {}) {
        const safeLoopLength = Math.max(1, Math.min(pattern.length, Number(loopLength) || 64));
        const notes = createMelodyNoteSet(scale, root);
        const motif = createMelodyMotif(style, notes);
        const smoothedMotif = smoothMotif(motif, notes, notes.tonic);

        for (let step = 0; step < pattern.length; step += 1) {
            pattern[step] = {
                active: false,
                note: notes.tonic
            };
        }

        let lastNote = notes.tonic;
        for (let step = 0; step < safeLoopLength; step += 1) {
            const event = melodyEventForStep(style, smoothedMotif, notes, step, lastNote);
            if (!event) continue;
            pattern[step] = event;
            lastNote = event.note;
        }

        applyPhraseRepeat(pattern, safeLoopLength);
    }

    generateStructuredMono(pattern, { style = "stab", loopLength = 64, scale = null, root = "C" } = {}) {
        const safeLoopLength = Math.max(1, Math.min(pattern.length, Number(loopLength) || 64));
        const notes = createMonoNoteSet(scale, root);

        for (let step = 0; step < pattern.length; step += 1) {
            pattern[step] = {
                active: false,
                note: notes.root
            };
        }

        let lastNote = notes.root;
        for (let step = 0; step < safeLoopLength; step += 1) {
            const event = monoEventForStep(style, notes, step, lastNote);
            if (!event) continue;
            pattern[step] = event;
            lastNote = event.note;
        }
    }

    mutateStructuredPitch(pattern, { generatorRole = "bass", generatorStyle = "", loopLength = 64, scale = null, root = "C", genre = "techno" } = {}) {
        if (generatorRole === "bass") {
            mutateStructuredBass(pattern, { style: generatorStyle, loopLength, scale, root, genre });
            return;
        }
        if (generatorRole === "melody") {
            mutateStructuredMelody(pattern, { style: generatorStyle, loopLength, scale, root });
            return;
        }
        mutateStructuredMono(pattern, { style: generatorStyle, loopLength, scale, root });
    }

    fillStructuredPitch(pattern, { generatorRole = "bass", generatorStyle = "", loopLength = 64, scale = null, root = "C", genre = "techno" } = {}) {
        if (generatorRole === "bass") {
            fillStructuredBass(pattern, { style: generatorStyle, loopLength, scale, root, genre });
            return;
        }
        if (generatorRole === "melody") {
            fillStructuredMelody(pattern, { style: generatorStyle, loopLength, scale, root });
            return;
        }
        fillStructuredMono(pattern, { style: generatorStyle, loopLength, scale, root });
    }
}

// ── BASS STYLES ───────────────────────────────────
// Repetitive EDM Bassline System
// Cycles through 4 patterns (A/B/C/D) with 70% anchor, 30% variation
// Evolution: subtle every 8 bars, moderate every 16, significant every 32

const BASS_PATTERN_TYPES = ["A", "B", "C", "D"];

// Each pattern defines note targets for the 4 anchor positions (0, 4, 8, 12 = quarter notes)
const BASS_CYCLE_PATTERNS = {
    A: { label: "Root-Root-5th-Root", notes: (n, i) => [n.root, n.root, n.fifth, n.root][i] },
    B: { label: "Root-Root-5th-Octave", notes: (n, i) => [n.root, n.root, n.fifth, n.octave][i] },
    C: { label: "Root-Ghost-5th-Root", notes: (n, i) => [n.root, "ghost", n.fifth, n.root][i] },
    D: { label: "Root-Root-5th-Passing", notes: (n, i) => [n.root, n.root, n.fifth, "passing"][i] },
};

// Evolution modifications applied per stage
const BASS_EVOLUTION_STAGES = [
    { bars: 0, label: "base", modify: null },
    { bars: 8, label: "subtle", modify: { octaveShift: 0.15, ghostChance: 0.05, accentChance: 0.05 } },
    { bars: 16, label: "moderate", modify: { patternSwap: 0.3, octaveShift: 0.3, ghostChance: 0.1, accentChance: 0.1 } },
    { bars: 32, label: "significant", modify: { patternSwap: 0.6, octaveShift: 0.5, ghostChance: 0.2, accentChance: 0.2, invertStep: 0.3 } },
    { bars: 64, label: "reset", modify: null },
];

function bassEvolutionStage(bar) {
    let stage = 0;
    for (let i = BASS_EVOLUTION_STAGES.length - 1; i >= 0; i--) {
        if (bar >= BASS_EVOLUTION_STAGES[i].bars) { stage = i; break; }
    }
    return stage;
}

// Rhythm styles — define step positions per bar (16-step grid)
const BASS_RHYTHM_STYLES = {
    "root-pulse": [
        [0, 8],
        [0, 8, 4],
        [0, 8, 12],
    ],
    offbeat: [
        [2, 6, 10, 14],
        [0, 2, 6, 10, 14],
        [2, 6, 10, 12, 14],
    ],
    walking: [
        [0, 4, 8, 12, 14],
        [0, 3, 6, 9, 12, 15],
        [0, 3, 6, 10, 14],
    ],
    acid: [
        [0, 3, 6, 7, 10, 12, 14],
        [0, 2, 5, 7, 9, 11, 14],
        [0, 4, 6, 8, 10, 12, 15],
    ],
    syncopated: [
        [0, 3, 6, 10, 13],
        [0, 2, 5, 8, 11, 15],
        [0, 4, 7, 10, 14],
    ],
    "two-step": [
        [0, 2, 4, 6, 8, 10, 12, 14],
        [0, 3, 4, 7, 8, 11, 12, 15],
        [0, 2, 4, 5, 8, 10, 12, 13],
    ],
    "half-time": [
        [0, 8],
        [0, 4, 8, 12],
        [0, 8, 12],
    ],
    gliding: [
        [0, 6, 8, 14],
        [0, 4, 8, 12, 14],
        [0, 3, 8, 11],
    ],
    dub: [
        [0, 8],
        [0, 6, 12],
        [0, 4, 10],
    ],
    latin: [
        [0, 3, 6, 8, 10, 12, 15],
        [0, 4, 6, 9, 12, 14],
        [0, 2, 7, 8, 10, 15],
    ],
    "chill-wave": [
        [0, 8, 12],
        [0, 4, 10],
        [0, 6, 12, 14],
    ],
    // New hypnotic style designed for evolving pattern cycling
    hypnotic: [
        [0, 4, 8, 12],
        [0, 4, 8, 12],
        [0, 4, 8, 12],
    ],
};

function bassRhythmSteps(style, bar, variant) {
    const patterns = BASS_RHYTHM_STYLES[style];
    if (!patterns) return [0, 8];
    const pattern = patterns[variant % patterns.length];
    if (style === "acid") return pattern.filter(() => Math.random() > 0.12);
    if (style === "two-step") return pattern;
    if (style === "dub" && bar % 2 === 1) return pattern.map(s => (s + 3) % 16).sort((a, b) => a - b);
    if (style === "latin" && bar % 2 === 1) return pattern.slice(2).concat(pattern.slice(0, 2));
    if (bar % 2 === 0) return pattern;
    const patterns2 = BASS_RHYTHM_STYLES[style];
    const alt = patterns2[(variant + 1) % patterns2.length];
    return alt;
}

// Build a single bar of bass from the cycle system
function buildBassBar(style, notes, bar, lastNote) {
    const patternIndex = bar % BASS_PATTERN_TYPES.length;
    const patternKey = BASS_PATTERN_TYPES[patternIndex];
    const cyclePattern = BASS_CYCLE_PATTERNS[patternKey];
    const steps = bassRhythmSteps(style, bar, patternIndex);
    const quarterIdx = [0, 4, 8, 12];
    const evoStage = bassEvolutionStage(bar);
    const evo = BASS_EVOLUTION_STAGES[evoStage].modify;

    const result = [];
    let prevNote = lastNote;

    for (let i = 0; i < steps.length; i++) {
        const localStep = steps[i];
        const qIdx = quarterIdx.indexOf(localStep);
        let rawNote;

        // Step 1: get raw note (may be sentinel "ghost" or "passing")
        if (qIdx !== -1) {
            rawNote = cyclePattern.notes(notes, qIdx);
        } else {
            rawNote = pickWeightedNote(notes.passing, prevNote, { preferStep: true, root: notes.root });
        }

        // Step 2: resolve sentinels to real note names BEFORE any processing
        let resolvedNote;
        let isPatternGhost = false;
        if (rawNote === "ghost") {
            resolvedNote = notes.root;
            isPatternGhost = true;
        } else if (rawNote === "passing") {
            resolvedNote = pickWeightedNote(notes.passing, prevNote, { preferStep: true, root: notes.root });
        } else {
            resolvedNote = rawNote;
        }

        // Step 3: evolution modifications (only on real notes)
        if (evo && !isPatternGhost) {
            if (evo.patternSwap && Math.random() < evo.patternSwap) {
                const altIdx = (patternIndex + 1 + randomInt(0, 1)) % BASS_PATTERN_TYPES.length;
                const altKey = BASS_PATTERN_TYPES[altIdx];
                const altPattern = BASS_CYCLE_PATTERNS[altKey];
                const altNote = altPattern.notes(notes, qIdx !== -1 ? qIdx : 0);
                if (altNote !== "ghost" && altNote !== "passing") {
                    resolvedNote = altNote;
                }
            }
            if (evo.octaveShift && Math.random() < evo.octaveShift) {
                const midi = noteNameToMidi(resolvedNote);
                resolvedNote = midiNoteName(Math.min(127, midi + 12));
            }
        }

        // Step 4: build event with velocity
        const noteName = resolvedNote;

        if (isPatternGhost) {
            // Pattern ghost — plays at low velocity
            result.push({ step: localStep, note: noteName, ghost: true, velocity: 0x30 });
        } else {
            // Velocity: beat 1 strongest, gradual decay
            let vel = 0x50;
            if (localStep === 0) vel = 0x80;
            else if (localStep === 8) vel = 0x70;
            else if (localStep === 4 || localStep === 12) vel = 0x60;

            // Accent probability (20% of non-beat-1 notes get boosted)
            if (localStep !== 0 && Math.random() < 0.2) vel = Math.min(0x7F, vel + 0x20);
            // Ghost note probability (15%)
            const isGhost = localStep !== 0 && Math.random() < 0.15;
            if (isGhost) vel = 0x30;

            // Octave jump probability (5%)
            const octaveJump = Math.random() < 0.05;

            result.push({
                step: localStep,
                note: noteName,
                ghost: isGhost,
                octaveJump,
                velocity: vel,
            });
        }
        prevNote = noteName;
    }
    return { events: result, lastNote: prevNote };
}

const BASS_NOTE_STRATEGIES = {
    "root-pulse": (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (localStep === 8) return bar % 2 === 0 ? notes.fifth : notes.octave;
        return [notes.root, notes.fifth, notes.octave][index % 3];
    },
    offbeat: (notes, index, localStep, bar, lastNote) => {
        return index % 2 === 0 ? notes.root : bar % 2 === 0 ? notes.fifth : pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
    },
    walking: (notes, index, localStep, bar, lastNote) => {
        return notes.walk[(index + bar) % notes.walk.length] || notes.root;
    },
    acid: (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (index % 3 === 0 && Math.random() > 0.3) return notes.octave;
        if (index % 2 === 0) return pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
        return Math.random() > 0.45 ? notes.fifth : pickWeightedNote(notes.walk, lastNote, { preferStep: true, root: notes.root });
    },
    syncopated: (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (localStep >= 13) return notes.leading;
        if (localStep === 7) return bar % 2 === 0 ? notes.fifth : notes.octave;
        return index % 2 === 0 ? notes.fifth : pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
    },
    "two-step": (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (index % 2 === 0) return notes.root;
        if (localStep === 8) return notes.fifth;
        return Math.random() > 0.5 ? pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root }) : notes.fifth;
    },
    "half-time": (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (localStep === 8) return bar % 2 === 0 ? notes.fifth : notes.octave;
        return Math.random() > 0.5 ? notes.fifth : notes.octave;
    },
    gliding: (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (localStep === 6 || localStep === 14) return notes.fifth;
        if (localStep === 8) return notes.leading;
        return pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
    },
    dub: (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (localStep === 6) return notes.leading;
        if (localStep === 8) return notes.fifth;
        if (localStep === 12) return notes.octave;
        return pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
    },
    latin: (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0 || localStep === 8) return notes.root;
        if (localStep === 6 || localStep === 14) return notes.fifth;
        return Math.random() > 0.5 ? pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root }) : notes.octave;
    },
    "chill-wave": (notes, index, localStep, bar, lastNote) => {
        if (localStep === 0) return notes.root;
        if (index % 2 === 0) return notes.fifth;
        return pickWeightedNote(notes.passing, lastNote, { preferStep: true, root: notes.root });
    },
};

function structuredBassNote(style, notes, index, localStep, bar, lastNote) {
    const strategy = BASS_NOTE_STRATEGIES[style];
    if (!strategy) return notes.root;
    return strategy(notes, index, localStep, bar, lastNote);
}

function createBassNoteSet(scale, root) {
    const rootIndex = Math.max(0, MIDI_NOTE_NAMES.indexOf(root));
    const intervals = Array.isArray(scale?.intervals) && scale.intervals.length
        ? scale.intervals.map((interval) => ((Number(interval) % 12) + 12) % 12)
        : Array.from({ length: 12 }, (_, index) => index);
    const pitchClasses = new Set(intervals.map((interval) => (rootIndex + interval) % 12));
    const pool = [];
    for (let note = 24; note <= 47; note += 1) {
        if (pitchClasses.has(note % 12)) pool.push(note);
    }
    if (!pool.length) pool.push(noteNameToMidi(`${root}1`));

    const rootMidi = nearestPitchClass(pool, rootIndex, 36);
    const fifthMidi = nearestPitchClass(pool, (rootIndex + 7) % 12, rootMidi + 7);
    const octaveMidi = nearestPitchClass(pool, rootIndex, rootMidi + 12);
    const leadingMidi = nearestPitchClass(pool, (rootIndex + 11) % 12, rootMidi + 11);
    const passing = pool.filter((note) => ![rootMidi, fifthMidi, octaveMidi].includes(note));
    const walk = createWalkingNotes(pool, rootMidi);

    return {
        root: midiNoteName(rootMidi),
        fifth: midiNoteName(fifthMidi),
        octave: midiNoteName(octaveMidi),
        leading: midiNoteName(leadingMidi),
        passing: (passing.length ? passing : pool).map(midiNoteName),
        walk: walk.map(midiNoteName)
    };
}

function mutateStructuredBass(pattern, { style = "root-pulse", loopLength = 64, scale = null, root = "C", genre = "techno" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const baseNotes = createBassNoteSet(scale, root);
    const bars = Math.ceil(safeLoopLength / 16);
    const variant = randomInt(0, 2);
    let lastNote = root + "2";
    const anchors = [];
    for (let bar = 0; bar < bars; bar += 1) {
        const chordOffset = chordOffsetForBar(genre, bar);
        const notes = chordOffset ? offsetNoteSet(baseNotes, chordOffset) : baseNotes;
        const stepList = bassRhythmSteps(style, bar, variant);
        stepList.forEach((s, i) => {
            const step = bar * 16 + s;
            if (step < safeLoopLength) {
                anchors.push(step);
                const note = structuredBassNote(style, notes, i, s, bar, lastNote);
                lastNote = note;
            }
        });
    }
    mutateAnchoredPattern(pattern, anchors, (step, index) => {
        const bar = Math.floor(step / 16);
        const localStep = step % 16;
        const chordOffset = chordOffsetForBar(genre, bar);
        const notes = chordOffset ? offsetNoteSet(baseNotes, chordOffset) : baseNotes;
        return structuredBassNote(style, notes, index, localStep, bar, lastNote);
    }, 5);
}

function fillStructuredBass(pattern, { style = "root-pulse", loopLength = 64, scale = null, root = "C", genre = "techno" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const baseNotes = createBassNoteSet(scale, root);
    const start = Math.max(0, safeLoopLength - 16);
    const fillSteps = BASS_FILL_STEPS[style] || [8, 12, 14];
    let lastNote = root + "2";
    fillSteps.forEach((localStep, index) => {
        if (start + localStep >= safeLoopLength) return;
        const bar = Math.floor((start + localStep) / 16);
        const chordOffset = chordOffsetForBar(genre, bar);
        const notes = chordOffset ? offsetNoteSet(baseNotes, chordOffset) : baseNotes;
        const note = structuredBassNote(style, notes, index, localStep, bar, lastNote);
        pattern[start + localStep] = { active: true, note };
        lastNote = note;
    });
}

const BASS_FILL_STEPS = {
    "root-pulse": [8, 12, 14],
    offbeat: [4, 8, 12, 14],
    walking: [8, 10, 12, 14, 15],
    acid: [9, 10, 12, 13, 14, 15],
    syncopated: [7, 10, 12, 15],
    "two-step": [6, 10, 14, 15],
    "half-time": [4, 8, 12],
    gliding: [7, 10, 14],
    dub: [6, 10, 14],
    latin: [8, 11, 14, 15],
    "chill-wave": [7, 10, 14],
};

// ── MELODY STYLES ─────────────────────────────────

const MELODY_STYLES = {
    motif: { label: "Motif", steps: (bar) => [0, 4, 7, 11], density: 4 },
    arp: { label: "Arp", steps: (bar) => [0, 2, 4, 6, 8, 10, 12, 14], density: 8 },
    "call-response": { label: "Call Response", steps: (bar) => bar % 2 === 0 ? [0, 3, 6, 10] : [1, 5, 9, 13], density: 4 },
    sparse: { label: "Sparse", steps: (bar) => bar % 2 === 0 ? [0, 7, 12] : [0, 10], density: 2 },
    lead: { label: "Lead", steps: (bar) => [0, 2, 5, 7, 10, 13, 15], density: 7 },
    cascade: { label: "Cascade", steps: (bar) => {
        const offsets = [[0, 2, 4, 7, 9, 11], [0, 3, 5, 7, 10, 12], [0, 2, 6, 8, 10, 14]];
        return offsets[bar % offsets.length];
    }, density: 6 },
    sequence: { label: "Sequence", steps: (bar) => {
        const seqs = [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
        return seqs[bar % seqs.length];
    }, density: 4 },
    "random-walk": { label: "Random Walk", steps: (bar) => {
        const count = 3 + randomInt(0, 3);
        const steps = new Set([0]);
        while (steps.size < count) steps.add(randomInt(1, 15));
        return [...steps].sort((a, b) => a - b);
    }, density: 4 },
    ostinato: { label: "Ostinato", steps: (bar) => [0, 3, 5, 7, 10, 12, 14], density: 7 },
    improvisasi: { label: "Improvisasi", steps: (bar) => {
        const base = [0, 2, 5, 7, 10, 13, 15];
        if (Math.random() > 0.5) return base;
        return base.map(s => Math.random() > 0.65 ? (s + randomInt(1, 3)) % 16 : s).sort((a, b) => a - b);
    }, density: 6 },
};

const MELODY_MOTIFS = {
    arp: (notes) => notes.chord,
    sparse: (notes) => [notes.tonic, notes.fifth, notes.third],
    lead: (notes) => [notes.tonic, pickNote(notes.upper), notes.fifth, pickNote(notes.upper), notes.octave],
    "call-response": (notes) => [notes.tonic, pickNote(notes.upper), notes.fifth, pickNote(notes.lower)],
    cascade: (notes) => [notes.tonic, notes.third, notes.fifth, notes.octave, pickNote(notes.upper), notes.fifth],
    sequence: (notes) => [notes.tonic, notes.fifth, notes.octave],
    "random-walk": (notes) => {
        const len = 4 + randomInt(0, 3);
        return Array.from({ length: len }, () => pickNote(notes.pool));
    },
    ostinato: (notes) => [notes.tonic, notes.fifth, notes.octave, notes.third, notes.fifth, pickNote(notes.upper), notes.tonic],
    improvisasi: (notes) => [notes.tonic, pickNote(notes.upper), notes.fifth, pickNote(notes.upper), notes.octave, pickNote(notes.pool), pickNote(notes.lower)],
    motif: (notes) => [notes.tonic, pickNote(notes.upper), notes.fifth, pickNote(notes.upper)],
};

function createMelodyMotif(style, notes) {
    const builder = MELODY_MOTIFS[style];
    if (!builder) return MELODY_MOTIFS.motif(notes);
    return builder(notes);
}

function melodyEventForStep(style, motif, notes, step, lastNote) {
    const local = step % 16;
    const bar = Math.floor(step / 16);
    const styleDef = MELODY_STYLES[style];

    if (!styleDef) return null;
    const steps = styleDef.steps(bar);
    const index = steps.indexOf(local);
    if (index === -1) return null;

    const motifNote = (idx) => motif[idx % motif.length] || notes.tonic;
    const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.tonic });

    if (style === "arp") {
        return { active: true, note: motifNote(index + bar) };
    }
    if (style === "call-response") {
        const source = bar % 2 === 0 ? motif : [...motif].reverse();
        return { active: true, note: source[index % source.length] || notes.tonic };
    }
    if (style === "sparse") {
        return { active: true, note: motifNote(index) };
    }
    if (style === "lead") {
        return { active: true, note: motifNote(index + bar) };
    }
    if (style === "cascade") {
        const barOffset = bar % motif.length;
        return { active: true, note: motifNote(index + barOffset) };
    }
    if (style === "sequence") {
        const seqIndex = (index + bar) % motif.length;
        return { active: true, note: motif[seqIndex] };
    }
    if (style === "random-walk") {
        return { active: true, note: weighted(notes.pool) };
    }
    if (style === "ostinato") {
        const octaveShift = bar % 2 === 1 && index < 2 ? 12 : 0;
        const noteName = motifNote(index);
        const midi = noteNameToMidi(noteName) + (octaveShift > 0 && octaveShift === 12 ? 12 : 0);
        return { active: true, note: midiNoteName(midi) };
    }
    if (style === "improvisasi") {
        return { active: true, note: motifNote(index + bar) };
    }

    const variation = bar % 2 === 1 && index === steps.length - 1 ? weighted(notes.lower) : motifNote(index);
    return { active: true, note: variation || notes.tonic };
}

function melodyStepsForStyle(style, bar) {
    const styleDef = MELODY_STYLES[style];
    if (!styleDef) return [0, 4, 7, 11];
    return styleDef.steps(bar);
}

function mutateStructuredMelody(pattern, { style = "motif", loopLength = 64, scale = null, root = "C" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const notes = createMelodyNoteSet(scale, root);
    const motif = createMelodyMotif(style, notes);
    const smoothedMotif = smoothMotif(motif, notes, notes.tonic);
    const anchors = structuredStepsForLoop(safeLoopLength, (bar) => melodyStepsForStyle(style, bar));
    let lastNote = notes.tonic;
    mutateAnchoredPattern(pattern, anchors, (step) => {
        const event = melodyEventForStep(style, smoothedMotif, notes, step, lastNote);
        if (event) lastNote = event.note;
        return event?.note || pickNote(notes.pool);
    }, style === "sparse" ? 3 : 5);
}

const MELODY_FILL_STEPS = {
    arp: [8, 10, 12, 14],
    "call-response": [8, 11, 14],
    sparse: [10, 14],
    lead: [9, 11, 13, 15],
    cascade: [8, 10, 12, 14, 15],
    sequence: [6, 10, 14],
    "random-walk": [8, 12, 14, 15],
    ostinato: [8, 11, 14, 15],
    improvisasi: [9, 11, 13, 15],
    motif: [8, 11, 14],
};

function fillStructuredMelody(pattern, { style = "motif", loopLength = 64, scale = null, root = "C" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const notes = createMelodyNoteSet(scale, root);
    const motif = createMelodyMotif(style, notes);
    const smoothedMotif = smoothMotif(motif, notes, notes.tonic);
    const start = Math.max(0, safeLoopLength - 16);
    const fillSteps = MELODY_FILL_STEPS[style] || [8, 11, 14];
    let lastNote = notes.tonic;
    fillSteps.forEach((localStep, index) => {
        if (start + localStep >= safeLoopLength) return;
        const event = melodyEventForStep(style, smoothedMotif, notes, start + localStep, lastNote) || {
            active: true,
            note: motif[index % motif.length] || pickNote(notes.upper)
        };
        pattern[start + localStep] = event;
        lastNote = event.note;
    });
}

// ── MONO STYLES ───────────────────────────────────

const MONO_STYLE_STEPS = {
    stab: (bar) => [0, 6, 10, 14],
    pulse: (bar) => [0, 4, 8, 12],
    riff: (bar) => bar % 2 === 0 ? [0, 3, 6, 10, 13] : [0, 2, 5, 9, 12, 15],
    drone: (bar) => [0, 8],
    accent: (bar) => bar % 2 === 0 ? [3, 7, 11, 15] : [2, 6, 10, 14],
    sequenced: (bar) => {
        const seqs = [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
        return seqs[bar % seqs.length];
    },
    ostinato: (bar) => [0, 3, 7, 10, 12, 14],
    "dub-siren": (bar) => bar % 2 === 0 ? [0, 4, 8] : [0, 8, 12],
    "filter-sweep": (bar) => {
        const density = bar < 2 ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
        return density;
    },
    "chord-stab": (bar) => bar % 2 === 0 ? [0, 8, 12] : [4, 10, 14],
};

const MONO_NOTE_EVENTS = {
    pulse: (notes, local, bar, lastNote) => {
        if (![0, 4, 8, 12].includes(local)) return null;
        return { active: true, note: local === 8 ? notes.fifth : notes.root };
    },
    riff: (notes, local, bar, lastNote) => {
        const steps = bar % 2 === 0 ? [0, 3, 6, 10, 13] : [0, 2, 5, 9, 12, 15];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        const phrase = [notes.root, weighted(notes.color), notes.fifth, weighted(notes.color), notes.octave, weighted(notes.color)];
        return { active: true, note: phrase[index % phrase.length] || notes.root };
    },
    drone: (notes, local, bar, lastNote) => {
        if (local !== 0 && local !== 8) return null;
        return { active: true, note: local === 0 ? notes.root : notes.octave };
    },
    accent: (notes, local, bar, lastNote) => {
        const steps = bar % 2 === 0 ? [3, 7, 11, 15] : [2, 6, 10, 14];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        return { active: true, note: index % 2 === 0 ? notes.fifth : weighted(notes.color) };
    },
    stab: (notes, local, bar, lastNote) => {
        const steps = [0, 6, 10, 14];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        return { active: true, note: index === 0 ? notes.root : index === 2 ? notes.fifth : weighted(notes.color) };
    },
    sequenced: (notes, local, bar, lastNote) => {
        const seqs = [[0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]];
        const steps = seqs[bar % seqs.length];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        const pattern4 = [notes.root, notes.fifth, notes.octave, weighted(notes.color)];
        return { active: true, note: pattern4[(index + bar) % pattern4.length] };
    },
    ostinato: (notes, local, bar, lastNote) => {
        const steps = [0, 3, 7, 10, 12, 14];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        const phrase = [notes.root, notes.fifth, notes.octave, weighted(notes.color), notes.fifth, notes.root];
        const octShift = bar % 3 === 2 && index < 2 ? 12 : 0;
        const noteName = phrase[index % phrase.length] || notes.root;
        const midi = noteNameToMidi(noteName) + octShift;
        return { active: true, note: midiNoteName(midi) };
    },
    "dub-siren": (notes, local, bar, lastNote) => {
        const steps = bar % 2 === 0 ? [0, 4, 8] : [0, 8, 12];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        return { active: true, note: index === 0 ? notes.root : index === 1 ? notes.fifth : notes.octave };
    },
    "filter-sweep": (notes, local, bar, lastNote) => {
        const density = bar < 2 ? [0, 4, 8, 12] : [0, 2, 4, 6, 8, 10, 12, 14];
        const index = density.indexOf(local);
        if (index === -1) return null;
        const progressive = index + bar * 2;
        if (progressive % 3 === 0) return { active: true, note: notes.root };
        if (progressive % 3 === 1) return { active: true, note: notes.fifth };
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        return { active: true, note: weighted(notes.color) };
    },
    "chord-stab": (notes, local, bar, lastNote) => {
        const steps = bar % 2 === 0 ? [0, 8, 12] : [4, 10, 14];
        const index = steps.indexOf(local);
        if (index === -1) return null;
        const weighted = (pool) => pickWeightedNote(pool, lastNote, { preferStep: true, root: notes.root });
        return { active: true, note: index === 0 ? notes.root : index === 1 ? notes.fifth : weighted(notes.color) };
    },
};

function monoStepsForStyle(style, bar) {
    const fn = MONO_STYLE_STEPS[style];
    if (!fn) return [0, 6, 10, 14];
    return fn(bar);
}

function monoEventForStep(style, notes, step, lastNote) {
    const local = step % 16;
    const bar = Math.floor(step / 16);
    const fn = MONO_NOTE_EVENTS[style];
    if (!fn) return null;
    return fn(notes, local, bar, lastNote);
}

function mutateStructuredMono(pattern, { style = "stab", loopLength = 64, scale = null, root = "C" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const notes = createMonoNoteSet(scale, root);
    const anchors = structuredStepsForLoop(safeLoopLength, (bar) => monoStepsForStyle(style, bar));
    let lastNote = notes.root;
    mutateAnchoredPattern(pattern, anchors, (step) => {
        const event = monoEventForStep(style, notes, step, lastNote);
        if (event) lastNote = event.note;
        return event?.note || pickNote(notes.pool);
    }, style === "drone" ? 2 : 5);
}

const MONO_FILL_STEPS = {
    stab: [10, 12, 14, 15],
    pulse: [8, 10, 12, 14],
    riff: [8, 11, 13, 15],
    drone: [0, 8],
    accent: [10, 12, 15],
    sequenced: [8, 10, 14],
    ostinato: [8, 11, 14, 15],
    "dub-siren": [6, 10, 14],
    "filter-sweep": [8, 10, 12, 14, 15],
    "chord-stab": [8, 12, 14],
};

function fillStructuredMono(pattern, { style = "stab", loopLength = 64, scale = null, root = "C" } = {}) {
    const safeLoopLength = safePatternLoop(pattern, loopLength);
    const notes = createMonoNoteSet(scale, root);
    const start = Math.max(0, safeLoopLength - 16);
    const fillSteps = MONO_FILL_STEPS[style] || [10, 12, 14, 15];
    let lastNote = notes.root;
    fillSteps.forEach((localStep) => {
        if (start + localStep >= safeLoopLength) return;
        const event = monoEventForStep(style, notes, start + localStep, lastNote) || {
            active: true,
            note: pickNote(notes.color)
        };
        pattern[start + localStep] = event;
        lastNote = event.note;
    });
}

// ── DRUM GENRE PATTERNS ───────────────────────────
// Setiap genre punya: 3 varian pattern, fill chance per track, ghost note chance

const DRUM_GENRE_PATTERNS = {
    techno: {
        variants: [
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [3, 7, 11, 15], hats: [2, 6, 10, 14, 1, 5, 9, 13] },
            { kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.12, 0.02, 0.04, 0.06, 0.05, 0.06, 0.08],
        ghostChance: [0, 0, 0.15, 0, 0, 0, 0.1],
    },
    house: {
        variants: [
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [3, 7, 11, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 4, 8, 10, 12], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 5, 7, 10, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.15, 0.03, 0.05, 0.08, 0.06, 0.15, 0.12],
        ghostChance: [0, 0, 0.2, 0, 0, 0, 0.15],
    },
    breakbeat: {
        variants: [
            { kick: [0, 3, 6, 10], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [2, 6, 10, 14] },
            { kick: [0, 3, 6, 11, 14], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 4, 6, 8, 10, 12, 14] },
            { kick: [0, 2, 5, 7, 10, 13], snare: [4, 12], clap: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], hats: [2, 6, 10, 12, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.14, 0.04, 0.04, 0.12, 0.08, 0.14, 0.12],
        ghostChance: [0, 0, 0.12, 0, 0, 0, 0.1],
    },
    "hip-hop": {
        variants: [
            { kick: [0, 2, 8, 10], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [2, 6, 10, 14] },
            { kick: [0, 3, 7, 10], snare: [4, 12], clap: [0, 4, 8, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 2, 5, 8, 11], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [2, 5, 7, 10, 12, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.12, 0.03, 0.03, 0.08, 0.06, 0.12, 0.1],
        ghostChance: [0, 0, 0.08, 0, 0, 0, 0.12],
    },
    "drum-and-bass": {
        variants: [
            { kick: [0, 10], snare: [4, 12], clap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 6, 10], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 4, 10, 14], snare: [4, 12], clap: [0, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.12, 0.04, 0.04, 0.08, 0.06, 0.08, 0.12],
        ghostChance: [0, 0, 0.1, 0, 0, 0, 0.08],
    },
    trap: {
        variants: [
            { kick: [0, 2, 5, 10, 13], snare: [4, 12], clap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 3, 7, 10, 13], snare: [4, 12], clap: [0, 4, 8, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 2, 5, 8, 10, 13], snare: [8], clap: [0, 4, 8, 12], hats: [2, 5, 7, 10, 12, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.1, 0.03, 0.04, 0.06, 0.05, 0.08, 0.08],
        ghostChance: [0, 0, 0.05, 0, 0, 0, 0.05],
    },
    disco: {
        variants: [
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [3, 5, 7, 9, 11, 13, 15], hats: [0, 4, 8, 12] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], hats: [2, 6, 10, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.18, 0.04, 0.06, 0.1, 0.08, 0.18, 0.15],
        ghostChance: [0, 0, 0.18, 0, 0, 0, 0.12],
    },
    dub: {
        variants: [
            { kick: [0, 8], snare: [8], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [2, 10] },
            { kick: [0, 5, 10], snare: [8], clap: [0, 4, 8, 12], hats: [2, 6, 10, 14] },
            { kick: [0, 8, 12], snare: [4, 12], clap: [0, 4, 8, 12, 14], hats: [2, 10] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.08, 0.02, 0.03, 0.05, 0.04, 0.1, 0.06],
        ghostChance: [0, 0, 0.1, 0, 0, 0, 0.08],
    },
    rock: {
        variants: [
            { kick: [0, 8], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [0, 4, 8, 12] },
            { kick: [0, 2, 8, 10], snare: [4, 12], clap: [0, 4, 8, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [0, 4, 8, 12] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.08, 0.02, 0.02, 0.06, 0.05, 0.06, 0.08],
        ghostChance: [0, 0, 0.08, 0, 0, 0, 0.05],
    },
    metal: {
        variants: [
            { kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], clap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [0, 4, 8, 12] },
            { kick: [0, 3, 6, 8, 10, 14], snare: [4, 12], clap: [0, 4, 8, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.06, 0.03, 0.03, 0.08, 0.06, 0.06, 0.08],
        ghostChance: [0, 0, 0.05, 0, 0, 0, 0.03],
    },
    pop: {
        variants: [
            { kick: [0, 6, 8], snare: [4, 12], clap: [0, 2, 4, 6, 8, 10, 12, 14], hats: [2, 10] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [0, 4, 8, 12], hats: [2, 6, 10, 14] },
            { kick: [0, 8, 10], snare: [4, 12], clap: [3, 7, 11, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.12, 0.03, 0.03, 0.06, 0.05, 0.08, 0.08],
        ghostChance: [0, 0, 0.1, 0, 0, 0, 0.08],
    },
    funky: {
        variants: [
            { kick: [0, 2, 3, 8, 10], snare: [4, 12], clap: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 2, 5, 8, 10, 13], snare: [4, 12], clap: [0, 4, 8, 12], hats: [2, 5, 7, 10, 12, 14] },
            { kick: [0, 3, 6, 8, 11], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 6, 10, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.15, 0.04, 0.04, 0.1, 0.08, 0.14, 0.12],
        ghostChance: [0, 0, 0.12, 0, 0, 0, 0.1],
    },
    // ── NEW GENRES ──
    garage: {
        variants: [
            { kick: [0, 3, 8, 11], snare: [4, 12], clap: [0, 4, 8, 12], hats: [2, 5, 7, 10, 12, 14] },
            { kick: [0, 3, 6, 10], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [2, 6, 10, 14] },
            { kick: [0, 8, 11, 14], snare: [4, 12], clap: [0, 4, 8, 12], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.14, 0.03, 0.04, 0.08, 0.06, 0.1, 0.1],
        ghostChance: [0, 0, 0.15, 0, 0, 0, 0.12],
    },
    electro: {
        variants: [
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [0, 4, 8, 12], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [1, 5, 9, 13], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 8, 12], snare: [4, 12], clap: [3, 7, 11, 15], hats: [2, 4, 6, 8, 10, 12, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.1, 0.02, 0.03, 0.05, 0.04, 0.06, 0.08],
        ghostChance: [0, 0, 0.08, 0, 0, 0, 0.06],
    },
    minimal: {
        variants: [
            { kick: [0, 8], snare: [8], clap: [0, 4, 8, 12], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [8], clap: [4, 12], hats: [2, 10] },
            { kick: [0, 8, 12], snare: [4, 12], clap: [0, 8], hats: [2, 6, 10, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.06, 0.01, 0.02, 0.03, 0.02, 0.04, 0.04],
        ghostChance: [0, 0, 0.05, 0, 0, 0, 0.03],
    },
    "hard-techno": {
        variants: [
            { kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], clap: [1, 3, 5, 7, 9, 11, 13, 15], hats: [0, 2, 4, 6, 8, 10, 12, 14] },
            { kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], clap: [3, 7, 11, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 3, 6, 8, 10, 14], snare: [4, 12], clap: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], hats: [0, 4, 8, 12] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.05, 0.03, 0.03, 0.06, 0.05, 0.05, 0.06],
        ghostChance: [0, 0, 0.03, 0, 0, 0, 0.02],
    },
    "deep-house": {
        variants: [
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [1, 5, 9, 13], hats: [2, 6, 10, 14] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [3, 7, 11, 15], hats: [1, 3, 5, 7, 9, 11, 13, 15] },
            { kick: [0, 4, 8, 12], snare: [4, 12], clap: [0, 4, 8, 12], hats: [2, 5, 7, 10, 14] },
        ],
        density: [0, 0, 0, 0],
        fillChance: [0.1, 0.02, 0.03, 0.05, 0.04, 0.08, 0.08],
        ghostChance: [0, 0, 0.12, 0, 0, 0, 0.1],
    },
};

// ── DRUM GENERATION ───────────────────────────────

function generateGenreDrum(pattern, genre, loopLength = 16) {
    const config = DRUM_GENRE_PATTERNS[genre] || DRUM_GENRE_PATTERNS.techno;
    const variantIndex = randomInt(0, config.variants.length - 1);
    const variant = config.variants[variantIndex];

    for (let track = 0; track < pattern.length; track += 1) {
        for (let step = 0; step < pattern[track].length; step += 1) {
            pattern[track][step] = false;
        }
        const trackLocks = drumTrackLocks(genre, track, variant, config);
        const mainChance = 0.92;
        const fillChance = config.fillChance[track] || 0.05;
        const ghostChance = config.ghostChance[track] || 0;

        for (let pageOffset = 0; pageOffset < loopLength; pageOffset += 16) {
            for (let localStep = 0; localStep < 16 && pageOffset + localStep < loopLength; localStep += 1) {
                const isLocked = trackLocks.includes(localStep);
                const chance = isLocked ? mainChance : fillChance;
                if (Math.random() < chance) {
                    pattern[track][pageOffset + localStep] = true;
                }
                if (ghostChance > 0 && !pattern[track][pageOffset + localStep] && Math.random() < ghostChance) {
                    pattern[track][pageOffset + localStep] = true;
                }
            }
        }
    }
}

function drumTrackLocks(genre, track, variant, config) {
    if (track === 0) return variant.kick;
    if (track === 1) return variant.snare;
    if (track === 2) return variant.clap;
    if (track === 5) return variant.clap;
    if (track === 6) return variant.hats;
    if (track === 3 || track === 4) return drumTomLocks(genre, track);
    return [];
}

function drumTomLocks(genre, track) {
    const tomPatterns = {
        techno: { 3: [7, 15], 4: [3, 11] },
        house: { 3: [7], 4: [15] },
        breakbeat: { 3: [6, 11], 4: [14] },
        "drum-and-bass": { 3: [7, 13], 4: [15] },
        trap: { 3: [11], 4: [15] },
        metal: { 3: [2, 6, 10, 14], 4: [0, 4, 8, 12] },
        funky: { 3: [3, 8, 13], 4: [15] },
        disco: { 3: [7, 15], 4: [3, 11] },
        rock: { 3: [6, 14], 4: [2, 10] },
        dub: { 3: [], 4: [15] },
        garage: { 3: [5, 11], 4: [14] },
        electro: { 3: [6, 14], 4: [10] },
        minimal: { 3: [7], 4: [14] },
        "hard-techno": { 3: [3, 7, 11, 15], 4: [1, 5, 9, 13] },
        "deep-house": { 3: [7], 4: [15] },
    };
    const gPatterns = tomPatterns[genre] || tomPatterns.techno;
    const steps = gPatterns[track];
    return steps || [15];
}

// ── NOTE SET HELPERS ──────────────────────────────

function createMonoNoteSet(scale, root) {
    const rootIndex = Math.max(0, MIDI_NOTE_NAMES.indexOf(root));
    const intervals = Array.isArray(scale?.intervals) && scale.intervals.length
        ? scale.intervals.map((interval) => ((Number(interval) % 12) + 12) % 12)
        : Array.from({ length: 12 }, (_, index) => index);
    const pitchClasses = new Set(intervals.map((interval) => (rootIndex + interval) % 12));
    const pool = [];
    for (let note = 36; note <= 67; note += 1) {
        if (pitchClasses.has(note % 12)) pool.push(note);
    }
    if (!pool.length) pool.push(noteNameToMidi(`${root}3`));

    const rootMidi = nearestPitchClass(pool, rootIndex, 48);
    const fifthMidi = nearestPitchClass(pool, (rootIndex + 7) % 12, rootMidi + 7);
    const octaveMidi = nearestPitchClass(pool, rootIndex, rootMidi + 12);
    const colorPool = pool.filter((note) => ![rootMidi, fifthMidi, octaveMidi].includes(note));

    return {
        root: midiNoteName(rootMidi),
        fifth: midiNoteName(fifthMidi),
        octave: midiNoteName(octaveMidi),
        color: (colorPool.length ? colorPool : pool).map(midiNoteName),
        pool: pool.map(midiNoteName)
    };
}

function createMelodyNoteSet(scale, root) {
    const rootIndex = Math.max(0, MIDI_NOTE_NAMES.indexOf(root));
    const intervals = Array.isArray(scale?.intervals) && scale.intervals.length
        ? scale.intervals.map((interval) => ((Number(interval) % 12) + 12) % 12)
        : Array.from({ length: 12 }, (_, index) => index);
    const pitchClasses = new Set(intervals.map((interval) => (rootIndex + interval) % 12));
    const pool = [];
    for (let note = 48; note <= 79; note += 1) {
        if (pitchClasses.has(note % 12)) pool.push(note);
    }
    if (!pool.length) pool.push(noteNameToMidi(`${root}4`));

    const tonic = nearestPitchClass(pool, rootIndex, 60);
    const third = nearestPitchClass(pool, (rootIndex + 4) % 12, tonic + 4);
    const fifth = nearestPitchClass(pool, (rootIndex + 7) % 12, tonic + 7);
    const octave = nearestPitchClass(pool, rootIndex, tonic + 12);
    const upper = pool.filter((note) => note >= tonic && note <= tonic + 16);
    const lower = pool.filter((note) => note >= tonic - 12 && note <= tonic + 7);

    return {
        tonic: midiNoteName(tonic),
        third: midiNoteName(third),
        fifth: midiNoteName(fifth),
        octave: midiNoteName(octave),
        chord: [tonic, third, fifth, octave].map(midiNoteName),
        upper: (upper.length ? upper : pool).map(midiNoteName),
        lower: (lower.length ? lower : pool).map(midiNoteName),
        pool: pool.map(midiNoteName)
    };
}

// ── UTILITIES ─────────────────────────────────────

function nearestPitchClass(pool, pitchClass, target) {
    const candidates = pool.filter((note) => note % 12 === pitchClass);
    const source = candidates.length ? candidates : pool;
    return source.reduce((best, note) => (
        Math.abs(note - target) < Math.abs(best - target) ? note : best
    ), source[0]);
}

function createWalkingNotes(pool, rootMidi) {
    const sorted = [...pool].sort((a, b) => a - b);
    const startIndex = Math.max(0, sorted.findIndex((note) => note >= rootMidi));
    const walk = [];
    for (let i = 0; i < 8; i += 1) {
        walk.push(sorted[(startIndex + i) % sorted.length]);
    }
    return walk.length ? walk : [rootMidi];
}

function safePatternLoop(pattern, loopLength) {
    return Math.max(1, Math.min(pattern.length, Number(loopLength) || pattern.length));
}

function applyPhraseRepeat(pattern, loopLength) {
    if (loopLength < 32) return;
    const phraseLen = 32;
    for (let step = phraseLen; step < Math.min(loopLength, pattern.length); step++) {
        const src = pattern[step - phraseLen];
        if (!src) continue;
        const transpose = Math.floor(step / phraseLen) * (Math.random() > 0.6 ? 12 : 0);
        const noteMidi = noteNameToMidi(src.note) + transpose;
        pattern[step] = {
            active: src.active,
            note: midiNoteName(Math.max(0, Math.min(127, noteMidi)))
        };
    }
}

function smoothMotif(motif, notes, defaultNote) {
    if (!motif.length) return motif;
    let prev = noteNameToMidi(defaultNote || motif[0]);
    return motif.map((noteName) => {
        const midi = noteNameToMidi(noteName);
        const interval = Math.abs(midi - prev);
        if (interval <= 4) {
            prev = midi;
            return noteName;
        }
        const direction = midi > prev ? 1 : -1;
        const candidates = [];
        for (let i = 1; i <= 3; i++) {
            const target = prev + direction * i;
            const match = notes.pool.find((n) => noteNameToMidi(n) === target);
            if (match) candidates.push(match);
        }
        if (candidates.length) {
            const chosen = candidates[randomInt(0, candidates.length - 1)];
            prev = noteNameToMidi(chosen);
            return chosen;
        }
        prev = midi;
        return noteName;
    });
}

function structuredStepsForLoop(loopLength, localStepFactory) {
    const steps = [];
    for (let bar = 0; bar < Math.ceil(loopLength / 16); bar += 1) {
        localStepFactory(bar).forEach((localStep) => {
            const step = bar * 16 + localStep;
            if (step < loopLength) steps.push(step);
        });
    }
    return steps;
}

function mutateAnchoredPattern(pattern, anchors, noteForStep, count) {
    if (!anchors.length) return;
    for (let i = 0; i < count; i += 1) {
        const step = anchors[randomInt(0, anchors.length - 1)];
        const current = pattern[step] || { active: false, note: noteForStep(step, i), velocity: 0x60 };
        const newNote = noteForStep(step, i);
        pattern[step] = {
            active: Math.random() < 0.35 ? !current.active : true,
            note: Math.random() < 0.7 ? newNote : current.note,
            velocity: current.velocity || 0x60,
        };
    }
}

function createScaleNotePool(mode, scale, root, fill) {
    const range = noteRangeFor(mode, fill);
    const rootIndex = MIDI_NOTE_NAMES.indexOf(root);
    const intervals = Array.isArray(scale?.intervals) && scale.intervals.length
        ? scale.intervals.map((interval) => ((Number(interval) % 12) + 12) % 12)
        : Array.from({ length: 12 }, (_, index) => index);
    const pitchClasses = new Set(intervals.map((interval) => (Math.max(0, rootIndex) + interval) % 12));
    const pool = [];
    for (let note = range.min; note <= range.max; note += 1) {
        if (pitchClasses.has(note % 12)) pool.push(midiNoteName(note));
    }
    return pool.length ? pool : [midiNoteName(range.min)];
}

function noteRangeFor(mode, fill) {
    if (mode === "bass") return { min: 24, max: fill ? 47 : 43 };
    if (mode === "melody") return { min: fill ? 55 : 48, max: fill ? 79 : 72 };
    return { min: 36, max: 60 };
}

function pickNote(notePool) {
    if (!notePool.length) return "C2";
    return notePool[randomInt(0, notePool.length - 1)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── CHORD PROGRESSIONS ─────────────────────────────

const CHORD_PROGRESSIONS = {
    techno: [0, 7, 3, 5],
    house: [0, 5, 7, 5],
    "drum-and-bass": [0, 10, 5, 7],
    "hip-hop": [0, 5, 7, 0],
    breakbeat: [0, 5, 7, 0],
    ambient: [0, 3, 7, 5],
    acid: [0, 5, 10, 3],
    trap: [0, 5, 3, 7],
    disco: [0, 5, 7, 0],
    dub: [0, 10, 3, 7],
    garage: [0, 5, 7, 5],
    electro: [0, 7, 3, 0],
    minimal: [0, 3, 5, 7],
    "hard-techno": [0, 3, 7, 5],
    "deep-house": [0, 5, 7, 5],
    rock: [0, 5, 7, 0],
    pop: [0, 5, 7, 5],
    funky: [0, 5, 7, 0],
    metal: [0, 5, 7, 0],
    default: [0, 5, 7, 0],
};

function chordOffsetForBar(genre, bar) {
    const prog = CHORD_PROGRESSIONS[genre] || CHORD_PROGRESSIONS.default;
    return prog[bar % prog.length];
}

function offsetNoteSet(notes, offset) {
    if (!offset) return notes;
    const shift = (name) => {
        const midi = noteNameToMidi(name) + offset;
        return midiNoteName(Math.max(0, Math.min(127, midi)));
    };
    return {
        root: shift(notes.root),
        fifth: shift(notes.fifth),
        octave: shift(notes.octave),
        leading: shift(notes.leading),
        passing: notes.passing.map(shift),
        walk: notes.walk.map(shift),
    };
}

function pickWeightedNote(notePool, lastNote, options = {}) {
    if (!notePool.length) return "C2";
    if (!lastNote || !options.preferStep) return pickNote(notePool);

    const lastMidi = noteNameToMidi(lastNote);
    const rootMidi = options.root ? noteNameToMidi(options.root) : noteNameToMidi(notePool[0]);
    const rootPc = rootMidi % 12;
    const fifthPc = (rootPc + 7) % 12;

    const scored = notePool.map((name) => {
        const midi = noteNameToMidi(name);
        const interval = Math.abs(midi - lastMidi);
        let score = 0;
        if (interval === 0) score = 0.7;
        else if (interval <= 2) score = 1.0;
        else if (interval <= 4) score = 0.6;
        else if (interval <= 7) score = 0.3;
        else score = 0.1;
        const pc = midi % 12;
        if (pc === rootPc) score += 0.4;
        if (pc === fifthPc) score += 0.2;
        return { name, score };
    });

    const total = scored.reduce((s, e) => s + e.score, 0);
    if (total <= 0) return pickNote(notePool);
    let r = Math.random() * total;
    for (const entry of scored) {
        r -= entry.score;
        if (r <= 0) return entry.name;
    }
    return scored[scored.length - 1].name;
}
