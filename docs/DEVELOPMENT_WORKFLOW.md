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

`npm run dev`, open http://localhost:5173. Expected in Phase 3: the combat sandbox (HUD state
`sandbox.combat`) with a pink P1 capsule and a cyan P2 dummy between two translucent walls, health
bars, round pips and a 60 s timer at the top, and the debug HUD at the bottom left. Then:

- "ROUND 1" → "FIGHT!"; inputs are ignored until FIGHT.
- Walk in and press **I** (heavy): sparks, a short freeze (hit-stop), a small screen shake, P2 slides
  back, P2's bar drops by 90 and the HUD reads `last: P1 Heavy → HIT advantage +1 (data +1)`.
- **L** (energy strike) launches P2; it lands, lies down, gets up.
- **T** until the dummy says `blockHigh`: heavy is blocked (no damage, blue spark, `-5`), **O** (kick,
  low) hits. In `blockLow` every move is blocked.
- **T** until `attack`: hold **J** to block its lights (`P2 Light → BLOCK -1`).
- **H** shows hurtboxes (green) and active hitboxes (red).
- Knock P2 out (about 12 heavies): "K.O." → "P1 WINS", a round pip fills, round 2 starts at full health.
  Two round wins end the match; **Enter** or **Esc** restarts.

`?state=sandbox.movement` opens the Phase 2 movement sandbox and `?state=debug.foundation` the Phase 1
scene. No console errors in any of them. Also check the production build with
`npm run build && npm run preview`, which loads Rapier from its own lazily imported chunk.

Headless note: in headless Chromium (software WebGL, ~20 fps) the game still runs in real time
because the loop catches up in fixed steps; key taps shorter than one step (16 ms) merge into one press.
