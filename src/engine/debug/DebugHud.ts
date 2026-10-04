/** A game state that can describe itself in the debug HUD (optional, duck-typed). */
export interface DebugInfoSource {
  debugLines(): readonly string[];
}

export function hasDebugLines(value: unknown): value is DebugInfoSource {
  return typeof (value as Partial<DebugInfoSource> | undefined)?.debugLines === 'function';
}

/**
 * Minimal text overlay for engine diagnostics. Not the game UI (see src/ui, planned).
 */
export class DebugHud {
  private readonly element: HTMLElement;
  private lastUpdateMs = 0;
  private framesSinceUpdate = 0;
  private fps = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'debug-hud';
    this.element.setAttribute('data-testid', 'debug-hud');
    parent.appendChild(this.element);
  }

  /**
   * Call once per rendered frame. Refreshes text about twice per second; `lines` is only
   * invoked on those refreshes, so states can format freely without per-frame cost.
   */
  tick(nowMs: number, info: { steps: number; state: string; lines?: () => readonly string[] }): void {
    this.framesSinceUpdate++;
    const elapsed = nowMs - this.lastUpdateMs;
    if (elapsed < 500) return;
    this.fps = Math.round((this.framesSinceUpdate * 1000) / elapsed);
    this.framesSinceUpdate = 0;
    this.lastUpdateMs = nowMs;
    this.element.textContent = [
      `BRAIN ROT: LEGENDS — dev build`,
      `state: ${info.state}  fps: ${this.fps}  sim steps: ${info.steps}`,
      ...(info.lines?.() ?? []),
    ].join('\n');
  }

  dispose(): void {
    this.element.remove();
  }
}
