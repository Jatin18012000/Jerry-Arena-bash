import type { AttackButton } from '../combat/types';

/**
 * Animation clip names every fighter GLB must contain. Mirrors the clip contract in
 * blender/scripts/brl_anim.py (checked by tests against the exported assets).
 */
export const Clip = {
  Idle: 'idle',
  WalkForward: 'walk_forward',
  WalkBack: 'walk_back',
  Crouch: 'crouch',
  Jump: 'jump',
  GuardHigh: 'guard_high',
  GuardLow: 'guard_low',
  HitHigh: 'hit_high',
  HitCrouch: 'hit_crouch',
  Launched: 'launched',
  Knockdown: 'knockdown',
  Getup: 'getup',
  Ko: 'ko',
  Victory: 'victory',
  AttackLight: 'attack_light',
  AttackHeavy: 'attack_heavy',
  AttackKick: 'attack_kick',
  AttackSpecial: 'attack_special',
} as const;
export type ClipName = (typeof Clip)[keyof typeof Clip];

export const REQUIRED_CLIPS: readonly ClipName[] = Object.values(Clip);

/** Clips that loop; everything else plays once and holds its last frame. */
export const LOOPING_CLIPS: ReadonlySet<ClipName> = new Set<ClipName>([
  Clip.Idle,
  Clip.WalkForward,
  Clip.WalkBack,
  Clip.Crouch,
  Clip.GuardHigh,
  Clip.GuardLow,
  Clip.Knockdown,
  Clip.Victory,
]);

export const attackClip = (button: AttackButton): ClipName => `attack_${button}` as ClipName;
