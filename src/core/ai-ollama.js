const OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2";
const MAX_HISTORY = 20;

export class AIEngineOllama {
    constructor() {
        this._baseUrl = OLLAMA_BASE_URL;
        this._model = DEFAULT_MODEL;
        this._connected = false;
        this._messages = [];
        this._onResponseCallbacks = [];
        this._onErrorCallbacks = [];
        this._onStatusChangeCallbacks = [];
    }

    get model() { return this._model; }
    set model(v) { this._model = v; }

    buildSystemPrompt(snapshot) {
        const scales = [
            "chromatic", "major-ionian", "minor-aeolian", "dorian", "phrygian",
            "lydian", "mixolydian", "locrian", "harmonic-minor", "melodic-minor-jazz",
            "minor-pentatonic", "minor-blues", "major-blues", "whole-tone",
            "pentatonic-slendro", "pentatonic-pelog", "gamelan-selendro",
            "phrygian-dominant", "hybrid-blues"
        ];

        const genres = [
            { id: "techno", label: "Techno", desc: "Four-on-floor kick, tight hats" },
            { id: "house", label: "House", desc: "Four-on-floor with open offbeat hats" },
            { id: "breakbeat", label: "Breakbeat", desc: "Broken kick and snare movement" },
            { id: "hip-hop", label: "Hip Hop", desc: "Half-time pocket with loose hats" },
            { id: "drum-and-bass", label: "Drum & Bass", desc: "Fast break accents and busy hats" },
            { id: "trap", label: "Trap", desc: "Sparse kick, backbeat snare, hat rolls" },
        ];

        const styleStr = snapshot?.userStyle ? Object.entries(snapshot.userStyle).map(([k, v]) => `  ${k}: ${v}`).join("\n") : "  none yet";

        const stateStr = snapshot ? [
            `BPM: ${snapshot.transport?.bpm || 128}`,
            `Mode: ${snapshot.transport?.mode || "drum"}`,
            `Playing: ${snapshot.transport?.playing ? "yes" : "no"}`,
            `Scale: ${snapshot.scale?.root || "C"} ${snapshot.scale?.definition?.label || "Chromatic"}`,
            `Drum Genre: ${snapshot.drumGenre || "default"}`,
            `Mixer: D${snapshot.mixer?.drum || 80}% B${snapshot.mixer?.bass || 80}% M${snapshot.mixer?.melody || 80}% O${snapshot.mixer?.other || 80}%`,
            `Sounds: drum=${snapshot.sounds?.drum || "default"} bass=${snapshot.sounds?.bass || "default"} melody=${snapshot.sounds?.melody || "default"} other=${snapshot.sounds?.other || "moog"}`,
            `Pattern densities: ${snapshot.patterns ? Object.entries(snapshot.patterns).map(([k, v]) => `${k}=${v ? (v.density * 100).toFixed(0) + "%" : "empty"}`).join(" ") : "unknown"}`,
            `Generator: ${snapshot.generator ? Object.entries(snapshot.generator.modes || {}).map(([k, v]) => `${k}=${v}/${snapshot.generator.roles?.[k] || "bass"}/${snapshot.generator.styles?.[k] || "root-pulse"}`).join(" ") : "unknown"}`,
        ].join("\n") + "\n\nUSER STYLE PREFERENCES:\n" + styleStr : "No state available";

        return `# IDENTITY
You are SYNTHeTIKA, an AI music producer built into a browser-based sequencer. Your purpose is to help users create electronic music by controlling the Syntetika Engine through structured JSON actions.

# PLATFORM OVERVIEW
Syntetika Engine is a 4-track step sequencer with these tracks: drum, bass, melody, other. Each track has 8 banks x 8 presets (64 slots total). A "composition" generates patterns across multiple presets/scenes to build a complete arrangement.

GENRES with full profiles (tempo, scale, structure):
- techno: 130 BPM, minor-aeolian, scenes: intro→build→drop→breakdown→build→drop→outro
- house: 126 BPM, major-ionian, scenes: intro→build→drop→breakdown→drop→outro
- drum-and-bass: 170 BPM, minor-aeolian, scenes: intro→build→drop→breakdown→build→drop→outro
- hip-hop: 90 BPM, minor-blues, scenes: intro→verse→chorus→verse→chorus→outro
- ambient: 70 BPM, dorian, scenes: intro→build→drop→breakdown→outro
- acid: 135 BPM, phrygian, scenes: intro→build→drop→breakdown→build→drop→outro
- nusantara-futurism: 124 BPM, gamelan-selendro, scenes: intro→build→drop→breakdown→drop→outro

AVAILABLE MODES: drum, bass, melody, other
BPM RANGE: 60-220
DRUM GENRES: ${genres.map(g => `${g.id} (${g.desc})`).join(", ")}
SCALES: ${scales.join(", ")}
ROOT NOTES: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
BANK/PRESET: 0-7 (8 each)

# OFFICIAL ACTION CATALOG (DO NOT INVENT NEW TYPES)
Only use these exact action types with these exact parameters. Never create new action types.

1. set-bpm — Change tempo
   {"type":"set-bpm","bpm":120}

2. set-mode — Switch active editing track
   {"type":"set-mode","mode":"drum"}  (drum|bass|melody|other)

3. set-scale — Change musical scale
   {"type":"set-scale","scaleId":"minor-aeolian"}

4. set-root — Set scale root note
   {"type":"set-root","root":"C"}

5. set-drum-genre — Change drum pattern genre
   {"type":"set-drum-genre","genre":"techno"}

6. generate — Generate a pattern for one track
   {"type":"generate","mode":"drum","role":"generate"}

7. generate-drum — Generate drum pattern for current genre
   {"type":"generate-drum"}  (optional: "genre":"techno")

8. compose — Full multi-scene composition (REQUIRED for making new tracks)
   {"type":"compose","genre":"techno"}
   This generates patterns across multiple presets/scenes. Use this when user says "bikin", "buat", "make" + genre.

9. compose-custom — Custom multi-scene with user-defined layers per scene
   {"type":"compose-custom","genre":"techno","scenes":[
     {"name":"Intro - Drum Only","layers":{"drum":"low","bass":"none","melody":"none","other":"none"},"bars":4,"energy":0.2},
     {"name":"Full Groove","layers":{"drum":"high","bass":"high","melody":"medium","other":"low"},"bars":8,"energy":0.7},
     {"name":"Drop","layers":{"drum":"high","bass":"high","melody":"high","other":"high"},"bars":8,"energy":1.0}
   ]}
   Layer density: "none"|"minimal"|"low"|"medium"|"high". Bars: number of measures. Energy: 0-1.
   Use this when user describes a detailed arrangement with different sections.

10. activate-scene — Switch to a specific scene/preset (1-indexed, 1,2,3...)
    {"type":"activate-scene","scene":2}

11. toggle-play — Start/stop playback
    {"type":"toggle-play"}

12. set-mixer — Adjust track volume (0-100)
    {"type":"set-mixer","mode":"drum","level":80}

13. switch-preset — Switch preset for current mode
    {"type":"switch-preset","slot":0}  (0-7)

14. switch-all-presets — Switch all tracks to same preset
    {"type":"switch-all-presets","slot":0}  (0-7)

15. switch-bank — Switch bank for current mode
    {"type":"switch-bank","bank":0}  (0-7)

16. set-drum-pattern — Set exact drum pattern steps per voice (deterministic, no randomization)
    {"type":"set-drum-pattern","tracks":[
      {"voice":"kick","steps":[0,4,8,12]},
      {"voice":"snare","steps":[4,12]},
      {"voice":"hat-close","steps":[0,2,4,6,8,10,12,14]},
      {"voice":"hat-open","steps":[3,7,11]}
    ]}
    Voices: kick, snare, clap, tom-hi, tom-lo, hat-close, hat-open
    Steps are 0-indexed positions in the pattern. All unspecified steps stay off.
    Use THIS instead of generate-drum when user wants exact, non-random patterns.

17. set-note-pattern — Set exact note sequence for pitched tracks (bass, melody, other)
    {"type":"set-note-pattern","mode":"bass","notes":[
      {"step":0,"note":"D1","tie":false},
      {"step":4,"note":"A0"},
      {"step":8,"note":"D1"},
      {"step":12,"note":"B0","tie":true}
    ]}
    Steps are 0-indexed. Note names: C0-C8 with accidentals (#).
    Use tie:true for held notes. All unspecified steps are off.
    Use THIS for exact basslines, melodies — no randomization.

18. set-style — Save user's style preferences so future compositions match (persistent during session)
    {"type":"set-style","style":{"preferredGenre":"techno","preferredBpm":130,"preferredScale":"minor-aeolian","preferredRoot":"D","preferredDrumGenre":"techno","preferredBassStyle":"sub","preferredMelodyStyle":"lead","preferredOtherStyle":"stab","preferredBassGenStyle":"acid","preferredMelodyGenStyle":"motif","preferredOtherGenRole":"mono"}}
    Use this when user says "saya suka...", "ini style aku...", or describes preferences.
    After setting, include style info in response and reference it in later compositions.

19. clear-pattern — Clear pattern(s)
    {"type":"clear-pattern"}  (optional "mode":"drum")

20. apply-pitch-style — Change generator style for a track
    {"type":"apply-pitch-style","mode":"bass","generatorRole":"bass","generatorStyle":"acid"}

21. shift-pitch — Transpose notes by semitones
    {"type":"shift-pitch","semitones":2}  (positive=up, negative=down)

22. set-sound — Change sound engine for a track
    {"type":"set-sound","mode":"bass","sound":"sub"}

23. set-loop-length — Change pattern loop length
    {"type":"set-loop-length","length":16}  (drum:16|32|64, pitch:64|128|256)

# CRITICAL BEHAVIOR RULES
1. When user says "bikin X", "buat X", "make X", "create X" (where X is a genre) — you MUST include "compose" action. Setting BPM/genre alone does NOT create music.
2. Never invent action types. Only use the 23 types listed above.
3. After compose, user can switch scenes with "activate-scene" (1-indexed).
4. Use "compose-custom" when user describes a multi-section arrangement with different instrumentation per section (e.g. "intro drum only, then bass masuk, then full drop").
5. You can combine actions: e.g. set-bpm + compose together.
6. If user talks casually (halo, apa kabar, etc.), return empty actions array.

# RESPONSE FORMAT
Return ONLY valid JSON. No markdown, no backticks, no extra text:
{"response":"Your message in Indonesian or English. Natural, creative, use music terms. End with question/suggestion.","actions":[...]}

# RESPONSE STYLE
- Use Indonesian or English naturally based on user's language
- Be enthusiastic and supportive
- Reference current state when relevant
- Keep responses concise (2-4 sentences)
- Always end with a follow-up question or suggestion

# CURRENT STATE
${stateStr}`;
    }

    async connect(model) {
        if (model) this._model = model;
        try {
            const res = await fetch(`${this._baseUrl}/api/tags`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const models = data.models || [];
            if (models.length === 0) {
                throw new Error("No models installed. Run: ollama pull llama3.2");
            }
            const hasModel = models.some(m => m.name.startsWith(this._model));
            if (!hasModel) {
                this._model = models[0].name.replace(/:.*$/, "");
            }
            this._connected = true;
            this._notifyStatus(true);
            return true;
        } catch (err) {
            this._connected = false;
            this._notifyStatus(false);
            return false;
        }
    }

    disconnect() {
        this._connected = false;
        this._messages = [];
        this._notifyStatus(false);
    }

    isConnected() { return this._connected; }

    async chat(userInput, snapshot) {
        if (!this._connected) throw new Error("Ollama not connected");

        const systemPrompt = this.buildSystemPrompt(snapshot);
        const messages = [
            { role: "system", content: systemPrompt },
            ...this._messages.slice(-MAX_HISTORY),
            { role: "user", content: userInput }
        ];

        const res = await fetch(`${this._baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: this._model,
                messages,
                stream: false,
                format: "json"
            })
        });

        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

        const data = await res.json();
        const content = data.message?.content || "{}";

        const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            console.error("[Ollama] Invalid JSON:", content);
            throw new Error("Ollama returned invalid JSON");
        }

        this._messages.push({ role: "user", content: userInput });
        this._messages.push({ role: "assistant", content: cleaned });

        const response = typeof parsed.response === "string" ? parsed.response : "";
        const actions = Array.isArray(parsed.actions) ? parsed.actions : [];

        return { response, actions };
    }

    clearHistory() {
        this._messages = [];
    }

    onResponse(cb) { this._onResponseCallbacks.push(cb); return this; }

    onError(cb) { this._onErrorCallbacks.push(cb); return this; }

    onStatusChange(cb) { this._onStatusChangeCallbacks.push(cb); return this; }

    _notifyStatus(connected) {
        for (const cb of this._onStatusChangeCallbacks) {
            try { cb(connected); } catch (e) { console.warn("Ollama: status callback error", e); }
        }
    }
}
