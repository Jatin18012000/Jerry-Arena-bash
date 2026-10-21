import { NEUTRAL_INTENT, PLACEHOLDER_FIGHTER, type Fighter, type FighterConfig, type FighterIntent, type PlanOptions } from '../fighters';
import type { Rapier } from '../physics';
import { SandboxSimulation } from '../sandbox/SandboxSimulation';
import { attackIsInFront, guardStops } from './blocking';
import { contactPoint, hitboxWorld, hurtboxWorld, overlaps } from './boxes';
import { DEFAULT_COMBAT_CONFIG, type CombatConfig } from './config';
import {
  advancePhase,
  createCombatState,
  enterStun,
  isActionable,
  isGuarding,
  isInvulnerable,
  startAttack,
  toNeutral,
  type FighterCombatState,
} from './FighterCombat';
import { InputBuffer } from './InputBuffer';
import { DEFAULT_MOVES, moveStageAt, validateMoveSet, type MoveDefinition, type MoveSet } from './moves';
import type { Box, FighterIndex, FighterInput } from './types';

/** Simulation → presentation messages. Emitted during `step`, valid until the next `step`. */
export type CombatEvent =
  | {
      readonly type: 'hit';
      readonly attacker: FighterIndex;
      readonly defender: FighterIndex;
      readonly move: string;
      readonly damage: number;
      readonly point: { readonly x: number; readonly y: number };
      readonly knockdown: boolean;
      readonly ko: boolean;
      readonly shake: number;
    }
  | {
      readonly type: 'block';
      readonly attacker: FighterIndex;
      readonly defender: FighterIndex;
      readonly move: string;
      readonly point: { readonly x: number; readonly y: number };
    };

/** The most recent hit or block, and when each side could act again (for the frame-data readout). */
export interface Exchange {
  readonly attacker: FighterIndex;
  readonly defender: FighterIndex;
  readonly move: MoveDefinition;
  readonly result: 'hit' | 'block';
  readonly frame: number;
  attackerReadyAt: number | null;
  defenderReadyAt: number | null;
}

/** Measured frame advantage of an exchange for the attacker, once both sides can act again. */
export function exchangeAdvantage(ex: Exchange): number | null {
  if (ex.attackerReadyAt === null || ex.defenderReadyAt === null) return null;
  return ex.defenderReadyAt - ex.attackerReadyAt;
}

/** Per-fighter data a match needs (Phase 4: built from a `CharacterDefinition`). */
export interface FighterSetup {
  readonly config: FighterConfig;
  readonly moves: MoveSet;
  readonly maxHealth: number;
}

export interface CombatSimulationOptions {
  /** Move set for both fighters when `fighters` is not given (Phase 3 behaviour). */
  moves?: MoveSet;
  config?: CombatConfig;
  /** Per-fighter body, movement, moves and health (e.g. VERA vs REX). */
  fighters?: readonly [FighterSetup, FighterSetup];
}

interface PendingHit {
  readonly attacker: FighterIndex;
  readonly defender: FighterIndex;
  readonly move: MoveDefinition;
  readonly point: { x: number; y: number };
  readonly blocked: boolean;
}

const INDICES: readonly FighterIndex[] = [0, 1];
const other = (i: FighterIndex): FighterIndex => (i === 0 ? 1 : 0);

/**
 * Deterministic, frame-based 1v1 combat layered on the Phase 2 movement simulation.
 *
 * One `step` per fixed game step. Order inside a step (both fighters always processed P1 then P2,
 * and every decision within a stage reads the same start-of-stage snapshot, so the order never
 * changes the outcome):
 *
 *  0. Hit-stop: if frozen, only record new presses, hold fighters still and return.
 *  1. Advance the combat frame.
 *  2. Record new presses into each input buffer; drop expired presses.
 *  3. Advance combat phases (attack frames, stun timers, knockdown → getup → neutral).
 *  4. Actionable, grounded fighters take a buffered attack, or enter / leave guard.
 *  5. Movement: the existing `SandboxSimulation.step` (motion → stage → pushboxes), fed with
 *     combat-filtered intents, locked facing and pushback (with wall transfer to the attacker).
 *  6. Launched fighters that landed are knocked down.
 *  7. Hit detection on the post-movement snapshot: active hitboxes vs hurtboxes (skipped while
 *     `hitsEnabled` is false).
 *  8. Resolve all hits together (simultaneous hits trade), start hit-stop, emit events.
 *
 * Hit detection uses only combat boxes and integer frames — never Rapier contacts, wall-clock
 * time or randomness.
 */
export class CombatSimulation {
  readonly movement: SandboxSimulation;
  /** Each fighter's move set, in [P1, P2] order. */
  readonly moveSets: readonly [MoveSet, MoveSet];
  /** Each fighter's starting health, in [P1, P2] order. */
  readonly maxHealth: readonly [number, number];
  readonly config: CombatConfig;
  readonly states: readonly [FighterCombatState, FighterCombatState];
  readonly buffers: readonly [InputBuffer, InputBuffer];
  /** Events from the latest `step`. */
  readonly events: CombatEvent[] = [];
  /** Combat frames simulated. Does not advance during hit-stop. */
  frame = 0;
  /** Steps left in the current hit-stop freeze. */
  hitstop = 0;
  lastExchange: Exchange | null = null;
  /**
   * When false, attacks still play out but cannot connect (set by `Match` outside the fight
   * phase, so a move still in progress after a time-out cannot change health after the result).
   */
  hitsEnabled = true;

  constructor(rapier: Rapier, options: CombatSimulationOptions = {}) {
    this.config = options.config ?? DEFAULT_COMBAT_CONFIG;
    const shared: FighterSetup = {
      config: PLACEHOLDER_FIGHTER,
      moves: options.moves ?? DEFAULT_MOVES,
      maxHealth: this.config.maxHealth,
    };
    const [a, b] = options.fighters ?? [shared, shared];
    this.moveSets = [a.moves, b.moves];
    for (const moves of this.moveSets) validateMoveSet(moves);
    this.maxHealth = [a.maxHealth, b.maxHealth];
    this.movement = new SandboxSimulation(rapier, [a.config, b.config]);
    this.states = [createCombatState(a.maxHealth), createCombatState(b.maxHealth)];
    this.buffers = [new InputBuffer(this.config.inputBufferFrames), new InputBuffer(this.config.inputBufferFrames)];
  }

  get fighters(): readonly [Fighter, Fighter] {
    return this.movement.fighters;
  }

  /**
   * Advance one fixed step. Returns false if the step was a hit-stop freeze (nothing but input
   * recording happened), true otherwise.
   */
  step(dt: number, inputs: readonly [FighterInput, FighterInput]): boolean {
    this.events.length = 0;

    if (this.hitstop > 0) {
      this.hitstop--;
      // Presses made during the freeze count from the first frame after it.
      for (const i of INDICES) this.record(i, inputs[i], this.frame + 1);
      for (const f of this.fighters) f.hold();
      return false;
    }

    this.frame++;
    for (const i of INDICES) {
      this.record(i, inputs[i], this.frame);
      this.buffers[i].prune(this.frame);
    }
    for (const s of this.states) advancePhase(s, this.config);
    this.trackExchange();
    for (const i of INDICES) this.act(i, inputs[i]);

    const pushX = this.pushbackThisFrame();
    const plans: [PlanOptions, PlanOptions] = [
      { lockFacing: !isActionable(this.states[0]), pushX: pushX[0] },
      { lockFacing: !isActionable(this.states[1]), pushX: pushX[1] },
    ];
    this.movement.step(dt, this.intentFor(0, inputs[0]), this.intentFor(1, inputs[1]), plans);

    for (const i of INDICES) {
      const s = this.states[i];
      if (s.phase === 'launched' && this.fighters[i].motion.grounded) enterStun(s, 'knockdown', this.config.knockdownFrames);
    }

    if (this.hitsEnabled) this.resolveHits(this.detectHits());
    return true;
  }

  /** World hurtbox of fighter `i`, or null while it cannot be hit. */
  hurtbox(i: FighterIndex): Box | null {
    const s = this.states[i];
    if (isInvulnerable(s)) return null;
    const f = this.fighters[i];
    const { hurtboxes } = this.config;
    const def = !f.motion.grounded ? hurtboxes.air : f.motion.posture === 'crouch' ? hurtboxes.crouch : hurtboxes.stand;
    return hurtboxWorld(def, f.x, f.y);
  }

  /** World hitbox of fighter `i` while its attack is in its active frames, else null. */
  hitbox(i: FighterIndex): Box | null {
    const s = this.states[i];
    if (s.phase !== 'attack' || !s.move || moveStageAt(s.move, s.frame) !== 'active') return null;
    const f = this.fighters[i];
    return hitboxWorld(s.move.hitbox, f.x, f.y, f.motion.facing);
  }

  clearBuffers(): void {
    for (const b of this.buffers) b.clear();
  }

  /** Start a fresh round: spawn positions (or the given X), full health, empty buffers. */
  resetRound(p1X?: number, p2X?: number): void {
    this.movement.resetPositions(p1X, p2X);
    for (const i of INDICES) Object.assign(this.states[i], createCombatState(this.maxHealth[i]));
    this.clearBuffers();
    this.hitstop = 0;
    this.lastExchange = null;
    this.events.length = 0;
  }

  dispose(): void {
    this.movement.dispose();
  }

  private record(i: FighterIndex, input: FighterInput, frame: number): void {
    for (const button of input.pressed) this.buffers[i].record(button, frame);
  }

  private act(i: FighterIndex, input: FighterInput): void {
    const s = this.states[i];
    if (s.phase === 'blockstun' && input.guard) s.guardLevel = input.guard;
    if (!isActionable(s)) return;

    if (!this.fighters[i].motion.grounded) {
      // No air attacks or air blocking yet: presses stay buffered and can come out on landing.
      if (s.phase === 'guard') toNeutral(s);
      return;
    }
    const button = this.buffers[i].take(this.frame);
    if (button) {
      startAttack(s, this.moveSets[i][button]);
    } else if (input.guard) {
      if (s.phase !== 'guard') {
        s.phase = 'guard';
        s.frame = 0;
      }
      s.guardLevel = input.guard;
    } else if (s.phase === 'guard') {
      toNeutral(s);
    }
  }

  /** Movement intent after combat rules: only neutral fighters move freely. */
  private intentFor(i: FighterIndex, input: FighterInput): FighterIntent {
    const s = this.states[i];
    switch (s.phase) {
      case 'neutral':
        return input.intent;
      case 'guard':
      case 'blockstun':
        return s.guardLevel === 'low' ? { ...NEUTRAL_INTENT, crouch: true } : NEUTRAL_INTENT;
      case 'hitstun':
        return s.crouching ? { ...NEUTRAL_INTENT, crouch: true } : NEUTRAL_INTENT;
      default:
        return NEUTRAL_INTENT;
    }
  }

  /**
   * This frame's pushback per fighter. A defender against a wall cannot slide, so the attacker
   * slides back by the remainder instead (standard corner rule).
   */
  private pushbackThisFrame(): [number, number] {
    const pushX: [number, number] = [0, 0];
    const { minX, maxX } = this.movement.spacing;
    for (const i of INDICES) {
      const p = this.states[i].pushback;
      if (!p) continue;
      const x = this.fighters[i].x;
      const room = Math.max(0, p.direction > 0 ? maxX - x : x - minX);
      const own = Math.min(p.perFrame, room);
      pushX[i] += p.direction * own;
      pushX[p.source] -= p.direction * (p.perFrame - own);
      p.remaining--;
      if (p.remaining <= 0) this.states[i].pushback = null;
    }
    return pushX;
  }

  private detectHits(): PendingHit[] {
    const hits: PendingHit[] = [];
    for (const i of INDICES) {
      const s = this.states[i];
      if (s.attackConnected || !s.move) continue;
      const hitbox = this.hitbox(i);
      const d = other(i);
      const hurtbox = this.hurtbox(d);
      if (!hitbox || !hurtbox || !overlaps(hitbox, hurtbox)) continue;
      // Block decision reads the defender's state before any of this frame's hits are applied.
      const defender = this.states[d];
      const fd = this.fighters[d];
      const blocked =
        isGuarding(defender) &&
        fd.motion.grounded &&
        attackIsInFront(fd.x, fd.motion.facing, this.fighters[i].x) &&
        guardStops(defender.guardLevel, s.move.hitLevel);
      hits.push({ attacker: i, defender: d, move: s.move, point: contactPoint(hitbox, hurtbox), blocked });
    }
    return hits;
  }

  /**
   * Apply every hit found this frame. Simultaneous policy: both fighters' hits were detected on
   * the same snapshot, so if both connect they trade — both are hit, regardless of P1/P2 order.
   */
  private resolveHits(hits: readonly PendingHit[]): void {
    let stop = 0;
    for (const hit of hits) {
      const a = this.states[hit.attacker];
      const d = this.states[hit.defender];
      const fa = this.fighters[hit.attacker];
      const fd = this.fighters[hit.defender];
      const { move } = hit;
      const direction = fa.motion.facing;
      a.attackConnected = true;

      if (hit.blocked) {
        enterStun(d, 'blockstun', move.blockstunFrames);
        d.pushback = this.makePushback(move.blockPushback, direction, hit.attacker);
        stop = Math.max(stop, move.blockStopFrames);
        this.events.push({ type: 'block', attacker: hit.attacker, defender: hit.defender, move: move.id, point: hit.point });
        continue;
      }

      d.health = Math.max(0, d.health - move.damage);
      d.attackConnected = false;
      d.pushback = null;
      const ko = d.health === 0;
      const knockdown = !ko && (move.reaction === 'knockdown' || !fd.motion.grounded);
      if (ko) {
        enterStun(d, 'knockdown', 0);
        d.phase = 'ko';
        fd.launch(this.config.koLaunchVelocityY, direction * this.config.koLaunchVelocityX);
        this.buffers[hit.defender].clear();
      } else if (knockdown) {
        enterStun(d, 'knockdown', 0);
        d.phase = 'launched';
        fd.launch(this.config.launchVelocityY, direction * this.config.launchVelocityX);
      } else {
        d.crouching = fd.motion.posture === 'crouch';
        enterStun(d, 'hitstun', move.hitstunFrames);
        d.pushback = this.makePushback(move.hitPushback, direction, hit.attacker);
      }
      stop = Math.max(stop, move.hitStopFrames);
      this.events.push({
        type: 'hit',
        attacker: hit.attacker,
        defender: hit.defender,
        move: move.id,
        damage: move.damage,
        point: hit.point,
        knockdown,
        ko,
        shake: move.shake,
      });
    }

    if (hits.length === 1) {
      const hit = hits[0]!;
      this.lastExchange = {
        attacker: hit.attacker,
        defender: hit.defender,
        move: hit.move,
        result: hit.blocked ? 'block' : 'hit',
        frame: this.frame,
        attackerReadyAt: null,
        defenderReadyAt: null,
      };
    } else if (hits.length > 1) {
      this.lastExchange = null; // a trade has no single attacker
    }
    this.hitstop = Math.max(this.hitstop, stop);
  }

  private makePushback(distance: number, direction: 1 | -1, source: FighterIndex) {
    const frames = this.config.pushbackFrames;
    return distance > 0 ? { perFrame: distance / frames, remaining: frames, direction, source } : null;
  }

  /** Record the first frame each side of the last exchange could act again. */
  private trackExchange(): void {
    const ex = this.lastExchange;
    if (!ex) return;
    if (ex.attackerReadyAt === null && isActionable(this.states[ex.attacker])) ex.attackerReadyAt = this.frame;
    if (ex.defenderReadyAt === null && isActionable(this.states[ex.defender])) ex.defenderReadyAt = this.frame;
  }
}
