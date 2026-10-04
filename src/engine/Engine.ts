import type { PerspectiveCamera, Scene } from 'three';
import { GameLoop, type GameLoopOptions } from './GameLoop';
import { InputManager } from './input';
import { RenderContext, type RenderContextOptions } from './RenderContext';
import { StateMachine } from './state';

/** What game states are allowed to touch. Deliberately narrow. */
export interface EngineContext {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly input: InputManager;
  readonly states: StateMachine<EngineContext>;
  /** Wall-clock seconds since the engine started, advanced in fixed steps. */
  readonly time: { elapsed: number; frames: number };
}

export interface EngineOptions {
  render?: RenderContextOptions;
  loop?: Omit<GameLoopOptions, 'scheduler' | 'now'>;
  /** Element that receives keyboard events. Defaults to `window`. */
  inputTarget?: EventTarget;
}

/**
 * Composes the render context, input, state machine and loop.
 * Per step: poll input -> update top state. Per frame: render top state -> draw.
 */
export class Engine {
  readonly render: RenderContext;
  readonly input: InputManager;
  readonly states: StateMachine<EngineContext>;
  readonly context: EngineContext;
  private readonly loop: GameLoop;

  constructor(container: HTMLElement, options: EngineOptions = {}) {
    this.render = new RenderContext(container, options.render);
    this.input = new InputManager(options.inputTarget ?? window);

    const time = { elapsed: 0, frames: 0 };
    const context = {
      scene: this.render.scene,
      camera: this.render.camera,
      input: this.input,
      time,
    } as Omit<EngineContext, 'states'> & { states?: StateMachine<EngineContext> };
    this.states = new StateMachine<EngineContext>(context as EngineContext);
    context.states = this.states;
    this.context = context as EngineContext;

    this.loop = new GameLoop(
      {
        update: (dt) => {
          this.input.poll();
          this.states.update(dt);
          time.elapsed += dt;
        },
        render: (alpha) => {
          this.states.render(alpha);
          this.render.render();
          time.frames++;
        },
      },
      options.loop,
    );
  }

  get running(): boolean {
    return this.loop.running;
  }

  get simulationSteps(): number {
    return this.loop.steps;
  }

  start(initialState?: string): void {
    if (initialState) this.states.change(initialState);
    this.input.attach();
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
    this.input.detach();
  }

  dispose(): void {
    this.stop();
    this.states.clear();
    this.render.dispose();
  }
}
