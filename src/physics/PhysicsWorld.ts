import type { Collider, Ray, World } from '@dimforge/rapier3d-compat';
import type { Rapier } from './rapier';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Rapier interaction groups: upper 16 bits = membership, lower 16 bits = filter.
 * `Stage` is every environment collider; `FighterQuery` is what a fighter's environment
 * queries see (the stage only). Fighter-vs-fighter spacing is never a physics question; it is
 * resolved deterministically by gameplay code (pushboxes, `fighters/spacing.ts`).
 */
const STAGE_BIT = 0b01;
const FIGHTER_BIT = 0b10;
export const CollisionGroups = {
  Stage: (STAGE_BIT << 16) | 0xffff,
  FighterQuery: (FIGHTER_BIT << 16) | STAGE_BIT,
} as const;

/**
 * Thin owner of a Rapier `World`: the static stage geometry (floor, walls) plus the queries
 * gameplay needs against it. Gameplay talks to this instead of the raw API so the physics
 * backend stays swappable and every native handle is freed in one place.
 */
export class PhysicsWorld {
  readonly rapier: Rapier;
  readonly world: World;
  /** Reused for every query so environment checks do not allocate a ray per call. */
  private readonly ray: Ray;
  private disposed = false;

  constructor(rapier: Rapier) {
    this.rapier = rapier;
    // World gravity only affects dynamic bodies (none yet). Fighters integrate their own
    // jump/fall arc deterministically in fighters/motion.ts.
    this.world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  /** Fixed, axis-aligned box that belongs to the stage (floor, walls). */
  addStaticBox(center: Vec3, halfExtents: Vec3): Collider {
    const body = this.world.createRigidBody(
      this.rapier.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
    );
    return this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
        CollisionGroups.Stage,
      ),
      body,
    );
  }

  /**
   * Distance from `origin` along the unit vector `dir` to the nearest stage surface, or null if
   * nothing is hit within `maxDistance`. Rapier works in float32, so callers should treat the
   * result as approximate (see `Fighter`).
   */
  castStageRay(origin: Vec3, dir: Vec3, maxDistance: number): number | null {
    this.ray.origin = origin;
    this.ray.dir = dir;
    const hit = this.world.castRay(this.ray, maxDistance, true, undefined, CollisionGroups.FighterQuery);
    return hit ? hit.timeOfImpact : null;
  }

  /** Register newly created colliders with the broad phase so queries see them. */
  prime(): void {
    this.world.step();
  }

  /** Advance by exactly one fixed game step (`dt` comes from the game loop). */
  step(dt: number): void {
    if (this.world.timestep !== dt) this.world.timestep = dt;
    this.world.step();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}
