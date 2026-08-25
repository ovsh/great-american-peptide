# Poke — App Store listing copy

Version 1.4.0. The subscription shipped in 1.1.0, so the description still
carries the full guideline 3.1.2 disclosure and the review notes still answer
the two questions Apple always asks a paid health app: how do we get in, and is
this a medical device. 1.4.0 shortens setup, adds a day-after check-in and a
missed-shot catch-up with per-loop switches, and redraws the plan screens.

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

Log a shot in a few taps: medication, amount, site, date and time. Poke then tells you the one thing you actually want to know: when the next shot is due. Everything stays on your phone. There is no account and no sign-in.

Poke includes a searchable list of 47 medications: semaglutide, tirzepatide, liraglutide, retatrutide, cagrilintide, ipamorelin, CJC-1295, tesamorelin, BPC-157, TB-500, GHK-Cu, NAD+, testosterone, estradiol, the popular blends and more. If your medication is not on the list, add your own.

YOUR NEXT SHOT, ON THE FIRST SCREEN
Open Poke and the next shot day is the first thing you see. Poke keeps the full history of every shot you logged.

REMINDERS THAT ASK
Ready for your shot? How do you feel today? Did you miss a day? Poke asks on shot day, checks in the day after, and catches a missed day the next morning. Each reminder has its own switch in Profile. Poke sends at most one a day for each medication, and nothing at night.

YOUR ESTIMATED LEVEL, DAY BY DAY (POKE PRO)
Poke draws the estimated curve between your shots. The curve uses the shots you logged and the half-life on file for the medication. Poke shows the source of every half-life.

TRENDS THAT ADD UP (POKE PRO)
Poke puts your weight, your doses and the side effects you record on one timeline. You see what moved with what.

UNLIMITED MEDICATIONS (POKE PRO)
The free app keeps two medications. Pro runs as many as you take, and each medication keeps its own schedule.

TAKE IT TO YOUR DOCTOR (POKE PRO)
Export everything you logged as one CSV file. A clean record for your next appointment.

FREE, FOR AS LONG AS YOU USE IT
Logging, the next shot day, the full history, all three reminders and two medications are free, with no time limit.

PRIVACY
Your log lives on your device. Poke has no user accounts, so there is nothing to sign in to and nothing to leak.

WHAT POKE IS NOT
Poke is a record of what you enter and nothing more. Poke gives no medical advice, no diagnosis, no treatment guidance and no dose recommendations. The level curve is an estimate that Poke calculates from the shots you log and the half-life on file. Poke shows the source of every half-life. The level curve is not a measurement. The level curve is not a basis for changing a dose. The reconstitution screen is a unit conversion for laboratory and educational use. The reconstitution screen turns a mass and a volume into a concentration. Speak to a licensed clinician about your treatment. Call your local emergency number if you have an emergency.

SUBSCRIPTION
Poke Pro is an auto-renewable subscription.
- Poke Pro Yearly: 39.99 USD per year, after a 3-day free trial for new subscribers.
- Poke Pro Monthly: 9.99 USD per month, no trial.
Prices are in US dollars and may differ in your region. The app always shows the price you will pay before you buy. Payment is charged to your Apple Account at confirmation of purchase. The subscription renews on its own unless you turn off auto-renew at least 24 hours before the period ends. Your Apple Account is charged for renewal within 24 hours before the current period ends. Manage or cancel a subscription in your Apple Account settings after purchase. Any unused part of a free trial is forfeited when you buy a subscription.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://peptide.industries/privacy

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

Poke 1.6.0 reworks your first minutes in the app.

- A new setup flow: the goal you pick shapes the words you read, from the first screens to your plan.
- A redesigned plan: the level curve leads the screen, and the page reads like a diary.
- A simpler mix step: enter the water, and Poke shows the units on your syringe.
- The welcome screens show the reminder banner as it appears on your lock screen.
- Reminder banners speak one clear voice, and a tap opens the right log screen.
- Pick the color each medication draws with.
- Touch and hold the Today chart to read your estimated level hour by hour.

## App Review notes

NO ACCOUNT IS NEEDED
Poke has no accounts, sign-in or server. All data stays in a local database on the device. There is no demo account. Open the app and finish setup.

HOW TO REVIEW POKE PRO
Poke Pro is an auto-renewable subscription in the Poke Pro group, sold through RevenueCat and StoreKit 2.

1. Finish setup. The paywall opens at the end and can be closed.
2. To open it later: Profile > See Poke Pro. The "Unlock exact levels" chip on the Today level chart, the "Unlock your numbers" pill on the Progress chart, Export history in Profile and adding a third medication also open it.
3. Buy either plan with a sandbox Apple Account. The yearly plan has a 3-day free trial for new subscribers.
4. The paywall closes and Pro unlocks at once. Restore purchases is on the paywall and in Profile.

If the store cannot be set up on the device at all, the app unlocks all features so review is not blocked. A slow network is not that case: Poke keeps the free view, keeps the paywall in reach, and asks the store again.

FREE AND PRO
Free: shot logging, next shot, full history and two medications.
Pro: exact estimated level charts, progress charts, unlimited medications and CSV export.
Notifications are local, free and identical on Free and Pro: a shot-day reminder at the chosen time, a check-in the day after a logged shot, and a catch-up after a missed scheduled day. Each has its own switch in Profile. The check-in only asks the user to record how they feel and gives no advice. At most one notification a day for each medication, nothing at night, and no push server.

MEDICAL POSITIONING
Poke is a personal record. It is not a medical device and makes no clinical claim.

- Poke records the dose the user enters. It never recommends, calculates or suggests a dose.
- Poke gives no diagnosis, treatment guidance or administration instructions.
- A level chart is an estimate from the shots the user logged and the published half-life on file. Poke shows the half-life source. The estimate is not a measurement and is not a basis for changing a dose.
- Every half-life on file names its source: a drug label, a human study, or a stated estimate. The app labels an estimate as an estimate. Where Poke has no sourced half-life, it draws no curve.
- The reconstitution screen is a unit conversion for laboratory research and educational calculations only. It gives no dose instruction.
- Setup and Profile show the full disclaimer and tell the user to speak to a clinician.
- The medication list includes hormones that are legally prescribed, such as testosterone esters and estradiol. Poke records a shot of a prescribed hormone the same way it records any other entry. Poke does not sell, source or recommend any substance, and Poke links to no seller.
- Brand names are their own rows in the medication picker. A picked brand is stored and shown under the name the user picked, so Wegovy stays Wegovy. Every brand row maps to one molecule, and the molecule carries the half-life and its source, so one medication is never counted twice.
- Setup can print a target date, and only when the user enters a current weight, a goal weight and a weekly rate. The screen says the date is the distance divided by the pace, and that it is not a forecast. Without weight data, no date appears.

WHAT CHANGED IN 1.6.0
This release reworks the setup flow: a new visual design, and the goal the user picks frames the wording. It adds no new feature, no new entitlement and no new medical claim. The paywall still opens at the end of setup and can be closed.

Apple Health (HealthKit entitlement, since 1.5.0): Poke asks to read body mass only, so the user does not type their weight by hand. The prompt appears only when the user turns the connection on. Poke writes nothing to Health, reads no other data type, and works fully without the connection.

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
