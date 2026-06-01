# Syntetika Engine

**Syntetika Engine** adalah digital audio workstation (DAW) berbasis browser dengan AI-assisted composition, WebGL visualizer, dan dukungan MIDI hardware. Dibangun dengan vanilla JavaScript ES Modules — tanpa framework, tanpa build step.

## Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **4-Track Sequencer** | Drum, Bass, Melody, Other — masing-masing dengan pattern editor sendiri |
| **AI Composition** | Generate/mutate pattern, analisis intent, multi-scene arrangement — 100% client-side |
| **35+ Genre Drum** | Dari hip-hop, techno, house, hingga samba, salsa, afrobeat, speedcore |
| **100+ Scales** | Termasuk Phrygian Dominant, Hungarian Minor, Byzantine, pelog, slendro |
| **Hardware MIDI** | Web MIDI API — mapping input/output per track, transpose, channel routing |
| **WebGL Visuals** | 7 shader ISF dengan audio-reactive uniforms, popup window, monitor mode |
| **Shader Editor** | Built-in code editor, preview, import/export ISF files |
| **Resolume Integration** | OSC bridge untuk trigger clip/layer di Resolume Arena |
| **Cross-Tab Sync** | BroadcastChannel + localStorage fallback untuk multiple windows |
| **Multi-Touch Matrix** | Layar sentuh-friendly 8x8 preset grid untuk performa live |

## Cara Menjalankan

### Prasyarat
- Node.js (untuk HTTP server dan OSC bridge)
- Browser modern (Chrome/Edge/Firefox) dengan Web MIDI API

### Jalankan
```
run-syntetika-engine.cmd
```
Atau manual:
```
npx http-server . -p 8000 -c-1 --cors
```
Buka `http://127.0.0.1:8000` di browser.

### OSC Bridge (opsional, untuk Resolume)
```
run-osc-bridge.cmd
```
Atau:
```
node osc-bridge.js
```
Menerima POST `http://127.0.0.1:8765/osc` → meneruskan UDP ke `host:7000`.

## Hardware Setup (MIDI)

| Track | MIDI Channel | Hardware |
|-------|-------------|----------|
| Drum | 10 | DrumBrute Impact |
| Bass | 1 | Monostation |
| Melody | 2 | Kobol Expander |
| Other | 3 | Behringer Model D |

Mapping dilakukan via MIDI Config modal (ikon MIDI di panel kiri).

## Arsitektur

```
app.js                     → Orchestrator utama (UI, event binding, loop)
├── src/core/
│   ├── audio.js           → AudioEngine (Web Audio API synthesis)
│   ├── sequencer.js       → SequencerEngine (timing, swing, transport)
│   ├── pattern-store.js   → Pattern data model (8 bank × 8 slot per track)
│   ├── state.js           → State management (localStorage persistence)
│   ├── randomizer.js      → Pattern generation & mutation (35+ genre)
│   ├── constants.js       → Semua konstanta (scales, voices, genres)
│   ├── midi.js            → MidiManager (Web MIDI API wrapper)
│   ├── midi-ui.js         → MIDI configuration UI
│   ├── shader-engine.js   → ShaderEngine (WebGL2 ISF renderer)
│   ├── shader-editor.js   → Shader editor UI, preset gallery
│   ├── ai-engine.js       → AI orchestrator
│   ├── ai-intent.js       → Intent parser (natural language → command)
│   ├── ai-bridge.js       → Action executor (pattern manipulation)
│   ├── ai-personality.js  → Mood profiles, creative analysis
│   ├── ai-scene.js        → Multi-scene composition engine
│   ├── ai-context.js      → Context generator (snapshot description)
│   ├── resolume.js        → Resolume OSC controller
│   ├── matrix-control.js  → Cross-tab communication
│   ├── note-picker-ui.js  → Note selection popup
│   ├── scale-picker-ui.js → Scale picker UI
│   ├── utils.js           → Utility functions (note/math)
│   └── ui.js              → DOM helpers
├── shaders/               → ISF shader files
├── popup-visual.html      → Standalone visual popup window
├── matrix.html/.js/.css   → Matrix control popup
└── multitouchmatrix.*     → Multi-touch matrix popup
```

## Panel UI

| Panel | Konten |
|-------|--------|
| **Kiri** (495px) | Sequencer grid, transport, mixer, AI chat, shader editor, MIDI config |
| **Tengah** | Canvas WebGL visual (shader) |
| **Kanan** (320px) | Resolume dashboard, bank/slot gallery, visual presets |

## AI Chat

AI engine bekerja sepenuhnya di client-side (rule-based, tanpa API eksternal).

**Contoh perintah:**
- _"buat track techno yang gelap"_ → generate 4 track dengan mood gelap
- _"ganti scale ke phrygian dominant"_ → update scale
- _"generate drum dengan genre house"_ → drum pattern baru
- _"buat komposisi 4 scene"_ → multi-scene arrangement
- _"jelaskan track ini"_ → feedback deskripsi
- _"ubah BPM ke 128"_ → tempo change

Bahasa: Indonesia dan Inggris.

## Shaders

7 built-in shader ISF:
- `plasma` — Classic plasma
- `simply-nebulous` — Fractal nebula
- `audio-visualizer` — Spectrum bars
- `drum-pulse` — Radial pulse
- `bass-wave` — Gradient bars with 30 easing types
- `melody-spiral` — Pitch-reactive spiral
- `mono-strobe` — Trigger strobe

Uniforms real-time: `TIME`, `RENDERSIZE`, `u_bass`, `u_mid`, `u_high`, `u_level`, trigger per voice (kick/snare/clap/tom/hat), trigger per track (drum/bass/melody/other).

## Keyboard Shortcuts

| Shortcut | Fungsi |
|----------|--------|
| `Space` | Play/Stop |
| `Escape` | Close popup / deselect |
| `Ctrl+Z` | Undo (AI edit) |

## Persistence

- State: `localStorage` key `audio_reactive_fx_state_v2`
- MIDI config: `localStorage` key `audio_reactive_fx_midi_v3`
- Ekspor/impor project: File JSON via pattern tools

## Technology Stack

- **UI:** Vanilla HTML5 + CSS3 (CSS custom properties, dark theme)
- **Audio:** Web Audio API (OscillatorNode, GainNode, BiquadFilterNode)
- **MIDI:** Web MIDI API
- **Visual:** WebGL2 dengan WebGL1 fallback
- **AI:** Rule-based pattern generation (no external API)
- **Sync:** BroadcastChannel + localStorage
- **OSC:** Node.js UDP bridge
- **Server:** Static HTTP (no build step)
