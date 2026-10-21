import type { FighterCombatState } from '../combat/FighterCombat';
import type { MotionState } from '../fighters';
import { Clip, attackClip, type ClipName } from './clips';

/**
 * How a clip should be played:
 * - loop:       free-running, advanced by time (idle, walks, guards)
 * - once:       played from the start when entered, then holds (jump, launch, KO fall)
 * - frame:      pinned to an exact clip time from the simulation (attacks: move frame f → (f-1)/60)
 * - normalized: pinned to a fraction 0..1 of the clip (stun and get-up, whose length varies)
 */
export type PoseRequest =
  | { readonly clip: ClipName; readonly mode: 'loop' | 'once'; readonly fade: number }
  | { readonly clip: ClipName; readonly mode: 'frame'; readonly time: number; readonly fade: number }
  | { readonly clip: ClipName; readonly mode: 'normalized'; readonly progress: number; readonly fade: number };

export interface PoseContext {
  /** Simulation steps per second (60): converts combat frames to clip time. */
  readonly stepsPerSecond: number;
  /** Play the victory loop instead of idle (round / match won). */
  readonly victory?: boolean;
}

/** Cross-fade times in seconds: attacks snap in so frame data stays readable. */
const FADE_ATTACK = 0.04;
const FADE_REACTION = 0.06;
const FADE_DEFAULT = 0.12;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * Pick the animation for a fighter from simulation state only. Pure and deterministic: the
 * animation layer never feeds back into combat, and attacks are pinned to the combat frame so
 * what you see is exactly what the frame data says.
 */
export function selectPose(state: FighterCombatState, motion: MotionState, ctx: PoseContext): PoseRequest {
  switch (state.phase) {
    case 'attack': {
      const move = state.move!;
      return { clip: attackClip(move.button), mode: 'frame', time: (state.frame - 1) / ctx.stepsPerSecond, fade: FADE_ATTACK };
    }
    case 'hitstun':
      return {
        clip: state.crouching ? Clip.HitCrouch : Clip.HitHigh,
        mode: 'normalized',
        progress: clamp01(state.frame / Math.max(1, state.duration)),
        fade: FADE_REACTION,
      };
    case 'blockstun':
    case 'guard':
      return { clip: state.guardLevel === 'low' ? Clip.GuardLow : Clip.GuardHigh, mode: 'loop', fade: FADE_REACTION };
    case 'launched':
      return { clip: Clip.Launched, mode: 'once', fade: FADE_REACTION };
    case 'knockdown':
      return { clip: Clip.Knockdown, mode: 'loop', fade: FADE_DEFAULT };
    case 'getup':
      return { clip: Clip.Getup, mode: 'normalized', progress: clamp01(state.frame / Math.max(1, state.duration)), fade: FADE_REACTION };
    case 'ko':
      return motion.grounded
        ? { clip: Clip.Ko, mode: 'once', fade: FADE_DEFAULT }
        : { clip: Clip.Launched, mode: 'once', fade: FADE_REACTION };
    case 'neutral':
      if (!motion.grounded) return { clip: Clip.Jump, mode: 'once', fade: FADE_REACTION };
      switch (motion.posture) {
        case 'crouch':
          return { clip: Clip.Crouch, mode: 'loop', fade: FADE_REACTION };
        case 'walkForward':
          return { clip: Clip.WalkForward, mode: 'loop', fade: FADE_DEFAULT };
        case 'walkBack':
          return { clip: Clip.WalkBack, mode: 'loop', fade: FADE_DEFAULT };
        default:
          return { clip: ctx.victory ? Clip.Victory : Clip.Idle, mode: 'loop', fade: FADE_DEFAULT };
      }
  }
}
