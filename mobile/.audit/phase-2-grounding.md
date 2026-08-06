# Phase 2 grounding

## Fixed contract

- Rebuild the six Phase 1 findings, then scope items 1 through 8 in order.
- Run strict TypeScript after the review fixes and after each numbered item.
- Add no dependency. Keep web compatibility. Do not use Git.
- Keep durable data in SQLite behind existing repositories. Keep Zustand as an invalidation counter only.
- Keep PK, schedule, streak, unit, and rotation calculations pure in `src/domain`.
- Use the Phase 1 Poke tokens. Remove BrandSeal, MastHead, Eyebrow, the seal route, and the calendar tab route.
- The center plus opens a shared bottom sheet with working routes for shot, weight, side effect, and calculator.

## Existing data and routes

- `MedicationRow`, `InjectionRow`, `MeasurementRow`, `SideEffectLogRow`, and `PreferencesRow` are authoritative database shapes.
- `list*` repositories return newest first. Screen writes call `bumpVersion()`.
- `estimatedLevelAt()` matches the old estimated-level tile.
- `recommendNextSite()` accepts `{ siteId, takenAt }[]` and a route.
- `frequencyHours()` exists. No streak helper exists.
- `/log-side-effect` and `app/(tabs)/progress.tsx` do not exist.
- Calendar is a screen-local month grid that must become a reusable component inside History.
- The current tab layout mounts screens directly and handles web history itself.

## Required design choices

- Name the typed view-model shapes for Today, History, Progress, and confirm-first Log shot.
- Place shared pure derivation without creating a second state cache.
- Define one interval-based streak rule that works when weekday anchors are absent or ambiguous.
- Make the seven-day hero strip sampled medication level bars with today highlighted.
- Use the hero medication for Today and Progress streaks.
- Add a minimal 0 to 10 side-effect logger because both required entry points must work.
- Keep the default shot path one confirmation deep. Save the suggested site unless the user overrides it.
- Keep backdated exact time and notes under Details.
- Prefer the smallest module set. Delete legacy routes and components after callers move.

## Candidate output

Write a design package with caller usage first, TypeScript type sketches and signatures, a module map, a synthesis-decision placeholder, tradeoffs, alternatives, risks, and the first implementation step. Do not edit the app.
