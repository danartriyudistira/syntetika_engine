import { DRUM_RANDOM_GENRES, SCENE_DEFINITIONS, GENRE_PROFILES, PITCH_GENERATOR_STYLE_LABELS } from "./constants.js";

export function describeSnapshot(snapshot) {
    if (!snapshot) return "Engine belum siap.";
    const parts = [];
    const t = snapshot.transport;

    parts.push(transportLine(t));

    const scale = snapshot.scale?.definition;
    parts.push(`Scale: ${snapshot.scale?.root || "C"} ${scale?.label || "Chromatic"}`);
    parts.push(`Drum Genre: ${genreLabel(snapshot.drumGenre)}`);

    const p = snapshot.patterns;
    if (p) {
        const active = [];
        for (const kind of ["drum", "bass", "melody", "other"]) {
            const info = p[kind];
            if (info && info.activeSteps > 0) {
                active.push(`${kind}: ${info.activeSteps}/${info.loopLength} steps at ${info.location}`);
            } else if (info) {
                active.push(`${kind}: empty at ${info.location}`);
            }
        }
        parts.push(`Patterns — ${active.join(" | ")}`);
    }

    const mixer = snapshot.mixer;
    if (mixer) {
        parts.push(`Mixer: D${mixer.drum}% B${mixer.bass}% M${mixer.melody}% O${mixer.other}%`);
    }

    const sounds = snapshot.sounds;
    if (sounds) {
        parts.push(`Sounds: ${Object.entries(sounds).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    }

    const gen = snapshot.generator;
    if (gen) {
        const mode = snapshot.transport.mode;
        const gMode = gen.modes?.[mode] || "explore";
        const gRole = gen.roles?.[mode] || "bass";
        const gStyle = gen.styles?.[mode] || "root-pulse";
        parts.push(`Generator: ${gMode} / ${gRole} / ${styleLabel(gStyle)}`);
    }

    return parts.join("\n");
}

function transportLine(t) {
    const status = t.playing ? "▶ Playing" : "⏹ Stopped";
    return `${status} at ${t.bpm} BPM | Mode: ${t.mode}`;
}

function genreLabel(id) {
    const g = DRUM_RANDOM_GENRES.find((x) => x.id === id);
    return g?.label || id || "Default";
}

function styleLabel(id) {
    return PITCH_GENERATOR_STYLE_LABELS[id] || id || "Root Pulse";
}

export function describePatternSummary(kind, info) {
    if (!info) return `No data for ${kind}.`;
    if (info.type === "drum") {
        return `${kind}: ${info.activeSteps} hits across ${info.tracks} tracks, loop ${info.loopLength} steps. Density: ${(info.density * 100).toFixed(0)}%. Location: ${info.location}`;
    }
    return `${kind}: ${info.activeSteps} active notes, loop ${info.loopLength} steps. Density: ${(info.density * 100).toFixed(0)}%. Location: ${info.location}`;
}

export function describeScene(sceneId) {
    const def = SCENE_DEFINITIONS.find((s) => s.id === sceneId);
    if (!def) return `Unknown scene: ${sceneId}`;
    const layers = Object.entries(def.layers).map(([k, v]) => `${k}(${v.density}/${v.complexity})`).join(", ");
    return `${def.label} (${def.defaultBars} bars, energy ${(def.energy * 100).toFixed(0)}%): ${def.description}. Layers: ${layers}`;
}

export function describeGenre(genreId) {
    const profile = GENRE_PROFILES[genreId];
    if (!profile) {
        const g = DRUM_RANDOM_GENRES.find((x) => x.id === genreId);
        return g ? `Drum pattern: ${g.label} — ${g.description}` : `Unknown genre: ${genreId}`;
    }
    return `${profile.label}: ${profile.defaultTempo} BPM, scale ${profile.scale}, scene flow: ${profile.sceneStructure.join(" → ")}`;
}
