import { MATRIX_CHANNEL } from "./src/core/constants.js";
import { MatrixControlManager } from "./src/core/matrix-control.js";

const SEQUENCER_MODES = ["drum", "bass", "melody", "other"];
const BATCH_WINDOW_MS = 32;

const els = {
    state: document.querySelector("#mtx-state"),
    grid: document.querySelector("#mtx-grid"),
    audio: document.querySelector("#mtx-audio"),
    play: document.querySelector("#mtx-play"),
    bpm: document.querySelector("#mtx-bpm"),
    lastBatch: document.querySelector("#last-batch"),
    sync: document.querySelector("#sync-btn"),
    fullscreen: document.querySelector("#fullscreen-btn")
};

let currentState = null;
let lastRenderSignature = "";
let batchTimer = null;
const pendingPresets = new Map();
const activePointers = new Map();

const manager = new MatrixControlManager({
    channelName: MATRIX_CHANNEL,
    isControl: true,
    onCommand: (command, payload) => {
        if (command !== "state") return;
        currentState = payload;
        renderState();
    }
});

manager.start();

document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("selectstart", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());

els.grid?.addEventListener("pointerdown", (event) => {
    const modeButton = event.target.closest("[data-mode-select]");
    if (modeButton) {
        event.preventDefault();
        modeButton.setPointerCapture?.(event.pointerId);
        activePointers.set(event.pointerId, modeButton);
        modeButton.classList.add("touching");
        sendMatrixCommand("switch-mode", { kind: modeButton.dataset.modeSelect });
        markPending(labelFor(modeButton.dataset.modeSelect));
        return;
    }

    const globalButton = event.target.closest("[data-global-preset]");
    if (globalButton) {
        event.preventDefault();
        globalButton.setPointerCapture?.(event.pointerId);
        activePointers.set(event.pointerId, globalButton);
        queueGlobalPreset(globalButton);
        return;
    }

    const presetButton = event.target.closest("[data-preset-kind][data-preset]");
    if (presetButton) {
        event.preventDefault();
        presetButton.setPointerCapture?.(event.pointerId);
        activePointers.set(event.pointerId, presetButton);
        queuePreset(presetButton);
        return;
    }

    const bankButton = event.target.closest("[data-bank]");
    if (bankButton) {
        event.preventDefault();
        sendMatrixCommand("switch-bank", {
            kind: currentState?.mode || "drum",
            bank: Number(bankButton.dataset.bank)
        });
        markPending(`Bank B${Number(bankButton.dataset.bank) + 1}`);
    }
});

els.grid?.addEventListener("pointerup", releasePointer);
els.grid?.addEventListener("pointercancel", releasePointer);
els.grid?.addEventListener("pointerleave", releasePointer);

els.play?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    sendMatrixCommand("toggle-play");
    markPending("Transport");
});

document.querySelector(".mtx-transport")?.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-transport-command]");
    if (!button) return;
    event.preventDefault();
    sendMatrixCommand(button.dataset.transportCommand, {
        value: Number(button.dataset.value)
    });
    markPending(button.textContent.trim());
});

els.audio?.addEventListener("pointerdown", (event) => {
    const audioButton = event.target.closest("[data-audio-toggle-active]");
    if (audioButton) {
        event.preventDefault();
        sendMatrixCommand("toggle-internal-audio", { kind: currentState?.mode || "drum" });
        markPending("Audio");
        return;
    }

    const soundButton = event.target.closest("[data-sound-kind][data-sound-style]");
    if (!soundButton) return;
    event.preventDefault();
    sendMatrixCommand("switch-sound", {
        kind: soundButton.dataset.soundKind,
        style: soundButton.dataset.soundStyle
    });
    markPending(soundButton.textContent.trim());
});

els.sync?.addEventListener("click", () => {
    manager.requestSync();
    markPending("Sync");
});

els.fullscreen?.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch {
        setStatus("Fullscreen blocked");
    }
});

window.addEventListener("focus", () => manager.requestSync());
window.addEventListener("load", () => {
    manager.requestSync();
    syncFromOpener();
});
window.setInterval(syncFromOpener, 750);

function queuePreset(button) {
    const kind = button.dataset.presetKind;
    const slot = Number(button.dataset.preset);
    if (!SEQUENCER_MODES.includes(kind) || !Number.isInteger(slot)) return;

    pendingPresets.set(kind, { kind, slot });
    button.classList.add("touching", "queued");
    window.setTimeout(() => button.classList.remove("queued"), 160);

    if (batchTimer) window.clearTimeout(batchTimer);
    batchTimer = window.setTimeout(flushPresetBatch, BATCH_WINDOW_MS);
}

function queueGlobalPreset(button) {
    const slot = Number(button.dataset.globalPreset);
    if (!Number.isInteger(slot)) return;
    button.classList.add("touching", "queued");
    window.setTimeout(() => button.classList.remove("queued"), 160);
    sendMatrixCommand("switch-all-presets", { slot });
    markPending(`Column ${slot + 1}`);
}

function flushPresetBatch() {
    batchTimer = null;
    const items = Array.from(pendingPresets.values());
    pendingPresets.clear();
    if (!items.length) return;

    if (items.length === 1) {
        const item = items[0];
        sendMatrixCommand("switch-preset", item);
    } else {
        sendMatrixCommand("switch-multiple-presets", { items });
    }
    markPending(formatBatch(items));
}

function releasePointer(event) {
    const button = activePointers.get(event.pointerId);
    if (!button) return;
    button.classList.remove("touching");
    activePointers.delete(event.pointerId);
}

function sendMatrixCommand(command, payload) {
    const openerApi = openerMatrixApi();
    if (openerApi?.command) {
        openerApi.command(command, payload);
        syncFromOpener();
        return;
    }
    manager.sendCommand(command, payload);
}

function syncFromOpener() {
    const openerApi = openerMatrixApi();
    const state = openerApi?.getState?.();
    if (!state) return;
    currentState = state;
    renderState();
}

function openerMatrixApi() {
    try {
        return window.opener?.SyntetikaEngineMatrix || window.opener?.AudioReactiveFXMatrix || null;
    } catch {
        return null;
    }
}

function renderState() {
    if (!currentState) {
        setStatus("No Sync");
        return;
    }
    const signature = matrixStateSignature(currentState);
    if (signature === lastRenderSignature) return;
    lastRenderSignature = signature;
    setStatus("Linked");
    renderTransport();
    renderAudio();
    const mode = currentState.mode || "drum";
    const displayedBank = Number(currentState.activeBanks?.[mode]) || 0;

    document.querySelectorAll("[data-pattern-row]").forEach((row) => {
        row.classList.toggle("active", row.dataset.patternRow === currentState.mode);
    });

    document.querySelectorAll("[data-preset-kind][data-preset]").forEach((button) => {
        const kind = button.dataset.presetKind;
        const slot = Number(button.dataset.preset);
        const isCurrentBank = Number(currentState.activeBanks?.[kind]) === displayedBank;
        button.classList.toggle("active", isCurrentBank && currentState.activeSlots?.[kind] === slot);
    });

    document.querySelectorAll("[data-bank]").forEach((button) => {
        const bank = Number(button.dataset.bank);
        button.classList.toggle("active", displayedBank === bank);
    });

    document.querySelectorAll("[data-global-preset]").forEach((button) => {
        const slot = Number(button.dataset.globalPreset);
        const allSelected = SEQUENCER_MODES.every((kind) => Number(currentState.activeBanks?.[kind]) === displayedBank && currentState.activeSlots?.[kind] === slot);
        button.classList.toggle("active", allSelected);
    });
}

function matrixStateSignature(state) {
    return JSON.stringify({
        mode: state.mode,
        bpm: state.bpm,
        transportRunning: Boolean(state.transportRunning),
        internalAudio: state.internalAudio,
        sounds: state.sounds,
        activeBanks: state.activeBanks,
        activeSlots: state.activeSlots
    });
}

function renderTransport() {
    const running = Boolean(currentState?.transportRunning);
    if (els.play) {
        els.play.textContent = running ? "Stop" : "Play";
        els.play.classList.toggle("playing", running);
    }
    if (els.bpm) els.bpm.textContent = currentState?.bpm || 120;
}

function renderAudio() {
    const activeKind = currentState?.mode || "drum";

    document.querySelectorAll("[data-audio-toggle-active]").forEach((button) => {
        const enabled = currentState?.internalAudio?.[activeKind] !== false;
        button.textContent = `${labelFor(activeKind)} ${enabled ? "On" : "Off"}`;
        button.classList.toggle("active", enabled);
        button.classList.toggle("muted", !enabled);
    });

    document.querySelectorAll("[data-sound-group]").forEach((group) => {
        group.hidden = group.dataset.soundGroup !== activeKind;
    });

    document.querySelectorAll("[data-sound-kind][data-sound-style]").forEach((button) => {
        const kind = button.dataset.soundKind;
        const style = button.dataset.soundStyle;
        button.classList.toggle("active", currentState?.sounds?.[kind] === style);
    });
}

function formatBatch(items) {
    return items
        .map((item) => `${labelFor(item.kind)} P${item.slot + 1}`)
        .join(" + ");
}

function labelFor(kind) {
    return {
        drum: "Drum",
        bass: "Bass",
        melody: "Melody",
        other: "Mono"
    }[kind] || kind;
}

function markPending(text = "Sent") {
    setStatus("Sent");
    if (els.lastBatch) els.lastBatch.textContent = text;
    window.setTimeout(() => manager.requestSync(), 80);
}

function setStatus(text) {
    if (els.state) els.state.textContent = text;
}
