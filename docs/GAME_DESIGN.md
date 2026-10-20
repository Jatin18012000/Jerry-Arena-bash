# Game Design — BRAIN ROT: LEGENDS

Status legend: **Implemented** = exists in code and is tested · **Planned** = approved scope, not built ·
**Future** = intended after the first playable release, details open.

> As of Phase 3 the engine foundation, Rapier physics, the fight camera, placeholder 2.5D movement and
> the **combat core** (frame-data attacks, blocking, stun, knockdown, health, rounds, timer, KO,
> best of three) are implemented on placeholder capsules. Fighters, arenas, menus and modes are planned.

## Pitch

A proper 3D, 1v1 fighting game that runs in the browser, works fully offline, and needs no account,
server or API key. Two fighters on a 3D stage, side-on fight camera, readable frame-based combat.

## Platform constraints (fixed)

- Browser-based (desktop first; keyboard now, gamepad planned).
- Offline-first: every asset ships with the build; no network calls at runtime.
- No backend, no runtime API keys, no paid runtime APIs or connectors.
- Assets authored in Blender, exported as GLB.

## Roster

| Fighter | Status |
| --- | --- |
| VERA | Planned — first playable fighter |
| REX | Planned — first playable fighter |
| TITAN | Future |
| NOVA | Future |
| KAI | Future |
| VANTA | Future (also the namesake of the "VANTA's Domain" arena) |

Character details live in [CHARACTER_BIBLE.md](CHARACTER_BIBLE.md).

## Modes

| Mode | Summary | Status |
| --- | --- | --- |
| Versus | Local 1v1 (player vs player or player vs CPU) | Planned — first mode to build |
| Training | Free practice vs a configurable dummy, frame data display | Planned — a debug version exists in the combat sandbox (dummy modes, hitbox overlay, frame-data readout) |
| Arcade | Ladder of CPU fights ending in a boss | Planned |
| Story | Narrative chapters with fights between scenes | Future |
| Survival | Consecutive fights with limited health recovery | Future |
| Shop | Spend in-game currency (earned, never real money) on cosmetics/unlocks | Future |
| Options | Controls, audio, video settings | Planned |

## Arenas

| Arena | Status |
| --- | --- |
| Neon City | Planned |
| Ancient Temple | Planned |
| Underground Fight Club | Planned |
| Rooftop | Planned |
| VANTA's Domain | Planned |

No arena geometry exists yet. The Phase 1 floor/grid is a debug scene only.

## Core match rules (subject to tuning)

- **Implemented:** best of 3 rounds, 60 s round timer, KO or time-out decides a round (higher health
  wins a time-out; draws award both fighters the round), 1000 health each.
- **Planned:** super / special meter.
- Detailed combat rules: [COMBAT_SYSTEM.md](COMBAT_SYSTEM.md).

## Controls (current keyboard layout, Phase 3)

Left hand moves (WASD or arrows); right hand attacks on U I O L (light, heavy, kick, special) and
blocks on the home row (J high, K low). Bindings are data in `src/engine/input/actions.ts`; a second
local player and gamepad support are planned.

## Open design questions

- Movement model: **decided for now — 2.5D** (fighters move on one plane; implemented in Phase 2).
  An optional 3D sidestep remains open for later.
- Online play is out of scope (no backend). Local versus only.
