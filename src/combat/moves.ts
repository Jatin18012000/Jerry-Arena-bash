import { AttackButton, HIT_LEVELS, type HitLevel } from './types';

/**
 * Attack hitbox relative to the attacker's feet, measured along its facing:
 * `near`..`far` metres in front of the fighter's centre, `bottom`..`top` metres above its feet.
 * `depth` is the box's z thickness; it is only used for display (combat is 2.5D).
 */
export interface HitboxDefinition {
  readonly near: number;
  readonly far: number;
  readonly bottom: number;
  readonly top: number;
  readonly depth: number;
}

/** What a hit (not a block) does to the defender. */
export type HitReaction = 'stagger' | 'knockdown';

/**
 * Frame data for one attack. All durations are whole simulation frames at 60 Hz.
 *
 * Frame numbering (used everywhere): the step an attack starts on is frame 1.
 * - startup:  frames 1 .. startupFrames
 * - active:   frames startupFrames+1 .. startupFrames+activeFrames   (both inclusive)
 * - recovery: the next recoveryFrames frames
 * The attacker can act again on the step after the last recovery frame.
 * So a 5-frame-startup move can first hit on frame 6.
 */
export interface MoveDefinition {
  readonly id: string;
  readonly name: string;
  /** The attack button that performs this move. */
  readonly button: AttackButton;
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;
  /** Health removed on hit. Blocked attacks do no damage (no chip damage in Phase 3). */
  readonly damage: number;
  /** Frames the defender cannot act after being hit (counted after the hit frame). */
  readonly hitstunFrames: number;
  /** Frames the defender cannot act after blocking. */
  readonly blockstunFrames: number;
  readonly hitLevel: HitLevel;
  readonly hitbox: HitboxDefinition;
  readonly reaction: HitReaction;
  /** Metres the defender slides away on hit (ignored for knockdowns, which launch instead). */
  readonly hitPushback: number;
  /** Metres the defender slides away on block. */
  readonly blockPushback: number;
  /** Frames the whole simulation freezes on hit / on block. */
  readonly hitStopFrames: number;
  readonly blockStopFrames: number;
  /** Presentation only: screen-shake strength on hit, 0..1. Never affects the simulation. */
  readonly shake: number;
}

export type MoveSet = Readonly<Record<AttackButton, MoveDefinition>>;

export const totalFrames = (move: MoveDefinition): number =>
  move.startupFrames + move.activeFrames + move.recoveryFrames;

export type MoveStage = 'startup' | 'active' | 'recovery';

/** Which part of the move `frame` (1-based) falls in, or null outside the move. */
export function moveStageAt(move: MoveDefinition, frame: number): MoveStage | null {
  if (!Number.isInteger(frame) || frame < 1 || frame > totalFrames(move)) return null;
  if (frame <= move.startupFrames) return 'startup';
  if (frame <= move.startupFrames + move.activeFrames) return 'active';
  return 'recovery';
}

/** Frame advantage for the attacker when the first active frame connects (positive = attacker acts first). */
export function advantageOnHit(move: MoveDefinition): number | null {
  if (move.reaction === 'knockdown') return null;
  return move.hitstunFrames - (move.activeFrames - 1 + move.recoveryFrames);
}

export function advantageOnBlock(move: MoveDefinition): number {
  return move.blockstunFrames - (move.activeFrames - 1 + move.recoveryFrames);
}

/**
 * Provisional, generic system-test moves for the Phase 3 capsule fighters. NOT VERA's or REX's
 * move lists. Startup / active / recovery / damage are the Phase 3 baseline; stun, pushback and
 * hit-stop are tuned so each move reads differently:
 * - Light:   fast high jab, +3 on hit, -1 on block. Whiffs over crouching opponents.
 * - Heavy:   slower mid punch, more reach and pushback, -5 on block.
 * - Kick:    low sweep-height kick: only a crouching (low) guard blocks it.
 * - Special: short-range energy strike. Most damage and reach, knocks down on hit,
 *            but slow and very unsafe on block (-10).
 */
export const DEFAULT_MOVES: MoveSet = {
  light: {
    id: 'light',
    name: 'Light',
    button: AttackButton.Light,
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 10,
    damage: 40,
    hitstunFrames: 15,
    blockstunFrames: 11,
    hitLevel: 'high',
    hitbox: { near: 0.15, far: 0.95, bottom: 1.2, top: 1.6, depth: 0.4 },
    reaction: 'stagger',
    hitPushback: 0.35,
    blockPushback: 0.3,
    hitStopFrames: 6,
    blockStopFrames: 4,
    shake: 0.15,
  },
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    button: AttackButton.Heavy,
    startupFrames: 10,
    activeFrames: 4,
    recoveryFrames: 18,
    damage: 90,
    hitstunFrames: 22,
    blockstunFrames: 16,
    hitLevel: 'mid',
    hitbox: { near: 0.15, far: 1.15, bottom: 0.75, top: 1.35, depth: 0.5 },
    reaction: 'stagger',
    hitPushback: 0.7,
    blockPushback: 0.6,
    hitStopFrames: 10,
    blockStopFrames: 7,
    shake: 0.45,
  },
  kick: {
    id: 'kick',
    name: 'Kick',
    button: AttackButton.Kick,
    startupFrames: 8,
    activeFrames: 4,
    recoveryFrames: 15,
    damage: 65,
    hitstunFrames: 19,
    blockstunFrames: 14,
    hitLevel: 'low',
    hitbox: { near: 0.1, far: 1.2, bottom: 0.0, top: 0.45, depth: 0.4 },
    reaction: 'stagger',
    hitPushback: 0.55,
    blockPushback: 0.5,
    hitStopFrames: 8,
    blockStopFrames: 5,
    shake: 0.3,
  },
  special: {
    id: 'special',
    name: 'Energy Strike',
    button: AttackButton.Special,
    startupFrames: 14,
    activeFrames: 5,
    recoveryFrames: 24,
    damage: 120,
    hitstunFrames: 0,
    blockstunFrames: 18,
    hitLevel: 'mid',
    hitbox: { near: 0.2, far: 1.6, bottom: 0.4, top: 1.5, depth: 0.7 },
    reaction: 'knockdown',
    hitPushback: 0,
    blockPushback: 0.9,
    hitStopFrames: 14,
    blockStopFrames: 8,
    shake: 0.8,
  },
};

const isWholeFrames = (value: number, min: number): boolean => Number.isInteger(value) && value >= min;
const isFiniteAtLeast = (value: number, min: number): boolean => Number.isFinite(value) && value >= min;

/** Every problem with `move`, as readable messages. Empty means valid. */
export function moveProblems(move: MoveDefinition): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(`${move.id || '(no id)'}: ${message}`);
  };
  need(typeof move.id === 'string' && move.id.length > 0, 'id must be a non-empty string');
  need(typeof move.name === 'string' && move.name.length > 0, 'name must be a non-empty string');
  need((Object.values(AttackButton) as string[]).includes(move.button), `unknown button "${String(move.button)}"`);
  need(isWholeFrames(move.startupFrames, 1), 'startupFrames must be a whole number >= 1');
  need(isWholeFrames(move.activeFrames, 1), 'activeFrames must be a whole number >= 1');
  need(isWholeFrames(move.recoveryFrames, 0), 'recoveryFrames must be a whole number >= 0');
  need(isWholeFrames(move.hitstunFrames, 0), 'hitstunFrames must be a whole number >= 0');
  need(isWholeFrames(move.blockstunFrames, 0), 'blockstunFrames must be a whole number >= 0');
  need(isWholeFrames(move.hitStopFrames, 0), 'hitStopFrames must be a whole number >= 0');
  need(isWholeFrames(move.blockStopFrames, 0), 'blockStopFrames must be a whole number >= 0');
  need(isFiniteAtLeast(move.damage, 0), 'damage must be a finite number >= 0');
  need(isFiniteAtLeast(move.hitPushback, 0), 'hitPushback must be a finite number >= 0');
  need(isFiniteAtLeast(move.blockPushback, 0), 'blockPushback must be a finite number >= 0');
  need(isFiniteAtLeast(move.shake, 0) && move.shake <= 1, 'shake must be between 0 and 1');
  need(HIT_LEVELS.includes(move.hitLevel), `unknown hitLevel "${String(move.hitLevel)}"`);
  need(move.reaction === 'stagger' || move.reaction === 'knockdown', `unknown reaction "${String(move.reaction)}"`);
  need(move.reaction === 'knockdown' || move.hitstunFrames >= 1, 'a stagger move needs hitstunFrames >= 1');

  const box = move.hitbox;
  const finite = [box.near, box.far, box.bottom, box.top, box.depth].every(Number.isFinite);
  need(finite, 'hitbox values must be finite numbers');
  if (finite) {
    need(box.near >= 0, 'hitbox.near must be >= 0 (hitboxes start in front of the fighter)');
    need(box.far > box.near, 'hitbox.far must be greater than hitbox.near');
    need(box.bottom >= 0, 'hitbox.bottom must be >= 0');
    need(box.top > box.bottom, 'hitbox.top must be greater than hitbox.bottom');
    need(box.depth > 0, 'hitbox.depth must be > 0');
  }
  return problems;
}

/** Throws with every problem found, so bad data fails loudly at startup instead of mid-match. */
export function validateMoveSet(moves: MoveSet): void {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const button of Object.values(AttackButton)) {
    const move = moves[button];
    if (!move) {
      problems.push(`missing move for button "${button}"`);
      continue;
    }
    problems.push(...moveProblems(move));
    if (move.button !== button) problems.push(`${move.id}: registered under "${button}" but its button is "${move.button}"`);
    if (ids.has(move.id)) problems.push(`duplicate move id "${move.id}"`);
    ids.add(move.id);
  }
  if (problems.length > 0) throw new Error(`Invalid move set:\n- ${problems.join('\n- ')}`);
}
