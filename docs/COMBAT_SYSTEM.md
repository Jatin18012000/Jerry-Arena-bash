# Combat System

Status legend: **Implemented** = in code and tested · **Planned** = approved, not built · **Future**.

> **Status: Phase 3 combat core — Implemented** on the placeholder capsule fighters.
> Frame-data attacks, hit/hurt boxes, high/low blocking, an 8-frame input buffer, hitstun /
> blockstun, pushback, knockdown and get-up, health, rounds, timer, KO / time-out, best of three,
> hit-stop, screen shake, and a training frame-data readout all work in the combat sandbox.
> The four moves are **generic system-test moves**, not VERA's or REX's move lists. All numbers are
> tunable placeholders.

Code: `src/combat/` (simulation, pure and headless) · presentation in `src/sandbox/CombatSandboxState.ts`,
`src/effects/`, `src/ui/`. Tests: `tests/combat-*.test.ts`.

## Determinism rules (Implemented)

- Combat runs inside the existing fixed 60 Hz loop. **Integer combat frames** are the only clock.
- Hit detection is explicit box overlap on a fixed post-movement snapshot. **No Rapier contacts**, no
  wall-clock time, no `Math.random()`, no unordered iteration: fighters are always processed in the
  fixed `[P1, P2]` order and every decision in a stage reads the same snapshot, so order never
  changes the result.
- Presentation (sparks, shake, flashes, camera, HUD) reads the simulation and never writes it.
- Tests replay a seeded 3000-step fight step for step, and prove identical results at 30 / 60 / 144 fps
  and with jittery frame times. Scope: same build on the same platform (see ARCHITECTURE.md).

## Update order per fixed step (Implemented)

`CombatSimulation.step(dt, [p1Input, p2Input])`, wrapped by `Match.step` for round flow:

| # | Stage | Notes |
| --- | --- | --- |
| 0 | **Hit-stop check** | If frozen: count down, record new presses, hold fighters still, return. Nothing else advances. |
| 1 | Advance combat frame | |
| 2 | Record presses, prune expired buffer entries | |
| 3 | Advance combat phases | attack frames, stun timers, knockdown → getup → neutral |
| 4 | Resolve actions | actionable + grounded fighters take a buffered attack, or enter / leave guard |
| 5 | Movement | the **existing** `SandboxSimulation.step` (motion → Rapier stage → pushboxes) with combat-filtered intents, locked facing and pushback |
| 6 | Landing | launched fighters that touched down enter knockdown |
| 7 | Hit detection | active hitboxes vs current hurtboxes; block decisions use the pre-hit snapshot |
| 8 | Resolve hits | damage / stun / pushback / launch / KO; start hit-stop; emit events |
| 9 | Match | (in `Match`) intro / fight / round over / match over; timer; KO and time-out checks |

## Frame data (Implemented)

Each move is a typed `MoveDefinition` (`src/combat/moves.ts`): id, name, button, startup / active /
recovery frames, damage, hitstun, blockstun, hit level, hitbox, hit reaction (`stagger` | `knockdown`),
hit and block pushback, hit-stop on hit and on block, and a presentation-only shake strength.

**Frame numbering** (used everywhere): the step an attack starts on is **frame 1**.
Startup = frames `1..S`, active = `S+1..S+A` (inclusive), recovery = the next `R` frames; the attacker
acts again on the following step. A 5-frame-startup move first hits on frame 6.

**Stun numbering:** the hit happens on the defender's frame 0; an `N`-frame hitstun means the defender
cannot act on the next `N` combat frames. Advantage on hit = `hitstun − (A − 1 + R)` (same for block),
and the debug readout measures the real value after every exchange to confirm it.

**Validation:** `validateMoveSet` runs when a `CombatSimulation` is created and in tests. It rejects
non-integer or negative frame counts, zero active frames, negative / non-finite damage or pushback,
unknown hit levels or reactions, stagger moves without hitstun, inverted / zero-depth / behind-the-
fighter hitboxes, duplicate ids and moves registered under the wrong button.

### Placeholder move set

| Move (button) | S / A / R | Dmg | Level | Hitstun | Blockstun | On hit | On block | Hit-stop | Pushback hit / block | Role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Light (U) | 5 / 3 / 10 | 40 | high | 15 | 11 | **+3** | **−1** | 6 | 0.35 / 0.30 m | fast jab; whiffs over crouchers |
| Heavy (I) | 10 / 4 / 18 | 90 | mid | 22 | 16 | +1 | −5 | 10 | 0.70 / 0.60 m | more reach and push |
| Kick (O) | 8 / 4 / 15 | 65 | low | 19 | 14 | +1 | −4 | 8 | 0.55 / 0.50 m | only a low guard blocks it |
| Energy Strike (L) | 14 / 5 / 24 | 120 | mid | — | 18 | knockdown | **−10** | 14 | launch / 0.90 m | most damage and reach; very unsafe on block |

The special is a short-range "energy strike": a plain, larger hitbox (reach 1.6 m) — no projectile.

## Boxes (Implemented)

Three separate volumes, never derived from each other:

| Volume | Where | Purpose |
| --- | --- | --- |
| Environment capsule | `fighters/config.ts` (`radius`, `halfHeight`) | Rapier floor / wall collision only |
| Pushbox | `fighters/config.ts` (`pushHalfWidth`, `pushHeight`) | fighter-vs-fighter spacing (Phase 2) |
| **Hurtbox** | `combat/config.ts` `hurtboxes` | where a fighter can be hit |
| **Hitbox** | per move, `MoveDefinition.hitbox` | where an attack hits, during active frames only |

- Hurtboxes by posture: **stand** 0–1.8 m · **crouch** 0–1.1 m (so the high light passes over) ·
  **air** 0.1–1.7 m above the airborne feet. Launched, knocked-down, getting-up and KO'd fighters have
  **no hurtbox** (no juggles or okizeme yet).
- Hitboxes are placed relative to the attacker's feet along its facing (`near..far` in front,
  `bottom..top` above the feet). Overlap is open-interval: touching edges do not hit.
- **One hit per attack instance:** an attack that connects (hit or block) cannot connect again,
  even if it still overlaps on later active frames.
- Crouching changes the combat hurtbox, not just the capsule's visual squash.

## Blocking (Implemented)

Hold **J** for a standing (high) guard or **K** for a crouching (low) guard. Guarding stands still.

| Incoming | High guard | Low guard |
| --- | --- | --- |
| High | Blocks | Blocks (in practice the high light passes over the crouching hurtbox) |
| Mid | Blocks | Blocks |
| Low | **Hit** | Blocks |

The table is data (`combat/blocking.ts` `BLOCK_RULES`). A block: no damage (no chip damage),
blockstun, block pushback, block hit-stop, blue spark and flash. A blocking fighter keeps guarding
through blockstun and may switch guard level during it.

**Cannot block** while attacking, in hitstun, launched, knocked down, getting up, KO'd, or airborne
(no air blocking in Phase 3). A guard only covers the **front**: an attack from the side the
defender is not facing is a hit.

> Design note: as specified, the low guard currently blocks everything, so standing guard has no
> advantage yet. The planned counterpart is an **overhead** level (a mid that a low guard cannot
> block) — a one-line data change in `BLOCK_RULES` plus a move that uses it.

## Input buffer (Implemented)

- Per fighter, timed in **combat frames** (never event timestamps). Window: **8 frames** — a press on
  frame P can come out on frames P..P+7.
- Only actionable, grounded fighters consume it, so buffered presses never cut recovery, stun,
  knockdown or get-up short; a press made just before stun ends comes out on the first free frame.
- Oldest eligible press wins; presses on the same frame resolve **Special > Heavy > Kick > Light**.
  Taking a press clears the buffer, so leftovers never fire later.
- Presses during hit-stop count from the first frame after the freeze (the buffer does not age
  while frozen).
- No air attacks yet: a press made in the air comes out on landing if still within the window.
- Cleared on KO, at round end and at round start; ignored during intros and round-over.

## Fighter combat phases (Implemented)

Layered on top of the Phase 2 posture (`stand` / `walk` / `crouch` / `air`), not a parallel machine:

`neutral` → walk / jump / crouch freely, can attack or guard ·
`guard` (high / low) · `attack` (startup → active → recovery, facing locked) · `hitstun` (keeps a
crouching posture if hit crouching) · `blockstun` · `launched` · `knockdown` (40 frames) ·
`getup` (24 frames) · `ko`. Only `neutral` and `guard` are actionable.

## Hit reactions, pushback and knockdown (Implemented)

- **Stagger** hits: damage, hitstun, pushback.
- **Knockdown** hits (the special) and **any hit on an airborne fighter**: the defender is launched
  (7 m/s up, 3 m/s away), lands into knockdown, gets up, then can act.
- **KO** blow: larger launch; the fighter stays down for the round.
- **Pushback** slides the defender away over 8 frames. If the defender is against a wall, the
  attacker is pushed back by the remainder instead (corner rule).
- **Simultaneous hits trade**: both fighters' hits are found on the same snapshot and both apply.

## Hit-stop and screen shake

- **Hit-stop (Implemented, simulation):** on hit or block the whole simulation freezes for the move's
  hit-stop / block-stop frames — no attack frames, stun timers, movement, pushback or round timer
  advance. Fighters' render interpolation is held still. Inputs are still recorded.
- **Screen shake (Implemented, presentation):** strength from the move (`shake`), stronger on KO;
  deterministic oscillation, decays in ~6–20 frames.
- **Hit sparks and flashes (Implemented, presentation):** at the hitbox/hurtbox intersection.

## Rounds and match (Implemented)

`Match` (`src/combat/Match.ts`): **best of three** (first to 2 round wins), **60-second** round timer
(frames; frozen during hit-stop), 1.5 s intro ("ROUND n" → "FIGHT!"), 2.5 s round-over pause.

- KO: the other fighter wins the round. Double KO: draw.
- Time-out: higher health wins; equal health is a draw.
- A draw gives **both** fighters the round; if both reach 2 wins together the match is a draw.
- Match over: **Enter** (or **Esc** at any time) restarts the match.

## Training / debug (Implemented)

In the combat sandbox (default page):

- **T** cycles the P2 dummy: idle → block high → block low → crouch → jump → attack (light every 45 frames).
- **H** toggles the hitbox overlay (green hurtboxes, red active hitboxes).
- The debug HUD shows each fighter's phase and frame (e.g. `Heavy f7/32 startup`), buffered presses,
  hit-stop, the frame-data table, and the **measured** advantage of the last exchange next to the value
  the frame data predicts.

## Planned (next phases)

- Overheads and a reason to stand-block; chip damage (optional); throws and throw techs.
- Crouching and air normals; cancels / combo routes; damage scaling; juggles; wake-up options.
- Super / special meter and motion-input specials (the buffer is ready for sequences).
- Character-specific move lists, hitboxes driven by animation (Phase 4, with VERA and REX).
- Second local player and CPU AI (controllers already produce `FighterInput`).

## Future

Guard break, character-specific mechanics, rollback-friendly state snapshots for netplay
(not planned: no backend).
