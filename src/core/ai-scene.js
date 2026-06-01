import { SCENE_DEFINITIONS, SCENE_TYPES, GENRE_PROFILES, SCALE_DEFINITIONS } from "./constants.js";
import { SEQUENCER_MODES, BANK_COUNT, PRESET_COUNT, activePattern as getActivePattern, getLoopLength, DRUM_VOICE_ORDER } from "./pattern-store.js";
import { noteNameToMidi, midiNoteName } from "./utils.js";

export class SceneManager {
    constructor({ bridge, randomizer, state } = {}) {
        if (!bridge && !state) throw new Error("SceneManager: bridge or state required");
        this.bridge = bridge;
        this._state = state || bridge?.state;
        this.randomizer = randomizer || bridge?.randomizer;
        this._lastArrangement = null;
    }

    get state() { return this.bridge?.state || this._state; }

    // ── Public API ─────────────────────────────────

    compose(genreId, customScenes = null) {
        const profile = GENRE_PROFILES[genreId];
        if (!profile) return { ok: false, error: `Unknown genre: ${genreId}` };

        const sceneTypes = customScenes || profile.sceneStructure;
        if (!sceneTypes || !sceneTypes.length) return { ok: false, error: "No scenes to compose" };

        const bank = this._pickBank();
        this.bridge._saveUndo();
        this._lastArrangement = { genre: genreId, bank, scenes: [] };

        // Set global genre params
        this._applyGenreGlobals(profile);

        // Compose each scene
        for (let i = 0; i < sceneTypes.length && i < PRESET_COUNT; i++) {
            const sceneType = sceneTypes[i];
            const def = SCENE_DEFINITIONS.find((s) => s.id === sceneType);
            if (!def) continue;

            const slot = i;
            const sceneResult = this._composeScene(profile, def, bank, slot, i, sceneTypes.length);
            this._lastArrangement.scenes.push({
                scene: sceneType,
                bank,
                slot,
                layers: { ...def.layers },
            });
        }

        // Activate first scene
        this._activateSlot(bank, 0);
        this.bridge?.commit();

        return this._arrangementSummary(profile, bank);
    }

    activateScene(index) {
        if (!this._lastArrangement) return false;
        const scenes = this._lastArrangement.scenes;
        if (index < 0 || index >= scenes.length) return false;
        const s = scenes[index];
        this._activateSlot(s.bank, s.slot);
        this.bridge?.commit();
        return true;
    }

    getArrangement() {
        return this._lastArrangement ? { ...this._lastArrangement } : null;
    }

    // ── Internal ────────────────────────────────────

    _pickBank() {
        const active = this.state.activeBanks?.drum ?? 0;
        for (let b = 0; b < BANK_COUNT; b++) {
            if (b !== active) return b;
        }
        return (active + 1) % BANK_COUNT;
    }

    _applyGenreGlobals(profile) {
        this.state.bpm = profile.defaultTempo;
        this.state.noteScale = profile.scale;
        this.state.drumRandomGenre = profile.drumGenre;
        this.state.bassSound = profile.bassStyle;
        this.state.melodySound = profile.melodyStyle;
        this.state.otherSound = profile.otherStyle;

        for (const kind of ["bass", "melody", "other"]) {
            const gen = kind === "other" ? profile.monoGenerator : kind === "melody" ? profile.melodyGenerator : profile.pitchGenerator;
            if (gen) {
                this.state.pitchGeneratorModes[kind] = gen.mode || "structured";
                this.state.pitchGeneratorRoles[kind] = gen.role || (kind === "other" ? "mono" : kind);
                this.state.pitchGeneratorStyles[kind] = gen.style || "root-pulse";
            }
        }

        this.state.noteRoot = "C";
    }

    _composeScene(profile, sceneDef, bank, slot, sceneIndex, totalScenes) {
        const layers = sceneDef.layers;
        const bars = sceneDef.defaultBars;
        const isLast = sceneIndex === totalScenes - 1;

        // Set loop lengths for this slot
        const drumLoops = [16, 32, 64];
        const noteLoops = [64, 128, 256];
        const drumLen = clampLoop(closestPower(bars * 4, drumLoops), drumLoops);
        const noteLen = clampLoop(closestPower(bars * 16, noteLoops), noteLoops);

        for (const kind of SEQUENCER_MODES) {
            this.state.presetLoopLengths[kind][bank][slot] = kind === "drum" ? drumLen : noteLen;
        }

        // Generate per-layer
        for (const kind of SEQUENCER_MODES) {
            const layer = layers[kind];
            if (!layer || layer.density === "none") {
                this._clearSlotPattern(kind, bank, slot);
                continue;
            }

            // Generate base pattern into target slot
            this._generateForSlot(profile, kind, layer, bank, slot, sceneDef.energy, sceneIndex);
        }

        return { bank, slot, bars };
    }

    _clearSlotPattern(kind, bank, slot) {
        const mem = this.state.memory[kind][bank][slot];
        if (kind === "drum") {
            for (let t = 0; t < mem.length; t++) {
                for (let s = 0; s < mem[t].length; s++) mem[t][s] = false;
            }
        } else {
            const defaultNote = kind === "bass" ? "C1" : "C2";
            for (let s = 0; s < mem.length; s++) {
                mem[s] = { active: false, note: defaultNote };
            }
        }
    }

     _generateForSlot(profile, kind, layer, bank, slot, energy, sceneIndex) {
         // Temporarily activate this slot for generation
         const prevBank = this.state.activeBanks[kind];
         const prevSlot = this.state.activeSlots[kind];
         this.state.activeBanks[kind] = bank;
         this.state.activeSlots[kind] = slot;

         const pattern = getActivePattern(this.state, kind);
         if (!pattern) {
             this.state.activeBanks[kind] = prevBank;
             this.state.activeSlots[kind] = prevSlot;
             return;
         }

         const loopLen = getLoopLength(this.state, kind);
         const scaleDef = SCALE_DEFINITIONS.find((s) => s.id === this.state.noteScale);
         const rootNote = this.state.noteRoot;
         const drumGenre = this.state.drumRandomGenre;

         // Clear pattern first
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

         // Generate based on kind using theory-based approaches
         if (kind === "drum") {
             this._generateDrumPattern(pattern, drumGenre, loopLen, sceneIndex);
         } else if (kind === "bass") {
             this._generateBassPattern(pattern, scaleDef, rootNote, loopLen, sceneIndex);
         } else if (kind === "melody") {
             this._generateMelodyPattern(pattern, scaleDef, rootNote, loopLen, sceneIndex);
         } else if (kind === "other") {
             this._generateOtherPattern(pattern, scaleDef, rootNote, loopLen, sceneIndex);
         }

         // Restore original slot
         this.state.activeBanks[kind] = prevBank;
         this.state.activeSlots[kind] = prevSlot;
     }

     _adjustDensity(kind, pattern, layer, loopLen) {
         const densityMap = {
             none: 0,
             minimal: 0.08,
             low: 0.25,
             medium: 0.55,
             high: 1.0,
         };

         const targetDensity = densityMap[layer.density] ?? 0.5;
         if (targetDensity >= 1) return;

         if (kind === "drum") {
             for (let t = 0; t < pattern.length; t++) {
                 for (let s = 0; s < Math.min(loopLen, pattern[t].length); s++) {
                     if (!pattern[t][s]) continue;
                     // Keep structural kicks (index 0, 4, 8, 12) and snares (index 4, 12)
                     const isStructural = (t === 0 && [0, 4, 8, 12].includes(s % 16)) || (t === 1 && [4, 12].includes(s % 16));
                     if (isStructural) continue;
                     if (Math.random() > targetDensity) pattern[t][s] = false;
                 }
             }
         } else {
             const active = [];
             for (let s = 0; s < Math.min(loopLen, pattern.length); s++) {
                 if (pattern[s]?.active) active.push(s);
             }
             if (!active.length) return;

             const isAnchor = (step) => {
                 const local = step % 16;
                 return local === 0 || local === 8;
             };

             // Separate anchors from non-anchors
             const anchors = active.filter(isAnchor);
             const nonAnchors = active.filter((s) => !isAnchor(s));

             if (layer.density === "minimal" || layer.density === "low") {
                 // Keep all anchors, remove most non-anchors
                 for (const s of nonAnchors) {
                     if (Math.random() > targetDensity) pattern[s].active = false;
                 }
             } else {
                 // Keep anchors, selectively remove non-anchors
                 const targetNonAnchors = Math.max(0, Math.round(nonAnchors.length * targetDensity));
                 if (nonAnchors.length > targetNonAnchors) {
                     shuffleArray(nonAnchors);
                     const toKeep = new Set(nonAnchors.slice(0, targetNonAnchors));
                     for (const s of nonAnchors) {
                         if (!toKeep.has(s)) pattern[s].active = false;
                     }
                 }
             }
         }
     }

     _generateDrumPattern(pattern, genre, loopLength, sceneIndex) {
         // Use DRUM_GENRE_PATTERNS but make it deterministic based on sceneIndex
         const config = DRUM_GENRE_PATTERNS[genre] || DRUM_GENRE_PATTERNS.techno;
         // Use sceneIndex to pick variant deterministically
         const variantIndex = sceneIndex % config.variants.length;
         const variant = config.variants[variantIndex];

         for (let track = 0; track < pattern.length; track++) {
             for (let step = 0; step < pattern[track].length; step++) {
                 pattern[track][step] = false;
             }
         }

         for (let track = 0; track < pattern.length; track++) {
             const voice = DRUM_VOICE_ORDER[track];
             let steps = [];
             if (variant.hasOwnProperty(voice)) {
                 steps = variant[voice];
             } else if (voice === "tom-hi" || voice === "tom-lo") {
                 // Simple tom pattern: tom-hi on 8, tom-lo on 12 (can be varied by sceneIndex)
                 const offset = sceneIndex % 4; // 0,1,2,3
                 steps = voice === "tom-hi" ? [8 + offset] : [12 + offset];
                 // Keep within 0-15
                 steps = steps.map(s => s % 16);
             } else if (voice === "hat-close" || voice === "hat-open") {
                 // Use hats pattern from variant.hats
                 steps = variant.hats || [];
                 // Add some variation based on sceneIndex: shift the pattern
                 const shift = sceneIndex % 4;
                 steps = steps.map(s => (s + shift) % 16);
             }
             // Apply steps modulo loopLength
             for (const baseStep of steps) {
                 for (let offset = 0; offset < loopLength; offset += 16) {
                     const step = baseStep + offset;
                     if (step < loopLength) {
                         pattern[track][step] = true;
                     }
                 }
             }
         }
     }

     _generateBassPattern(pattern, scaleDef, rootNote, loopLength, sceneIndex) {
         // Reset pattern
         for (let step = 0; step < pattern.length; step++) {
             pattern[step] = { active: false, note: rootNote, velocity: 0x60 };
         }

         if (!scaleDef) return;
         const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
         const rootMidi = noteNameToMidi(rootNote);
         const fifthMidi = (rootMidi + 7) % 128;
         const fifthNote = midiNoteName(fifthMidi);

         // Create a simple bass pattern that alternates root and fifth every quarter note
         // Vary the pattern slightly with sceneIndex: sometimes play root on beat 1 and 3, fifth on 2 and 4
         const useRootOnBeat = sceneIndex % 2 === 0; // alternate between two feels
         for (let step = 0; step < loopLength; step++) {
             const beatPos = step % 4; // 0,1,2,3
             let isRoot = false;
             if (useRootOnBeat) {
                 isRoot = beatPos === 0 || beatPos === 2; // root on 1 and 3
             } else {
                 isRoot = beatPos === 0 || beatPos === 1; // root on 1 and 2? Actually let's do root on downbeat and fifth on upbeat? We'll keep simple.
             }
             // Actually let's do a simple pattern: root on beats 0 and 2 (if using 16th note steps? Wait our loopLength is in steps, each step is a 16th note? In our sequencer, each step is a 16th note? The pattern length for bass is NOTE_STEP_COUNT = 256 steps per bank? Actually the pattern for bass is an array of length NOTE_STEP_COUNT (256) representing 16th notes over 4 bars? But we are using loopLength which is the number of steps in the pattern (e.g., 64 for one bar of 16th notes? Actually for bass, the loopLength is set in presetLoopLengths, which for note modes is 64, 128, or 256 steps. We'll assume loopLength is the number of 16th notes in the pattern.
             // We'll just keep the simple pattern: root on step 0, fifth on step 8, etc. but we need to map to our step index.
             // Let's instead use a fixed pattern that works regardless of loopLength: play root on every quarter note (steps 0, 4, 8, 12, ...) and fifth on the off quarter notes (steps 2, 6, 10, 14, ...) if we want a walking bass? Actually we'll do a simple root-fifth alternation every quarter note.
             const isQuarter = step % 4 === 0;
             const isOffQuarter = step % 4 === 2;
             if (isQuarter) {
                 pattern[step] = { active: true, note: rootNote, velocity: 0x80 };
             } else if (isOffQuarter) {
                 pattern[step] = { active: true, note: fifthNote, velocity: 0x70 };
             } else {
                 // Optionally add ghost notes on the eights? We'll leave inactive.
                 pattern[step] = { active: false, note: rootNote, velocity: 0x60 };
             }
         }
     }

     _generateMelodyPattern(pattern, scaleDef, rootNote, loopLength, sceneIndex) {
         // Reset pattern
         for (let step = 0; step < pattern.length; step++) {
             pattern[step] = { active: false, note: rootNote, velocity: 0x60 };
         }

         if (!scaleDef) return;
         const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
         const rootMidi = noteNameToMidi(rootNote);
         const scaleNotes = scaleDef.intervals.map(interval => midiNoteName((rootMidi + interval) % 128));

         // Create a simple motif: play a repeating sequence of scale degrees
         // Vary the motif based on sceneIndex
         const motifs = [
             [0, 2, 4, 2], // up and down
             [0, 3, 5, 3], // another motif
             [0, 4, 2, 0], // down and up
             [0, 2, 0, 4]  // jump
         ];
         const motif = motifs[sceneIndex % motifs.length];
         // Play a note every 2 steps (eighth notes) to create a faster melody.
         for (let step = 0; step < loopLength; step++) {
             if (step % 2 === 0) {
                 const motifIdx = (step / 2) % motif.length;
                 const scaleIdx = motif[motifIdx];
                 if (scaleIdx < scaleNotes.length) {
                     pattern[step] = { active: true, note: scaleNotes[scaleIdx], velocity: 0x70 };
                 }
             }
         }
     }

     _generateOtherPattern(pattern, scaleDef, rootNote, loopLength, sceneIndex) {
         // Reset pattern
         for (let step = 0; step < pattern.length; step++) {
             pattern[step] = { active: false, note: rootNote, velocity: 0x60 };
         }

         if (!scaleDef) return;
         const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
         const rootMidi = noteNameToMidi(rootNote);
         const scaleNotes = scaleDef.intervals.map(interval => midiNoteName((rootMidi + interval) % 128));

         // Create a simple rhythmic pattern: play on every quarter note, using the root and fifth alternating.
         // Vary the pattern with sceneIndex: sometimes play a chord stab.
         const useChord = sceneIndex % 3 === 0; // every third scene use a chord (root, third, fifth)
         const thirdMidi = (rootMidi + 4) % 128; // major third
         const thirdNote = midiNoteName(thirdMidi);
         const fifthMidi = (rootMidi + 7) % 128;
         const fifthNote = midiNoteName(fifthMidi);

         for (let step = 0; step < loopLength; step++) {
             if (step % 4 === 0) { // beats 0,4,8,12
                 if (useChord) {
                     // Play a chord: we can't play multiple notes in a mono track, so we'll arpeggiate quickly? Instead we'll just play the root.
                     pattern[step] = { active: true, note: rootNote, velocity: 0x60 };
                 } else {
                     const noteIdx = (step / 4) % 2; // alternate between 0 and 1
                     const note = noteIdx === 0 ? rootNote : (scaleNotes[4] || rootNote); // fifth if exists
                     pattern[step] = { active: true, note, velocity: 0x60 };
                 }
             }
         }
     }

    _activateSlot(bank, slot) {
        for (const kind of SEQUENCER_MODES) {
            this.state.activeBanks[kind] = bank;
            this.state.activeSlots[kind] = slot;
        }
    }

    _arrangementSummary(profile, bank) {
        const scenes = this._lastArrangement.scenes;
        const sceneLabels = scenes.map((s, i) => {
            const def = SCENE_DEFINITIONS.find((d) => d.id === s.scene);
            return `${def?.label || s.scene} (P${i + 1})`;
        });

        return {
            ok: true,
            genre: profile.label,
            bank,
            sceneCount: scenes.length,
            scenes: sceneLabels,
            summary: `Arranged ${profile.label} (${scenes.length} scenes) in Bank ${bank + 1}. ${sceneLabels.join(" → ")}`,
        };
    }
}

// ── Helpers ────────────────────────────────────

function clampPower(value, arr) {
    return arr.reduce((best, v) => Math.abs(v - value) < Math.abs(best - value) ? v : best, arr[0]);
}

function closestPower(value, options) {
    return options.reduce((best, v) => Math.abs(v - value) < Math.abs(best - value) ? v : best, options[0]);
}

function clampLoop(value) {
    return value;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
