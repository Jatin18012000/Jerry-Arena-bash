import type { Side } from '../fighters';
import type { GuardLevel, HitLevel } from './types';

/**
 * Which guard stops which attack. Data, so the rules can be retuned in one place.
 *
 * Phase 3 baseline (as specified): a standing (high) guard loses only to low attacks; a crouching
 * (low) guard blocks everything. Note this makes the low guard strictly safer for now — standing
 * guard's only advantage is that it is not a crouching posture. Overheads (mids that a low guard
 * cannot block) are the planned counterpart; see docs/COMBAT_SYSTEM.md.
 */
export const BLOCK_RULES: Readonly<Record<HitLevel, Readonly<Record<GuardLevel, boolean>>>> = {
  high: { high: true, low: true },
  mid: { high: true, low: true },
  low: { high: false, low: true },
};

export function guardStops(guard: GuardLevel, level: HitLevel): boolean {
  return BLOCK_RULES[level][guard];
}

/**
 * Directional defence: a guard only covers the side the defender faces. An attacker exactly level
 * with the defender counts as in front.
 */
export function attackIsInFront(defenderX: number, defenderFacing: Side, attackerX: number): boolean {
  const dx = attackerX - defenderX;
  return dx === 0 || Math.sign(dx) === defenderFacing;
}
