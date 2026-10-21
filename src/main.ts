import './style.css';
import { Engine } from './engine';
import { DebugHud, hasDebugLines } from './engine/debug/DebugHud';
import {
  FOUNDATION_TEST_STATE_ID,
  createFoundationTestState,
} from './engine/debug/FoundationTestState';
import { loadCharacterModels } from './animation';
import { DEFAULT_MATCHUP, getCharacter } from './fighters/characters';
import { CHARACTER_MODEL_URLS } from './fighters/characters/models';
import { loadRapier } from './physics';
import {
  COMBAT_SANDBOX_STATE_ID,
  MOVEMENT_SANDBOX_STATE_ID,
  createCombatSandboxState,
  createMovementSandboxState,
} from './sandbox';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

async function main(root: HTMLElement): Promise<void> {
  // Physics WASM and both fighters' GLBs load in parallel; all are bundled (offline).
  const [rapier, models] = await Promise.all([loadRapier(), loadCharacterModels(CHARACTER_MODEL_URLS)]);
  const params = new URLSearchParams(window.location.search);
  // `?p1=rex&p2=vera` picks the fighters (mirror matches allowed); default VERA vs REX.
  const roster = [
    getCharacter(params.get('p1') ?? '') ?? DEFAULT_MATCHUP[0],
    getCharacter(params.get('p2') ?? '') ?? DEFAULT_MATCHUP[1],
  ] as const;

  const engine = new Engine(root);
  engine.states
    .register(FOUNDATION_TEST_STATE_ID, createFoundationTestState)
    .register(MOVEMENT_SANDBOX_STATE_ID, () => createMovementSandboxState(rapier))
    .register(COMBAT_SANDBOX_STATE_ID, () => createCombatSandboxState(rapier, { hudParent: root, roster, models }));

  // Default: the Phase 3 combat sandbox. `?state=sandbox.movement` opens the Phase 2 movement
  // sandbox and `?state=debug.foundation` the Phase 1 runtime proof.
  const requested = params.get('state');
  const initial = requested && engine.states.has(requested) ? requested : COMBAT_SANDBOX_STATE_ID;

  const hud = new DebugHud(root);
  const tickHud = (now: number): void => {
    const state = engine.states.current;
    hud.tick(now, {
      steps: engine.simulationSteps,
      state: state?.id ?? 'none',
      ...(hasDebugLines(state) ? { lines: () => state.debugLines() } : {}),
    });
    if (engine.running) requestAnimationFrame(tickHud);
  };

  engine.start(initial);
  requestAnimationFrame(tickHud);
  document.documentElement.dataset.engine = 'running';

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      engine.dispose();
      hud.dispose();
    });
  }
}

main(container).catch((error: unknown) => {
  document.documentElement.dataset.engine = 'failed';
  console.error('Failed to start BRAIN ROT: LEGENDS', error);
});
