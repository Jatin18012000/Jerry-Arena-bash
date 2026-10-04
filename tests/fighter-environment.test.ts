import { beforeAll, describe, expect, it } from 'vitest';
import { Fighter, NEUTRAL_INTENT, PLACEHOLDER_FIGHTER, type FighterIntent } from '../src/fighters';
import { PhysicsWorld, loadRapier, type Rapier } from '../src/physics';

/**
 * Rapier is the authority for the environment (floor, walls). These worlds use geometry the
 * spacing rules know nothing about, so any stop observed here comes from the physics queries.
 */
const dt = 1 / 60;
const walk = (x: -1 | 1): FighterIntent => ({ ...NEUTRAL_INTENT, x });

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

function world(build: (physics: PhysicsWorld) => void): PhysicsWorld {
  const physics = new PhysicsWorld(rapier);
  physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: 20, y: 0.5, z: 3 });
  build(physics);
  physics.prime();
  return physics;
}

describe('Fighter vs stage (Rapier queries)', () => {
  it('stands exactly on the floor (no float32 drift or creep)', () => {
    const physics = world(() => {});
    const f = new Fighter(physics, { id: 'T', config: PLACEHOLDER_FIGHTER, spawnX: 0, facing: 1 });
    for (let i = 0; i < 600; i++) f.plan(dt, NEUTRAL_INTENT, 5);
    expect(f.y).toBe(0);
    expect(f.x).toBe(0);
    expect(f.motion.grounded).toBe(true);
    physics.dispose();
  });

  it('stops at a wall the spacing rules do not know about, exactly one radius away', () => {
    const physics = world((p) => p.addStaticBox({ x: 3.25, y: 2, z: 0 }, { x: 0.25, y: 2, z: 3 }));
    const f = new Fighter(physics, { id: 'T', config: PLACEHOLDER_FIGHTER, spawnX: 0, facing: 1 });
    for (let i = 0; i < 180; i++) f.plan(dt, walk(1), 10);
    expect(f.x).toBe(3 - PLACEHOLDER_FIGHTER.body.radius);
    physics.dispose();
  });

  it('lands on a raised platform at the platform height', () => {
    const physics = world((p) => p.addStaticBox({ x: 1, y: 0.25, z: 0 }, { x: 1, y: 0.25, z: 3 }));
    const f = new Fighter(physics, { id: 'T', config: PLACEHOLDER_FIGHTER, spawnX: 1, facing: 1 });
    f.y = 1; // start in the air above the 0.5 m platform
    for (let i = 0; i < 60; i++) f.plan(dt, NEUTRAL_INTENT, 10);
    expect(f.y).toBe(0.5);
    expect(f.motion.grounded).toBe(true);
    physics.dispose();
  });

  it('walks at exactly the configured speed when nothing is in the way', () => {
    const physics = world(() => {});
    const f = new Fighter(physics, { id: 'T', config: PLACEHOLDER_FIGHTER, spawnX: 0, facing: 1 });
    for (let i = 0; i < 60; i++) f.plan(dt, walk(1), 10);
    expect(f.x).toBeCloseTo(PLACEHOLDER_FIGHTER.motion.walkForwardSpeed, 12);
    physics.dispose();
  });
});
