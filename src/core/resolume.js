export const RESOLUME_TRACK_LAYERS = {
    drum: 1,
    bass: 2,
    melody: 3,
    other: 4
};

export const RESOLUME_DASHBOARD_LINKS = {
    kick: { label: "Kick", layer: 1, link: 1 },
    snare: { label: "Snare", layer: 1, link: 2 },
    clap: { label: "Clap", layer: 1, link: 2 },
    "hat-close": { label: "Closed Hat", layer: 1, link: 3 },
    "hat-open": { label: "Open Hat", layer: 1, link: 4 },
    "tom-lo": { label: "Tom Low", layer: 1, link: 5 },
    "tom-hi": { label: "Tom Hi", layer: 1, link: 5 },
    bass: { label: "Bass", layer: 2, link: 6 },
    melody: { label: "Melody", layer: 3, link: 7 },
    other: { label: "Mono", layer: 4, link: 8 }
};

export function createResolumeConfigDefaults() {
    return {
        enabled: false,
        host: "127.0.0.1",
        port: 8080,
        matrixTrigger: true,
        deckTrigger: true,
        dashboardPulse: true,
        oscHost: "127.0.0.1",
        oscPort: 7000,
        oscBridgeUrl: "http://127.0.0.1:8765/osc",
        pulseAmount: 100,
        pulseLengthMs: 80,
        pulseDebounceMs: 24,
        oscTargets: {
            clipTargets: createClipTargetDefaults()
        }
    };
}

export function normalizeResolumeConfig(saved = {}, defaults = createResolumeConfigDefaults()) {
    const port = Number(saved.port);
    const oscPort = Number(saved.oscPort);
    const amount = Number(saved.pulseAmount);
    const length = Number(saved.pulseLengthMs);
    const debounce = Number(saved.pulseDebounceMs);
    return {
        ...defaults,
        enabled: Boolean(saved.enabled),
        host: typeof saved.host === "string" && saved.host.trim() ? saved.host.trim() : defaults.host,
        port: Number.isFinite(port) ? clampNumber(Math.round(port), 1, 65535) : defaults.port,
        matrixTrigger: typeof saved.matrixTrigger === "boolean" ? saved.matrixTrigger : defaults.matrixTrigger,
        deckTrigger: typeof saved.deckTrigger === "boolean" ? saved.deckTrigger : defaults.deckTrigger,
        dashboardPulse: typeof saved.dashboardPulse === "boolean" ? saved.dashboardPulse : defaults.dashboardPulse,
        oscHost: typeof saved.oscHost === "string" && saved.oscHost.trim() ? saved.oscHost.trim() : defaults.oscHost,
        oscPort: Number.isFinite(oscPort) ? clampNumber(Math.round(oscPort), 1, 65535) : defaults.oscPort,
        oscBridgeUrl: typeof saved.oscBridgeUrl === "string" && saved.oscBridgeUrl.trim() ? saved.oscBridgeUrl.trim() : defaults.oscBridgeUrl,
        pulseAmount: Number.isFinite(amount) ? clampNumber(Math.round(amount), 0, 100) : defaults.pulseAmount,
        pulseLengthMs: Number.isFinite(length) ? clampNumber(Math.round(length), 20, 1000) : defaults.pulseLengthMs,
        pulseDebounceMs: Number.isFinite(debounce) ? clampNumber(Math.round(debounce), 0, 250) : defaults.pulseDebounceMs,
        oscTargets: normalizeOscTargets({
            ...saved.oscTargets,
            clipTargets: saved.oscTargets?.clipTargets || saved.oscClipTargets
        }, defaults.oscTargets)
    };
}

export class ResolumeController {
    constructor(config = createResolumeConfigDefaults(), onStatus = null) {
        this.config = normalizeResolumeConfig(config);
        this.onStatus = onStatus;
        this.activeClipsByLayer = new Map();
        this.dashboardParamIds = Array(8).fill("");
        this.dashboardResolvePromise = null;
        this.pulseTimers = new Map();
        this.lastPulseAt = new Map();
        this.lastStatus = "Resolume idle";
    }

    setConfig(config) {
        this.config = normalizeResolumeConfig(config);
        this.dashboardParamIds = Array(8).fill("");
        this.dashboardResolvePromise = null;
    }

    baseUrl() {
        const host = this.config.host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return `http://${host}:${this.config.port}/api/v1`;
    }

    async test() {
        if (!this.config.enabled) {
            this.status("Resolume disabled");
            return { ok: false, reason: "disabled" };
        }
        const rest = await this.safeRequest("/composition", { method: "GET", quiet: true });
        const bridge = await this.testOscBridge();
        if (rest.ok && bridge.ok) {
            this.status(`Resolume REST OK | OSC bridge OK -> ${this.config.oscHost}:${this.config.oscPort}`);
            return { ok: true };
        }
        if (rest.ok) {
            this.status("Resolume REST OK | OSC bridge offline");
            return { ok: true, bridge };
        }
        this.status("Resolume REST error");
        return rest;
    }

    async autoDetect(hosts = []) {
        const candidates = [...new Set([
            this.config.host,
            "127.0.0.1",
            "localhost",
            location.hostname,
            ...hosts
        ].filter(Boolean))];

        const currentHost = this.config.host;
        for (const host of candidates) {
            this.config.host = host;
            const result = await this.safeRequest("/composition", { method: "GET", label: `Resolume found: ${host}`, quiet: true });
            if (result.ok) {
                this.status(`Resolume found: ${host}`);
                return { ok: true, host };
            }
        }
        this.config.host = currentHost;
        this.status("Resolume not found");
        return { ok: false, reason: "not found" };
    }

    triggerTrackClip(kind, slot) {
        if (!this.readyForMatrix()) return;
        const layer = RESOLUME_TRACK_LAYERS[kind];
        const clip = Number(slot) + 1;
        if (!layer || !Number.isInteger(clip) || clip < 1 || clip > 8) return;
        this.activeClipsByLayer.set(layer, clip);
        this.safeRequest(`/composition/layers/${layer}/clips/${clip}/connect`, {
            method: "POST",
            label: `Resolume ${kind} clip ${clip}`
        });
    }

    triggerColumn(slot) {
        if (!this.readyForMatrix()) return;
        const column = Number(slot) + 1;
        if (!Number.isInteger(column) || column < 1 || column > 8) return;
        Object.values(RESOLUME_TRACK_LAYERS).forEach((layer) => {
            this.activeClipsByLayer.set(layer, column);
        });
        this.safeRequest(`/composition/columns/${column}/connect`, {
            method: "POST",
            label: `Resolume column ${column}`
        });
    }

    selectDeck(slot) {
        if (!this.readyForMatrix() || !this.config.deckTrigger) return;
        const deck = Number(slot) + 1;
        if (!Number.isInteger(deck) || deck < 1 || deck > 8) return;
        this.safeRequest(`/composition/decks/${deck}/select`, {
            method: "POST",
            label: `Resolume deck ${deck}`,
            quiet: true
        });
    }

    pulse(linkKey) {
        if (!this.config.enabled || !this.config.dashboardPulse) return;
        const mapping = RESOLUME_DASHBOARD_LINKS[linkKey];
        if (!mapping) return;
        const addresses = dashboardPulseAddresses(mapping, this.config.oscTargets);
        if (!addresses.length) return;
        const key = `${mapping.layer}:${mapping.link}`;
        const now = performance.now();
        const debounceMs = Number(this.config.pulseDebounceMs) || 0;
        const lastPulseAt = this.lastPulseAt.get(mapping.link) || 0;
        if (debounceMs > 0 && now - lastPulseAt < debounceMs) {
            this.clearPulseTimers(key);
            this.pulseTimers.set(key, [
                window.setTimeout(() => {
                    addresses.forEach((address) => this.sendOscValue(address, 0));
                    this.pulseTimers.delete(key);
                }, clampNumber(Number(this.config.pulseLengthMs) || 80, 20, 1000))
            ]);
            return;
        }
        this.lastPulseAt.set(mapping.link, now);
        const amount = clampNumber(Number(this.config.pulseAmount) || 0, 0, 100) / 100;
        this.scheduleDecayPulse(key, addresses, amount);
    }

    scheduleDecayPulse(key, addresses, amount) {
        this.clearPulseTimers(key);
        const lengthMs = clampNumber(Number(this.config.pulseLengthMs) || 120, 40, 1000);
        const points = [
            [0, amount],
            [0.3, amount * 0.66],
            [0.64, amount * 0.28],
            [1, 0]
        ];
        const timers = points.map(([position, value]) => window.setTimeout(() => {
            addresses.forEach((address) => this.sendOscValue(address, value));
            if (position === 1) this.pulseTimers.delete(key);
        }, Math.round(lengthMs * position)));
        this.pulseTimers.set(key, timers);
    }

    clearPulseTimers(key) {
        const timers = this.pulseTimers.get(key);
        if (Array.isArray(timers)) timers.forEach((timer) => window.clearTimeout(timer));
        else window.clearTimeout(timers);
        this.pulseTimers.delete(key);
    }

    sendOscValue(address, value) {
        fetch(this.config.oscBridgeUrl, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                host: this.config.oscHost,
                port: this.config.oscPort,
                address,
                value
            })
        }).catch(() => {});
    }

    async testOscBridge() {
        try {
            const response = await fetch(this.config.oscBridgeUrl.replace(/\/osc\/?$/, "/status"), {
                method: "GET",
                mode: "cors"
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return { ok: true };
        } catch (error) {
            return { ok: false, error };
        }
    }

    putDashboardValue(_layer, path, value) {
        const linkNumber = dashboardLinkNumber(path);
        const parameterId = linkNumber ? this.dashboardParamIds[linkNumber - 1] : "";
        if (parameterId) {
            this.safeRequest(`/parameter/by-id/${encodeURIComponent(parameterId)}`, {
                method: "PUT",
                body: { value },
                quiet: true
            });
            return;
        }

        this.safeRequest(`/composition/${path}`, {
            method: "PUT",
            body: { value },
            quiet: true
        }).then((result) => {
            if (result.ok) return;
            this.resolveCompositionDashboardIds().then(() => {
                const resolvedId = linkNumber ? this.dashboardParamIds[linkNumber - 1] : "";
                if (!resolvedId) return;
                this.safeRequest(`/parameter/by-id/${encodeURIComponent(resolvedId)}`, {
                    method: "PUT",
                    body: { value },
                    quiet: true
                });
            });
        });
    }

    async resolveCompositionDashboardIds() {
        if (this.dashboardResolvePromise) return this.dashboardResolvePromise;
        this.dashboardResolvePromise = this.safeRequest("/composition", {
            method: "GET",
            quiet: true
        }).then(async (result) => {
            if (!result.ok) return result;
            try {
                const composition = await result.response.json();
                this.dashboardParamIds = findCompositionDashboardParamIds(composition);
                return { ok: true, ids: this.dashboardParamIds };
            } catch (error) {
                return { ok: false, error };
            } finally {
                this.dashboardResolvePromise = null;
            }
        });
        return this.dashboardResolvePromise;
    }

    readyForMatrix() {
        return this.config.enabled && this.config.matrixTrigger;
    }

    async safeRequest(path, options = {}) {
        try {
            const response = await this.request(path, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            if (!options.quiet) this.status(options.label || "Resolume OK");
            return { ok: true, response };
        } catch (error) {
            if (!options.quiet) this.status(`Resolume error: ${error.message}`);
            return { ok: false, error };
        }
    }

    async request(path, { method = "GET", body = null, timeoutMs = 900 } = {}) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(`${this.baseUrl()}${path}`, {
                method,
                mode: "cors",
                headers: body ? { "Content-Type": "application/json" } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
        } finally {
            window.clearTimeout(timer);
        }
    }

    status(text) {
        this.lastStatus = text;
        this.onStatus?.(text);
    }
}

function dashboardPulseAddresses(mapping, oscTargets = {}) {
    const link = mapping.link;
    const layer = mapping.layer;
    const targets = [];
    clipTargetsForLayer(oscTargets, layer).forEach((clip) => {
        targets.push(`/composition/layers/${layer}/clips/${clip}/dashboard/link${link}`);
    });
    return targets;
}

function normalizeOscTargets(savedTargets = {}, defaults = {}) {
    return {
        clipTargets: normalizeClipTargets(savedTargets.clipTargets, defaults.clipTargets)
    };
}

function createClipTargetDefaults() {
    return {
        layer1: Array(8).fill(false),
        layer2: Array(8).fill(false),
        layer3: Array(8).fill(false),
        layer4: Array(8).fill(false)
    };
}

function normalizeClipTargets(savedTargets = {}, defaults = createClipTargetDefaults()) {
    return [1, 2, 3, 4].reduce((targets, layer) => {
        const key = `layer${layer}`;
        targets[key] = Array.from({ length: 8 }, (_, index) => (
            typeof savedTargets?.[key]?.[index] === "boolean" ? savedTargets[key][index] : defaults[key][index]
        ));
        return targets;
    }, {});
}

function clipTargetsForLayer(oscTargets, layer) {
    const layerKey = `layer${layer}`;
    const clips = oscTargets.clipTargets?.[layerKey] || [];
    return clips
        .map((enabled, index) => (enabled ? index + 1 : null))
        .filter((clip) => clip !== null);
}

function sanitizeParameterPath(path) {
    return typeof path === "string" ? path.trim().replace(/^\/+|\/+$/g, "") : "";
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function dashboardLinkNumber(path) {
    const match = /(?:link|dial|dashboard)[^\d]*(\d+)/i.exec(String(path || ""));
    const value = Number(match?.[1]);
    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : null;
}

function findCompositionDashboardParamIds(composition) {
    const ids = Array(8).fill("");
    const dashboard = composition?.dashboard || composition?.video?.dashboard || composition?.params?.dashboard;
    collectDashboardIds(dashboard, ids, ["dashboard"]);
    if (ids.some(Boolean)) return ids;
    collectDashboardIds(composition, ids, []);
    return ids;
}

function collectDashboardIds(node, ids, path) {
    if (!node || typeof node !== "object") return;
    const pathText = path.join("/").toLowerCase();
    const keyText = String(path[path.length - 1] || "").toLowerCase();
    const link = dashboardLinkNumber(keyText) || dashboardLinkNumber(pathText);
    if (link && isParameterObject(node)) {
        ids[link - 1] ||= String(node.id || node.parameter?.id || "");
    }
    if (Array.isArray(node)) {
        node.forEach((child, index) => collectDashboardIds(child, ids, [...path, String(index + 1)]));
        return;
    }
    Object.entries(node).forEach(([key, child]) => collectDashboardIds(child, ids, [...path, key]));
}

function isParameterObject(node) {
    if (!node || typeof node !== "object") return false;
    if (node.id && ("value" in node || "type" in node || "param" in node)) return true;
    return Boolean(node.parameter?.id);
}
