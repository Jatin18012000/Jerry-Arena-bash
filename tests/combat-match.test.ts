import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_CONFIG, DEFAULT_MOVES, Match, type MatchConfig, type MatchEvent } from '../src/combat';
import { loadRapier, type Rapier } from '../src/physics';
import { IDLE, dt, input } from './combat-helpers';

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

const FAST: MatchConfig = { ...DEFAULT_MATCH_CONFIG, introFrames: 10, roundOverFrames: 10, roundSeconds: 2 };

function newMatch(config: MatchConfig = FAST): Match {
  return new Match(rapier, { match: config });
}

/** Step until `done` (or a safety limit), collecting events. */
function stepUntil(match: Match, done: (m: Match) => boolean, p1 = () => IDLE, limit = 5000): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (let i = 0; i < limit && !done(match); i++) {
    match.step(dt, [p1(), IDLE]);
    events.push(...match.events);
  }
  if (!done(match)) throw new Error('stepUntil: condition never met');
  return events;
}

/** Bring P1 and P2 to point-blank range and set P2's health. */
function arrange(match: Match, p2Health: number, p1Health = match.combat.config.maxHealth): void {
  match.combat.movement.resetPositions(-0.5, 0.5);
  match.combat.states[0].health = p1Health;
  match.combat.states[1].health = p2Health;
}

const lightSpam = () => input({ press: 'light' });

describe('Match: round flow', () => {
  it('starts in the intro with no control, then FIGHT', () => {
    const match = newMatch();
    expect(match.phase).toBe('intro');
    expect(match.round).toBe(1);
    const events = stepUntil(match, (m) => m.phase === 'fight', lightSpam);
    expect(match.combat.states[0].phase).toBe('neutral'); // presses during the intro were ignored
    expect(match.combat.buffers[0].size).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['fight']);
    expect(match.secondsLeft).toBe(FAST.roundSeconds);
    match.dispose();
  });

  it('a KO ends the round, awards it, clears buffers and starts round 2 with full health at spawn', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'fight');
    arrange(match, DEFAULT_MOVES.light.damage);
    const events = stepUntil(match, (m) => m.phase === 'roundOver', lightSpam);
    const ko = events.find((e) => e.type === 'hit');
    expect(ko?.type === 'hit' && ko.ko).toBe(true);
    expect(match.lastResult).toEqual({ round: 1, winner: 0, reason: 'ko' });
    expect(match.wins).toEqual([1, 0]);
    expect(match.combat.states[1].phase).toBe('ko');
    expect(match.combat.buffers.every((b) => b.size === 0)).toBe(true);

    const next = stepUntil(match, (m) => m.round === 2);
    expect(next.some((e) => e.type === 'roundStart' && e.round === 2)).toBe(true);
    expect(match.phase).toBe('intro');
    expect(match.combat.states.map((s) => s.health)).toEqual([1000, 1000]);
    expect(match.combat.fighters.map((f) => f.x)).toEqual([-1.5, 1.5]);
    match.dispose();
  });

  it('best of three: two round wins take the match; restart begins again from round 1', () => {
    const match = newMatch();
    for (let round = 1; round <= 2; round++) {
      stepUntil(match, (m) => m.phase === 'fight');
      arrange(match, 1);
      stepUntil(match, (m) => m.phase === 'roundOver', lightSpam);
    }
    const events = stepUntil(match, (m) => m.phase === 'matchOver');
    expect(events.at(-1)).toEqual({ type: 'matchEnd', winner: 0 });
    expect(match.wins).toEqual([2, 0]);
    expect(match.winner).toBe(0);

    // Nothing happens after the match until restart.
    for (let i = 0; i < 100; i++) match.step(dt, [lightSpam(), IDLE]);
    expect(match.phase).toBe('matchOver');
    match.restart();
    expect([match.phase, match.round, match.wins, match.winner]).toEqual(['intro', 1, [0, 0], null]);
    match.dispose();
  });
});

describe('Match: timer and time-out', () => {
  it('counts down only during the fight; at zero the healthier fighter wins', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'fight');
    expect(match.timerFrames).toBe(FAST.roundSeconds * 60);
    match.combat.states[0].health = 500;
    let steps = 0;
    stepUntil(match, (m) => m.phase === 'roundOver', () => (steps++, IDLE));
    expect(steps).toBe(FAST.roundSeconds * 60);
    expect(match.lastResult).toEqual({ round: 1, winner: 1, reason: 'timeout' });
    expect(match.timerFrames).toBe(0);
    match.dispose();
  });

  it('equal health at time-out is a draw: both fighters get the round', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'roundOver');
    expect(match.lastResult).toEqual({ round: 1, winner: null, reason: 'timeout' });
    expect(match.wins).toEqual([1, 1]);
    match.dispose();
  });

  it('a double KO is a draw', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'fight');
    arrange(match, 1, 1);
    match.step(dt, [lightSpam(), lightSpam()]);
    stepUntil(match, (m) => m.phase === 'roundOver');
    expect(match.lastResult).toEqual({ round: 1, winner: null, reason: 'doubleKo' });
    match.dispose();
  });

  it('two drawn rounds each draw the match when both reach the win total together', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'matchOver');
    expect(match.wins).toEqual([2, 2]);
    expect(match.winner).toBe('draw');
    match.dispose();
  });

  it('an attack still in progress when time runs out cannot change health afterwards', () => {
    const match = newMatch({ ...FAST, roundOverFrames: 120 });
    stepUntil(match, (m) => m.phase === 'fight');
    arrange(match, 1000);
    // Press heavy (10 startup frames) 3 frames before time-out: it becomes active after the bell.
    const pressAt = 3;
    stepUntil(match, (m) => m.timerFrames === pressAt);
    match.step(dt, [input({ press: 'heavy' }), IDLE]);
    stepUntil(match, (m) => m.phase === 'roundOver');
    expect(match.combat.states[0].phase).toBe('attack');
    for (let i = 0; i < 40; i++) match.step(dt, [IDLE, IDLE]);
    expect(match.combat.states[1].health).toBe(1000);
    expect(match.lastResult).toEqual({ round: 1, winner: null, reason: 'timeout' });
    match.dispose();
  });

  it('hit-stop freezes the round timer', () => {
    const match = newMatch();
    stepUntil(match, (m) => m.phase === 'fight');
    arrange(match, 1000);
    const pressOnce = (() => {
      let first = true;
      return () => (first ? ((first = false), input({ press: 'heavy' })) : IDLE);
    })();
    stepUntil(match, (m) => m.combat.hitstop > 0, pressOnce);
    const timer = match.timerFrames;
    const stop = match.combat.hitstop;
    for (let i = 0; i < stop; i++) match.step(dt, [IDLE, IDLE]);
    expect(match.timerFrames).toBe(timer);
    match.step(dt, [IDLE, IDLE]);
    expect(match.timerFrames).toBe(timer - 1);
    match.dispose();
  });
});
