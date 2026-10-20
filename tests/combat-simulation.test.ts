import { beforeAll, describe, expect, it } from 'vitest';
import {
  CombatSimulation,
  DEFAULT_COMBAT_CONFIG,
  DEFAULT_MOVES,
  enterStun,
  exchangeAdvantage,
  hitboxWorld,
  overlaps,
  type AttackButton,
  type CombatEvent,
} from '../src/combat';
import { GameLoop } from '../src/engine/GameLoop';
import { loadRapier, type Rapier } from '../src/physics';
import { IDLE, dt, idle, input, lcg, randomCombatScript, type InputScript } from './combat-helpers';

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Fresh simulation with fighters at the given X (default: 1 m apart, in range of every move). */
function setup(p1X = -0.5, p2X = 0.5): CombatSimulation {
  const sim = new CombatSimulation(rapier);
  sim.resetRound(p1X, p2X);
  return sim;
}

interface StepRecord {
  readonly step: number;
  readonly advanced: boolean;
  readonly events: readonly CombatEvent[];
}

function run(sim: CombatSimulation, steps: number, p1: InputScript, p2: InputScript = idle, from = 0): StepRecord[] {
  const out: StepRecord[] = [];
  for (let t = from; t < from + steps; t++) {
    const advanced = sim.step(dt, [p1(t), p2(t)]);
    out.push({ step: t, advanced, events: [...sim.events] });
  }
  return out;
}

const pressAt = (step: number, press: AttackButton | readonly AttackButton[]): InputScript => (t) => (t === step ? input({ press }) : IDLE);
const eventsOf = (records: readonly StepRecord[], type: CombatEvent['type']) =>
  records.flatMap((r) => r.events.filter((e) => e.type === type).map((e) => ({ step: r.step, event: e })));
const MAX = DEFAULT_COMBAT_CONFIG.maxHealth;

describe('attack timing (frame data in integer frames)', () => {
  it('a light attack connects exactly on its first active frame (frame 6), never during startup', () => {
    const sim = setup();
    const records = run(sim, 40, pressAt(0, 'light'));
    const hits = eventsOf(records, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.step).toBe(5); // pressed on step 0 = frame 1; startup frames 1-5; active from 6
    expect(sim.states[1].health).toBe(MAX - 40);
    sim.dispose();
  });

  it('heavy, kick and special connect on startup + 1', () => {
    for (const [button, expected] of [['heavy', 10], ['kick', 8], ['special', 14]] as const) {
      const sim = setup();
      const hits = eventsOf(run(sim, 60, pressAt(0, button)), 'hit');
      expect(hits.map((h) => h.step), button).toEqual([expected]);
      sim.dispose();
    }
  });

  it('an out-of-range attack whiffs and the attacker can act again after startup + active + recovery', () => {
    const sim = setup(-2, 2);
    const records = run(sim, 18, pressAt(0, 'light'));
    expect(eventsOf(records, 'hit')).toHaveLength(0);
    expect(sim.states[0].phase).toBe('attack');
    expect(sim.states[0].frame).toBe(18);
    run(sim, 1, idle, idle, 18);
    expect(sim.states[0].phase).toBe('neutral');
    expect(sim.states[1].health).toBe(MAX);
    sim.dispose();
  });

  it('an opponent walking into range during recovery is not hit', () => {
    const heavy = DEFAULT_MOVES.heavy; // active frames 11-14 = steps 10-13
    const sim = setup(-0.9, 0.9); // gap 1.8: out of heavy range (1.5)
    const p2: InputScript = (t) => (t >= 14 && t < 30 ? input({ intent: { x: -1 } }) : IDLE);
    const records = run(sim, 32, pressAt(0, 'heavy'), p2);
    expect(eventsOf(records, 'hit')).toHaveLength(0);
    // The test is meaningful: P2 did end up inside where the hitbox was.
    const p1f = sim.fighters[0];
    expect(overlaps(hitboxWorld(heavy.hitbox, p1f.x, p1f.y, 1), sim.hurtbox(1)!)).toBe(true);
    sim.dispose();
  });

  it('attacks track the attacker: the hitbox follows fighter position and facing', () => {
    const sim = setup(1, -1); // P1 on the right, facing left
    run(sim, 6, pressAt(0, 'light'));
    const box = sim.hitbox(0)!;
    expect(box.x1).toBeLessThan(sim.fighters[0].x); // in front = towards negative X
    expect(box.x0).toBeCloseTo(1 - DEFAULT_MOVES.light.hitbox.far, 9);
    expect(sim.states[1].health).toBe(MAX); // gap 2 m is out of the light's range
    sim.dispose();
  });
});

describe('one hit per attack instance', () => {
  it('a move that overlaps for all its active frames damages once', () => {
    const sim = setup(-0.35, 0.35); // pushboxes touching
    const records = run(sim, 40, pressAt(0, 'heavy'));
    expect(eventsOf(records, 'hit')).toHaveLength(1);
    expect(sim.states[1].health).toBe(MAX - 90);
    sim.dispose();
  });

  it('a blocked move connects once and does no damage', () => {
    const sim = setup(-0.35, 0.35);
    const records = run(sim, 40, pressAt(0, 'heavy'), () => input({ guard: 'high' }));
    expect(eventsOf(records, 'block')).toHaveLength(1);
    expect(eventsOf(records, 'hit')).toHaveLength(0);
    expect(sim.states[1].health).toBe(MAX);
    sim.dispose();
  });
});

describe('hurtboxes by posture', () => {
  const crouching: InputScript = () => input({ intent: { crouch: true } });

  it('a high light attack passes over a crouching opponent', () => {
    const sim = setup();
    expect(eventsOf(run(sim, 30, pressAt(0, 'light'), crouching), 'hit')).toHaveLength(0);
    expect(sim.states[1].health).toBe(MAX);
    sim.dispose();
  });

  it('mid and low attacks hit a crouching opponent, who stays crouched in hitstun', () => {
    for (const button of ['heavy', 'kick'] as const) {
      const sim = setup();
      const records = run(sim, 20, pressAt(0, button), crouching);
      expect(eventsOf(records, 'hit'), button).toHaveLength(1);
      expect(sim.states[1].phase).toBe('hitstun');
      expect(sim.fighters[1].motion.posture).toBe('crouch');
      expect(sim.hurtbox(1)!.y1).toBeCloseTo(DEFAULT_COMBAT_CONFIG.hurtboxes.crouch.top, 9);
      sim.dispose();
    }
  });

  it('crouching changes the combat hurtbox, not only the visual', () => {
    const sim = setup();
    run(sim, 2, idle);
    expect(sim.hurtbox(1)!.y1).toBe(DEFAULT_COMBAT_CONFIG.hurtboxes.stand.top);
    run(sim, 2, crouching, crouching, 2);
    expect(sim.hurtbox(1)!.y1).toBe(DEFAULT_COMBAT_CONFIG.hurtboxes.crouch.top);
    sim.dispose();
  });

  it('a jumping opponent is hittable (airborne hurtbox) and any air hit knocks down', () => {
    const sim = setup();
    const records = run(sim, 8, pressAt(0, 'light'), (t) => input({ intent: { jump: t === 0 } }));
    const hits = eventsOf(records, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.event.type === 'hit' && hits[0]!.event.knockdown).toBe(true);
    expect(sim.states[1].phase).toBe('launched');
    sim.dispose();
  });
});

describe('blocking', () => {
  const guard = (level: 'high' | 'low'): InputScript => () => input({ guard: level });

  it.each([
    ['high', 'light', 'block'],
    ['high', 'heavy', 'block'],
    ['high', 'kick', 'hit'],
    ['low', 'heavy', 'block'],
    ['low', 'kick', 'block'],
    ['low', 'special', 'block'],
  ] as const)('%s guard vs %s → %s', (level, button, outcome) => {
    const sim = setup();
    const records = run(sim, 40, pressAt(0, button), guard(level));
    const blocks = eventsOf(records, 'block');
    const hits = eventsOf(records, 'hit');
    expect(outcome === 'block' ? blocks.length : hits.length).toBe(1);
    expect(outcome === 'block' ? hits.length : blocks.length).toBe(0);
    expect(sim.states[1].health).toBe(outcome === 'block' ? MAX : MAX - DEFAULT_MOVES[button].damage);
    sim.dispose();
  });

  it('a low guard crouches, so a high light attack does not even reach it', () => {
    const sim = setup();
    const records = run(sim, 30, pressAt(0, 'light'), guard('low'));
    expect(records.flatMap((r) => r.events)).toHaveLength(0);
    sim.dispose();
  });

  it('blockstun lasts exactly blockstunFrames, then the defender keeps guarding while the button is held', () => {
    const sim = setup();
    const heavy = DEFAULT_MOVES.heavy;
    const records = run(sim, 11, pressAt(0, 'heavy'), guard('high'));
    expect(eventsOf(records, 'block').map((b) => b.step)).toEqual([10]);
    let frozen = 0;
    while (!sim.step(dt, [IDLE, input({ guard: 'high' })])) frozen++;
    expect(frozen).toBe(heavy.blockStopFrames);
    // That advancing step was blockstun frame 1; frames 2..N follow.
    for (let i = 1; i < heavy.blockstunFrames; i++) {
      expect(sim.states[1].phase).toBe('blockstun');
      sim.step(dt, [IDLE, input({ guard: 'high' })]);
    }
    expect(sim.states[1].phase).toBe('blockstun');
    sim.step(dt, [IDLE, input({ guard: 'high' })]);
    expect(sim.states[1].phase).toBe('guard');
    sim.dispose();
  });

  it('cannot block while attacking: a guard held during your own attack does nothing', () => {
    const sim = setup();
    const p2: InputScript = (t) => input({ guard: 'high', ...(t === 0 ? { press: 'heavy' as const } : {}) });
    const records = run(sim, 20, pressAt(0, 'light'), p2);
    expect(eventsOf(records, 'hit').map((h) => h.step)).toEqual([5]);
    expect(eventsOf(records, 'block')).toHaveLength(0);
    expect(sim.states[1].phase).toBe('hitstun'); // P2's heavy was interrupted
    sim.dispose();
  });

  it('cannot block in hitstun', () => {
    const sim = setup();
    run(sim, 5, pressAt(0, 'light'), () => input({ guard: 'high' }));
    // Force P2 into hitstun just before the light becomes active, still holding guard.
    enterStun(sim.states[1], 'hitstun', 30);
    const records = run(sim, 1, idle, () => input({ guard: 'high' }), 5);
    expect(eventsOf(records, 'hit')).toHaveLength(1);
    sim.dispose();
  });

  it('cannot block while airborne', () => {
    const sim = setup();
    // Jump first (guard would keep P2 on the ground), then hold guard while airborne.
    const p2: InputScript = (t) => (t === 0 ? input({ intent: { jump: true } }) : input({ guard: 'high' }));
    const records = run(sim, 8, pressAt(0, 'light'), p2);
    expect(eventsOf(records, 'hit')).toHaveLength(1);
    expect(eventsOf(records, 'block')).toHaveLength(0);
    sim.dispose();
  });

  it('a guard only covers the front: an attack from behind is a hit', () => {
    const sim = setup();
    run(sim, 5, pressAt(0, 'light'), () => input({ guard: 'high' }));
    // P2 is guarding facing P1; turn P2 around so P1 is behind it.
    sim.fighters[1].motion = { ...sim.fighters[1].motion, facing: 1 };
    sim.states[1].phase = 'blockstun'; // locked facing, still "guarding"
    sim.states[1].duration = 30;
    const records = run(sim, 1, idle, () => input({ guard: 'high' }), 5);
    expect(eventsOf(records, 'hit')).toHaveLength(1);
    sim.dispose();
  });
});

describe('pushback and corners', () => {
  const settle = (sim: CombatSimulation, p2: InputScript = idle) => run(sim, 60, idle, p2, 1000);

  it('hit pushback slides the defender exactly hitPushback away; the attacker stays put', () => {
    const sim = setup();
    run(sim, 6, pressAt(0, 'heavy'));
    run(sim, 6, idle, idle, 6);
    settle(sim);
    expect(sim.fighters[0].x).toBe(-0.5);
    expect(sim.fighters[1].x).toBeCloseTo(0.5 + DEFAULT_MOVES.heavy.hitPushback, 9);
    sim.dispose();
  });

  it('block pushback uses blockPushback', () => {
    const sim = setup();
    run(sim, 12, pressAt(0, 'heavy'), () => input({ guard: 'high' }));
    settle(sim, () => input({ guard: 'high' }));
    expect(sim.fighters[1].x).toBeCloseTo(0.5 + DEFAULT_MOVES.heavy.blockPushback, 9);
    sim.dispose();
  });

  it('a cornered defender cannot slide, so the attacker is pushed back instead', () => {
    const wall = setup().movement.spacing.maxX;
    const sim = setup(wall - 1, wall);
    run(sim, 12, pressAt(0, 'heavy'));
    settle(sim);
    expect(sim.fighters[1].x).toBeCloseTo(wall, 9);
    expect(sim.fighters[0].x).toBeCloseTo(wall - 1 - DEFAULT_MOVES.heavy.hitPushback, 9);
    sim.dispose();
  });
});

describe('knockdown, get-up and invulnerability', () => {
  it('the special launches, lands into knockdown, gets up, then is actionable again', () => {
    const { knockdownFrames, getupFrames } = DEFAULT_COMBAT_CONFIG;
    const sim = setup();
    const records = run(sim, 15, pressAt(0, 'special'));
    const hit = eventsOf(records, 'hit')[0]!.event;
    expect(hit.type === 'hit' && hit.knockdown).toBe(true);
    expect(sim.states[1].phase).toBe('launched');
    expect(sim.hurtbox(1)).toBeNull();

    const phases: string[] = [];
    for (let t = 0; t < 200; t++) {
      if (sim.step(dt, [IDLE, IDLE])) phases.push(sim.states[1].phase);
    }
    const count = (p: string) => phases.filter((x) => x === p).length;
    expect(count('launched')).toBeGreaterThan(10);
    expect(count('knockdown')).toBe(knockdownFrames + 1); // the landing frame plus knockdownFrames
    expect(count('getup')).toBe(getupFrames);
    expect(phases[phases.length - 1]).toBe('neutral');
    expect(sim.states[1].health).toBe(MAX - 120);
    expect(sim.fighters[1].y).toBe(0);
    sim.dispose();
  });

  it('attacks pass through a knocked-down or getting-up fighter', () => {
    const sim = setup();
    run(sim, 15, pressAt(0, 'special'));
    run(sim, 60, idle, idle, 15); // through hit-stop, the launch and into knockdown
    expect(['knockdown', 'getup']).toContain(sim.states[1].phase);
    for (const phase of ['knockdown', 'getup'] as const) {
      sim.resetRound(-0.5, 0.5);
      sim.states[1].phase = phase;
      sim.states[1].duration = 100;
      const records = run(sim, 12, pressAt(0, 'heavy'));
      expect(eventsOf(records, 'hit'), phase).toHaveLength(0);
    }
    sim.dispose();
  });
});

describe('hit-stop', () => {
  it('freezes attack frames, stun, positions and the combat clock for hitStopFrames steps', () => {
    const sim = setup();
    run(sim, 6, pressAt(0, 'heavy'), idle);
    run(sim, 5, idle, idle, 6); // hit on step 10
    const frozenAt = { frame: sim.frame, a: { ...sim.states[0] }, b: { ...sim.states[1] }, x: sim.fighters.map((f) => f.x) };
    const steps = run(sim, DEFAULT_MOVES.heavy.hitStopFrames + 1, idle, idle, 11);
    expect(steps.map((s) => s.advanced)).toEqual([...Array(DEFAULT_MOVES.heavy.hitStopFrames).fill(false), true]);
    // During the freeze nothing moved; on the next advancing step everything resumes.
    const sim2 = setup();
    run(sim2, 11, pressAt(0, 'heavy'));
    for (let i = 0; i < DEFAULT_MOVES.heavy.hitStopFrames; i++) {
      sim2.step(dt, [IDLE, IDLE]);
      expect(sim2.frame).toBe(frozenAt.frame);
      expect(sim2.states[0].frame).toBe(frozenAt.a.frame);
      expect(sim2.states[1].frame).toBe(frozenAt.b.frame);
      expect(sim2.fighters.map((f) => f.x)).toEqual(frozenAt.x);
      expect(sim2.fighters[1].previousX).toBe(sim2.fighters[1].x); // render holds still
    }
    sim.dispose();
    sim2.dispose();
  });

  it('presses made during hit-stop are kept and count from the first frame after it', () => {
    const sim = setup();
    run(sim, 6, pressAt(0, 'light')); // hit on step 5
    sim.step(dt, [input({ press: 'heavy' }), IDLE]); // frozen
    expect(sim.buffers[0].peek()).toEqual([{ button: 'heavy', frame: sim.frame + 1 }]);
    for (let i = 1; i < DEFAULT_MOVES.light.hitStopFrames; i++) sim.step(dt, [IDLE, IDLE]);
    expect(sim.buffers[0].size).toBe(1);
    sim.dispose();
  });
});

describe('input buffer in the simulation', () => {
  const lightTotal = 18; // actionable again on step 18 when pressed on step 0

  it('a press 7 frames before recovery ends comes out on the first actionable frame', () => {
    const sim = setup(-3, 3);
    const p1: InputScript = (t) => (t === 0 ? input({ press: 'light' }) : t === lightTotal - 7 ? input({ press: 'heavy' }) : IDLE);
    run(sim, lightTotal + 1, p1);
    expect(sim.states[0].phase).toBe('attack');
    expect(sim.states[0].move?.id).toBe('heavy');
    expect(sim.states[0].frame).toBe(1);
    sim.dispose();
  });

  it('a press 8 frames before recovery ends has expired: buffered actions never bypass recovery', () => {
    const sim = setup(-3, 3);
    const p1: InputScript = (t) => (t === 0 ? input({ press: 'light' }) : t === lightTotal - 8 ? input({ press: 'heavy' }) : IDLE);
    run(sim, lightTotal + 1, p1);
    expect(sim.states[0].phase).toBe('neutral');
    sim.dispose();
  });

  it('a press during hitstun comes out on the first actionable frame (reversal) but not before', () => {
    const sim = setup();
    const light = DEFAULT_MOVES.light;
    // P1 lights P2 (hit on step 5, hit-stop until step 11, hitstun frames on steps 12..26).
    const stunEnd = 5 + light.hitStopFrames + light.hitstunFrames + 1; // first actionable step
    const p2: InputScript = (t) => (t === stunEnd - 3 ? input({ press: 'kick' }) : IDLE);
    const phases: string[] = [];
    for (let t = 0; t <= stunEnd; t++) {
      sim.step(dt, [pressAt(0, 'light')(t), p2(t)]);
      phases.push(sim.states[1].phase);
    }
    expect(phases[stunEnd - 1]).toBe('hitstun');
    expect(phases[stunEnd]).toBe('attack');
    expect(sim.states[1].move?.id).toBe('kick');
    sim.dispose();
  });

  it('simultaneous presses resolve to the highest-priority move', () => {
    const sim = setup(-3, 3);
    run(sim, 1, () => input({ press: ['light', 'kick', 'heavy'] }));
    expect(sim.states[0].move?.id).toBe('heavy');
    sim.dispose();
  });

  it('there are no air attacks: a press in the air comes out on landing if still within the window', () => {
    const sim = setup(-3, 3);
    const PRESS = 36; // late in the ~39-frame jump
    const p1: InputScript = (t) => input({ intent: { jump: t === 0 }, ...(t === PRESS ? { press: 'light' as const } : {}) });
    const trace: { grounded: boolean; phase: string }[] = [];
    for (let t = 0; t < 50; t++) {
      sim.step(dt, [p1(t), IDLE]);
      trace.push({ grounded: sim.fighters[0].motion.grounded, phase: sim.states[0].phase });
    }
    const landed = trace.findIndex((s, t) => t > 0 && s.grounded);
    expect(landed).toBeGreaterThan(PRESS);
    expect(landed + 1 - PRESS).toBeLessThan(DEFAULT_COMBAT_CONFIG.inputBufferFrames);
    expect(trace.slice(0, landed + 1).every((s) => s.phase !== 'attack')).toBe(true);
    expect(trace[landed + 1]!.phase).toBe('attack');
    sim.dispose();
  });
});

describe('simultaneous hits and frame advantage', () => {
  it('two attacks connecting on the same frame trade, independent of P1/P2 order', () => {
    const sim = setup();
    const records = run(sim, 10, pressAt(0, 'light'), pressAt(0, 'light'));
    expect(eventsOf(records, 'hit').map((h) => h.step)).toEqual([5, 5]);
    expect(sim.states.map((s) => s.health)).toEqual([MAX - 40, MAX - 40]);
    expect(sim.states.map((s) => s.phase)).toEqual(['hitstun', 'hitstun']);
    expect(sim.lastExchange).toBeNull();
    sim.dispose();
  });

  it.each([
    ['light', 'hit', 3],
    ['light', 'block', -1],
    ['heavy', 'hit', 1],
    ['heavy', 'block', -5],
    ['kick', 'block', -4],
  ] as const)('measured advantage: %s on %s = %i (matches frame data)', (button, result, expected) => {
    const sim = setup();
    const p2: InputScript = () => (result === 'block' ? input({ guard: button === 'kick' ? 'low' : 'high' }) : IDLE);
    run(sim, 80, pressAt(0, button), p2);
    expect(sim.lastExchange?.result).toBe(result);
    expect(exchangeAdvantage(sim.lastExchange!)).toBe(expected);
    sim.dispose();
  });
});

describe('determinism', () => {
  const snapshot = (sim: CombatSimulation) => ({
    frame: sim.frame,
    hitstop: sim.hitstop,
    fighters: sim.fighters.map((f) => ({ x: f.x, y: f.y, motion: f.motion })),
    states: sim.states.map((s) => ({ ...s, move: s.move?.id ?? null, pushback: s.pushback ? { ...s.pushback } : null })),
    events: [...sim.events],
  });

  it('replays a 3000-step seeded fight identically, step for step', () => {
    const a = randomCombatScript(11, 3000, 1);
    const b = randomCombatScript(29, 3000, -1);
    const trace = () => {
      const sim = setup(-1.5, 1.5);
      const out = [];
      for (let t = 0; t < 3000; t++) {
        sim.step(dt, [a(t), b(t)]);
        out.push(snapshot(sim));
      }
      sim.dispose();
      return out;
    };
    const first = trace();
    const second = trace();
    expect(second).toEqual(first);
    // The script actually fought: there were hits, blocks and knockdowns.
    const events = first.flatMap((s) => s.events);
    expect(events.filter((e) => e.type === 'hit').length).toBeGreaterThan(5);
    expect(events.filter((e) => e.type === 'block').length).toBeGreaterThan(0);
  });

  it('does not depend on render frame rate: 30, 60, 144 fps and jittery frames give the same fight', () => {
    const STEPS = 1500;
    const a = randomCombatScript(5, STEPS, 1);
    const b = randomCombatScript(6, STEPS, -1);
    const simulate = (frameDelta: () => number) => {
      const sim = setup(-1.5, 1.5);
      let t = 0;
      const loop = new GameLoop({ update: (step) => { if (t < STEPS) { sim.step(step, [a(t), b(t)]); t++; } }, render: () => {} }, { stepsPerSecond: 60 });
      while (t < STEPS) loop.advance(frameDelta());
      const out = snapshot(sim);
      sim.dispose();
      return out;
    };
    const reference = simulate(() => 1 / 60);
    const jitter = lcg(77);
    expect(simulate(() => 1 / 30)).toEqual(reference);
    expect(simulate(() => 1 / 144)).toEqual(reference);
    expect(simulate(() => 0.004 + jitter() * 0.05)).toEqual(reference);
  });
});
