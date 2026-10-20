import type { Rapier } from '../physics';
import { DEFAULT_MATCH_CONFIG, type MatchConfig } from './config';
import { CombatSimulation, type CombatEvent, type CombatSimulationOptions } from './CombatSimulation';
import { IDLE_INPUT } from './controllers';
import type { FighterIndex, FighterInput } from './types';

/**
 * - intro      "ROUND n" / "FIGHT": fighters reset, no control
 * - fight      control, round timer running
 * - roundOver  KO or time-out: no control; fighters finish falling
 * - matchOver  a fighter (or both: draw) reached the round wins needed
 */
export type MatchPhase = 'intro' | 'fight' | 'roundOver' | 'matchOver';

export type RoundEndReason = 'ko' | 'doubleKo' | 'timeout';

export interface RoundResult {
  readonly round: number;
  /** null = draw (double KO, or equal health at time-out): both fighters are awarded the round. */
  readonly winner: FighterIndex | null;
  readonly reason: RoundEndReason;
}

export type MatchWinner = FighterIndex | 'draw';

export type MatchEvent =
  | CombatEvent
  | { readonly type: 'roundStart'; readonly round: number }
  | { readonly type: 'fight'; readonly round: number }
  | { readonly type: 'roundEnd'; readonly result: RoundResult }
  | { readonly type: 'matchEnd'; readonly winner: MatchWinner };

export interface MatchOptions extends CombatSimulationOptions {
  match?: MatchConfig;
}

const NO_CONTROL: readonly [FighterInput, FighterInput] = [IDLE_INPUT, IDLE_INPUT];

/**
 * Round and match flow around `CombatSimulation`: best-of-three, round timer, KO and time-out.
 * Deterministic and headless like the simulation it wraps. The timer and phase clocks only run on
 * steps where combat advanced, so hit-stop freezes them too.
 */
export class Match {
  readonly combat: CombatSimulation;
  readonly config: MatchConfig;
  /** Events from the latest `step` (combat events first, then match events). */
  readonly events: MatchEvent[] = [];

  phase: MatchPhase = 'intro';
  /** Advanced frames spent in the current phase. */
  phaseFrame = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  /** Round timer in simulation frames. */
  timerFrames = 0;
  lastResult: RoundResult | null = null;
  winner: MatchWinner | null = null;

  constructor(rapier: Rapier, options: MatchOptions = {}) {
    this.config = options.match ?? DEFAULT_MATCH_CONFIG;
    this.combat = new CombatSimulation(rapier, options);
    this.startRound();
  }

  /** Whole seconds left on the round clock (rounded up, as displayed). */
  get secondsLeft(): number {
    return Math.ceil(this.timerFrames / this.config.stepsPerSecond);
  }

  get controlsEnabled(): boolean {
    return this.phase === 'fight';
  }

  step(dt: number, inputs: readonly [FighterInput, FighterInput]): void {
    this.events.length = 0;
    const advanced = this.combat.step(dt, this.controlsEnabled ? inputs : NO_CONTROL);
    this.events.push(...this.combat.events);
    if (!advanced) return;

    this.phaseFrame++;
    switch (this.phase) {
      case 'intro':
        if (this.phaseFrame >= this.config.introFrames) {
          this.enter('fight');
          this.events.push({ type: 'fight', round: this.round });
        }
        break;
      case 'fight': {
        const [h1, h2] = this.combat.states.map((s) => s.health);
        if (h1 === 0 || h2 === 0) {
          this.endRound(h1 === 0 && h2 === 0 ? null : h1 === 0 ? 1 : 0, h1 === 0 && h2 === 0 ? 'doubleKo' : 'ko');
          break;
        }
        this.timerFrames--;
        if (this.timerFrames <= 0) {
          this.timerFrames = 0;
          this.endRound(h1 === h2 ? null : h1! > h2! ? 0 : 1, 'timeout');
        }
        break;
      }
      case 'roundOver':
        if (this.phaseFrame >= this.config.roundOverFrames) {
          if (this.winner !== null) {
            this.enter('matchOver');
            this.events.push({ type: 'matchEnd', winner: this.winner });
          } else {
            this.round++;
            this.startRound();
          }
        }
        break;
      case 'matchOver':
        break;
    }
  }

  /** Start a new match from round 1. */
  restart(): void {
    this.round = 1;
    this.wins = [0, 0];
    this.lastResult = null;
    this.winner = null;
    this.startRound();
  }

  dispose(): void {
    this.combat.dispose();
  }

  private startRound(): void {
    this.combat.resetRound();
    this.timerFrames = this.config.roundSeconds * this.config.stepsPerSecond;
    this.enter('intro');
    this.events.push({ type: 'roundStart', round: this.round });
  }

  private endRound(winner: FighterIndex | null, reason: RoundEndReason): void {
    this.enter('roundOver');
    this.combat.clearBuffers();
    if (winner === null) {
      this.wins[0]++;
      this.wins[1]++;
    } else {
      this.wins[winner]++;
    }
    const result: RoundResult = { round: this.round, winner, reason };
    this.lastResult = result;
    const need = this.config.roundsToWin;
    const p1Done = this.wins[0] >= need;
    const p2Done = this.wins[1] >= need;
    this.winner = p1Done && p2Done ? 'draw' : p1Done ? 0 : p2Done ? 1 : null;
    this.events.push({ type: 'roundEnd', result });
  }

  private enter(phase: MatchPhase): void {
    this.phase = phase;
    this.phaseFrame = 0;
    this.combat.hitsEnabled = phase === 'fight';
  }
}
