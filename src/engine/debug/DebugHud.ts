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

  /** Call once per rendered frame. Refreshes text about twice per second. */
  tick(nowMs: number, info: { steps: number; state: string }): void {
    this.framesSinceUpdate++;
    const elapsed = nowMs - this.lastUpdateMs;
    if (elapsed < 500) return;
    this.fps = Math.round((this.framesSinceUpdate * 1000) / elapsed);
    this.framesSinceUpdate = 0;
    this.lastUpdateMs = nowMs;
    this.element.textContent =
      `BRAIN ROT: LEGENDS — engine foundation (Phase 1)\n` +
      `state: ${info.state}  fps: ${this.fps}  sim steps: ${info.steps}\n` +
      `WASD / arrows: move test cube`;
  }

  dispose(): void {
    this.element.remove();
  }
}
