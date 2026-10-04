# `src/physics/`

**Status: implemented (Phase 2).** Rapier is the authority for the *environment* only.

- `loadRapier()` — imports `@dimforge/rapier3d-compat` dynamically (own build chunk; the WASM is
  embedded, so it works offline) and initialises it once (cached promise).
- `PhysicsWorld` — owns a Rapier `World` holding the static stage colliders (floor, walls), and
  answers `castStageRay` queries that fighters use to stop at floors and walls. Also `prime()`,
  `step(dt)` with the game loop's fixed `dt`, `CollisionGroups`, and `dispose()` that frees the world.

Not physics: fighter motion and jump arcs (`fighters/motion.ts`), fighter-vs-fighter spacing
(`fighters/spacing.ts`), and combat hit/hurt boxes (Phase 3, separate data).
