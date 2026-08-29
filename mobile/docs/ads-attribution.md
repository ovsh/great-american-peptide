# Ads and attribution

Read this before you change Meta, ATT, RevenueCat attribution or a Meta campaign.

## Non-negotiable boundary

No medication, dose, weight, side effect, injection site, note, schedule, HealthKit value
or exported file can enter Meta or RevenueCat attribution. Poke sends no manual Meta app
event. Product analytics is retired; see `docs/analytics.md`.

## Account identifiers

| Thing | Value |
|---|---|
| Meta app | Poke, `1402932788402301` |
| Meta client token | `7cc80b50917cee791d9ea0f2d572d646` (publishable) |
| Business Manager | Hypermark, `1851835925702347` |
| Facebook Page | Poke: Peptide & GLP-1 Log, `61593963959602` |
| Ad account | Hypermark, `860583726607999` |
| iOS app | Bundle `industries.peptide.tracker`, Store ID `6764757185` |
| RevenueCat project | Poke, `52c999f8` |
| Meta dataset | `1402932788402301` |

The Meta app secret and Conversions API token are secrets. Neither belongs in the app or
this repository.

## Runtime sequence

1. `app.json` keeps Meta auto-init and advertiser-ID collection off. Automatic app events
   stay on for activation after manual initialization.
2. RevenueCat configures for subscription functions and records the ATT status with its
   normal customer attributes. RevenueCat remains usable if attribution fails.
3. After the first screen, `src/services/attribution.ts` waits until the app is active and
   asks ATT if the status is undetermined.
4. Poke sets Meta advertiser tracking and identifier collection from that answer, then
   calls `Settings.initializeSDK()`.
5. After a grant only, Poke reads Meta's anonymous ID and gives RevenueCat that ID plus the
   current device identifiers. RevenueCat syncs the attributes before a purchase when it
   can. A 1.5-second bound means attribution never blocks StoreKit.
6. After a denial or restriction, Meta starts with advertiser identifiers off and
   RevenueCat receives no Meta anonymous ID. The RevenueCat integration must also keep
   **Send events when ATT consent is not authorized** off. Aggregate SKAdNetwork reporting
   is the only denied-user attribution path.

`src/services/attributionCoordinator.ts` owns the sequence and retry rule. Its test proves
grant, denial, undetermined retry, concurrent calls and best-effort RevenueCat failure.

## Dashboard settings

- RevenueCat Meta Ads uses **Conversions API** with the production dataset ID and token.
- **Send events when ATT consent is not authorized** is off.
- Default mapping: Trial Started to `StartTrial`; Trial Converted, Initial Purchase and
  Renewal to `Subscribe`; Non-Subscription Purchase to `fb_mobile_purchase`.
- Meta automatic in-app purchase logging is off. RevenueCat is the only purchase-event
  source, or Meta can count one purchase twice.
- The Meta ad set targets the Apple App Store record for Poke. Keep the campaign unpublished
  until approved creative exists.

## Release checks

- Inspect the final IPA, not only `app.json`: Meta auto-init false, advertiser-ID collection
  false, ATT text present and Meta SKAdNetwork IDs present.
- On a fresh physical iPhone, test one ATT grant and one denial. A grant must show the Meta
  anonymous ID and RevenueCat IDFA attributes. A denial must show no IDFA and no RevenueCat
  delivery to Meta.
- Buy a fresh sandbox trial. RevenueCat must show one accepted Meta delivery. Meta Events
  Manager must show one matching event and no SDK purchase duplicate. Meta can take up to
  24 hours to display the event.
- App Store privacy answers and `https://peptide.industries/privacy` must match the final
  IPA before App Review submission.
