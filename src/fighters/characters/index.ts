import { validateMoveSet } from '../../combat/moves';
import { REX } from './rex';
import type { CharacterDefinition, CharacterId } from './types';
import { VERA } from './vera';

export { REX, REX_MOVES } from './rex';
export type { CharacterDefinition, CharacterId } from './types';
export { VERA, VERA_MOVES } from './vera';

/** Playable roster, in select-screen order. */
export const ROSTER: readonly CharacterDefinition[] = [VERA, REX];

export const DEFAULT_MATCHUP: readonly [CharacterDefinition, CharacterDefinition] = [VERA, REX];

export function getCharacter(id: string): CharacterDefinition | undefined {
  return ROSTER.find((c) => c.id === id);
}

export function isCharacterId(id: string): id is CharacterId {
  return getCharacter(id) !== undefined;
}

/** Throws with every problem in a character definition (move data, health, movement). */
export function validateCharacter(def: CharacterDefinition): void {
  const problems: string[] = [];
  try {
    validateMoveSet(def.moves);
  } catch (error) {
    problems.push(String((error as Error).message));
  }
  for (const move of Object.values(def.moves)) {
    if (!move.id.startsWith(`${def.id}.`)) problems.push(`${move.id}: move ids must be prefixed with "${def.id}."`);
  }
  if (!(Number.isInteger(def.maxHealth) && def.maxHealth > 0)) problems.push('maxHealth must be a positive whole number');
  const m = def.fighter.motion;
  for (const [key, value] of Object.entries(m)) {
    if (!(Number.isFinite(value) && value > 0)) problems.push(`motion.${key} must be a positive number`);
  }
  if (problems.length > 0) throw new Error(`Invalid character ${def.id}:\n- ${problems.join('\n- ')}`);
}
