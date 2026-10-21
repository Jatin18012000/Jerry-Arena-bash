import type { MoveSet } from '../../combat/moves';
import type { FighterConfig } from '../config';

export type CharacterId = 'vera' | 'rex';

/**
 * Everything gameplay needs to know about a fighter. Pure data: no Three.js, no asset URLs
 * (those live in `models.ts`), so the simulation and tests can use it headlessly.
 */
export interface CharacterDefinition {
  readonly id: CharacterId;
  readonly name: string;
  /** One-line gameplay identity, shown in debug UI and docs. */
  readonly archetype: string;
  /** HUD / fallback-capsule colour. */
  readonly color: number;
  /** Body (environment collider, pushbox) and movement tuning. */
  readonly fighter: FighterConfig;
  readonly maxHealth: number;
  readonly moves: MoveSet;
}
