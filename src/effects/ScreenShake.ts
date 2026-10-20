export interface ShakeOffset {
  x: number;
  y: number;
}

/** Largest shake displacement in metres, at strength 1. */
const MAX_AMPLITUDE = 0.12;

/**
 * Camera shake — presentation only, never read by the simulation. Ticked at the fixed step so
 * it looks the same at any frame rate; the pattern is a fixed oscillation (no randomness).
 */
export class ScreenShake {
  private remaining = 0;
  private duration = 0;
  private amplitude = 0;
  private ticks = 0;
  private previous: ShakeOffset = { x: 0, y: 0 };
  private current: ShakeOffset = { x: 0, y: 0 };

  get active(): boolean {
    return this.remaining > 0;
  }

  /** Start (or strengthen) a shake. `strength` 0..1. */
  trigger(strength: number): void {
    const s = Math.min(1, Math.max(0, strength));
    if (s === 0) return;
    const amplitude = MAX_AMPLITUDE * s;
    if (this.active && this.amplitude * (this.remaining / this.duration) >= amplitude) return;
    this.amplitude = amplitude;
    this.duration = this.remaining = Math.round(6 + 14 * s);
  }

  update(): void {
    this.ticks++;
    this.previous = this.current;
    if (this.remaining <= 0) {
      this.current = { x: 0, y: 0 };
      return;
    }
    this.remaining--;
    const k = this.amplitude * (this.remaining / this.duration);
    this.current = { x: k * Math.sin(this.ticks * 2.3), y: 0.6 * k * Math.cos(this.ticks * 3.1) };
  }

  offset(alpha: number): ShakeOffset {
    return {
      x: this.previous.x + (this.current.x - this.previous.x) * alpha,
      y: this.previous.y + (this.current.y - this.previous.y) * alpha,
    };
  }

  reset(): void {
    this.remaining = 0;
    this.previous = this.current = { x: 0, y: 0 };
  }
}
