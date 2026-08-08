# Poke — App Store listing copy

Version 1.2.0. The subscription shipped in 1.1.0, so the description still
carries the full guideline 3.1.2 disclosure and the review notes still answer the
two questions Apple always asks a paid health app: how do we get in, and is this
a medical device. 1.2.0 adds a longer setup flow, a searchable medication list
and a source line on every half-life.

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

SETUP NOW BUILDS A PLAN
Poke asks about every medication you take, not only the first one. Each medication gets its own dose, its own schedule and its own shot day.

At the end of setup Poke shows what it worked out. You see your next shot day. You see your estimated level over the next four weeks. You see the first injection sites the rotation will offer. Every number comes from what you typed and from a published half-life. Poke predicts nothing about your body and gives no goal date.

A LONGER LIST, AND A SEARCH
The medication list holds 19 entries now, up from 10. You can search it by generic name or by brand name. Anything the list does not hold still goes in as a custom medication.

HALF-LIVES THAT NAME THEIR SOURCE
Every half-life in Poke now names where it comes from, and you can read that source on screen. Where no human study exists Poke says so and draws no curve. Two entries lost their curve for this reason. A missing curve is better than a wrong one.

SMALLER THINGS
Poke uses plainer words on every screen. Poke asks for a rating at most three times a year, and never during setup.

## App Review notes

Paste this into App Store Connect → Version → App Review Information → Notes.

NO ACCOUNT IS NEEDED
Poke has no user accounts, no sign-in and no server. Poke sends nothing anywhere. All data lives in a local database on the device. There is no demo account to supply because there is nothing to sign in to. Open the app and the setup flow starts.

HOW TO SEE THE PAID FEATURES
Poke Pro is an auto-renewable subscription in the group "Poke Pro", sold through RevenueCat over StoreKit 2.

1. Finish the setup flow. The paywall opens on its own at the end of it. The paywall can be dismissed, and the free features work without buying anything.
2. To reach the paywall again later: Profile tab → Subscription → "Get Poke Pro". Any locked feature opens it too: the Progress tab, the level chart on a medication card in the Today tab, "Export history" in the Profile tab, or adding a second medication in Profile → Medications.
3. Buy either plan with the sandbox Apple Account. Sandbox purchases are free. The yearly plan carries a 1-month free trial for new subscribers.
4. The paywall closes and every Pro screen unlocks at once. "Restore purchases" sits in the top bar of the paywall and in Profile → Subscription.

If the sandbox store is unreachable for any reason, the app unlocks every feature rather than showing a locked screen you cannot buy your way out of. So a failed store connection will not block the review.

FREE VERSUS PAID
Free, permanently: log a shot, next shot day, full history, one medication, one reminder.
Pro: estimated level curve, progress and trend charts, more than one medication, CSV export.

PLEASE READ: MEDICAL POSITIONING
Poke is a personal record-keeping app. It is not a medical device and it makes no clinical claim.

- Poke does not recommend, calculate or suggest a dose. Poke records the dose the user says they took. Poke never proposes a number.
- Poke does not diagnose, treat or give treatment guidance, and Poke gives no administration instructions.
- The "level" chart is an estimate drawn from two things the user typed in: the shots they logged and a half-life value they set. The chart is labelled on screen as an estimate and marked "not for dosing". The chart is not a measurement of anything in the body.
- The reconstitution screen is a unit conversion. A mass and a volume go in, and a concentration comes out. It is labelled on screen "For laboratory research and educational calculations only. Not for clinical, patient, medical, injection, or dosing use." It suggests nothing and it fills nothing in for the user.
- The first-run setup states, above the button that finishes it, that Poke gives no medical advice, no diagnosis and no dose instructions, and that the user should speak to their clinician. A full disclaimer also sits in Profile.
- No drug brand names are used anywhere in the app or in this listing. Only generic medication names the user selects for their own log.

WHAT CHANGED IN 1.2.0
The setup flow now asks about each medication on its own screen, so it runs a few screens longer when the user picks more than one. The last setup screen shows a summary that Poke calculates from what the user typed: the next shot date, an estimated level curve over four weeks, and the first sites in the injection rotation. It holds no prediction, no goal date and no outcome claim.

Every half-life in the app now names a published source, and the app prints that source on screen next to the medication. Where no human pharmacokinetic study exists, the app says so and draws no curve at all. Two entries lost their curve in this version for that reason. This tightens the medical framing rather than loosening it.

The medication list grew from 10 generic names to 19, and it is searchable. No drug brand name appears in the app. Brand names are accepted as search terms only, so a user who knows one can find the generic name, and the app then stores and shows the generic name.

Version 1.0 of this app was approved with this framing, and version 1.1.0 was submitted with it. Version 1.2.0 does not change what the app claims to do.

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
