import './style.css';
import { Engine } from './engine';
import { DebugHud } from './engine/debug/DebugHud';
import {
  FOUNDATION_TEST_STATE_ID,
  createFoundationTestState,
} from './engine/debug/FoundationTestState';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const engine = new Engine(container);
engine.states.register(FOUNDATION_TEST_STATE_ID, createFoundationTestState);

const hud = new DebugHud(container);
const tickHud = (now: number): void => {
  hud.tick(now, { steps: engine.simulationSteps, state: engine.states.current?.id ?? 'none' });
  if (engine.running) requestAnimationFrame(tickHud);
};

engine.start(FOUNDATION_TEST_STATE_ID);
requestAnimationFrame(tickHud);
document.documentElement.dataset.engine = 'running';

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    engine.dispose();
    hud.dispose();
  });
}
