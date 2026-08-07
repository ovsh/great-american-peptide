# Poke Pro — App Store Connect and RevenueCat setup

Scope: everything that must exist in the two consoles before the paywall can sell
anything. The app code is done and committed; nothing here needs a code change,
except the last step (the API key).

The names below are read directly from the source. If you change a name in a
console, change it in the source too, or the paywall will find nothing.

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

These steps need your Apple Account. I cannot do them: they need a password, and
several of them are agreements. Do them in this order.

### 1.1 Paid Applications agreement — blocks everything else

Business → Agreements. The Paid Applications agreement must read **Active**.

As of 7 August 2026 it reads **Expired** (term Jan 18 2026 to May 14 2026), a
new version is waiting to be signed, and the bank account attached to it needs
more information. While it is expired App Store Connect **disables the Create
button** on the Subscriptions page, so no product can be made at all — and
RevenueCat would return an empty offering even if one existed.

Sign the new agreement and clear the bank notice first. Nothing below this line
can be done until then.

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
Apple will approve it. Suggested copy, in the tone of the app:

- Monthly display name: `Poke Pro`
- Yearly display name: `Poke Pro`
- Description: `Your medication level day by day, trends across weight, doses and side effects, more than one medication, and export for your doctor.`

The review screenshot can be the paywall itself.

### 1.5 App privacy

The paywall links `https://peptide.industries/privacy`. Confirm that URL is the
one on the listing (App Information → Privacy Policy URL). If it is not, either
fix the listing or fix `src/config/legal.ts` — they must agree.

### 1.6 Sandbox tester

Users and Access → Sandbox → Testers. Make one account. Use it to test a real
purchase without paying. Do not use your own Apple Account.

---

## 2. RevenueCat

Needs a RevenueCat account. Creating the account is yours to do; everything
after it is dashboard configuration.

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
locks appear at all.

1. `EXPO_PUBLIC_REVENUECAT_IOS_KEY=... npx expo start` on a device signed in to
   the sandbox tester account.
2. Open the paywall. Both plans must show the **store** prices, and the yearly
   row must say the trial. If it shows 49.99 with no trial, the offering did not
   load — check the offering is Current and the agreement is Active.
3. Buy the yearly plan with the sandbox account. The paywall must close and
   `/reports/level` must render the chart.
4. Delete and reinstall the app, then press **Restore purchases** in Profile.
   Pro must come back.
5. Profile → Developer → Entitlement lets you force `free` or `pro` in a debug
   build without touching the store. `EXPO_PUBLIC_DEV_ENTITLEMENT=free` does the
   same from the start.

---

## 5. What is deliberately not here

No web funnel, and no US external-purchase link-out. Both need user accounts,
and Poke has none — the RevenueCat id is anonymous per install, so a purchase
made on the web could not be matched to a phone. The sequence is: ship this,
add Sign in with Apple at roughly 50 paying users, then build the web funnel
when paid acquisition starts and the 30% actually costs real money.
