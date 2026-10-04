import { describe, expect, it } from 'vitest';
import { resolveSpacing, type SpacingBody, type SpacingRules } from '../src/fighters';

const rules: SpacingRules = { minX: -7.5, maxX: 7.5, maxSeparation: 6 };
const body = (x: number, previousX = x, y = 0): SpacingBody => ({ previousX, x, y, halfWidth: 0.35, height: 1.8 });

describe('resolveSpacing', () => {
  it('leaves fighters alone when they are apart', () => {
    expect(resolveSpacing(body(-1), body(1), rules)).toEqual([-1, 1]);
  });

  it('pushes overlapping fighters apart equally', () => {
    const [a, b] = resolveSpacing(body(-0.2), body(0.2), rules);
    expect(b - a).toBeCloseTo(0.7);
    expect(a + b).toBeCloseTo(0);
  });

  it('lets the free fighter absorb the push when one is against the wall', () => {
    const [a, b] = resolveSpacing(body(7.0), body(7.5), rules);
    expect(b).toBe(7.5);
    expect(b - a).toBeCloseTo(0.7);
  });

  it('breaks exact ties deterministically', () => {
    const [a, b] = resolveSpacing(body(0), body(0), rules);
    expect(a).toBeLessThan(b);
  });

  it('ignores pushboxes when one fighter is above the other (jumping over)', () => {
    expect(resolveSpacing(body(0), body(0.1, 0.1, 2.0), rules)).toEqual([0, 0.1]);
  });

  it('stops a fighter walking away at max separation without dragging the opponent', () => {
    // a walked back from -3 to -3.1 while b stood still at 3.
    const [a, b] = resolveSpacing(body(-3.1, -3), body(3), rules);
    expect(b).toBe(3);
    expect(b - a).toBeCloseTo(rules.maxSeparation);
  });

  it('is mirror-symmetric: swapping and mirroring the inputs mirrors the result (no P1/P2 bias)', () => {
    // Deterministic pseudo-random cases (LCG) covering overlap, walls, max separation and air.
    let seed = 12345;
    const rand = (min: number, max: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return min + (seed / 2 ** 32) * (max - min);
    };
    for (let i = 0; i < 2000; i++) {
      const ax = rand(-8, 8);
      const bx = ax + rand(-7, 7);
      if (ax === bx) continue; // exact ties are broken deliberately (see above)
      const a = { previousX: ax + rand(-0.05, 0.05), x: ax, y: rand(0, 1) < 0.8 ? 0 : rand(0, 2), halfWidth: 0.35, height: 1 };
      const b = { previousX: bx + rand(-0.05, 0.05), x: bx, y: rand(0, 1) < 0.8 ? 0 : rand(0, 2), halfWidth: 0.35, height: 1 };
      const mirror = (s: SpacingBody): SpacingBody => ({ ...s, x: -s.x, previousX: -s.previousX });
      const [ra, rb] = resolveSpacing(a, b, rules);
      const [mb, ma] = resolveSpacing(mirror(b), mirror(a), rules);
      expect(ma).toBeCloseTo(-ra, 12);
      expect(mb).toBeCloseTo(-rb, 12);
    }
  });

  it('simultaneous approach: equal overlap from both sides is split equally', () => {
    const [a, b] = resolveSpacing(body(-0.3, -0.34), body(0.3, 0.34), rules);
    expect(a).toBeCloseTo(-0.35, 12);
    expect(b).toBeCloseTo(0.35, 12);
  });

  it('keeps both fighters inside the stage bounds', () => {
    const [a, b] = resolveSpacing(body(-9), body(9), { ...rules, maxSeparation: 100 });
    expect([a, b]).toEqual([rules.minX, rules.maxX]);
  });
});
