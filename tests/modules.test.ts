import { describe, expect, it } from 'vitest';

describe('core modules import', () => {
  it('engine barrel exports the public API', async () => {
    const engine = await import('../src/engine');
    expect(engine.Engine).toBeTypeOf('function');
    expect(engine.GameLoop).toBeTypeOf('function');
    expect(engine.RenderContext).toBeTypeOf('function');
    expect(engine.InputManager).toBeTypeOf('function');
    expect(engine.StateMachine).toBeTypeOf('function');
    expect(engine.createDefaultLighting).toBeTypeOf('function');
    expect(engine.resolveViewport).toBeTypeOf('function');
  });

  it('debug foundation state builds without a WebGL context', async () => {
    const { createFoundationTestState, FOUNDATION_TEST_STATE_ID } = await import(
      '../src/engine/debug/FoundationTestState'
    );
    const state = createFoundationTestState();
    expect(state.id).toBe(FOUNDATION_TEST_STATE_ID);
  });

  it('three.js is resolvable', async () => {
    const three = await import('three');
    expect(Number.parseInt(three.REVISION, 10)).toBeGreaterThanOrEqual(150);
  });
});
