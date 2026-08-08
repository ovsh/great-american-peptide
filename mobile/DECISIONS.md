# Poke — decision record

Append only. When a decision changes, add a new row and set the old row's status to
`Superseded by #N`. Never edit or delete an old row: it was true when it was made, and the
reason behind it is the part you cannot rebuild later.

Read this file before you change or undo an architectural choice. If you are about to do
something this file argued against, the burden is on you to say what changed.

Dated narrative does not belong here. Run logs live in `docs/` with a date in the filename.
See `docs/rebuild-log-2026-08-06.md`.

## Decisions

Rows 1–8 come from the original run log. Rows 9–13 were reconstructed from the shipped
artifacts and commit history on 7 August 2026, so their stated reasons are inferred, not
quoted. Correct any row that is wrong — reconstruction is the one case where editing an old
row is allowed, because the row was never a first-hand record.

| # | Decision | Why | Status |
|---|----------|-----|--------|
| 1 | Name the app **Poke** ("Poke: Peptide & GLP-1 Tracker") | Short, friendly, literal — an injection is a poke. No collision in the niche: the iTunes API shows "poke tracker" returns only Pokemon apps. Dosely and Pip are weaker. Keeps the ASO keywords in the subtitle, like every winner in the category. | Superseded by #9 |
| 2 | Keep the bundle id `industries.peptide.tracker` | Ships as an update to the existing App Store record `6764757185`. Only the display name changes. Changing it would mean a new app and the loss of all reviews. | Live |
| 3 | Keep the domain layer (pk, reconstitution, rotation, scheduling, units). Replace the UI layer. | The domain math is the app's hard-won value. The complaint was about UX, not correctness. Smallest change that solves the problem. | Live |
| 4 | One migration (v5) adding `side_effect_logs`. Onboarding reuses the existing tables. | The schema already models meds, injections, measurements and preferences well. A side effect is its own shape, not a kind of measurement. | Live |
| 5 | Cut food and calorie tracking | It is the biggest feature in the app we studied, and it is weeks of work: a food database plus search. Water and protein quick-log through `measurements.kind` is the cheap adjacent win. | Live |
| 6 | Cut progress photos | Camera and photo storage are too heavy for the time available. The schema can take them later without a migration conflict. | Live |
| 7 | Work on branch `rebuild/poke`, with a WIP snapshot committed first | Reversible. `master` stays untouched until the rebuild is proven. | Live |
| 8 | Verify on expo web first, iOS simulator last | Web preview renders the real app and iterates in seconds. The simulator is the shipping artifact, so it gets the final pass. | Live |
| 9 | Rename the listing to **Poke: Peptide & GLP-1 Log** | "Tracker" is the most contested word in the category. "Log" is passive and matches the medical positioning: the app records what the user types, it does not track or infer anything. Lower App Review risk under guideline 1.4.1. | Live |
| 10 | Subscription: monthly $9.99, yearly **$39.99** with a one-month free trial. No trial on monthly. No discount ladder. | $39.99 matches Shotsy's cheapest tested point and beats Peps at $44.99; it also makes the badge read "Save 67%" instead of "Save 58%". The one-month trial goes against the crowd on purpose: a weekly injector logs 0–1 shots in 3 days and 4 in a month, and we sell the trend across shots, so a short trial charges for an empty chart. Measured gap: trials of ≤4 days convert 25.5%, trials of 17–32 days convert 42.5%. No trial on monthly, because a free month on $9.99 gives the plan away. No discounts, because ~90% of the category sells at full price. Full working: `docs/market.md`. | Live |
| 11 | Gate the paid features with RevenueCat, and unlock everything if the store is unreachable | A reviewer or an offline user must never meet a door that will not open. Failing open costs a few unpaid unlocks. Failing closed costs a rejection. | Live |
| 12 | No account, no sign-in, no server. All data stays on the device. | It is the strongest privacy claim in the category, and it removes the single most common paid-app rejection: a reviewer who cannot get in. | Live |
| 13 | The App Store listing is code (`store.config.json`, pushed with `eas metadata:push`) | A hand edit in App Store Connect is invisible to review and is lost on the next push. The listing wording is medical-risk surface, so it belongs under version control. | Live |
| 14 | Agent documentation uses four layers, with append-only decisions | Always-loaded context is a fixed budget, so detail moves down the tree instead of being deleted. See `../docs/agent-docs.md`. | Live |
