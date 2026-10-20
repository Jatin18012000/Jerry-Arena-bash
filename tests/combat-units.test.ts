import { describe, expect, it } from 'vitest';
import {
  BLOCK_RULES,
  InputBuffer,
  attackIsInFront,
  contactPoint,
  guardStops,
  hitboxWorld,
  hurtboxWorld,
  overlaps,
} from '../src/combat';

describe('boxes', () => {
  it('overlap uses open intervals: touching edges do not count', () => {
    const a = { x0: 0, x1: 1, y0: 0, y1: 1 };
    expect(overlaps(a, { x0: 0.5, x1: 2, y0: 0.5, y1: 2 })).toBe(true);
    expect(overlaps(a, { x0: 1, x1: 2, y0: 0, y1: 1 })).toBe(false);
    expect(overlaps(a, { x0: 0, x1: 1, y0: 1, y1: 2 })).toBe(false);
  });

  it('hitboxes are placed in front of the fighter according to facing', () => {
    const def = { near: 0.2, far: 1, bottom: 1, top: 1.5, depth: 0.4 };
    expect(hitboxWorld(def, 2, 0, 1)).toEqual({ x0: 2.2, x1: 3, y0: 1, y1: 1.5 });
    expect(hitboxWorld(def, 2, 0.5, -1)).toEqual({ x0: 1, x1: 1.8, y0: 1.5, y1: 2 });
  });

  it('hurtboxes are centred on the fighter and follow its height', () => {
    expect(hurtboxWorld({ halfWidth: 0.4, bottom: 0, top: 1.1 }, -1, 0.25)).toEqual({ x0: -1.4, x1: -0.6, y0: 0.25, y1: 1.35 });
  });

  it('contact point is the centre of the intersection', () => {
    expect(contactPoint({ x0: 0, x1: 2, y0: 0, y1: 2 }, { x0: 1, x1: 3, y0: 1, y1: 3 })).toEqual({ x: 1.5, y: 1.5 });
  });
});

describe('blocking rules', () => {
  it('match the Phase 3 table', () => {
    expect(BLOCK_RULES).toEqual({
      high: { high: true, low: true },
      mid: { high: true, low: true },
      low: { high: false, low: true },
    });
    expect(guardStops('high', 'low')).toBe(false);
    expect(guardStops('low', 'low')).toBe(true);
    expect(guardStops('high', 'mid')).toBe(true);
  });

  it('only cover the side the defender faces', () => {
    expect(attackIsInFront(0, 1, 1)).toBe(true);
    expect(attackIsInFront(0, 1, -1)).toBe(false);
    expect(attackIsInFront(0, -1, -1)).toBe(true);
    expect(attackIsInFront(0, -1, 0)).toBe(true);
  });
});

describe('InputBuffer (combat frames)', () => {
  it('a press can come out on its own frame and the next window-1 frames, then expires', () => {
    const fresh = () => {
      const b = new InputBuffer(8);
      b.record('light', 10);
      return b;
    };
    expect(fresh().take(10)).toBe('light');
    expect(fresh().take(17)).toBe('light');
    expect(fresh().take(18)).toBeNull();
  });

  it('prunes stale presses', () => {
    const b = new InputBuffer(8);
    b.record('heavy', 1);
    b.record('kick', 6);
    b.prune(9);
    expect(b.peek().map((e) => e.button)).toEqual(['kick']);
  });

  it('takes the oldest press and clears the rest', () => {
    const b = new InputBuffer(8);
    b.record('light', 3);
    b.record('special', 5);
    expect(b.take(6)).toBe('light');
    expect(b.size).toBe(0);
    expect(b.take(6)).toBeNull();
  });

  it('resolves same-frame presses by priority: special > heavy > kick > light', () => {
    const pick = (...buttons: Parameters<InputBuffer['record']>[0][]) => {
      const b = new InputBuffer(8);
      for (const button of buttons) b.record(button, 1);
      return b.take(1);
    };
    expect(pick('light', 'kick')).toBe('kick');
    expect(pick('kick', 'heavy', 'light')).toBe('heavy');
    expect(pick('light', 'special', 'heavy')).toBe('special');
  });

  it('rejects a bad window and can be cleared', () => {
    expect(() => new InputBuffer(0)).toThrow(RangeError);
    const b = new InputBuffer(8);
    b.record('light', 1);
    b.clear();
    expect(b.take(1)).toBeNull();
  });
});
