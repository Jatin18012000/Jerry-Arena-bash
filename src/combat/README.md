# `src/combat/`

**Status: implemented (Phase 3) — generic placeholder moves.** VERA's and REX's move lists come later.

Pure, headless and deterministic (no Three.js, DOM or clocks):

- `types.ts` — `AttackButton`, `HitLevel`, `GuardLevel`, `FighterInput`, `Box`.
- `moves.ts` — typed `MoveDefinition` frame data, frame numbering, `DEFAULT_MOVES`, validation.
- `config.ts` — hurtboxes per posture, combat tuning, match settings.
- `boxes.ts` — hitbox / hurtbox placement and overlap.
- `blocking.ts` — `BLOCK_RULES` table and directional guard check.
- `InputBuffer.ts` — 8-frame attack buffer in combat frames.
- `FighterCombat.ts` — per-fighter combat phases (neutral, guard, attack, hitstun, blockstun,
  launched, knockdown, getup, ko).
- `CombatSimulation.ts` — the combat step around the Phase 2 movement step; hit-stop; events.
- `Match.ts` — rounds, timer, KO / time-out, best of three.
- `controllers.ts` — keyboard and training-dummy controllers producing `FighterInput`.

Rules and update order: `docs/COMBAT_SYSTEM.md`.
