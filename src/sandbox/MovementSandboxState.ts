import { BoxGeometry, CapsuleGeometry, Group, MathUtils, Mesh, type BufferGeometry } from 'three';
import type { EngineContext } from '../engine';
import type { DebugInfoSource } from '../engine/debug/DebugHud';
import type { GameState } from '../engine/state';
import { DEFAULT_FIGHT_CAMERA, FightCamera, type FightCameraConfig } from '../camera';
import {
  IdleFighterController,
  KeyboardFighterController,
  type Fighter,
  type FighterController,
} from '../fighters';
import type { Rapier } from '../physics';
import { ResourceTracker, buildDebugStage } from './debugStage';
import { SandboxSimulation, STAGE_HALF_WIDTH } from './SandboxSimulation';

export const MOVEMENT_SANDBOX_STATE_ID = 'sandbox.movement';

/** Visual-only squash while crouching. The environment collider does not change (see config.ts). */
const CROUCH_SCALE = 0.62;
/** The camera centre stays this far inside each wall, so walls frame the edge of the screen. */
const CAMERA_WALL_INSET = 2.5;

export interface MovementSandboxOptions {
  /** Fight camera overrides (e.g. `fov`). */
  camera?: Partial<FightCameraConfig>;
}

interface FighterView {
  readonly fighter: Fighter;
  readonly root: Group;
  readonly body: Group;
}

/**
 * Phase 2 movement sandbox: P1 (keyboard) and an idle P2 dummy as placeholder capsules on a
 * flat debug stage, framed by the fight camera. Not an arena, fighter roster or combat.
 *
 * Split of responsibilities: controllers turn devices into intents, `SandboxSimulation` is the
 * deterministic gameplay step, and this state owns all presentation (meshes, fight camera).
 */
export function createMovementSandboxState(
  rapier: Rapier,
  options: MovementSandboxOptions = {},
): GameState<EngineContext> & DebugInfoSource {
  const root = new Group();
  root.name = 'sandbox.movement';
  const resources = new ResourceTracker();
  const track = <G extends BufferGeometry>(g: G): G => resources.geometry(g);
  const stage = buildDebugStage(root, resources);

  let simulation: SandboxSimulation | null = null;
  let controllers: readonly [FighterController, FighterController] | null = null;
  let views: FighterView[] = [];
  let previousFov: number | null = null;
  const fightCamera = new FightCamera({
    ...DEFAULT_FIGHT_CAMERA,
    boundsX: [-(STAGE_HALF_WIDTH - CAMERA_WALL_INSET), STAGE_HALF_WIDTH - CAMERA_WALL_INSET],
    ...options.camera,
  });

  const buildView = (fighter: Fighter, color: number): FighterView => {
    const { radius, halfHeight } = fighter.config.body;
    const view = new Group();
    view.name = `sandbox.fighter.${fighter.id}`;
    const body = new Group();
    const capsule = new Mesh(track(new CapsuleGeometry(radius, halfHeight * 2, 6, 16)), resources.paint(color, { roughness: 0.45 }));
    capsule.position.y = fighter.height / 2;
    capsule.castShadow = true;
    // A "nose" so facing is readable on a symmetric capsule.
    const nose = new Mesh(track(new BoxGeometry(0.22, 0.12, 0.16)), resources.paint(0xf4f0ff));
    nose.position.set(radius, fighter.height * 0.78, 0);
    nose.castShadow = true;
    body.add(capsule, nose);
    view.add(body);
    root.add(view);
    return { fighter, root: view, body };
  };

  return {
    id: MOVEMENT_SANDBOX_STATE_ID,

    enter({ scene, camera, input }) {
      simulation = new SandboxSimulation(rapier);
      controllers = [new KeyboardFighterController(input), new IdleFighterController()];
      const [p1, p2] = simulation.fighters;
      views = [buildView(p1, 0xff3d81), buildView(p2, 0x3dd6ff)];
      fightCamera.snap(p1, p2, camera.aspect);
      previousFov = camera.fov;
      scene.add(root);
    },

    exit({ scene, camera }) {
      scene.remove(root);
      if (previousFov !== null) {
        camera.fov = previousFov;
        camera.updateProjectionMatrix();
      }
      for (const view of views) root.remove(view.root);
      views = [];
      simulation?.dispose();
      simulation = null;
      controllers = null;
      resources.dispose();
      stage.dispose();
    },

    update(dt, { camera }) {
      if (!simulation || !controllers) return;
      simulation.step(dt, controllers[0].readIntent(), controllers[1].readIntent());
      // Presentation: ticked here (not in render) only so smoothing is FPS-independent.
      const [p1, p2] = simulation.fighters;
      fightCamera.update(dt, p1, p2, camera.aspect);
    },

    render(alpha, { camera }) {
      if (!simulation) return;
      for (const { fighter, root: view, body } of views) {
        view.position.set(
          MathUtils.lerp(fighter.previousX, fighter.x, alpha),
          MathUtils.lerp(fighter.previousY, fighter.y, alpha),
          0,
        );
        view.rotation.y = fighter.motion.facing === 1 ? 0 : Math.PI;
        body.scale.y = fighter.motion.posture === 'crouch' ? CROUCH_SCALE : 1;
      }
      fightCamera.apply(camera, alpha);
    },

    debugLines() {
      const lines = ['A/D or ←/→ walk · W/↑ jump · S/↓ crouch   (P2 is an idle dummy)'];
      if (!simulation) return lines;
      for (const f of simulation.fighters) {
        lines.push(
          `${f.id}  x ${f.x.toFixed(2).padStart(6)}  y ${f.y.toFixed(2)}  ${f.motion.posture.padEnd(11)} facing ${f.motion.facing === 1 ? '→' : '←'}`,
        );
      }
      const [p1, p2] = simulation.fighters;
      const frame = fightCamera.frame;
      lines.push(`gap ${Math.abs(p2.x - p1.x).toFixed(2)}  cam dist ${frame ? frame.distance.toFixed(2) : '-'}`);
      return lines;
    },
  };
}
