import { AttackButton } from '../../combat/types';
import type { MoveSet } from '../../combat/moves';
import { PLACEHOLDER_FIGHTER } from '../config';
import type { CharacterDefinition } from './types';

/**
 * REX — power striker. Slower on his feet, more health, heavier damage and pushback, and the
 * longest-reaching special (a lunging straight), paid for with slower startup.
 * Frame data must match blender/scripts/char_rex.py TIMING (enforced by tests).
 */
export const REX_MOVES: MoveSet = {
  light: {
    id: 'rex.light',
    name: 'Circuit Jab',
    button: AttackButton.Light,
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 11,
    damage: 45,
    hitstunFrames: 16,
    blockstunFrames: 12,
    hitLevel: 'high',
    hitbox: { near: 0.15, far: 1.0, bottom: 1.2, top: 1.6, depth: 0.4 },
    reaction: 'stagger',
    hitPushback: 0.35,
    blockPushback: 0.3,
    hitStopFrames: 6,
    blockStopFrames: 4,
    shake: 0.18,
  },
  heavy: {
    id: 'rex.heavy',
    name: 'Dragon Hook',
    button: AttackButton.Heavy,
    startupFrames: 11,
    activeFrames: 4,
    recoveryFrames: 19,
    damage: 100,
    hitstunFrames: 23,
    blockstunFrames: 16,
    hitLevel: 'mid',
    hitbox: { near: 0.1, far: 1.05, bottom: 0.9, top: 1.5, depth: 0.55 },
    reaction: 'stagger',
    hitPushback: 0.8,
    blockPushback: 0.65,
    hitStopFrames: 11,
    blockStopFrames: 7,
    shake: 0.55,
  },
  kick: {
    id: 'rex.kick',
    name: 'Shin Breaker',
    button: AttackButton.Kick,
    startupFrames: 9,
    activeFrames: 4,
    recoveryFrames: 16,
    damage: 70,
    hitstunFrames: 20,
    blockstunFrames: 15,
    hitLevel: 'low',
    hitbox: { near: 0.15, far: 1.15, bottom: 0.0, top: 0.5, depth: 0.45 },
    reaction: 'stagger',
    hitPushback: 0.55,
    blockPushback: 0.5,
    hitStopFrames: 8,
    blockStopFrames: 5,
    shake: 0.35,
  },
  special: {
    id: 'rex.special',
    name: 'Overdrive Fist',
    button: AttackButton.Special,
    startupFrames: 15,
    activeFrames: 6,
    recoveryFrames: 24,
    damage: 130,
    hitstunFrames: 0,
    blockstunFrames: 19,
    hitLevel: 'mid',
    hitbox: { near: 0.3, far: 1.8, bottom: 0.8, top: 1.5, depth: 0.6 },
    reaction: 'knockdown',
    hitPushback: 0,
    blockPushback: 1.0,
    hitStopFrames: 15,
    blockStopFrames: 9,
    shake: 0.85,
  },
};

export const REX: CharacterDefinition = {
  id: 'rex',
  name: 'REX',
  archetype: 'Power striker — heavy hits, long-reach special, slower',
  color: 0x2b8cff,
  fighter: {
    body: PLACEHOLDER_FIGHTER.body,
    motion: { ...PLACEHOLDER_FIGHTER.motion, walkForwardSpeed: 2.2, walkBackSpeed: 1.6, jumpForwardSpeed: 2.6, jumpBackSpeed: 2.2 },
  },
  maxHealth: 1050,
  moves: REX_MOVES,
};
