import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_FIGHTER,
  faceOpponent,
  initialMotionState,
  settleMotion,
  stepMotion,
  type FighterIntent,
  type MotionState,
} from '../src/fighters';

const params = PLACEHOLDER_FIGHTER.motion;
const dt = 1 / 60;
const intent = (partial: Partial<FighterIntent>): FighterIntent => ({ x: 0, jump: false, crouch: false, ...partial });

/** Integrate on a flat floor at y = 0 without physics, to test the motion rules in isolation. */
function simulate(start: MotionState, intents: FighterIntent[]) {
  let state = start;
  let x = 0;
  let y = 0;
  let maxY = 0;
  for (const i of intents) {
    const step = stepMotion(state, i, params, dt);
    x += step.delta.x;
    y += step.delta.y;
    const grounded = y <= 0;
    if (grounded) y = 0;
    maxY = Math.max(maxY, y);
    state = settleMotion(step.state, grounded);
  }
  return { state, x, y, maxY };
}

describe('fighter motion', () => {
  it('walks forward and back at different speeds relative to facing', () => {
    const right = initialMotionState(1);
    const forward = stepMotion(right, intent({ x: 1 }), params, dt);
    const back = stepMotion(right, intent({ x: -1 }), params, dt);
    expect(forward.state.posture).toBe('walkForward');
    expect(forward.delta.x).toBeCloseTo(params.walkForwardSpeed * dt);
    expect(back.state.posture).toBe('walkBack');
    expect(back.delta.x).toBeCloseTo(-params.walkBackSpeed * dt);

    // Facing left mirrors which direction counts as "forward".
    const left = initialMotionState(-1);
    expect(stepMotion(left, intent({ x: -1 }), params, dt).state.posture).toBe('walkForward');
  });

  it('crouching stops walking', () => {
    const step = stepMotion(initialMotionState(1), intent({ x: 1, crouch: true }), params, dt);
    expect(step.state.posture).toBe('crouch');
    expect(step.delta.x).toBe(0);
  });

  it('a neutral jump rises, peaks at v²/2g and lands back on the floor', () => {
    const frames = [intent({ jump: true }), ...Array<FighterIntent>(80).fill(intent({}))];
    const result = simulate(initialMotionState(1), frames);
    const expectedApex = (params.jumpVelocity * params.jumpVelocity) / (2 * params.gravity);
    expect(result.maxY).toBeGreaterThan(expectedApex * 0.9);
    expect(result.maxY).toBeLessThan(expectedApex * 1.05);
    expect(result.x).toBe(0);
    expect(result.state.grounded).toBe(true);
    expect(result.state.posture).toBe('stand');
  });

  it('jump direction is committed at take-off and cannot be steered', () => {
    const takeoff = intent({ x: 1, jump: true });
    const steering = Array<FighterIntent>(20).fill(intent({ x: -1 }));
    const result = simulate(initialMotionState(1), [takeoff, ...steering]);
    expect(result.state.posture).toBe('air');
    expect(result.x).toBeCloseTo(21 * params.jumpForwardSpeed * dt);
  });

  it('turns to face the opponent only while grounded', () => {
    const grounded = initialMotionState(1);
    expect(faceOpponent(grounded, 0, -2).facing).toBe(-1);
    expect(faceOpponent(grounded, 0, 2)).toBe(grounded);
    expect(faceOpponent(grounded, 1, 1)).toBe(grounded);
    const airborne: MotionState = { ...grounded, grounded: false, posture: 'air' };
    expect(faceOpponent(airborne, 0, -2).facing).toBe(1);
  });

  it('is deterministic', () => {
    const frames = Array.from({ length: 120 }, (_, i) => intent({ x: i % 30 < 15 ? 1 : -1, jump: i % 50 === 0 }));
    expect(simulate(initialMotionState(1), frames)).toEqual(simulate(initialMotionState(1), frames));
  });
});
