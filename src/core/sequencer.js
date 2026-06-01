export class SequencerEngine {
    constructor({ getBpm, getLoopLength, getRate, onTick, onError } = {}) {
        this.getBpm = getBpm;
        this.getLoopLength = getLoopLength;
        this.getRate = getRate;
        this.onTick = onTick;
        this.onError = onError;
        this.running = false;
        this.timer = 0;
        this.nextTickAt = 0;
        this.subTimers = [];
        this.tickCount = 0;
        this.swing = 0;
        this.steps = {
            drum: 0,
            bass: 0,
            melody: 0,
            other: 0
        };
        this.lastSteps = {
            drum: 0,
            bass: 0,
            melody: 0,
            other: 0
        };
    }

    setSwing(amount) {
        this.swing = Math.max(0, Math.min(1, Number(amount) || 0));
    }

    start() {
        if (this.running) return;
        this.reset();
        this.running = true;
        this.nextTickAt = performance.now();
        this.tick();
    }

    stop() {
        this.running = false;
        window.clearTimeout(this.timer);
        this.clearSubTimers();
        this.timer = 0;
    }

    nudge(ms) {
        if (!this.running) return;
        this.nextTickAt += Number(ms) || 0;
    }

    resync() {
        this.reset();
        if (!this.running) return;
        window.clearTimeout(this.timer);
        this.clearSubTimers();
        this.nextTickAt = performance.now();
        this.tick();
    }

    reset() {
        Object.keys(this.steps).forEach((kind) => {
            this.steps[kind] = 0;
            this.lastSteps[kind] = 0;
        });
        this.tickCount = 0;
        this.clearSubTimers();
    }

    tick() {
        if (!this.running) return;

        const duration = this.stepDurationMs();
        const swingDelay = this.tickCount % 2 === 1 ? duration * this.swing * 0.25 : 0;
        const tickEvents = this.createTickEvents(duration);
        this.lastSteps = lastStepsFromEvents(tickEvents, this.lastSteps);
        try {
            this.onTick?.(tickEvents);
            this.scheduleSubTicks(tickEvents);
        } catch (error) {
            this.onError?.(error, tickEvents);
        } finally {
            const now = performance.now();
            if (now - this.nextTickAt > duration * 2) {
                this.nextTickAt = now;
            }
            this.nextTickAt += duration + swingDelay;
            this.tickCount += 1;
            const delay = Math.max(1, this.nextTickAt - performance.now());
            this.timer = window.setTimeout(() => this.tick(), delay);
        }
    }

    createTickEvents(duration) {
        return Object.keys(this.steps).reduce((events, kind) => {
            events[kind] = this.createEventsForKind(kind, duration);
            return events;
        }, {});
    }

    createEventsForKind(kind, duration) {
        const rate = this.rateFor(kind);
        if (rate === 0.5 && this.tickCount % 2 === 1) return [];

        const events = [{
            kind,
            step: this.steps[kind],
            delayMs: 0
        }];
        this.steps[kind] = (this.steps[kind] + 1) % this.loopLengthFor(kind);

        if (rate === 2) {
            events.push({
                kind,
                step: this.steps[kind],
                delayMs: duration * 0.5
            });
            this.steps[kind] = (this.steps[kind] + 1) % this.loopLengthFor(kind);
        }

        return events;
    }

    scheduleSubTicks(tickEvents) {
        this.clearSubTimers();
        Object.values(tickEvents).flat().forEach((event) => {
            if (!event.delayMs) return;
            const timer = window.setTimeout(() => {
                if (!this.running) return;
                this.lastSteps[event.kind] = event.step;
                try {
                    this.onTick?.({ [event.kind]: [event] });
                } catch (error) {
                    this.onError?.(error, { [event.kind]: [event] });
                }
            }, Math.max(1, event.delayMs));
            this.subTimers.push(timer);
        });
    }

    clearSubTimers() {
        this.subTimers.forEach((timer) => window.clearTimeout(timer));
        this.subTimers = [];
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

    loopLengthFor(kind) {
        return Math.max(1, Number(this.getLoopLength(kind)) || 1);
    }

    rateFor(kind) {
        const rate = Number(this.getRate?.(kind));
        return [0.5, 1, 2].includes(rate) ? rate : 1;
    }
}

function lastStepsFromEvents(tickEvents, fallback = {}) {
    return Object.keys(fallback).reduce((steps, kind) => {
        const first = tickEvents[kind]?.[0];
        steps[kind] = first ? first.step : fallback[kind] ?? 0;
        return steps;
    }, {});
}
