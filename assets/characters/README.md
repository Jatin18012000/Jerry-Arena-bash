# `assets/characters/`

**Status: implemented (Phase 4).** Game-ready fighter models, loaded at startup by
`src/fighters/characters/models.ts` (bundled by Vite, offline).

| File | Character | Contents |
| --- | --- | --- |
| `vera.glb` | VERA | skinned mesh (~7.2k faces, 9 materials), 18-bone rig, 18 animation clips |
| `rex.glb` | REX | skinned mesh (~5.3k faces, 11 materials), 18-bone rig, 18 animation clips |

**Generated files — do not edit by hand.** Rebuild with `blender/scripts/build_characters.py`
(see `docs/DEVELOPMENT_WORKFLOW.md#character-pipeline`). `tests/character-assets.test.ts` checks the
rig, clip names, attack-clip timing against frame data, size and orientation.
