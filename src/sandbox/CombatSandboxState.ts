import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  type MeshStandardMaterial,
} from 'three';
import { DEFAULT_FIGHT_CAMERA, FightCamera, type FightCameraConfig } from '../camera';
import {
  KeyboardCombatController,
  Match,
  TrainingDummyController,
  advantageOnBlock,
  advantageOnHit,
  exchangeAdvantage,
  moveStageAt,
  type Box,
  type FighterIndex,
  type MatchConfig,
  type MoveDefinition,
} from '../combat';
import { HitSparks, ScreenShake } from '../effects';
import type { EngineContext } from '../engine';
import type { DebugInfoSource } from '../engine/debug/DebugHud';
import { InputAction } from '../engine/input';
import type { GameState } from '../engine/state';
import type { Fighter } from '../fighters';
import type { Rapier } from '../physics';
import { MatchHud, bannerFor } from '../ui';
import { ResourceTracker, buildDebugStage } from './debugStage';
import { STAGE_HALF_WIDTH } from './SandboxSimulation';

export const COMBAT_SANDBOX_STATE_ID = 'sandbox.combat';

const CROUCH_SCALE = 0.62;
const CAMERA_WALL_INSET = 2.5;
const FIGHTER_COLORS: readonly [number, number] = [0xff3d81, 0x3dd6ff];
const HIT_FLASH = new Color(0xffffff);
const BLOCK_FLASH = new Color(0x4aa8ff);
const NO_FLASH = new Color(0x000000);
const SPECIAL_GLOW = 0xffe066;

export interface CombatSandboxOptions {
  camera?: Partial<FightCameraConfig>;
  match?: MatchConfig;
  /** Element for the DOM match HUD. Omit to run without one (headless tests). */
  hudParent?: HTMLElement;
}

interface FighterView {
  readonly index: FighterIndex;
  readonly fighter: Fighter;
  readonly root: Group;
  readonly body: Group;
  readonly material: MeshStandardMaterial;
  readonly limb: Mesh;
  readonly limbMaterial: MeshStandardMaterial;
  flash: number;
  flashColor: Color;
}

/** Debug wireframe for one combat box. */
interface BoxView {
  readonly lines: LineSegments;
  readonly depth: number;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/**
 * Phase 3 combat sandbox (the default screen): P1 on the keyboard against a training dummy, on
 * the flat debug stage, with a best-of-three match, HUD, hit sparks, screen shake, hitbox
 * overlay and frame-data readout. Placeholder capsules — not final fighters, arena or menus.
 *
 * Presentation only: everything that decides the fight is in `Match` / `CombatSimulation`,
 * which this state drives with controller inputs and reads back for display.
 */
export function createCombatSandboxState(
  rapier: Rapier,
  options: CombatSandboxOptions = {},
): GameState<EngineContext> & DebugInfoSource {
  const root = new Group();
  root.name = 'sandbox.combat';
  const resources = new ResourceTracker();
  const stage = buildDebugStage(root, resources);

  const overlay = new Group();
  overlay.name = 'sandbox.combat.hitboxes';
  overlay.visible = false;
  root.add(overlay);
  const unitBoxEdges = resources.geometry(new EdgesGeometry(new BoxGeometry(1, 1, 1)));
  const boxView = (color: number, depth: number): BoxView => {
    const lines = new LineSegments(unitBoxEdges, resources.material(new LineBasicMaterial({ color })));
    lines.visible = false;
    overlay.add(lines);
    return { lines, depth };
  };
  const hurtViews = [boxView(0x5dff8a, 0.6), boxView(0x5dff8a, 0.6)] as const;
  const hitViews = [boxView(0xff4040, 0.5), boxView(0xff4040, 0.5)] as const;

  let match: Match | null = null;
  let player: KeyboardCombatController | null = null;
  const dummy = new TrainingDummyController('idle');
  let views: FighterView[] = [];
  let hud: MatchHud | null = null;
  let previousFov: number | null = null;
  const sparks = new HitSparks();
  root.add(sparks.group);
  const shake = new ScreenShake();
  const fightCamera = new FightCamera({
    ...DEFAULT_FIGHT_CAMERA,
    boundsX: [-(STAGE_HALF_WIDTH - CAMERA_WALL_INSET), STAGE_HALF_WIDTH - CAMERA_WALL_INSET],
    ...options.camera,
  });

  const buildView = (index: FighterIndex, fighter: Fighter): FighterView => {
    const { radius, halfHeight } = fighter.config.body;
    const view = new Group();
    view.name = `sandbox.fighter.${fighter.id}`;
    const body = new Group();
    const material = resources.paint(FIGHTER_COLORS[index], { roughness: 0.45 });
    const capsule = new Mesh(resources.geometry(new CapsuleGeometry(radius, halfHeight * 2, 6, 16)), material);
    capsule.position.y = fighter.height / 2;
    capsule.castShadow = true;
    const nose = new Mesh(resources.geometry(new BoxGeometry(0.22, 0.12, 0.16)), resources.paint(0xf4f0ff));
    nose.position.set(radius, fighter.height * 0.78, 0);
    // The "limb": a bar that extends towards the hitbox during an attack (visual cue only).
    const limbMaterial = resources.paint(0xf4f0ff, { emissive: 0x000000 });
    const limb = new Mesh(resources.geometry(new BoxGeometry(1, 0.14, 0.14)), limbMaterial);
    limb.name = `sandbox.fighter.${fighter.id}.limb`;
    limb.visible = false;
    limb.castShadow = true;
    body.add(capsule, nose);
    view.add(body, limb);
    root.add(view);
    return { index, fighter, root: view, body, material, limb, limbMaterial, flash: 0, flashColor: HIT_FLASH };
  };

  const placeBox = (view: BoxView, box: Box | null, depth = view.depth): void => {
    view.lines.visible = box !== null;
    if (!box) return;
    view.lines.position.set((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, 0);
    view.lines.scale.set(box.x1 - box.x0, box.y1 - box.y0, depth);
  };

  /** How far the limb is extended (0..1) at this move frame. */
  const limbExtent = (move: MoveDefinition, frame: number): number => {
    const stage = moveStageAt(move, frame);
    if (stage === 'startup') return 0.15 + 0.2 * (frame / move.startupFrames);
    if (stage === 'active') return 1;
    if (stage === 'recovery') return 1 - (frame - move.startupFrames - move.activeFrames) / (move.recoveryFrames + 1);
    return 0;
  };

  const restart = (aspect: number): void => {
    if (!match) return;
    match.restart();
    shake.reset();
    const [p1, p2] = match.combat.fighters;
    fightCamera.snap(p1, p2, aspect);
  };

  return {
    id: COMBAT_SANDBOX_STATE_ID,

    enter({ scene, camera, input }) {
      match = new Match(rapier, options.match ? { match: options.match } : {});
      player = new KeyboardCombatController(input);
      views = match.combat.fighters.map((f, i) => buildView(i as FighterIndex, f));
      const [p1, p2] = match.combat.fighters;
      fightCamera.snap(p1, p2, camera.aspect);
      previousFov = camera.fov;
      if (options.hudParent) hud = new MatchHud(options.hudParent);
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
      hud?.dispose();
      hud = null;
      match?.dispose();
      match = null;
      player = null;
      sparks.dispose();
      resources.dispose();
      stage.dispose();
    },

    update(dt, { camera, input }) {
      if (!match || !player) return;
      if (input.justPressed(InputAction.TrainingDummy)) dummy.cycle();
      if (input.justPressed(InputAction.ToggleHitboxes)) overlay.visible = !overlay.visible;
      if (input.justPressed(InputAction.Back) || (match.phase === 'matchOver' && input.justPressed(InputAction.Confirm))) {
        restart(camera.aspect);
      }

      match.step(dt, [player.readInput(), dummy.readInput()]);

      for (const event of match.events) {
        if (event.type === 'hit') {
          sparks.spawn(event.point.x, event.point.y, event.shake >= 0.4 ? 'heavyHit' : 'hit');
          shake.trigger(event.ko ? 1 : event.shake);
          const view = views[event.defender]!;
          view.flash = 8;
          view.flashColor = HIT_FLASH;
        } else if (event.type === 'block') {
          sparks.spawn(event.point.x, event.point.y, 'block');
          shake.trigger(0.08);
          const view = views[event.defender]!;
          view.flash = 6;
          view.flashColor = BLOCK_FLASH;
        } else if (event.type === 'roundStart') {
          const [p1, p2] = match.combat.fighters;
          fightCamera.snap(p1, p2, camera.aspect);
        }
      }

      // Presentation ticks at the fixed rate so it looks the same at any FPS.
      for (const view of views) if (view.flash > 0) view.flash--;
      sparks.update();
      shake.update();
      const [p1, p2] = match.combat.fighters;
      fightCamera.update(dt, p1, p2, camera.aspect);
    },

    render(alpha, { camera }) {
      if (!match) return;
      const combat = match.combat;
      for (const view of views) {
        const { fighter, root: node, body, limb } = view;
        const state = combat.states[view.index];
        node.position.set(
          MathUtils.lerp(fighter.previousX, fighter.x, alpha),
          MathUtils.lerp(fighter.previousY, fighter.y, alpha),
          0,
        );
        node.rotation.y = fighter.motion.facing === 1 ? 0 : Math.PI;

        // Body pose: crouch squash, or tipping over for launch / knockdown / getup / KO.
        let tilt = 0;
        if (state.phase === 'launched') tilt = Math.min(Math.PI / 2, state.frame * 0.09);
        else if (state.phase === 'knockdown') tilt = Math.PI / 2;
        else if (state.phase === 'getup') tilt = (Math.PI / 2) * (1 - state.frame / state.duration);
        else if (state.phase === 'ko') tilt = fighter.motion.grounded ? Math.PI / 2 : Math.min(Math.PI / 2, state.frame * 0.09);
        body.rotation.z = tilt;
        body.position.y = (fighter.config.body.radius * tilt) / (Math.PI / 2);
        body.scale.y = tilt === 0 && fighter.motion.posture === 'crouch' ? CROUCH_SCALE : 1;

        // Attack limb.
        const move = state.phase === 'attack' ? state.move : null;
        limb.visible = move !== null;
        if (move) {
          const { near, far, bottom, top } = move.hitbox;
          const length = Math.max(0.05, (far - near) * limbExtent(move, state.frame));
          limb.scale.set(length, move.id === 'special' ? 2.4 : 1, move.id === 'special' ? 2.4 : 1);
          limb.position.set(near + length / 2, (bottom + top) / 2, 0);
          view.limbMaterial.emissive.setHex(move.id === 'special' && moveStageAt(move, state.frame) === 'active' ? SPECIAL_GLOW : 0x000000);
        }

        view.material.emissive.copy(view.flash > 0 ? view.flashColor : NO_FLASH);
        view.material.emissiveIntensity = view.flash > 0 ? 0.35 + 0.08 * view.flash : 0;
      }

      if (overlay.visible) {
        for (const i of [0, 1] as const) {
          placeBox(hurtViews[i], combat.hurtbox(i));
          const move = combat.states[i].move;
          placeBox(hitViews[i], combat.hitbox(i), move?.hitbox.depth ?? 0.5);
        }
      }

      fightCamera.apply(camera, alpha);
      const offset = shake.offset(alpha);
      camera.position.x += offset.x;
      camera.position.y += offset.y;

      hud?.update({
        health: [combat.states[0].health, combat.states[1].health],
        maxHealth: combat.config.maxHealth,
        wins: match.wins,
        roundsToWin: match.config.roundsToWin,
        seconds: match.secondsLeft,
        banner: bannerFor(match),
        subBanner: match.phase === 'matchOver' ? 'Press Enter to play again' : null,
        names: ['P1', `P2 · dummy: ${dummy.mode}`],
      });
    },

    debugLines() {
      const lines = [
        'Move WASD/arrows · U light · I heavy · O kick · L special · J block high · K block low',
        `T dummy mode (${dummy.mode}) · H hitboxes (${overlay.visible ? 'on' : 'off'}) · Esc restart match`,
      ];
      if (!match) return lines;
      const combat = match.combat;
      lines.push(
        `match: round ${match.round} ${match.phase} · wins ${match.wins.join('-')} · time ${match.secondsLeft} · combat frame ${combat.frame}${combat.hitstop > 0 ? ` · HIT-STOP ${combat.hitstop}` : ''}`,
      );
      for (const i of [0, 1] as const) {
        const f = combat.fighters[i];
        const s = combat.states[i];
        let detail = '';
        if (s.phase === 'attack' && s.move) detail = `${s.move.name} f${s.frame}/${s.duration} ${moveStageAt(s.move, s.frame)}`;
        else if (s.duration > 0) detail = `${s.frame}/${s.duration}`;
        else if (s.phase === 'guard') detail = s.guardLevel;
        const buffered = combat.buffers[i].peek().map((e) => e.button).join(',');
        lines.push(
          `${f.id}  hp ${String(s.health).padStart(4)}  ${s.phase.padEnd(9)} ${detail.padEnd(24)} x ${f.x.toFixed(2).padStart(6)}  ${f.motion.posture.padEnd(11)}${buffered ? ` buf[${buffered}]` : ''}`,
        );
      }
      lines.push('frame data     S/A/R      dmg  level  on hit  on block');
      for (const move of Object.values(combat.moves)) {
        const onHit = advantageOnHit(move);
        lines.push(
          `${move.name.padEnd(15)}${`${move.startupFrames}/${move.activeFrames}/${move.recoveryFrames}`.padEnd(11)}${String(move.damage).padEnd(5)}${move.hitLevel.padEnd(7)}${(onHit === null ? 'KD' : signed(onHit)).padEnd(8)}${signed(advantageOnBlock(move))}`,
        );
      }
      const ex = combat.lastExchange;
      if (ex) {
        const measured = exchangeAdvantage(ex);
        const expected = ex.result === 'hit' ? advantageOnHit(ex.move) : advantageOnBlock(ex.move);
        lines.push(
          `last: P${ex.attacker + 1} ${ex.move.name} → ${ex.result.toUpperCase()}  advantage ${measured === null ? '…' : signed(measured)}${expected === null ? '' : ` (data ${signed(expected)})`}`,
        );
      }
      return lines;
    },
  };
}
