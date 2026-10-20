/**
 * Placeholder fighter tuning shared by both Phase 2 capsule fighters. Every value is a tunable
 * placeholder; real fighters (VERA, REX, ...) will supply their own. Units: metres, seconds.
 *
 * Three separate volumes, on purpose:
 * - environment collider (radius / halfHeight): Rapier capsule for floor and walls only;
 * - pushbox (pushHalfWidth / pushHeight): deterministic fighter-vs-fighter spacing;
 * - combat hit/hurt boxes: NOT defined here. They are separate per-move / per-posture data in
 *   src/combat/ (Phase 3), independent of the Rapier collider (which does not shrink when crouching).
 */
export interface FighterBody {
  /** Environment capsule radius; also the distance the fighter keeps from stage walls. */
  readonly radius: number;
  /** Half the length of the capsule's straight section. Total height = 2 * (halfHeight + radius). */
  readonly halfHeight: number;
  /** Half-width of the pushbox that keeps the two fighters apart. */
  readonly pushHalfWidth: number;
  /**
   * Height of the pushbox above the feet. Deliberately shorter than the body (1.0 m vs 1.8 m),
   * as in most fighting games, so a point-blank forward jump carries a fighter over the
   * opponent's pushbox (cross-up). Tune against the real fighters; see docs/COMBAT_SYSTEM.md.
   */
  readonly pushHeight: number;
}

export interface FighterMotionParams {
  readonly walkForwardSpeed: number;
  readonly walkBackSpeed: number;
  /** Initial upward speed of a jump. */
  readonly jumpVelocity: number;
  /** Horizontal speed of a forward / backward jump, fixed at take-off. */
  readonly jumpForwardSpeed: number;
  readonly jumpBackSpeed: number;
  /** Downward acceleration (positive). Higher than real gravity for snappy fighting-game arcs. */
  readonly gravity: number;
  /** Fastest the fighter can fall. */
  readonly maxFallSpeed: number;
}

export interface FighterConfig {
  readonly body: FighterBody;
  readonly motion: FighterMotionParams;
}

export const PLACEHOLDER_FIGHTER: FighterConfig = {
  body: { radius: 0.3, halfHeight: 0.6, pushHalfWidth: 0.35, pushHeight: 1.0 },
  motion: {
    walkForwardSpeed: 2.4,
    walkBackSpeed: 1.8,
    // Apex ≈ v²/2g ≈ 1.72 m (clears a standing opponent), airtime ≈ 2v/g ≈ 0.66 s (≈ 39 frames).
    jumpVelocity: 10.5,
    jumpForwardSpeed: 2.8,
    jumpBackSpeed: 2.4,
    gravity: 32,
    maxFallSpeed: 20,
  },
};

export function fighterHeight(body: FighterBody): number {
  return 2 * (body.halfHeight + body.radius);
}
