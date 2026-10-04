import { describe, expect, it, vi } from 'vitest';
import { GameLoop, type LoopScheduler } from '../src/engine/GameLoop';

function manualScheduler() {
  let next: ((t: number) => void) | null = null;
  const scheduler: LoopScheduler = {
    request: (cb) => {
      next = cb;
      return 1;
    },
    cancel: () => {
      next = null;
    },
  };
  return { scheduler, fire: (t: number) => next?.(t), pending: () => next !== null };
}

describe('GameLoop', () => {
  it('runs a fixed number of updates per simulated second', () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop({ update, render }, { stepsPerSecond: 60, scheduler: manualScheduler().scheduler });
    for (let i = 0; i < 6; i++) loop.advance(1 / 6);
    expect(update).toHaveBeenCalledTimes(60);
    expect(update.mock.calls.every(([dt]) => dt === 1 / 60)).toBe(true);
    expect(render).toHaveBeenCalledTimes(6);
    expect(loop.steps).toBe(60);
  });

  it('carries leftover time and reports interpolation alpha', () => {
    const render = vi.fn();
    const loop = new GameLoop({ update: () => {}, render }, { stepsPerSecond: 10, scheduler: manualScheduler().scheduler });
    expect(loop.advance(0.15)).toBe(1);
    expect(render.mock.calls[0]![0]).toBeCloseTo(0.5);
    expect(loop.advance(0.05)).toBe(1);
  });

  it('clamps huge frame deltas to avoid a spiral of death', () => {
    const update = vi.fn();
    const loop = new GameLoop({ update, render: () => {} }, { stepsPerSecond: 60, maxFrameDelta: 0.25, scheduler: manualScheduler().scheduler });
    loop.advance(10);
    expect(update).toHaveBeenCalledTimes(15);
  });

  it('starts and stops via the scheduler', () => {
    const s = manualScheduler();
    const update = vi.fn();
    let now = 0;
    const loop = new GameLoop({ update, render: () => {} }, { scheduler: s.scheduler, now: () => now });
    loop.start();
    expect(loop.running).toBe(true);
    now = 100;
    s.fire(100);
    expect(update).toHaveBeenCalledTimes(6);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(s.pending()).toBe(false);
  });

  it('rejects a non-positive step rate', () => {
    expect(() => new GameLoop({ update: () => {}, render: () => {} }, { stepsPerSecond: 0 })).toThrow(RangeError);
  });
});
