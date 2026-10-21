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

## Character pipeline

**Implemented (Phase 4)** for VERA and REX. Characters are **built by script**, not hand-edited, so
the model, rig, animation timing and export are reproducible and reviewable as code:

```
blender/scripts/char_<id>.py ─┐                                   ┌─► blender/characters/<id>.blend  (source scene)
blender/scripts/brl_anim.py  ─┼─► build_characters.py (Blender) ──┼─► assets/characters/<id>.glb     (game asset)
blender/scripts/brl_rig.py   ─┘                                   └─► docs/images/characters/*.jpg   (--render)
                                                                         │
                         src/fighters/characters/models.ts (Vite ?url) ◄─┘ → GLTFLoader → FighterAnimator
```

Build (from the repository root):

```bash
# With Blender installed (e.g. Blender 5.2.2 LTS on the Mac):
blender -b --factory-startup -P blender/scripts/build_characters.py -- [--only vera|rex] [--render]
# Or with Blender's Python module (how the Phase 4 assets were produced: bpy 5.0.1):
python blender/scripts/build_characters.py [--only vera|rex] [--render]
npm run test   # verifies rig, clips, attack timing vs frame data, size, orientation
```

- **Edit the scripts, not the outputs.** `<id>.blend` and `<id>.glb` are regenerated on every run.
  `blender/BRAIN_ROT_LEGENDS.blend` is never touched.
- **Conventions:** 1 unit = 1 m, character faces +X with its left side at +Y, feet on Z = 0,
  60 fps (one animation frame = one combat frame). glTF export converts Z-up to Y-up.
- **Rig:** shared 18-bone humanoid (`brl_rig.humanoid_bones`), rigid skinning (each part 100% on
  one bone). Poses are written as armature-space angles; grounded poses are automatically lowered /
  raised so the lowest foot touches the floor.
- **Clips:** the 18 names in `brl_anim.py` / `src/animation/clips.ts`. Attack clips are built from
  each character's `TIMING` table, which must equal its TypeScript move data (a test fails if not).
- **Materials:** plain Principled BSDF colours (+ emission for glowing trim). No textures, so the
  GLBs are small (~0.6 MB), fully offline and parse headlessly in tests.
- **Reproducibility:** rebuilds produce the same vertices, bones and animation data; a few triangle
  index buffers come out in a different order, so the GLB bytes are not bit-identical.
- **Blender versions:** the Phase 4 assets were built and verified with Blender 5.0.1 (`bpy` from
  PyPI) in the cloud environment; the scripts use only long-standing `bpy` / `bmesh` APIs and the
  stock glTF exporter, but have **not yet been run on the Mac's Blender 5.2.2**.
- **Blender MCP Pro** is not needed by this pipeline (and was not reachable from the cloud session).
  It remains available for interactive work on the Mac, e.g. opening `<id>.blend` to inspect or
  hand-tune, after which changes should be ported back into the scripts.

## Blender setup

Target tools: **Blender 5.2.2 LTS** with the **Blender MCP Pro** add-on. Character assets are built
by script (see [Character pipeline](#character-pipeline)).

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

`npm run dev`, open http://localhost:5173. Expected in Phase 4: the combat sandbox (HUD state
`sandbox.combat`) with **VERA** (P1, keyboard) facing **REX** (P2, training dummy), animated in
their idle stances, between two translucent walls; health bars labelled `P1 · VERA` and
`P2 · REX (dummy: idle)`, round pips, a 60 s timer, and the debug HUD at the bottom left. Then:

- "ROUND 1" → "FIGHT!"; inputs are ignored until FIGHT.
- A/D walks (walk animation), S crouches, W jumps (tuck), J / K guard poses.
- Walk in and press **O** (Low Sweep): VERA drops and sweeps, REX reels, his bar drops by 60 and the
  HUD reads `last: P1 Low Sweep → HIT advantage +1 (data +1)`.
- **L** (Violet Crescent): spinning kick with a violet energy streak; REX is launched, lands, lies
  down and gets up.
- **T** until the dummy says `blockHigh`: **I** (Spiral Knee) is blocked (`-4`), **O** hits.
- **H** shows hurtboxes (green) and hitboxes (red) over the models.
- `?p1=rex&p2=vera` swaps the fighters (mirror matches such as `?p1=vera&p2=vera` work too).
- KO the dummy: "K.O." → "P1 WINS" (the winner plays the victory loop), round 2 at full health.

`?state=sandbox.movement` opens the Phase 2 movement sandbox (capsules) and `?state=debug.foundation`
the Phase 1 scene. No console errors in any of them, and no network requests beyond the page's own
bundled files. Also check the production build with `npm run build && npm run preview`, which emits
the GLBs as separate assets and loads Rapier from its own chunk.

Headless note: in headless Chromium (software WebGL, ~10–20 fps) the game still runs in real time
because the loop catches up in fixed steps; key taps shorter than one step (16 ms) merge into one press.
