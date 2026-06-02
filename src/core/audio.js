import { noteToFrequency } from "./utils.js";
import { resolveSoundStyle } from "./pattern-store.js";

export class AudioEngine {
    constructor() {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        this.ctx = AudioContextCtor ? new AudioContextCtor() : null;
        if (!this.ctx) return;

        this.master = this.ctx.createGain();
        this.master.gain.value = 0.78;
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        this.master.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this.channels = {
            drum: this.ctx.createGain(),
            bass: this.ctx.createGain(),
            melody: this.ctx.createGain(),
            other: this.ctx.createGain()
        };
        Object.values(this.channels).forEach((channel) => channel.connect(this.master));
        this.setMixerLevels();
        this.noiseCache = new Map();
        this.driveCurveCache = new Map();
        this.noiseVariantCount = 6;
        this._fftData = new Uint8Array(this.analyser.frequencyBinCount);
        this._activeVoices = { bass: null, melody: null, other: null };
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        this.analyser.getByteFrequencyData(this._fftData);
        const data = this._fftData;
        const len = data.length;
        const bass = averageRange(data, 0, Math.floor(len * 0.15)) / 255;
        const mid = averageRange(data, Math.floor(len * 0.15), Math.floor(len * 0.6)) / 255;
        const high = averageRange(data, Math.floor(len * 0.6), len) / 255;
        const level = data.reduce((s, v) => s + v, 0) / len / 255;
        return { bass, mid, high, level };
    }

    async resume() {
        if (this.ctx && this.ctx.state !== "running") {
            await this.ctx.resume();
        }
    }

    setMixerLevels(levels = {}) {
        if (!this.ctx || !this.channels) return;
        Object.entries(this.channels).forEach(([kind, gain]) => {
            const value = Number(levels[kind]);
            const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0.8;
            gain.gain.setTargetAtTime(normalized, this.ctx.currentTime, 0.012);
        });
    }

    channel(kind) {
        return this.channels?.[kind] || this.master;
    }

    noteOn(kind, noteName, when) {
        if (!this.ctx) return;
        this.releaseNote(kind, when);
        const now = when ?? this.ctx.currentTime;
        const freq = noteToFrequency(noteName);
        const ch = this.channel(kind);
        const osc = this.ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = Math.max(200, freq * 6);
        filter.Q.value = 2;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ch);
        osc.start(now);
        this._activeVoices[kind] = { osc, gain, filter };
    }

    retieNote(kind, noteName, when) {
        if (!this.ctx) return;
        const voice = this._activeVoices[kind];
        if (!voice) return this.noteOn(kind, noteName, when);
        const now = when ?? this.ctx.currentTime;
        const freq = noteToFrequency(noteName);
        voice.osc.frequency.setValueAtTime(freq, now);
        voice.filter.frequency.setValueAtTime(Math.max(200, freq * 6), now);
    }

    releaseNote(kind, when) {
        if (!this.ctx) return;
        const voice = this._activeVoices[kind];
        if (!voice) return;
        const now = when ?? this.ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        try { voice.osc.stop(now + 0.06); } catch {}
        this._activeVoices[kind] = null;
    }

    playDrum(index, style = "default", when) {
        if (!this.ctx) return;
        const voice = drumVoiceFromInput(index);
        this.activeOutput = this.channel("drum");
        if (["kick", "snare", "hat-close", "hat-open"].includes(voice)) {
            const legacyIndex = drumLegacyIndex(voice);
            if (style === "glitch") return this.playGlitchDrum(legacyIndex, when);
            if (style === "noise") return this.playNoiseDrum(legacyIndex, when);
            if (style === "abstract") return this.playAbstractDrum(legacyIndex, when);
        }
        if (voice === "kick") this.kick(when);
        if (voice === "snare") this.snare(when);
        if (voice === "clap") this.clap(style, when);
        if (voice === "tom-hi") this.tom(185, 122, 0.22, 0.3, style, when);
        if (voice === "tom-lo") this.tom(118, 74, 0.28, 0.36, style, when);
        if (voice === "hat-close") this.hat(0.045, 7000, when);
        if (voice === "hat-open") this.hat(0.18, 5200, when);
    }

    playBass(noteName, style = "hard-bass", when) {
        if (!this.ctx) return;
        this.activeOutput = this.channel("bass");
        style = resolveSoundStyle("bass", style);
        if (style === "sub") return this.playSubBass(noteName, when);
        if (style === "acid") return this.playAcidBass(noteName, when);
        if (style === "pluck") return this.playPluckBass(noteName, when);
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const oscC = this.ctx.createOscillator();
        const mixer = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const drive = this.createDrive(1.7);
        const gain = this.ctx.createGain();

        oscA.type = "sawtooth";
        oscB.type = "sawtooth";
        oscC.type = "square";
        oscA.frequency.value = frequency * 0.997;
        oscB.frequency.value = frequency * 1.003;
        oscC.frequency.value = frequency * 0.5;
        mixer.gain.value = 0.42;
        filter.type = "lowpass";
        filter.Q.value = 8.5;
        filter.frequency.setValueAtTime(Math.max(520, frequency * 9), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(115, frequency * 1.55), now + 0.24);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.24, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        oscA.connect(mixer);
        oscB.connect(mixer);
        oscC.connect(mixer);
        mixer.connect(filter);
        filter.connect(drive);
        drive.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscC.start(now);
        oscA.stop(now + 0.45);
        oscB.stop(now + 0.45);
        oscC.stop(now + 0.45);
    }

    playSubBass(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const osc = this.ctx.createOscillator();
        const sub = this.ctx.createOscillator();
        const fifth = this.ctx.createOscillator();
        const mixer = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const drive = this.createDrive(1.35);
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        sub.type = "square";
        fifth.type = "triangle";
        osc.frequency.value = frequency * 0.998;
        sub.frequency.value = frequency * 0.5;
        fifth.frequency.value = frequency * 1.5;
        mixer.gain.value = 0.36;
        filter.type = "lowpass";
        filter.Q.value = 5.5;
        filter.frequency.setValueAtTime(Math.max(240, frequency * 4.2), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(68, frequency * 1.08), now + 0.38);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.26, now + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);

        osc.connect(mixer);
        sub.connect(mixer);
        fifth.connect(mixer);
        mixer.connect(filter);
        filter.connect(drive);
        drive.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(now);
        sub.start(now);
        fifth.start(now);
        osc.stop(now + 0.62);
        sub.stop(now + 0.62);
        fifth.stop(now + 0.62);
    }

    playAcidBass(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const mixer = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const drive = this.createDrive(2.15);
        const gain = this.ctx.createGain();

        oscA.type = "sawtooth";
        oscB.type = "square";
        oscA.frequency.value = frequency;
        oscB.frequency.value = frequency * 0.5;
        mixer.gain.value = 0.38;
        filter.type = "lowpass";
        filter.Q.value = 14;
        filter.frequency.setValueAtTime(Math.max(1200, frequency * 14), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(180, frequency * 2.4), now + 0.18);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        oscA.connect(mixer);
        oscB.connect(mixer);
        mixer.connect(filter);
        filter.connect(drive);
        drive.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.32);
        oscB.stop(now + 0.32);
    }

    playPluckBass(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;

        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const mixer = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const drive = this.createDrive(1.45);
        const gain = this.ctx.createGain();

        oscA.type = "sawtooth";
        oscB.type = "triangle";
        oscA.frequency.value = frequency;
        oscB.frequency.value = frequency * 2.01;
        mixer.gain.value = 0.36;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.max(760, frequency * 7.5), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(140, frequency * 1.8), now + 0.12);
        filter.Q.value = 7;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

        oscA.connect(mixer);
        oscB.connect(mixer);
        mixer.connect(filter);
        filter.connect(drive);
        drive.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.22);
        oscB.stop(now + 0.22);
    }

    playMelody(noteName, style = "vintage", when) {
        if (!this.ctx) return;
        this.activeOutput = this.channel("melody");
        style = resolveSoundStyle("melody", style);
        if (style === "bell") return this.playBellMelody(noteName, when);
        if (style === "lead") return this.playLeadMelody(noteName, when);
        if (style === "pad") return this.playPadMelody(noteName, when);
        const now = when ?? this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.value = noteToFrequency(noteName);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        osc.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(now);
        osc.stop(now + 0.46);
    }

    playBellMelody(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        oscA.type = "sine";
        oscB.type = "triangle";
        oscA.frequency.value = frequency;
        oscB.frequency.value = frequency * 2.01;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);

        oscA.connect(gain);
        oscB.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.82);
        oscB.stop(now + 0.82);
    }

    playLeadMelody(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.value = noteToFrequency(noteName);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2400, now);
        filter.frequency.exponentialRampToValueAtTime(900, now + 0.28);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(now);
        osc.stop(now + 0.54);
    }

    playPadMelody(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = "sine";
        oscB.type = "triangle";
        oscA.frequency.value = frequency * 0.995;
        oscB.frequency.value = frequency * 1.005;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.09, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 1.2);
        oscB.stop(now + 1.2);
    }

    playOther(noteName, style = "bass", when) {
        if (!this.ctx) return;
        this.activeOutput = this.channel("other");
        style = resolveSoundStyle("other", style);
        if (style === "plucky") return this.playPluckyMono(noteName, when);
        if (style === "stabby") return this.playStabbyMono(noteName, when);
        if (style === "fm") return this.playFmMono(noteName, when);
        return this.playMoogMono(noteName, when);
    }

    playMoogMono(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = "sawtooth";
        oscB.type = "square";
        oscA.frequency.value = frequency * 0.997;
        oscB.frequency.value = frequency * 0.5;
        filter.type = "lowpass";
        filter.Q.value = 9;
        filter.frequency.setValueAtTime(Math.max(260, frequency * 8), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(85, frequency * 1.4), now + 0.24);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.45);
        oscB.stop(now + 0.45);
    }

    playPluckyMono(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = "triangle";
        oscB.type = "square";
        oscA.frequency.value = frequency;
        oscB.frequency.value = frequency * 2;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(frequency * 5.2, now);
        filter.Q.value = 5;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.22);
        oscB.stop(now + 0.22);
    }

    playStabbyMono(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        oscA.type = "sawtooth";
        oscB.type = "square";
        oscA.frequency.value = frequency;
        oscB.frequency.value = frequency * 1.005;
        filter.type = "lowpass";
        filter.Q.value = 6;
        filter.frequency.setValueAtTime(Math.max(900, frequency * 10), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(260, frequency * 2.1), now + 0.1);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.18);
        oscB.stop(now + 0.18);
    }

    playFmMono(noteName, when) {
        if (!this.ctx) return;
        const now = when ?? this.ctx.currentTime;
        const frequency = noteToFrequency(noteName);
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        carrier.type = "sine";
        modulator.type = "sine";
        carrier.frequency.value = frequency;
        modulator.frequency.value = frequency * 2.01;
        modGain.gain.setValueAtTime(frequency * 4.5, now);
        modGain.gain.exponentialRampToValueAtTime(Math.max(1, frequency * 0.4), now + 0.24);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(frequency * 3.5, now);
        filter.Q.value = 4;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.15, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        carrier.start(now);
        modulator.start(now);
        carrier.stop(now + 0.38);
        modulator.stop(now + 0.38);
    }

    kick(when) {
        const now = when ?? this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(135, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(now);
        osc.stop(now + 0.24);
    }

    snare(when) {
        const now = when ?? this.ctx.currentTime;
        const noise = this.noiseBuffer(0.18);
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const body = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();

        source.buffer = noise;
        filter.type = "bandpass";
        filter.frequency.value = 1700;
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

        body.type = "triangle";
        body.frequency.value = 190;
        bodyGain.gain.setValueAtTime(0.16, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        body.connect(bodyGain);
        bodyGain.connect(this.activeOutput || this.master);
        source.start(now);
        source.stop(now + 0.18);
        body.start(now);
        body.stop(now + 0.1);
    }

    clap(style = "default", when) {
        const now = when ?? this.ctx.currentTime;
        const bursts = style === "abstract" ? [0, 0.018, 0.042, 0.072] : [0, 0.014, 0.031, 0.052];
        bursts.forEach((offset, index) => {
            const source = this.ctx.createBufferSource();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();
            const start = now + offset;
            const length = 0.055 + index * 0.012;
            source.buffer = this.noiseBuffer(length);
            filter.type = "bandpass";
            filter.frequency.value = style === "noise" ? 1850 + index * 340 : 1500 + index * 220;
            filter.Q.value = style === "glitch" ? 2.8 : 1.35;
            gain.gain.setValueAtTime(0.18 / (1 + index * 0.18), start);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.activeOutput || this.master);
            source.start(start);
            source.stop(start + length);
        });
        if (style === "glitch") this.toneBurst("square", 2100, 920, 0.035, 0.06, now + 0.018);
        if (style === "abstract") this.resonantPing(980, 11, 0.12, 0.08, now + 0.026);
    }

    tom(startFreq, endFreq, seconds, volume, style = "default", when) {
        const now = when ?? this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const body = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = style === "glitch" ? "square" : "sine";
        body.type = "triangle";
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + seconds);
        body.frequency.setValueAtTime(startFreq * 0.5, now);
        body.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq * 0.5), now + seconds * 0.9);
        filter.type = style === "noise" ? "bandpass" : "lowpass";
        filter.frequency.setValueAtTime(startFreq * 4, now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(160, endFreq * 2.2), now + seconds);
        filter.Q.value = style === "abstract" ? 9 : 4.5;
        gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

        osc.connect(filter);
        body.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(now);
        body.start(now);
        osc.stop(now + seconds + 0.02);
        body.stop(now + seconds + 0.02);

        if (style === "noise") this.filteredNoise(seconds * 0.55, "bandpass", startFreq * 7, 0.055, now);
        if (style === "abstract") this.resonantPing(startFreq * 2.2, 10, seconds * 0.7, 0.055, now + 0.018);
    }

    hat(length, freq, when) {
        const now = when ?? this.ctx.currentTime;
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        source.buffer = this.noiseBuffer(length);
        filter.type = "highpass";
        filter.frequency.value = freq;
        gain.gain.setValueAtTime(0.23, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        source.start(now);
        source.stop(now + length);
    }

    playGlitchDrum(index, when) {
        const now = when ?? this.ctx.currentTime;
        if (index === 0) {
            this.toneBurst("square", 92, 31, 0.13, 0.54, now);
            this.toneBurst("sawtooth", 47, 54, 0.045, 0.18, now + 0.038);
            this.filteredNoise(0.018, "highpass", 4200, 0.22, now);
        }
        if (index === 1) {
            this.filteredNoise(0.075, "bandpass", 2400, 0.48, now);
            this.toneBurst("square", 310 + Math.random() * 90, 180, 0.055, 0.16, now + 0.015);
        }
        if (index === 2) {
            this.filteredNoise(0.025, "highpass", 9000 + Math.random() * 3500, 0.2, now);
            this.toneBurst("square", 4200, 5100, 0.018, 0.06, now);
        }
        if (index === 3) {
            this.filteredNoise(0.14, "highpass", 6200 + Math.random() * 2600, 0.18, now);
            this.toneBurst("sawtooth", 1800, 900, 0.08, 0.08, now + 0.04);
        }
    }

    playNoiseDrum(index, when) {
        const now = when ?? this.ctx.currentTime;
        if (index === 0) {
            this.toneBurst("sine", 92, 39, 0.13, 0.34, now);
            this.filteredNoise(0.055, "lowpass", 260, 0.2, now);
            this.clickCluster(4, 7600, 14500, 0.085, 0.1, now);
            this.toneBurst("square", 11800, 5200, 0.014, 0.045, now);
        }
        if (index === 1) {
            this.filteredNoise(0.13, "bandpass", 1650, 0.34, now);
            this.toneBurst("triangle", 210, 155, 0.055, 0.08, now);
            this.clickCluster(7, 8200, 16800, 0.12, 0.1, now + 0.006);
            this.toneBurst("sawtooth", 9600, 13200, 0.018, 0.04, now + 0.018);
        }
        if (index === 2) {
            this.filteredNoise(0.032, "highpass", 8200, 0.14, now);
            this.clickCluster(3, 10400, 18600, 0.034, 0.08, now);
            this.toneBurst("square", 14200, 17200, 0.009, 0.025, now);
        }
        if (index === 3) {
            this.filteredNoise(0.17, "highpass", 5200, 0.13, now);
            this.clickCluster(10, 7200, 17800, 0.18, 0.065, now);
            this.filteredNoise(0.07, "highpass", 11800, 0.045, now + 0.04);
        }
    }

    playAbstractDrum(index, when) {
        const now = when ?? this.ctx.currentTime;
        if (index === 0) {
            this.resonantPing(58, 1.9, 0.28, 0.28, now);
            this.resonantPing(176, 7.5, 0.11, 0.08, now + 0.018);
            this.filteredNoise(0.026, "bandpass", 690, 0.12, now);
        }
        if (index === 1) {
            this.resonantPing(410, 10, 0.16, 0.14, now);
            this.resonantPing(867, 13, 0.09, 0.08, now + 0.022);
            this.clickCluster(5, 3200, 9200, 0.11, 0.055, now);
        }
        if (index === 2) {
            this.resonantPing(2600, 18, 0.038, 0.055, now);
            this.clickCluster(2, 9600, 15200, 0.025, 0.045, now);
        }
        if (index === 3) {
            this.resonantPing(1320, 11, 0.26, 0.09, now);
            this.resonantPing(3180, 16, 0.19, 0.055, now + 0.035);
            this.filteredNoise(0.11, "highpass", 8800, 0.04, now + 0.02);
        }
    }

    clickCluster(count, minFreq, maxFreq, spanSeconds, volume, startAt = this.ctx.currentTime) {
        for (let i = 0; i < count; i += 1) {
            const offset = Math.random() * spanSeconds;
            const duration = 0.006 + Math.random() * 0.014;
            const frequency = minFreq + Math.random() * (maxFreq - minFreq);
            this.filteredNoise(duration, "highpass", frequency, volume * (0.55 + Math.random() * 0.45), startAt + offset);
        }
    }

    toneBurst(type, startFreq, endFreq, seconds, volume, startAt = this.ctx.currentTime) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, startAt);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startAt + seconds);
        gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

        osc.connect(gain);
        gain.connect(this.activeOutput || this.master);
        osc.start(startAt);
        osc.stop(startAt + seconds + 0.01);
    }

    createDrive(amount = 1.4) {
        const drive = this.ctx.createWaveShaper();
        drive.curve = this.driveCurve(amount);
        drive.oversample = "none";
        return drive;
    }

    driveCurve(amount = 1.4) {
        const key = Math.round(Math.max(0.1, amount) * 100);
        if (this.driveCurveCache.has(key)) return this.driveCurveCache.get(key);
        const samples = 192;
        const curve = new Float32Array(samples);
        const k = Math.max(0.1, amount) * 18;
        for (let i = 0; i < samples; i += 1) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
        }
        this.driveCurveCache.set(key, curve);
        return curve;
    }

    filteredNoise(seconds, filterType, frequency, volume, startAt = this.ctx.currentTime) {
        const source = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        source.buffer = this.noiseBuffer(seconds);
        filter.type = filterType;
        filter.frequency.value = frequency;
        gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        source.start(startAt);
        source.stop(startAt + seconds);
    }

    resonantPing(frequency, q, seconds, volume, startAt = this.ctx.currentTime) {
        const impulse = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        impulse.buffer = this.noiseBuffer(0.012);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(frequency, startAt);
        filter.frequency.exponentialRampToValueAtTime(Math.max(1, frequency * (0.75 + Math.random() * 0.7)), startAt + seconds);
        filter.Q.value = q;
        gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds);

        impulse.connect(filter);
        filter.connect(gain);
        gain.connect(this.activeOutput || this.master);
        impulse.start(startAt);
        impulse.stop(startAt + 0.014);
    }

    noiseBuffer(seconds) {
        const bucketSeconds = this.noiseBucket(seconds);
        const cacheKey = bucketSeconds.toFixed(3);
        if (!this.noiseCache.has(cacheKey)) {
            this.noiseCache.set(cacheKey, Array.from({ length: this.noiseVariantCount }, () => this.createNoiseBuffer(bucketSeconds)));
        }
        const variants = this.noiseCache.get(cacheKey);
        return variants[Math.floor(Math.random() * variants.length)];
    }

    noiseBucket(seconds) {
        const safeSeconds = Math.max(0.005, Number(seconds) || 0.01);
        if (safeSeconds <= 0.04) return Math.ceil(safeSeconds / 0.005) * 0.005;
        if (safeSeconds <= 0.2) return Math.ceil(safeSeconds / 0.01) * 0.01;
        return Math.ceil(safeSeconds / 0.02) * 0.02;
    }

    createNoiseBuffer(seconds) {
        const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }
}

function drumVoiceFromInput(input) {
    if (typeof input === "string") return input;
    return ["kick", "snare", "hat-close", "hat-open"][Number(input)] || "kick";
}

function drumLegacyIndex(voice) {
    return {
        kick: 0,
        snare: 1,
        "hat-close": 2,
        "hat-open": 3
    }[voice] ?? 0;
}

function averageRange(data, start, end) {
    let sum = 0;
    const count = Math.max(1, end - start);
    for (let i = start; i < end; i++) sum += data[i];
    return sum / count;
}

