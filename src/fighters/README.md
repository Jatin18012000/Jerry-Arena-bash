# `src/fighters/`

**Status: movement implemented (Phase 2); VERA and REX implemented as characters (Phase 4).**

- `config.ts` — `PLACEHOLDER_FIGHTER` body and movement tuning (metres, seconds).
- `motion.ts` — pure, deterministic per-step movement: walk forward/back relative to facing,
  committed jumps, crouch, landing, auto-facing (grounded only).
- `spacing.ts` — pure pushbox resolution, max separation and wall limits between two fighters.
- `controllers.ts` — `FighterController` → `FighterIntent` (keyboard via logical actions; idle dummy).
- `Fighter.ts` — runtime fighter: exact float64 motion, limited by Rapier floor/wall queries.
  Phase 3 additions (additive): `plan(..., { lockFacing, pushX })`, `launch`, `hold`, `reset`.

The environment shape (`radius`, `halfHeight`) is not a pushbox and not a combat hurtbox; combat
hit/hurt boxes are separate data in `src/combat/`. All tuning values are placeholders. Intents come from a
`FighterController` (keyboard now; a second human player or CPU later), never from devices directly.


## Characters (Phase 4)

`characters/` holds the roster as pure data: `VERA` and `REX` (`CharacterDefinition`: name,
archetype, body / movement config, health, move set), `ROSTER`, `DEFAULT_MATCHUP`,
`validateCharacter`, and `models.ts` with the bundled GLB URLs. See `docs/CHARACTER_BIBLE.md`.
