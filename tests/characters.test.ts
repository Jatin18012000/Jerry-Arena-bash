import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CombatSimulation, Match, advantageOnBlock, advantageOnHit, totalFrames, type FighterSetup } from '../src/combat';
import { DEFAULT_MATCHUP, REX, ROSTER, VERA, getCharacter, validateCharacter, type CharacterDefinition } from '../src/fighters/characters';
import { loadRapier, type Rapier } from '../src/physics';
import { IDLE, dt, input } from './combat-helpers';

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

const setup = (c: CharacterDefinition): FighterSetup => ({ config: c.fighter, moves: c.moves, maxHealth: c.maxHealth });

describe('roster', () => {
  it('contains VERA and REX, both valid', () => {
    expect(ROSTER.map((c) => c.id)).toEqual(['vera', 'rex']);
    for (const c of ROSTER) expect(() => validateCharacter(c)).not.toThrow();
    expect(getCharacter('rex')).toBe(REX);
    expect(getCharacter('titan')).toBeUndefined();
    expect(DEFAULT_MATCHUP).toEqual([VERA, REX]);
  });

  it('rejects malformed characters', () => {
    const bad = { ...VERA, maxHealth: 0, moves: { ...VERA.moves, light: { ...VERA.moves.light, id: 'light', startupFrames: 0 } } };
    expect(() => validateCharacter(bad)).toThrow(/maxHealth[\s\S]*|startupFrames/);
    expect(() => validateCharacter(bad)).toThrow(/prefixed with "vera\."/);
  });

  it('gives each fighter a distinct gameplay identity', () => {
    // VERA: faster, quicker jab, longer low sweep, less health.
    expect(VERA.fighter.motion.walkForwardSpeed).toBeGreaterThan(REX.fighter.motion.walkForwardSpeed);
    expect(VERA.moves.light.startupFrames).toBeLessThan(REX.moves.light.startupFrames);
    expect(VERA.moves.kick.hitbox.far).toBeGreaterThan(REX.moves.kick.hitbox.far);
    expect(VERA.maxHealth).toBeLessThan(REX.maxHealth);
    // REX: more damage, reach on the special, heavier pushback.
    for (const b of ['light', 'heavy', 'kick', 'special'] as const) expect(REX.moves[b].damage).toBeGreaterThan(VERA.moves[b].damage);
    expect(REX.moves.special.hitbox.far).toBeGreaterThan(VERA.moves.special.hitbox.far);
    expect(REX.moves.heavy.hitPushback).toBeGreaterThan(VERA.moves.heavy.hitPushback);
  });

  it('keeps the same frame-advantage rules as Phase 3 (jabs +3 on hit, -1 on block; specials -10 on block)', () => {
    for (const c of ROSTER) {
      expect(advantageOnHit(c.moves.light), c.id).toBe(3);
      expect(advantageOnBlock(c.moves.light), c.id).toBe(-1);
      expect(advantageOnBlock(c.moves.special), c.id).toBe(-10);
      expect(c.moves.special.reaction).toBe('knockdown');
      expect(c.moves.kick.hitLevel).toBe('low');
    }
  });

  it('frame data matches the Blender animation timing tables (char_*.py)', () => {
    for (const c of ROSTER) {
      const py = readFileSync(`blender/scripts/char_${c.id}.py`, 'utf8');
      for (const button of ['light', 'heavy', 'kick', 'special'] as const) {
        const m = py.match(new RegExp(`'${button}':\\s*\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`));
        expect(m, `${c.id} ${button} timing in Python`).not.toBeNull();
        const move = c.moves[button];
        expect(m!.slice(1, 4).map(Number), `${c.id} ${button}`).toEqual([move.startupFrames, move.activeFrames, move.recoveryFrames]);
      }
    }
  });
});

describe('characters in the simulation', () => {
  it('uses each fighter\'s own moves, health and walk speed', () => {
    const sim = new CombatSimulation(rapier, { fighters: [setup(VERA), setup(REX)] });
    sim.resetRound(-0.5, 0.5);
    expect(sim.states.map((s) => s.health)).toEqual([950, 1050]);
    // VERA's 4-frame jab connects on frame 5 (step 4).
    let hitStep = -1;
    for (let t = 0; t < 20 && hitStep < 0; t++) {
      sim.step(dt, [t === 0 ? input({ press: 'light' }) : IDLE, IDLE]);
      if (sim.events.some((e) => e.type === 'hit')) hitStep = t;
    }
    expect(hitStep).toBe(VERA.moves.light.startupFrames);
    expect(sim.states[1].health).toBe(1050 - VERA.moves.light.damage);
    sim.resetRound();
    expect(sim.states.map((s) => s.health)).toEqual([950, 1050]);
    sim.dispose();

    const walk = new CombatSimulation(rapier, { fighters: [setup(VERA), setup(REX)] });
    walk.resetRound(-3, 3); // within the 6.5 m maximum separation
    for (let t = 0; t < 30; t++) walk.step(dt, [input({ intent: { x: 1 } }), input({ intent: { x: -1 } })]);
    const [v, r] = walk.fighters;
    expect(v.x - -3).toBeCloseTo(VERA.fighter.motion.walkForwardSpeed * 30 * dt, 9);
    expect(3 - r.x).toBeCloseTo(REX.fighter.motion.walkForwardSpeed * 30 * dt, 9);
    walk.dispose();
  });

  it('a time-out compares remaining health as a percentage when max health differs', () => {
    const match = new Match(rapier, {
      fighters: [setup(VERA), setup(REX)],
      match: { roundsToWin: 2, roundSeconds: 1, stepsPerSecond: 60, introFrames: 1, roundOverFrames: 1 },
    });
    while (match.phase !== 'fight') match.step(dt, [IDLE, IDLE]);
    match.combat.states[0].health = 760; // 80% of 950
    match.combat.states[1].health = 800; // ~76% of 1050 — more points, lower share
    while (match.phase === 'fight') match.step(dt, [IDLE, IDLE]);
    expect(match.lastResult).toEqual({ round: 1, winner: 0, reason: 'timeout' });
    match.dispose();
  });

  it('VERA vs REX replays deterministically', () => {
    const run = () => {
      const sim = new CombatSimulation(rapier, { fighters: [setup(VERA), setup(REX)] });
      sim.resetRound(-1, 1);
      const out: unknown[] = [];
      for (let t = 0; t < 600; t++) {
        const press = t % 37 === 0 ? 'heavy' : t % 23 === 0 ? 'kick' : undefined;
        sim.step(dt, [input({ intent: { x: t % 90 < 40 ? 1 : 0 }, ...(press ? { press } : {}) }), input({ ...(t % 41 === 0 ? { press: 'special' as const } : {}) })]);
        out.push([sim.fighters.map((f) => f.x), sim.states.map((s) => [s.phase, s.frame, s.health])]);
      }
      sim.dispose();
      return out;
    };
    expect(run()).toEqual(run());
    expect(totalFrames(VERA.moves.special)).toBe(41);
  });
});
