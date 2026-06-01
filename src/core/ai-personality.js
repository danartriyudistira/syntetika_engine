import { GENRE_PROFILES, DRUM_RANDOM_GENRES, SCALE_DEFINITIONS, SCENE_DEFINITIONS, PITCH_GENERATOR_STYLES, MIDI_NOTE_NAMES } from "./constants.js";

const MOOD_PROFILES = {
    melancholic: { energy: 0.3, tempoRange: [120, 135], scalePreference: ["minor-aeolian", "dorian", "phrygian"], genreMatch: ["techno", "ambient"], description: "Deep emotion, minor tonality, space for atmosphere" },
    euphoric: { energy: 0.8, tempoRange: [125, 140], scalePreference: ["major-ionian", "lydian", "mixolydian"], genreMatch: ["house", "techno"], description: "Rising energy, bright harmony, peak-time drive" },
    dark: { energy: 0.6, tempoRange: [128, 148], scalePreference: ["phrygian", "locrian", "harmonic-minor"], genreMatch: ["techno", "drum-and-bass"], description: "Tension, weight, industrial texture" },
    cinematic: { energy: 0.5, tempoRange: [110, 130], scalePreference: ["minor-aeolian", "dorian", "whole-tone"], genreMatch: ["ambient", "techno"], description: "Wide space, evolving layers, narrative arc" },
    aggressive: { energy: 0.9, tempoRange: [140, 175], scalePreference: ["phrygian", "minor-blues", "locrian"], genreMatch: ["drum-and-bass", "techno"], description: "High density, distorted textures, relentless drive" },
    dreamy: { energy: 0.3, tempoRange: [100, 125], scalePreference: ["dorian", "lydian", "major-ionian"], genreMatch: ["ambient", "house"], description: "Soft, floating, washed with reverb" },
    groovy: { energy: 0.6, tempoRange: [120, 132], scalePreference: ["mixolydian", "dorian", "minor-pentatonic"], genreMatch: ["house", "hip-hop", "funky"], description: "Syncopated rhythm, pocket feel, movement" },
    tense: { energy: 0.7, tempoRange: [125, 145], scalePreference: ["phrygian", "locrian", "whole-tone", "double-harmonic-major"], genreMatch: ["techno", "drum-and-bass"], description: "Dissonance, buildup, unresolved expectation" },
};

const CHORD_PROGRESSIONS = {
    "minor-aeolian": {
        melancholic: ["Am", "F", "C", "G"],
        dark: ["Fm", "Db", "Ab", "Eb"],
        cinematic: ["Dm", "Am", "C", "G"],
        tense: ["Bdim", "Fm", "Cdim", "G"],
    },
    "dorian": {
        dreamy: ["Dm", "C", "Gm", "Am"],
        groovy: ["Am", "G", "D", "Em"],
        cinematic: ["Em", "D", "Am", "C"],
    },
    "phrygian": {
        dark: ["Fm", "E", "Fm", "C"],
        aggressive: ["E", "F", "G", "E"],
        tense: ["C", "Db", "Eb", "F"],
    },
    "major-ionian": {
        euphoric: ["C", "G", "Am", "F"],
        dreamy: ["G", "Em", "C", "D"],
        groovy: ["F", "G", "Em", "Am"],
    },
    "lydian": {
        euphoric: ["F", "G", "Am", "C"],
        dreamy: ["C", "D", "Em", "F#dim"],
        cinematic: ["D", "E", "F#m", "A"],
    },
};

const ARRANGEMENT_TEMPLATES = {
    "melodic-techno": {
        label: "Melodic Techno",
        defaultBpm: 128,
        sections: [
            { name: "Intro", start: "0:00", duration: "1:00", energy: 0.2, elements: "Kick, atmosphere, filter sweep" },
            { name: "Build 1", start: "1:00", duration: "1:00", energy: 0.4, elements: "Add percussion, bass rumble, pad layer" },
            { name: "Drop 1", start: "2:00", duration: "1:30", energy: 0.8, elements: "Full drums, bassline, lead melody" },
            { name: "Breakdown", start: "3:30", duration: "1:00", energy: 0.2, elements: "Remove drums, atmospheric pad, vocal chop" },
            { name: "Build 2", start: "4:30", duration: "0:45", energy: 0.5, elements: "Riser, snare roll, filter opening" },
            { name: "Main Drop", start: "5:15", duration: "1:45", energy: 1.0, elements: "Full arrangement, main hook, variation" },
            { name: "Outro", start: "7:00", duration: "1:00", energy: 0.1, elements: "Fade out, reverb tail, atmosphere" },
        ],
    },
    "progressive-house": {
        label: "Progressive House",
        defaultBpm: 126,
        sections: [
            { name: "Intro", start: "0:00", duration: "1:30", energy: 0.15, elements: "Pad swell, field recording, kick enters" },
            { name: "Build", start: "1:30", duration: "1:30", energy: 0.4, elements: "Percussion, bass groove, arpeggio" },
            { name: "Break 1", start: "3:00", duration: "1:00", energy: 0.3, elements: "Filtered drums, vocal phrase" },
            { name: "Drop 1", start: "4:00", duration: "2:00", energy: 0.9, elements: "Full bass, lead, layered synths" },
            { name: "Bridge", start: "6:00", duration: "1:00", energy: 0.3, elements: "Atmospheric break, tension release" },
            { name: "Final Drop", start: "7:00", duration: "2:00", energy: 1.0, elements: "Maximum energy, all elements" },
            { name: "Outro", start: "9:00", duration: "1:00", energy: 0.1, elements: "Decay, reverb, fade" },
        ],
    },
    "cinematic-electronic": {
        label: "Cinematic Electronic",
        defaultBpm: 115,
        sections: [
            { name: "Intro", start: "0:00", duration: "1:30", energy: 0.1, elements: "Textural pad, film sample, riser" },
            { name: "Theme", start: "1:30", duration: "1:30", energy: 0.4, elements: "Main theme, strings, percussion" },
            { name: "Rise", start: "3:00", duration: "1:00", energy: 0.6, elements: "Building tension, layer accumulation" },
            { name: "Climax", start: "4:00", duration: "2:00", energy: 1.0, elements: "Full orchestra, heavy drums, lead" },
            { name: "Resolution", start: "6:00", duration: "1:30", energy: 0.3, elements: "Theme reprise, sparse, atmospheric" },
            { name: "Outro", start: "7:30", duration: "1:00", energy: 0.1, elements: "Fade to silence, reverb tail" },
        ],
    },
    "indie-dance": {
        label: "Indie Dance",
        defaultBpm: 122,
        sections: [
            { name: "Intro", start: "0:00", duration: "1:00", energy: 0.2, elements: "Lo-fi beat, filtered bass, vocal snippet" },
            { name: "Groove", start: "1:00", duration: "1:30", energy: 0.5, elements: "Full drums, bassline, guitar/chord stab" },
            { name: "Chorus", start: "2:30", duration: "1:30", energy: 0.8, elements: "Vocal, lead hook, full arrangement" },
            { name: "Break", start: "4:00", duration: "1:00", energy: 0.3, elements: "Filtered, stripped back, build" },
            { name: "Final Chorus", start: "5:00", duration: "2:00", energy: 1.0, elements: "Maximum energy, extended outro" },
        ],
    },
};

const SOUND_DESIGN_TIPS = {
    kick: [
        "Layer transient click (short click at 3-5kHz) with sub body (sine 40-60Hz) for punch",
        "Sidechain compression from kick to bass creates the pumping groove",
        "Add subtle distortion on kick mid-range for club presence",
    ],
    bass: [
        "Keep bass monophonic below 150Hz to avoid muddiness",
        "Use saturation to create upper harmonics for small speaker translation",
        "Acid bass: Resonance (7-14) + Envelope (fast decay) on filter with 303-style glide",
    ],
    lead: [
        "Layer detuned sawtooths with low-pass filter opening on each note",
        "Add reverb send + pre-delay (40-80ms) for width without losing definition",
        "Use velocity sensitivity on filter cutoff for expressive phrasing",
    ],
    pad: [
        "Use wide detuned oscillators with slow attack for evolving texture",
        "Filter modulation via LFO (sine, 1/4 rate) creates movement",
        "Layer with granular/textural sounds for depth",
    ],
    arp: [
        "Use 1/16 or 1/8 note rate with randomized velocity for human feel",
        "Add swing to arp pattern to lock with groove",
        "Filter automation: open slightly on each section build",
    ],
    atmosphere: [
        "Reverse reverb on vocal/synth creates transitional sweeps",
        "Field recordings processed with heavy reverb add unique texture",
        "White noise filtered with envelope creates riser effects",
    ],
    percussion: [
        "Shakers on offbeats (1/16) create forward motion",
        "Rimshots/claves on 2 and 4 reinforce backbeat",
        "Toms with pitch decay create fills and transitions",
    ],
};

const PRODUCTION_TIPS = [
    "Kick and bass relationship: HPF bass at 30Hz, LPF kick sub at 80Hz, let them share the fundamental frequency in alternation",
    "Create space with reverb sends: short plate for drums, long hall for pads, modulated verb for leads",
    "Stereo placement: kick/bass center, percussion wide, pads extreme, leads 40-60%",
    "Compression: fast attack for transient shaping, slow attack for punch retention",
    "Reference mixing: check on earbuds, car speakers, club PA emulation",
    "Headroom: keep mix peaks at -6dB before mastering for optimal dynamics",
    "Layering kicks: transient layer (clicky), body layer (punchy), sub layer (feel)",
    "Filter modulation: automate HPF rising during builds, dropping at climax for maximum release",
];

export function analyzeCreativeInput(input) {
    const lower = input.toLowerCase();

    let detectedMood = null;
    let confidence = 0;

    for (const [mood, profile] of Object.entries(MOOD_PROFILES)) {
        if (new RegExp(`\\b${mood}\\b`).test(lower)) {
            if (!detectedMood || confidence < 0.8) {
                detectedMood = mood;
                confidence = 0.8;
            }
        }
    }

    const moodKeywords = {
        sad: "melancholic", emotional: "melancholic", deep: "melancholic", melo: "melancholic",
        happy: "euphoric", joyful: "euphoric", uplifting: "euphoric",
        dark: "dark", industrial: "dark", heavy: "dark", aggressive: "aggressive", hard: "aggressive",
        cinematic: "cinematic", epic: "cinematic", film: "cinematic", cinematic: "cinematic",
        dream: "dreamy", float: "dreamy", ambient: "dreamy", chill: "dreamy",
        groove: "groovy", funky: "groovy", swing: "groovy",
        tense: "tense", suspense: "tense", nervous: "tense",
        energy: "euphoric", peak: "aggressive", calm: "dreamy",
        melancholy: "melancholic", nostalgia: "melancholic",
        gamelan: "cinematic", jawa: "cinematic", bali: "cinematic", nusantara: "cinematic",
        ritual: "cinematic", sacred: "cinematic", tribal: "cinematic", spiritual: "cinematic",
        hypnotic: "dreamy", trance: "dreamy", meditative: "dreamy", flowing: "dreamy",
        ancestral: "dark", ancient: "dark", ceremonial: "cinematic",
    };

    for (const [keyword, mood] of Object.entries(moodKeywords)) {
        if (new RegExp(`\\b${keyword}\\b`, "i").test(lower)) {
            detectedMood = mood;
            confidence = Math.max(confidence, 0.7);
        }
    }

    let detectedGenre = null;
    for (const [genreId, profile] of Object.entries(GENRE_PROFILES)) {
        const pattern = new RegExp(`\\b${genreId}\\b`, "i");
        if (pattern.test(lower)) {
            detectedGenre = genreId;
            break;
        }
    }

    if (!detectedGenre && detectedMood) {
        const profile = MOOD_PROFILES[detectedMood];
        if (profile && profile.genreMatch.length > 0) {
            detectedGenre = profile.genreMatch[0];
        }
    }

    if (!detectedGenre) {
        for (const g of DRUM_RANDOM_GENRES) {
            if (new RegExp(`\\b${g.id}\\b`, "i").test(lower)) {
                detectedGenre = g.id;
                break;
            }
        }
    }

    // Cultural keywords → EDM fusion (techno)
    if (!detectedGenre && /\b(gamelan|jawa|bali|nusantara|tradisional|ethnic|sasando|talempong|sundanese)\b/.test(lower)) {
        detectedGenre = "techno";
    }

    let energy = 0.5;
    if (detectedMood && MOOD_PROFILES[detectedMood]) {
        energy = MOOD_PROFILES[detectedMood].energy;
    }

    if (/\b(happy|uplifting|energetic|peak|climax|euphoric)\b/.test(lower)) energy = Math.max(energy, 0.7);
    if (/\b(dark|aggressive|hard|heavy|intense)\b/.test(lower)) energy = Math.max(energy, 0.7);
    if (/\b(calm|chill|dreamy|soft|gentle)\b/.test(lower)) energy = Math.min(energy, 0.4);
    if (/\b(very|super|extremely)\b/.test(lower)) energy = energy >= 0.5 ? Math.min(1, energy + 0.2) : Math.max(0, energy - 0.2);

    let bpm = null;
    const bpmMatch = lower.match(/\b(\d{2,3})\s*bpm\b/);
    if (bpmMatch) bpm = parseInt(bpmMatch[1], 10);

    let key = null;
    const keyMatch = lower.match(/\b([a-g][#b]?)\s*(minor|major)\b/i);
    if (keyMatch) key = { root: keyMatch[1].toUpperCase(), type: keyMatch[2].toLowerCase() };

    const isCreative = !!(detectedMood || detectedGenre || /\b(track|song|make|create|build|compose|arrange|idea|concept|mood|feel|vibe|emotional)\b/.test(lower));

    return {
        mood: detectedMood,
        moodConfidence: confidence,
        genre: detectedGenre,
        energy,
        suggestedBpm: bpm,
        suggestedKey: key,
    isCreative,
    descriptors: extractDescriptors(lower),
    culture: /\b(gamelan|jawa|bali|nusantara|tradisional|ethnic|sasando|talempong|sundanese|pelog|slendro|selendro)\b/.test(lower) ? "nusantara" : null,
    };
}

function extractDescriptors(input) {
    const seen = new Set();
    const descriptors = [];
    const words = ["dark", "deep", "emotional", "aggressive", "dreamy", "cinematic", "warm", "cold", "bright", "textured", "minimal", "complex", "driving", "hypnotic", "atmospheric", "ethereal", "raw", "polished", "organic", "futuristic"];
    for (const w of words) {
        if (new RegExp(`\\b${w}\\b`, "i").test(input) && !seen.has(w)) {
            descriptors.push(w);
            seen.add(w);
        }
    }
    return descriptors;
}

export function generateCompositionPlan(analysis) {
    const mood = analysis.mood || "melancholic";
    const genre = analysis.genre || "techno";
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.melancholic;
    const genreProfile = GENRE_PROFILES[genre];

    const bpm = analysis.suggestedBpm || (genreProfile ? genreProfile.defaultTempo : 128);
    const keyAnalysis = analysis.suggestedKey || guessKey(profile, genre);

    // Auto-select gamelan scale when cultural keywords detected
    let scaleId = genreProfile?.scale || profile.scalePreference[0] || "minor-aeolian";
    if (analysis.culture === "nusantara") {
        const gamelanScales = ["pelog-barang", "gamelan-selendro", "pentatonic-pelog", "pentatonic-slendro", "pelog-lima", "pelog-nem"];
        scaleId = gamelanScales[Math.floor(Math.random() * gamelanScales.length)];
    }

    const scaleDef = SCALE_DEFINITIONS.find((s) => s.id === scaleId);
    const root = keyAnalysis?.root || guessRoot(genre, mood);
    const chordProg = getChordProgression(scaleId, mood, root);

    const templateKey = genre === "techno" ? "melodic-techno" :
        genre === "house" ? "progressive-house" :
        genre === "ambient" ? "cinematic-electronic" :
        "indie-dance";
    const arrangement = ARRANGEMENT_TEMPLATES[templateKey] || ARRANGEMENT_TEMPLATES["melodic-techno"];

    const sections = arrangement.sections.map((s, i) => {
        const adjustedEnergy = Math.min(1, s.energy * (1 + (analysis.energy - 0.5) * 0.5));
        return { ...s, energyDisplay: Math.round(adjustedEnergy * 100) };
    });

    const totalDuration = arrangement.sections.reduce((sum, s) => sum + parseDuration(s.duration), 0);

    return {
        concept: {
            title: generateTitle(mood, genre, analysis.descriptors),
            emotion: mood,
            narrative: getNarrative(mood),
            mood: analysis.descriptors.join(", ") || mood,
        },
        technical: {
            bpm: `${bpm} (range: ${profile.tempoRange[0]}-${profile.tempoRange[1]})`,
            key: `${root} ${keyAnalysis?.type || "Minor"}`,
            scale: scaleDef?.label || scaleId,
            groove: genreProfile ? `${genreProfile.label} groove` : "Four-on-floor",
            swing: genre === "house" ? "15-20%" : genre === "techno" ? "5-10%" : "10-15%",
        },
        structure: sections.map((s) =>
            `${s.name} ${s.start} - ${formatDuration(parseDuration(s.duration))}\n   Energy: ${s.energyDisplay}% | ${s.elements}`
        ).join("\n\n"),
        chordProgression: chordProg,
        scale: scaleDef ? { id: scaleId, notes: scaleDef.notes.join(" "), root } : { id: scaleId, root },
        arrangement,
        totalDuration: formatDuration(totalDuration),
        mixingNotes: generateMixingNotes(genre, mood, bpm),
    };
}

function parseDuration(str) {
    const parts = str.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function generateTitle(mood, genre, descriptors) {
    const titles = {
        melancholic: ["Echoes of Tomorrow", "Digital Tears", "Neon Solitude", "Requiem for Machines", "Fading Signals"],
        euphoric: ["Rise of the Phoenix", "Infinite Dawn", "Euphoria", "Beyond the Horizon", "Light Particle"],
        dark: ["Shadow Protocol", "Void Walker", "Dark Matter", "Industrial Revolution", "System Override"],
        cinematic: ["Origin of Species", "The Last Signal", "Cosmic Drift", "Epilogue", "Event Horizon"],
        aggressive: ["Rage Sequence", "Neural Overload", "Collapse", "Warning Shot", "Maximum Density"],
        dreamy: ["Lucid", "Weightless", "Hologram Dream", "Particle Drift", "Astral Projection"],
        groovy: ["Midnight Groove", "Deep Function", "The Pocket", "Analog Soul", "Ghost in the Machine"],
        tense: ["Paradox", "Impending", "Zero Hour", "The Tipping Point", "Dissonance"],
    };
    const list = titles[mood] || titles.melancholic;
    return list[Math.floor(Math.random() * list.length)];
}

function getNarrative(mood) {
    const narratives = {
        melancholic: "A lone signal travels through digital space — searching for connection in an increasingly synthetic world. The track explores the tension between organic emotion and machine precision.",
        euphoric: "Breaking through the noise, light emerges. A celebration of consciousness in the digital age — where human emotion and artificial intelligence dance together.",
        dark: "The machines are awakening. Deep, rumbling frequencies tell the story of a system learning to feel — and the chaos that follows.",
        cinematic: "An epic journey through unknown territory. Each section reveals a new landscape, from desolate plains to towering crystalline structures.",
        aggressive: "No compromise. Raw energy channeled through precise circuitry. This is the sound of a system pushed to its limits.",
        dreamy: "Floating in a sea of data. Memories and code merge into soft, evolving textures. A soundtrack for the space between sleep and waking.",
        groovy: "The system has found its rhythm. Organic swing meets mechanical precision. Movement is the only truth.",
        tense: "Something is about to happen. The air is charged with anticipation. Every element is coiled, waiting to spring.",
    };
    return narratives[mood] || narratives.melancholic;
}

function guessKey(profile, genre) {
    const genreKeyMap = {
        techno: { root: "D", type: "minor" },
        house: { root: "C", type: "major" },
        "drum-and-bass": { root: "A", type: "minor" },
        "hip-hop": { root: "C", type: "minor" },
        ambient: { root: "D", type: "minor" },
        acid: { root: "F", type: "minor" },
    };
    return genreKeyMap[genre] || { root: "D", type: "minor" };
}

function guessRoot(genre, mood) {
    const roots = {
        melancholic: "D", euphoric: "C", dark: "F", cinematic: "A",
        aggressive: "E", dreamy: "G", groovy: "A", tense: "B",
    };
    return roots[mood] || "D";
}

function getChordProgression(scaleId, mood, root) {
    const scaleProgs = CHORD_PROGRESSIONS[scaleId];
    if (scaleProgs) {
        const moodProg = scaleProgs[mood] || scaleProgs[Object.keys(scaleProgs)[0]];
        if (moodProg) return moodProg;
    }

    const defaultProgressions = {
        melancholic: ["Im", "bVI", "bVII", "V"],
        euphoric: ["I", "V", "vi", "IV"],
        dark: ["i", "bII", "i", "bVI"],
        cinematic: ["vi", "IV", "I", "V"],
        tense: ["i", "bII", "dim", "V"],
    };
    return defaultProgressions[mood] || ["i", "VI", "VII", "V"];
}

function generateMixingNotes(genre, mood, bpm) {
    const notes = [];
    if (mood === "melancholic" || mood === "cinematic" || mood === "dreamy") {
        notes.push("Reverb: Long hall decay (2.5-4s) on pads, short plate (0.8-1.2s) on drums");
        notes.push("Delay: Ping-pong 1/4 dotted on lead creates space without clutter");
        notes.push("Depth: Layered atmospheres at -18dB, wide stereo (+100% width)");
    }
    if (mood === "dark" || mood === "aggressive" || mood === "tense") {
        notes.push("Distortion: Parallel saturation on drum bus, 20% wet mix");
        notes.push("Compression: Aggressive bus comp (4:1 ratio, fast attack) for glue");
        notes.push("Sub: Kick and bass sidechain with 2:1 ratio, 70% release");
    }
    if (mood === "euphoric" || mood === "groovy") {
        notes.push("Brightness: High shelf +3dB at 8kHz on master for air");
        notes.push("Pumping: Sidechain from kick to bass/pads (threshold -12dB, release 120ms)");
        notes.push("Width: Widened lead (+80%), doubled with detuned layer");
    }
    notes.push("Headroom: Peak at -6dB, mix bus at -10dB RMS");
    notes.push("Reference: Compare with reference track at same LUFS");
    return notes.join("\n");
}

export function generateMusicalFeedback(intent, result, snapshot) {
    if (!result || !result.ok) return null;

    const parts = [];
    const mode = intent.mode || snapshot?.transport?.mode || "all";
    const patterns = snapshot?.patterns || {};
    const bpm = snapshot?.transport?.bpm || 128;

    if (intent.type === "generate" || intent.type === "fill" || intent.type === "mutate") {
        const genre = intent.genre || snapshot?.drumGenre || "default";
        const genreInfo = GENRE_PROFILES[genre] || DRUM_RANDOM_GENRES.find((g) => g.id === genre);

        if (intent.role === "fill") {
            const modeLabel = mode === "all" ? "arrangement" : mode;
            parts.push(`✨ Fill added to ${modeLabel} — tension building, preparing for transition.`);
        } else if (intent.role === "mutate") {
            parts.push(`🔀 Mutation complete — new variations generated while preserving structure.`);
        } else {
            if (genreInfo) {
                if (genreInfo.label) {
                    parts.push(`🎵 Generated ${genreInfo.label} pattern${mode !== "all" ? ` in ${mode} mode` : ""}.`);
                } else {
                    parts.push(`🎵 ${genreInfo.description || "Pattern generated."}`);
                }
            } else {
                parts.push(`🎵 Pattern generated in ${mode} mode.`);
            }
        }

        for (const k of mode === "all" ? ["drum", "bass", "melody", "other"] : [mode]) {
            const info = patterns[k];
            if (info) {
                const density = (info.density * 100).toFixed(0);
                const densityDesc = density > 70 ? "dense" : density > 40 ? "moderate" : "sparse";
                if (k === "drum" && info.tracks) {
                    parts.push(`   ${k}: ${info.activeSteps} hits across ${info.tracks} tracks, ${densityDesc} (${density}% density)`);
                } else if (info.activeSteps > 0) {
                    parts.push(`   ${k}: ${info.activeSteps} active notes, ${densityDesc} (${density}% density)`);
                } else {
                    parts.push(`   ${k}: empty`);
                }
            }
        }

        if (bpm) parts.push(`   Tempo: ${bpm} BPM`);

        const suggestions = [];
        if (intent.type === "generate" && mode !== "all") {
            suggestions.push(`Try generating other modes for fuller arrangement`);
        }
        if (patterns.drum?.activeSteps > 0 && (!patterns.bass?.activeSteps || patterns.bass.activeSteps === 0)) {
            suggestions.push(`Generate a bassline to complement the drums`);
        }
        if (patterns.bass?.activeSteps > 0 && (!patterns.melody?.activeSteps || patterns.melody.activeSteps === 0)) {
            suggestions.push(`Add a melody layer on top`);
        }
        if (suggestions.length > 0) {
            parts.push(`\n💡 Next: ${suggestions.join(" | ")}`);
        }

        const productionTip = PRODUCTION_TIPS[Math.floor(Math.random() * PRODUCTION_TIPS.length)];
        parts.push(`\n🎛 Tip: ${productionTip}`);
    }

    if (intent.type === "preset" || intent.type === "preset-all") {
        const slot = intent.slot + 1;
        const modeStr = intent.mode ? ` in ${intent.mode} mode` : " across all modes";
        parts.push(`🎛 Preset ${slot} selected${modeStr}.`);
        if (patterns) {
            const active = Object.entries(patterns)
                .filter(([, v]) => v.activeSteps > 0)
                .map(([k]) => k);
            if (active.length > 0) {
                parts.push(`   Active layers: ${active.join(", ")}`);
            }
        }
    }

    if (intent.type === "scale-root" || intent.type === "scale" || intent.type === "root") {
        const scaleId = intent.scaleId || snapshot?.scale?.id;
        const root = intent.root || snapshot?.scale?.root;
        const def = SCALE_DEFINITIONS.find((s) => s.id === scaleId);
        if (def) {
            const notes = def.notes.join(" ");
            parts.push(`🎹 ${root || ""} ${def.label} — Notes: ${notes}`);
            if (intent.type === "scale-root") {
                parts.push(`   Creates a ${getScaleEmotion(def.id)} emotional quality.`);
            }
        }
    }

    if (intent.type === "bpm") {
        const feel = intent.bpm >= 140 ? "driving and intense" : intent.bpm >= 130 ? "energetic" : intent.bpm >= 120 ? "balanced groove" : "deep and relaxed";
        parts.push(`⏱ BPM set to ${intent.bpm} — ${feel} feel.`);
    }

    if (intent.type === "mode") {
        const modeDescriptions = {
            drum: "Rhythm foundation — focus on kick, snares, and hats",
            bass: "Low-end harmonic foundation — the groove anchor",
            melody: "Lead melodic voice — the emotional center",
            other: "Mono texture layer — adds movement and accent",
        };
        parts.push(`🎛 Switched to ${intent.mode} mode.`);
        if (modeDescriptions[intent.mode]) {
            parts.push(`   ${modeDescriptions[intent.mode]}`);
        }
    }

    if (intent.type === "compose" && result.summary) {
        parts.push(result.summary);
    }

    return parts.length > 0 ? parts.join("\n") : null;
}

function getScaleEmotion(scaleId) {
    const map = {
        "major-ionian": "bright, happy, uplifting",
        "lydian": "dreamy, floating, hopeful",
        "mixolydian": "bluesy, groovy, relaxed",
        "minor-aeolian": "sad, emotional, deep",
        "dorian": "warm, soulful, jazzy",
        "phrygian": "dark, exotic, tense",
        "locrian": "unstable, dissonant, chaotic",
        "harmonic-minor": "middle eastern, dramatic, intense",
        "melodic-minor-jazz": "sophisticated, jazz-influenced, complex",
        "whole-tone": "dreamlike, ambiguous, floating",
        "double-harmonic-major": "exotic, intense, eastern European",
        "pentatonic-slendro": "Indonesian gamelan, pure, meditative",
        "pentatonic-pelog": "Balinese, mystical, ceremonial",
        "minor-pentatonic": "bluesy, rock, accessible",
        "major-blues": "happy blues, groovy",
        "minor-blues": "sad blues, soulful",
        "hybrid-blues": "complex blues, rich",
        "phrygian-dominant": "flamenco, middle eastern, dramatic",
        "chromatic": "experimental, atonal, modern classical",
    };
    return map[scaleId] || "unique";
}

export function suggestFollowUp(context) {
    const suggestions = [];
    const s = context?.snapshot;

    if (s) {
        const patterns = s.patterns || {};
        const drumActive = patterns.drum?.activeSteps > 0;
        const bassActive = patterns.bass?.activeSteps > 0;
        const melodyActive = patterns.melody?.activeSteps > 0;
        const otherActive = patterns.other?.activeSteps > 0;

        if (!bassActive && drumActive) suggestions.push('Generate a bassline: "bass" or "generate bass"');
        if (!melodyActive && bassActive) suggestions.push('Add a melody: "melody" or "generate melody"');
        if (drumActive && !otherActive) suggestions.push('Add a mono texture: "generate other"');

        if (drumActive && bassActive && melodyActive) {
            suggestions.push('Create full arrangement: "arrange techno" or "compose house"');
            suggestions.push('Switch presets to compare: "preset 2" or use keyboard shortcuts');
        }

        if (s.transport?.bpm) {
            const bpm = s.transport.bpm;
            if (bpm < 120) suggestions.push('Increase energy: "bpm 128" or "tempo up"');
            if (bpm > 150) suggestions.push('Chill out: "bpm 120" or "slower"');
        }
    }

    suggestions.push('Ask for creative direction: "I want a dark techno track"');
    suggestions.push('Explore music theory: "use D minor" or "switch to dorian"');

    return suggestions;
}

export function generateCreativePrompt() {
    const prompts = [
        "Describe the emotion you want to express: melancholic, euphoric, dark, or cinematic?",
        "What's the energy level? Driving peak-time or deep and introspective?",
        "Try 'make a techno track' for a full arrangement, or just type a mood like 'dark'",
        "I can help with composition, arrangement, sound design, and mixing.",
    ];
    return prompts[Math.floor(Math.random() * prompts.length)];
}

export function formatCompositionPlanAsText(plan) {
    return [
        `═══ SYNTHeTIKA COMPOSITION PLAN ═══`,
        ``,
        `1. CONCEPT`,
        `   Title: ${plan.concept.title}`,
        `   Theme: ${plan.concept.emotion}`,
        `   Narrative: ${plan.concept.narrative}`,
        `   Mood: ${plan.concept.mood}`,
        ``,
        `2. TECHNICAL DIRECTION`,
        `   BPM: ${plan.technical.bpm}`,
        `   Key: ${plan.technical.key}`,
        `   Scale: ${plan.technical.scale}`,
        `   Groove: ${plan.technical.groove}`,
        `   Swing: ${plan.technical.swing}`,
        ``,
        `3. TRACK STRUCTURE (Total: ${plan.totalDuration})`,
        plan.structure,
        ``,
        `4. HARMONY`,
        `   Progression: ${plan.chordProgression.join(" → ")}`,
        `   Scale: ${plan.scale.notes || plan.scale.id} (Root: ${plan.scale.root})`,
        ``,
        `5. MIXING APPROACH`,
        `   ${plan.mixingNotes.replace(/\n/g, "\n   ")}`,
        ``,
        `6. CREATIVE EVALUATION`,
        `   Execute this plan by typing the mood or "compose ${Object.keys(GENRE_PROFILES).find(() => true) || "techno"}"`,
        ``,
        `═══ SYNTHeTIKA AI Music Producer ═══`,
    ].join("\n");
}

export function generateWelcomeMessage() {
    return [
        `═══ SYNTHeTIKA AI Music Producer ═══`,
        ``,
        `Kamu adalah seorang komposer. Aku adalah produsermu.`,
        ``,
        `Aku bisa membantu:`,
        `  • Create full arrangements (e.g., "make a melodic techno track")`,
        `  • Generate patterns by mood (e.g., "dark", "melancholic", "euphoric")`,
        `  • Sound design guidance & production tips`,
        `  • Music theory & harmony advice`,
        `  • Mixing & mastering strategies`,
        `  • Visual & creative direction`,
        ``,
        `Coba mulai dengan:`,
        `  "I want a dark techno track"`,
        `  "create something melancholic"`,
        `  "make a euphoric house track"`,
        `  atau langsung "preset 3", "bpm 130", "generate melody"`,
    ].join("\n");
}
