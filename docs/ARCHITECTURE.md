# Architecture

Status legend: **Implemented** (in code, tested) · **Planned** (approved, not built) · **Future**.

## Overview

```
index.html ─► src/main.ts ─► Engine
                              ├── RenderContext   (WebGLRenderer, Scene, PerspectiveCamera, lighting, resize)
                              ├── InputManager    (keyboard → logical actions, per-step snapshots)
                              ├── StateMachine    (stack of GameStates; only the top one updates/renders)
                              └── GameLoop        (fixed 60 Hz update + per-frame render)

main.ts awaits loadRapier() (lazy WASM chunk) and loadCharacterModels() (bundled VERA / REX GLBs)
in parallel, picks the roster (?p1= / ?p2=, default VERA vs REX), then registers:
  sandbox.combat    (default)  CombatSandboxState               ← presentation + devices (Phases 3–4)
                                 ├── KeyboardCombatController     (P1: keys → FighterInput)
                                 ├── TrainingDummyController      (P2: dummy modes → FighterInput)
                                 ├── roster: CharacterDefinition × 2 (moves, health, movement — Phase 4)
                                 ├── Match                        ← rounds, timer, KO / time-out, best of 3
                                 │     └── CombatSimulation       ← deterministic combat step(dt, inputs)
                                 │           ├── InputBuffer × 2  (8-frame attack buffer, combat frames)
                                 │           ├── FighterCombatState × 2 (phase, frame, health, pushback)
                                 │           ├── hit/hurt boxes, BLOCK_RULES, MoveSet (frame data)
                                 │           └── SandboxSimulation  ← the Phase 2 movement step, reused
                                 ├── character model × 2 + FighterAnimator (GLB, clips picked by selectPose)
                                 ├── FightCamera + ScreenShake    (presentation)
                                 ├── HitSparks, hit/block flashes, hitbox overlay (presentation)
                                 └── MatchHud (DOM)               (presentation)
  sandbox.movement             MovementSandboxState             ← Phase 2 movement only
                                 ├── FighterController × 2      (keyboard P1, idle dummy P2 → intents)
                                 ├── SandboxSimulation          ← deterministic movement step(dt, intents)
                                 │     ├── PhysicsWorld         (Rapier: static floor + walls, ray queries)
                                 │     ├── Fighter × 2          (motion rules, limited by stage queries)
                                 │     └── resolveSpacing       (pushboxes, max separation, wall limits)
                                 ├── FightCamera                (reads fighters; never writes)
                                 └── placeholder capsule meshes
  debug.foundation             (?state=debug.foundation) — Phase 1 runtime proof
```

Per animation frame:

1. `GameLoop` accumulates elapsed time (clamped to 0.25 s).
2. For each whole fixed step: `input.poll()` → `states.update(dt)`.
3. Once: `states.render(alpha)` → `renderer.render(scene, camera)`.

## Module map

| Module | Status | Responsibility |
| --- | --- | --- |
| `src/engine/GameLoop.ts` | Implemented | Fixed-timestep loop; injectable scheduler/clock for tests. |
| `src/engine/RenderContext.ts` | Implemented | Renderer, root scene, main camera, ResizeObserver-based resize, dispose. |
| `src/engine/Lighting.ts` | Implemented | Neutral default lights (hemisphere, ambient, shadow-casting key). |
| `src/engine/viewport.ts` | Implemented | Pure viewport sizing (min 1×1, pixel ratio capped at 2). |
| `src/engine/input/` | Implemented | `InputAction` enum, default key bindings, `InputManager` (held / justPressed / justReleased, rebinding, blur reset). |
| `src/engine/state/` | Implemented | `GameState` interface, stack-based `StateMachine` with deferred transitions. |
| `src/engine/Engine.ts` | Implemented | Composes the above; exposes a narrow `EngineContext` to states. |
| `src/engine/debug/` | Implemented (debug only) | Phase 1 runtime-proof scene and text HUD (states may add HUD lines via `debugLines()`). Not game content. |
| `src/physics/` | Implemented | `loadRapier()` (dynamic import → own chunk, WASM embedded, offline, initialised once) and `PhysicsWorld` (static stage boxes, `castStageRay` environment queries, collision groups, `prime()`, `step(dt)`, `dispose()`). |
| `src/fighters/characters/` | Implemented (Phase 4) | Roster as pure data: `VERA`, `REX` (`CharacterDefinition`: body / movement, health, move set), `ROSTER`, `validateCharacter`, bundled GLB URLs (`models.ts`). |
| `src/fighters/` | Implemented | `PLACEHOLDER_FIGHTER` tuning (all values tunable placeholders), pure `stepMotion` / `settleMotion` / `faceOpponent`, pure `resolveSpacing`, `FighterController` → `FighterIntent` (keyboard, idle), `Fighter` runtime (exact float64 motion limited by Rapier stage queries). No real roster yet. |
| `src/camera/` | Implemented | `FightCamera` (presentation only): side-on framing of both fighters, zoom by separation, partial jump follow, configurable FOV (default 32°), fixed-tick smoothing + render interpolation. |
| `src/sandbox/` | Implemented (debug only) | `SandboxSimulation` (headless, deterministic movement step; Phase 3 adds optional per-fighter plan options and `resetPositions`), `MovementSandboxState`, `CombatSandboxState` (default; controllers, match, visuals, effects, HUD, training controls), shared `debugStage`. Not an arena or game mode. |
| `src/combat/` | Implemented (placeholder moves) | Typed frame data + validation (`moves.ts`), hurtbox / match config, box geometry, `BLOCK_RULES`, `InputBuffer`, per-fighter combat phases (`FighterCombat.ts`), `CombatSimulation` (deterministic combat step around the movement step), `Match` (rounds, timer, KO, best of three), controllers (`KeyboardCombatController`, `TrainingDummyController`). See COMBAT_SYSTEM.md. |
| `src/animation/` | Implemented (Phase 4) | Clip contract, pure `selectPose` (combat state → clip; attacks pinned to the combat frame), `FighterAnimator` (mixer + cross-fades, fixed-step), `CharacterModels` (GLB load / parse, per-fighter clones of skeleton and materials). |
| `src/ai/` | Planned | CPU opponents. |
| `src/effects/` | Implemented (placeholder) | `HitSparks` (pooled impact flashes) and `ScreenShake` (deterministic, fixed-step). Presentation only; hit-stop itself is simulation (`CombatSimulation`). |
| `src/audio/` | Planned | Web Audio playback. |
| `src/ui/` | Implemented (placeholder HUD) / Planned (menus) | `MatchHud` (DOM health bars, round pips, timer, banners) and pure `bannerFor`. Menus, character select, options: Phase 5. |
| `src/save/` | Planned | Offline persistence. |
| `src/progression/`, `src/shop/`, `src/missions/`, `src/story/` | Future | Meta-game systems. |

## Boundaries and rules

- **States only see `EngineContext`** (`scene`, `camera`, `input`, `states`, `time`). They do not
  touch the renderer or the loop directly.
- **Gameplay reads logical actions, never key codes.** Bindings live in `input/actions.ts`.
- **Simulation is fixed-step.** Anything that affects game outcome runs in `update(dt)`; `render`
  is for presentation only. This keeps combat frame-accurate and makes it replayable later.
- **State transitions are deferred** to the start of the next update, so a state can safely request
  a change from inside its own hooks.
- **Movement is 2.5D (decided).** Fighters move on the X axis of the z = 0 fight plane; fighter
  state has no z at all. A 3D sidestep remains an open, future question.
- **Authority split for fighters.**
  - *Motion* (walk, jump arc, gravity, facing): `fighters/motion.ts`, exact float64, deterministic.
  - *Environment* (floor, walls): Rapier. Fighters ray-query the static stage colliders; contact
    positions are rounded to 0.1 mm so float32 physics noise never enters fighter state. (Rapier's
    kinematic character controller was tried and rejected in review: on flat ground it dropped whole
    ticks of movement, drifted idle fighters and made P1/P2 asymmetric.)
  - *Fighter vs fighter*: `fighters/spacing.ts` pushboxes — never Rapier.
- **Three different volumes.** Environment shape (capsule radius/height) ≠ pushbox (`pushHalfWidth`,
  `pushHeight`) ≠ combat hit/hurt boxes. Hurtboxes are per posture (`combat/config.ts`) and hitboxes
  per move (`combat/moves.ts`); neither is derived from the environment shape (which ignores crouch).
- **Combat authority.** `CombatSimulation` owns combat state and decides hits from explicit box
  overlap on integer combat frames. It does not replace the movement step: it wraps
  `SandboxSimulation.step` and only filters intents, locks facing and adds pushback through the
  additive `PlanOptions`. Rapier never decides a hit. One loop, one input manager, one update order
  (documented in COMBAT_SYSTEM.md).
- **Characters are data; models are presentation.** `CharacterDefinition` (moves, health, movement)
  feeds the simulation; the GLB and its animations only read simulation state. Attack clips are
  pinned to the combat frame, so visuals cannot drift from hitbox timing, and the simulation runs
  identically with models, with capsules, or headless.
- **Hit-stop is simulation, shake is presentation.** During hit-stop the combat step returns early
  (no frames, timers, movement or round clock advance). Shake, sparks and flashes only read events.
- **Deterministic simulation.** `SandboxSimulation.step(dt, p1Intent, p2Intent)` and
  `CombatSimulation.step(dt, inputs)` depend only on their inputs: no clocks, randomness, DOM, viewport
  or camera. Tests replay seeded input sequences (900 movement ticks, 3000 combat steps) step for step
  and prove identical results at 30/60/144 fps and jittery frame rates.
  Scope: same build on the same platform; cross-platform bit-exactness (e.g. for netplay) is not
  claimed, since Rapier's standard build and JS `Math` are not guaranteed bit-identical everywhere.
- **Controllers produce intents.** Keyboard, a future second human player and CPU AI all implement
  `FighterController.readIntent()` (movement) or `CombatController.readInput()` (movement + attack
  presses + guard); the simulation never reads devices.
- **Camera is presentation.** It reads fighter positions and never writes simulation state; it is
  ticked at the fixed rate only so its smoothing is frame-rate independent.
- **Fixed-step state, interpolated presentation.** Fighters and the fight camera keep previous and
  current values; `render(alpha)` interpolates between them.
- **Offline-first:** no runtime network requests; assets (including the character GLBs) are bundled; the build uses a relative
  `base` so `dist/` works from any static host.
- **No secrets:** there are no runtime keys. `.env*` files are git-ignored regardless.

## Testing

Vitest, `tests/**/*.test.ts`. Node environment by default; DOM-dependent tests opt into jsdom with
`// @vitest-environment jsdom`. WebGL is not available in unit tests, so the renderer itself is
verified by running the app in a browser (see DEVELOPMENT_WORKFLOW.md).

## Phase plan

| Phase | Scope | Status |
| --- | --- | --- |
| 1 — Foundation | Tooling, engine runtime, docs, tests | **Done** — web foundation plus local Blender project setup (see DEVELOPMENT_WORKFLOW.md) |
| 2 — Movement & camera | Fight camera, Rapier integration, placeholder capsule fighters, basic movement | **Done** — reviewed and approved; see the movement sandbox |
| 3 — Combat core | Frame data, hit/hurt boxes, blocking, input buffer, stun, knockdown, health, rounds, timer, best of three, hit-stop, shake, training readout | **Done** — on placeholder capsules with generic test moves; see COMBAT_SYSTEM.md |
| 4 — VERA & REX | Character design, Blender models, rig, animation, GLB, game integration, character move sets | **Done** — stylised procedural models built by `blender/scripts/`; see CHARACTER_BIBLE.md |
| 5 | First arena, Versus + Training modes, menus | Planned |
| Later | Arcade, AI, remaining arenas, Story, Survival, Shop, progression, remaining roster | Future |
