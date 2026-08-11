# Poke — App Store listing copy

Version 1.3.0. The subscription shipped in 1.1.0, so the description still
carries the full guideline 3.1.2 disclosure and the review notes still answer the
two questions Apple always asks a paid health app: how do we get in, and is this
a medical device. 1.3.0 rebuilds the four tabs, grows the medication list to 33
sourced presets and adds brand-name search.

> `store.config.json` is the source of truth. Every block below is the text in
> that file, wrapped for reading. Change the JSON first, then this file.

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
- Two medications, picked from a searchable list of 33 or added by you
- One reminder time, for every medication you take

POKE PRO
- Your level, day by day. Poke draws the estimated curve between your shots.
  Poke uses the shots you logged and the half-life on file for the medication.
  Poke shows the source of every half-life.
- Trends that add up. Poke puts your weight, your doses and the side effects you
  record on one timeline. You see what moved with what.
- Unlimited medications. Free keeps two. Pro runs as many as you take, and each
  medication keeps its own schedule.
- Take it to your doctor. Export everything you logged as a CSV file.

WHAT POKE IS NOT
Poke is a record of what you enter and nothing more. Poke gives no medical
advice, no diagnosis, no treatment guidance and no dose recommendations. The
level curve is an estimate that Poke calculates from the shots you log and the
half-life on file. Poke shows the source of every half-life. The level curve is
not a measurement. The level curve is not a basis for changing a
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

TODAY, CALM
One card for the medication you focus on: the level curve, your week under it, and Log shot in a fixed slot. Hold a row to reorder. The order you set is the order Poke opens with.

A NEW HISTORY
Months stack in one scroll. Each day carries one lane per medication, so a kept dose, a missed dose and a planned dose read at a glance. Tap a day to open it and log a shot for that day.

PROGRESS, ON ONE CHART
Weight, shots and side effects share one timeline. Free shows the shape of your line. Poke Pro shows the numbers.

MORE MEDICATIONS, SOURCED
33 presets, searchable by brand name such as Ozempic, Wegovy and Zepbound. Every half-life names its source, and an estimate says it is an estimate.

Plus a new first screen and many small fixes.

## App Review notes

Paste this into App Store Connect > Version > App Review Information > Notes.

NO ACCOUNT IS NEEDED
Poke has no accounts, sign-in or server. All data stays in a local database on the device. There is no demo account. Open the app and finish setup.

HOW TO REVIEW POKE PRO
Poke Pro is an auto-renewable subscription in the Poke Pro group, sold through RevenueCat and StoreKit 2.

1. Finish setup. The paywall opens at the end and can be closed.
2. To open it later: Profile > See Poke Pro. The "Unlock exact levels" chip on the Today level chart, the "Unlock your numbers" pill on the Progress chart, Export history in Profile and adding a third medication also open it.
3. Buy either plan with a sandbox Apple Account. The yearly plan has a one-month free trial for new subscribers.
4. The paywall closes and Pro unlocks at once. Restore purchases is on the paywall and in Profile.

If the store cannot be set up on the device at all, the app unlocks all features so review is not blocked. A slow network is not that case: Poke keeps the free view, keeps the paywall in reach, and asks the store again.

FREE AND PRO
Free: shot logging, next shot, full history and two medications.
Pro: exact estimated level charts, progress charts, unlimited medications and CSV export.
Reminders are the same on both sides. The user sets one reminder time, and that one time covers every medication. Free and Pro get the same reminders.

MEDICAL POSITIONING
Poke is a personal record. It is not a medical device and makes no clinical claim.

- Poke records the dose the user enters. It never recommends, calculates or suggests a dose.
- Poke gives no diagnosis, treatment guidance or administration instructions.
- A level chart is an estimate from the shots the user logged and the published half-life on file. Poke shows the half-life source. The estimate is not a measurement and is not a basis for changing a dose.
- Every half-life on file names its source: a drug label, a human study, or a stated estimate. The app labels an estimate as an estimate. Where Poke has no sourced half-life, it draws no curve.
- The reconstitution screen is a unit conversion for laboratory research and educational calculations only. It gives no dose instruction.
- Setup and Profile show the full disclaimer and tell the user to speak to a clinician.
- Brand names are their own rows in the medication picker. A picked brand is stored and shown under the name the user picked, so Wegovy stays Wegovy. Every brand row maps to one molecule, and the molecule carries the half-life and its source, so one medication is never counted twice.
- Setup can print a target date, and only when the user enters a current weight, a goal weight and a weekly rate. The screen says the date is the distance divided by the pace the user typed, that it is arithmetic on two numbers, that it is not a forecast, and that no model of the body stands behind it. Without weight data, no date appears.

WHAT CHANGED IN 1.3.0
This release rebuilds the four tabs. It adds no new medical claim.

Today is one card. The card holds the medication in focus: the estimated level curve, the week under the curve, and a Log shot band that stays in the same place. Free shows the shape of the curve with no exact values. Pro shows the values. Hold a medication row to reorder the list. The order the user sets is the order Poke opens with.

History is a month board. Months stack in one scroll. Each day carries one lane for each medication, so a kept dose, a missed dose and a planned dose read at a glance. Tap a day to open a half-sheet for that day and log a shot there.

Progress is one chart. Weight, shots and side effects share one timeline. Free shows the shape of the line. Pro shows the numbers.

Profile is minimal. It holds the record strip, reminders, units, goal weight, export and the account state. The old section headers are gone.

The medication list has 33 presets and search. Every half-life names its source: a drug label, a human study, or a stated estimate. The app labels an estimate as an estimate. Brand names such as Ozempic, Wegovy and Zepbound are rows in the picker, and a picked brand keeps its own name.

Setup opens with a new welcome screen.

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
