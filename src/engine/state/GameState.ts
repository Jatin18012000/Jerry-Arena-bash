/**
 * A self-contained screen or mode of the game (boot, title, versus match, training, ...).
 * Every hook is optional; states only implement what they need.
 */
export interface GameState<TContext> {
  readonly id: string;
  /** Called when the state becomes the top of the stack. */
  enter?(context: TContext): void;
  /** Called when the state is removed from the stack. */
  exit?(context: TContext): void;
  /** Called when another state is pushed on top of this one. */
  pause?(context: TContext): void;
  /** Called when this state becomes the top again after a pop. */
  resume?(context: TContext): void;
  /** Fixed-step simulation update (only the top state is updated). */
  update?(dt: number, context: TContext): void;
  /** Per-frame render hook (only the top state renders). */
  render?(alpha: number, context: TContext): void;
}
