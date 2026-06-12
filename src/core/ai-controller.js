export function mountAIChat(engine, ctx) {
    const existing = document.getElementById("ai-chat-panel")
    if (existing) existing.remove()

    const container = document.createElement("div")
    container.id = "ai-chat-panel"
    container.className = "ai-chat-panel"
    container.innerHTML = `
        <div class="ai-chat-header">
            <span class="ai-chat-title">SYNTHeTIKA</span>
            <span class="ai-chat-subtitle">AI Music Producer</span>
            <span class="ai-chat-ollama-status" id="ai-chat-ollama-status" title="Ollama connection">○</span>
            <button class="ai-chat-ollama-btn" id="ai-chat-ollama-btn" type="button" title="Connect to local Ollama">Ollama</button>
            <button class="ai-chat-clear" id="ai-chat-clear" type="button" title="Clear chat">🗑</button>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages"></div>
        <div class="ai-chat-input-row">
            <textarea class="ai-chat-input" id="ai-chat-input" rows="1" placeholder="Describe your vision... mood? genre? idea?"></textarea>
            <button class="ai-chat-gen" id="ai-chat-gen" type="button" title="Generate full composition">🎛</button>
            <button class="ai-chat-send" id="ai-chat-send" type="button" title="Send">↵</button>
        </div>
    `

    const toggle = document.createElement("button")
    toggle.id = "ai-chat-toggle"
    toggle.className = "ai-chat-toggle"
    toggle.textContent = "AI"
    toggle.title = "Toggle AI Music Producer"
    toggle.setAttribute("aria-label", "Toggle AI Music Producer")

    document.body.append(toggle, container)

    const messages = container.querySelector("#ai-chat-messages")
    const input = container.querySelector("#ai-chat-input")
    const sendBtn = container.querySelector("#ai-chat-send")
    const clearBtn = container.querySelector("#ai-chat-clear")
    const genBtn = container.querySelector("#ai-chat-gen")
    const ollamaBtn = container.querySelector("#ai-chat-ollama-btn")
    const ollamaStatus = container.querySelector("#ai-chat-ollama-status")

    let open = false

    function toggleOpen() {
        open = !open
        container.classList.toggle("open", open)
        toggle.classList.toggle("active", open)
        if (open) input.focus()
    }

    toggle.addEventListener("click", toggleOpen)

    function updateOllamaStatus(connected) {
        ollamaStatus.textContent = connected ? "●" : "○"
        ollamaStatus.style.color = connected ? "#4f4" : "#888"
        ollamaBtn.textContent = connected ? "Disconnect" : "Ollama"
        ollamaBtn.title = connected ? "Disconnect from Ollama" : "Connect to local Ollama"
    }

    ollamaBtn.addEventListener("click", async () => {
        if (engine?.isOllamaConnected()) {
            engine.disconnectOllama()
            updateOllamaStatus(false)
            return
        }
        ollamaBtn.textContent = "Connecting..."
        const ok = await engine?.connectOllama()
        updateOllamaStatus(ok)
        if (ok) {
            addMessage("🔗 Connected to Ollama. Ask me anything about music!")
        } else {
            addMessage("❌ Could not connect to Ollama. Make sure it's running on localhost:11434")
        }
    })

    function addMessage(text, isUser = false) {
        hideThinking()
        const msg = document.createElement("div")
        msg.className = `ai-chat-msg ${isUser ? "user" : "assistant"}`
        const pre = document.createElement("pre")
        pre.textContent = text
        msg.appendChild(pre)
        messages.appendChild(msg)
        messages.scrollTop = messages.scrollHeight
    }

    function showThinking() {
        hideThinking()
        const msg = document.createElement("div")
        msg.className = "ai-chat-msg assistant thinking"
        msg.id = "ai-thinking-msg"
        const pre = document.createElement("pre")
        pre.textContent = "..."
        msg.appendChild(pre)
        messages.appendChild(msg)
        messages.scrollTop = messages.scrollHeight
    }

    function hideThinking() {
        const el = document.getElementById("ai-thinking-msg")
        if (el) el.remove()
    }

    function sendMessage() {
        const text = input.value.trim()
        if (!text) return
        addMessage(text, true)
        input.value = ""
        input.style.height = "auto"
        showThinking()

        if (engine) {
            engine.process(text).catch(err => {
                hideThinking()
                addMessage(`Error: ${err.message}`)
            })
        } else {
            addMessage("AI engine not ready.")
        }
    }

    function generateAllTracks() {
        if (!ctx) return
        const { getState, setState, randomizer, activePattern, getLoopLength, renderGrid, saveState } = ctx
        const st = getState()
        const genre = st.drumRandomGenre || "default"
        addMessage(`🎛 Generate all tracks`, true)

        try {
            const scaleDef = ctx.currentScaleDefinition()
            const root = st.noteRoot

            for (const kind of ["drum", "bass", "melody", "other"]) {
                const pattern = activePattern(kind)
                if (!pattern) continue

                if (kind === "drum") {
                    randomizer.apply({
                        mode: "drum",
                        role: "generate",
                        pattern,
                        loopLength: getLoopLength("drum"),
                        drumGenre: genre,
                    })
                } else {
                    const role = kind === "other" ? "mono" : kind
                    const style = st.pitchGeneratorStyles?.[kind] || (kind === "other" ? "stab" : "root-pulse")
                    randomizer.apply({
                        mode: kind,
                        role: "generate",
                        pattern,
                        loopLength: getLoopLength(kind),
                        scale: scaleDef,
                        root,
                        drumGenre: genre,
                        genre,
                        generatorMode: "structured",
                        generatorRole: role,
                        generatorStyle: style,
                    })
                }
            }

            renderGrid()
            saveState()
            addMessage(`✅ All tracks generated. Press play ▶`)
        } catch (err) {
            addMessage(`❌ Error: ${err.message}`)
        }
    }

    const _nonGeneratingTypes = new Set([
        "query", "transport", "undo", "redo",
        "bank", "preset", "preset-all", "mode",
        "mixer", "mixer-delta", "bpm", "bpm-delta",
        "scale", "root", "scale-root", "clear"
    ])

    engine?.onResponse((response, entry) => {
        addMessage(response, false)
        if (entry?.intent && !_nonGeneratingTypes.has(entry.intent.type)) {
            const intent = entry.intent
            let detectedGenre = null
            if (intent.type === "genre") {
                detectedGenre = intent.genre
            } else if (intent.type === "compose") {
                detectedGenre = intent.genre || entry.genre
            } else if (intent.type === "creative-direction" && intent.analysis?.genre) {
                detectedGenre = intent.analysis.genre
            }
            if (detectedGenre) {
                const st = ctx?.getState()
                if (st) st.drumRandomGenre = detectedGenre
            }
            generateAllTracks()
        }
    })

    sendBtn.addEventListener("click", sendMessage)
    genBtn.addEventListener("click", generateAllTracks)
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
        input.style.height = "auto"
        input.style.height = Math.min(input.scrollHeight, 120) + "px"
    })
    input.addEventListener("input", () => {
        input.style.height = "auto"
        input.style.height = Math.min(input.scrollHeight, 120) + "px"
    })

    clearBtn.addEventListener("click", () => {
        messages.innerHTML = ""
        engine?.clearHistory()
    })

    addMessage(ctx?.welcomeMessage || "Hello! I'm your AI music producer. Describe what you want to create!")
}
