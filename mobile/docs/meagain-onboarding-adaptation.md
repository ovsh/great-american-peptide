# MeAgain onboarding — adaptation log

Companion to `meagain-onboarding-map.md`. The map records what MeAgain does. This file
records every place Poke's build departs from it, and the constraint that forced the
departure.

"I thought it was better" is not a constraint. Every row below names a hard blocker: a
missing integration, a data model that cannot hold the answer, an App Store rule, or a
standing instruction that survived the 8 Aug amendment.

---

## Amendment, 8 Aug 2026

The original brief banned four things. After the map was reviewed, the owner lifted three
of them. Recorded here because the ban is written into `DECISIONS.md` row 18 and into the
comment header of `src/services/onboardingPlan.ts`, and a future reader needs to know the
reversal was deliberate and whose it was.

| Original constraint | Status | Owner's instruction |
|---|---|---|
| No goal-date projection, in any form, however hedged | **Lifted** | "I'm OK with payoff moments and copying the whole persuasion and positioning and moments and payoff of MeAgain" |
| Copy register is `plain` per `.claude/rules/copy.md` | **Lifted for this flow** | "Copy warm closer to MeAgain" |
| No fake progress; a compute screen may show only real work | **Lifted** | "30 / 14 with the simulated progress too" |
| Screen count stays near Poke's 8 | **Lifted** | "MeAgain is good. 30 / 14" |

Still in force, and not raised by the owner:

- No invented numbers. A half-life without a citation stays a type error in
  `src/domain/peptides.ts`.
- No copying MeAgain's in-onboarding rating ask. See row A3.
- The disclaimer stays, byte-identical, on the screen whose button writes
  `disclaimer_accepted_at`.
- Medical and subscription strings get clearer, never weaker.
- No placeholder or fake data on a shipping screen.
- Do not bump a version, push metadata, or submit anything.

**One concern, stated once, then built as instructed.** The projected goal date is the
pattern `store-setup.md` §1A was written to avoid: it is an outcome claim about a body,
made by an app whose store listing promises it does not advise, diagnose or treat. It is
common in the category and it is the owner's call to take that risk. It is built. The
mitigation actually in the code is row P4: the date is arithmetic on numbers the user
typed, it is labelled as such on screen, and it moves the moment they move the pace
slider — so it reads as a calculator, not as a forecast.

---

## A. Screens Poke cannot copy

| # | MeAgain | Poke | Constraint |
|---|---|---|---|
| A1 | Apple Health connect (step 7) | **On-device statement** (step 20): Poke keeps everything on this phone and exports on demand | Poke has no HealthKit integration. `package.json` and `app.json` carry no health entitlement and no health module. A connect button that connects nothing is a feature the code does not have. |
| A2 | Journey question offers 3 options in one capture, 2 in the other | 2 options, `already taking` / `about to start` | The recording I measured shows 2. The third (`I haven't decided yet`) appears only in the 7 Aug capture. Following the source I actually measured. |
| A3 | Rating ask mid-onboarding (step 21) | **Not built.** The slot is a real Poke screen instead | Standing instruction, not lifted. `src/services/reviewGate.ts:60` returns false while `onboardingCompletedAt` is null, and `reviewGate.test.ts` asserts it. Copying MeAgain here means deleting a tested policy. Apple's own guidance also puts the prompt after the user has something to rate. |
| A4 | Sign-in (`Already got an account? Sign in.`) | Not built | Poke has no account system. Nothing to sign in to. |
| A5 | Weight-loss framing throughout | Framing widens to the four `GoalKind` values | Poke ships for peptides generally, not GLP-1 alone. `store.config.json` describes a log, not a weight-loss programme. The weight questions still run, and drive the projection, for anyone who answers them. |
| A6 | Sex, birthday and activity feed a nutrition model: protein, fiber, hydration and step targets on the reveal | The three questions run in MeAgain's positions, and the reveal shows none of those targets | Poke has no nutrition model and no step counter. `src/domain/` holds pk, reconstitution, rotation, scheduling and units, and nothing that turns an age into a calorie budget. Building one to fill the slot is inventing a number. Each of the three screens says on its face what Poke does with the answer, so the question does not read as a promise. |
| A7 | Dose screen offers `2.5 mg` … `15.0 mg` as pickable values (step 4) | Dose is a free text field that starts empty, with a unit toggle | `.claude/rules/copy.md`: never put a number in a dose field as a placeholder, because `review.notes` promises Poke never proposes a number. A pickable dose list is that promise broken in the other direction. |

## B. Structure

| # | MeAgain | Poke | Constraint |
|---|---|---|---|
| B1 | Fixed 23-step progress bar | **Same. Fixed 23 steps** | **Deviation withdrawn, 8 Aug.** It was `onboardingTotalSteps(n)`, growing to 24 at two medications, and a denominator that grows under a fixed numerator runs the bar backwards: choosing a second medication moved the fill from 3/23 to 3/24, on screen, under the user's thumb. The schedule run is now one counted step divided between its screens (`scheduleStepIndex`), which is monotonic at any medication count and is also what the recording does. `DECISIONS.md` row 17 is untouched: there is still one schedule screen per medication. |
| B2 | Progress **bar** | Progress **bar**, replacing Poke's dots | Forced. Poke's `OnboardingScreen` drew one dot per step. Twenty-three dots do not fit a 375 pt screen. The bar is the only readable form at this length, and it is what MeAgain uses. |
| B3 | Question order: sex, birthday, height, weight, goal, pace | Same order, plus unit toggles on the height and weight screens | Poke stores `height_unit` and `weight_unit` and has no other screen to set them. The toggle rides on the screen whose number it governs, so no screen becomes two questions. |
| B4 | Interstitials at steps 6, 13, 15, 17 | Same four positions | None. Copied. |

## C. Copy

| # | MeAgain | Poke | Constraint |
|---|---|---|---|
| C1 | Contractions, em-dashes, "we" | Warmth, this flow only. See C5 for where the warmth stops | `.claude/rules/copy.md` still governs the rest of the app. The rule file is unchanged; the exception is scoped to `app/onboarding/` and recorded here and in `DECISIONS.md`. What was lifted is the `plain` register, not the em-dash ban and not the one-comma rule, which are legibility rules rather than tone rules. |
| C2 | Interstitial claims cite nothing | Every Poke claim names its source, or states what it is doing rather than claiming an outcome | No invented numbers. Poke has no user count, no clinical trial and no 370K users, so it claims none. |
| C3 | Paywall review card quotes a named user | Not built | Poke has no reviews yet. A fabricated review is fake data on a shipping screen, and a fabricated App Store review is also a store rule. |
| C4 | Side-effect screen promises MeAgain will "help you manage them better" | `concerns.tsx` says Poke keeps the list and that you can log a side effect from Today | Poke manages nothing. It has `app/log-side-effect.tsx` and a trend chart, so the copy names those two things and stops. |
| C5 | Contractions everywhere, including in Poke's own voice | Contractions only where the option is the user speaking in the first person | Row C1 lifts the register for MeAgain's *warmth*, not for Poke's *voice*. `MOTIVATION_OPTIONS` and `LAST_SHOT_OPTIONS` are sentences the user picks as their own ("I'm playing the long game"), so they contract. Anything Poke says about itself does not. |
| C6 | Step 22 labels a system permission as a benefit (`Reach Your Dream Weight with Notifications`) | `notifications.tsx` names the exact notification: how many, which day, which hour, and that Poke sends nothing else | A benefit headline over a permission prompt is a claim about an outcome. The count is read from `medicationIds.length` rather than written as one, because `services/notifications.ts` schedules per medication and not per user, so a two-medication run really does get two. |

## D. The payoff

| # | MeAgain | Poke | Constraint |
|---|---|---|---|
| P1 | `Timeline - Dream Goal`, current → goal weight, ending on a projected date | Same shape: current weight → goal weight, ending on a computed date | None. Approved 8 Aug. |
| P2 | Date appears from nowhere | Date is `(current − goal) ÷ weekly pace`, on the numbers the user typed, and the screen says so | Rule: medical strings get clearer, never weaker. The arithmetic is visible so the number is checkable. |
| P3 | Projection runs whether or not the user gave a weight | Projection is skipped when weight or goal weight is missing, and the plan card shows the shot schedule alone | No invented numbers. There is no default body weight. |
| P4 | Pace slider is decorative next to the date | Pace slider recomputes the date live | Same reason as P2. A number that moves when you move the input is legible as arithmetic. |
| P5 | Compute ring, 13.8 s, decelerating, no real work behind it | Same 13.8 s and the same measured curve, and the plan really is computed during it | Approved 8 Aug. The real work is genuinely there (`buildOnboardingPlan`) and takes about a millisecond, so the remaining 13.799 s is pacing. Reduce Motion skips straight to the plan. |

## E. Motion

| # | MeAgain | Poke | Constraint |
|---|---|---|---|
| E1 | 330 ms fade-out, 65 ms hold, 330 ms fade-in, ease-in-out | Identical, `src/theme/spacing.ts` `onboardingMotion` | None. Copied from the measurement. |
| E2 | Chrome holds at full opacity through the transition | Same. The footer button moved out of the scroll view to make this possible | Forced restructure of `OnboardingScreen`. The old layout put the button inside the fading content. |
| E3 | No reduce-motion path observed | Reduce Motion collapses the 725 ms transition to 0 and the 13.8 s compute to 0 | Accessibility. Not something the recording can rule on. |

---

## F. Answers Poke stores and does not act on

MeAgain's flow implies every answer feeds the plan. Poke's does not, and the honest move is
to say so on the screen that asks. Each row below is a screen whose subtitle was rewritten
during the critique pass because it named a behaviour `rg` could not find in the code.

| Screen | It claimed | It actually does | Where the truth is |
|---|---|---|---|
| `goal.tsx` | "This sets what Poke puts first on your Today screen." | Appears as the `Goal` row on the plan card, then is written to `preferences.goal_kind` and read by nothing | `app/(tabs)/index.tsx` has no goal-ordered card stack. Reordering Today by goal is a real feature and a separate piece of work. |
| `last-shot.tsx` | "If you have already started, Poke counts your level from it." | Only `today` and `yesterday` seed the curve. The three vaguer answers are held and written as null | `services/onboarding.ts:174` `lastShotAt`. A curve started from "earlier this week" is a curve started from a guess. |
| `privacy.tsx` | "You can skip any question that you would rather not answer." | Four screens carry a skip: height, weight, goal weight, notifications | `secondary` prop on `OnboardingStep`, and `Not now` on `notifications.tsx`. |
| `concerns` | — | `side_effect_concerns` reaches the plan card watch list and the database, and no screen after onboarding reads it | `repositories/preferences.ts`. The copy therefore promises a list, not a behaviour. |

## G. Two warts left in place

Named so a later reader does not mistake either for an accident.

- The interstitial that sits in MeAgain's step-15 slot lives at the route
  `/onboarding/consistency`, and its content is now "Where your date comes from". The route name
  is a leftover from an earlier draft. Renaming it touches `POST_SCHEDULE_ORDER`,
  `previousHref`, `nextHref` and the typed-route table for no user-visible gain.
- The welcome carousel reads its page index from `onScroll` rather than momentum end,
  because iOS fires no momentum end when a page is dragged across and released without a
  flick. The cost is a state check on every scroll frame, which is why the setter compares
  before it writes.

---

## Deviations I did not take

Places where copying MeAgain was possible and I copied it, listed because each one is a
place a reviewer might expect Poke to have flinched:

- The paywall stays last, after the reveal, with no gate. `✕` dismisses it into the app.
- All fifteen questions come before the paywall.
- Four claim interstitials, at MeAgain's step numbers.
- Selecting never auto-advances. Every question needs an explicit press.
- The primary button is disabled until the screen is answered.
- The compute screen runs its full 13.8 seconds.
