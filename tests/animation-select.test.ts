import { describe, expect, it } from 'vitest';
import { Clip, LOOPING_CLIPS, REQUIRED_CLIPS, selectPose } from '../src/animation';
import { createCombatState, enterStun, startAttack, type CombatPhase } from '../src/combat';
import { initialMotionState, type MotionState, type Posture } from '../src/fighters';
import { VERA } from '../src/fighters/characters';

const ctx = { stepsPerSecond: 60 };
const motion = (posture: Posture = 'stand', grounded = true): MotionState => ({ ...initialMotionState(1), posture, grounded });
const state = (phase: CombatPhase, patch: Partial<ReturnType<typeof createCombatState>> = {}) => ({ ...createCombatState(1000), phase, ...patch });

describe('selectPose (combat state → animation)', () => {
  it('neutral follows the movement posture', () => {
    expect(selectPose(state('neutral'), motion('stand'), ctx).clip).toBe(Clip.Idle);
    expect(selectPose(state('neutral'), motion('walkForward'), ctx).clip).toBe(Clip.WalkForward);
    expect(selectPose(state('neutral'), motion('walkBack'), ctx).clip).toBe(Clip.WalkBack);
    expect(selectPose(state('neutral'), motion('crouch'), ctx).clip).toBe(Clip.Crouch);
    expect(selectPose(state('neutral'), motion('air', false), ctx)).toMatchObject({ clip: Clip.Jump, mode: 'once' });
    expect(selectPose(state('neutral'), motion('stand'), { ...ctx, victory: true }).clip).toBe(Clip.Victory);
  });

  it('attacks are pinned to the combat frame: move frame f → clip time (f - 1) / 60', () => {
    const s = createCombatState(1000);
    startAttack(s, VERA.moves.kick);
    expect(selectPose(s, motion(), ctx)).toMatchObject({ clip: Clip.AttackKick, mode: 'frame', time: 0 });
    s.frame = 8; // first active frame of a 7-frame-startup move
    expect(selectPose(s, motion(), ctx)).toMatchObject({ clip: Clip.AttackKick, mode: 'frame', time: 7 / 60 });
  });

  it('guards and blockstun use the guard level; stun and get-up use normalised progress', () => {
    expect(selectPose(state('guard', { guardLevel: 'low' }), motion('crouch'), ctx).clip).toBe(Clip.GuardLow);
    expect(selectPose(state('blockstun', { guardLevel: 'high' }), motion(), ctx).clip).toBe(Clip.GuardHigh);
    const hit = createCombatState(1000);
    enterStun(hit, 'hitstun', 20);
    hit.frame = 5;
    expect(selectPose(hit, motion(), ctx)).toMatchObject({ clip: Clip.HitHigh, mode: 'normalized', progress: 0.25 });
    hit.crouching = true;
    expect(selectPose(hit, motion('crouch'), ctx).clip).toBe(Clip.HitCrouch);
    expect(selectPose(state('getup', { frame: 12, duration: 24 }), motion(), ctx)).toMatchObject({ clip: Clip.Getup, progress: 0.5 });
  });

  it('launch, knockdown and KO', () => {
    expect(selectPose(state('launched'), motion('air', false), ctx).clip).toBe(Clip.Launched);
    expect(selectPose(state('knockdown'), motion(), ctx).clip).toBe(Clip.Knockdown);
    expect(selectPose(state('ko'), motion('air', false), ctx).clip).toBe(Clip.Launched);
    expect(selectPose(state('ko'), motion(), ctx).clip).toBe(Clip.Ko);
  });

  it('every clip it can return exists in the clip contract, and loops are flagged', () => {
    expect(REQUIRED_CLIPS).toHaveLength(18);
    for (const c of [Clip.Idle, Clip.WalkForward, Clip.GuardHigh, Clip.Victory]) expect(LOOPING_CLIPS.has(c)).toBe(true);
    for (const c of [Clip.Jump, Clip.AttackLight, Clip.Getup, Clip.Ko]) expect(LOOPING_CLIPS.has(c)).toBe(false);
  });
});
