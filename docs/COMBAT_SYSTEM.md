# Combat System

> **Status: Planned — no combat code exists.** Phases 1–2 deliberately implement no combat.
> This document records the intended design so later phases build against an agreed spec.

## Implemented foundations combat will build on

| Piece | Where | Notes |
| --- | --- | --- |
| Fixed 60 Hz simulation step | `src/engine/GameLoop.ts` | Combat logic will be counted in frames (1 frame = 1/60 s). |
| Per-step input snapshots | `src/engine/input/InputManager.ts` | `poll()` once per step; taps between steps are never dropped. |
| Logical actions | `src/engine/input/actions.ts` | `lightAttack`, `heavyAttack`, `kick`, `block`, `special`, directions. |
| Fighter intents | `src/fighters/controllers.ts` | Devices/AI → `FighterIntent`; the simulation consumes intents only. |
| Deterministic movement | `src/fighters/motion.ts` | Walk, committed jumps, crouch, facing; exact float64; replay-tested. |
| Pushboxes | `src/fighters/spacing.ts` | Deterministic fighter-vs-fighter spacing, max separation, walls. Not physics. |
| Posture | `MotionState.posture` | `stand` / `walkForward` / `walkBack` / `crouch` / `air` — Phase 3 hurtboxes key off this. |

## Planned design

### Frame data
Every move is defined as data: startup, active and recovery frames, damage, hitstun, blockstun,
pushback, and hit/hurt box volumes per frame. Advantage on hit/block is derived from this data and
shown in Training mode.

### Inputs
- Buttons: light attack, heavy attack, kick, block, special.
- Directional inputs relative to facing (forward/back), so motion inputs work on both sides.
- An input buffer (planned ~8 frames) for combos and special-move motions.

### Hit detection
Simple primitive volumes (spheres/capsules/boxes) attached to animation bones, tested each step.
Hit/hurt boxes are their own data: they must not be derived from the Rapier environment shape
(capsule radius/height), which only exists for floor/wall collision and does not change when
crouching. Rapier is used for arena collision only; pushboxes are already deterministic gameplay
code (Phase 2). Hit detection stays deterministic and
frame-driven rather than relying on physics contact events.

### Pushboxes and cross-ups (Phase 2 decision, tunable)
The pushbox is deliberately shorter than the body: `pushHeight` 1.0 m vs a 1.8 m fighter
(`PLACEHOLDER_FIGHTER.body`). A point-blank forward jump therefore crosses over the opponent and
both turn around on landing; a mid-range jump lands in front. Regression tests pin both behaviours.
Retune `pushHeight`, `pushHalfWidth` and the jump values against VERA and REX.

### States
Idle, walk, crouch, jump, attack (startup/active/recovery), hitstun, blockstun, knockdown, getup, KO.

### Feel
Hit-stop on impact, screen shake, hit sparks (see `src/effects/`), camera punch-in on supers.

## Future
Throws and throw techs, air combos, guard break, character-specific mechanics, combo scaling tuning.
