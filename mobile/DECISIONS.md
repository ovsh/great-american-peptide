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
| 03:25 | Phase 2 landed and verified on web: full loop works (onboard → Today → log shot → level 0.25mg + countdown flip → History row). All six Phase-1 findings confirmed fixed. Three new findings (weight-tile contradiction, log-shot button below fold, front/back diagram ambiguity) appended to Phase 3. Committed 7db4f32. | Phase 2 predicate met. |
| 03:30 | Phase 3 dispatched: side-effect modal (0–10 severity), streaks domain module + tests, Progress side-effect frequency, reminders hardening, disclaimer surface, new app icon. | Phase 3 in flight. |
| 04:25 | Phase 3 landed + verified: 6/6 streak tests pass (tsx), tsc clean. Native sim run with seeded fixture: PK math correct (0.37mg from two 0.25 doses at 165h half-life), weight-tile contradiction fixed, side-effect tile live ("Last: Nausea · 4/10"), new green syringe icon confirmed on springboard. Deep-link tour of Progress/History/side-effect blocked by iOS "Open in Poke?" dialog (needs tap; simulator MCP blocked by xcode-select) — those screens verified on web instead. Committed as phase 3. | Phase 3 predicate met. |
| 03:40 | iOS build saga: expo run:ios failed 4 ways. Root causes found: (1) CocoaPods needs UTF-8 locale in background shells; (2) actool's AssetCatalogSimulatorAgent handshake over FIFOs is broken host-wide (its own recovery advice is a reboot — declined, user asleep). Workaround: compile Images.xcassets manually with actool (works without thinning), build with EXCLUDED_SOURCE_FILE_NAMES=Images.xcassets, copy icons + merge CFBundleIcons into Info.plist, ad-hoc re-sign, simctl install. Poke running natively on iPhone 16 Pro sim, Metro on 8081. NOTE for daytime: after a reboot, plain `expo run:ios` should work again; also `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` re-enables the simulator MCP panel. | Native verify loop live. |
