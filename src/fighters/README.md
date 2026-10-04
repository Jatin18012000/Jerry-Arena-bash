# `src/fighters/`

**Status: placeholder movement implemented (Phase 2).** No real fighter (VERA, REX, ...) exists yet.

- `config.ts` — `PLACEHOLDER_FIGHTER` body and movement tuning (metres, seconds).
- `motion.ts` — pure, deterministic per-step movement: walk forward/back relative to facing,
  committed jumps, crouch, landing, auto-facing (grounded only).
- `spacing.ts` — pure pushbox resolution, max separation and wall limits between two fighters.
- `controllers.ts` — `FighterController` → `FighterIntent` (keyboard via logical actions; idle dummy).
- `Fighter.ts` — runtime fighter: exact float64 motion, limited by Rapier floor/wall queries.

The environment shape (`radius`, `halfHeight`) is not a pushbox and not a combat hurtbox; Phase 3
hit/hurt boxes are separate data. All tuning values are placeholders. Intents come from a
`FighterController` (keyboard now; a second human player or CPU later), never from devices directly.

Real fighter data, move lists and GLB models arrive in later phases (see `docs/ARCHITECTURE.md`).
