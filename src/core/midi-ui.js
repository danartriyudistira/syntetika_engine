import { DRUM_VOICE_INDEX, INSTRUMENTS, LEGACY_MIDI_KEY, MIDI_KEY } from "./constants.js";
import { parseChannel } from "./midi.js";
import { clamp, midiNoteName, noteNameToMidi } from "./utils.js";

export function loadMidiConfig() {
    const defaults = createDefaultMidiConfig();

    try {
        const saved = JSON.parse(localStorage.getItem(MIDI_KEY)) || JSON.parse(localStorage.getItem(LEGACY_MIDI_KEY));
        if (!saved) return defaults;
        return normalizeMidiConfig(saved, defaults);
    } catch {
        return defaults;
    }
}

export function saveMidiConfig(midiConfig) {
    localStorage.setItem(MIDI_KEY, JSON.stringify(midiConfig));
}

export const TRIGGER_SOURCES = [
    { id: "", label: "—" },
    { id: "kick", label: "Kick" },
    { id: "snare", label: "Snare" },
    { id: "hat", label: "Hat" },
    { id: "clap", label: "Clap" },
    { id: "bass", label: "Bass" },
    { id: "melody", label: "Melody" },
    { id: "mono", label: "Mono" },
];

export function createDefaultMidiConfig() {
    return {
        inputID: "",
        outputID: "",
        shaderTriggers: [],
        tracks: INSTRUMENTS.map((instrument) => ({
            id: instrument.id,
            type: instrument.type,
            drumIndex: instrument.drumIndex,
            label: instrument.label,
            inputID: "",
            outputID: "",
            inputChannel: 0,
            outputChannel: instrument.hwChannel ?? 1,
            inNote: instrument.defaultNote,
            outNotes: [instrument.defaultNote],
            transpose: 0
        }))
    };
}

export function normalizeMidiConfig(saved, defaults = createDefaultMidiConfig()) {
    const legacyMapping = saved.mapping || [];
    const firstSavedTrack = Array.isArray(saved.tracks) ? saved.tracks.find((track) => track?.inputID || track?.outputID) : null;
    const firstLegacyTrack = Array.isArray(legacyMapping) ? legacyMapping.find((track) => track?.inputID || track?.outputID) : null;
    const shaderTriggers = Array.isArray(saved.shaderTriggers) ? saved.shaderTriggers.map((m) => ({
        paramName: typeof m?.paramName === "string" ? m.paramName : "",
        source: typeof m?.source === "string" ? m.source : "",
        rangeStart: Number.isFinite(Number(m?.rangeStart)) ? Number(m.rangeStart) : 0,
        rangeMax: Number.isFinite(Number(m?.rangeMax)) ? Number(m.rangeMax) : 1,
        reverse: m?.reverse === true,
    })).filter((m) => m.paramName && m.source) : [];

    return {
        inputID: saved.inputID ?? firstSavedTrack?.inputID ?? firstLegacyTrack?.inputID ?? defaults.inputID,
        outputID: saved.outputID ?? firstSavedTrack?.outputID ?? firstLegacyTrack?.outputID ?? defaults.outputID,
        shaderTriggers,
        tracks: defaults.tracks.map((track, index) => {
            const savedTrack = saved.tracks?.find((item) => item.id === track.id) || saved.tracks?.find((item) => item.id === legacyDrumId(track));
            const legacy = legacyMapping[index] || legacyMapping[legacyDrumIndex(track)] || {};
            const normalized = {
                ...track,
                ...legacy,
                ...savedTrack,
                inputID: savedTrack?.inputID ?? saved.inputID ?? track.inputID,
                outputID: savedTrack?.outputID ?? saved.outputID ?? track.outputID,
                inputChannel: parseChannel(savedTrack?.inputChannel ?? legacy.inputChannel ?? track.inputChannel, true),
                outputChannel: parseChannel(savedTrack?.outputChannel ?? legacy.outputChannel ?? track.outputChannel),
                inNote: parseMidiNote(savedTrack?.inNote ?? legacy.inNote ?? track.inNote, track.inNote),
                outNotes: parseNoteList(savedTrack?.outNotes ?? legacy.outNotes ?? track.outNotes, track.outNotes),
                transpose: clamp(Number(savedTrack?.transpose ?? legacy.transpose ?? track.transpose) || 0, -24, 24)
            };
            if ((normalized.type === "bass" || normalized.type === "melody" || normalized.type === "other") && !savedTrack?.outNotes) {
                normalized.outNotes = [];
                normalized.transpose = 0;
            }
            if (normalized.type === "bass" || normalized.type === "melody" || normalized.type === "other") {
                normalized.outNotes = [];
                normalized.transpose = 0;
            }
            return normalized;
        })
    };
}

function legacyDrumId(track) {
    if (track.type !== "drum") return "";
    const legacyIndex = legacyDrumIndex(track);
    return legacyIndex >= 0 ? `drum-${legacyIndex}` : "";
}

function legacyDrumIndex(track) {
    return {
        kick: 0,
        snare: 1,
        "hat-close": 2,
        "hat-open": 3
    }[track.drumVoice] ?? -1;
}

export function syncMidiDevices(midiConfig, midi) {
    const inputs = midi?.inputs() ?? [];
    const outputs = midi?.outputs() ?? [];
    if (midiConfig.inputID && !inputs.some((input) => input.id === midiConfig.inputID)) midiConfig.inputID = "";
    if (midiConfig.outputID && !outputs.some((output) => output.id === midiConfig.outputID)) midiConfig.outputID = "";
    midiConfig.tracks.forEach((track) => {
        if (track.inputID && !inputs.some((input) => input.id === track.inputID)) track.inputID = "";
        if (track.outputID && !outputs.some((output) => output.id === track.outputID)) track.outputID = "";
    });
}

export function renderMidiUI({
    deviceRouting,
    rows,
    midi,
    midiConfig,
    learningTrack,
    setLearningTrack,
    saveMidi,
    triggerPreview,
    setMidiStatus
}) {
    if (!rows) return;
    syncMidiDevices(midiConfig, midi);
    rows.innerHTML = "";
    const inputs = midi?.inputs() ?? [];
    const outputs = midi?.outputs() ?? [];
    renderDeviceRouting(deviceRouting, inputs, outputs, midiConfig, saveMidi);

    midiConfig.tracks.forEach((mapping) => {
        const row = document.createElement("div");
        row.className = "midi-row";

        const label = document.createElement("strong");
        label.textContent = mapping.label;

        const inputChannel = createChannelSelect(mapping.inputChannel, true, `${mapping.label} input channel`);
        inputChannel.addEventListener("change", () => {
            mapping.inputChannel = parseChannel(inputChannel.value, true);
            saveMidi();
        });

        const learn = document.createElement("button");
        learn.type = "button";
        learn.className = `btn-learn${learningTrack === mapping.id ? " active" : ""}`;
        learn.textContent = learningTrack === mapping.id ? "Listening" : "Learn";
        learn.addEventListener("click", () => {
            setLearningTrack(learningTrack === mapping.id ? null : mapping.id);
        });

        const inputNote = mapping.type === "bass" || mapping.type === "melody" || mapping.type === "other"
            ? createStaticMidiCell("Any")
            : createNoteSelect(mapping.inNote, `${mapping.label} input note`);
        if (mapping.type === "drum") {
            inputNote.addEventListener("change", () => {
                mapping.inNote = parseMidiNote(inputNote.value, mapping.inNote);
                saveMidi();
            });
        }

        const outputChannel = createChannelSelect(mapping.outputChannel, false, `${mapping.label} output channel`);
        outputChannel.addEventListener("change", () => {
            mapping.outputChannel = parseChannel(outputChannel.value);
            saveMidi();
        });

        const outputNote = mapping.type === "bass" || mapping.type === "melody" || mapping.type === "other"
            ? createStaticMidiCell("Any")
            : createNoteSelect(mapping.outNotes[0] ?? mapping.inNote, `${mapping.label} output note`);
        if (mapping.type === "drum") {
            outputNote.title = "Output MIDI note untuk instrumen drum ini";
            outputNote.addEventListener("change", () => {
                mapping.outNotes = [parseMidiNote(outputNote.value, mapping.outNotes[0] ?? mapping.inNote)];
                saveMidi();
            });
        } else {
            outputNote.title = "Output mengikuti note dari sequencer.";
            mapping.outNotes = [];
            mapping.transpose = 0;
        }

        const test = document.createElement("button");
        test.type = "button";
        test.className = "mini-btn";
        test.textContent = "Test";
        test.addEventListener("click", () => {
            if (mapping.type === "drum") triggerPreview("drum", mapping.drumIndex ?? drumIndexFromTrack(mapping.id));
            if (mapping.type === "bass") triggerPreview("bass", "C1");
            if (mapping.type === "melody") triggerPreview("melody", "C2");
            if (mapping.type === "other") triggerPreview("other", "C2");
        });

        row.append(label, inputChannel, learn, inputNote, outputChannel, outputNote, test);
        rows.appendChild(row);
    });

    if (!midi?.isReady() && !("requestMIDIAccess" in navigator)) {
        setMidiStatus("Web MIDI tidak tersedia di browser ini. Mapping tetap bisa diedit untuk nanti.");
    }
}

function renderDeviceRouting(container, inputs, outputs, midiConfig, saveMidi) {
    if (!container) return;
    container.innerHTML = "";

    const inputField = createDeviceSelect("MIDI In", inputs, midiConfig.inputID, "Global MIDI input");
    inputField.select.addEventListener("change", () => {
        midiConfig.inputID = inputField.select.value;
        saveMidi();
    });

    const outputField = createDeviceSelect("MIDI Out", outputs, midiConfig.outputID, "Global MIDI output");
    outputField.select.addEventListener("change", () => {
        midiConfig.outputID = outputField.select.value;
        saveMidi();
    });

    container.append(inputField.field, outputField.field);
}

function createDeviceSelect(labelText, devices, value, ariaLabel) {
    const field = document.createElement("label");
    field.className = "device-select";
    field.textContent = labelText;

    const select = document.createElement("select");
    select.setAttribute("aria-label", ariaLabel);
    fillSelect(select, devices, value);
    field.appendChild(select);

    return { field, select };
}

export function fillSelect(select, devices, value) {
    select.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "None";
    select.appendChild(none);
    devices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = device.name || device.id;
        option.selected = device.id === value;
        select.appendChild(option);
    });
}

export function createChannelSelect(value, includeOmni, label) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", label);
    if (includeOmni) {
        const omni = document.createElement("option");
        omni.value = "0";
        omni.textContent = "Omni";
        omni.selected = Number(value) === 0;
        select.appendChild(omni);
    }
    for (let channel = 1; channel <= 16; channel += 1) {
        const option = document.createElement("option");
        option.value = String(channel);
        option.textContent = String(channel);
        option.selected = Number(value) === channel;
        select.appendChild(option);
    }
    return select;
}

export function createNoteSelect(value, label) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", label);
    for (let note = 0; note <= 127; note += 1) {
        const option = document.createElement("option");
        option.value = String(note);
        option.textContent = midiNoteName(note);
        option.selected = Number(value) === note;
        select.appendChild(option);
    }
    return select;
}

export function createStaticMidiCell(text) {
    const cell = document.createElement("div");
    cell.className = "midi-static-cell";
    cell.textContent = text;
    return cell;
}

export function channelMatches(configChannel, incomingChannel) {
    return Number(configChannel) === 0 || Number(configChannel) === Number(incomingChannel);
}

export function parseMidiNote(value, fallback = 36) {
    if (typeof value === "string" && /[A-G]/i.test(value)) {
        return noteNameToMidi(value);
    }
    const note = Number(value);
    return Number.isInteger(note) && note >= 0 && note <= 127 ? note : fallback;
}

export function parseNoteList(value, fallback = [36]) {
    const list = Array.isArray(value) ? value : String(value).split(",");
    const parsed = list
        .map((item) => Number(String(item).trim()))
        .filter((note) => Number.isInteger(note) && note >= 0 && note <= 127);
    return parsed.length ? parsed : fallback;
}

export function drumIndexFromTrack(id) {
    const match = /^drum-(\d+)$/.exec(id);
    if (match) return Number(match[1]);
    const voiceMatch = /^drum-(.+)$/.exec(id);
    return voiceMatch ? DRUM_VOICE_INDEX[voiceMatch[1]] ?? 0 : 0;
}
