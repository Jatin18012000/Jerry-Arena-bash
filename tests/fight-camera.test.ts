import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FIGHT_CAMERA, FightCamera, frameFighters } from '../src/camera';

const fov = DEFAULT_FIGHT_CAMERA.fov;
const aspect = 16 / 9;

/** Project a world point with a camera placed at a frame; returns NDC x. */
function ndcX(frameX: number, frameY: number, distance: number, focusY: number, point: Vector3): number {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 200);
  camera.position.set(frameX, frameY, distance);
  camera.lookAt(frameX, focusY, 0);
  camera.updateMatrixWorld();
  return point.clone().project(camera).x;
}

describe('frameFighters', () => {
  it('centres on the midpoint and keeps both fighters on screen', () => {
    const a = { x: -3, y: 0 };
    const b = { x: 2, y: 0 };
    const f = frameFighters(a, b, aspect, DEFAULT_FIGHT_CAMERA);
    expect(f.x).toBeCloseTo(-0.5);
    for (const p of [a, b]) {
      expect(Math.abs(ndcX(f.x, f.y, f.distance, f.focusY, new Vector3(p.x, 1, 0)))).toBeLessThan(0.95);
    }
  });

  it('zooms out as fighters separate, within the configured limits', () => {
    const near = frameFighters({ x: -0.3, y: 0 }, { x: 0.3, y: 0 }, aspect, DEFAULT_FIGHT_CAMERA);
    const far = frameFighters({ x: -3.25, y: 0 }, { x: 3.25, y: 0 }, aspect, DEFAULT_FIGHT_CAMERA);
    const huge = frameFighters({ x: -50, y: 0 }, { x: 50, y: 0 }, aspect, DEFAULT_FIGHT_CAMERA);
    expect(near.distance).toBe(DEFAULT_FIGHT_CAMERA.minDistance);
    expect(far.distance).toBeGreaterThan(near.distance);
    expect(huge.distance).toBe(DEFAULT_FIGHT_CAMERA.maxDistance);
  });

  it('keeps cornered fighters on screen when the centre is clamped, even on a portrait viewport', () => {
    const config = { ...DEFAULT_FIGHT_CAMERA, boundsX: [-5.5, 5.5] as const };
    const rightEdge = (viewAspect: number) => {
      const f = frameFighters({ x: 7.0, y: 0 }, { x: 7.7, y: 0 }, viewAspect, config);
      expect(f.x).toBe(5.5);
      return f.x + f.distance * Math.tan(MathUtils.degToRad(config.fov) / 2) * viewAspect;
    };
    // Landscape: the full margin is kept beyond the cornered fighter.
    for (const viewAspect of [16 / 9, 4 / 3]) expect(rightEdge(viewAspect)).toBeGreaterThanOrEqual(7.7 + config.margin - 1e-9);
    // Portrait: maxDistance limits the zoom, but the fighter's body (radius 0.3) is still on screen.
    expect(rightEdge(0.5)).toBeGreaterThanOrEqual(7.7 + 0.3);
  });

  it('follows jumps partially and respects X bounds', () => {
    const grounded = frameFighters({ x: 0, y: 0 }, { x: 1, y: 0 }, aspect, DEFAULT_FIGHT_CAMERA);
    const jumping = frameFighters({ x: 0, y: 1.2 }, { x: 1, y: 0 }, aspect, DEFAULT_FIGHT_CAMERA);
    expect(jumping.focusY - grounded.focusY).toBeCloseTo(1.2 * DEFAULT_FIGHT_CAMERA.verticalFollow);

    const bounded = frameFighters({ x: 7, y: 0 }, { x: 7.5, y: 0 }, aspect, {
      ...DEFAULT_FIGHT_CAMERA,
      boundsX: [-5, 5],
    });
    expect(bounded.x).toBe(5);
  });
});

describe('FightCamera', () => {
  it('smooths toward the target in fixed steps and interpolates on apply', () => {
    const rig = new FightCamera();
    rig.snap({ x: -1, y: 0 }, { x: 1, y: 0 }, aspect);
    expect(rig.frame?.x).toBe(0);

    rig.update(1 / 60, { x: 1, y: 0 }, { x: 3, y: 0 }, aspect);
    const afterOne = rig.frame!.x;
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(2);

    for (let i = 0; i < 240; i++) rig.update(1 / 60, { x: 1, y: 0 }, { x: 3, y: 0 }, aspect);
    expect(rig.frame!.x).toBeCloseTo(2, 3);

    const camera = new PerspectiveCamera(fov, aspect, 0.1, 200);
    rig.apply(camera, 0.5);
    expect(camera.position.x).toBeCloseTo(2, 3);
    expect(camera.position.z).toBeCloseTo(rig.frame!.distance, 3);
    // Looking down the -Z axis at the fight plane.
    const forward = camera.getWorldDirection(new Vector3());
    expect(forward.z).toBeLessThan(-0.95);
    expect(MathUtils.radToDeg(Math.asin(-forward.y))).toBeGreaterThan(0);
  });
});
