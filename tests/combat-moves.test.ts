import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOVES,
  advantageOnBlock,
  advantageOnHit,
  moveProblems,
  moveStageAt,
  totalFrames,
  validateMoveSet,
  type MoveDefinition,
  type MoveSet,
} from '../src/combat';

describe('frame data: default move set', () => {
  it('matches the Phase 3 baseline startup / active / recovery / damage', () => {
    const table = Object.values(DEFAULT_MOVES).map((m) => [m.id, m.startupFrames, m.activeFrames, m.recoveryFrames, m.damage]);
    expect(table).toEqual([
      ['light', 5, 3, 10, 40],
      ['heavy', 10, 4, 18, 90],
      ['kick', 8, 4, 15, 65],
      ['special', 14, 5, 24, 120],
    ]);
  });

  it('is valid', () => {
    expect(() => validateMoveSet(DEFAULT_MOVES)).not.toThrow();
  });

  it('gives each move a distinct role', () => {
    const { light, heavy, kick, special } = DEFAULT_MOVES;
    expect(light.hitLevel).toBe('high');
    expect(heavy.hitLevel).toBe('mid');
    expect(kick.hitLevel).toBe('low');
    expect(special.reaction).toBe('knockdown');
    expect(special.damage).toBeGreaterThan(heavy.damage);
    expect(special.hitbox.far).toBeGreaterThan(heavy.hitbox.far);
    expect(advantageOnHit(light)).toBe(3);
    expect(advantageOnBlock(light)).toBe(-1);
    expect(advantageOnBlock(heavy)).toBe(-5);
    expect(advantageOnBlock(special)).toBe(-10);
    expect(advantageOnHit(special)).toBeNull(); // knockdown
  });
});

describe('frame data: active window semantics (1-based, inclusive)', () => {
  const light = DEFAULT_MOVES.light; // 5 / 3 / 10
  it('maps frames to startup, active and recovery', () => {
    expect(moveStageAt(light, 0)).toBeNull();
    expect(moveStageAt(light, 1)).toBe('startup');
    expect(moveStageAt(light, 5)).toBe('startup');
    expect(moveStageAt(light, 6)).toBe('active');
    expect(moveStageAt(light, 8)).toBe('active');
    expect(moveStageAt(light, 9)).toBe('recovery');
    expect(moveStageAt(light, 18)).toBe('recovery');
    expect(moveStageAt(light, 19)).toBeNull();
    expect(moveStageAt(light, 6.5)).toBeNull();
    expect(totalFrames(light)).toBe(18);
  });
});

describe('frame data: validation rejects malformed moves', () => {
  const base = DEFAULT_MOVES.heavy;
  const broken = (patch: Partial<MoveDefinition>): string[] => moveProblems({ ...base, ...patch });

  it.each<[string, Partial<MoveDefinition>, RegExp]>([
    ['negative startup', { startupFrames: -1 }, /startupFrames/],
    ['zero startup', { startupFrames: 0 }, /startupFrames/],
    ['zero active frames', { activeFrames: 0 }, /activeFrames/],
    ['fractional recovery', { recoveryFrames: 2.5 }, /recoveryFrames/],
    ['negative damage', { damage: -5 }, /damage/],
    ['NaN damage', { damage: Number.NaN }, /damage/],
    ['negative hitstun', { hitstunFrames: -2 }, /hitstunFrames/],
    ['stagger move without hitstun', { hitstunFrames: 0 }, /hitstunFrames >= 1/],
    ['negative hit-stop', { hitStopFrames: -1 }, /hitStopFrames/],
    ['unknown hit level', { hitLevel: 'overhead' as never }, /hitLevel/],
    ['inverted hitbox reach', { hitbox: { ...base.hitbox, near: 1.2, far: 0.5 } }, /hitbox.far/],
    ['inverted hitbox height', { hitbox: { ...base.hitbox, bottom: 1.5, top: 1.0 } }, /hitbox.top/],
    ['hitbox behind the fighter', { hitbox: { ...base.hitbox, near: -0.5 } }, /hitbox.near/],
    ['zero-depth hitbox', { hitbox: { ...base.hitbox, depth: 0 } }, /hitbox.depth/],
    ['infinite hitbox', { hitbox: { ...base.hitbox, far: Number.POSITIVE_INFINITY } }, /finite/],
    ['empty id', { id: '' }, /id/],
  ])('%s', (_label, patch, message) => {
    expect(broken(patch).join('\n')).toMatch(message);
  });

  it('validateMoveSet reports a move under the wrong button and duplicate ids', () => {
    const bad: MoveSet = { ...DEFAULT_MOVES, kick: { ...DEFAULT_MOVES.light } };
    expect(() => validateMoveSet(bad)).toThrow(/registered under "kick"[\s\S]*duplicate move id "light"/);
  });

  it('a knockdown move may have zero hitstun', () => {
    expect(moveProblems(DEFAULT_MOVES.special)).toEqual([]);
  });
});
