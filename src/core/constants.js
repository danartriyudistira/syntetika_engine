export const STORAGE_KEY = "audio_reactive_fx_state_v2";
export const MIDI_KEY = "audio_reactive_fx_midi_v3";
export const LEGACY_MIDI_KEY = "audio_reactive_fx_midi_v2";
export const CHANNEL = "audio_reactive_fx_visual";
export const MATRIX_CHANNEL = "audio_reactive_fx_matrix";

export const DRUM_VOICES = {
    kick: { id: "kick", label: "Kick", defaultNote: 36, lane: 0 },
    snare: { id: "snare", label: "Snare", defaultNote: 38, lane: 1 },
    clap: { id: "clap", label: "Clap", defaultNote: 39, lane: 1 },
    "tom-hi": { id: "tom-hi", label: "Tom Hi", defaultNote: 50, lane: 2 },
    "tom-lo": { id: "tom-lo", label: "Tom Lo", defaultNote: 45, lane: 2 },
    "hat-open": { id: "hat-open", label: "HOpen", defaultNote: 46, lane: 3 },
    "hat-close": { id: "hat-close", label: "HClose", defaultNote: 42, lane: 3 }
};
export const DRUM_LANE_VOICE_OPTIONS = [
    ["kick"],
    ["snare", "clap"],
    ["tom-hi", "tom-lo"],
    ["hat-close", "hat-open"]
];
export const DRUM_VOICE_ORDER = ["kick", "snare", "clap", "tom-hi", "tom-lo", "hat-close", "hat-open"];
export const DRUM_VOICE_INDEX = DRUM_VOICE_ORDER.reduce((map, voice, index) => {
    map[voice] = index;
    return map;
}, {});
export const DEFAULT_DRUM_VOICES = DRUM_LANE_VOICE_OPTIONS.map((options) => options[0]);
export const DRUM_LABELS = DEFAULT_DRUM_VOICES.map((voice) => DRUM_VOICES[voice].label);
export const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_PICKER_MIN_MIDI = 24;
export const NOTE_PICKER_MAX_MIDI = 96;
export const DEFAULT_DRUM_NOTES = DRUM_VOICE_ORDER.map((voice) => DRUM_VOICES[voice].defaultNote);
export const PITCH_GENERATOR_MODES = ["explore", "structured"];
export const PITCH_GENERATOR_ROLES = ["bass", "melody", "mono"];
export const PITCH_GENERATOR_STYLES = {
    bass: ["root-pulse", "offbeat", "walking", "acid", "syncopated", "two-step", "half-time", "gliding", "dub", "latin", "chill-wave", "hypnotic"],
    melody: ["motif", "arp", "call-response", "sparse", "lead", "cascade", "sequence", "random-walk", "ostinato", "improvisasi"],
    mono: ["stab", "pulse", "riff", "drone", "accent", "sequenced", "ostinato", "dub-siren", "filter-sweep", "chord-stab"]
};
export const PITCH_GENERATOR_STYLE_LABELS = {
    "root-pulse": "Root Pulse",
    offbeat: "Offbeat",
    walking: "Walking",
    acid: "Acid",
    syncopated: "Syncopated",
    "two-step": "Two Step",
    "half-time": "Half Time",
    gliding: "Gliding",
    dub: "Dub",
    latin: "Latin",
    "chill-wave": "Chill Wave",
    hypnotic: "Hypnotic",
    motif: "Motif",
    arp: "Arp",
    "call-response": "Call Response",
    sparse: "Sparse",
    lead: "Lead",
    cascade: "Cascade",
    sequence: "Sequence",
    "random-walk": "Random Walk",
    ostinato: "Ostinato",
    improvisasi: "Improvisasi",
    stab: "Stab",
    pulse: "Pulse",
    riff: "Riff",
    drone: "Drone",
    accent: "Accent",
    sequenced: "Sequenced",
    "dub-siren": "Dub Siren",
    "filter-sweep": "Filter Sweep",
    "chord-stab": "Chord Stab"
};
export const DRUM_RANDOM_GENRES = [
    { id: "default", label: "Default", description: "Current random behavior" },
    { id: "techno", label: "Techno", description: "Four-on-floor kick, tight hats" },
    { id: "house", label: "House", description: "Four-on-floor with open offbeat hats" },
    { id: "breakbeat", label: "Breakbeat", description: "Broken kick and snare movement" },
    { id: "hip-hop", label: "Hip Hop", description: "Half-time pocket with loose hats" },
    { id: "drum-and-bass", label: "Drum & Bass", description: "Fast break accents and busy hats" },
    { id: "trap", label: "Trap", description: "Sparse kick, backbeat snare, hat rolls" },
    { id: "disco", label: "Disco", description: "Steady kick with open hat lift" },
    { id: "dub", label: "Dub", description: "Sparse space and delayed accents" },
    { id: "rock", label: "Rock", description: "Backbeat snare and steady eighth hats" },
    { id: "metal", label: "Metal", description: "Double pedal kick and dense hats" },
    { id: "pop", label: "Pop", description: "Clean backbeat with simple kick movement" },
    { id: "funky", label: "Funky", description: "Syncopated kick with bright hat motion" },
    { id: "garage", label: "Garage", description: "Shuffled 2-step with swung hats" },
    { id: "electro", label: "Electro", description: "Robotic kick, syncopated hats, funk influence" },
    { id: "minimal", label: "Minimal", description: "Reduced elements, space, hypnotic repetition" },
    { id: "hard-techno", label: "Hard Techno", description: "Relentless kick, industrial claps, high energy" },
    { id: "deep-house", label: "Deep House", description: "Soulful four-on-floor, lush chords, smooth groove" },
];
export const SCALE_DEFINITIONS = [
    { id: "chromatic", label: "Chromatic", notes: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "major-ionian", label: "Major (Ionian)", notes: ["C", "D", "E", "F", "G", "A", "B"], intervals: [0, 2, 4, 5, 7, 9, 11] },
    { id: "minor-aeolian", label: "Minor (Aeolian)", notes: ["C", "D", "Eb", "F", "G", "Ab", "Bb"], intervals: [0, 2, 3, 5, 7, 8, 10] },
    { id: "pentatonic-slendro", label: "Pentatonic Slendro", notes: ["C", "D", "E", "G", "A"], intervals: [0, 2, 4, 7, 9] },
    { id: "pentatonic-pelog", label: "Pentatonic Pelog", notes: ["C", "C#", "D#", "G", "G#"], intervals: [0, 1, 3, 7, 8] },
    { id: "pelog-lima", label: "Pelog Pathet Lima", notes: ["C", "C#", "D#", "E", "G", "G#", "B"], intervals: [0, 1, 3, 4, 7, 8, 11] },
    { id: "pelog-nem", label: "Pelog Pathet Nem", notes: ["C", "C#", "D#", "F", "G", "G#", "A#"], intervals: [0, 1, 3, 5, 7, 8, 10] },
    { id: "pelog-barang", label: "Pelog Pathet Barang", notes: ["C", "D", "D#", "F", "G", "A", "B"], intervals: [0, 2, 3, 5, 7, 9, 11] },
    { id: "gamelan-selendro", label: "Gamelan Selendro", notes: ["C", "D", "F", "G", "A"], intervals: [0, 2, 5, 7, 9] },
    { id: "minor-pentatonic", label: "Minor Pentatonic", notes: ["C", "Eb", "F", "G", "Bb"], intervals: [0, 3, 5, 7, 10] },
    { id: "whole-tone", label: "Whole Tone", notes: ["C", "D", "E", "F#", "G#", "A#"], intervals: [0, 2, 4, 6, 8, 10] },
    { id: "harmonic-minor", label: "Harmonic Minor", notes: ["C", "D", "Eb", "F", "G", "Ab", "B"], intervals: [0, 2, 3, 5, 7, 8, 11] },
    { id: "melodic-minor-jazz", label: "Melodic Minor (Jazz)", notes: ["C", "D", "Eb", "F", "G", "A", "B"], intervals: [0, 2, 3, 5, 7, 9, 11] },
    { id: "double-harmonic-major", label: "Double Harmonic Major", notes: ["C", "C#", "E", "F", "G", "G#", "B"], intervals: [0, 1, 4, 5, 7, 8, 11] },
    { id: "dorian", label: "Dorian", notes: ["C", "D", "Eb", "F", "G", "A", "Bb"], intervals: [0, 2, 3, 5, 7, 9, 10] },
    { id: "phrygian", label: "Phrygian", notes: ["C", "Db", "Eb", "F", "G", "Ab", "Bb"], intervals: [0, 1, 3, 5, 7, 8, 10] },
    { id: "lydian", label: "Lydian", notes: ["C", "D", "E", "F#", "G", "A", "B"], intervals: [0, 2, 4, 6, 7, 9, 11] },
    { id: "mixolydian", label: "Mixolydian", notes: ["C", "D", "E", "F", "G", "A", "Bb"], intervals: [0, 2, 4, 5, 7, 9, 10] },
    { id: "locrian", label: "Locrian", notes: ["C", "Db", "Eb", "F", "Gb", "Ab", "Bb"], intervals: [0, 1, 3, 5, 6, 8, 10] },
    { id: "major-blues", label: "Major Blues", notes: ["C", "D", "Eb", "E", "G", "A"], intervals: [0, 2, 3, 4, 7, 9] },
    { id: "minor-blues", label: "Minor Blues", notes: ["C", "Eb", "F", "F#", "G", "Bb"], intervals: [0, 3, 5, 6, 7, 10] },
    { id: "hybrid-blues", label: "Hybrid Blues", notes: ["C", "D", "Eb", "E", "F", "Gb", "G", "A", "Bb"], intervals: [0, 2, 3, 4, 5, 6, 7, 9, 10] },
    { id: "phrygian-dominant", label: "Phrygian Dominant", notes: ["C", "Db", "E", "F", "G", "Ab", "Bb"], intervals: [0, 1, 4, 5, 7, 8, 10] }
];

// ── Scene Structure (untuk AI composition) ──────────

export const SCENE_TYPES = ["intro", "build", "drop", "breakdown", "outro"];

export const SCENE_DEFINITIONS = [
    {
        id: "intro",
        label: "Intro",
        defaultBars: 4,
        description: "Pembukaan, sparse, perkenalan elemen satu per satu",
        layers: {
            drum: { density: "low", complexity: "simple" },
            bass: { density: "none", complexity: "none" },
            melody: { density: "none", complexity: "none" },
            other: { density: "low", complexity: "simple" },
        },
        energy: 0.2,
    },
    {
        id: "build",
        label: "Build",
        defaultBars: 4,
        description: "Tension naik, layer bertambah, menjelang climax",
        layers: {
            drum: { density: "medium", complexity: "building" },
            bass: { density: "low", complexity: "simple" },
            melody: { density: "low", complexity: "simple" },
            other: { density: "medium", complexity: "rising" },
        },
        energy: 0.5,
    },
    {
        id: "drop",
        label: "Drop",
        defaultBars: 8,
        description: "Full energy, semua layer aktif, puncak lagu",
        layers: {
            drum: { density: "high", complexity: "full" },
            bass: { density: "high", complexity: "full" },
            melody: { density: "medium", complexity: "full" },
            other: { density: "medium", complexity: "full" },
        },
        energy: 1.0,
    },
    {
        id: "breakdown",
        label: "Breakdown",
        defaultBars: 4,
        description: "Tenang setelah drop, minimal, atmosferik",
        layers: {
            drum: { density: "minimal", complexity: "simple" },
            bass: { density: "low", complexity: "simple" },
            melody: { density: "medium", complexity: "atmospheric" },
            other: { density: "low", complexity: "textural" },
        },
        energy: 0.3,
    },
    {
        id: "outro",
        label: "Outro",
        defaultBars: 2,
        description: "Penutup, fade out, elemen berkurang",
        layers: {
            drum: { density: "low", complexity: "fading" },
            bass: { density: "low", complexity: "fading" },
            melody: { density: "low", complexity: "fading" },
            other: { density: "low", complexity: "fading" },
        },
        energy: 0.15,
    },
];

// ── Genre Profiles (untuk AI composition) ──────────

export const GENRE_PROFILES = {
    techno: {
        id: "techno",
        label: "Techno",
        tempoRange: { min: 120, max: 150 },
        defaultTempo: 130,
        scale: "minor-aeolian",
        drumGenre: "techno",
        bassStyle: "hard-bass",
        melodyStyle: "lead",
        otherStyle: "stab",
        pitchGenerator: { mode: "structured", role: "bass", style: "acid" },
        melodyGenerator: { mode: "structured", role: "melody", style: "motif" },
        monoGenerator: { mode: "structured", role: "mono", style: "stab" },
        sceneStructure: ["intro", "build", "drop", "breakdown", "build", "drop", "outro"],
    },
    house: {
        id: "house",
        label: "House",
        tempoRange: { min: 118, max: 135 },
        defaultTempo: 126,
        scale: "major-ionian",
        drumGenre: "house",
        bassStyle: "hard-bass",
        melodyStyle: "glass",
        otherStyle: "bass",
        pitchGenerator: { mode: "structured", role: "bass", style: "root-pulse" },
        melodyGenerator: { mode: "structured", role: "melody", style: "call-response" },
        monoGenerator: { mode: "structured", role: "mono", style: "pulse" },
        sceneStructure: ["intro", "build", "drop", "breakdown", "drop", "outro"],
    },
    "drum-and-bass": {
        id: "drum-and-bass",
        label: "Drum & Bass",
        tempoRange: { min: 160, max: 180 },
        defaultTempo: 170,
        scale: "minor-aeolian",
        drumGenre: "drum-and-bass",
        bassStyle: "sub",
        melodyStyle: "lead",
        otherStyle: "lead",
        pitchGenerator: { mode: "structured", role: "bass", style: "walking" },
        melodyGenerator: { mode: "structured", role: "melody", style: "lead" },
        monoGenerator: { mode: "structured", role: "mono", style: "riff" },
        sceneStructure: ["intro", "build", "drop", "breakdown", "build", "drop", "outro"],
    },
    "hip-hop": {
        id: "hip-hop",
        label: "Hip Hop",
        tempoRange: { min: 80, max: 100 },
        defaultTempo: 90,
        scale: "minor-blues",
        drumGenre: "hip-hop",
        bassStyle: "sub",
        melodyStyle: "pad",
        otherStyle: "fx",
        pitchGenerator: { mode: "structured", role: "bass", style: "syncopated" },
        melodyGenerator: { mode: "structured", role: "melody", style: "sparse" },
        monoGenerator: { mode: "structured", role: "mono", style: "accent" },
        sceneStructure: ["intro", "verse", "chorus", "verse", "chorus", "outro"],
    },
    ambient: {
        id: "ambient",
        label: "Ambient",
        tempoRange: { min: 60, max: 80 },
        defaultTempo: 70,
        scale: "dorian",
        drumGenre: "default",
        bassStyle: "pad",
        melodyStyle: "pad",
        otherStyle: "fx",
        pitchGenerator: { mode: "structured", role: "bass", style: "root-pulse" },
        melodyGenerator: { mode: "explore", role: "melody", style: "sparse" },
        monoGenerator: { mode: "structured", role: "mono", style: "drone" },
        sceneStructure: ["intro", "build", "drop", "breakdown", "outro"],
    },
    acid: {
        id: "acid",
        label: "Acid",
        tempoRange: { min: 125, max: 150 },
        defaultTempo: 135,
        scale: "phrygian",
        drumGenre: "techno",
        bassStyle: "lead",
        melodyStyle: "lead",
        otherStyle: "stab",
        pitchGenerator: { mode: "structured", role: "bass", style: "acid" },
        melodyGenerator: { mode: "structured", role: "melody", style: "motif" },
        monoGenerator: { mode: "structured", role: "mono", style: "riff" },
        sceneStructure: ["intro", "build", "drop", "breakdown", "build", "drop", "outro"],
    },
};

export const INSTRUMENTS = [
    ...DRUM_VOICE_ORDER.map((voice, index) => ({
        id: `drum-${voice}`,
        type: "drum",
        drumIndex: index,
        drumVoice: voice,
        lane: DRUM_VOICES[voice].lane,
        label: DRUM_VOICES[voice].label,
        defaultNote: DEFAULT_DRUM_NOTES[index]
    })),
    {
        id: "bassline",
        type: "bass",
        drumIndex: null,
        label: "Model D",
        defaultNote: 36,
        hardware: "Behringer Model D",
        hwChannel: 3,
    },
    {
        id: "melody",
        type: "melody",
        drumIndex: null,
        label: "Kobol",
        defaultNote: 48,
        hardware: "Kobol Expander",
        hwChannel: 2,
    },
    {
        id: "other",
        type: "other",
        drumIndex: null,
        label: "Monostation",
        defaultNote: 55,
        hardware: "Novation Monostation",
        hwChannel: 1,
    }
];
