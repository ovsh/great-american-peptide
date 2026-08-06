# Poke rebuild — decision trail

Overnight rebuild of "The Great Peptide Tracker" into "Poke". Run started 2026-08-06 ~00:45.
Owner: Claude (supervisor/critic). Implementation: codex gpt-5.6-sol, effort xhigh.

## Exit condition

App renamed and rebuilt in MeAgain's product style with our own branding: onboarding flow
(personalized setup, gated on first run), clean spacious design system replacing the
Americana theme, redesigned home/log/history/profile, side-effect logging, streaks.
Predicate: typecheck clean, every screen walkable in web preview + iOS simulator without
dead ends, before/after screenshots captured, all work committed on `rebuild/poke`.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Name: **Poke** ("Poke: Peptide & GLP-1 Tracker") | Short, friendly, literal (an injection is a poke). No collisions in niche (checked iTunes API: "poke tracker" surfaces only Pokemon apps; Dosely/Pip weaker). Keeps ASO keywords in subtitle like every category winner. |
| 2 | Keep bundle id `industries.peptide.tracker` | Ships as an update to the existing App Store record (id6764757185). Display name change only. |
| 3 | Keep domain layer (pk, reconstitution, rotation, scheduling, units), replace UI layer | Domain math is the app's hard-won value; the complaint was UX. Laziness protocol: smallest change that solves the problem. |
| 4 | Schema: one migration (v5) adding side_effect_logs; onboarding uses existing tables | Schema already models meds/injections/measurements/preferences well. Model-the-domain: side effects are their own shape, not a measurement kind. |
| 5 | Food/calorie tracking (MeAgain's biggest feature) **cut** from overnight scope | A calorie counter is weeks of work (food db, search). Water/protein quick-log via measurements.kind is the cheap adjacent win, Phase 3 stretch. |
| 6 | Progress photos **cut** | Camera/photo storage flows too heavy for one night; schema can add later. |
| 7 | Branch `rebuild/poke`, WIP snapshot committed first | Reversible; main untouched. |
| 8 | Verify loop: expo web (fast iteration) + iOS simulator (final) | Web preview renders the real app; simulator is the shipping artifact. Prove-it-works. |

## Iteration log

| Time | What changed | Predicate movement |
|------|--------------|--------------------|
| 00:45 | Branch created, WIP snapshot commit 0bf301f. Baseline web screenshot of old home captured. | Baseline established. |
| 01:05 | MeAgain teardown landed. Spec updated: Cal-AI-school onboarding without the hard paywall (their #1 complaint), med-level card as home hero, countdown on dashboard (their redesign regret), 0–10 side-effect severity, no fabricated goal-date projection (medical-claim risk). | Spec complete. |
| 01:10 | Phase 1 dispatched to codex (gpt-5.6-sol, xhigh): migration v5, theme swap (legacy keys kept for compile compat), primitives restyle incl. the focus-ring overflow bug, 8-screen onboarding, root gate, display name "Poke". Phase 2 brief pre-written. | Phase 1 in flight. |
| 01:50 | Phase 1 landed. Found + fixed one real bug in review: relative route paths (./taking) 404'd on web — swept to absolute /onboarding/* paths. Walked all 8 onboarding screens on expo web: gate works, db seeding works, Today shows seeded med/weight/goal. Six polish findings appended to Phase 2 brief (a11y button names, placeholder dupes, time picker, welcome centering, plan-screen weight echo, day-pill grid). Committed a16aa50. | Phase 1 predicate met. |
| 01:55 | Phase 2 dispatched: tab bar (+ center log sheet), Today rebuild (med-level hero, countdown, quick tiles), confirm-first log-shot, history+calendar merge, new Progress tab, Profile cleanup, Americana component deletion. | Phase 2 in flight. |
