# Poke — App Store listing copy

Version 1.2.2. The subscription shipped in 1.1.0, so the description still
carries the full guideline 3.1.2 disclosure and the review notes still answer the
two questions Apple always asks a paid health app: how do we get in, and is this
a medical device. 1.2.2 adds the guided setup, a searchable medication list,
a source line on every half-life and the rebuilt Today screen.

Field limits, so nothing is written that cannot be pasted:
name 30, subtitle 30, promotional text 170, keywords 100, description 4000.

## Product page

App name (25 chars):
Poke: Peptide & GLP-1 Log

> `Poke` on its own is almost certainly taken. If App Store Connect rejects the
> name above as well, try in this order: `Poke — Peptide & Shot Log`,
> `Poke Peptide Tracker`, `Poke: Injection Tracker`.

Subtitle (27 chars):
Shot log, levels and trends

Promotional text (167 chars):
Log a shot in seconds. Watch your estimated level fall day by day. Watch your weight and your side effects move together. Take a clean record to your next appointment.

Description:
Poke is a private notebook for a routine that runs on injections.

Log a shot in a few taps: medication, amount, site, date and time. Poke then
tells you the one thing you actually want to know: when the next shot is due.
Everything stays on your phone. There is no account and no sign-in.

FREE, FOR AS LONG AS YOU USE IT
- Log a shot in seconds
- Your next shot day, on the first screen
- The full history of what you logged
- One medication, picked from a searchable list of 19 or added by you
- One reminder

POKE PRO
- Your level, day by day. Poke draws the estimated curve between your shots.
  Poke uses the half-life you set and the shots you logged.
- Trends that add up. Poke puts your weight, your doses and the side effects you
  record on one timeline. You see what moved with what.
- Every medication. Run more than one at a time. Each medication keeps its own
  schedule.
- Take it to your doctor. Export everything you logged as a CSV file.

WHAT POKE IS NOT
Poke is a record of what you enter and nothing more. Poke gives no medical
advice, no diagnosis, no treatment guidance and no dose recommendations. The
level curve is an estimate that Poke calculates from the values you type in. The
level curve is not a measurement. The level curve is not a basis for changing a
dose. The reconstitution screen is a unit conversion for laboratory and
educational use. The reconstitution screen turns a mass and a volume into a
concentration. Speak to a licensed clinician about your treatment. Call your
local emergency number if you have an emergency.

PRIVACY
Your log lives on your device. Poke has no user accounts, so there is nothing to
sign in to and nothing to leak.

SUBSCRIPTION
Poke Pro is an auto-renewable subscription.
- Poke Pro Yearly: 39.99 USD per year, after a 1-month free trial for new
  subscribers.
- Poke Pro Monthly: 9.99 USD per month, no trial.
Prices are in US dollars and may differ in your region. The app always shows the
price you will pay before you buy. Payment is charged to your Apple
Account at confirmation of purchase. The subscription renews on its own unless
you turn off auto-renew at least 24 hours before the period ends. Your Apple
Account is charged for renewal within 24 hours before the current period ends.
Manage or cancel a subscription in your Apple Account settings after purchase.
Any unused part of a free trial is forfeited when you buy a subscription.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://peptide.industries/privacy

Keywords (90 chars):
glp1,semaglutide,tirzepatide,injection,peptide,shot,reminder,dose,weight,tracker,log,level

Support URL:
https://peptide.industries/support/

Marketing URL:
https://peptide.industries/peptide-tracker/

Privacy Policy URL:
https://peptide.industries/privacy

> Must match `PRIVACY_URL` in `src/config/legal.ts` exactly, because the paywall
> links it. The old listing carried a trailing slash and the app does not.

Copyright URL:
https://peptide.industries/copyright/

Primary category:
Health & Fitness

Secondary category:
Medical

> Keep Health & Fitness primary. Medical as the secondary category is honest
> about the audience without asking to be read as a clinical tool.

Content rights:
Uses original app UI, generated decorative backgrounds, and project-owned assets.

Encryption export:
Standard/exempt encryption only. `ITSAppUsesNonExemptEncryption` is false.

## Screenshot captions

The captions live in `scripts/render-store-assets.mjs` and are burned into the
slides. iPhone carries all six; iPad drops the last one, because two medication
cards on a 13 inch screen leave the slide nearly empty.

| # | Screen | Kicker | Caption |
|---|--------|--------|---------|
| 1 | Today | TODAY | Know what is due today. |
| 2 | Log shot | LOG A SHOT | Log a shot in seconds. |
| 3 | Medication level | LEVEL | Watch the level fall between shots. |
| 4 | Progress | PROGRESS | See what moved, and when. |
| 5 | History | HISTORY | Every shot, every site, on record. |
| 6 | Medications | YOUR STACK | Keep the whole stack, not one item. |

## What is new in this version

TODAY, REBUILT
Switch between medications from a compact row. The selected medication shows the next shot, dose, schedule and last shot without a large image. When a shot is due, Log shot fills the bottom edge of the card so the action is easy to find.

ESTIMATED LEVELS, CLEARER
The level card uses the shots you logged. Free shows a blurred preview of the seven-day estimate. Poke Pro shows the exact estimate and opens the full details. An estimate is not a measurement and is not a basis for changing a dose.

TRACK TODAY
Weight and side effects now sit in one clean list.

SETUP NOW BUILDS A PLAN
Poke asks about every medication you take, then shows the next shot day, estimated level plan and first sites in the injection rotation. Optional height, weight, goal weight and reminder questions each have a skip.

A LONGER LIST, AND A SEARCH
The medication list now holds 19 entries and supports generic-name and brand-name searches.

HALF-LIVES THAT NAME THEIR SOURCE
Every half-life names its source. Where no human study exists, Poke draws no curve.

Poke gives no medical advice, diagnosis, treatment guidance or dose recommendation.

## App Review notes

Paste this into App Store Connect > Version > App Review Information > Notes.

NO ACCOUNT IS NEEDED
Poke has no accounts, sign-in or server. All data stays in a local database on the device. There is no demo account. Open the app and finish setup.

HOW TO REVIEW POKE PRO
Poke Pro is an auto-renewable subscription in the Poke Pro group, sold through RevenueCat and StoreKit 2.

1. Finish setup. The paywall opens at the end and can be closed.
2. To open it later: Profile > Subscription > Get Poke Pro. The Progress tab, the blurred level preview on Today, Export history and adding a second medication also open it.
3. Buy either plan with a sandbox Apple Account. The yearly plan has a one-month free trial for new subscribers.
4. The paywall closes and Pro unlocks at once. Restore purchases is on the paywall and in Profile.

If the sandbox store cannot be reached, the app unlocks all features so review is not blocked.

FREE AND PRO
Free: shot logging, next shot, full history, one medication and one reminder.
Pro: exact estimated level charts, progress charts, more than one medication and CSV export.

MEDICAL POSITIONING
Poke is a personal record. It is not a medical device and makes no clinical claim.

- Poke records the dose the user enters. It never recommends, calculates or suggests a dose.
- Poke gives no diagnosis, treatment guidance or administration instructions.
- A level chart is an estimate from the shots the user logged and the published half-life on file. Poke shows the half-life source. The estimate is not a measurement and is not a basis for changing a dose.
- Where no human half-life study exists, Poke says so and draws no curve.
- The reconstitution screen is a unit conversion for laboratory research and educational calculations only. It gives no dose instruction.
- Setup and Profile show the full disclaimer and tell the user to speak to a clinician.
- Medications are stored and shown by generic name. Brand names work only as search terms and in a half-life source title.

WHAT CHANGED IN 1.2.2
Today now uses a compact medication rail and one selected-medication card. The next shot is the primary block. A due shot has a full-width Log shot action. Free shows the real seven-day estimate shape behind a blur, with no exact values exposed. Pro removes the blur. A medication without a cited half-life gets no chart or level offer.

Setup is now a 23-step guided flow. It asks about each medication, then optional profile and tracking questions. Before the summary it shows a progress screen for about 14 seconds. The summary uses only the answers entered and published half-lives.

If the user enters a current weight, goal weight and weekly rate, Poke divides the distance by that rate and prints a date. The screen says: "That date is your distance divided by the pace you set. It is arithmetic on two numbers you typed. It is not a forecast, and no model of your body stands behind it. Move the pace above and watch the date move with it. Speak to your clinician about the pace that suits you." If weight data is skipped, no date appears.

The medication list has 19 generic entries and search. Every half-life names its published source. Nothing in 1.2.2 changes what Poke claims to do.

CONTACT
support@peptide.industries

## Asset locations

Finished slides, ready to upload:
- iPhone 6.9 inch (1320 x 2868): `store-assets/app-store/screenshots/iphone-6.9/`
- iPad 13 inch (2064 x 2752): `store-assets/app-store/screenshots/ipad-13/`

Raw simulator captures the slides are built from:
`store-assets/app-store/captures/<device>/`

`07-paywall.png` in the iPhone captures is not a slide. It is the review
screenshot attached to both subscription products in App Store Connect.

Regenerate the slides:
`node scripts/render-store-assets.mjs`

The captures themselves are taken on iPhone 17 Pro Max and iPad Pro 13 inch
(M4) simulators. See `docs/store-setup.md` for how the demo data is seeded and
how Pro is unlocked in a Release build.
