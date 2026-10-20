import { InputAction, type InputManager } from '../engine/input';
import { KeyboardFighterController, NEUTRAL_INTENT } from '../fighters';
import { AttackButton, type FighterInput } from './types';

/** Produces a fighter's movement intent and combat buttons once per fixed step. */
export interface CombatController {
  readInput(): FighterInput;
}

export const IDLE_INPUT: FighterInput = { intent: NEUTRAL_INTENT, pressed: [], guard: null };

const ATTACK_ACTIONS: readonly (readonly [InputAction, AttackButton])[] = [
  [InputAction.LightAttack, AttackButton.Light],
  [InputAction.HeavyAttack, AttackButton.Heavy],
  [InputAction.Kick, AttackButton.Kick],
  [InputAction.Special, AttackButton.Special],
];

/** Keyboard player: movement from the Phase 2 controller, attacks on press, guard while held. */
export class KeyboardCombatController implements CombatController {
  private readonly input: Pick<InputManager, 'isDown' | 'justPressed'>;
  private readonly movement: KeyboardFighterController;

  constructor(input: Pick<InputManager, 'isDown' | 'justPressed'>) {
    this.input = input;
    this.movement = new KeyboardFighterController(input);
  }

  readInput(): FighterInput {
    const pressed = ATTACK_ACTIONS.filter(([action]) => this.input.justPressed(action)).map(([, button]) => button);
    const guard = this.input.isDown(InputAction.BlockLow) ? 'low' : this.input.isDown(InputAction.BlockHigh) ? 'high' : null;
    return { intent: this.movement.readIntent(), pressed, guard };
  }
}

export const DUMMY_MODES = ['idle', 'blockHigh', 'blockLow', 'crouch', 'jump', 'attack'] as const;
export type DummyMode = (typeof DUMMY_MODES)[number];

/** Steps between the dummy's attacks in 'attack' mode. */
const DUMMY_ATTACK_INTERVAL = 45;
const DUMMY_JUMP_INTERVAL = 50;

/**
 * Training dummy for P2 (a CPU opponent is future work). Deterministic: behaviour depends only
 * on its mode and how many steps it has been asked for input.
 */
export class TrainingDummyController implements CombatController {
  mode: DummyMode;
  private steps = 0;

  constructor(mode: DummyMode = 'idle') {
    this.mode = mode;
  }

  /** Switch to the next mode and return it. */
  cycle(): DummyMode {
    this.mode = DUMMY_MODES[(DUMMY_MODES.indexOf(this.mode) + 1) % DUMMY_MODES.length]!;
    this.steps = 0;
    return this.mode;
  }

  readInput(): FighterInput {
    const step = this.steps++;
    switch (this.mode) {
      case 'blockHigh':
        return { ...IDLE_INPUT, guard: 'high' };
      case 'blockLow':
        return { ...IDLE_INPUT, guard: 'low' };
      case 'crouch':
        return { ...IDLE_INPUT, intent: { ...NEUTRAL_INTENT, crouch: true } };
      case 'jump':
        return { ...IDLE_INPUT, intent: { ...NEUTRAL_INTENT, jump: step % DUMMY_JUMP_INTERVAL === 0 } };
      case 'attack':
        return { ...IDLE_INPUT, pressed: step % DUMMY_ATTACK_INTERVAL === 0 ? [AttackButton.Light] : [] };
      default:
        return IDLE_INPUT;
    }
  }
}
