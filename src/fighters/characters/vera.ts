import { AttackButton } from '../../combat/types';
import type { MoveSet } from '../../combat/moves';
import { PLACEHOLDER_FIGHTER } from '../config';
import type { CharacterDefinition } from './types';

/**
 * VERA — agile kickboxer (rushdown). Faster walk and jump, the quickest jab and the longest
 * low sweep, but slightly less health and a short-range heavy (knee).
 * Frame data must match blender/scripts/char_vera.py TIMING (enforced by tests).
 */
export const VERA_MOVES: MoveSet = {
  light: {
    id: 'vera.light',
    name: 'Viper Jab',
    button: AttackButton.Light,
    startupFrames: 4,
    activeFrames: 2,
    recoveryFrames: 10,
    damage: 35,
    hitstunFrames: 14,
    blockstunFrames: 10,
    hitLevel: 'high',
    hitbox: { near: 0.15, far: 0.95, bottom: 1.2, top: 1.55, depth: 0.35 },
    reaction: 'stagger',
    hitPushback: 0.3,
    blockPushback: 0.25,
    hitStopFrames: 5,
    blockStopFrames: 3,
    shake: 0.12,
  },
  heavy: {
    id: 'vera.heavy',
    name: 'Spiral Knee',
    button: AttackButton.Heavy,
    startupFrames: 9,
    activeFrames: 3,
    recoveryFrames: 17,
    damage: 80,
    hitstunFrames: 20,
    blockstunFrames: 15,
    hitLevel: 'mid',
    hitbox: { near: 0.1, far: 0.8, bottom: 0.7, top: 1.35, depth: 0.45 },
    reaction: 'stagger',
    hitPushback: 0.65,
    blockPushback: 0.55,
    hitStopFrames: 9,
    blockStopFrames: 6,
    shake: 0.4,
  },
  kick: {
    id: 'vera.kick',
    name: 'Low Sweep',
    button: AttackButton.Kick,
    startupFrames: 7,
    activeFrames: 4,
    recoveryFrames: 14,
    damage: 60,
    hitstunFrames: 18,
    blockstunFrames: 13,
    hitLevel: 'low',
    hitbox: { near: 0.2, far: 1.35, bottom: 0.0, top: 0.4, depth: 0.4 },
    reaction: 'stagger',
    hitPushback: 0.5,
    blockPushback: 0.45,
    hitStopFrames: 7,
    blockStopFrames: 5,
    shake: 0.3,
  },
  special: {
    id: 'vera.special',
    name: 'Violet Crescent',
    button: AttackButton.Special,
    startupFrames: 13,
    activeFrames: 5,
    recoveryFrames: 23,
    damage: 115,
    hitstunFrames: 0,
    blockstunFrames: 17,
    hitLevel: 'mid',
    hitbox: { near: 0.2, far: 1.5, bottom: 0.75, top: 1.7, depth: 0.6 },
    reaction: 'knockdown',
    hitPushback: 0,
    blockPushback: 0.85,
    hitStopFrames: 13,
    blockStopFrames: 8,
    shake: 0.75,
  },
};

export const VERA: CharacterDefinition = {
  id: 'vera',
  name: 'VERA',
  archetype: 'Agile kickboxer — fast, long low sweep, lighter',
  color: 0xa33cff,
  fighter: {
    body: PLACEHOLDER_FIGHTER.body,
    motion: { ...PLACEHOLDER_FIGHTER.motion, walkForwardSpeed: 2.8, walkBackSpeed: 2.1, jumpForwardSpeed: 3.1, jumpBackSpeed: 2.6 },
  },
  maxHealth: 950,
  moves: VERA_MOVES,
};
