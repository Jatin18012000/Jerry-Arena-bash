import { BUTTON_PRIORITY, type AttackButton } from './types';

interface BufferedPress {
  readonly button: AttackButton;
  /** Combat frame the press was recorded on. */
  readonly frame: number;
}

/**
 * Per-fighter attack input buffer, timed in combat frames (never wall-clock or event timestamps).
 *
 * - A press made on frame P can come out on frames P .. P + window - 1.
 * - `take` returns the oldest eligible press; presses from the same frame resolve by
 *   `BUTTON_PRIORITY` (Special > Heavy > Kick > Light).
 * - Taking an action clears the whole buffer: one buffered press produces at most one move and
 *   leftover presses can never fire later unexpectedly.
 * - Combat frames do not advance during hit-stop, so presses made during a freeze stay valid
 *   for the full window afterwards.
 */
export class InputBuffer {
  readonly window: number;
  private entries: BufferedPress[] = [];

  constructor(window: number) {
    if (!Number.isInteger(window) || window < 1) throw new RangeError('input buffer window must be a whole number >= 1');
    this.window = window;
  }

  get size(): number {
    return this.entries.length;
  }

  /** Buffered presses, oldest first (for debug display and tests). */
  peek(): readonly BufferedPress[] {
    return this.entries;
  }

  record(button: AttackButton, frame: number): void {
    this.entries.push({ button, frame });
  }

  /** Drop presses too old to come out on `frame`. */
  prune(frame: number): void {
    this.entries = this.entries.filter((e) => frame - e.frame < this.window);
  }

  /** Consume the action for `frame`, or null. See class comment for the rules. */
  take(frame: number): AttackButton | null {
    this.prune(frame);
    if (this.entries.length === 0) return null;
    const oldest = Math.min(...this.entries.map((e) => e.frame));
    let best: AttackButton | null = null;
    for (const e of this.entries) {
      if (e.frame !== oldest) continue;
      if (best === null || BUTTON_PRIORITY.indexOf(e.button) < BUTTON_PRIORITY.indexOf(best)) best = e.button;
    }
    this.entries = [];
    return best;
  }

  clear(): void {
    this.entries = [];
  }
}
