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
  Special: 'special',
  /** Standing guard: blocks high and mid attacks. */
  BlockHigh: 'blockHigh',
  /** Crouching guard: blocks high, mid and low attacks (see combat/blocking.ts). */
  BlockLow: 'blockLow',
  Confirm: 'confirm',
  Back: 'back',
  Pause: 'pause',
  /** Training/debug: cycle the dummy opponent's behaviour. */
  TrainingDummy: 'trainingDummy',
  /** Training/debug: show or hide hitboxes and hurtboxes. */
  ToggleHitboxes: 'toggleHitboxes',
} as const;

export type InputAction = (typeof InputAction)[keyof typeof InputAction];

export const ALL_INPUT_ACTIONS: readonly InputAction[] = Object.values(InputAction);

/** Map of action -> physical `KeyboardEvent.code` values. */
export type KeyBindings = Readonly<Record<InputAction, readonly string[]>>;

/**
 * Default single-player keyboard layout. Player-2 / gamepad bindings are future work.
 * Phase 3: blocks on the home row (J high, K low) and attacks on the row above (U I O) plus L,
 * all under the right hand while the left hand moves.
 */
export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  lightAttack: ['KeyU'],
  heavyAttack: ['KeyI'],
  kick: ['KeyO'],
  special: ['KeyL'],
  blockHigh: ['KeyJ'],
  blockLow: ['KeyK'],
  confirm: ['Enter', 'Space'],
  back: ['Escape', 'Backspace'],
  pause: ['KeyP'],
  trainingDummy: ['KeyT'],
  toggleHitboxes: ['KeyH'],
};
