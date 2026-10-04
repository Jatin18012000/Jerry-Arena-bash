/**
 * Fixed-timestep game loop.
 *
 * Simulation runs at a fixed rate (default 60 Hz) so combat logic can later be
 * frame-accurate and deterministic. Rendering runs once per animation frame and
 * receives an interpolation alpha in [0, 1).
 *
 * The scheduler and clock are injectable so the loop can be tested without a browser.
 */

export interface LoopCallbacks {
  /** Advance simulation by exactly `dt` seconds. Called 0..N times per frame. */
  update(dt: number): void;
  /** Draw the current state. `alpha` is the fraction of a fixed step left in the accumulator. */
  render(alpha: number, frameDelta: number): void;
}

export interface LoopScheduler {
  request(callback: (timeMs: number) => void): number;
  cancel(handle: number): void;
}

export interface GameLoopOptions {
  /** Simulation steps per second. */
  stepsPerSecond?: number;
  /** Largest frame delta (seconds) accepted before clamping, to avoid a spiral of death after a stall. */
  maxFrameDelta?: number;
  scheduler?: LoopScheduler;
  now?: () => number;
}

/** Absorbs floating-point drift so e.g. 0.15s + 0.05s at 10 Hz yields exactly 2 steps. */
const STEP_EPSILON = 1e-9;

export const browserScheduler: LoopScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export class GameLoop {
  readonly fixedDelta: number;
  private readonly maxFrameDelta: number;
  private readonly scheduler: LoopScheduler;
  private readonly now: () => number;
  private readonly callbacks: LoopCallbacks;

  private handle: number | null = null;
  private lastTimeMs = 0;
  private accumulator = 0;
  private stepCount = 0;

  constructor(callbacks: LoopCallbacks, options: GameLoopOptions = {}) {
    const steps = options.stepsPerSecond ?? 60;
    if (!(steps > 0)) throw new RangeError('stepsPerSecond must be positive');
    this.fixedDelta = 1 / steps;
    this.maxFrameDelta = options.maxFrameDelta ?? 0.25;
    this.scheduler = options.scheduler ?? browserScheduler;
    this.now = options.now ?? (() => performance.now());
    this.callbacks = callbacks;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  /** Total fixed simulation steps executed since construction. */
  get steps(): number {
    return this.stepCount;
  }

  start(): void {
    if (this.running) return;
    this.lastTimeMs = this.now();
    this.accumulator = 0;
    this.handle = this.scheduler.request(this.frame);
  }

  stop(): void {
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  /**
   * Advance the loop by an explicit frame delta (seconds). Used by `frame` and by tests.
   * Returns the number of fixed steps executed.
   */
  advance(frameDelta: number): number {
    const delta = Math.min(Math.max(frameDelta, 0), this.maxFrameDelta);
    this.accumulator += delta;
    let executed = 0;
    while (this.accumulator + STEP_EPSILON >= this.fixedDelta) {
      this.callbacks.update(this.fixedDelta);
      this.accumulator = Math.max(0, this.accumulator - this.fixedDelta);
      this.stepCount++;
      executed++;
    }
    this.callbacks.render(this.accumulator / this.fixedDelta, delta);
    return executed;
  }

  private readonly frame = (timeMs: number): void => {
    if (this.handle === null) return;
    const delta = (timeMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = timeMs;
    this.advance(delta);
    if (this.handle !== null) this.handle = this.scheduler.request(this.frame);
  };
}
