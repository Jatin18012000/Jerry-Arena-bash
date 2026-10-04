import { describe, expect, it } from 'vitest';
import { MAX_PIXEL_RATIO, resolveViewport } from '../src/engine/viewport';

describe('resolveViewport', () => {
  it('computes aspect from size', () => {
    expect(resolveViewport(1920, 1080, 1)).toEqual({
      width: 1920,
      height: 1080,
      aspect: 1920 / 1080,
      pixelRatio: 1,
    });
  });

  it('never returns a zero-sized viewport (hidden or collapsed container)', () => {
    const v = resolveViewport(0, 0, 1);
    expect(v.width).toBe(1);
    expect(v.height).toBe(1);
    expect(v.aspect).toBe(1);
  });

  it('clamps and sanitises the pixel ratio', () => {
    expect(resolveViewport(100, 100, 3).pixelRatio).toBe(MAX_PIXEL_RATIO);
    expect(resolveViewport(100, 100, Number.NaN).pixelRatio).toBe(1);
    expect(resolveViewport(100, 100, 0).pixelRatio).toBe(1);
  });
});
