export class SequencerEngine {
    constructor({ getBpm, getLoopLength, getRate, onTick, onError, audioCtx } = {}) {
        this.getBpm = getBpm;
        this.getLoopLength = getLoopLength;
        this.getRate = getRate;
        this.onTick = onTick;
        this.onError = onError;
        this.audioCtx = audioCtx;
        this.running = false;
        this.timer = null;
        this.tickCount = 0;
        this.swing = 0;
        this.lookaheadSec = 0.1;
        this.scheduleIntervalMs = 25;
        this.steps = {
            drum: 0, bass: 0, melody: 0, other: 0
        };
        this.lastSteps = {
            drum: 0, bass: 0, melody: 0, other: 0
        };
        this.nextStepTimes = {
            drum: 0, bass: 0, melody: 0, other: 0
        };
    }

    setSwing(amount) {
        this.swing = Math.max(0, Math.min(1, Number(amount) || 0));
    }

    start() {
        if (this.running) return;
        this.reset();
        this.running = true;
        const now = this._now();
        Object.keys(this.nextStepTimes).forEach((k) => {
            this.nextStepTimes[k] = now;
        });
        this._scheduleLoop();
    }

    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    nudge(ms) {
        if (!this.running) return;
        const offset = Number(ms) || 0;
        Object.keys(this.nextStepTimes).forEach((k) => {
            this.nextStepTimes[k] += offset / 1000;
        });
    }

    resync() {
        this.reset();
        if (!this.running) return;
        if (this.timer) clearTimeout(this.timer);
        const now = this._now();
        Object.keys(this.nextStepTimes).forEach((k) => {
            this.nextStepTimes[k] = now;
        });
        this._scheduleLoop();
    }

    reset() {
        Object.keys(this.steps).forEach((kind) => {
            this.steps[kind] = 0;
            this.lastSteps[kind] = 0;
        });
        this.tickCount = 0;
    }

    currentStep(kind) {
        return this.lastSteps[kind] ?? 0;
    }

    isRunning() {
        return this.running;
    }

    stepDurationMs() {
        return (60000 / this.getBpm()) / 4;
    }

    _baseStepSec() {
        return (60 / this.getBpm()) / 4;
    }

    _stepDuration(kind) {
        return this._baseStepSec() / this.rateFor(kind);
    }

    loopLengthFor(kind) {
        return Math.max(1, Number(this.getLoopLength(kind)) || 1);
    }

    rateFor(kind) {
        const rate = Number(this.getRate?.(kind));
        return [0.5, 1, 2].includes(rate) ? rate : 1;
    }

    _scheduleLoop() {
        if (!this.running) return;
        this._scheduleFutureEvents();
        this.timer = setTimeout(() => this._scheduleLoop(), this.scheduleIntervalMs);
    }

    _now() {
        return this.audioCtx ? this.audioCtx.currentTime : performance.now() / 1000;
    }

    _scheduleFutureEvents() {
        const now = this._now();
        const deadline = now + this.lookaheadSec;
        const baseStepDur = this._baseStepSec();
        const allEvents = {};

        Object.keys(this.steps).forEach((kind) => {
            const dur = this._stepDuration(kind);
            const loopLen = this.loopLengthFor(kind);

            if (this.nextStepTimes[kind] < now) {
                const behind = now - this.nextStepTimes[kind];
                const stepsToCatch = Math.min(Math.floor(behind / dur), loopLen);
                this.steps[kind] = (this.steps[kind] + stepsToCatch) % loopLen;
                this.nextStepTimes[kind] += stepsToCatch * dur;
                if (this.nextStepTimes[kind] < now) {
                    this.nextStepTimes[kind] = now;
                }
            }

            while (this.nextStepTimes[kind] < deadline) {
                const stepTime = this.nextStepTimes[kind];
                const step = this.steps[kind];

                let swingOffset = 0;
                if (step % 2 === 1) {
                    swingOffset = baseStepDur * this.swing * 0.25;
                }
                const adjustedTime = stepTime + swingOffset;

                this.steps[kind] = (step + 1) % loopLen;
                this.nextStepTimes[kind] += dur;
                this.lastSteps[kind] = step;
                this.tickCount += 1;

                if (!allEvents[kind]) allEvents[kind] = [];
                allEvents[kind].push({ kind, step, time: adjustedTime });
            }
        });

        const hasEvents = Object.keys(allEvents).length > 0;
        if (hasEvents) {
            try {
                this.onTick?.(allEvents);
            } catch (error) {
                this.onError?.(error, allEvents);
            }
        }
    }
}
