import { describe, expect, it } from 'vitest';
import { StateMachine, type GameState } from '../src/engine/state';

type Ctx = { log: string[] };

function tracked(id: string): () => GameState<Ctx> {
  return () => ({
    id,
    enter: (c) => c.log.push(`${id}:enter`),
    exit: (c) => c.log.push(`${id}:exit`),
    pause: (c) => c.log.push(`${id}:pause`),
    resume: (c) => c.log.push(`${id}:resume`),
    update: (_dt, c) => c.log.push(`${id}:update`),
    render: (_a, c) => c.log.push(`${id}:render`),
  });
}

function setup() {
  const ctx: Ctx = { log: [] };
  const sm = new StateMachine(ctx)
    .register('title', tracked('title'))
    .register('match', tracked('match'))
    .register('pause', tracked('pause'));
  return { ctx, sm };
}

describe('StateMachine', () => {
  it('applies a change on the next update and runs only the top state', () => {
    const { ctx, sm } = setup();
    sm.change('title');
    expect(sm.current).toBeUndefined();
    sm.update(1 / 60);
    sm.render(0);
    expect(sm.current?.id).toBe('title');
    expect(ctx.log).toEqual(['title:enter', 'title:update', 'title:render']);
  });

  it('change exits every state on the stack', () => {
    const { ctx, sm } = setup();
    sm.change('match');
    sm.push('pause');
    sm.flush();
    ctx.log.length = 0;
    sm.change('title');
    sm.flush();
    expect(ctx.log).toEqual(['pause:exit', 'match:exit', 'title:enter']);
    expect(sm.depth).toBe(1);
  });

  it('push pauses the state below and pop resumes it', () => {
    const { ctx, sm } = setup();
    sm.change('match');
    sm.flush();
    sm.push('pause');
    sm.flush();
    expect(sm.current?.id).toBe('pause');
    sm.pop();
    sm.flush();
    expect(sm.current?.id).toBe('match');
    expect(ctx.log).toEqual(['match:enter', 'match:pause', 'pause:enter', 'pause:exit', 'match:resume']);
  });

  it('defers transitions requested from inside an update', () => {
    const ctx: Ctx = { log: [] };
    const sm: StateMachine<Ctx> = new StateMachine(ctx);
    sm.register('a', () => ({ id: 'a', update: () => sm.change('b'), exit: (c) => c.log.push('a:exit') }));
    sm.register('b', () => ({ id: 'b', enter: (c) => c.log.push('b:enter') }));
    sm.change('a');
    sm.update(0);
    expect(sm.current?.id).toBe('a');
    expect(ctx.log).toEqual([]);
    sm.update(0);
    expect(sm.current?.id).toBe('b');
    expect(ctx.log).toEqual(['a:exit', 'b:enter']);
  });

  it('rejects unknown and duplicate states, and pop on empty is a no-op', () => {
    const { sm } = setup();
    expect(() => sm.change('nope')).toThrow(/Unknown state/);
    expect(() => sm.register('title', tracked('title'))).toThrow(/already registered/);
    sm.pop();
    expect(() => sm.flush()).not.toThrow();
    expect(sm.depth).toBe(0);
  });

  it('clear exits all states', () => {
    const { ctx, sm } = setup();
    sm.change('match');
    sm.push('pause');
    sm.flush();
    ctx.log.length = 0;
    sm.clear();
    expect(ctx.log).toEqual(['pause:exit', 'match:exit']);
    expect(sm.current).toBeUndefined();
  });
});
