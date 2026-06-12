import { SCENE_DEFINITIONS, SCENE_TYPES, GENRE_PROFILES, SCALE_DEFINITIONS, MIDI_NOTE_NAMES } from "./constants.js";
import { SEQUENCER_MODES, BANK_COUNT, PRESET_COUNT, activePattern as getActivePattern, getLoopLength, DRUM_VOICE_ORDER } from "./pattern-store.js";
import { noteNameToMidi, midiNoteName } from "./utils.js";
import { DRUM_GENRE_PATTERNS } from "./randomizer.js";

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

    composeCustom(genreId, customScenes) {
        const profile = GENRE_PROFILES[genreId];
        if (!profile) return { ok: false, error: `Unknown genre: ${genreId}` };
        if (!customScenes || !customScenes.length) return { ok: false, error: "No scenes provided" };

        const bank = this._pickBank();
        this.bridge._saveUndo();
        this._lastArrangement = { genre: genreId, bank, scenes: [] };

        this._applyGenreGlobals(profile);

        const validDensities = ["none", "minimal", "low", "medium", "high"];

        for (let i = 0; i < customScenes.length && i < PRESET_COUNT; i++) {
            const custom = customScenes[i];
            const bars = custom.bars || 4;
            const clampDensity = (v) => validDensities.includes(v) ? v : "medium";

            const layers = {
                drum: { density: clampDensity(custom.layers?.drum || "low"), complexity: "custom" },
                bass: { density: clampDensity(custom.layers?.bass || "none"), complexity: "custom" },
                melody: { density: clampDensity(custom.layers?.melody || "none"), complexity: "custom" },
                other: { density: clampDensity(custom.layers?.other || "none"), complexity: "custom" },
            };

            const virtualDef = {
                id: `custom-${i}`,
                label: custom.name || `Scene ${i + 1}`,
                defaultBars: bars,
                description: custom.name || "",
                layers,
                energy: custom.energy ?? 0.5,
            };

            const slot = i;
            this._composeScene(profile, virtualDef, bank, slot, i, customScenes.length);
            this._lastArrangement.scenes.push({
                scene: virtualDef.label,
                bank,
                slot,
                layers: { ...layers },
            });
        }

        this._activateSlot(bank, 0);
        this.bridge?.commit();

        const sceneLabels = this._lastArrangement.scenes.map((s, i) => `${s.scene} (P${i + 1})`);
        return {
            ok: true,
            genre: profile.label,
            bank,
            sceneCount: customScenes.length,
            scenes: sceneLabels,
            summary: `Custom "${profile.label}" — ${customScenes.length} scenes at Bank ${bank + 1}\n` + sceneLabels.map((s, i) => `  P${i + 1}: ${s}`).join("\n"),
        };
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
            mem[s] = { active: false, note: defaultNote, tie: false };
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
                 pattern[s] = { active: false, note: defaultNote, tie: false };
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
            pattern[step] = { active: false, note: rootNote, velocity: 0x60, tie: false };
        }

        if (!scaleDef) return;
        const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
        const rootMidi = noteNameToMidi(rootNote);
        const fifthMidi = (rootMidi + 7) % 128;
        const fifthNote = midiNoteName(fifthMidi);

        const useRootOnBeat = sceneIndex % 2 === 0;
        for (let step = 0; step < loopLength; step++) {
            const isQuarter = step % 4 === 0;
            const isOffQuarter = step % 4 === 2;
            if (isQuarter) {
                pattern[step] = { active: true, note: rootNote, velocity: 0x80, tie: false };
            } else if (isOffQuarter) {
                pattern[step] = { active: true, note: fifthNote, velocity: 0x70, tie: false };
            } else {
                pattern[step] = { active: false, note: rootNote, velocity: 0x60, tie: false };
            }
        }
     }

     _generateMelodyPattern(pattern, scaleDef, rootNote, loopLength, sceneIndex) {
        // Reset pattern
        for (let step = 0; step < pattern.length; step++) {
            pattern[step] = { active: false, note: rootNote, velocity: 0x60, tie: false };
        }

        if (!scaleDef) return;
        const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
        const rootMidi = noteNameToMidi(rootNote);
        const scaleNotes = scaleDef.intervals.map(interval => midiNoteName((rootMidi + interval) % 128));

        const motifs = [
            [0, 2, 4, 2],
            [0, 3, 5, 3],
            [0, 4, 2, 0],
            [0, 2, 0, 4]
        ];
        const motif = motifs[sceneIndex % motifs.length];
        for (let step = 0; step < loopLength; step++) {
            if (step % 2 === 0) {
                const motifIdx = (step / 2) % motif.length;
                const scaleIdx = motif[motifIdx];
                if (scaleIdx < scaleNotes.length) {
                    pattern[step] = { active: true, note: scaleNotes[scaleIdx], velocity: 0x70, tie: false };
                }
            }
        }
     }

     _generateOtherPattern(pattern, scaleDef, rootNote, loopLength, sceneIndex) {
        // Reset pattern
        for (let step = 0; step < pattern.length; step++) {
            pattern[step] = { active: false, note: rootNote, velocity: 0x60, tie: false };
        }

        if (!scaleDef) return;
        const rootIdx = MIDI_NOTE_NAMES.indexOf(rootNote);
        const rootMidi = noteNameToMidi(rootNote);
        const scaleNotes = scaleDef.intervals.map(interval => midiNoteName((rootMidi + interval) % 128));

        const useChord = sceneIndex % 3 === 0;
        const fifthMidi = (rootMidi + 7) % 128;
        const fifthNote = midiNoteName(fifthMidi);

        for (let step = 0; step < loopLength; step++) {
            if (step % 4 === 0) {
                if (useChord) {
                    pattern[step] = { active: true, note: rootNote, velocity: 0x60, tie: false };
                } else {
                    const noteIdx = (step / 4) % 2;
                    const note = noteIdx === 0 ? rootNote : (scaleNotes[4] || rootNote);
                    pattern[step] = { active: true, note, velocity: 0x60, tie: false };
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
    const valid = [16, 32, 64, 128, 256];
    return valid.reduce((best, v) => Math.abs(v - value) < Math.abs(best - value) ? v : best, valid[0]);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
