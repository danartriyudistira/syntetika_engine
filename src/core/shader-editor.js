import { ShaderEngine } from "./shader-engine.js";

let idCounter = 0;
function nextCustomId() { return "custom_" + (++idCounter); }

const NEW_SHADER_TEMPLATE = `/*{
  "CATEGORIES": ["Custom"],
  "INPUTS": []
}*/
void main() {
    vec2 uv = isf_FragNormCoord;
    vec3 color = vec3(uv.x, uv.y, 0.5);
    gl_FragColor = vec4(color, 1.0);
}`;

const PLASMA_NAME = "Plasma";
const PLASMA_SOURCE = `/*{
  "CATEGORIES": ["Plasma"],
  "INPUTS": [
    {"NAME": "level", "TYPE": "float", "MIN": 0, "MAX": 1, "DEFAULT": 0.5},
    {"NAME": "speed", "TYPE": "float", "MIN": 0, "MAX": 4, "DEFAULT": 1}
  ]
}*/
vec3 sim(vec3 p,float s);
vec2 rot(vec2 p,float r);
vec2 rotsim(vec2 p,float s);
vec2 zoom(vec2 p,float f);

float makePoint(float x,float y,float fx,float fy,float sx,float sy,float t){
   float xx=x+tan(t*fx)*sy;
   float yy=y-tan(t*fy)*sy;
   float a=0.5/sqrt(abs(abs(x*xx)+abs(yy*y)));
   float b=0.5/sqrt(abs(x*xx+yy*y));
   return a*b;
}

const float PI=3.14159265;

vec3 sim(vec3 p,float s){
   vec3 ret=p;
   ret=p+s/2.0;
   ret=fract(ret/s)*s-s/4.0;
   return ret;
}

vec2 rot(vec2 p,float r){
   vec2 ret;
   ret.x=p.x*sin(r)*cos(r)-p.y*cos(r);
   ret.y=p.x*cos(r)+p.y*sin(r);
   return ret;
}

vec2 rotsim(vec2 p,float s){
   vec2 ret=p;
   ret=rot(p,-PI/(s*2.0));
   ret=rot(p,floor(atan(ret.x,ret.y)/PI*s)*(PI/s));
   return ret;
}

vec2 zoom(vec2 p,float f){
    return vec2(p.x*f,p.y*f);
}

void main( void ) {
   vec2 p = gl_FragCoord.xy/RENDERSIZE.y-vec2((RENDERSIZE.x/RENDERSIZE.y)/2.0,0.5);
   p=rot(p,sin(TIME+length(p))*4.0);
   p=zoom(p,sin(TIME*2.0)*0.5+0.8);
   p=p*2.0;
   float x=p.x;
   float y=p.y;
   float t=TIME*speed;
   float a,b,c;
   a=makePoint(x,y,3.3,2.9,0.3,0.3,t);
   a=a+makePoint(x,y,1.9,2.0,0.4,0.4,t);
   a=a+makePoint(x,y,0.8,0.7,0.4,0.5,t);
   a=a+makePoint(x,y,2.3,0.1,0.6,0.3,t);
   a=a+makePoint(x,y,0.8,1.7,0.5,0.4,t);
   a=a+makePoint(x,y,0.3,1.0,0.4,0.4,t);
   a=a+makePoint(x,y,1.4,1.7,0.4,0.5,t);
   a=a+makePoint(x,y,1.3,2.1,0.6,0.3,t);
   a=a+makePoint(x,y,1.8,1.7,0.5,0.4,t);
   b=makePoint(x,y,1.2,1.9,0.3,0.3,t);
   b=b+makePoint(x,y,0.7,2.7,0.4,0.4,t);
   b=b+makePoint(x,y,1.4,0.6,0.4,0.5,t);
   b=b+makePoint(x,y,2.6,0.4,0.6,0.3,t);
   b=b+makePoint(x,y,0.7,1.4,0.5,0.4,t);
   b=b+makePoint(x,y,0.7,1.7,0.4,0.4,t);
   b=b+makePoint(x,y,0.8,0.5,0.4,0.5,t);
   b=b+makePoint(x,y,1.4,0.9,0.6,0.3,t);
   b=b+makePoint(x,y,0.7,1.3,0.5,0.4,t);
   c=makePoint(x,y,3.7,0.3,0.3,0.3,t);
   c=c+makePoint(x,y,1.9,1.3,0.4,0.4,t);
   c=c+makePoint(x,y,0.8,0.9,0.4,0.5,t);
   c=c+makePoint(x,y,1.2,1.7,0.6,0.3,t);
   c=c+makePoint(x,y,0.3,0.6,0.5,0.4,t);
   c=c+makePoint(x,y,0.3,0.3,0.4,0.4,t);
   c=c+makePoint(x,y,1.4,0.8,0.4,0.5,t);
   c=c+makePoint(x,y,0.2,0.6,0.6,0.3,t);
   c=c+makePoint(x,y,1.3,0.5,0.5,0.4,t);
   vec3 d=vec3(a,b,c)*level/10.0;
   gl_FragColor = vec4(d.x,d.y,d.z,1.0);
}`;

const FRACTAL_NAME = "Fractal";
const FRACTAL_SOURCE = `/*{
  "CATEGORIES": ["Fractal"],
  "INPUTS": [
    {"NAME": "rate", "TYPE": "float", "MIN": 0, "MAX": 4, "DEFAULT": 1},
    {"NAME": "zoom", "TYPE": "float", "MIN": 0.1, "MAX": 3, "DEFAULT": 1},
    {"NAME": "morph", "TYPE": "float", "MIN": -2, "MAX": 2, "DEFAULT": 0},
    {"NAME": "rot", "TYPE": "float", "MIN": 0, "MAX": 6.28, "DEFAULT": 0},
    {"NAME": "multiplier", "TYPE": "float", "MIN": 0, "MAX": 10, "DEFAULT": 1},
    {"NAME": "flash", "TYPE": "float", "MIN": 0, "MAX": 1, "DEFAULT": 0},
    {"NAME": "depth", "TYPE": "float", "MIN": 1, "MAX": 30, "DEFAULT": 10},
    {"NAME": "detail", "TYPE": "float", "MIN": 0, "MAX": 20, "DEFAULT": 5},
    {"NAME": "brightness", "TYPE": "float", "MIN": 0.1, "MAX": 1, "DEFAULT": 0.5},
    {"NAME": "red", "TYPE": "float", "MIN": 0, "MAX": 1, "DEFAULT": 1},
    {"NAME": "green", "TYPE": "float", "MIN": 0, "MAX": 1, "DEFAULT": 1},
    {"NAME": "blue", "TYPE": "float", "MIN": 0, "MAX": 1, "DEFAULT": 1}
  ]
}*/
mat2 rmat(float t) {
    float c = cos(t), s = sin(t);   
    return mat2(c,s,-s,s-c);
}

float field(in vec3 p) {
    float strength = 9.0 + flash * log(1.e-6 + fract(sin(TIME) * 4373.11));
    float accum = 0.0, prev = 0.0, tw = 0.0, b = -5.0;
    for (int i = 0; i < 26; ++i) {
        float mag = dot(p, p);
        p = abs(p) / mag + vec3(-0.5, -0.4, -1.5);
        float w = exp(-float(i) / depth);
        accum += w * exp(-strength * pow(abs(mag - prev), brightness));
        tw += w;
        prev = mag;
        b += 1.0;
        if (b - detail >= 1.0) break;
    }
    return max(0.0, 5.0 * accum / tw - 0.7);
}

void main() {
    float TT = TIME * rate;
    vec2 uv = 2.0 * gl_FragCoord.xy / RENDERSIZE.xy - 1.0;
    vec2 uvs = uv * RENDERSIZE.xy / max(RENDERSIZE.x, RENDERSIZE.y);
    vec3 p = vec3(uvs / zoom, morph) + vec3(1.0, -1.3, -0.5);
    p.xz *= rmat(rot);
    float mu = floor(multiplier);
    p += 0.2 * vec3(sin(TT / 13.0 * mu), sin(TT / 89.0 * mu), sin(TT / 233.0 * mu));
    float t = field(p);
    float v = (1.0 - exp(abs(uv.x) - 1.0) * 5.0) * (1.0 - exp(abs(uv.y) - 1.0));
    vec3 col = mix(2.0, 0.1, v) * vec3(1.6 * t * t * t, 1.3 * t * t, 1.1 * t);
    col *= vec3(red, green, blue);
    gl_FragColor = vec4(col, 1.0);
}`;

const FALLBACK_SHADERS = [
    { id: "plasma", name: PLASMA_NAME, source: PLASMA_SOURCE },
    { id: "fractal", name: FRACTAL_NAME, source: FRACTAL_SOURCE },
];

export class ShaderEditor {
    constructor(options = {}) {
        this.onSwitch = options.onSwitch || (() => { });
        this.onShadersChange = options.onShadersChange || (() => { });
        this.aiEngine = options.aiEngine || null;
        this.previewEngine = null;
        this.shaders = [];
        this.activeId = null;
        this.editorOpen = false;
        this.editingId = null;
        this._fallbackSource = NEW_SHADER_TEMPLATE;
        this._shadersDirHandle = null;
        this._galleryDropdownHandler = null;
    }

    async init() {
        this.loadFromStorage();
        if (this._hasOldStyleIds()) {
            this.shaders = [];
            this.activeId = null;
        }
        if (this.shaders.length > 0) {
            if (!this.activeId || !this.shaders.some(s => s.id === this.activeId)) {
                this.activeId = this.shaders[0].id;
            }
            this.onSwitch(this.activeId);
            return;
        }
        try {
            await this.loadFromManifest();
        } catch {}
        if (this.shaders.length === 0) {
            this.shaders = [...FALLBACK_SHADERS];
            this.activeId = this.shaders[0].id;
            this.saveToStorage();
        }
        this.onSwitch(this.activeId);
    }

    _hasOldStyleIds() {
        return this.shaders.some((s) => /^shader_\d+$/.test(s.id));
    }

    async loadFromManifest() {
        const res = await fetch("shaders/manifest.json");
        if (!res.ok) throw new Error("Manifest not found");
        const list = await res.json();
        const loaded = [];
        for (const entry of list) {
            try {
                const srcRes = await fetch("shaders/" + entry.file);
                if (!srcRes.ok) continue;
                const source = await srcRes.text();
                loaded.push({ id: entry.id, name: entry.name, source, categories: entry.categories || [] });
            } catch {}
        }
        if (loaded.length > 0) {
            this.shaders = loaded;
            this.activeId = loaded[0].id;
            this.saveToStorage();
        }
    }

    getActiveShader() {
        return this.shaders.find(s => s.id === this.activeId) || null;
    }

    getShaderById(id) {
        return this.shaders.find(s => s.id === id) || null;
    }

    setActive(id) {
        if (id === this.activeId) return;
        if (!this.shaders.some(s => s.id === id)) return;
        this.activeId = id;
        this.saveToStorage();
        this.onSwitch(id);
    }

    addShader(name, source) {
        const id = nextCustomId();
        this.shaders.push({ id, name, source });
        this.saveToStorage();
        return id;
    }

    removeShader(id) {
        if (this.shaders.length <= 1) return false;
        const idx = this.shaders.findIndex(s => s.id === id);
        if (idx === -1) return false;
        this.shaders.splice(idx, 1);
        if (this.activeId === id) {
            this.activeId = this.shaders[0].id;
            this.onSwitch(this.activeId);
        }
        this.saveToStorage();
        return true;
    }

    updateShader(id, updates) {
        const shader = this.shaders.find(s => s.id === id);
        if (!shader) return;
        if (updates.name !== undefined) shader.name = updates.name;
        if (updates.source !== undefined) shader.source = updates.source;
        this.saveToStorage();
    }

    sync() {
        this.onShadersChange();
    }

    saveToStorage() {
        try {
            localStorage.setItem("syntetika_shaders", JSON.stringify({
                shaders: this.shaders.map(s => ({ id: s.id, name: s.name, source: s.source })),
                activeId: this.activeId,
            }));
        } catch { }
    }

    async _saveToShadersDir(filename, source) {
        if (!window.showDirectoryPicker) return false;
        try {
            if (!this._shadersDirHandle) {
                this._shadersDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            }
            const opts = { mode: 'readwrite' };
            if ((await this._shadersDirHandle.queryPermission(opts)) !== 'granted') {
                if ((await this._shadersDirHandle.requestPermission(opts)) !== 'granted') {
                    this._shadersDirHandle = null;
                    return false;
                }
            }
            const fileHandle = await this._shadersDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(source);
            await writable.close();

            const name = filename.replace(/\.isf$/i, '');
            const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            try {
                const mh = await this._shadersDirHandle.getFileHandle('manifest.json');
                const mf = await mh.getFile();
                const manifest = JSON.parse(await mf.text());
                if (!manifest.some(e => e.file === filename)) {
                    manifest.push({ id, name, file: filename, categories: ["Custom"] });
                    const mw = await mh.createWritable();
                    await mw.write(JSON.stringify(manifest, null, 2));
                    await mw.close();
                }
            } catch (e) {
                console.warn("manifest.json update skipped:", e);
            }
            return true;
        } catch (err) {
            console.warn("Copy to shaders dir failed:", err);
            this._shadersDirHandle = null;
            return false;
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem("syntetika_shaders");
            if (!raw) return;
            const data = JSON.parse(raw);
            if (Array.isArray(data.shaders) && data.shaders.length > 0) {
                this.shaders = data.shaders;
                this.activeId = data.activeId || this.shaders[0].id;
                for (const s of this.shaders) {
                    const m = s.id?.match(/^custom_(\d+)$/);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (n > idCounter) idCounter = n;
                    }
                }
            }
        } catch { }
    }

    openEditor(shaderId, mountEl) {
        this.closeEditor();
        this.editingId = shaderId;
        this.editorOpen = true;
        this.renderEditor(mountEl);
    }

    closeEditor() {
        this.editorOpen = false;
        this.editingId = null;
        if (this._editorDebounceTimer) {
            clearTimeout(this._editorDebounceTimer);
            this._editorDebounceTimer = null;
        }
        if (this.previewEngine) {
            this.previewEngine.destroy();
            this.previewEngine = null;
        }
    }

    renderEditor(mountEl) {
        if (!mountEl) return;
        const shader = this.getShaderById(this.editingId) || this.getActiveShader();
        if (!shader) return;

        mountEl.innerHTML = `
            <div class="shader-editor-layout">
                <div class="shader-editor-left">
                    <div class="shader-editor-header">
                        <input class="shader-name-input" type="text" value="${shader.name}" placeholder="Shader name">
                        <button class="shader-editor-apply" type="button">Save</button>
                        <button class="shader-editor-duplicate" type="button">Duplicate</button>
                        <button class="shader-editor-close" type="button">Close</button>
                    </div>
                    <textarea class="shader-editor-textarea" spellcheck="false">${shader.source}</textarea>
                </div>
                <div class="shader-editor-right">
                    <canvas class="shader-preview-canvas"></canvas>
                    <div class="shader-preview-error"></div>
                    <div class="shader-editor-chat">
                        <div class="shader-chat-header">
                            <span>AI Shader Assistant</span>
                        </div>
                        <div class="shader-chat-messages"></div>
                        <div class="shader-chat-input-row">
                            <textarea class="shader-chat-input" rows="1" placeholder="Ask about this shader..."></textarea>
                            <button class="shader-chat-send" type="button">Ask</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const nameInput = mountEl.querySelector(".shader-name-input");
        const applyBtn = mountEl.querySelector(".shader-editor-apply");
        const dupBtn = mountEl.querySelector(".shader-editor-duplicate");
        const closeBtn = mountEl.querySelector(".shader-editor-close");
        const textarea = mountEl.querySelector(".shader-editor-textarea");
        const previewCanvas = mountEl.querySelector(".shader-preview-canvas");
        const errorEl = mountEl.querySelector(".shader-preview-error");

        this.previewEngine = new ShaderEngine();
        this.previewEngine.init(previewCanvas);

        const compileAndPreview = () => {
            const fullSource = textarea.value;
            const ok = this.previewEngine.compileShader(fullSource);
            if (ok) {
                errorEl.textContent = "";
                errorEl.classList.remove("visible");
                this.previewEngine.startLoop();
            } else {
                this.previewEngine.stopLoop();
                const msg = this.previewEngine.compileError || "Compile failed";
                errorEl.textContent = msg;
                errorEl.classList.add("visible");
                const ctx = previewCanvas.getContext("2d");
                if (ctx) {
                    ctx.fillStyle = "#000";
                    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    ctx.fillStyle = "#ff6b6b";
                    ctx.font = "11px monospace";
                    const lines = msg.split("\n");
                    lines.forEach((l, i) => {
                        ctx.fillText(l, 8, 16 + i * 14);
                    });
                }
            }
        };

        const schedulePreview = () => {
            if (this._editorDebounceTimer) clearTimeout(this._editorDebounceTimer);
            this._editorDebounceTimer = setTimeout(compileAndPreview, 300);
        };

        textarea.addEventListener("input", schedulePreview);
        nameInput.addEventListener("input", schedulePreview);

        const apply = () => {
            const fullSource = textarea.value;
            const name = nameInput.value || "Untitled";
            this.updateShader(this.editingId, { name, source: fullSource });
            if (this.editingId === this.activeId) {
                this.onSwitch(this.editingId);
            }
        };

        applyBtn.addEventListener("click", () => {
            apply();
            this.sync();
            schedulePreview();
        });

        closeBtn.addEventListener("click", () => {
            apply();
            this.closeEditor();
            this.sync();
            document.dispatchEvent(new CustomEvent("shader-editor-close"));
        });

        dupBtn.addEventListener("click", () => {
            const fullSource = textarea.value;
            const currentName = nameInput.value || "Untitled";
            const newName = "Copy of " + currentName;
            const newId = this.addShader(newName, fullSource);
            this.closeEditor();
            this.sync();
            document.dispatchEvent(new CustomEvent("shader-editor-close"));
            document.dispatchEvent(new CustomEvent("shader-editor-open", { detail: { shaderId: newId } }));
        });

        this._initShaderChat(mountEl, textarea);
        compileAndPreview();
    }

    _initShaderChat(mountEl, sourceTextarea) {
        const messages = mountEl.querySelector(".shader-chat-messages");
        const input = mountEl.querySelector(".shader-chat-input");
        const sendBtn = mountEl.querySelector(".shader-chat-send");
        if (!messages || !input || !sendBtn) return;

        const addMessage = (text, isUser = false) => {
            const msg = document.createElement("div");
            msg.className = `shader-chat-msg ${isUser ? "user" : "assistant"}`;
            const pre = document.createElement("pre");
            pre.textContent = text;
            msg.appendChild(pre);
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
        };

        const sendMessage = () => {
            const text = input.value.trim();
            if (!text) return;
            addMessage(text, true);
            input.value = "";
            input.style.height = "auto";

            const shaderSource = sourceTextarea.value;
            if (this.aiEngine && typeof this.aiEngine.processShader === "function") {
                const result = this.aiEngine.processShader(text, shaderSource);
                addMessage(result.response || "No response.");
                if (result.modifiedSource) {
                    const applyBtn = document.createElement("button");
                    applyBtn.className = "shader-chat-apply";
                    applyBtn.textContent = "Apply Changes";
                    applyBtn.type = "button";
                    applyBtn.addEventListener("click", () => {
                        sourceTextarea.value = result.modifiedSource;
                        sourceTextarea.dispatchEvent(new Event("input"));
                        applyBtn.textContent = "Applied";
                        applyBtn.disabled = true;
                    });
                    const lastMsg = messages.lastChild;
                    if (lastMsg) lastMsg.appendChild(applyBtn);
                }
            } else {
                addMessage("Shader AI assistant not available.");
            }
        };

        sendBtn.addEventListener("click", sendMessage);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 80) + "px";
        });
        input.addEventListener("input", () => {
            input.style.height = "auto";
            input.style.height = Math.min(input.scrollHeight, 80) + "px";
        });

        addMessage("Ask me about this shader. Try: explain, add glow, add blur, edge detect, color shift, or help.");
    }

    renderGallery(mountEl) {
        if (!mountEl) return;
        mountEl.innerHTML = `
            <div class="shader-gallery-header">
                <span class="section-title">Shaders</span>
                <button class="shader-add-btn" type="button">+</button>
            </div>
            <div class="shader-gallery-list"></div>
        `;

        const list = mountEl.querySelector(".shader-gallery-list");
        const addBtn = mountEl.querySelector(".shader-add-btn");

        const renderList = () => {
            list.innerHTML = this.shaders.map(s => {
                const active = s.id === this.activeId ? " active" : "";
                return `
                    <div class="shader-item${active}" data-shader-id="${s.id}">
                        <span class="shader-item-name">${s.name}</span>
                        <button class="shader-item-edit" data-shader-edit="${s.id}" type="button">Edit</button>
                        <button class="shader-item-delete" data-shader-delete="${s.id}" type="button">X</button>
                    </div>
                `;
            }).join("");
        };
        renderList();

        const refreshAddBtn = () => mountEl.querySelector(".shader-add-btn");

        list.addEventListener("click", (e) => {
            const item = e.target.closest(".shader-item");
            if (item && !e.target.closest("button")) {
                this.setActive(item.dataset.shaderId);
                renderList();
                this.sync();
            }
            if (e.target.closest(".shader-item-edit")) {
                const id = e.target.closest(".shader-item-edit").dataset.shaderEdit;
                document.dispatchEvent(new CustomEvent("shader-editor-open", { detail: { shaderId: id } }));
            }
            if (e.target.closest(".shader-item-delete")) {
                const id = e.target.closest(".shader-item-delete").dataset.shaderDelete;
                if (this.removeShader(id)) {
                    renderList();
                    this.sync();
                }
            }
        });

        const dropdown = document.createElement("div");
        dropdown.className = "shader-add-dropdown";
        dropdown.innerHTML = `
            <button class="shader-add-dropdown-item" data-action="new">New File</button>
            <button class="shader-add-dropdown-item" data-action="import">Import File</button>
        `;
        addBtn.parentNode.appendChild(dropdown);

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".isf,.fs,.glsl,.txt";
        fileInput.style.display = "none";
        addBtn.parentNode.appendChild(fileInput);

        const closeDropdown = () => dropdown.classList.remove("open");

        addBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("open");
        });

        dropdown.addEventListener("click", async (e) => {
            const action = e.target.closest("[data-action]")?.dataset.action;
            if (!action) return;
            closeDropdown();
            if (action === "new") {
                const id = this.addShader("New Shader", this._fallbackSource);
                renderList();
                this.sync();
            } else if (action === "import") {
                fileInput.value = "";
                fileInput.click();
            }
        });

        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const source = await file.text();
                const name = file.name.replace(/\.(isf|fs|glsl|txt)$/i, "");
                addBtn.textContent = "✓";
                const id = this.addShader(name || file.name, source);
                renderList();
                this.sync();
                const filename = name + ".isf";
                this._saveToShadersDir(filename, source).then(copied => {
                    const btn = refreshAddBtn();
                    if (btn) {
                        btn.textContent = copied ? "📁" : "+";
                        setTimeout(() => { if (btn) btn.textContent = "+"; }, copied ? 2000 : 1500);
                    }
                });
            } catch (err) {
                console.error("Import failed:", err);
                const btn = refreshAddBtn();
                if (btn) {
                    btn.textContent = "✗";
                    setTimeout(() => { if (btn) btn.textContent = "+"; }, 2000);
                }
            }
        });

        if (this._galleryDropdownHandler) {
            document.removeEventListener("click", this._galleryDropdownHandler, false);
        }
        this._galleryDropdownHandler = closeDropdown;
        document.addEventListener("click", closeDropdown, false);
    }
}
