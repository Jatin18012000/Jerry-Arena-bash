import { describe, expect, it } from 'vitest';

/**
 * Phase 1 only verifies the approved physics dependency loads offline (WASM is embedded).
 * No game physics is implemented yet; see docs/ARCHITECTURE.md.
 */
describe('Rapier dependency', () => {
  it('initialises and steps an empty world', async () => {
    const RAPIER = (await import('@dimforge/rapier3d-compat')).default;
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.step();
    expect(world.bodies.len()).toBe(0);
    world.free();
  });
});
