# Poke Pro — App Store Connect and RevenueCat setup

Status, 10 August 2026: **all of this is done.** Version 1.1.0 (build 9) went to
App Review at 4:15 AM with four items in one submission — the app version, both
subscriptions and the subscription group. Version 1.2.2 is prepared and waiting
on that queue; see §6. The sections below are kept as the record of what exists,
not as a to-do list. The one open item is the sandbox tester account in §1.6.

Scope: everything that must exist in the two consoles before the paywall can sell
anything. The app code is done and committed; nothing here needs a code change,
except the last step (the API key).

The names below are read directly from the source. If you change a name in a
console, change it in the source too, or the paywall will find nothing.

## Identifiers, as built

| Thing | Id |
| --- | --- |
| ASC app | `6764757185` |
| Subscription group `Poke Pro` | `22292953` |
| `poke_pro_annual` (Poke Pro Yearly) | `6798991220` |
| `poke_pro_monthly` (Poke Pro Monthly) | `6798994162` |
| RevenueCat project `Poke` | `52c999f8` |
| RevenueCat app | `app2f31765daa` |
| Entitlement `pro` | `entl4a7d85862d` |
| Offering `default` | `ofrng523430a17d` |
| EAS project | `3047092a-148d-4bd7-97bb-f6b8d9d619f2` |

| Thing | Value | Read by |
| --- | --- | --- |
| Bundle id | `industries.peptide.tracker` | `ios/Poke/Info.plist` |
| Entitlement id | `pro` | `src/services/purchases.ts` |
| Offering id | `default` | `src/services/purchases.ts` |
| Monthly product id | `poke_pro_monthly` | `src/services/purchases.ts` |
| Yearly product id | `poke_pro_annual` | `src/services/purchases.ts` |
| Monthly price | 9.99 USD | `src/domain/plans.ts` |
| Yearly price | 39.99 USD | `src/domain/plans.ts` |
| Free trial | 1 month, yearly only | `src/domain/plans.ts` |

Why these numbers, from the category as it stood in August 2026:

- Shotsy leads the category (4.8 stars, 29K ratings) and tests 39.99, 49.99 and
  59.99 a year, with a 9.99 month. Peps asks 9.99 and 44.99. PepTrac asks 7.99
  and 59.99. Several free apps (Glapp, GLP3 Planner, GLP-1 Plotter) give the
  level chart away, so a new app with no ratings should not lead on price.
- 39.99 puts the yearly saving at 67% against the monthly price, not 58%.
- The trial is a month because everything Pro sells is a trend across shots. A
  weekly injector logs one shot in seven days and four in a month. RevenueCat's
  2026 report also measures trials of 17 to 32 days converting at 42.5% against
  25.5% for four days or fewer.
- No discount ladder. About 90% of subscriptions in the category sell at full
  price; the yearly anchor is the discount.

The prices in `plans.ts` are only the placeholders shown when the store cannot be
reached. Real prices come from the store at run time. Keep the two in step, or
the paywall will show one number offline and a different one online.

---

## 1. App Store Connect

Done. Kept here because the order matters if any of it has to be rebuilt.

### 1.1 Paid Applications agreement — blocks everything else

Business → Agreements. The Paid Applications agreement must read **Active**.

It now reads **Active**, term 6 August 2026 to 22 July 2027. Before it was
signed it read Expired, and while it is expired App Store Connect **disables the
Create button** on the Subscriptions page, so no product can be made at all —
and RevenueCat returns an empty offering even if one exists. If subscriptions
ever go quiet, look here first.

### 1.2 Subscription group

My Apps → Poke → Subscriptions → create a group.

- Group reference name: `Poke Pro`
- Both products go in this one group, so a buyer can move between monthly and
  yearly without paying twice.

### 1.3 The two products

In the group, create two auto-renewable subscriptions.

**Monthly**
- Product ID: `poke_pro_monthly`
- Reference name: `Poke Pro Monthly`
- Duration: 1 month
- Price: 9.99 USD (Apple fills the other currencies)
- No introductory offer

**Yearly**
- Product ID: `poke_pro_annual`
- Reference name: `Poke Pro Yearly`
- Duration: 1 year
- Price: 39.99 USD
- Introductory offer: **Free trial, 1 month, new subscribers**

Set the yearly rank above the monthly one in the group, so an upgrade is an
upgrade.

### 1.4 Localisation and review data

Each product needs a display name, a description, and a review screenshot before
Apple will approve it. What is set:

- Yearly display name: `Poke Pro Yearly`
- Monthly display name: `Poke Pro Monthly`
- Description, both: `Your levels, trends and exports, all in one place.`
- Review screenshot, both: the paywall, 1320×2868
- Review notes, both: how to reach the paywall with no account, what free gets
  against what Pro gets, the terms shown before purchase, and the note that the
  app unlocks everything when the store cannot be reached

**Getting the review screenshot into ASC without a file picker.** The file input
on the subscription page cannot be driven from this toolchain. The way round it:
publish the image as a temporary extra app screenshot with `eas metadata:push`,
read its `is1-ssl.mzstatic.com` URL out of the Media Manager DOM, `fetch` it from
the ASC page itself (CORS allows it), wrap the blob in a `File` through
`DataTransfer`, assign it to the subscription's file input and dispatch `input`
and `change`. ASC uploads it at once, with no Save. Then remove the temporary
screenshot with a second push.

### 1.5 App privacy

The paywall links `https://peptide.industries/privacy`. Confirm that URL is the
one on the listing (App Information → Privacy Policy URL). If it is not, either
fix the listing or fix `src/config/legal.ts` — they must agree.

### 1.6 Sandbox tester — still open, yours to do

Users and Access → Sandbox → Testers. Make one account. Use it to test a real
purchase without paying. Do not use your own Apple Account.

This is the one step I cannot do: it needs a password to be set, and creating
accounts is off limits to me. It does not block review — the app unlocks every
feature when the store cannot be reached, so a reviewer never meets a locked
door they cannot open. It does block step 4.3 below.

---

## 1A. The listing, and how it is written

The App Store listing is **not** edited by hand any more. It lives in
`mobile/store.config.json` and is pushed with:

```
npx eas metadata:push
```

`eas metadata` drives the App Store Connect API with the key EAS holds on its own
servers, so no `.p8` is needed on this machine. One push sets the name, subtitle,
promotional text, description, keywords, release notes, all three URLs, the
copyright, both categories, the age advisory, the review contact and notes, the
release option, and it uploads every screenshot. `npx eas metadata:pull` reads
the live listing back into the same file.

`eas submit` needs `ascAppId` in the `submit.production.ios` profile of
`eas.json`, or it stops and asks for interactive mode.

Screenshots live under `mobile/store/apple/screenshot/en-US/<display type>/`.
Two display types cover the whole store:

| Display type | Sizes accepted | What is there |
| --- | --- | --- |
| `APP_IPHONE_67` | 1290×2796 or **1320×2868** | 6 shots, 1320×2868 |
| `APP_IPAD_PRO_3GEN_129` | 2048×2732 or **2064×2752** | 5 shots, 2064×2752 |

The images are made in two steps. Raw simulator captures go in
`store-assets/app-store/captures/<device>/`, taken on the simulators Apple
accepts for each size class — **iPhone 17 Pro Max** (1320×2868) and **iPad Pro
13" M4** (2064×2752). Then `node scripts/render-store-assets.mjs` draws the
caption over each capture on a canvas of the same size, so the phone pixels are
never resampled, and writes the finished slides to
`store-assets/app-store/screenshots/<device>/`. Copy those into
`store/apple/screenshot/en-US/<display type>/` for `metadata:push`. Do not
hand-crop: a resized capture is what makes Apple reject a screenshot.

The listing copy is drafted in
`store-assets/app-store/copy/app-store-listing.md`; `store.config.json` is the
machine-readable copy of it. Keep them in step.

### Medical wording — do not loosen this

The description and the review notes both say, in plain words, that Poke gives no
medical advice, no diagnosis, no treatment guidance and no dose recommendation;
that the level curve is an estimate drawn from numbers the user typed in and is
not a measurement and not a basis for a dose; and that the reconstitution screen
is a unit conversion for laboratory and educational use. No drug brand names
appear anywhere. App Information carries the declaration that the app is not a
regulated medical device in any country or region. This is what keeps the app on
the right side of guidelines 1.4.1 and 1.4.2. Version 1.0 was approved with the
same framing.

The subscription disclosure that guideline 3.1.2 asks for — price, period,
"renews automatically until cancelled", and links to the Apple standard Terms of
Use and to the privacy policy — sits in the description **and** on the paywall
itself. Both are required.

---

## 2. RevenueCat

Done, and the ids are in the table at the top. Kept as the record of the shape.

### 2.1 Project and app

- New project: `Poke`
- Add an App Store app, bundle id `industries.peptide.tracker`
- Upload the **In-App Purchase Key** (App Store Connect → Users and Access →
  Integrations → In-App Purchase, generate a key, download the `.p8` once)
- Add the **App Store Connect API key** as well, so RevenueCat can read product
  metadata
- Set the **App Store shared secret** (App Store Connect → App Information →
  App-Specific Shared Secret)

### 2.2 Products

Import or add both product ids exactly:

- `poke_pro_monthly`
- `poke_pro_annual`

### 2.3 Entitlement

- Identifier: `pro` (exactly this — the app checks
  `info.entitlements.active['pro']`)
- Attach both products to it.

### 2.4 Offering

- Identifier: `default`
- Packages: `$rc_monthly` → `poke_pro_monthly`, `$rc_annual` →
  `poke_pro_annual`
- Mark the offering **Current**.

The paywall asks for `offerings.all['default']` and falls back to
`offerings.current`, so either will work — but set both, so it cannot break.

---

## 3. The API key, back in the app

RevenueCat → Project settings → API keys → the **public** Apple key (starts
`appl_`). It is a publishable key, so it may live in the app bundle, but it must
not go in git.

Put it in `mobile/.env.local`:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxxxxxx
```

`revenueCatApiKey()` also reads `expoConfig.extra.revenueCatIosKey`, which is
where the EAS build should get it from. Set it as an EAS secret rather than
committing it.

Confirm `.env.local` is ignored by git before you write the key into it.

---

## 4. How to prove it works

Until the key exists, the app runs **fully unlocked** on purpose: locking a door
we cannot sell a key for only breaks the app. So the first proof is that the
locks appear at all. That same fallback is what stops a store outage from
blocking App Review.

1. `EXPO_PUBLIC_REVENUECAT_IOS_KEY=... npx expo start` on a device signed in to
   the sandbox tester account.
2. Open the paywall. Both plans must show the **store** prices, and the yearly
   row must say the trial. If it shows 49.99 with no trial, the offering did not
   load — check the offering is Current and the agreement is Active.
3. Buy the yearly plan with the sandbox account. The paywall must close and
   `/reports/level` must render the chart. **Not done yet** — waiting on the
   sandbox tester account in §1.6.
4. Delete and reinstall the app, then press **Restore purchases** in Profile.
   Pro must come back. Same wait.
5. Profile → Developer → Entitlement lets you force `free` or `pro` in a debug
   build without touching the store. `EXPO_PUBLIC_DEV_ENTITLEMENT=free` does the
   same from the start. This is what the locked and unlocked screens were checked
   with.

---

## 4A. Releasing

```
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production --latest
npx eas metadata:push
```

Then, in App Store Connect, by hand — the API does not do these:

1. Wait about 5 to 10 minutes for Apple to finish processing the binary. Watch
   TestFlight; the build must read **Complete**.
2. Version page → **Add Build** → pick the build → Done → **Save**.
3. Each subscription → **Add for Review** → the draft submission.
4. The subscription group → **Add for Review** → the same draft submission. A
   first subscription will not submit without its group **and** a new app
   version; ASC says so in the draft panel and refuses until all three are in.
5. Version page → **Add for Review** → the same draft submission.
6. App Review → the draft → **Submit for Review**.

Build on EAS, not locally. The local Xcode on this machine does not archive this
project cleanly; EAS builds on its own image, and every shipped build so far came
from there.

---

## 5. What is deliberately not here

No web funnel, and no US external-purchase link-out. Both need user accounts,
and Poke has none — the RevenueCat id is anonymous per install, so a purchase
made on the web could not be matched to a phone. The sequence is: ship this,
add Sign in with Apple at roughly 50 paying users, then build the web funnel
when paid acquisition starts and the 30% actually costs real money.

---

## 6. Submission record

**1.2.2** — prepared 10 August 2026. `app.json` and `store.config.json` both read
1.2.2. It contains everything prepared for 1.2.1, plus the rebuilt Today screen:
a compact medication rail, one selected-medication card, a full-width Log shot
action, a real blurred level preview for Free, the exact level chart for Pro, and
one Track today list for weight and side effects. The level preview uses only the
user's logged shots. A medication without a cited half-life gets no chart.

Build 14 was built from commit `dd61862` and uploaded on 10 August 2026. Apple
processed it successfully. It is available to internal TestFlight testers. EAS
build `48bcecd7-a996-4a88-b64e-4b78e35190b4`; EAS submission
`2eca447f-cdb0-4774-b268-99e4315868f3`.

**1.2.1** — prepared 8 August 2026, **never submitted**. Superseded by 1.2.2 on
10 August 2026. It contained the onboarding rebuild (23 counted steps, the
compute beat, and the plan reveal with a live pace slider and a projected date),
schema migration v7, and a copy pass over the whole flow. The `review.notes` in
`store.config.json` quote the plan screen's hedge word for word, so the screen and
the notes change together or not at all.

**1.2.0** — prepared 7 August 2026, **never submitted**. Superseded by 1.2.1 on
8 August 2026. Content: the per-medication setup flow, the computed plan screen,
19 sourced peptide presets with a search, the plain-language copy pass, and the
rating-prompt policy with schema migration v6.

**Do not submit 1.2.2 while 1.1.0 is in the queue.** App Store Connect holds one
version in review at a time. Taking 1.1.0 out to make room would also pull the two
subscriptions and the subscription group out with it, and a first subscription
cannot be submitted without its group *and* a new app version (§4A step 4). The
subscription review is the expensive part, and it is already paid for. So:

1. Wait for 1.1.0 to clear review.
2. Then create the 1.2.2 version in ASC, run
   `npx -y eas-cli@21.7.0 metadata:push`, attach build 14, and submit the version
   on its own. The subscriptions are already approved by then, so 1.2.2 is a
   plain app-version submission.

The EAS build may be made and uploaded at any time. It does not touch the 1.1.0
submission. Use EAS CLI 21.7.0 or later for metadata. Earlier clients reject
Apple's current age-rating fields.

Do not run the metadata push before 1.1.0 clears. On 10 August 2026, a check
showed that the command can rename the queued 1.1.0 version instead of creating a
second version. The queued version was restored from commit `6f1e92b`, and its
state, build, review copy, and screenshots were checked again.

**1.1.0 (9)** — submitted 7 August 2026, 4:15 AM. Four items in one submission:
iOS App 1.1.0, Poke Pro Yearly, Poke Pro Monthly, and the Poke Pro subscription
group. Status checked 10 August 2026: Waiting for Review, with build 9 still
attached. Review submission `29bef750-ed72-415f-a788-aa1a7495def0`. Release
option: **automatic on approval**. Age rating kept, not reset. Sign-in not
required.

The listing was renamed in this version: `Poke: Peptide & GLP-1 Log`, subtitle
`Shot log, levels and trends`, categories Health & Fitness and Medical. Name,
subtitle and category are shared app information — they go live with the version,
not before.

**1.0** — submitted 30 April 2026, approved.
