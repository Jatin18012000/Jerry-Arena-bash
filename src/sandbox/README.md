# `src/sandbox/`

**Status: implemented (debug only, Phase 2).** Not an arena, roster or game mode.

- `SandboxSimulation` — headless, deterministic gameplay step: Rapier stage (floor + walls at
  ±8 m), two placeholder fighters and spacing. `step(dt, p1Intent, p2Intent)`; no camera or devices.
- `MovementSandboxState` (`sandbox.movement`) — the default state: P1 on the keyboard, P2 an idle
  dummy, drawn as capsules with a "nose" that shows facing; owns the fight camera (FOV configurable
  via `createMovementSandboxState(rapier, { camera: { fov } })`).
