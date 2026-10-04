# Combat System

> **Status: Planned — no combat code exists.** Phase 1 deliberately implements no combat.
> This document records the intended design so later phases build against an agreed spec.

## Implemented foundations combat will build on

| Piece | Where | Notes |
| --- | --- | --- |
| Fixed 60 Hz simulation step | `src/engine/GameLoop.ts` | Combat logic will be counted in frames (1 frame = 1/60 s). |
| Per-step input snapshots | `src/engine/input/InputManager.ts` | `poll()` once per step; taps between steps are never dropped. |
| Logical actions | `src/engine/input/actions.ts` | `lightAttack`, `heavyAttack`, `kick`, `block`, `special`, directions. |

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
Rapier may be used for arena collision and pushboxes; hit detection stays deterministic and
frame-driven rather than relying on physics contact events.

### States
Idle, walk, crouch, jump, attack (startup/active/recovery), hitstun, blockstun, knockdown, getup, KO.

### Feel
Hit-stop on impact, screen shake, hit sparks (see `src/effects/`), camera punch-in on supers.

## Future
Throws and throw techs, air combos, guard break, character-specific mechanics, combo scaling tuning.
