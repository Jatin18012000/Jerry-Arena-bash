import type { FighterIntent } from '../fighters';

/** Attack buttons. Logical, like `InputAction`: controllers map devices or AI onto these. */
export const AttackButton = {
  Light: 'light',
  Heavy: 'heavy',
  Kick: 'kick',
  Special: 'special',
} as const;
export type AttackButton = (typeof AttackButton)[keyof typeof AttackButton];

/**
 * When several buffered presses are eligible on the same frame, the strongest wins
 * (see `InputBuffer.take`). Index 0 = highest priority.
 */
export const BUTTON_PRIORITY: readonly AttackButton[] = ['special', 'heavy', 'kick', 'light'];

/** Where an attack hits. Decides which guard stops it (see `blocking.ts`). */
export type HitLevel = 'high' | 'mid' | 'low';
export const HIT_LEVELS: readonly HitLevel[] = ['high', 'mid', 'low'];

/** Standing guard ('high') or crouching guard ('low'). */
export type GuardLevel = 'high' | 'low';

/**
 * What a fighter wants to do this fixed step: Phase 2 movement intent plus combat buttons.
 * Produced by controllers (keyboard, training dummy, future CPU); the simulation reads nothing else.
 */
export interface FighterInput {
  readonly intent: FighterIntent;
  /** Attack buttons newly pressed this step (edge-triggered). Order is irrelevant. */
  readonly pressed: readonly AttackButton[];
  /** Guard held this step, or null. If both are held the controller reports 'low'. */
  readonly guard: GuardLevel | null;
}

/**
 * A combat volume on the 2.5D fight plane, in world metres. Boxes are open intervals:
 * touching edges do not overlap. Combat ignores z (both fighters are always on z = 0).
 */
export interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** Index of a fighter in the fixed [P1, P2] order. */
export type FighterIndex = 0 | 1;
