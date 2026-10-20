import type { Side } from '../fighters';
import type { CombatConfig } from './config';
import { totalFrames, type MoveDefinition } from './moves';
import type { FighterIndex, GuardLevel } from './types';

/**
 * Combat phase of one fighter. Layered on top of the Phase 2 movement posture
 * (stand / walk / crouch / air), which keeps describing the body.
 *
 * - neutral   free movement (walk, jump, crouch); can attack or guard
 * - guard     holding a block button on the ground (high = standing, low = crouching); cannot walk
 * - attack    performing a move (startup → active → recovery); facing locked
 * - hitstun   was hit; cannot act for `duration` frames
 * - blockstun blocked a hit; cannot act, but keeps guarding (may switch guard level)
 * - launched  knocked into the air by a knockdown hit; no hurtbox (no juggles yet)
 * - knockdown lying on the floor after landing; no hurtbox
 * - getup     standing back up; no hurtbox
 * - ko        out of health; stays down for the rest of the round
 */
export type CombatPhase =
  | 'neutral'
  | 'guard'
  | 'attack'
  | 'hitstun'
  | 'blockstun'
  | 'launched'
  | 'knockdown'
  | 'getup'
  | 'ko';

/** Pushback still to apply: `perFrame` metres per frame in `direction`, for `remaining` frames. */
export interface Pushback {
  perFrame: number;
  remaining: number;
  direction: Side;
  /** The attacker; it absorbs whatever the defender cannot move because of a wall. */
  source: FighterIndex;
}

export interface FighterCombatState {
  phase: CombatPhase;
  /**
   * Attack: the 1-based move frame (see `MoveDefinition`). Stun-type phases: frames elapsed
   * since entering (0 on the frame of the hit). Others: frames spent in the phase.
   */
  frame: number;
  /** Length of hitstun / blockstun / knockdown / getup; 0 for other phases. */
  duration: number;
  move: MoveDefinition | null;
  /** Increments every time an attack starts: identifies the attack instance. */
  attackSerial: number;
  /** This attack instance already connected (hit or blocked) and cannot connect again. */
  attackConnected: boolean;
  /** Current guard (while guarding) or the guard in use when blockstun began. */
  guardLevel: GuardLevel;
  /** Hit while crouching: stays crouched (and keeps the crouch hurtbox) through hitstun. */
  crouching: boolean;
  health: number;
  pushback: Pushback | null;
}

export function createCombatState(maxHealth: number): FighterCombatState {
  return {
    phase: 'neutral',
    frame: 0,
    duration: 0,
    move: null,
    attackSerial: 0,
    attackConnected: false,
    guardLevel: 'high',
    crouching: false,
    health: maxHealth,
    pushback: null,
  };
}

/** Can start an attack or change guard this frame. */
export const isActionable = (s: FighterCombatState): boolean => s.phase === 'neutral' || s.phase === 'guard';

/** Has no hurtbox. */
export const isInvulnerable = (s: FighterCombatState): boolean =>
  s.phase === 'launched' || s.phase === 'knockdown' || s.phase === 'getup' || s.phase === 'ko';

/** Is currently able to block an incoming attack (direction and level are checked separately). */
export const isGuarding = (s: FighterCombatState): boolean => s.phase === 'guard' || s.phase === 'blockstun';

export function toNeutral(s: FighterCombatState): void {
  s.phase = 'neutral';
  s.frame = 0;
  s.duration = 0;
  s.move = null;
  s.crouching = false;
}

export function startAttack(s: FighterCombatState, move: MoveDefinition): void {
  s.phase = 'attack';
  s.frame = 1;
  s.duration = totalFrames(move);
  s.move = move;
  s.attackSerial++;
  s.attackConnected = false;
}

/** Enter a stun-type phase on the frame of the hit (frame 0; the first stunned frame is the next one). */
export function enterStun(s: FighterCombatState, phase: 'hitstun' | 'blockstun' | 'knockdown', duration: number): void {
  s.phase = phase;
  s.frame = 0;
  s.duration = duration;
  s.move = null;
}

/**
 * Advance the phase clock by one combat frame, ending phases whose time is up.
 * Landing from a launch is handled separately, after movement.
 */
export function advancePhase(s: FighterCombatState, config: CombatConfig): void {
  s.frame++;
  switch (s.phase) {
    case 'attack':
      if (s.frame > s.duration) toNeutral(s);
      break;
    case 'hitstun':
    case 'blockstun':
    case 'getup':
      if (s.frame > s.duration) toNeutral(s);
      break;
    case 'knockdown':
      if (s.frame > s.duration) {
        s.phase = 'getup';
        s.frame = 1;
        s.duration = config.getupFrames;
      }
      break;
    default:
      break;
  }
}
