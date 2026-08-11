# MeAgain onboarding — 1:1 map of the recording

Source: `docs/onboarding-flow.mp4` (gitignored; third-party copyright, internal teardown
only). 218.6 s, 384×848, **59.94 fps**, audio track present but **digitally silent**
(−91.0 dB flat) — no narration, so no spoken intent to transcribe.

Onboarding occupies **0.0 s – 161.5 s**. Everything after 161.5 s is a tour of the main
app and is out of scope for this map.

Status: **awaiting human confirmation.** Nothing is built from this yet.

---

## How this was parsed

Not by eye and not with ffmpeg's scene detector. Consecutive screens share chrome, so
inter-frame delta between two different questions is small while one scroll is large;
scene detection would both miss screens and invent them.

1. Inter-frame delta computed at **native 59.94 fps** (`tblend=difference` → `signalstats`
   YAVG), 13 105 samples. Not fps=6 — 167 ms per sample is too coarse to time a 330 ms
   animation.
2. **Settled screen** = run of frames with delta < 0.5 lasting ≥ 0.30 s. 121 such runs.
   Middle frame of each run taken as its representative, which drops every motion-blur
   and transition frame automatically.
3. **Transition** = the spike between runs; its frame count gives duration as
   `frames / 59.94 × 1000` ms. (The brief assumed 24 fps. The recording is 60 — using 24
   would have overstated every duration by 2.5×.)
4. Easing read from the **alpha-linear** curve (mean band darkness relative to page
   white), not from a dark-pixel-count threshold. The threshold metric collapses while
   text is still visible and falsely reports a ~215 ms blank gap; the true gap is ~65 ms.
5. Representative frames read individually at native resolution; contact sheets used only
   for indexing.

### Independent cross-check on ordering

The progress bar's fill was measured programmatically per frame (dark fill vs light
track, x = 50…355 of 384). Fill advances in **23 equal steps of ~4.35 %**. Every distinct
value maps to exactly one screen, and the sequence of values confirms the forward order
derived from the frames — including the one place the recording is misleading (below).

---

## The shape

| | |
|---|---|
| Total onboarding screens | **30** (4 carousel + 23 progress-bar steps + compute + reveal + paywall) |
| Screens counted by the progress bar | **23**, from Privacy (step 1) to Thank-you (step 23) |
| Questions that collect an answer | **14** |
| Questions **before** the paywall | **all 14** — the paywall is last |
| Claim interstitials between questions | **4** (steps 6, 13, 15, 17) |
| Fake compute | after all questions, **13.8 s** |
| Paywall position | **after** the plan reveal, opened by the reveal's primary button |
| Paywall gate | **none** — X dismisses it straight into the app |

**Asked before any value is given:** everything. All 14 questions, the Apple Health
permission, the rating ask and the notification permission all precede the plan. The user
gives 23 screens of input before seeing a single output.

**What the reveal claims, verbatim:** a card titled `Timeline - Dream Goal` reading
`128lbs` → `128lbs` → **`118.3lbs`**, with the axis `Today, 12:48 PM` · `Today, 12:49 PM`
· **`Oct 4, 2026`**. It is a **goal-weight-by-date projection**.

**Questions that feed the plan vs. questions that build commitment.** Being honest about
which is which, as asked:

| Question | Feeds the plan? |
|---|---|
| Journey stage, medication, dose, frequency, last shot | Yes — drives shot schedule and the dose model |
| Sex, birthday, height, weight | Yes — drives the nutrition/activity targets |
| Start weight + start date | Yes — the reveal's left anchor |
| Goal weight | Yes — the reveal's right anchor |
| Pace | Yes — but only to compute the projected date, which is the part Poke cannot ship |
| Activity level | Yes — step goal |
| Side effects | Weak. Selects which pre-written compute lines appear. Does not change a number. |
| Toughest cravings day | Weak. Sets one label ("Perfect Shot day"). |
| **Motivation ("What's driving you…")** | **No. Pure commitment.** Never referenced again. |
| **Rating ask** | **No. Pure extraction.** |

---

## Motion spec — measured, not guessed

One transition style covers every step change in the 23-step section. Measured on two
independent transitions (Q1→Q2 at 18.2 s, Q3→Q4 at 25.8 s); both agree, and both agree
with the whole-frame delta segmentation (667 / 701 / 734 / 751 ms gaps).

```
body fade-out   330 ms  ease-in-out
blank hold       65 ms  (both bodies at zero opacity)
body fade-in    330 ms  ease-in-out
                -----
total           725 ms
```

- **No translation.** Content does not slide horizontally or vertically. Pure opacity,
  in place.
- **The chrome does not participate.** Back chevron, progress bar and the primary button
  stay at full opacity for the whole 725 ms. Only title + subtitle + options fade.
- **Fade-out fully completes before fade-in starts.** This is a sequenced fade with a
  deliberate dead beat, not an overlapping cross-fade. The blank hold is short (~65 ms)
  but real and visible.
- Half-value occurs at 153 / 334 ms on the way out and 134 / 334 ms on the way in — very
  near symmetric, hence ease-in-out rather than ease-out.

This is the single most copyable thing in the recording and the thing a default
`Animated.timing(250)` slide gets wrong. 725 ms is slow and deliberate; the dead beat
makes each question land as a separate event rather than a carousel.

Other measured motion:

| Element | Measured |
|---|---|
| Progress bar fill | Advances during the blank hold; never animates backwards |
| Compute ring | 0 → 100 % over **13.8 s**, decelerating: 50 % @ 3.5 s, 79 % @ 7.0 s, 95 % @ 10.4 s, then the last 5 % crawls for 3.4 s |
| Compute ring colour | Blue at low fill, blue→pink gradient past ~85 % |
| Paywall present | Slides up from the bottom (modal), dismisses downward |
| Button press | Single-frame darkening at tap, no ripple |

---

## Screen-by-screen

Timestamps are the representative frame. `step` is the progress-bar reading.
Frames are in `mobile/docs/meagain-frames/` as `NNN_<t>.png` (gitignored).

### Pre-progress-bar: welcome carousel

| # | t | frame | Screen |
|---|---|---|---|
| 1 | 0.57 | `000` | **Carousel 1.** Title `Your Trusted GLP-1 Partner`, sub `One app for your full GLP-1 journey`. Device mockup. Page dots (**4**). Button `Get Started With the App`. Below: `Already got an account? Sign in.` No progress bar, no back. |
| 2 | 4.07 | `slide2` | **Carousel 2.** `Log food in seconds` / `Snap meals, track nutrition without adding more work to your day.` |
| 3 | 10.94 | `005` | **Carousel 3.** `See How Far You've Come` / `Track your dose, trends, and day-to-day progress with more confidence and control.` |
| 4 | 6.58 | `003` | **Carousel 4.** `Virtual Capybara, Real Motivation` / `A little extra accountability to help you stay consistent through the ups and downs.` |

Four slides, swipeable, and the button is identical on all four. Slide order is fixed by
the page-dot index, measured per frame: slide 1 = dot 0, slide 3 = dot 2, slide 4 = dot 3.

Recording shows the user tapping `Get Started With the App` from slide 1 at ~1.9 s, landing
on Privacy, going **back**, then swiping 1→2→3→4 in three bursts inside 2.2 s, then swiping
back once to slide 3 and continuing from there. The back path out of Privacy returns to the
carousel slide you left from.

**Why slide 2 needed a second pass.** The page-dot indicator updates only when the scroll
view settles. Three swipes landed back-to-back with ~50 ms between them, so the dots read
`dot 0` for the whole run and the stability-window pass produced no settled window for
slides 2 and 3. Slide 2 was recovered from the two frames between swipe 1 and swipe 2
(`t=4.07`, `t=4.08`), where the content has arrived but the dot has not caught up. This is
the one place in this document where a screen is read from a sub-100 ms window rather than
a settled one. The text is sharp and unambiguous in both frames.

### The 23 counted steps

| step | t | frame | Screen | Control | Skip? |
|---|---|---|---|---|---|
| 1 | 2.29 | `001` | **Privacy.** `Your privacy comes first` / `Your health data stays private and under your control. We only use it to support your experience in the app.` Two rows: `Terms of Use`, `Privacy Policy`. Button `Accept and Continue`. Fine print: `By tapping "Accept and continue", you agree to our Terms of Service and Privacy Policy.` | Two link rows + button | No |
| 2 | 15.04 | `007` | **Journey.** `Where are you in your GLP-1 journey?` / `Choose the option that best describes you.` Options: `I'm already on a GLP-1`, `I'm about to start a GLP-1` | Single select | No |
| 3 | 19.73 | `011` | **Medication.** `Which GLP-1 medication are you taking?` / `If it's not listed, choose "Other".` Options: `Foundaya™`, `Zepbound®`, `Mounjaro®`, `Ozempic®`, `Wegovy®`, `Wegovy® Pill`, `Trulicity®`, `Compounded Semaglutide`, `Compounded Tirzepatide`, `Other` | Single select, scrolls | No |
| 4 | 24.73 | `014` | **Dose.** `What's your current dose?` Options: `2.5 mg`, `5.0 mg`, `7.5 mg`, `10.0 mg`, `12.5 mg`, `15.0 mg`, `Custom / Other` | Single select | No |
| 5 | 27.78 | `016` | **Frequency.** `How often do you take your shots?` Options: `Every day`, `Every 7 days (most common)`, `Every 14 days`, `Custom`. Below, a field row `Last shot taken` with placeholder `MM DD YY` and a pencil affordance → opens a **date wheel sheet** titled `Last Shot` with a `Save` button. | Single select + date sheet | Date is optional |
| 6 | 39.98 | `021` | **Interstitial — plateau.** `Break through your plateau and manage side effects` / `Struggling with slow progress or side effects? MeAgain helps by optimizing habits, dosing schedules, and managing common side effects.` Card `Your Weight Over Time` with two curves (blue "MeAgain" descending, red "Restrictive Diets" rebounding), axis `Month 1`…`Month 6`. Caption: `MeAgain helps GLP-1 members achieve an average of 25% greater weight loss effectiveness.` Button `Continue`. | None | No |
| 7 | 36.10 | `020` | **Apple Health.** `Sync with Apple Health (Optional)` / `Easily pull in your height, weight, and activity to save time and get a more tailored plan — right from the start.` Device mockup. Button `Connect`. Tapping it raises the iOS **Health Access** sheet (`"MeAgain" would like to access and update your Health data.`, `Turn on all (4) categories`, Activity → `Active Energy`, `Steps`, buttons `Allow` / `Don't Allow`). Declining shows the system note `You can turn on health data categories later in the Health app.` → `OK`. | System permission | Labelled Optional; `Connect` is the only button — no visible textual skip |
| 8 | 46.63 | `025` | **Sex.** `Help us get the basics right.` / `We use a few simple details to better tailor your nutrition, activity, and wellness plan — all based on what works best for your body.` Options: `Female`, `Male`, `Other`, `Prefer not to say` | Single select | `Prefer not to say` is the in-list skip |
| 9 | 49.90 | `027` | **Birthday.** `When's your birthday?` / `Your age helps us fine-tune your nutrition goals to keep them accurate and realistic.` | Month/day/year wheel | No |
| 10 | 54.67 | `029` | **Height & weight.** `Your Height & Weight` / `Your current height and weight help us calculate your BMI and personalize your daily nutrition and activity goals.` Two wheels `Height` / `Weight`, plus an `imperial` ⇄ `metric` toggle. | Two wheels + unit toggle | No |
| 11 | 64.17 | `032` | **Start point.** `Tell us where you started.` / `Add the weight you were at when you began GLP-1, along with your start date.` Field rows `Start Weight` and `Start Date` → each opens a sheet. Weight sheet: title `Start Weight`, big value `128.0 lbs`, horizontal ruler, `Save`. Date sheet: title `Start Date`, wheel, `Save`. | Two sheets | No |
| 12 | 69.27 | `036` | **Goal weight.** `Set your goal weight.` / `We'll use this to guide your progress and keep your plan on track.` Label `Dream Weight`, big value e.g. `128.0 lbs` → `116.7 lbs`, horizontal ruler slider, `imperial`/`metric` toggle. | Ruler slider | No |
| 13 | 75.16 | `040` | **Interstitial — momentum.** Wordmark `⚡MeAgain`. `Still have 10 lbs to go? Let's keep the momentum going—together.` Caption: `8 in 10 MeAgain members who were already on GLP-1 broke past plateaus within a few weeks.` The `10 lbs` is computed from the previous two screens. | None | No |
| 14 | 79.39 | `044` | **Pace.** `How quickly do you want to reach your goal?` / `(Don't worry – we'll help you stay healthy whichever pace you choose.)` Pill: `🏁 Est. Goal Date **Nov 30, 2026**`. `Weekly Change:` + big value `0.6 lbs`. Slider with 🚶 / 🚗 / 🚀 icons at `0.2 lbs` · `1.5 lbs` · `3 lbs`. Helper text switches by zone: `This slower pace is gentle and sustainable for your journey.` / `This pace is ideal for long-term success.` / `This faster pace is within medical guidelines. We'll help you adjust if needed.` | Slider | No |
| 15 | 84.64 | `047` | **Interstitial — 3x.** `Make GLP-1 Work for You— 3x More Effectively` Bar chart `Without` (`18%`) vs `⚡MeAgain` (`3X`). Caption: `Enjoy a smoother experience, from managing side effects to hitting your weight-loss milestones with less stress.` | None | No |
| 16 | 96.42 | `054` | **Activity.** `Tell us a bit about your daily routine.` / `On most days you are…` Options with sub-labels: `Sedentary (mostly seated, little exercise)`, `Lightly Active (some walking or light movement)`, `Active (regular workouts or physical tasks)`, `Very Active (intense exercise or very physical job)` | Single select | No |
| 17 | 100.33 | `057` | **Interstitial — shot day.** `Conquer your toughest day.` / `MeAgain will time your Compounded Tirzepatide dose so it peaks when your cravings hit hardest – making it easier to stay on track and in control on those challenging days.` **The medication name is injected from step 3.** Card `Your Week` + `⚡MeAgain`, a PK-shaped curve Mon…Sun with a callout `Perfect Shot day` / `Tue 12:00 PM`. Caption: `By picking the perfect shot day, you can boost your long-term GLP-1 effectiveness by as much as 3x.` | None | No |
| 18 | 103.04 | `058` | **Cravings day.** `Which day does food noise and cravings hit hardest?` / `We'll time your GLP-1 dose so it works hardest when cravings—and food noise—are at their peak.` Options `Monday`…`Sunday` | Single select | No |
| 19 | 106.39 | `061` | **Side effects.** `What side effects are giving you the most trouble?` / `Let us know so we can help you manage them better.` Options: `Nausea`, `Fatigue`, `Hair Loss`, `Constipation`, `Bloating`, `Sulfur Burps`, `Heartburn`, `Mood Swings`, `Metallic Taste`, `Stomach Pain`, `Muscle Loss`, `Injection Anxiety`, `Loose Skin`, `Other`, `Not concerned` | **Multi select**, scrolls | `Not concerned` is the in-list skip |
| 20 | 115.16 | `067` | **Motivation.** `What's driving you to reach your goal?` / `I'm doing this because…` Options: `I want to feel more confident in my own skin.`, `I'm just ready for a fresh start.`, `I want to boost my energy and strength.`, `To improve my health and manage PCOS.`, `I want to show up for the people I love.`, `I have a special event or milestone coming up.`, `To feel good wearing the clothes I love again.`, `Other` | **Multi select** | No |
| 21 | 120.39 | `071` | **Rating ask.** *Dark screen — the only one in the flow.* `Give us a rating`, five purple stars, three testimonial cards (`Olivia, 34`, `Sophie, 25`, `Jordan, 31`, each ★★★★★ with a quote). Laurel wreath caption: `We are a small team trying to build the best GLP-1 app, so a rating goes a really long way!` Button `Continue`, disabled until the stars are touched. | Star rating | Continue is gated on interaction |
| 22 | 124.80 | `073` | **Notifications.** `Reach Your Dream Weight with Notifications` / `Turn on Push Notifications to unlock smart notifications. MeAgain reminds you to stay on track with your weight loss progress.` In-app pre-prompt with `Don't Allow` / `Allow`, then the real iOS sheet (`"MeAgain" Would Like to Send You Notifications`). | System permission | `Don't Allow` |
| 23 | 128.18 | `075` | **Thank you.** Purple gradient, decorative sparkles. `✓ All done!` / `Thank you for trusting us` / `Let's create the perfect Plan for you.` Button `Create Plan`. Progress bar reads 100 %. | None | No |

### After the progress bar

| # | t | frame | Screen |
|---|---|---|---|
| 27 | 129.4–142.8 | `077`–`087` | **Compute.** `Crafting your custom *MeAgain* Plan…` Circular ring with a large integer percent. Beneath it a stack of ~6 cards that tick off in sequence, each naming the user's own answers: `Tailoring your fiber intake to help relieve **constipation**…` · `Adjusting your hydration goals to help ease **nausea**…` · `Optimizing your protein goals to prevent **muscle loss**…` · `Setting your daily step goal to get **your energy back**…` · `Mapping timeline toward **your dream weight**…` · `Timing your shot day for when **cravings peak**…` Completed rows collapse upward and dim. 13.8 s total. No skip, no back. |
| 28 | 146.6 | `089` | **Plan reveal.** Header `✓ Congratulations your personal MeAgain plan is ready!` (scrolls away). Card `📅 Timeline - Dream Goal`: `128lbs` · `128lbs` · **`118.3lbs`** over a track, axis `Today, 12:48 PM` · `Today, 12:49 PM` · `Oct 4, 2026`. Then a 2-column card grid: `Shot Schedule / Friday / Every Friday`, `Water / 59oz` (glass illustration), `Protein / 81g` (ring), `Fiber / 30g` (bar), `Daily Activity / 5000 steps` (tomato icons). Button `Let's get started`. **No progress bar, no back.** |
| 29 | 152.2 | `091` | **Paywall.** Modal, slides up from the bottom, `✕` top-left. `Stay on Track with Every GLP-1 Dose`. Two laurel badges: `#1 GLP-1 Companion App`, `370K+ Users`. Review card: `The best GLP-1 tracking app` ★★★★★ `Apr 22` `Ali123412` — `I tried them all. MeAgain is the only app I kept and paid the subscription fee. Everything I need in one app: shot and dosage tracking, exercise, food, weight, and macros.` Banner `MOST POPULAR · 75% OFF`. `Yearly` / `Billed $59.99 / year` / ~~`$19.99`~~ `$4.99/month`. `Monthly` / `$19.99/month`. `✓ No commitment, cancel anytime`. Button `Continue`. Footer: `Terms` · `Restore Purchase` · `Privacy`. |

---

## Where the recording is misleading, and how I know

**The plateau interstitial comes BEFORE Apple Health, not after.** Read naively, the
frames show Apple Health (36.1 s) → plateau (40.0 s) → Apple Health (41.7 s). That is the
user tapping **back** at ~38.3 s and then forward again. The progress bar settles it
independently: plateau reads **25.8 % = step 6**, Apple Health reads **30.1 % = step 7**.
Forward order is plateau → Apple Health.

The recording contains two back-path demonstrations: this one, and the carousel →
Privacy → back → carousel at ~3 s.

---

## Interaction model

- **Selecting never auto-advances.** Every question requires an explicit `Continue`.
  Verified on the journey question: selecting one option enables `Continue`, selecting the
  other moves the highlight and leaves you on the screen.
- **`Continue` is disabled until the screen is answered** — rendered mid-grey, becoming
  solid black on a valid answer. Interstitials ship with `Continue` enabled immediately.
- **Selected state** = filled black pill with white text; unselected = white pill with a
  hairline border. On the dark rating screen the polarity inverts.
- **Multi-select** (side effects, motivation) keeps every tap; no cap observed.
- **Back** is a chevron at top-left on every one of the 23 counted steps. It is absent on
  the carousel, the compute screen and the plan reveal.
- The primary button is pinned to the bottom of the screen, full width, on every screen.

---

## Ambiguities — stated rather than guessed

A single frame cannot settle these, and the recording does not resolve them:

1. **Whether the paywall can be reached again.** The user dismisses it with `✕` at
   ~160.8 s and the main app appears ~0.7 s later. Whether dismissing completes onboarding
   directly, or whether they tapped `Let's get started` a second time in that gap, is not
   visible.
2. **Whether Apple Health can be skipped without granting.** The screen is labelled
   `(Optional)` but `Connect` is the only control shown. The user grants it, so the
   decline path past this screen is never exercised.
3. **The full side-effects list.** It scrolls; 15 options were observed across two scroll
   positions, but the list may continue past `Not concerned`.
4. **Whether the rating ask writes a real StoreKit review prompt** or is cosmetic. The
   user taps `Continue` without the system sheet appearing, which suggests cosmetic — but
   one run is not proof.
5. **Exact compute-curve function.** Measured points are given above; it is monotonic and
   decelerating, but the recording cannot distinguish a scripted keyframe list from an
   eased function.
6. **Custom dose / custom frequency branches** are never opened.
7. **Sign-in path** (`Already got an account? Sign in.`) is never opened.
8. **Whether this recording is a representative variant.** See the reconciliation section
   below. A second capture of the same app differs on question count, interstitial count
   and several option lists.

---

## Reconciliation against the 7 Aug teardown

`mobile/docs/onboarding-teardown-2026-08-07.md` describes a **different capture** of the
same app: 184 stills from screensdesign.com, 36 screens, 2:55. It is not a competing
reading of this recording — it is a second sample. Where the two disagree, both can be
right, because MeAgain almost certainly runs variants and at least one conditional branch.

Settled by re-measuring this recording:

| Point | Resolution |
|---|---|
| Carousel: 4 slides incl. `Log food in seconds`, vs. 3 in my first pass | **Teardown is right, my first pass was wrong.** 4 dots, 4 slides, `Log food in seconds` is slide 2. Corrected above. |

Still open, and deliberately not resolved by guessing:

| Difference | This recording | 7 Aug capture | Most likely cause |
|---|---|---|---|
| Cold-start chrome | Straight to carousel | Splash, ATT prompt, `Downloading update` | Capture method. screensdesign records a fresh install; this is a warm launch. |
| Claim interstitials | **4** (steps 6, 13, 15, 17) | **5**, different copy | A/B variant, or branch on the journey answer. |
| Plateau interstitial copy | `Still have 10 lbs to go?` | `Losing 7 kg…` | Unit locale (lbs vs kg) drives the sentence. |
| Journey question options | 2: `I'm already on a GLP-1`, `I'm about to start a GLP-1` | 3, incl. `I haven't decided yet` | A/B variant. |
| Medication question | `Which GLP-1 medication are you taking?` | `Which GLP-1 do you plan to use?` | **Branch**, not a variant — the wording follows the journey answer. This run answered "already on a GLP-1". |
| `Not sure` escape hatches | Absent | Present on several questions | A/B variant. |
| Counted questions | **14** | 18 | Sum of the branch and the variants above. |

**What this means for the build.** Where the two captures agree, treat it as the product.
Where they disagree, this recording is the primary source — it is a real device, real
timings, and I measured it — but do not treat any single number here as MeAgain's fixed
intent. In particular, **23 progress steps is one variant's length, not a target.** Poke's
step count is already variable by design (`onboardingTotalSteps`, DECISIONS row 17), and
matching 23 for its own sake would be copying a sample, not a decision.

---

## Frame index

`mobile/docs/meagain-frames/NNN_<seconds>.png`, 121 files, one per settled window,
native 384×848. Gitignored — regenerate with the method above from the source recording.
