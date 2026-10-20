// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEY_BINDINGS, InputAction, InputManager } from '../src/engine/input';

const key = (type: 'keydown' | 'keyup', code: string, repeat = false) =>
  new KeyboardEvent(type, { code, repeat, cancelable: true });

describe('InputManager', () => {
  let target: HTMLElement;
  let input: InputManager;

  beforeEach(() => {
    target = document.createElement('div');
    input = new InputManager(target);
    input.attach();
  });

  afterEach(() => input.detach());

  it('instantiates with default bindings for every action', () => {
    const fresh = new InputManager(new EventTarget());
    expect(fresh.isAttached).toBe(false);
    for (const action of Object.values(InputAction)) {
      expect(fresh.getBindings()[action].length).toBeGreaterThan(0);
    }
    expect(fresh.getBindings()).toBe(DEFAULT_KEY_BINDINGS);
  });

  it('reports held, just pressed and just released per poll', () => {
    target.dispatchEvent(key('keydown', 'KeyU'));
    input.poll();
    expect(input.isDown(InputAction.LightAttack)).toBe(true);
    expect(input.justPressed(InputAction.LightAttack)).toBe(true);

    input.poll();
    expect(input.isDown(InputAction.LightAttack)).toBe(true);
    expect(input.justPressed(InputAction.LightAttack)).toBe(false);

    target.dispatchEvent(key('keyup', 'KeyU'));
    input.poll();
    expect(input.isDown(InputAction.LightAttack)).toBe(false);
    expect(input.justReleased(InputAction.LightAttack)).toBe(true);
  });

  it('does not lose a tap that starts and ends between two polls', () => {
    target.dispatchEvent(key('keydown', 'KeyI'));
    target.dispatchEvent(key('keyup', 'KeyI'));
    input.poll();
    expect(input.justPressed(InputAction.HeavyAttack)).toBe(true);
    input.poll();
    expect(input.justPressed(InputAction.HeavyAttack)).toBe(false);
  });

  it('maps multiple keys to one action and ignores key repeat', () => {
    target.dispatchEvent(key('keydown', 'ArrowLeft'));
    input.poll();
    target.dispatchEvent(key('keydown', 'ArrowLeft', true));
    input.poll();
    expect(input.isDown(InputAction.Left)).toBe(true);
    expect(input.justPressed(InputAction.Left)).toBe(false);
  });

  it('prevents default only for bound keys', () => {
    const bound = key('keydown', 'Space');
    const unbound = key('keydown', 'KeyZ');
    target.dispatchEvent(bound);
    target.dispatchEvent(unbound);
    expect(bound.defaultPrevented).toBe(true);
    expect(unbound.defaultPrevented).toBe(false);
  });

  it('releases everything on blur and on detach', () => {
    target.dispatchEvent(key('keydown', 'KeyD'));
    target.dispatchEvent(new Event('blur'));
    input.poll();
    expect(input.isDown(InputAction.Right)).toBe(false);

    target.dispatchEvent(key('keydown', 'KeyD'));
    input.detach();
    input.poll();
    expect(input.isDown(InputAction.Right)).toBe(false);
    target.dispatchEvent(key('keydown', 'KeyA'));
    input.poll();
    expect(input.isDown(InputAction.Left)).toBe(false);
  });

  it('supports rebinding', () => {
    input.setBindings({ ...DEFAULT_KEY_BINDINGS, blockHigh: ['KeyQ'] });
    target.dispatchEvent(key('keydown', 'KeyJ'));
    target.dispatchEvent(key('keydown', 'KeyQ'));
    input.poll();
    expect(input.isDown(InputAction.BlockHigh)).toBe(true);
    target.dispatchEvent(key('keyup', 'KeyQ'));
    input.poll();
    expect(input.isDown(InputAction.BlockHigh)).toBe(false);
  });
});
