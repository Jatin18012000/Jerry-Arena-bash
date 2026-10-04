/**
 * Logical input actions. Game code reads actions, never physical keys, so bindings
 * (keyboard now, gamepad later) can change without touching gameplay code.
 */
export const InputAction = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  LightAttack: 'lightAttack',
  HeavyAttack: 'heavyAttack',
  Kick: 'kick',
  Block: 'block',
  Special: 'special',
  Confirm: 'confirm',
  Back: 'back',
  Pause: 'pause',
} as const;

export type InputAction = (typeof InputAction)[keyof typeof InputAction];

export const ALL_INPUT_ACTIONS: readonly InputAction[] = Object.values(InputAction);

/** Map of action -> physical `KeyboardEvent.code` values. */
export type KeyBindings = Readonly<Record<InputAction, readonly string[]>>;

/** Default single-player keyboard layout. Player-2 / gamepad bindings are future work. */
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  lightAttack: ['KeyJ'],
  heavyAttack: ['KeyK'],
  kick: ['KeyL'],
  block: ['KeyI', 'ShiftLeft'],
  special: ['KeyU'],
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['KeyP'],
};
