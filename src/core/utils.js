import { MIDI_NOTE_NAMES } from "./constants.js";

export function noteNameToMidi(noteName) {
    const normalized = String(noteName).trim().toUpperCase();
    const match = /^([A-G])([#B]?)(-?\d+)$/.exec(normalized) || /^([A-G])(-?\d+)([#B]?)$/.exec(normalized);
    if (!match) return 36;
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const note = match[1];
    const sharp = match[2] === "#" || match[3] === "#";
    const flat = match[2] === "B" || match[3] === "B";
    const octave = Number(["#", "B", ""].includes(match[2]) ? match[3] : match[2]);
    return clamp((octave + 1) * 12 + semitones[note] + (sharp ? 1 : 0) - (flat ? 1 : 0), 0, 127);
}

export function isNoteName(noteName) {
    return /^([A-G])([#b]?)(-?\d+)$/i.test(String(noteName).trim()) || /^([A-G])(-?\d+)([#b]?)$/i.test(String(noteName).trim());
}

export function noteToFrequency(noteName) {
    return 440 * (2 ** ((noteNameToMidi(noteName) - 69) / 12));
}

export function midiNoteName(note) {
    const index = clamp(Number(note) || 0, 0, 127);
    const name = MIDI_NOTE_NAMES[index % 12];
    const octave = Math.floor(index / 12) - 1;
    return `${name}${octave}`;
}

export function generateNoteNames(minMidi = 0, maxMidi = 127) {
    const min = clamp(Math.round(Number(minMidi) || 0), 0, 127);
    const max = clamp(Math.round(Number(maxMidi) || 127), min, 127);
    return Array.from({ length: max - min + 1 }, (_, index) => midiNoteName(min + index));
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function lerp(current, target, amount) {
    return current + (target - current) * amount;
}

export function mixHslWithWhite(hue, whiteMix, alpha) {
    if (whiteMix < 0.01) return `hsla(${hue}, 100%, 62%, ${alpha})`;
    const lightness = 62 + whiteMix * 38;
    const saturation = 100 - whiteMix * 100;
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

export function contrastColor(baseHue, contrastHue, mix, alpha) {
    const hue = lerpHue(baseHue, contrastHue, mix);
    const lightness = 62 + mix * 8;
    return `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
}

export function lerpHue(from, to, amount) {
    const start = ((from % 360) + 360) % 360;
    const end = ((to % 360) + 360) % 360;
    let delta = end - start;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return ((start + delta * amount) % 360 + 360) % 360;
}

export function drawPolygon(ctx, sides, radius, strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= sides; i += 1) {
        const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}
