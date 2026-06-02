const STORAGE_KEY = 'syntetika_media';
const MAX_EMBED_SIZE = 1048576;

let idCounter = 0;
function nextId() {
    return 'm_' + (++idCounter).toString(36) + '_' + Date.now().toString(36);
}

export class MediaManager {
    constructor(shaderEngine) {
        this.shaderEngine = shaderEngine;
        this.registry = new Map();
        this.textureCache = new Map();
        this._pendingLoads = new Map();

        if (shaderEngine) {
            shaderEngine.onContextRestored(() => {
                this.textureCache.clear();
            });
        }
    }

    async importMedia(file) {
        const id = nextId();
        const hash = await this._hashFile(file);

        for (const entry of this.registry.values()) {
            if (entry.hash === hash) {
                return entry.id;
            }
        }

        const mime = file.type || 'image/png';
        const type = mime.startsWith('video/') ? 'video' : 'image';
        let data = null;
        let storage = 'external';

        if (file.size <= MAX_EMBED_SIZE) {
            data = await this._readAsDataURL(file);
            storage = 'embedded';
        }

        const entry = {
            id,
            originalName: file.name,
            type,
            mime,
            size: file.size,
            storage,
            data,
            hash,
        };

        this.registry.set(id, entry);

        if (data) {
            const loadPromise = this._loadTexture(id, data).catch(e => {
                console.warn('MediaManager: texture preload failed for', file.name, e);
                return null;
            });
            this._pendingLoads.set(id, loadPromise);
            try {
                await loadPromise;
            } finally {
                if (this._pendingLoads.get(id) === loadPromise) {
                    this._pendingLoads.delete(id);
                }
            }
        }

        this._save();
        return id;
    }

    getTexture(id) {
        if (this.textureCache.has(id)) {
            return this.textureCache.get(id);
        }
        const entry = this.registry.get(id);
        if (!entry || !entry.data) return null;

        const pending = this._pendingLoads.get(id);
        if (pending) return null;

        const promise = this._loadTexture(id, entry.data).catch(() => null);
        this._pendingLoads.set(id, promise);
        return null;
    }

    removeMedia(id) {
        const tex = this.textureCache.get(id);
        if (tex) {
            this.shaderEngine?.deleteTexture(tex);
            this.textureCache.delete(id);
        }
        this.registry.delete(id);
        this._save();
    }

    toJSON() {
        return Array.from(this.registry.values());
    }

    fromJSON(arr) {
        if (!Array.isArray(arr)) return;
        this.registry.clear();
        this.textureCache.clear();
        for (const item of arr) {
            this.registry.set(item.id, item);
        }
    }

    validateAll() {
        const valid = [];
        const missing = [];
        for (const entry of this.registry.values()) {
            if (entry.data) {
                valid.push(entry.id);
            } else {
                missing.push({ id: entry.id, name: entry.originalName });
            }
        }
        return { valid, missing };
    }

    async _loadTexture(id, dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const tex = this.shaderEngine?.createTextureFromImage(img);
                if (tex) {
                    this.textureCache.set(id, tex);
                }
                this._pendingLoads.delete(id);
                resolve(tex);
            };
            img.onerror = (err) => {
                this._pendingLoads.delete(id);
                reject(err);
            };
            img.src = dataUrl;
        });
    }

    _readAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async _hashFile(file) {
        try {
            const buffer = await file.arrayBuffer();
            const hash = await crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
            return '';
        }
    }

    _save() {
        try {
            const raw = JSON.stringify(this.toJSON());
            localStorage.setItem(STORAGE_KEY, raw);
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                const stripped = Array.from(this.registry.values()).map(e => ({
                    ...e,
                    data: undefined
                }));
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
                } catch {}
            }
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.fromJSON(data);
        } catch {}
    }
}
