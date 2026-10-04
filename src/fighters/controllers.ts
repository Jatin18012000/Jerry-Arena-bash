import { InputAction, type InputManager } from '../engine/input';
import { NEUTRAL_INTENT, type FighterIntent } from './motion';

/** Produces a fighter's intent once per fixed step. Keyboard now; CPU AI and gamepads later. */
export interface FighterController {
  readIntent(): FighterIntent;
}

/** Reads logical actions (never key codes) from the shared input snapshot. */
export class KeyboardFighterController implements FighterController {
  private readonly input: Pick<InputManager, 'isDown'>;

  constructor(input: Pick<InputManager, 'isDown'>) {
    this.input = input;
  }

  readIntent(): FighterIntent {
    const x = Number(this.input.isDown(InputAction.Right)) - Number(this.input.isDown(InputAction.Left));
    return {
      x: x as FighterIntent['x'],
      jump: this.input.isDown(InputAction.Up),
      crouch: this.input.isDown(InputAction.Down),
    };
  }
}

/** Stands still. Used for the Phase 2 dummy opponent. */
export class IdleFighterController implements FighterController {
  readIntent(): FighterIntent {
    return NEUTRAL_INTENT;
  }
}
