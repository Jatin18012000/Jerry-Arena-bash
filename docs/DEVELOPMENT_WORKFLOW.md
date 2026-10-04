# Development Workflow

## Daily commands

```bash
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm run typecheck
npm run test
npm run build      # runs typecheck then vite build → dist/
```

Before every commit: `typecheck`, `test` and `build` must pass, and the app must load in a browser
when runtime code changed.

## Branches and commits

- Feature work happens on a branch; `main` is not force-pushed or deleted.
- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Never commit `node_modules/`, `dist/`, `.env*`, Blender backups (`*.blend1`), or temporary files.

## Asset pipeline (planned)

```
blender/<category>/<name>.blend  ──export GLB──►  assets/<category>/<name>.glb  ──►  loaded by GLTFLoader
```

Conventions (planned):
- 1 Blender unit = 1 metre, +Y up in glTF (Blender's +Z up is converted by the exporter), fighters face +X.
- Apply transforms before export; one armature per fighter; animation clips named `idle`, `walk_f`, `walk_b`, `jump`, `crouch`, `block`, `light_1`, ...
- Keep runtime assets offline in `assets/`; textures compressed where practical.

## Blender setup

Target tools: **Blender 5.2.2 LTS** with the **Blender MCP Pro** add-on.

### Status as of Phase 1

**Done** (on the developer's Mac, 2026-10-04):

- The MCP server (127.0.0.1:9877) is provided by the `blender_mcp_pro` extension
  (`bl_ext.user_default.blender_mcp_pro`). The older single-file `blender_mcp` add-on is installed
  but was already disabled, so there is no conflict; it was left installed and disabled.
- Blender's startup file was not modified.
- `blender/BRAIN_ROT_LEGENDS.blend` is the canonical project file: one empty scene named
  `BRAIN_ROT_LEGENDS` (no objects, meshes, materials, rigs or actions), Metric units, unit scale 1.0,
  metres / kilograms / seconds, 60 fps, frames 1–240, EEVEE, 1920×1080, AgX view transform.
  It was generated with `blender --background --factory-startup`, so it carries no personal
  startup-file content.
- `*.blend1` / `*.blend2` backups are git-ignored; the `.blend` itself is committed.

## Verifying the browser build

`npm run dev`, open http://localhost:5173. Expected in Phase 2: the movement sandbox (HUD state
`sandbox.movement`) with a pink P1 capsule and a cyan P2 capsule facing each other on a purple grid
between two translucent walls, rising `sim steps`, and:

- A/D or ←/→ walk P1 (forward is faster than back); P1 stops at P2's pushbox and pushes P2 slowly.
- W/↑ jumps (with a direction held: committed forward/back jump); a point-blank forward jump crosses
  over P2 and both turn around on landing.
- S/↓ crouches (capsule squashes, no walking).
- Walking back stops at a 6.5 m gap or at the wall; the camera zooms out to keep both framed.

`?state=debug.foundation` still opens the Phase 1 scene (pink cube, WASD moves it). No console errors
in either. Also check the production build with `npm run build && npm run preview`, which loads
Rapier from its own lazily imported chunk.
