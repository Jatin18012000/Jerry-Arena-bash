# BRAIN ROT: LEGENDS

A browser-based, offline-first **3D 1v1 fighting game** built with TypeScript, Three.js and Vite.

> **Current status: Phase 1 — Project Foundation.**
> The engine runtime (renderer, loop, input, game-state machine) exists and runs in the browser.
> **No combat, fighters, arenas, menus or game modes are implemented yet.** See
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for exactly what exists and what is planned.

## Tech stack

| Area | Choice | Status |
| --- | --- | --- |
| Language | TypeScript (strict) | In use |
| Rendering | Three.js | In use |
| Build / dev server | Vite | In use |
| Tests | Vitest (+ jsdom for DOM tests) | In use |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Installed, load-tested, **not wired into gameplay** |
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

The Phase 1 page shows a debug floor, a grid and a placeholder cube. **WASD / arrow keys** move the
cube to prove the input → state → render pipeline works. This is a runtime test scene, not game content.

## Project layout

```
src/
  engine/        Implemented: renderer, scene, camera, lighting, loop, input, state machine
  combat/ fighters/ ai/ camera/ physics/ animation/ audio/ effects/
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
