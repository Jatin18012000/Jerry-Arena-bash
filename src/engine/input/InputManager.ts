import {
  ALL_INPUT_ACTIONS,
  DEFAULT_KEY_BINDINGS,
  type InputAction,
  type KeyBindings,
} from './actions';

/** Minimal event shape the manager consumes; satisfied by `KeyboardEvent`. */
interface KeyEventLike extends Event {
  readonly code: string;
  readonly repeat?: boolean;
}

/**
 * Keyboard-backed input abstraction.
 *
 * Raw DOM events are buffered; `poll()` is called once per fixed simulation step and
 * produces a stable snapshot for that step. A key pressed and released between two
 * polls still registers as `justPressed` for one step, so fast taps are never lost.
 */
export class InputManager {
  private readonly target: EventTarget;
  private bindings: KeyBindings;
  private codeToActions = new Map<string, InputAction[]>();

  /** Physical keys currently held according to raw events. */
  private readonly heldCodes = new Set<string>();
  /** Keys that went down since the last poll (even if already released). */
  private readonly pressedSincePoll = new Set<string>();

  private current = new Set<InputAction>();
  private previous = new Set<InputAction>();
  private tapped = new Set<InputAction>();
  private attached = false;

  constructor(target: EventTarget, bindings: KeyBindings = DEFAULT_KEY_BINDINGS) {
    this.target = target;
    this.bindings = bindings;
    this.rebuildLookup();
  }

  attach(): void {
    if (this.attached) return;
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.onBlur);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.attached = false;
    this.reset();
  }

  get isAttached(): boolean {
    return this.attached;
  }

  setBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
    this.rebuildLookup();
  }

  getBindings(): KeyBindings {
    return this.bindings;
  }

  /** Snapshot input for the next simulation step. Call exactly once per fixed update. */
  poll(): void {
    this.previous = this.current;
    this.current = this.actionsFor(this.heldCodes);
    this.tapped = this.actionsFor(this.pressedSincePoll);
    this.pressedSincePoll.clear();
  }

  isDown(action: InputAction): boolean {
    return this.current.has(action) || this.tapped.has(action);
  }

  justPressed(action: InputAction): boolean {
    return (this.current.has(action) && !this.previous.has(action)) || this.tapped.has(action);
  }

  justReleased(action: InputAction): boolean {
    return this.previous.has(action) && !this.current.has(action);
  }

  /** Release everything, e.g. when the window loses focus. */
  reset(): void {
    this.heldCodes.clear();
    this.pressedSincePoll.clear();
    this.current = new Set();
    this.previous = new Set();
    this.tapped = new Set();
  }

  private actionsFor(codes: Iterable<string>): Set<InputAction> {
    const result = new Set<InputAction>();
    for (const code of codes) {
      for (const action of this.codeToActions.get(code) ?? []) result.add(action);
    }
    return result;
  }

  private rebuildLookup(): void {
    this.codeToActions = new Map();
    for (const action of ALL_INPUT_ACTIONS) {
      for (const code of this.bindings[action]) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action);
        this.codeToActions.set(code, list);
      }
    }
  }

  private readonly onKeyDown = (event: Event): void => {
    const { code, repeat } = event as KeyEventLike;
    if (!this.codeToActions.has(code)) return;
    event.preventDefault();
    if (repeat || this.heldCodes.has(code)) return;
    this.heldCodes.add(code);
    this.pressedSincePoll.add(code);
  };

  private readonly onKeyUp = (event: Event): void => {
    const { code } = event as KeyEventLike;
    this.heldCodes.delete(code);
  };

  private readonly onBlur = (): void => {
    this.reset();
  };
}
