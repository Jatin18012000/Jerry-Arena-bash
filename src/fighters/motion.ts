import type { FighterMotionParams } from './config';

/** -1 = towards negative X (screen left), +1 = towards positive X (screen right). */
export type Side = -1 | 1;

/** What a controller (keyboard now, CPU later) wants the fighter to do this step. World-space X. */
export interface FighterIntent {
  readonly x: -1 | 0 | 1;
  readonly jump: boolean;
  readonly crouch: boolean;
}

export const NEUTRAL_INTENT: FighterIntent = { x: 0, jump: false, crouch: false };

export type Posture = 'stand' | 'walkForward' | 'walkBack' | 'crouch' | 'air';

export interface MotionState {
  readonly facing: Side;
  readonly grounded: boolean;
  readonly posture: Posture;
  readonly velocityY: number;
  /** Horizontal speed locked in at take-off; jumps cannot be steered. */
  readonly airVelocityX: number;
}

export function initialMotionState(facing: Side): MotionState {
  return { facing, grounded: true, posture: 'stand', velocityY: 0, airVelocityX: 0 };
}

export interface MotionStep {
  readonly state: MotionState;
  /** Requested translation for this step, before collision. */
  readonly delta: { readonly x: number; readonly y: number };
}

/**
 * Advance a fighter's movement by one fixed step. Pure: same inputs always give the same
 * output, which keeps movement frame-accurate and replayable.
 */
export function stepMotion(
  state: MotionState,
  intent: FighterIntent,
  params: FighterMotionParams,
  dt: number,
): MotionStep {
  let { posture, velocityY, airVelocityX } = state;
  let dx = 0;

  if (state.grounded) {
    airVelocityX = 0;
    const forward = intent.x !== 0 && intent.x === state.facing;
    if (intent.jump) {
      posture = 'air';
      velocityY = params.jumpVelocity;
      airVelocityX = intent.x === 0 ? 0 : intent.x * (forward ? params.jumpForwardSpeed : params.jumpBackSpeed);
    } else if (intent.crouch) {
      posture = 'crouch';
    } else if (intent.x !== 0) {
      posture = forward ? 'walkForward' : 'walkBack';
      dx = intent.x * (forward ? params.walkForwardSpeed : params.walkBackSpeed) * dt;
    } else {
      posture = 'stand';
    }
  }

  if (posture === 'air') dx = airVelocityX * dt;
  velocityY = Math.max(velocityY - params.gravity * dt, -params.maxFallSpeed);

  return {
    state: { ...state, posture, velocityY, airVelocityX },
    delta: { x: dx, y: velocityY * dt },
  };
}

/** Apply the collision result: landing ends a jump, walking off nothing starts a fall. */
export function settleMotion(state: MotionState, grounded: boolean): MotionState {
  if (grounded) {
    if (state.velocityY > 0) return { ...state, grounded: false };
    const posture = state.posture === 'air' ? 'stand' : state.posture;
    return { ...state, grounded: true, posture, velocityY: 0, airVelocityX: 0 };
  }
  return { ...state, grounded: false, posture: 'air' };
}

/** Fighters turn to face the opponent, but only while grounded (no mid-air turnarounds). */
export function faceOpponent(state: MotionState, selfX: number, opponentX: number): MotionState {
  if (!state.grounded || selfX === opponentX) return state;
  const facing: Side = opponentX > selfX ? 1 : -1;
  return facing === state.facing ? state : { ...state, facing };
}
