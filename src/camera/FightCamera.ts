import { MathUtils, type PerspectiveCamera } from 'three';

/** Where the camera wants to be. It sits at (x, y, distance) and looks at (x, focusY, 0). */
export interface CameraFrame {
  x: number;
  y: number;
  focusY: number;
  distance: number;
}

export interface FightCameraConfig {
  /** Vertical field of view in degrees. Narrow, like most fighting games, to limit perspective lean. */
  readonly fov: number;
  /** Horizontal space kept between each fighter and the screen edge, in metres. */
  readonly margin: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Height of the look-at point above the fighters' feet when grounded. */
  readonly focusHeight: number;
  /** Camera height above the look-at point (gives a slight downward angle). */
  readonly elevation: number;
  /** Fraction (0..1) of the highest fighter's jump height the camera follows. */
  readonly verticalFollow: number;
  /** Exponential smoothing rate per second; higher = snappier. */
  readonly followRate: number;
  /** Optional X range the look-at point is clamped to (e.g. stage bounds). */
  readonly boundsX?: readonly [number, number];
}

export const DEFAULT_FIGHT_CAMERA: FightCameraConfig = {
  fov: 32,
  margin: 1.4,
  minDistance: 7,
  maxDistance: 18,
  focusHeight: 1.1,
  elevation: 0.5,
  verticalFollow: 0.35,
  followRate: 8,
};

export interface FramedPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Side-on 2.5D framing: centre on the fighters' midpoint (clamped to `boundsX`) and back off
 * until both, plus a margin, fit in the horizontal field of view *around that centre* — so a
 * clamped centre near a wall never pushes a cornered fighter off-screen. Only `maxDistance`
 * can cut fighters off (extremely narrow viewports).
 */
export function frameFighters(
  a: FramedPoint,
  b: FramedPoint,
  aspect: number,
  config: FightCameraConfig,
): CameraFrame {
  let x = (a.x + b.x) / 2;
  if (config.boundsX) x = MathUtils.clamp(x, config.boundsX[0], config.boundsX[1]);

  const halfWidth = Math.max(Math.abs(a.x - x), Math.abs(b.x - x)) + config.margin;
  const tanHalfHorizontal = Math.tan(MathUtils.degToRad(config.fov) / 2) * Math.max(aspect, 1e-3);
  const distance = MathUtils.clamp(halfWidth / tanHalfHorizontal, config.minDistance, config.maxDistance);

  const focusY = config.focusHeight + config.verticalFollow * Math.max(a.y, b.y, 0);
  return { x, y: focusY + config.elevation, focusY, distance };
}

/**
 * Fight camera rig — presentation only. It reads fighter positions and never writes to the
 * simulation. `update` is ticked at the fixed step purely so smoothing is identical at any
 * render FPS; `apply` interpolates between the last two ticks at render time.
 */
export class FightCamera {
  readonly config: FightCameraConfig;
  private previous: CameraFrame | null = null;
  private current: CameraFrame | null = null;

  constructor(config: FightCameraConfig = DEFAULT_FIGHT_CAMERA) {
    this.config = config;
  }

  get frame(): Readonly<CameraFrame> | null {
    return this.current;
  }

  /** Jump straight to the framing (match start, round reset). */
  snap(a: FramedPoint, b: FramedPoint, aspect: number): void {
    this.current = frameFighters(a, b, aspect, this.config);
    this.previous = { ...this.current };
  }

  update(dt: number, a: FramedPoint, b: FramedPoint, aspect: number): void {
    const target = frameFighters(a, b, aspect, this.config);
    if (!this.current) {
      this.snap(a, b, aspect);
      return;
    }
    this.previous = { ...this.current };
    const k = 1 - Math.exp(-this.config.followRate * dt);
    this.current = {
      x: MathUtils.lerp(this.current.x, target.x, k),
      y: MathUtils.lerp(this.current.y, target.y, k),
      focusY: MathUtils.lerp(this.current.focusY, target.focusY, k),
      distance: MathUtils.lerp(this.current.distance, target.distance, k),
    };
  }

  apply(camera: PerspectiveCamera, alpha: number): void {
    if (!this.current || !this.previous) return;
    if (camera.fov !== this.config.fov) {
      camera.fov = this.config.fov;
      camera.updateProjectionMatrix();
    }
    const p = this.previous;
    const c = this.current;
    const x = MathUtils.lerp(p.x, c.x, alpha);
    camera.position.set(x, MathUtils.lerp(p.y, c.y, alpha), MathUtils.lerp(p.distance, c.distance, alpha));
    camera.lookAt(x, MathUtils.lerp(p.focusY, c.focusY, alpha), 0);
  }
}
