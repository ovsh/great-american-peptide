# Poke — App Store listing copy

Version 1.1.0. This is the first version that sells a subscription, so the
description carries the full guideline 3.1.2 disclosure and the review notes
answer the two questions Apple always asks a paid health app: how do we get in,
and is this a medical device.

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

Promotional text (149 chars):
Log a shot in seconds. See your level fall day by day, watch weight and side effects move together, and take a clean record to your next appointment.

Description:
Poke is a private notebook for a routine that runs on injections.

Log a shot in a few taps: medication, amount, site, date and time. Poke then
tells you the one thing you actually want to know — when the next shot is due.
Everything stays on your phone. There is no account and no sign-in.

FREE, FOR AS LONG AS YOU USE IT
- Log a shot in seconds
- Your next shot day, on the first screen
- The full history of what you logged
- One medication
- One reminder

POKE PRO
- Your level, day by day. Poke draws the estimated curve between your shots from
  the half-life you set and the shots you logged.
- Trends that add up. Weight, doses and the side effects you record, on one
  timeline, so you can see what moved with what.
- Every medication. Run more than one at a time, each with its own schedule.
- Take it to your doctor. Export everything you logged as a CSV file.

WHAT POKE IS NOT
Poke is a record of what you enter, and nothing more. It gives no medical
advice, no diagnosis, no treatment guidance and no dose recommendations. The
level curve is an estimate calculated from the values you type in, not a
measurement, and it is not a basis for changing a dose. The reconstitution
screen is a unit conversion for laboratory and educational use: it turns a mass
and a volume into a concentration. Speak to a licensed clinician about your
treatment, and call your local emergency number in an emergency.

PRIVACY
Your log lives on your device. Poke has no user accounts, so there is nothing to
sign in to and nothing to leak.

SUBSCRIPTION
Poke Pro is an auto-renewable subscription.
- Poke Pro Yearly: 39.99 USD per year, after a 1-month free trial for new
  subscribers.
- Poke Pro Monthly: 9.99 USD per month, no trial.
Prices are in US dollars and may differ in your region; the price you will pay
is always shown in the app before you buy. Payment is charged to your Apple
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

Poke Pro arrives. Logging stays free for as long as you use it — the level
curve, the trend charts, more than one medication and CSV export are now part of
Pro. Also: the reminder is steadier, and the first-run setup states plainly what
Poke is and is not.

## App Review notes

Paste this into App Store Connect → Version → App Review Information → Notes.

---

NO ACCOUNT IS NEEDED
Poke has no user accounts, no sign-in and no server. Nothing is sent anywhere.
All data lives in a local database on the device. There is no demo account to
supply, because there is nothing to sign in to. Open the app and the setup flow
starts.

HOW TO SEE THE PAID FEATURES
Poke Pro is an auto-renewable subscription in the group "Poke Pro", sold through
RevenueCat over StoreKit 2.

1. Finish the short setup flow. The paywall opens on its own at the end of it,
   and it can be dismissed — the free features work without buying anything.
2. To reach the paywall again later: Profile tab → Subscription → "Get Poke
   Pro". Any locked feature opens it too: the Progress tab, the level chart on
   a medication card in the Today tab, "Export history" in the Profile tab, or
   adding a second medication in Profile → Medications.
3. Buy either plan with the sandbox Apple Account. Sandbox purchases are free.
   The yearly plan carries a 1-month free trial for new subscribers.
4. The paywall closes and every Pro screen unlocks at once. "Restore purchases"
   sits in the top bar of the paywall and in Profile → Subscription.

If the sandbox store is unreachable for any reason, the app unlocks every
feature rather than showing a locked screen you cannot buy your way out of. So
a failed store connection will not block the review.

FREE VERSUS PAID
Free, permanently: log a shot, next shot day, full history, one medication, one
reminder.
Pro: estimated level curve, progress and trend charts, more than one medication,
CSV export.

MEDICAL POSITIONING — PLEASE READ
Poke is a personal record-keeping app. It is not a medical device and it makes
no clinical claim.

- Poke does not recommend, calculate or suggest a dose. It records the dose the
  user tells it they took. It never proposes a number.
- Poke does not diagnose, treat or give treatment guidance, and it gives no
  administration instructions.
- The "level" chart is an estimate drawn from two things the user typed in: the
  shots they logged and a half-life value they set. It is labelled on screen as
  an estimate and marked "not for dosing". It is not a measurement of anything
  in the body.
- The reconstitution screen is a unit conversion — mass and volume in,
  concentration out. It is labelled on screen "For laboratory research and
  educational calculations only. Not for clinical, patient, medical, injection,
  or dosing use." It suggests nothing and it fills nothing in for the user.
- The first-run setup states, above the button that finishes it, that Poke gives
  no medical advice, no diagnosis and no dose instructions, and that the user
  should speak to their clinician. A full disclaimer also sits in Profile.
- No drug brand names are used anywhere in the app or in this listing. Only
  generic medication names the user selects for their own log.

Version 1.0 of this app was approved with the same framing. Version 1.1.0 adds
the subscription and does not change what the app claims to do.

CONTACT
support@peptide.industries

---

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
