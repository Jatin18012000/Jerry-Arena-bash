# BRAIN ROT: LEGENDS

A browser-based, offline-first **3D 1v1 fighting game** built with TypeScript, Three.js and Vite.

> **Current status: Phase 3 — Combat Core: DONE.** Next: Phase 4 — VERA & REX.
> On top of the engine, Rapier physics, fight camera and 2.5D movement (Phases 1–2), two
> **placeholder capsule fighters** now fight a deterministic, frame-data-driven best-of-three match:
> attacks, hit/hurt boxes, high/low blocking, input buffer, stun, knockdown, rounds, timer and KO.
> **No real fighters (VERA, REX, ...), arenas, menus or game modes are implemented yet**, and the four
> moves are generic test moves. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for exactly what
> exists and what is planned, and [`docs/COMBAT_SYSTEM.md`](docs/COMBAT_SYSTEM.md) for the rules.

## Tech stack

| Area | Choice | Status |
| --- | --- | --- |
| Language | TypeScript (strict) | In use |
| Rendering | Three.js | In use |
| Build / dev server | Vite | In use |
| Tests | Vitest (+ jsdom for DOM tests) | In use |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | In use: static stage colliders (floor, walls) queried for environment collision |
| 3D assets | GLTF/GLB authored in Blender 5.2.2 LTS (via Blender MCP Pro) | Pipeline planned |
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

The page opens the **combat sandbox**: P1 (pink capsule, keyboard) against P2 (cyan capsule, a
training dummy) on a flat debug stage, in a best-of-three match with health bars, timer and round
announcements.

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
any frame rate); all values are tunable placeholders and these capsules are not game content.
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
  ai/ animation/ audio/ story/ missions/ shop/ progression/ save/      Planned (reserved folders)
assets/          Runtime assets (GLB, textures, audio, UI) — empty for now
blender/         Source .blend files — see docs/DEVELOPMENT_WORKFLOW.md
tests/           Vitest unit tests
docs/            Design and architecture documents
```

## Documentation

- [Game design](docs/GAME_DESIGN.md)
- [Combat system](docs/COMBAT_SYSTEM.md)
- [Character bible](docs/CHARACTER_BIBLE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
