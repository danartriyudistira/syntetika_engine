import { MATRIX_CHANNEL } from "./src/core/constants.js";
import { MatrixControlManager } from "./src/core/matrix-control.js";

const SEQUENCER_MODES = ["drum", "bass", "melody", "other"];

const els = {
    state: document.querySelector("#matrix-state"),
    grid: document.querySelector("#matrix-grid"),
    audio: document.querySelector("#matrix-audio"),
    play: document.querySelector("#matrix-play"),
    bpm: document.querySelector("#matrix-bpm"),
    sync: document.querySelector("#sync-btn"),
    fullscreen: document.querySelector("#fullscreen-btn")
};

let currentState = null;
let lastRenderSignature = "";

const manager = new MatrixControlManager({
    channelName: MATRIX_CHANNEL,
    isControl: true,
    onCommand: (command, payload) => {
        if (command === "state") {
            currentState = payload;
            renderState();
        }
    }
});

manager.start();

els.grid?.addEventListener("click", (event) => {
    const modeButton = event.target.closest("[data-mode-select]");
    if (modeButton) {
        sendMatrixCommand("switch-mode", { kind: modeButton.dataset.modeSelect });
        markPending();
        return;
    }

    const globalButton = event.target.closest("[data-global-preset]");
    if (globalButton) {
        sendMatrixCommand("switch-all-presets", { slot: Number(globalButton.dataset.globalPreset) });
        markPending();
        return;
    }

    const bankButton = event.target.closest("[data-bank]");
    if (bankButton) {
        sendMatrixCommand("switch-bank", {
            kind: currentState?.mode || "drum",
            bank: Number(bankButton.dataset.bank)
        });
        markPending();
        return;
    }

    const presetButton = event.target.closest("[data-preset]");
    if (presetButton) {
        sendMatrixCommand("switch-preset", {
            kind: presetButton.dataset.presetKind,
            slot: Number(presetButton.dataset.preset)
        });
        markPending();
    }
});

els.play?.addEventListener("click", () => {
    sendMatrixCommand("toggle-play");
    markPending();
});

document.querySelector(".matrix-transport")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-transport-command]");
    if (!button) return;
    sendMatrixCommand(button.dataset.transportCommand, {
        value: Number(button.dataset.value)
    });
    markPending();
});

els.audio?.addEventListener("click", (event) => {
    const audioButton = event.target.closest("[data-audio-toggle-active]");
    if (audioButton) {
        sendMatrixCommand("toggle-internal-audio", { kind: currentState?.mode || "drum" });
        markPending();
        return;
    }

    const soundButton = event.target.closest("[data-sound-kind][data-sound-style]");
    if (soundButton) {
        sendMatrixCommand("switch-sound", {
            kind: soundButton.dataset.soundKind,
            style: soundButton.dataset.soundStyle
        });
        markPending();
    }
});

els.sync?.addEventListener("click", () => {
    manager.requestSync();
    markPending();
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

    document.querySelectorAll("[data-global-preset]").forEach((button) => {
        const slot = Number(button.dataset.globalPreset);
        const allSelected = SEQUENCER_MODES.every((kind) => Number(currentState.activeBanks?.[kind]) === displayedBank && currentState.activeSlots?.[kind] === slot);
        button.classList.toggle("active", allSelected);
    });

    document.querySelectorAll("[data-bank]").forEach((button) => {
        const bank = Number(button.dataset.bank);
        button.classList.toggle("active", displayedBank === bank);
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
        const kind = activeKind;
        const enabled = currentState?.internalAudio?.[kind] !== false;
        const label = kind === "drum" ? "Drum" : kind === "other" ? "Mono" : kind[0].toUpperCase() + kind.slice(1);
        button.textContent = `${label} ${enabled ? "On" : "Off"}`;
        button.classList.toggle("active", enabled);
        button.classList.toggle("muted", !enabled);
    });

    document.querySelectorAll("[data-sound-group]").forEach((group) => {
        group.hidden = group.dataset.soundGroup !== activeKind;
    });

    document.querySelectorAll("[data-sound-kind][data-sound-style]").forEach((button) => {
        const kind = button.dataset.soundKind;
        const style = button.dataset.soundStyle;
        const activeStyle = currentState?.sounds?.[kind];
        button.classList.toggle("active", activeStyle === style);
    });
}

function markPending() {
    setStatus("Sent");
    window.setTimeout(() => manager.requestSync(), 80);
}

function setStatus(text) {
    if (els.state) els.state.textContent = text;
}
