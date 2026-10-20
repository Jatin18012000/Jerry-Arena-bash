import type { Match } from '../combat';

/** Frames the "FIGHT!" call stays up (end of the intro and start of the fight). */
const FIGHT_CALL_FRAMES = 30;
/** Frames "K.O." / "TIME" shows before the round winner is announced. */
const ROUND_CALL_FRAMES = 60;

const playerName = (i: 0 | 1): string => `P${i + 1}`;

/** The centre-screen announcement for the match's current moment, or null. Pure. */
export function bannerFor(match: Pick<Match, 'phase' | 'phaseFrame' | 'round' | 'lastResult' | 'winner' | 'config'>): string | null {
  switch (match.phase) {
    case 'intro':
      return match.phaseFrame >= match.config.introFrames - FIGHT_CALL_FRAMES ? 'FIGHT!' : `ROUND ${match.round}`;
    case 'fight':
      return match.phaseFrame < FIGHT_CALL_FRAMES / 2 ? 'FIGHT!' : null;
    case 'roundOver': {
      const result = match.lastResult;
      if (!result) return null;
      if (match.phaseFrame < ROUND_CALL_FRAMES) {
        return result.reason === 'timeout' ? 'TIME' : result.reason === 'doubleKo' ? 'DOUBLE K.O.' : 'K.O.';
      }
      return result.winner === null ? 'DRAW' : `${playerName(result.winner)} WINS`;
    }
    case 'matchOver':
      return match.winner === 'draw' ? 'DRAW GAME' : match.winner === null ? null : `${playerName(match.winner)} WINS THE MATCH`;
  }
}

export interface MatchHudView {
  readonly health: readonly [number, number];
  readonly maxHealth: number;
  readonly wins: readonly [number, number];
  readonly roundsToWin: number;
  readonly seconds: number;
  readonly banner: string | null;
  readonly subBanner: string | null;
  readonly names: readonly [string, string];
}

/**
 * Minimal DOM match HUD: health bars, round-win pips, timer and announcements.
 * Placeholder styling; the real game UI is Phase 5. Writes to the DOM only when values change.
 */
export class MatchHud {
  private readonly root: HTMLElement;
  private readonly fills: [HTMLElement, HTMLElement];
  private readonly names: [HTMLElement, HTMLElement];
  private readonly pips: [HTMLElement, HTMLElement];
  private readonly timer: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly subBanner: HTMLElement;
  private last = '';

  constructor(parent: HTMLElement) {
    const doc = parent.ownerDocument;
    const el = (tag: string, className: string, into: HTMLElement): HTMLElement => {
      const node = doc.createElement(tag);
      node.className = className;
      into.appendChild(node);
      return node;
    };
    this.root = el('div', 'match-hud', parent);
    this.root.setAttribute('data-testid', 'match-hud');
    const top = el('div', 'mh-top', this.root);
    const side = (i: 0 | 1) => {
      const box = el('div', `mh-side mh-p${i + 1}`, top);
      const name = el('div', 'mh-name', box);
      const bar = el('div', 'mh-bar', box);
      const fill = el('div', 'mh-fill', bar);
      fill.setAttribute('data-testid', `health-p${i + 1}`);
      const pips = el('div', 'mh-pips', box);
      return { name, fill, pips };
    };
    const p1 = side(0);
    this.timer = el('div', 'mh-timer', top);
    this.timer.setAttribute('data-testid', 'match-timer');
    const p2 = side(1);
    this.fills = [p1.fill, p2.fill];
    this.names = [p1.name, p2.name];
    this.pips = [p1.pips, p2.pips];
    this.banner = el('div', 'mh-banner', this.root);
    this.banner.setAttribute('data-testid', 'match-banner');
    this.subBanner = el('div', 'mh-sub-banner', this.root);
  }

  update(view: MatchHudView): void {
    const key = JSON.stringify(view);
    if (key === this.last) return;
    this.last = key;
    for (const i of [0, 1] as const) {
      const ratio = Math.max(0, Math.min(1, view.health[i] / view.maxHealth));
      this.fills[i].style.width = `${(ratio * 100).toFixed(2)}%`;
      this.fills[i].dataset.health = String(view.health[i]);
      this.names[i].textContent = view.names[i];
      this.pips[i].textContent = '●'.repeat(Math.min(view.wins[i], view.roundsToWin)) + '○'.repeat(Math.max(0, view.roundsToWin - view.wins[i]));
    }
    this.timer.textContent = String(view.seconds);
    this.banner.textContent = view.banner ?? '';
    this.banner.hidden = view.banner === null;
    this.subBanner.textContent = view.subBanner ?? '';
    this.subBanner.hidden = view.subBanner === null;
  }

  dispose(): void {
    this.root.remove();
  }
}
