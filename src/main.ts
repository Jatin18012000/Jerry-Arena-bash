import './style.css';
import { Engine } from './engine';
import { DebugHud, hasDebugLines } from './engine/debug/DebugHud';
import {
  FOUNDATION_TEST_STATE_ID,
  createFoundationTestState,
} from './engine/debug/FoundationTestState';
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
  const rapier = await loadRapier();

  const engine = new Engine(root);
  engine.states
    .register(FOUNDATION_TEST_STATE_ID, createFoundationTestState)
    .register(MOVEMENT_SANDBOX_STATE_ID, () => createMovementSandboxState(rapier))
    .register(COMBAT_SANDBOX_STATE_ID, () => createCombatSandboxState(rapier, { hudParent: root }));

  // Default: the Phase 3 combat sandbox. `?state=sandbox.movement` opens the Phase 2 movement
  // sandbox and `?state=debug.foundation` the Phase 1 runtime proof.
  const requested = new URLSearchParams(window.location.search).get('state');
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
