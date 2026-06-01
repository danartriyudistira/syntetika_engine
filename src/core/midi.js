export class MidiManager {
    constructor({ onMessage, onStateChange } = {}) {
        this.access = null;
        this.ready = false;
        this.onMessage = onMessage;
        this.onStateChange = onStateChange;
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
