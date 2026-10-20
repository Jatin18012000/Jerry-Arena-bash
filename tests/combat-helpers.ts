import { NEUTRAL_INTENT, type FighterIntent } from '../src/fighters';
import type { AttackButton, FighterInput, GuardLevel } from '../src/combat';

export const dt = 1 / 60;

/** Build a FighterInput from a partial description. */
export function input(
  opts: { press?: AttackButton | readonly AttackButton[]; guard?: GuardLevel; intent?: Partial<FighterIntent> } = {},
): FighterInput {
  const press = opts.press === undefined ? [] : typeof opts.press === 'string' ? [opts.press] : opts.press;
  return { intent: { ...NEUTRAL_INTENT, ...opts.intent }, pressed: press, guard: opts.guard ?? null };
}

export const IDLE = input();

/** Script: the input for each step index. */
export type InputScript = (step: number) => FighterInput;
export const idle: InputScript = () => IDLE;

/** Small deterministic PRNG so "random" sequences are reproducible. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const BUTTONS: readonly AttackButton[] = ['light', 'heavy', 'kick', 'special'];

/**
 * Seeded mix of walking, jumping, crouching, guarding and attacking, held for random durations.
 * `forward` (+1 / -1) biases walking towards the opponent so the fighters actually meet.
 */
export function randomCombatScript(seed: number, steps: number, forward: -1 | 0 | 1 = 0): InputScript {
  const next = lcg(seed);
  const inputs: FighterInput[] = [];
  const directions: readonly (-1 | 0 | 1)[] = forward === 0 ? [-1, 0, 1] : [forward, forward, 0, (-forward) as -1 | 1];
  while (inputs.length < steps) {
    const roll = next();
    const x = directions[Math.floor(next() * directions.length)]!;
    const guard: GuardLevel | undefined = roll < 0.15 ? 'high' : roll < 0.25 ? 'low' : undefined;
    const duration = 1 + Math.floor(next() * 30);
    const attack = next() < 0.35 ? BUTTONS[Math.floor(next() * 4)] : undefined;
    for (let i = 0; i < duration; i++) {
      inputs.push(
        input({
          intent: { x, jump: roll > 0.92 && i === 0, crouch: roll > 0.25 && roll < 0.33 },
          ...(guard ? { guard } : {}),
          ...(attack && i === 0 ? { press: attack } : {}),
        }),
      );
    }
  }
  return (t) => inputs[t] ?? IDLE;
}
