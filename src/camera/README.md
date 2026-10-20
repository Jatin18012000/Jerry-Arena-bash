# `src/camera/`

**Status: implemented (Phase 2).**

`FightCamera` (presentation only — reads fighters, never writes the simulation) frames both
fighters side-on: centres on their midpoint (clamped to stage bounds), backs off so both plus a
margin fit the horizontal field of view around that centre, follows jumps partially, and uses its
own configurable FOV (default 32°) to limit perspective lean. `update(dt, ...)` smooths in the fixed step; `apply(camera, alpha)`
interpolates at render time. `frameFighters()` is the pure framing function.

Screen shake (Phase 3) is applied on top by the combat sandbox from `src/effects/ScreenShake`; the
rig itself stays shake-free. Planned later: intro / KO shots, camera punch-in on supers.
