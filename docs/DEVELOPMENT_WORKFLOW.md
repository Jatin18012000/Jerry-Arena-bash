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

**Not done.** Phase 1 was carried out in a remote cloud container that has no Blender installation
and no access to the developer's Mac, so the following steps were **not performed** and must be done
on the machine that runs Blender:

1. In Blender → Preferences → Add-ons, check which of `blender_mcp_pro` and the older `blender_mcp`
   is enabled and which one the MCP client is actually connected to.
2. If the older `blender_mcp` is redundant (MCP Pro is the one in use and responds without it),
   **disable** it — do not uninstall or delete it.
3. Confirm Blender MCP Pro still responds (e.g. ask the MCP client for the current scene info).
4. Save a copy of the current startup file before changing anything
   (File → Save As… `startup_backup.blend`), and do **not** use File → Defaults → Save Startup File.
5. Create a clean, empty scene and save it as `blender/BRAIN_ROT_LEGENDS.blend`
   (metric units, scale 1.0). Do not add characters yet.
6. Commit the `.blend` file (`*.blend1` backups are git-ignored).

## Verifying the browser build

`npm run dev`, open http://localhost:5173. Expected in Phase 1: dark scene, purple grid, pink cube,
a debug HUD showing state `debug.foundation`, rising `sim steps`, and WASD/arrow keys moving the cube.
No console errors.
