// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Scene, SkinnedMesh } from 'three';
import { CharacterModels, parseCharacterModel, type LoadedCharacterModel } from '../src/animation';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_CONFIG } from '../src/combat';
import { HitSparks, ScreenShake } from '../src/effects';
import type { EngineContext } from '../src/engine';
import { hasDebugLines } from '../src/engine/debug/DebugHud';
import { InputAction, type InputManager } from '../src/engine/input';
import { loadRapier, type Rapier } from '../src/physics';
import { COMBAT_SANDBOX_STATE_ID, createCombatSandboxState } from '../src/sandbox';
import { bannerFor } from '../src/ui';

const dt = 1 / 60;

let rapier: Rapier;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Fake input: `held` actions are down; `tap` actions are "just pressed" on the next poll only. */
function fakeInput() {
  const held = new Set<string>();
  const tapped = new Set<string>();
  const input = {
    isDown: (a: string) => held.has(a),
    justPressed: (a: string) => tapped.has(a),
  } as unknown as InputManager;
  return { input, held, tap: (a: string) => tapped.add(a), clearTaps: () => tapped.clear() };
}

describe('combat sandbox state (headless, jsdom HUD)', () => {
  it('runs a fight through enter / update / render / exit, drives the HUD and cleans up', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 200);
    const { input, held, tap, clearTaps } = fakeInput();
    const context = { scene, camera, input, time: { elapsed: 0, frames: 0 } } as unknown as EngineContext;
    const hudParent = document.createElement('div');
    const state = createCombatSandboxState(rapier, { hudParent, match: { ...DEFAULT_MATCH_CONFIG, introFrames: 5 } });
    expect(state.id).toBe(COMBAT_SANDBOX_STATE_ID);

    state.enter?.(context);
    expect(scene.getObjectByName('sandbox.fighter.P1')).toBeDefined();
    expect(scene.getObjectByName('sandbox.fighter.P2')).toBeDefined();
    state.render?.(1, context);
    expect(hudParent.querySelector('[data-testid=match-banner]')!.textContent).toMatch(/ROUND 1|FIGHT!/);

    // Walk in and attack the idle dummy until the HUD shows damage.
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        state.update?.(dt, context);
        clearTaps();
      }
      state.render?.(1, context);
    };
    step(10);
    held.add(InputAction.Right);
    step(60); // VERA walks into REX (contact); her knee reaches 0.8 m + hurtbox
    held.delete(InputAction.Right);
    tap(InputAction.HeavyAttack);
    step(40);
    const p2Health = Number(hudParent.querySelector<HTMLElement>('[data-testid=health-p2]')!.dataset.health);
    expect(p2Health).toBeLessThan(1050); // REX (default P2) has 1050 health
    expect(scene.getObjectByName('effects.hitSparks')).toBeDefined();

    // Training controls: hitbox overlay and dummy mode.
    tap(InputAction.ToggleHitboxes);
    tap(InputAction.TrainingDummy);
    step(1);
    expect(scene.getObjectByName('sandbox.combat.hitboxes')!.visible).toBe(true);
    const lines = hasDebugLines(state) ? state.debugLines() : [];
    expect(lines.some((l) => l.includes('dummy mode (blockHigh)'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Spiral Knee') && l.includes('9/3/17'))).toBe(true); // VERA's heavy
    expect(lines.some((l) => l.startsWith('last: P1 Spiral Knee → HIT'))).toBe(true);

    // Esc restarts the match at full health.
    tap(InputAction.Back);
    step(1);
    expect(hudParent.querySelector<HTMLElement>('[data-testid=health-p2]')!.dataset.health).toBe('1050');

    state.exit?.(context);
    expect(scene.getObjectByName('sandbox.combat')).toBeUndefined();
    expect(hudParent.querySelector('[data-testid=match-hud]')).toBeNull();
    expect(camera.fov).toBe(45);
  });

  it('runs without a HUD parent (no DOM needed)', () => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 200);
    const { input } = fakeInput();
    const context = { scene, camera, input, time: { elapsed: 0, frames: 0 } } as unknown as EngineContext;
    const state = createCombatSandboxState(rapier);
    state.enter?.(context);
    for (let i = 0; i < 5; i++) state.update?.(dt, context);
    state.render?.(0.5, context);
    state.exit?.(context);
    expect(scene.children).toHaveLength(0);
  });
});

describe('combat sandbox with the VERA and REX models', () => {
  it('draws animated GLB fighters, plays their clips from combat state and cleans up', async () => {
    const loaded = new Map<string, LoadedCharacterModel>();
    for (const id of ['vera', 'rex']) {
      const buf = readFileSync(`assets/characters/${id}.glb`);
      // Copy into this realm's ArrayBuffer: jsdom's globals differ from Node's Buffer backing store.
      loaded.set(id, await parseCharacterModel(Uint8Array.from(buf).buffer));
    }
    const models = new CharacterModels(loaded);
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 200);
    const { input, held, tap, clearTaps } = fakeInput();
    const context = { scene, camera, input, time: { elapsed: 0, frames: 0 } } as unknown as EngineContext;
    const hudParent = document.createElement('div');
    const state = createCombatSandboxState(rapier, { hudParent, models, match: { ...DEFAULT_MATCH_CONFIG, introFrames: 5 } });
    state.enter?.(context);

    const p1 = scene.getObjectByName('sandbox.fighter.P1.model')!;
    const p2 = scene.getObjectByName('sandbox.fighter.P2.model')!;
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    let skinned = 0;
    p1.traverse((o) => {
      if (o instanceof SkinnedMesh) skinned++;
    });
    expect(skinned).toBeGreaterThan(0);

    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        state.update?.(dt, context);
        clearTaps();
      }
      state.render?.(1, context);
    };
    step(10);
    expect(hudParent.textContent).toContain('VERA');
    expect(hudParent.textContent).toContain('REX');
    held.add(InputAction.Right);
    step(60);
    held.delete(InputAction.Right);
    tap(InputAction.Special);
    step(20);
    const lines = hasDebugLines(state) ? state.debugLines() : [];
    expect(lines.some((l) => l.startsWith('P1 VERA') && /attack|neutral/.test(l))).toBe(true);
    step(120);
    expect(Number(hudParent.querySelector<HTMLElement>('[data-testid=health-p2]')!.dataset.health)).toBe(1050 - 115);

    state.exit?.(context);
    expect(scene.children).toHaveLength(0);
    models.dispose();
  });
});

describe('match HUD banner', () => {
  const base = { round: 2, lastResult: null, winner: null, config: { ...DEFAULT_MATCH_CONFIG } } as const;
  it('announces the round, FIGHT, KO / TIME, the round winner and the match winner', () => {
    expect(bannerFor({ ...base, phase: 'intro', phaseFrame: 0 })).toBe('ROUND 2');
    expect(bannerFor({ ...base, phase: 'intro', phaseFrame: DEFAULT_MATCH_CONFIG.introFrames - 1 })).toBe('FIGHT!');
    expect(bannerFor({ ...base, phase: 'fight', phaseFrame: 0 })).toBe('FIGHT!');
    expect(bannerFor({ ...base, phase: 'fight', phaseFrame: 100 })).toBeNull();
    const ko = { round: 2, winner: 0, reason: 'ko' } as const;
    expect(bannerFor({ ...base, phase: 'roundOver', phaseFrame: 0, lastResult: ko })).toBe('K.O.');
    expect(bannerFor({ ...base, phase: 'roundOver', phaseFrame: 90, lastResult: ko })).toBe('P1 WINS');
    const time = { round: 2, winner: null, reason: 'timeout' } as const;
    expect(bannerFor({ ...base, phase: 'roundOver', phaseFrame: 0, lastResult: time })).toBe('TIME');
    expect(bannerFor({ ...base, phase: 'roundOver', phaseFrame: 90, lastResult: time })).toBe('DRAW');
    expect(bannerFor({ ...base, phase: 'matchOver', phaseFrame: 0, winner: 1 })).toBe('P2 WINS THE MATCH');
    expect(bannerFor({ ...base, phase: 'matchOver', phaseFrame: 0, winner: 'draw' })).toBe('DRAW GAME');
  });
});

describe('effects (presentation only)', () => {
  it('screen shake decays to rest and is deterministic', () => {
    const run = () => {
      const s = new ScreenShake();
      s.trigger(0.8);
      const out = [];
      for (let i = 0; i < 30; i++) {
        s.update();
        out.push(s.offset(1));
      }
      return { out, active: s.active };
    };
    const a = run();
    expect(a).toEqual(run());
    expect(a.active).toBe(false);
    expect(a.out.at(-1)).toEqual({ x: 0, y: 0 });
    expect(Math.max(...a.out.map((o) => Math.abs(o.x)))).toBeGreaterThan(0);
  });

  it('hit sparks expire after their life', () => {
    const sparks = new HitSparks(2);
    sparks.spawn(0, 1, 'heavyHit');
    expect(sparks.activeCount).toBe(1);
    for (let i = 0; i < 20; i++) sparks.update();
    expect(sparks.activeCount).toBe(0);
    sparks.dispose();
  });
});
