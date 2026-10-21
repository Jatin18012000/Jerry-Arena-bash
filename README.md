# BRAIN ROT: LEGENDS

A browser-based, offline-first **3D 1v1 fighting game** built with TypeScript, Three.js and Vite.

> **Current status: Phase 4 — VERA & REX: DONE.** Next: Phase 5 — first arena, Versus / Training
> modes and menus.
> **VERA** (agile kickboxer) and **REX** (power striker) — stylised 3D models built in Blender, rigged,
> animated and exported as GLB — fight a deterministic, frame-data-driven best-of-three match with
> their own move sets, health and speed (Phases 1–3: engine, physics, camera, movement, combat).
> **No arenas, menus or game modes are implemented yet** (the stage is a debug floor).
> See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/COMBAT_SYSTEM.md`](docs/COMBAT_SYSTEM.md)
> and [`docs/CHARACTER_BIBLE.md`](docs/CHARACTER_BIBLE.md).

## Tech stack

| Area | Choice | Status |
| --- | --- | --- |
| Language | TypeScript (strict) | In use |
| Rendering | Three.js | In use |
| Build / dev server | Vite | In use |
| Tests | Vitest (+ jsdom for DOM tests) | In use |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | In use: static stage colliders (floor, walls) queried for environment collision |
| 3D assets | GLB built in Blender by script (`blender/scripts/build_characters.py`) | In use: VERA, REX |
| Backend | None — fully offline, no runtime API keys, no paid runtime services | By design |

## Getting started

Requires Node.js 20+ (developed on Node 22).

```bash
npm install
npm run dev        # start dev server at http://localhost:5173
npm run typecheck  # TypeScript, no emit
npm run test       # unit tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

Rebuilding the character models (only needed after editing `blender/scripts/`):
`blender -b --factory-startup -P blender/scripts/build_characters.py -- --render`
(see [Character pipeline](docs/DEVELOPMENT_WORKFLOW.md#character-pipeline)).

The page opens the **combat sandbox**: **VERA** (P1, keyboard) against **REX** (P2, a training
dummy) on a flat debug stage, in a best-of-three match with health bars, timer and round
announcements. `?p1=rex&p2=vera` swaps them (mirror matches work too).

| Key | Action |
| --- | --- |
| A/D or ←/→ | walk forward / back (relative to facing) |
| W/↑ | jump (hold a direction for a forward / back jump) |
| S/↓ | crouch |
| U · I · O · L | light · heavy · kick (low) · energy strike (special, knockdown) |
| J · K | hold to block high (standing) · block low (crouching) |
| T | cycle the dummy: idle → block high → block low → crouch → jump → attack |
| H | show / hide hitboxes (red) and hurtboxes (green) |
| Esc · Enter | restart the match · restart after the match ends |

The debug HUD (bottom left) shows each fighter's combat phase and frame, the frame-data table and the
measured advantage of the last hit or block. Everything is deterministic (same inputs → same result at
any frame rate); all values are tunable.
`?state=sandbox.movement` opens the Phase 2 movement-only sandbox and `?state=debug.foundation` the
Phase 1 runtime-proof scene.

## Project layout

```
src/
  engine/        Implemented: renderer, scene, camera, lighting, loop, input, state machine
  physics/       Implemented: Rapier loader + world wrapper
  fighters/      Implemented: placeholder fighter config, pure motion + spacing rules, controllers
  camera/        Implemented: fight camera
  combat/        Implemented: frame data, hit/hurt boxes, blocking, input buffer, combat simulation, match flow
  effects/       Implemented (placeholder): hit sparks, screen shake
  ui/            Implemented (placeholder): match HUD (health, timer, round pips, banners)
  sandbox/       Implemented (debug): combat sandbox (default) and Phase 2 movement sandbox
  animation/     Implemented: clip contract, pose selection, animator, GLB loading
  fighters/characters/  Implemented: VERA and REX definitions (moves, health, movement)
  ai/ audio/ story/ missions/ shop/ progression/ save/      Planned (reserved folders)
assets/          Runtime assets: characters/vera.glb, rex.glb (generated)
blender/         scripts/ (character builder), characters/*.blend (generated), BRAIN_ROT_LEGENDS.blend
tests/           Vitest unit tests
docs/            Design and architecture documents
```

## Documentation

- [Game design](docs/GAME_DESIGN.md)
- [Combat system](docs/COMBAT_SYSTEM.md)
- [Character bible](docs/CHARACTER_BIBLE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
