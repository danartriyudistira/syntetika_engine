const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

const KB_MAP = {
    // white keys (row ASDFGHJKL;')
    a: 0, s: 2, d: 4, f: 5, g: 7, h: 9, j: 11, k: 12, l: 14, ";": 16,
    // black keys (row QWERTYUIO[])
    w: 1, e: 3, t: 6, y: 8, u: 10, o: 13, p: 15,
    // lower white keys (row ZXCVBNM,./) - Z and X reserved for transpose
    c: 4, v: 5, b: 7, n: 9, m: 11, ",": 12, ".": 14, "/": 16,
    // upper row brackets
    "[": 12, "]": 14
};

export class MidiKeyboardOverlay {
    constructor(options = {}) {
        this.options = options;
        this.active = false;
        this.recording = false;
        this.heldKeys = new Map();
        this.transpose = 0;
        this.octaveOffset = options.octaveOffset ?? 3;
        this.octaveCount = options.octaveCount ?? 2;
        this.container = null;
        this.onNoteOn = options.onNoteOn || (() => {});
        this.onNoteOff = options.onNoteOff || (() => {});
        this.onRecordChange = options.onRecordChange || (() => {});
        this._boundKeyDown = this._keyDown.bind(this);
        this._boundKeyUp = this._keyUp.bind(this);
    }

    get startMidi() {
        return this.octaveOffset * 12;
    }

    get endMidi() {
        return (this.octaveOffset + this.octaveCount) * 12;
    }

    baseMidi() {
        return this.octaveOffset * 12 + this.transpose * 12;
    }

    mount(container) {
        this.container = container;
        this._render();
    }

    isActive() {
        return this.active;
    }

    isRecording() {
        return this.recording;
    }

    toggle() {
        if (this.active) this.hide();
        else this.show();
    }

    show() {
        if (!this.container) return;
        this.active = true;
        this.container.classList.add("open");
        this.container.setAttribute("aria-hidden", "false");
        document.addEventListener("keydown", this._boundKeyDown);
        document.addEventListener("keyup", this._boundKeyUp);
        if (this.options.onOpenChange) this.options.onOpenChange(true);
    }

    hide() {
        if (!this.container) return;
        this.active = false;
        this.container.classList.remove("open");
        this.container.setAttribute("aria-hidden", "true");
        document.removeEventListener("keydown", this._boundKeyDown);
        document.removeEventListener("keyup", this._boundKeyUp);
        this._releaseAll();
        if (this.options.onOpenChange) this.options.onOpenChange(false);
    }

    setRecording(value) {
        this.recording = Boolean(value);
        const btn = this.container?.querySelector(".mk-rec-btn");
        if (btn) {
            btn.classList.toggle("active", this.recording);
            btn.textContent = this.recording ? "REC ●" : "REC";
        }
        this.onRecordChange(this.recording);
    }

    toggleRecording() {
        this.setRecording(!this.recording);
    }

    _whiteKeyCount() {
        let count = 0;
        for (let midi = this.startMidi; midi < this.endMidi; midi++) {
            if (!NOTE_NAMES[midi % 12].includes("#")) count++;
        }
        return count;
    }

    _keyDown(event) {
        if (event.repeat) return;
        const key = event.key.toLowerCase();

        if (key === "z") {
            this._transposeDown();
            event.preventDefault();
            return;
        }
        if (key === "x") {
            this._transposeUp();
            event.preventDefault();
            return;
        }

        const semitone = KB_MAP[key];
        if (semitone === undefined) return;
        event.preventDefault();

        const midi = this.baseMidi() + semitone;
        const noteName = this._midiToName(midi);
        const keyEl = this.container?.querySelector(`.mk-key[data-midi="${midi}"]`);
        if (this.heldKeys.has(midi)) return;
        this.heldKeys.set(midi, noteName);
        if (keyEl) keyEl.classList.add("pressed");
        this.onNoteOn(midi, noteName, 100);
    }

    _keyUp(event) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "x") return;

        const semitone = KB_MAP[key];
        if (semitone === undefined) return;

        const midi = this.baseMidi() + semitone;
        const noteName = this._midiToName(midi);
        if (!this.heldKeys.has(midi)) return;
        this.heldKeys.delete(midi);
        const keyEl = this.container?.querySelector(`.mk-key[data-midi="${midi}"]`);
        if (keyEl) keyEl.classList.remove("pressed");
        this.onNoteOff(midi, noteName);
    }

    _transposeDown() {
        if (this.transpose <= -4) return;
        this._releaseAll();
        this.transpose--;
        this._updateTransposeDisplay();
    }

    _transposeUp() {
        if (this.transpose >= 4) return;
        this._releaseAll();
        this.transpose++;
        this._updateTransposeDisplay();
    }

    _midiToName(midi) {
        const noteIndex = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        return `${NOTE_NAMES[noteIndex]}${octave}`;
    }

    _updateTransposeDisplay() {
        const el = this.container?.querySelector(".mk-transpose");
        if (!el) return;
        const val = this.transpose;
        if (val === 0) {
            el.textContent = "Octave: 0";
            el.className = "mk-transpose";
        } else {
            const sign = val > 0 ? "+" : "";
            el.textContent = `Octave: ${sign}${val}`;
            el.className = "mk-transpose active";
        }
    }

    _render() {
        if (!this.container) return;
        this.container.innerHTML = "";

        const header = document.createElement("div");
        header.className = "mk-header";

        const titleLeft = document.createElement("div");
        titleLeft.className = "mk-header-left";

        const title = document.createElement("span");
        title.className = "mk-title";
        title.textContent = "MIDI Keyboard";
        titleLeft.appendChild(title);

        const transposeEl = document.createElement("span");
        transposeEl.className = "mk-transpose";
        transposeEl.textContent = "Octave: 0";
        titleLeft.appendChild(transposeEl);

        header.appendChild(titleLeft);

        const controls = document.createElement("div");
        controls.className = "mk-controls";

        const recBtn = document.createElement("button");
        recBtn.type = "button";
        recBtn.className = "mk-rec-btn";
        recBtn.textContent = "REC";
        recBtn.title = "Record notes to sequencer";
        recBtn.addEventListener("click", () => this.toggleRecording());
        controls.appendChild(recBtn);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "mk-close-btn";
        closeBtn.textContent = "✕";
        closeBtn.title = "Close keyboard";
        closeBtn.addEventListener("click", () => this.hide());
        controls.appendChild(closeBtn);

        header.appendChild(controls);
        this.container.appendChild(header);

        const keyContainer = document.createElement("div");
        keyContainer.className = "mk-keys";

        const whiteKeysEl = document.createElement("div");
        whiteKeysEl.className = "mk-white-keys";

        const blackKeysEl = document.createElement("div");
        blackKeysEl.className = "mk-black-keys";

        const blackPositions = [];

        for (let midi = this.startMidi; midi < this.endMidi; midi++) {
            const noteIndex = midi % 12;
            const name = NOTE_NAMES[noteIndex];
            const octave = Math.floor(midi / 12) - 1;
            const label = `${name}${octave}`;
            const isBlack = name.includes("#");

            if (isBlack) {
                const prevWhite = midi - 1;
                const prevNoteIdx = prevWhite % 12;
                const prevWhiteIdx = WHITE_INDEX[prevNoteIdx];
                const octaveStart = Math.floor((prevWhite - this.startMidi) / 12);
                const globalWhitePos = octaveStart * 7 + prevWhiteIdx;
                blackPositions.push({ midi, label, globalWhitePos });
            }
        }

        for (let midi = this.startMidi; midi < this.endMidi; midi++) {
            const noteIndex = midi % 12;
            const name = NOTE_NAMES[noteIndex];
            const octave = Math.floor(midi / 12) - 1;
            const label = `${name}${octave}`;
            const isBlack = name.includes("#");

            if (!isBlack) {
                const key = document.createElement("button");
                key.type = "button";
                key.className = "mk-key mk-key-white";
                key.dataset.midi = String(midi);
                key.dataset.note = label;
                key.setAttribute("aria-label", label);

                const keyLabel = document.createElement("span");
                keyLabel.className = "mk-key-label";
                keyLabel.textContent = name;
                key.appendChild(keyLabel);

                this._bindKeyEvents(key, midi, label);
                whiteKeysEl.appendChild(key);
            }
        }

        blackPositions.forEach(({ midi, label, globalWhitePos }) => {
            const key = document.createElement("button");
            key.type = "button";
            key.className = "mk-key mk-key-black";
            key.dataset.midi = String(midi);
            key.dataset.note = label;
            key.style.setProperty("--white-pos", globalWhitePos);
            key.setAttribute("aria-label", label);
            this._bindKeyEvents(key, midi, label);
            blackKeysEl.appendChild(key);
        });

        keyContainer.appendChild(whiteKeysEl);
        keyContainer.appendChild(blackKeysEl);
        this.container.appendChild(keyContainer);

        this._renderHint();
    }

    _renderHint() {
        const hint = document.createElement("div");
        hint.className = "mk-hint";
        hint.textContent = "Z/X: Octave  |  A S D F G H J K : White  |  W E T Y U : Black";
        this.container.appendChild(hint);
    }

    _bindKeyEvents(keyEl, midi, noteName) {
        const handleDown = (event) => {
            event.preventDefault();
            if (this.heldKeys.has(midi)) return;
            this.heldKeys.set(midi, noteName);
            keyEl.classList.add("pressed");
            this.onNoteOn(midi, noteName, 100);
        };

        const handleUp = (event) => {
            event.preventDefault();
            if (!this.heldKeys.has(midi)) return;
            this.heldKeys.delete(midi);
            keyEl.classList.remove("pressed");
            this.onNoteOff(midi, noteName);
        };

        const handleLeave = () => {
            if (!this.heldKeys.has(midi)) return;
            this.heldKeys.delete(midi);
            keyEl.classList.remove("pressed");
            this.onNoteOff(midi, noteName);
        };

        keyEl.addEventListener("pointerdown", handleDown);
        keyEl.addEventListener("pointerup", handleUp);
        keyEl.addEventListener("pointerleave", handleLeave);
        keyEl.addEventListener("pointercancel", handleLeave);
    }

    _releaseAll() {
        this.heldKeys.forEach((noteName, midi) => {
            this.onNoteOff(midi, noteName);
        });
        this.heldKeys.clear();
        this.container?.querySelectorAll(".mk-key.pressed").forEach((el) => {
            el.classList.remove("pressed");
        });
    }

    pressKey(midi) {
        const key = this.container?.querySelector(`.mk-key[data-midi="${midi}"]`);
        if (!key || this.heldKeys.has(midi)) return;
        const noteName = key.dataset.note;
        this.heldKeys.set(midi, noteName);
        key.classList.add("pressed");
        this.onNoteOn(midi, noteName, 100);
    }

    releaseKey(midi) {
        if (!this.heldKeys.has(midi)) return;
        const noteName = this.heldKeys.get(midi);
        this.heldKeys.delete(midi);
        const key = this.container?.querySelector(`.mk-key[data-midi="${midi}"]`);
        if (key) key.classList.remove("pressed");
        this.onNoteOff(midi, noteName);
    }
}
