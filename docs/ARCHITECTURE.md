# Architecture

Status legend: **Implemented** (in code, tested) · **Planned** (approved, not built) · **Future**.

## Overview

```
index.html ─► src/main.ts ─► Engine
                              ├── RenderContext   (WebGLRenderer, Scene, PerspectiveCamera, lighting, resize)
                              ├── InputManager    (keyboard → logical actions, per-step snapshots)
                              ├── StateMachine    (stack of GameStates; only the top one updates/renders)
                              └── GameLoop        (fixed 60 Hz update + per-frame render)
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
| `src/engine/debug/` | Implemented (debug only) | Phase 1 runtime-proof scene and text HUD. Not game content. |
| `src/camera/` | Planned | Fight camera rig. Phase 1 uses a fixed camera from `RenderContext`. |
| `src/physics/` | Planned | Rapier world wrapper. Dependency installed and load-tested only. |
| `src/combat/` | Planned | See COMBAT_SYSTEM.md. |
| `src/fighters/` | Planned | Fighter data + controllers. |
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
| 2 | Fight camera, Rapier integration, placeholder capsule fighters, basic movement | Planned |
| 3 | Combat core (frame data, hit/hurt boxes, health, rounds) | Planned |
| 4 | VERA and REX models/animations via Blender → GLB | Planned |
| 5 | First arena, Versus + Training modes, menus | Planned |
| Later | Arcade, AI, remaining arenas, Story, Survival, Shop, progression, remaining roster | Future |
