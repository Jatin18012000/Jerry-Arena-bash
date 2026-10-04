# BRAIN ROT: LEGENDS

A browser-based, offline-first **3D 1v1 fighting game** built with TypeScript, Three.js and Vite.

> **Current status: Phase 2 — Movement & Camera: DONE.** Next: Phase 3 — Combat Core (not started).
> On top of the Phase 1 engine runtime, the game now has Rapier physics, a side-on fight camera and
> two **placeholder capsule fighters** with basic 2.5D movement in a debug sandbox.
> **No combat, real fighters (VERA, REX, ...), arenas, menus or game modes are implemented yet.** See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for exactly what exists and what is planned.

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

The page opens the **movement sandbox**: P1 (pink capsule, keyboard) and P2 (cyan capsule, idle dummy)
on a flat debug stage. **A/D or ←/→** walk forward/back relative to facing, **W/↑** jumps (hold a
direction for a forward/back jump), **S/↓** crouches. Fighters face each other automatically, cannot
walk through each other, can cross over with a point-blank jump, and the camera keeps both framed.
Movement values are tunable placeholders, the simulation is deterministic (same inputs → same
result at any frame rate), and these capsules are not game content. Add `?state=debug.foundation` to the URL for the Phase 1
runtime-proof scene.

## Project layout

```
src/
  engine/        Implemented: renderer, scene, camera, lighting, loop, input, state machine
  physics/       Implemented: Rapier loader + world wrapper
  fighters/      Implemented: placeholder fighter config, pure motion + spacing rules, controllers
  camera/        Implemented: fight camera
  sandbox/       Implemented (debug): Phase 2 movement sandbox state
  combat/ ai/ animation/ audio/ effects/
  story/ missions/ shop/ progression/ ui/ save/      Planned (reserved folders)
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
