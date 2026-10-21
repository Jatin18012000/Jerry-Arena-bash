# `src/sandbox/`

**Status: implemented (debug only, Phases 2–4).** Not an arena, roster or game mode.

- `SandboxSimulation` — headless, deterministic movement step: Rapier stage (floor + walls at
  ±8 m), two placeholder fighters and spacing. `step(dt, p1Intent, p2Intent, plans?)`; Phase 3 added
  optional per-fighter `PlanOptions` (locked facing, pushback) and `resetPositions`.
- `CombatSandboxState` (`sandbox.combat`, the default) — P1 on the keyboard vs a training dummy in a
  best-of-three `Match` between two roster characters (default VERA vs REX). With models supplied
  (Phase 4) fighters are the animated GLBs; otherwise capsules with an attack "limb". Hit/block
  flashes, sparks, screen shake, special energy streak, hitbox overlay (H), dummy modes (T), DOM
  match HUD and a frame-data debug readout.
- `MovementSandboxState` (`sandbox.movement`) — the Phase 2 movement-only sandbox.
- `debugStage.ts` — shared floor / grid / walls and a resource tracker.

Known cosmetic issue: a fighter knocked out against a wall lies partly through it (capsule placeholder).
