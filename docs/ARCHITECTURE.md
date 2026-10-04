# Architecture

Status legend: **Implemented** (in code, tested) · **Planned** (approved, not built) · **Future**.

## Overview

```
index.html ─► src/main.ts ─► Engine
                              ├── RenderContext   (WebGLRenderer, Scene, PerspectiveCamera, lighting, resize)
                              ├── InputManager    (keyboard → logical actions, per-step snapshots)
                              ├── StateMachine    (stack of GameStates; only the top one updates/renders)
                              └── GameLoop        (fixed 60 Hz update + per-frame render)

main.ts also awaits loadRapier() (lazy WASM chunk) before starting, then registers:
  sandbox.movement  (default)  MovementSandboxState            ← presentation + devices
                                 ├── FighterController × 2      (keyboard P1, idle dummy P2 → intents)
                                 ├── SandboxSimulation          ← deterministic gameplay step(dt, intents)
                                 │     ├── PhysicsWorld         (Rapier: static floor + walls, ray queries)
                                 │     ├── Fighter × 2          (motion rules, limited by stage queries)
                                 │     └── resolveSpacing       (pushboxes, max separation, wall limits)
                                 ├── FightCamera                (reads fighters; never writes)
                                 └── placeholder capsule meshes
  debug.foundation  (?state=debug.foundation) — Phase 1 runtime proof
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
| `src/fighters/` | Implemented (placeholder) | `PLACEHOLDER_FIGHTER` tuning (all values tunable placeholders), pure `stepMotion` / `settleMotion` / `faceOpponent`, pure `resolveSpacing`, `FighterController` → `FighterIntent` (keyboard, idle), `Fighter` runtime (exact float64 motion limited by Rapier stage queries). No real roster yet. |
| `src/camera/` | Implemented | `FightCamera` (presentation only): side-on framing of both fighters, zoom by separation, partial jump follow, configurable FOV (default 32°), fixed-tick smoothing + render interpolation. |
| `src/sandbox/` | Implemented (debug only) | `SandboxSimulation` (headless, deterministic, intents in) and `MovementSandboxState` (controllers, fight camera, placeholder capsule visuals; P2 is an idle dummy). Not an arena or game mode. |
| `src/combat/` | Planned | See COMBAT_SYSTEM.md. |
| `src/animation/` | Planned | GLTF animation mixer and frame sync. |
| `src/ai/` | Planned | CPU opponents. |
| `src/effects/` | Planned | VFX, hit-stop, screen shake. |
| `src/audio/` | Planned | Web Audio playback. |
| `src/ui/` | Planned | Menus and match HUD. |
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
  `pushHeight`) ≠ combat hit/hurt boxes. Hit/hurt boxes do not exist yet; Phase 3 adds them as
  separate data and must not derive them from the environment shape (which, e.g., ignores crouch).
- **Deterministic simulation.** `SandboxSimulation.step(dt, p1Intent, p2Intent)` depends only on its
  inputs: no clocks, randomness, DOM, viewport or camera. Tests replay seeded 900-tick input
  sequences tick-for-tick and prove identical results at 30/60/144 fps and jittery frame rates.
  Scope: same build on the same platform; cross-platform bit-exactness (e.g. for netplay) is not
  claimed, since Rapier's standard build and JS `Math` are not guaranteed bit-identical everywhere.
- **Controllers produce intents.** Keyboard, a future second human player and CPU AI all implement
  `FighterController.readIntent()`; the simulation never reads devices.
- **Camera is presentation.** It reads fighter positions and never writes simulation state; it is
  ticked at the fixed rate only so its smoothing is frame-rate independent.
- **Fixed-step state, interpolated presentation.** Fighters and the fight camera keep previous and
  current values; `render(alpha)` interpolates between them.
- **Offline-first:** no runtime network requests; assets are bundled; the build uses a relative
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
| 3 | Combat core (frame data, hit/hurt boxes, health, rounds) | Planned |
| 4 | VERA and REX models/animations via Blender → GLB | Planned |
| 5 | First arena, Versus + Training modes, menus | Planned |
| Later | Arcade, AI, remaining arenas, Story, Survival, Shop, progression, remaining roster | Future |
