import type { PhysicsWorld, Vec3 } from '../physics';
import { fighterHeight, type FighterConfig } from './config';
import {
  faceOpponent,
  initialMotionState,
  settleMotion,
  stepMotion,
  type FighterIntent,
  type MotionState,
  type Side,
} from './motion';
import type { SpacingBody } from './spacing';

/** Per-step overrides the combat layer passes to `plan` (Phase 3). Both default to off. */
export interface PlanOptions {
  /** Keep the current facing (attacks, stun, knockdown): no auto-turn towards the opponent. */
  readonly lockFacing?: boolean;
  /** Extra horizontal displacement this step (pushback), applied with the walk delta. */
  readonly pushX?: number;
}

export interface FighterOptions {
  id: string;
  config: FighterConfig;
  spawnX: number;
  facing: Side;
}

/**
 * Contact positions reported by Rapier (float32) are rounded to this grid (0.1 mm) before they
 * enter fighter state, so physics precision noise can never leak into the deterministic
 * simulation. Free movement is never rounded.
 */
const SURFACE_PRECISION = 1e4;
const snapToSurface = (value: number): number => Math.round(value * SURFACE_PRECISION) / SURFACE_PRECISION;
/** Extra ray length so a fighter standing exactly on the floor still finds it. */
const GROUND_PROBE_SLACK = 1e-3;

const DOWN: Vec3 = { x: 0, y: -1, z: 0 };
const LEFT: Vec3 = { x: -1, y: 0, z: 0 };
const RIGHT: Vec3 = { x: 1, y: 0, z: 0 };

/**
 * Runtime fighter on the 2.5D fight plane. Positions are the fighter's feet (x, y); there is
 * deliberately no z (it is always 0).
 *
 * Authority split:
 * - movement (walk, jump arc, facing) is integrated here in exact float64 by `motion.ts`;
 * - Rapier answers only "where is the stage?": rays against the static floor and walls limit
 *   that movement (environment collision);
 * - fighter-vs-fighter spacing is `spacing.ts`, never physics.
 * The fighter's environment shape (capsule radius / height) is not a pushbox and not a combat
 * hurtbox; combat hit/hurt boxes are separate data in src/combat/ (per posture and per move).
 *
 * Contains no rendering or input code: intents are passed in each step.
 */
export class Fighter {
  readonly id: string;
  readonly config: FighterConfig;
  readonly height: number;
  private readonly physics: PhysicsWorld;
  private readonly centerOffset: number;
  /** Reused query origin, so planning a step does not allocate. */
  private readonly probe: Vec3 = { x: 0, y: 0, z: 0 };

  motion: MotionState;
  x: number;
  y = 0;
  previousX: number;
  previousY = 0;

  constructor(physics: PhysicsWorld, options: FighterOptions) {
    this.id = options.id;
    this.config = options.config;
    this.physics = physics;
    this.height = fighterHeight(options.config.body);
    this.centerOffset = this.height / 2;
    this.x = this.previousX = options.spawnX;
    this.motion = initialMotionState(options.facing);
  }

  /** Wall limit for the fighter's centre on a stage with walls at ±halfWidth. */
  static wallLimit(stageHalfWidth: number, config: FighterConfig): number {
    return stageHalfWidth - config.body.radius;
  }

  /**
   * Step 1 of a fixed update: face the opponent, integrate motion for `intent`, then limit the
   * result against the stage. Leaves the result in `x`/`y` for spacing to adjust.
   */
  plan(dt: number, intent: FighterIntent, opponentX: number, options: PlanOptions = {}): void {
    this.previousX = this.x;
    this.previousY = this.y;
    const faced = options.lockFacing ? this.motion : faceOpponent(this.motion, this.x, opponentX);
    const step = stepMotion(faced, intent, this.config.motion, dt);
    this.x = this.moveHorizontally(step.delta.x + (options.pushX ?? 0));
    const landed = this.moveVertically(step.delta.y);
    this.motion = settleMotion(step.state, landed);
  }

  /**
   * Knock the fighter into the air (knockdown / KO). The arc is then integrated by the normal
   * motion rules: `velocityX` is held like a committed jump until landing.
   */
  launch(velocityY: number, velocityX: number): void {
    this.motion = { ...this.motion, grounded: false, posture: 'air', velocityY, airVelocityX: velocityX };
  }

  /** Freeze in place for a step (hit-stop): no movement, and render interpolation holds still. */
  hold(): void {
    this.previousX = this.x;
    this.previousY = this.y;
  }

  /** Put the fighter back on the floor at `x`, standing, facing `facing` (round start). */
  reset(x: number, facing: Side): void {
    this.x = this.previousX = x;
    this.y = this.previousY = 0;
    this.motion = initialMotionState(facing);
  }

  /** Step 2: accept the spacing-corrected X. */
  commit(x: number): void {
    this.x = x;
  }

  spacingBody(): SpacingBody {
    return {
      previousX: this.previousX,
      x: this.x,
      y: this.y,
      halfWidth: this.config.body.pushHalfWidth,
      height: this.config.body.pushHeight,
    };
  }

  /** Walls: move the full `dx` unless a stage surface is closer than the body radius allows. */
  private moveHorizontally(dx: number): number {
    if (dx === 0) return this.x;
    const { radius } = this.config.body;
    const distance = Math.abs(dx);
    const hit = this.physics.castStageRay(this.origin(), dx > 0 ? RIGHT : LEFT, radius + distance);
    if (hit === null) return this.x + dx;
    const room = Math.max(0, hit - radius);
    return room >= distance ? this.x + dx : snapToSurface(this.x + Math.sign(dx) * room);
  }

  /** Floor: falling movement stops on the stage surface below. Returns true when grounded. */
  private moveVertically(dy: number): boolean {
    if (dy > 0) {
      this.y += dy; // rising: stages have no ceilings
      return false;
    }
    const origin = this.origin();
    const hit = this.physics.castStageRay(origin, DOWN, this.centerOffset - dy + GROUND_PROBE_SLACK);
    if (hit !== null) {
      const ground = snapToSurface(origin.y - hit);
      if (this.y + dy <= ground) {
        this.y = ground;
        return true;
      }
    }
    this.y += dy;
    return false;
  }

  /** Ray origin: the centre of the fighter's body. */
  private origin(): Vec3 {
    this.probe.x = this.x;
    this.probe.y = this.y + this.centerOffset;
    return this.probe;
  }
}
