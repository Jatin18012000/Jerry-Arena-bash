import { Fighter, PLACEHOLDER_FIGHTER, resolveSpacing, type FighterIntent, type SpacingRules } from '../fighters';
import { PhysicsWorld, type Rapier } from '../physics';

/** Debug stage: flat floor with walls at ±STAGE_HALF_WIDTH. Not an arena. */
export const STAGE_HALF_WIDTH = 8;
/** Furthest apart the fighters may be; keeps both comfortably on screen. */
export const MAX_SEPARATION = 6.5;
export const SPAWN_SEPARATION = 3;

const WALL_THICKNESS = 0.5;
const WALL_HEIGHT = 10;
const STAGE_DEPTH = 6;
/** Floor extends this far past each wall so nothing can ever step off its edge. */
const FLOOR_OVERHANG = 2;

/**
 * Headless, deterministic Phase 2 movement simulation: Rapier stage + two placeholder
 * capsule fighters + spacing. One `step` per fixed game step, driven only by the two
 * intents it is given — no input devices, no rendering, no camera, no viewport.
 */
export class SandboxSimulation {
  readonly physics: PhysicsWorld;
  readonly fighters: readonly [Fighter, Fighter];
  readonly spacing: SpacingRules;
  /** Fixed steps simulated so far. */
  ticks = 0;

  constructor(rapier: Rapier) {
    this.physics = new PhysicsWorld(rapier);
    this.physics.addStaticBox(
      { x: 0, y: -0.5, z: 0 },
      { x: STAGE_HALF_WIDTH + FLOOR_OVERHANG, y: 0.5, z: STAGE_DEPTH / 2 },
    );
    for (const side of [-1, 1]) {
      this.physics.addStaticBox(
        { x: side * (STAGE_HALF_WIDTH + WALL_THICKNESS / 2), y: WALL_HEIGHT / 2, z: 0 },
        { x: WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: STAGE_DEPTH / 2 },
      );
    }

    const config = PLACEHOLDER_FIGHTER;
    this.fighters = [
      new Fighter(this.physics, { id: 'P1', config, spawnX: -SPAWN_SEPARATION / 2, facing: 1 }),
      new Fighter(this.physics, { id: 'P2', config, spawnX: SPAWN_SEPARATION / 2, facing: -1 }),
    ];
    this.physics.prime(); // stage colliders must be in the broad phase before the first query

    const wall = Fighter.wallLimit(STAGE_HALF_WIDTH, config);
    this.spacing = { minX: -wall, maxX: wall, maxSeparation: MAX_SEPARATION };
  }

  step(dt: number, p1Intent: FighterIntent, p2Intent: FighterIntent): void {
    const [p1, p2] = this.fighters;
    // Both fighters plan from the same start-of-step snapshot, so P1/P2 order does not matter.
    const p1Start = p1.x;
    const p2Start = p2.x;
    p1.plan(dt, p1Intent, p2Start);
    p2.plan(dt, p2Intent, p1Start);

    const [x1, x2] = resolveSpacing(p1.spacingBody(), p2.spacingBody(), this.spacing);
    p1.commit(x1);
    p2.commit(x2);
    // Keeps Rapier's clock in lockstep with the game for future dynamic bodies; the static
    // stage the fighters query does not change.
    this.physics.step(dt);
    this.ticks++;
  }

  dispose(): void {
    this.physics.dispose();
  }
}
