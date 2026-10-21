# `src/animation/`

**Status: implemented (Phase 4).** Presentation only: never feeds back into the simulation.

- `clips.ts` — the 18-clip contract every fighter GLB must satisfy (mirrors `blender/scripts/brl_anim.py`).
- `selectPose.ts` — pure: combat phase + movement posture → which clip and how to play it.
  Attacks are **pinned to the combat frame** (move frame f → clip time (f − 1) / 60), stun and get-up
  to their normalised progress, everything else loops or plays once.
- `FighterAnimator.ts` — Three.js `AnimationMixer` wrapper with cross-fades, ticked at the fixed step.
- `CharacterModels.ts` — GLB loading / parsing and per-fighter instancing (cloned skeleton and
  materials, so mirror matches and hit flashes stay independent).
