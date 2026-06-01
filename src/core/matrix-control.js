export class MatrixControlManager {
    constructor({ channelName, getState, onCommand, isControl = false }) {
        this.getState = getState;
        this.onCommand = onCommand;
        this.isControl = isControl;
        this.channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;
        this.storageKey = `${channelName}_message`;
        this.instanceId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        this.lastStorageTimestamp = 0;
        this.pollTimer = null;
    }

    start() {
        this.channel?.addEventListener("message", (event) => this.handleMessage(event.data));
        window.addEventListener("storage", (event) => {
            if (event.key === this.storageKey) this.handleStorageEnvelope(event.newValue);
        });
        if (!this.channel) this.pollTimer = window.setInterval(() => this.pollStorage(), 180);
        if (this.isControl) this.requestSync();
    }

    requestSync() {
        this.send({ type: "MATRIX_SYNC_REQUEST" });
    }

    syncState() {
        this.send({ type: "MATRIX_STATE", state: this.getState?.() });
    }

    sendCommand(command, payload = {}) {
        this.send({ type: "MATRIX_COMMAND", command, payload });
    }

    send(message) {
        if (this.channel) {
            this.channel.postMessage(message);
            return;
        }
        this.writeStorage(message);
    }

    openControlWindow() {
        const url = `${location.origin}${location.pathname.replace(/[^/]*$/, "matrix.html")}`;
        return window.open(url, "SyntetikaEngineMatrixControl", "popup=yes,width=1280,height=800");
    }

    openOutput() {
        const popup = this.openControlWindow();
        return {
            ok: Boolean(popup),
            popup,
            reason: popup ? "" : "Matrix pop-up blocked"
        };
    }

    handleMessage(message) {
        if (!message) return;
        if (!this.isControl) {
            if (message.type === "MATRIX_SYNC_REQUEST") this.syncState();
            if (message.type === "MATRIX_COMMAND") this.onCommand?.(message.command, message.payload || {});
            return;
        }
        if (message.type === "MATRIX_STATE" && message.state) this.onCommand?.("state", message.state);
    }

    writeStorage(message) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                id: this.instanceId,
                timestamp: Date.now() + Math.random(),
                message
            }));
        } catch {
            // BroadcastChannel remains the primary transport when storage is unavailable.
        }
    }

    pollStorage() {
        try {
            this.handleStorageEnvelope(localStorage.getItem(this.storageKey));
        } catch {
            // Ignore storage errors; this manager can still work via BroadcastChannel.
        }
    }

    handleStorageEnvelope(rawEnvelope) {
        if (!rawEnvelope) return;
        let envelope = null;
        try {
            envelope = JSON.parse(rawEnvelope);
        } catch {
            return;
        }
        if (!envelope || envelope.id === this.instanceId || envelope.timestamp <= this.lastStorageTimestamp) return;
        this.lastStorageTimestamp = envelope.timestamp;
        this.handleMessage(envelope.message);
    }
}
