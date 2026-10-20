# `src/ui/`

**Status: placeholder match HUD implemented (Phase 3); menus planned (Phase 5).**

- `MatchHud` — DOM health bars, round-win pips, timer and announcements ("ROUND n", "FIGHT!",
  "K.O.", "TIME", winner). Writes to the DOM only when values change.
- `bannerFor(match)` — pure: which announcement to show.

Planned: title, mode select, character select, pause, options, final HUD art and super meter.
