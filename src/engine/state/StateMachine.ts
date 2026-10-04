import type { GameState } from './GameState';

type Transition<TContext> =
  | { kind: 'change'; state: GameState<TContext> }
  | { kind: 'push'; state: GameState<TContext> }
  | { kind: 'pop' };

/**
 * Stack-based game state machine.
 *
 * Transitions requested during `update`/`render` are queued and applied at the start of
 * the next `update`, so a state never tears itself down while its own hook is running.
 */
export class StateMachine<TContext> {
  private readonly registry = new Map<string, () => GameState<TContext>>();
  private readonly stack: GameState<TContext>[] = [];
  private readonly pending: Transition<TContext>[] = [];
  private readonly context: TContext;

  constructor(context: TContext) {
    this.context = context;
  }

  /** Register a factory so states can be requested by id. */
  register(id: string, factory: () => GameState<TContext>): this {
    if (this.registry.has(id)) throw new Error(`State "${id}" is already registered`);
    this.registry.set(id, factory);
    return this;
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  get current(): GameState<TContext> | undefined {
    return this.stack[this.stack.length - 1];
  }

  get depth(): number {
    return this.stack.length;
  }

  /** Replace the whole stack with a single state. */
  change(id: string): void {
    this.pending.push({ kind: 'change', state: this.create(id) });
  }

  /** Put a state on top of the current one (e.g. a pause menu). */
  push(id: string): void {
    this.pending.push({ kind: 'push', state: this.create(id) });
  }

  pop(): void {
    this.pending.push({ kind: 'pop' });
  }

  /** Apply queued transitions immediately. Called automatically by `update`. */
  flush(): void {
    while (this.pending.length > 0) {
      const transition = this.pending.shift()!;
      switch (transition.kind) {
        case 'change':
          while (this.stack.length > 0) this.stack.pop()!.exit?.(this.context);
          this.stack.push(transition.state);
          transition.state.enter?.(this.context);
          break;
        case 'push':
          this.current?.pause?.(this.context);
          this.stack.push(transition.state);
          transition.state.enter?.(this.context);
          break;
        case 'pop': {
          const top = this.stack.pop();
          if (!top) break;
          top.exit?.(this.context);
          this.current?.resume?.(this.context);
          break;
        }
      }
    }
  }

  update(dt: number): void {
    this.flush();
    this.current?.update?.(dt, this.context);
  }

  render(alpha: number): void {
    this.current?.render?.(alpha, this.context);
  }

  /** Exit every state (top first) and drop queued transitions. */
  clear(): void {
    this.pending.length = 0;
    while (this.stack.length > 0) this.stack.pop()!.exit?.(this.context);
  }

  private create(id: string): GameState<TContext> {
    const factory = this.registry.get(id);
    if (!factory) throw new Error(`Unknown state "${id}"`);
    return factory();
  }
}
