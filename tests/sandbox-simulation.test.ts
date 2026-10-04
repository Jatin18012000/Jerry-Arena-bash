import { PerspectiveCamera, Scene } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineContext } from '../src/engine';
import { hasDebugLines } from '../src/engine/debug/DebugHud';
import { GameLoop } from '../src/engine/GameLoop';
import { InputAction, type InputManager } from '../src/engine/input';
import { NEUTRAL_INTENT, PLACEHOLDER_FIGHTER, type FighterIntent } from '../src/fighters';
import { loadRapier, type Rapier } from '../src/physics';
import {
  MAX_SEPARATION,
  MOVEMENT_SANDBOX_STATE_ID,
  SandboxSimulation,
  createMovementSandboxState,
} from '../src/sandbox';

const dt = 1 / 60;
const aspect = 16 / 9;
const CONTACT_GAP = PLACEHOLDER_FIGHTER.body.pushHalfWidth * 2;

/** An input script: the intent for each fixed tick. */
type Script = (tick: number) => Partial<FighterIntent>;
const idle: Script = () => ({});
const hold = (x: -1 | 1): Script => () => ({ x });
const intentOf = (script: Script, tick: number): FighterIntent => ({ ...NEUTRAL_INTENT, ...script(tick) });

interface Frame {
  readonly p1: readonly [number, number];
  readonly p2: readonly [number, number];
  readonly gap: number;
}

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Run a fresh simulation for `ticks` steps and record every tick. */
function run(p1: Script, p2: Script, ticks: number) {
  const sim = new SandboxSimulation(rapier);
  const trace: Frame[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(dt, intentOf(p1, t), intentOf(p2, t));
    const [a, b] = sim.fighters;
    trace.push({ p1: [a.x, a.y], p2: [b.x, b.y], gap: b.x - a.x });
  }
  return { sim, trace, last: trace[trace.length - 1]! };
}

/** Small deterministic PRNG so "random" input sequences are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

/** A seeded, meaningful mix of walks, jumps, crouches and idles, held for random durations. */
function randomScript(seed: number, ticks: number): Script {
  const next = lcg(seed);
  const intents: FighterIntent[] = [];
  while (intents.length < ticks) {
    const roll = next();
    const x = (Math.floor(next() * 3) - 1) as -1 | 0 | 1;
    const intent: FighterIntent = { x, jump: roll > 0.85, crouch: roll < 0.15 };
    const duration = 1 + Math.floor(next() * 40);
    for (let i = 0; i < duration; i++) intents.push(intent);
  }
  return (t) => intents[t] ?? NEUTRAL_INTENT;
}

describe('SandboxSimulation: movement (Rapier)', () => {
  it('fighters rest on the floor, grounded and facing each other', () => {
    const { sim } = run(idle, idle, 30);
    const [p1, p2] = sim.fighters;
    for (const f of sim.fighters) {
      expect(f.y).toBe(0);
      expect(f.motion.grounded).toBe(true);
    }
    expect(p1.motion.facing).toBe(1);
    expect(p2.motion.facing).toBe(-1);
    sim.dispose();
  });

  it('a neutral jump leaves the floor, clears roughly head height and lands again', () => {
    const { sim, trace } = run((t) => ({ jump: t === 0 }), idle, 90);
    const maxY = Math.max(...trace.map((f) => f.p1[1]));
    expect(maxY).toBeGreaterThan(1.5);
    expect(sim.fighters[0].motion.grounded).toBe(true);
    expect(sim.fighters[0].y).toBe(0);
    sim.dispose();
  });

  it('crouching holds position even with a direction held', () => {
    const { sim, trace } = run(() => ({ x: 1, crouch: true }), idle, 60);
    expect(trace[59]!.p1[0]).toBe(trace[0]!.p1[0]);
    expect(sim.fighters[0].motion.posture).toBe('crouch');
    sim.dispose();
  });

  it('never leaves the z = 0 fight plane, the floor or the walls under random input', () => {
    const sim = new SandboxSimulation(rapier);
    const a = randomScript(1, 900);
    const b = randomScript(2, 900);
    for (let t = 0; t < 900; t++) {
      sim.step(dt, intentOf(a, t), intentOf(b, t));
      for (const f of sim.fighters) {
        expect(f.y).toBeGreaterThanOrEqual(-1e-3);
        expect(f.x).toBeGreaterThanOrEqual(sim.spacing.minX - 1e-9);
        expect(f.x).toBeLessThanOrEqual(sim.spacing.maxX + 1e-9);
      }
      sim.physics.world.forEachRigidBody((body) => expect(body.translation().z).toBe(0));
    }
    sim.dispose();
  });
});

describe('SandboxSimulation: spacing / pushboxes (Rapier)', () => {
  it('approaching: one fighter walks into the other, never overlaps and pushes at half speed', () => {
    const { sim, trace, last } = run(hold(1), idle, 240);
    expect(Math.min(...trace.map((f) => f.gap))).toBeGreaterThanOrEqual(CONTACT_GAP - 1e-9);
    expect(last.gap).toBeCloseTo(CONTACT_GAP, 9);
    // Once in contact, P2 is pushed at half of P1's forward walk speed.
    const pushSpeed = (trace[239]!.p2[0] - trace[179]!.p2[0]) / (60 * dt);
    expect(pushSpeed).toBeCloseTo(PLACEHOLDER_FIGHTER.motion.walkForwardSpeed / 2, 3);
    sim.dispose();
  });

  it('both walking into each other meet in the middle and stop, symmetrically', () => {
    const { sim, trace, last } = run(hold(1), hold(-1), 180);
    expect(last.gap).toBeCloseTo(CONTACT_GAP, 9);
    expect(last.p1[0]).toBeCloseTo(-last.p2[0], 9);
    expect(trace[179]!.p1[0]).toBeCloseTo(trace[120]!.p1[0], 9); // no drift while pressing
    sim.dispose();
  });

  it('has no P1/P2 ordering bias: P2 walking into P1 mirrors P1 walking into P2', () => {
    const p1Walks = run(hold(1), idle, 240);
    const p2Walks = run(idle, hold(-1), 240);
    for (let t = 0; t < 240; t++) {
      expect(p2Walks.trace[t]!.p2[0]).toBeCloseTo(-p1Walks.trace[t]!.p1[0], 9);
      expect(p2Walks.trace[t]!.p1[0]).toBeCloseTo(-p1Walks.trace[t]!.p2[0], 9);
    }
    p1Walks.sim.dispose();
    p2Walks.sim.dispose();
  });

  it('standing at maximum distance: both walking back stop exactly at the limit, symmetrically', () => {
    const { sim, last } = run(hold(-1), hold(1), 300);
    expect(last.gap).toBeCloseTo(MAX_SEPARATION, 9);
    expect(last.p1[0]).toBeCloseTo(-last.p2[0], 9);
    sim.dispose();
  });

  it('walking back alone stops at max separation without dragging the idle opponent', () => {
    const { sim, trace, last } = run(hold(-1), idle, 600);
    expect(Math.max(...trace.map((f) => f.gap))).toBeLessThanOrEqual(MAX_SEPARATION + 1e-9);
    expect(last.p2[0]).toBe(trace[0]!.p2[0]);
    sim.dispose();
  });

  it('reversing direction after contact walks away at back-walk speed and leaves the opponent', () => {
    const { sim, trace } = run((t) => ({ x: t < 120 ? 1 : -1 }), idle, 180);
    expect(trace[119]!.gap).toBeCloseTo(CONTACT_GAP, 9);
    const retreat = (trace[121]!.p1[0] - trace[179]!.p1[0]) / (58 * dt);
    expect(retreat).toBeCloseTo(PLACEHOLDER_FIGHTER.motion.walkBackSpeed, 3);
    expect(trace[179]!.p2[0]).toBe(trace[121]!.p2[0]);
    sim.dispose();
  });

  it('pushing the opponent into the wall stops both: the wall wins, no overlap', () => {
    const { sim, last } = run(hold(1), idle, 600);
    expect(last.p2[0]).toBeCloseTo(sim.spacing.maxX, 9);
    expect(last.gap).toBeCloseTo(CONTACT_GAP, 9);
    sim.dispose();
  });
});

describe('SandboxSimulation: jump / cross-up regression (pushHeight = 1.0 m)', () => {
  it('a point-blank forward jump crosses over the opponent and both turn around on landing', () => {
    // Walk into the opponent (pushboxes touching), then jump forward over their short pushbox.
    const { sim, trace } = run((t) => ({ x: t <= 60 ? 1 : 0, jump: t === 60 }), idle, 150);
    const [p1, p2] = sim.fighters;
    expect(trace[60]!.gap).toBeCloseTo(CONTACT_GAP, 9);
    expect(p1.x).toBeGreaterThan(p2.x);
    expect(p1.x - p2.x).toBeGreaterThanOrEqual(CONTACT_GAP - 1e-9);
    expect(p1.motion.facing).toBe(-1);
    expect(p2.motion.facing).toBe(1);
    sim.dispose();
  });

  it('a mid-range forward jump lands in front of the opponent (no cross-up)', () => {
    const { sim } = run((t) => ({ x: t === 0 ? 1 : 0, jump: t === 0 }), idle, 120);
    const [p1, p2] = sim.fighters;
    expect(p1.x).toBeLessThan(p2.x);
    expect(p1.motion.facing).toBe(1);
    sim.dispose();
  });
});

describe('SandboxSimulation: determinism', () => {
  it('replays a 900-tick seeded input sequence identically, tick for tick', () => {
    const a = randomScript(42, 900);
    const b = randomScript(7, 900);
    const first = run(a, b, 900);
    const second = run(a, b, 900);
    expect(second.trace).toEqual(first.trace);
    expect(second.sim.fighters.map((f) => f.motion)).toEqual(first.sim.fighters.map((f) => f.motion));
    first.sim.dispose();
    second.sim.dispose();
  });

  it('does not depend on render frame rate: 30, 60, 144 fps and jittery frames give the same state', () => {
    const TICKS = 600;
    const a = randomScript(3, TICKS);
    const b = randomScript(4, TICKS);

    const simulateWithFrames = (frameDelta: () => number) => {
      const sim = new SandboxSimulation(rapier);
      const loop = new GameLoop(
        {
          update: (step) => {
            if (sim.ticks < TICKS) sim.step(step, intentOf(a, sim.ticks), intentOf(b, sim.ticks));
          },
          render: () => {},
        },
        { stepsPerSecond: 60 },
      );
      while (sim.ticks < TICKS) loop.advance(frameDelta());
      const out = sim.fighters.map((f) => ({ x: f.x, y: f.y, motion: f.motion }));
      sim.dispose();
      return out;
    };

    const reference = simulateWithFrames(() => 1 / 60);
    const jitter = lcg(99);
    expect(simulateWithFrames(() => 1 / 30)).toEqual(reference);
    expect(simulateWithFrames(() => 1 / 144)).toEqual(reference);
    expect(simulateWithFrames(() => 0.004 + jitter() * 0.05)).toEqual(reference);
  });
});

describe('loadRapier', () => {
  it('initialises the WASM module once and reuses it', async () => {
    const first = loadRapier();
    expect(loadRapier()).toBe(first);
    expect(await first).toBe(rapier);
  });
});

describe('movement sandbox state', () => {
  it('runs headless through enter/update/render/exit and cleans up', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, aspect, 0.1, 200);
    const held = new Set<string>([InputAction.Right]);
    const input = { isDown: (a: string) => held.has(a) } as unknown as InputManager;
    const context = { scene, camera, input, time: { elapsed: 0, frames: 0 } } as unknown as EngineContext;

    const state = createMovementSandboxState(rapier, { camera: { fov: 28 } });
    expect(state.id).toBe(MOVEMENT_SANDBOX_STATE_ID);
    state.enter?.(context);
    expect(scene.getObjectByName('sandbox.fighter.P1')).toBeDefined();
    expect(scene.getObjectByName('sandbox.fighter.P2')).toBeDefined();

    state.render?.(1, context);
    const startX = scene.getObjectByName('sandbox.fighter.P1')!.position.x;
    const p2X = scene.getObjectByName('sandbox.fighter.P2')!.position.x;
    expect(startX).toBeLessThan(0);
    for (let i = 0; i < 30; i++) state.update?.(dt, context);
    state.render?.(1, context);
    expect(scene.getObjectByName('sandbox.fighter.P1')!.position.x).toBeGreaterThan(startX);
    expect(scene.getObjectByName('sandbox.fighter.P2')!.position.x).toBe(p2X); // idle dummy
    expect(camera.position.z).toBeGreaterThan(0);
    expect(camera.fov).toBe(28); // camera FOV is configurable
    expect(hasDebugLines(state) && state.debugLines().some((l) => l.startsWith('P1'))).toBe(true);

    state.exit?.(context);
    expect(scene.getObjectByName('sandbox.movement')).toBeUndefined();
    expect(camera.fov).toBe(45); // engine camera restored
  });
});
