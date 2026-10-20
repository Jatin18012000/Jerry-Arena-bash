/** Hurtbox for one posture, relative to the fighter's feet: centred on its x, `bottom`..`top` metres up. */
export interface HurtboxDefinition {
  readonly halfWidth: number;
  readonly bottom: number;
  readonly top: number;
}

export interface HurtboxSet {
  /** Standing, walking, standing guard, standing hitstun, attacking. */
  readonly stand: HurtboxDefinition;
  /** Crouching, crouching guard, crouching hitstun. Lower: high attacks pass over it. */
  readonly crouch: HurtboxDefinition;
  /** Jumping (not launched). Relative to the airborne feet position. */
  readonly air: HurtboxDefinition;
}

/**
 * Combat rules shared by both placeholder fighters. All values are tunable placeholders;
 * frame counts are whole 60 Hz simulation frames, distances metres, speeds metres/second.
 */
export interface CombatConfig {
  readonly maxHealth: number;
  /** A press can still come out this many frames after it was made (including the press frame). */
  readonly inputBufferFrames: number;
  /** Hit/block pushback is spread evenly over this many frames after the hit. */
  readonly pushbackFrames: number;
  /** Launch arc for knockdown hits (and any hit on an airborne fighter). */
  readonly launchVelocityY: number;
  readonly launchVelocityX: number;
  /** Launch arc for the knockout blow. */
  readonly koLaunchVelocityY: number;
  readonly koLaunchVelocityX: number;
  /** Frames lying on the floor after landing from a launch (no hurtbox). */
  readonly knockdownFrames: number;
  /** Frames standing back up (no hurtbox). */
  readonly getupFrames: number;
  readonly hurtboxes: HurtboxSet;
}

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  maxHealth: 1000,
  inputBufferFrames: 8,
  pushbackFrames: 8,
  launchVelocityY: 7,
  launchVelocityX: 3,
  koLaunchVelocityY: 9,
  koLaunchVelocityX: 4,
  knockdownFrames: 40,
  getupFrames: 24,
  hurtboxes: {
    // The placeholder capsule is 1.8 m tall and 0.6 m wide.
    stand: { halfWidth: 0.35, bottom: 0, top: 1.8 },
    crouch: { halfWidth: 0.4, bottom: 0, top: 1.1 },
    air: { halfWidth: 0.35, bottom: 0.1, top: 1.7 },
  },
};

export interface MatchConfig {
  /** Round wins needed to take the match (2 = best of three). */
  readonly roundsToWin: number;
  readonly roundSeconds: number;
  readonly stepsPerSecond: number;
  /** "ROUND n" / "FIGHT" announcement before control is given. */
  readonly introFrames: number;
  /** Pause after a KO / time-out before the next round (or the result) appears. */
  readonly roundOverFrames: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  roundsToWin: 2,
  roundSeconds: 60,
  stepsPerSecond: 60,
  introFrames: 90,
  roundOverFrames: 150,
};
