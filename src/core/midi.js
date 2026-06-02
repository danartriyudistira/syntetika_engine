export class MidiManager {
    constructor({ onMessage, onStateChange } = {}) {
        this.access = null;
        this.ready = false;
        this.onMessage = onMessage;
        this.onStateChange = onStateChange;
        this._clockTimer = null;
        this._clockOutputID = "";
    }

    async init() {
        if (!("requestMIDIAccess" in navigator)) {
            return { ok: false, reason: "unsupported" };
        }

        try {
            this.access = await navigator.requestMIDIAccess();
            this.ready = true;
            this.access.onstatechange = () => {
                this.assignInputHandlers();
                this.onStateChange?.();
            };
            this.assignInputHandlers();
            return { ok: true };
        } catch {
            this.ready = false;
            return { ok: false, reason: "denied" };
        }
    }

    isReady() {
        return this.ready;
    }

    inputs() {
        return this.access ? Array.from(this.access.inputs.values()) : [];
    }

    outputs() {
        return this.access ? Array.from(this.access.outputs.values()) : [];
    }

    inputById(id) {
        return this.access?.inputs.get(id) ?? null;
    }

    outputById(id) {
        return this.access?.outputs.get(id) ?? null;
    }

    assignInputHandlers() {
        this.inputs().forEach((input) => {
            input.onmidimessage = (message) => {
                this.onMessage?.(input.id, message.data);
            };
        });
    }

    pruneMissingDevices(config) {
        const inputs = this.inputs();
        const outputs = this.outputs();
        let changed = false;

        if (config.inputID && !inputs.some((input) => input.id === config.inputID)) {
            config.inputID = "";
            changed = true;
        }
        if (config.outputID && !outputs.some((output) => output.id === config.outputID)) {
            config.outputID = "";
            changed = true;
        }

        config.tracks.forEach((track) => {
            if (track.inputID && !inputs.some((input) => input.id === track.inputID)) {
                track.inputID = "";
                changed = true;
            }
            if (track.outputID && !outputs.some((output) => output.id === track.outputID)) {
                track.outputID = "";
                changed = true;
            }
        });

        return changed;
    }

    sendNote(outputID, channel, note, velocity = 0x70, durationMs = 120) {
        const output = this.outputById(outputID);
        if (!output) return false;

        const safeNote = clampMidiNote(note);
        output.send([statusByte(0x90, channel), safeNote, clampVelocity(velocity)]);
        window.setTimeout(() => {
            output.send([statusByte(0x80, channel), safeNote, 0x00]);
        }, Math.max(1, durationMs));
        return true;
    }

    sendNotes(outputID, channel, notes, velocity = 0x70, durationMs = 120) {
        return notes
            .map((note) => this.sendNote(outputID, channel, note, velocity, durationMs))
            .some(Boolean);
    }

    sendNoteOn(outputID, channel, note, velocity = 0x70) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([statusByte(0x90, channel), clampMidiNote(note), clampVelocity(velocity)]);
        return true;
    }

    sendNoteOff(outputID, channel, note) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([statusByte(0x80, channel), clampMidiNote(note), 0x00]);
        return true;
    }

    panic(outputID = "") {
        const outputs = outputID ? [this.outputById(outputID)].filter(Boolean) : this.outputs();
        outputs.forEach((output) => {
            for (let channel = 1; channel <= 16; channel += 1) {
                output.send([statusByte(0xb0, channel), 123, 0]);
                output.send([statusByte(0xb0, channel), 120, 0]);
                for (let note = 0; note <= 127; note += 1) {
                    output.send([statusByte(0x80, channel), note, 0]);
                }
            }
        });
    }

    sendRaw(outputID, data) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send(data);
        return true;
    }

    sendMidiClock(outputID) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([0xF8]);
        return true;
    }

    sendMidiStart(outputID) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([0xFA]);
        return true;
    }

    sendMidiStop(outputID) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([0xFC]);
        return true;
    }

    sendMidiContinue(outputID) {
        const output = this.outputById(outputID);
        if (!output) return false;
        output.send([0xFB]);
        return true;
    }

    startClockStream(outputID, bpm) {
        this.stopClockStream();
        if (!outputID || !this.outputById(outputID)) return;
        this._clockOutputID = outputID;
        const intervalMs = 60000 / bpm / 24;
        this._clockTimer = setInterval(() => {
            this.sendMidiClock(this._clockOutputID);
        }, Math.max(1, intervalMs));
    }

    stopClockStream() {
        if (this._clockTimer) {
            clearInterval(this._clockTimer);
            this._clockTimer = null;
        }
        this._clockOutputID = "";
    }

    isClockRunning() {
        return this._clockTimer !== null;
    }
}

export function statusByte(command, channel) {
    return command + (parseChannel(channel) - 1);
}

export function parseChannel(value, allowOmni = false) {
    const number = Number(value);
    if (allowOmni && number === 0) return 0;
    if (Number.isInteger(number) && number >= 1 && number <= 16) return number;
    return allowOmni ? 0 : 1;
}

function clampMidiNote(note) {
    const number = Number(note);
    return Number.isInteger(number) ? Math.min(127, Math.max(0, number)) : 60;
}

function clampVelocity(velocity) {
    const number = Number(velocity);
    return Number.isInteger(number) ? Math.min(127, Math.max(0, number)) : 100;
}
