# Onboarding teardown — MeAgain vs Poke, 7 August 2026

History and evidence, not guidance. Written to answer one question: `SPEC-POKE.md` says
Poke's onboarding follows MeAgain's school. Is that true?

## How the evidence was collected

**MeAgain was not installed.** The iOS Simulator has no App Store, and installing an app on
the host needs an account sign-in that an agent must not do. Instead the flow was
reconstructed from a third-party screen capture of the live app
(screensdesign.com, 184 frames of a single session). The 36 frames from 00:00 to 02:55 are
the onboarding. They are in the session scratchpad as `sd-001-00m00.png` … `sd-036-02m53.png`.
Ten App Store screenshots were also pulled through the iTunes Lookup API.

**Poke was walked live** on the expo web preview at 375×812 on 7 Aug 2026, from the welcome
screen to `ready`, with two peptides selected.

Weakness of the method: the capture is one session by one operator. A/B variants and any
branch not taken are invisible. Treat screen *order* as certain and screen *conditionality*
as unknown.

## MeAgain — 36 screens

| # | Frame | Screen | Asks / claims |
|---|---|---|---|
| 1 | 001 | Splash | — |
| 2 | 002 | iOS ATT tracking prompt | Permission |
| 3 | 003 | "Downloading update" | — |
| 4–7 | 004–007 | Value carousel, 4 slides | "Your Trusted GLP-1 Partner", "Log food in seconds", "See How Far You've Come", "Virtual Capybara, Real Motivation" |
| 8 | 008 | "Your privacy comes first" | Accept and Continue |
| 9 | 009 | Journey stage | Where are you in your GLP-1 journey? |
| 10 | 010 | **Medication** | Which GLP-1 do you plan to use? **Single select.** Foundayo, Zepbound, Mounjaro, Ozempic, Wegovy, Wegovy Pill, Trulicity, Compounded Semaglutide … |
| 11 | 011 | Dose | Do you know your recommended starting dose? 2.5–15 mg, Custom/Other, "I haven't decided yet" |
| 12 | 012 | Frequency | Every day / Every 7 days (most common) / Every 14 days / Custom / Not sure |
| 13 | 013 | **Interstitial** | "See better results, fewer ups and downs" + chart + "82% of new GLP-1 users … reported better outcomes" |
| 14–15 | 014–015 | Apple Health | Optional sync + iOS Health sheet |
| 16 | 016 | Sex | — |
| 17 | 017 | Birthday | — |
| 18 | 018 | Height & weight | — |
| 19 | 019 | Dream weight | "What's Your Dream Weight?" |
| 20 | 020 | **Interstitial** | "Losing 7 kg might feel overwhelming — but it's very realistic" |
| 21 | 021 | **Pace** | Slider 0.1–1.5 kg/week, badge **"Est. Goal Date: Jul 22, 2026"**, footnote "This faster pace is within medical guidelines." |
| 22 | 022 | **Interstitial** | "Make GLP-1 Work for You — 3x More Effectively", 18% vs 3x bar pair |
| 23 | 023 | Activity level | — |
| 24 | 024 | **Interstitial** | "Conquer your toughest day" + a **weekly PK-shaped curve** + "By picking the perfect injection day, you can boost your long-term GLP-1 effectiveness by as much as 3x." |
| 25 | 025 | Craving day | Which day does food noise hit hardest? |
| 26 | 026 | Side effects | Multi-select |
| 27 | 027 | Motivation | What's driving you to reach your goal? |
| 28–29 | 028–029 | Rating prompt + testimonial wall | In-onboarding App Store rating ask |
| 30–32 | 030–032 | Notifications | Pre-prompt, then the iOS permission sheet |
| 33 | 033 | **Payoff 1** | "All done! / Thank you for trusting us / Let's create the perfect Plan for you." → **Create Plan** |
| 34 | 034 | **Payoff 2** | "Crafting your custom MeAgain Plan… **74%**", ring, four itemised steps ticking off: protein goals, daily step goal, timeline toward dream weight, shot-day timing |
| 35 | 035 | **Payoff 3** | "Congratulations your personal MeAgain plan is ready!" Cards: Timeline–Dream Goal 25.9 kg → 57 kg → **50 kg, Jul 22 2026**; Shot Schedule **Wednesday**; Water **68 oz**; Protein **75 g**; Fiber **25 g**; Daily Activity **5000 steps** |
| 36 | 036 | Paywall | "Stay on Track with Every GLP-1 Dose". Yearly $59.99 (= $4.99/mo) with a **75% OFF** badge against Monthly $19.99. Has a close X. |

Shape: **~2 minutes 55 seconds, 18 questions, 5 claim interstitials, 3 payoff screens.**

## Poke — 8 screens

| # | Route | Screen | Asks |
|---|---|---|---|
| 1 | `/onboarding` | Welcome | Wordmark, "Your shots, sorted." → Get started |
| 2 | `/onboarding/taking` | "What are you taking?" | **Multi-select**, 6 presets + Custom |
| 3 | `/onboarding/schedule` | "When's shot day?" | Dose + unit, frequency, weekday — **for the first peptide only** |
| 4 | `/onboarding/goal` | "What's the goal?" | Weight loss / Recovery / Longevity / Performance |
| 5 | `/onboarding/weight` | "Want to add your weight?" | Current + goal weight, skippable |
| 6 | `/onboarding/concerns` | "Anything you're watching for?" | Nausea / Fatigue / Constipation / Injection-site reactions / None |
| 7 | `/onboarding/reminders` | "Want a shot-day reminder?" | Time picker, then the iOS permission |
| 8 | `/onboarding/ready` | "Your plan is ready." | Nothing. Summary card + disclaimer + Start tracking |

Shape: **~40 seconds, 6 questions, 0 interstitials, 1 payoff screen.**

`ready` renders five rows: Medication, Dose, Shot day, Goal, optional Weight, plus a concerns
sentence and an optional reminder line. **Every value is a value the user typed on a previous
screen.** Nothing on the screen is computed.

## Side by side

| | MeAgain | Poke |
|---|---|---|
| Screens | 36 | 8 |
| Questions | 18 | 6 |
| Claim interstitials | 5 | 0 |
| Medication question | one, single-select | many, multi-select |
| Dose asked for | the one medication | the first medication only |
| Fake-compute screen | yes, 74% ring, 4 itemised steps | no |
| Payoff content | 6 derived numbers | 5 echoed answers |
| Goal date | fabricated and shown twice | forbidden, absent |
| Paywall | end of onboarding, dismissable | after `router.replace('/')`, over Today |
| Rating ask | inside onboarding | none |

## Verdict

**We did not clone the flow. We copied its silhouette.**

Three things are true at once:

1. **The claim in `SPEC-POKE.md` overstates what was done.** It says "We copy the structure".
   The structure that makes the Cal-AI school work is question → claim → question → claim →
   **compute** → reveal. Poke has questions and a reveal. It has no claims and no compute.
   There is also **no teardown artifact in the repo** — `SPEC-POKE.md`, the rebuild log and
   `market.md` are the only files that mention MeAgain, and none of them contains the
   screen-by-screen record the spec's claim rests on. The claim came from a summary, not a walk.
2. **Two divergences were deliberate and were right.** No hard paywall (their top complaint;
   `SPEC-POKE.md`). No fabricated goal date (`DECISIONS.md` intent, `store-setup.md` §1A).
   MeAgain's frame 021 also prints "This faster pace is within medical guidelines" — that is
   advice, and the reason 8 peptide apps are already off the US store (`market.md`).
3. **One divergence was an accident.** MeAgain asks about **one** medication. Poke asks about
   **many** and then quietly drops all but the first. That is not a design choice from the
   spec; it is the multi-select feature meeting a single-medication schedule model.

The user's instinct is correct on all three doubts. `ready.tsx` is a summary table, not a payoff.

## What Poke can compute honestly

The domain layer already holds everything needed for a real payoff, and none of it is a
medical claim, because all of it is arithmetic on what the user typed:

| Source | Output |
|---|---|
| `scheduling.ts` `nextScheduledDoses` | "Your next shot: Friday 8 Aug — in 1 day" |
| `pk.ts` `estimatedLevelAt` | The level curve across the first 4 weeks, with the steady-state week marked |
| `reconstitution.ts` | "2 mg vial + 1 mL water → draw 12.5 units" — the market wedge |
| `rotation.ts` `recommendNextSite` | The first 4 injection sites in order |
| user input | The reminder line, the watch list |

A curve is a restatement of a published half-life, not a prediction about the user's body. A
date arithmetic answer ("next Friday") is a fact. A goal date is a prediction about a body,
and stays out.

## Catalog integrity — what was checked

Two shipped half-lives are not supported by any source:

| Preset | Ships | Published | Verdict |
|---|---|---|---|
| BPC-157 | **4 h**, "Research-community consensus" | t½ **<30 min**; 15.2 min IV in rats, 5.27 min IV in beagles. **No human PK published.** ([Frontiers Pharmacol 2022](https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2022.1026182/full)) | Invented. ~8× the animal figure. |
| TB-500 | **48 h**, "Thymosin Beta-4 research" | Animal plasma t½ of minutes to ~3 h. The TB-500 fragment has never been in a registered human trial. | Invented. ~16–96×. |

Both are shown in onboarding, and both drive `pk.ts`. The curve for them is decoration.

Sourced values that a rebuilt catalog can use with a citation: liraglutide ~13 h (FDA label),
dulaglutide ~4.5–5 days (FDA label), cagrilintide **159–195 h**, Tmax 24–72 h
([Lancet phase 1b, PMID 33894838](https://pubmed.ncbi.nlm.nih.gov/33894838/)), bremelanotide
2.7 h (Vyleesi label), thymosin alpha-1 ~2 h (Zadaxin), tesamorelin ~26–38 min (Egrifta
label), sermorelin ~11–12 min, ipamorelin ~2 h (human PK, Pharm Res 1999 — the one existing
Poke row that checks out).

Contested, and therefore not curve-safe: melanotan II (sources give ~1 h and ~33 h), NAD+,
epitalon, GHK-Cu.

---

## What was built, 7 August 2026

The three doubts were confirmed, and all three were fixed. Decisions 16 to 19 in
`../DECISIONS.md` hold the reasoning. This section records only the outcome.

### Doubt 1 — the dose question covered one peptide

Fixed. `app/onboarding/schedule.tsx` is gone. `app/onboarding/schedule/[index].tsx` gives
one screen to each selected medication, with its own dose, unit, route, frequency and shot
day. The step counter grows with the selection, so a user on one peptide sees 8 steps and a
user on two sees 9. `medicationSeeds()` no longer has a primary medication.

### Doubt 2 — the catalog was short, and two entries were wrong

The catalog went from 10 presets to 19, and every one of them now states where its
half-life comes from. The picker is a search field over the whole list, so the length of
the list no longer decides what a user can find, and brand names and trial codes are
searchable: "Wegovy" finds Semaglutide, "Zepbound" finds Tirzepatide.

Added with a citation: liraglutide, dulaglutide, survodutide, cagrilintide, tesamorelin,
sermorelin, GHRP-6, thymosin alpha-1, bremelanotide.

**The two invented half-lives are gone.** BPC-157 and TB-500 now carry no half-life, no
Tmax and no curve. The schedule screen says "No human half-life is published" and names
what the animal data shows. This is the choice the brief asked for, stated plainly: they
are supported without a curve, not removed.

Researched and deliberately left out, because no citation survived the check:

| Candidate | Why it is not in the catalog |
|---|---|
| Hexarelin | The 75.9 min figure is a rat study. The human paper measures GH kinetics, not hexarelin. |
| GHRP-2 | No human elimination half-life found. GHRP-6 has one, and is in. |
| SS-31 / elamipretide | Vendor sources disagree: ~1–2 h against ~4 h. |
| MOTS-c, IGF-1 LR3, AOD-9604, kisspeptin, glutathione, 5-Amino-1MQ | No human PK that gives an elimination half-life. |
| Melanotan II | Sources give ~1 h and ~33 h. Already flagged as contested above. |
| Semax, Selank | Intranasal. The route model is sc and im only. |

No new unsourced rows were added. The five that already existed (BPC-157, TB-500, GHK-Cu,
NAD+, epitalon) were corrected in place, because removing a peptide people actually use is
worse than supporting it without a curve.

The custom-medication path already existed and was kept. It is now reachable from the
search empty state as well: a query with no match says so and offers to add it.

### Doubt 3 — `ready.tsx` was a summary table

Rebuilt. A build beat of four real work lines runs for about 1.4 seconds, then the plan
card shows the next shot with a countdown, a level curve per medication with the settled
week named, the routine, and the first four rotation sites. `src/services/onboardingPlan.ts`
holds the math. There is no goal date, no pace and no outcome claim.

Two corrections were made after the first walk-through of the built screen:

- **Aliasing.** At 112 samples over 28 days, a 2 h half-life was sampled once every 6 h, so
  the drawn peak heights came from the sample grid and not from the drug. Sampling now
  scales to the half-life, at four samples per half-life.
- **"Steady" was wrong for short half-lives.** Ipamorelin returns to zero between daily
  doses, so a week-on-week peak comparison called it steady from week 1. It now reads
  "Each dose clears before the next one."

### Not built, and why

**The reconstitution row is not on the plan card.** It is in the list of things Poke can
compute honestly above, and it is the market wedge, so leaving it out is a real loss. The
blocker is the schema: `MedicationRow` has no vial-strength or diluent column, and nothing
in `src/db` or `src/repositories` stores one. Putting it on the card would mean asking for
a vial size in onboarding, a v6 migration, the matching Medications UI, and wiring to the
calculator. That is a feature, not a card row. It is the obvious next piece of work.

**MeAgain's claim interstitials and its in-onboarding rating ask were not copied.**
`market.md` records that its growth playbook includes misleading ad creative and paid PR.
The pattern worth taking is the shape of the payoff, not the claims inside it.
