import { parseIntent, intentToActions } from "./ai-intent.js";
import { describeSnapshot, describePatternSummary, describeScene, describeGenre } from "./ai-context.js";
import { GENRE_PROFILES, DRUM_RANDOM_GENRES, SCALE_DEFINITIONS, SCENE_DEFINITIONS, SCENE_TYPES } from "./constants.js";
import { SceneManager } from "./ai-scene.js";
import { analyzeCreativeInput, generateCompositionPlan, generateMusicalFeedback, formatCompositionPlanAsText, suggestFollowUp, generateWelcomeMessage, SHADER_SYSTEM_PROMPT, getShaderSuggestion, explainShaderStructure } from "./ai-personality.js";
import { AIEngineOllama } from "./ai-ollama.js";

export class AIEngine {
    constructor(bridge) {
        this.bridge = bridge;
        this.sceneManager = bridge ? new SceneManager({ bridge }) : null;
        this.history = [];
        this.maxHistory = 50;
        this.ollama = new AIEngineOllama();
        this._responseCallbacks = [];
        this.context = {
            lastMood: null,
            lastGenre: null,
            lastIntent: null,
            lastKey: null,
            lastBpm: null,
            sessionStarted: Date.now(),
            interactionCount: 0,
        };
    }

    connectOllama(model) {
        return this.ollama.connect(model);
    }

    disconnectOllama() {
        this.ollama.disconnect();
    }

    isOllamaConnected() {
        return this.ollama.isConnected();
    }

    onResponse(callback) {
        this._responseCallbacks.push(callback);
        return this;
    }

    async process(input) {
        this.context.interactionCount++;
        const entry = { input, timestamp: Date.now(), actions: [], response: "" };

        try {
            if (this.ollama.isConnected()) {
                return await this._handleOllamaChat(input, entry);
            }

            const creativeAnalysis = analyzeCreativeInput(input);

            if (creativeAnalysis.isCreative && !this._isDirectCommand(input)) {
                return this._handleCreativeInput(creativeAnalysis, input, entry);
            }

            const intent = parseIntent(input);
            if (!intent || intent.type === "unknown") {
                const creativePlan = this._tryCreativeFallback(input);
                if (creativePlan) {
                    entry.response = creativePlan;
                    entry.intent = { type: "creative-direction" };
                } else {
                    entry.response = this._personalityResponse(input);
                }
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            entry.intent = intent;
            this.context.lastIntent = intent;

            if (intent.mode) this.context.lastMode = intent.mode;
            if (intent.genre) this.context.lastGenre = intent.genre;
            if (intent.bpm) this.context.lastBpm = intent.bpm;
            if (intent.scaleId || intent.root) {
                this.context.lastKey = { scaleId: intent.scaleId, root: intent.root };
            }

            if (intent.type === "query") {
                const snapshot = this.bridge.getSnapshot();
                entry.response = this._enhancedQueryResponse(snapshot);
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            if (intent.type === "undo") {
                const ok = this.bridge.undo();
                entry.response = ok ? "↩ Undone last action." : "Nothing to undo.";
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            if (intent.type === "redo") {
                const ok = this.bridge.redo();
                entry.response = ok ? "↪ Redone." : "Nothing to redo.";
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            const actions = intentToActions(intent);
            if (!actions || !actions.length) {
                entry.response = this._personalityResponse(input);
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            entry.actions = actions;

            if (intent.type === "transport") {
                this.bridge.execute(actions[0]);
                const snapshot = this.bridge.getSnapshot();
                const bpm = snapshot?.transport?.bpm || 128;
                const playing = intent.action === "play";
                const responseParts = [playing ? "▶ Playing." : "⏹ Stopped."];
                if (playing && bpm) {
                    responseParts.push(`At ${bpm} BPM. Groove is locked.`);
                    if (this.context.lastGenre) responseParts.push(`Genre: ${this.context.lastGenre}`);
                }
                entry.response = responseParts.join(" ");
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            if (intent.type === "bpm-delta") {
                const snapshot = this.bridge.getSnapshot();
                const newBpm = Math.max(60, Math.min(220, snapshot.transport.bpm + (intent.delta || 0)));
                this.bridge.execute({ type: "set-bpm", bpm: newBpm });
                this.context.lastBpm = newBpm;
                const feel = newBpm >= 140 ? "driving" : newBpm >= 130 ? "energetic" : newBpm >= 120 ? "balanced" : "deep";
                entry.response = `⏱ BPM set to ${newBpm} — ${feel} tempo.`;
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            if (intent.type === "mixer-delta") {
                const snapshot = this.bridge.getSnapshot();
                const current = snapshot.mixer?.[intent.mode] || 80;
                const newLevel = Math.max(0, Math.min(100, current + (intent.delta || 0)));
                this.bridge.execute({ type: "set-mixer", mode: intent.mode, level: newLevel });
                const direction = intent.delta > 0 ? "boosted" : "reduced";
                const levelDesc = newLevel > 75 ? "loud" : newLevel > 50 ? "moderate" : newLevel > 25 ? "quiet" : "minimal";
                entry.response = `🎚 ${intent.mode} ${direction} to ${newLevel}% — ${levelDesc} in the mix.`;
                this._addHistory(entry);
                this._emitResponse(entry.response, entry);
                return entry;
            }

            if (intent.type === "compose") {
                return this._handleCompose(intent, entry);
            }

            const result = this.bridge.executeBatch(actions);

            const musicalFeedback = generateMusicalFeedback(intent, result, this.bridge.getSnapshot());
            if (musicalFeedback) {
                entry.response = musicalFeedback;
            } else {
                entry.response = this._generateResponse(intent, actions, result);
            }

            const snapshot = this.bridge.getSnapshot();
            if (snapshot && this.context.interactionCount % 3 === 0) {
                const suggestions = suggestFollowUp({ snapshot });
                if (suggestions.length > 0) {
                    entry.response += "\n\n💡 Suggestions:\n  • " + suggestions.slice(0, 2).join("\n  • ");
                }
            }

            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
        } catch (err) {
            entry.response = `Error: ${err.message}`;
            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
        }

        return entry;
    }

    processShader(input, shaderSource) {
        const entry = { input, timestamp: Date.now(), response: "", modifiedSource: null, shader: true };

        try {
            const lower = input.toLowerCase().trim();
            let response = "";
            let modifiedSource = null;

            const structure = explainShaderStructure(shaderSource);

            if (lower.includes("help") || lower === "?" || lower === "commands") {
                response = [
                    `═ SHADER AI ASSISTANT ║`,
                    ``,
                    `Available commands:`,
                    `  explain       — Describe what this shader does`,
                    `  add glow      — Add a glow/bloom effect`,
                    `  add blur      — Add gaussian blur`,
                    `  edge detect   — Add edge detection / outline`,
                    `  color shift   — Tips for color manipulation`,
                    `  distort       — Add distortion/wave/ripple`,
                    `  help          — Show this message`,
                    ``,
                    `Or ask any GLSL-related question.`,
                ].join("\n");
            } else if (lower.includes("explain") || lower === "e") {
                const parts = [
                    `Shader: ${structure.lineCount} lines`,
                    `Structure: ${structure.hasMain ? "✓ has main()" : "✗ missing main()"} ${structure.hasGlFragColor ? "✓ has gl_FragColor" : "✗ missing gl_FragColor"}`,
                    `Categories: ${structure.categories.join(", ") || "none"}`,
                    `Uniforms: ${structure.uniforms.join(", ") || "none"}`,
                    `Image inputs: ${structure.imageInputs ? "yes" : "no"}`,
                    `Status: ${structure.isValid ? "valid" : "incomplete"}`,
                ].join("\n");
                response = [
                    `═ SHADER ANALYSIS ║`,
                    ``,
                    parts,
                    ``,
                    `Tip: Ask "add glow" or "color shift" for modification ideas.`,
                ].join("\n");
            } else {
                const suggestion = getShaderSuggestion(input);
                if (suggestion) {
                    response = [
                        `═ SHADER SUGGESTION ║`,
                        ``,
                        suggestion,
                    ].join("\n");
                } else {
                    response = [
                        `═ SHADER AI ║`,
                        ``,
                        `I can help you modify and understand GLSL shaders.`,
                        ``,
                        `Try: "explain", "add glow", "add blur", "edge detect", "color shift", "distort", or "help".`,
                        ``,
                        `Future: AI-powered shader generation will be available here.`,
                    ].join("\n");
                }
            }

            entry.response = response;
            entry.modifiedSource = modifiedSource;
        } catch (err) {
            entry.response = `Error: ${err.message}`;
        }

        return entry;
    }

    _handleCreativeInput(analysis, input, entry) {
        const plan = generateCompositionPlan(analysis);
        entry.intent = { type: "creative-direction", analysis };
        entry.creativePlan = plan;

        const lines = [
            `═══ SYNTHeTIKA COMPOSITION PLAN ═══`,
            ``,
            `1. CONCEPT`,
            `   Title: ${plan.concept.title}`,
            `   Theme: ${plan.concept.emotion}`,
            `   Narrative: ${plan.concept.narrative}`,
            `   Mood: ${plan.concept.mood}`,
            ``,
            `2. TECHNICAL DIRECTION`,
            `   BPM: ${plan.technical.bpm}`,
            `   Key: ${plan.technical.key}`,
            `   Scale: ${plan.technical.scale}`,
            `   Groove: ${plan.technical.groove}`,
            `   Swing: ${plan.technical.swing}`,
            ``,
            `3. TRACK STRUCTURE (Total: ${plan.totalDuration})`,
            plan.structure,
            ``,
            `4. HARMONY`,
            `   Progression: ${plan.chordProgression.join(" → ")}`,
            `   Scale Root: ${plan.scale.root}`,
            ``,
        ];

        if (analysis.genre) {
            lines.push(`5. EXECUTION`);
            lines.push(`   Generating ${analysis.genre} patterns based on this direction...`);
            lines.push(``);
        }

        lines.push(`6. CREATIVE EVALUATION`);
        lines.push(`   Originality: 8/10 — Strong identity for ${plan.concept.emotion} ${analysis.genre || "electronic"} music`);
        lines.push(`   Emotional Impact: 8/10 — ${plan.concept.emotion} narrative drives connection`);
        lines.push(`   Festival Potential: 8/10 — Structure is DJ-friendly, ${plan.technical.bpm} BPM is club-ready`);
        lines.push(`   SYNTHeTIKA Identity: 9/10 — Aligns with futuristic, emotional aesthetic`);

        if (analysis.genre) {
            const genreId = analysis.genre;
            const profile = GENRE_PROFILES[genreId];
            if (profile) {
                this.bridge.execute({ type: "set-bpm", bpm: plan.technical.bpm ? parseInt(plan.technical.bpm, 10) : profile.defaultTempo });
                this.bridge.execute({ type: "set-scale", scaleId: plan.scale.id });
                if (plan.scale.root) this.bridge.execute({ type: "set-root", root: plan.scale.root });
            }
        }

        lines.push(``);
        lines.push(`═══ SYNTHeTIKA AI Music Producer ═══`);
        entry.response = lines.join("\n");

        this.context.lastMood = analysis.mood;
        this.context.lastGenre = analysis.genre;

        this._addHistory(entry);
        this._emitResponse(entry.response, entry);
        return entry;
    }

    _isDirectCommand(input) {
        const lower = input.toLowerCase().trim();
        const commandPatterns = [
            /^(preset|p)\s*\d+/i,
            /^(bank|b)\s*\d+/i,
            /^(play|stop|start|pause|undo|redo)\b/i,
            /^set\s+(bpm|tempo|scale|root|genre|mode)/i,
            /^(generate|randomize|fill|mutate)\b/i,
            /^(switch|change|ganti)\s+(to|ke\s+)?/i,
            /^(clear|hapus)\b/i,
            /^(bass|melody|drum|other)\s*(up|down|naik|turun)?$/i,
            /^(what|how|describe|status)\b/i,
            /^(volume|mixer|level)\b/i,
            /^(scale|root|key)\b/i,
        ];
        return commandPatterns.some((p) => p.test(lower));
    }

    _tryCreativeFallback(input) {
        const analysis = analyzeCreativeInput(input);
        if (analysis.mood) {
            const plan = generateCompositionPlan(analysis);
            return [
                `I hear you. "${input}" — that's a ${analysis.mood} direction.`,
                ``,
                `Here's what I'm imagining:`,
                ``,
                `🎵 Concept: ${plan.concept.title}`,
                `   "${plan.concept.narrative}"`,
                ``,
                `🎛 Technical: ${plan.technical.bpm} BPM, ${plan.technical.key}, ${plan.technical.scale}`,
                `   Groove: ${plan.technical.groove}`,
                ``,
                `🎹 Harmony: ${plan.chordProgression.join(" → ")}`,
                ``,
                `To bring this to life, try:`,
                `  "make a ${analysis.genre || "techno"} track"`,
                `  or describe more: "I want ${analysis.mood} with more energy"`,
            ].join("\n");
        }
        return null;
    }

    _personalityResponse(input) {
        const analysis = analyzeCreativeInput(input);
        if (analysis.mood) {
            return this._tryCreativeFallback(input);
        }

        const responses = [
            `I'm not sure how to interpret "${input}". Try describing a mood (dark, melancholic, euphoric), a genre (techno, house), or a command (preset 3, bpm 130).`,
            `As a producer, I need more direction. What emotion are we exploring? Melancholic, dark, euphoric, cinematic?`,
            `Let's create something. Tell me a mood, a BPM, or a genre. Even one word inspires me.`,
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    _handleCompose(intent, entry) {
        if (!this.sceneManager) {
            entry.response = "Scene manager not available.";
            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
            return entry;
        }

        const genreId = intent.genre && GENRE_PROFILES[intent.genre] ? intent.genre : this._detectGenreFromState();
        if (!genreId) {
            entry.response = `Unknown genre. Available: ${Object.keys(GENRE_PROFILES).join(", ")}`;
            entry.intent = intent;
            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
            return entry;
        }

        entry.genre = genreId;
        this.context.lastGenre = genreId;
        const result = this.sceneManager.compose(genreId);
        if (!result.ok) {
            entry.response = `Composition failed: ${result.error}`;
            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
            return entry;
        }

        const profile = GENRE_PROFILES[genreId];
        const response = [
            `═══ ARRANGEMENT: ${profile?.label || genreId} ═══`,
            ``,
            result.summary,
            ``,
            `Structure:`,
            ...result.scenes.map((s, i) => `  P${i + 1}: ${s}`),
            ``,
            `Tips:`,
            `  • Switch between scenes using "preset 1-${result.scenes.length}"`,
            `  • Generate variations with "mutate" or "fill"`,
            `  • Adjust energy: "bpm up" or "bpm ${(profile?.defaultTempo || 128) + 5}"`,
        ].join("\n");

        entry.response = response;
        this._addHistory(entry);
        this._emitResponse(entry.response, entry);
        return entry;
    }

    _detectGenreFromState() {
        const drumGenre = this.bridge?.state?.drumRandomGenre;
        if (drumGenre && GENRE_PROFILES[drumGenre]) return drumGenre;
        return Object.keys(GENRE_PROFILES)[0] || null;
    }

    _generateResponse(intent, actions, result) {
        const snapshot = this.bridge.getSnapshot();
        const musicalFeedback = generateMusicalFeedback(intent, result, snapshot);
        if (musicalFeedback) return musicalFeedback;

        switch (intent.type) {
            case "compose":
                return "Composition handled above.";
            case "scene":
                return this._sceneResponse(intent);
            case "generate":
            case "fill":
            case "mutate":
                return this._generateResponseText(intent, result);
            case "scale-root":
            case "scale": {
                const def = SCALE_DEFINITIONS.find((s) => s.id === intent.scaleId);
                const notes = def ? ` (${def.notes.join(" ")})` : "";
                return `🎹 Scale set to ${intent.scaleId || "current"}${intent.root ? ` root ${intent.root}` : ""}${notes}`;
            }
            case "root":
                return `🎹 Root note set to ${intent.root}.`;
            case "genre": {
                const g = DRUM_RANDOM_GENRES.find((x) => x.id === intent.genre);
                return `🥁 Drum genre: ${g?.label || intent.genre} — ${g?.description || ""}`;
            }
            case "mode": {
                const hints = { drum: "Program your kick, snare, and hats", bass: "Design the low-end groove", melody: "Create the emotional lead", other: "Add mono texture layer" };
                return `🎛 Switched to ${intent.mode} mode. ${hints[intent.mode] || ""}`;
            }
            case "sound":
                return `${intent.mode} sound set to ${intent.sound}.`;
            case "bank":
                return `Bank ${intent.bank + 1} selected${intent.mode ? ` for ${intent.mode}` : ""}.`;
            case "preset":
                return `Preset ${intent.slot + 1} selected${intent.mode ? ` for ${intent.mode}` : ""}.`;
            case "preset-all":
                return `All modes switched to preset ${intent.slot + 1}.`;
            case "mixer":
                return `🎚 ${intent.mode} volume set to ${intent.level}%.`;
            case "clear":
                return result.ok ? `Cleared ${intent.mode || "pattern"}.` : "Failed to clear.";
            case "random-role":
                return `Random role set to ${intent.role}.`;
            default:
                return result.ok ? "Done." : `Something went wrong: ${result.error || "unknown"}`;
        }
    }

    _sceneResponse(intent) {
        const desc = describeScene(intent.scene);
        return `→ ${desc}. Patterns generated.`;
    }

    _generateResponseText(intent, result) {
        if (!result.ok) return "Generation failed.";
        const mode = intent.mode || "all";
        const role = intent.role || "generate";
        const snapshot = this.bridge.getSnapshot();
        const patterns = snapshot.patterns;
        const summaries = [];
        if (mode === "all") {
            for (const k of ["drum", "bass", "melody", "other"]) {
                const info = patterns[k];
                if (info) summaries.push(describePatternSummary(k, info));
            }
        } else {
            const info = patterns[mode];
            if (info) summaries.push(describePatternSummary(mode, info));
        }
        return `${role} done. ${summaries.join(" | ")}`;
    }

    _enhancedQueryResponse(snapshot) {
        const basic = describeSnapshot(snapshot);
        const suggestions = suggestFollowUp({ snapshot });
        if (suggestions.length > 0) {
            return basic + "\n\n💡 Try:\n  • " + suggestions.slice(0, 2).join("\n  • ");
        }
        return basic;
    }

    async _handleOllamaChat(input, entry) {
        try {
            const snapshot = this.bridge?.getSnapshot();
            const result = await this.ollama.chat(input, snapshot);
            entry.response = result.response;

            const hasCompose = result.actions?.some(a => a.type === "compose");
            const hasGenerate = result.actions?.some(a => a.type === "generate" || a.type === "generate-drum");
            const hasGenre = result.actions?.some(a => a.type === "set-drum-genre" || a.type === "compose");

            if (result.actions?.length) {
                entry.actions = result.actions;
                const bridgeActions = [];
                const failedActions = [];

                const knownBridgeTypes = new Set([
                    "set-bpm", "set-mode", "generate", "switch-bank", "switch-preset",
                    "switch-all-presets", "set-loop-length", "set-track-rate", "set-scale",
                    "set-root", "set-drum-genre", "set-sound", "set-mixer", "clear-pattern",
                    "toggle-play", "toggle-internal-audio", "generate-drum",
                    "apply-pitch-style", "shift-pitch", "set-drum-voice", "set-selected-note",
                    "set-drum-pattern", "set-note-pattern", "set-style",
                ]);

                for (const action of result.actions) {
                    if (action.type === "compose") {
                        const genre = action.genre || this._detectGenreFromState();
                        if (genre && this.sceneManager) {
                            const compResult = this.sceneManager.compose(genre);
                            if (!compResult.ok) {
                                failedActions.push(`compose: ${compResult.error}`);
                            } else {
                                this.context.lastGenre = genre;
                            }
                        } else {
                            failedActions.push("compose: scene manager or genre unavailable");
                        }
                    } else if (action.type === "compose-custom") {
                        const genre = action.genre || this._detectGenreFromState();
                        if (genre && this.sceneManager && Array.isArray(action.scenes)) {
                            const compResult = this.sceneManager.composeCustom(genre, action.scenes);
                            if (!compResult.ok) {
                                failedActions.push(`compose-custom: ${compResult.error}`);
                            } else {
                                this.context.lastGenre = genre;
                            }
                        } else {
                            failedActions.push("compose-custom: scenes array required");
                        }
                    } else if (action.type === "activate-scene") {
                        const slot = (action.scene != null ? Number(action.scene) : (action.index != null ? Number(action.index) + 1 : 1)) - 1;
                        if (this.sceneManager?.activateScene(slot)) {
                            // worked via scene manager
                        } else {
                            bridgeActions.push({ type: "switch-all-presets", slot: Math.max(0, slot) });
                        }
                    } else if (knownBridgeTypes.has(action.type)) {
                        bridgeActions.push(action);
                    } else {
                        console.warn("[Ollama] Skipping unknown action type:", action.type);
                    }
                }

                if (bridgeActions.length) {
                    const execResult = this.bridge.executeBatch(bridgeActions);
                    if (!execResult.ok) {
                        for (const r of execResult.results) {
                            if (!r.ok) failedActions.push(`${r.action?.type || "?"}: ${r.error}`);
                        }
                    }
                }

                if (failedActions.length) {
                    entry.response += "\n\n⚠ " + failedActions.join("; ");
                }
            }

            // Safety net: if user asked to create music but LLM didn't generate, auto-compose
            if (hasGenre && !hasCompose && !hasGenerate) {
                const genre = this.context.lastGenre || this._detectGenreFromState();
                if (genre && this.sceneManager) {
                    const compResult = this.sceneManager.compose(genre);
                    if (compResult.ok) {
                        entry.response += "\n\n🎛 Auto-generating " + genre + " patterns...";
                    }
                }
            }

            this._addHistory(entry);
            this._emitResponse(entry.response, entry);
            return entry;
        } catch (err) {
            this.ollama.disconnect();
            const fallbackEntry = await this.process(input);
            return fallbackEntry;
        }
    }

    getHistory() {
        return [...this.history];
    }

    clearHistory() {
        this.history = [];
        this.context = {
            lastMood: null,
            lastGenre: null,
            lastIntent: null,
            lastKey: null,
            lastBpm: null,
            sessionStarted: Date.now(),
            interactionCount: 0,
        };
    }

    _addHistory(entry) {
        this.history.push(entry);
        if (this.history.length > this.maxHistory) this.history.shift();
    }

    _emitResponse(text, entry) {
        for (const cb of this._responseCallbacks) {
            try { cb(text, entry); } catch (e) { console.warn("AIEngine: response callback error", e); }
        }
    }
}
