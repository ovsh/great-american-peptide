# Analytics

Poke sends product events to PostHog so the owner can see which screens people finish and
which they leave. `src/services/analytics.ts` is the only file that may import
`posthog-react-native`. Every other file calls `track` from that wrapper.

## The rule that outranks every question

**No health data ever enters an event.** No medication name, no brand, no preset id, no
dose, no unit, no route, no body site, no weight, no side effect, no note text, no
schedule, no date of a shot, and nothing computed from any of them.

The hard test for a new event, applied before you write the line:

> If this property leaked in full, could a reader tell what this person takes, how much
> they take, what it does to them, or what they weigh?

If the answer is yes, or if you are unsure, the property does not ship. An event name and
a coarse boolean or enum answer almost every product question. A count of shots is a
product fact. A dose is a medical record.

`AnalyticsEvents` in `src/services/analytics.ts` is a closed union, so an unknown event
name and an unknown property both fail the typecheck. Add the event there first, then
call it. The compiler is the second line of defence and this rule is the first.

## The schema

| Event | Properties | Fires where | Why |
|---|---|---|---|
| `onboarding_step_viewed` | `step` route name | `app/onboarding/_layout.tsx:16` | Where the flow loses people. The counted length moves with the knowledge and journey answers, so read the step name and not a position. `useSegments` returns route patterns, so a dynamic step reads as `setup/[index]/vial` and no typed answer can reach it. |
| `onboarding_channel_picked` | `channel`, one of `app_store`, `tiktok`, `instagram`, `youtube`, `reddit`, `creator`, `friend`, `other` | `app/onboarding/found.tsx:40` | Which channel brings people in, which is the one thing the App Store's own numbers cannot say. The only content event in the flow, and the id comes off a closed list of eight, so nothing a person typed can reach it. It fires when the user leaves the screen with a pick, never on a tap and never on a skip. |
| `onboarding_completed` | none | `src/services/onboarding.ts:249` | The denominator for every later funnel. |
| `health_connect_enabled` | `source` `onboarding` or `profile` | `src/services/health.ts:117` | Whether the Apple Health offer works better during setup or later. Fires only when the switch goes on, so a background read does not report a second connection. |
| `notification_permission_result` | `granted` | `src/services/notifications.ts:85` | The reminder loop is worth nothing without permission. Counted only at the real prompt, never at a permission iOS granted earlier. |
| `reminder_toggled` | `kind`, `on` | Not wired yet | The switches live only in `app/(tabs)/profile.tsx`. In the schema, waiting for a handler that a service can see. |
| `medication_added` | `kind` `preset`, `brand`, `custom` or `blend`, `source` `onboarding` or `app` | `src/services/onboarding.ts:190`, `app/medications/new.tsx:423` | Whether the catalog covers what people take. The kind is the shape of the row they pressed. The name never travels. |
| `shot_logged` | `edited` | `src/services/injectionMutations.ts:30` and `:40` | The core habit, and how often a shot is corrected afterwards. |
| `shot_deleted` | none | `src/services/injectionMutations.ts:47` | Reads with `shot_logged` so a correction loop is not read as growth. |
| `side_effect_logged` | `clear` | `app/log-side-effect.tsx:103` and `:125` | Whether the check-in is answered at all. Which side effect and how bad it was stay on the phone. |
| `weight_logged` | `source` `manual` or `health` | `app/log-weight.tsx:66`, `src/services/health.ts:118` | Whether the Health import removes the typing. The number never travels. |
| `paywall_viewed` | `source` screen name | `app/paywall.tsx:65` | Which lock sells. `openPaywall(source)` writes the name into the route, and a screen that names nothing lands as `unknown`. |
| `purchase_completed` | `plan` `yearly` or `monthly` | `app/paywall.tsx:89` | Conversion by plan. |
| `purchase_restored` | none | `src/stores/entitlement.ts:247` | Lives in the store, so a restore from the profile tab counts too. |
| `export_csv` | none | `src/services/export.ts:95` | Export is a Pro feature and a reason people pay. The file itself never leaves by this route. |
| `tester_code_redeemed` | `tester_id` | `src/stores/entitlement.ts:264` | Lives in the store, so both doors count: the tester screen in Profile and the creator screen in setup. A tester id is an invite number, not a person. |

PostHog also sends its own lifecycle events, `Application Opened`, `Application Became
Active` and `Application Backgrounded`, which is what retention is counted from.
Autocapture needs `<PostHogProvider>`, which Poke does not mount, so no tap, no screen and
no text field is recorded on its own. Session replay is off.

There is no account and no login, so Poke never calls `identify`. Every event rides an
anonymous device id that PostHog generates on the phone. `setTesterId` registers one super
property, `tester_id`, so the owner can tell one invited tester from another.

## The key

`EXPO_PUBLIC_POSTHOG_KEY`, read in `src/services/analytics.ts` and listed in
`.env.example`. Put it in `.env.local` for a local run, and in the EAS build environment
for a store build. It is a publishable key and it ships inside the bundle.

With the variable absent or empty, the whole module is inert: no client is built, nothing
is queued, nothing is logged, and the app behaves as if analytics were not installed. That
is the state every developer machine runs in until someone adds a key.

## Before this ships

1. **The App Store privacy label must change.** Poke's current label declares no
   collection. Analytics adds one item, **Product Interaction**, under **Data Not Linked
   to You**, used for **Analytics**. Nothing else. Declare no identifiers, no health data
   and no usage data beyond product interaction. Update the label in App Store Connect in
   the same submission that carries the key, not after it.
2. **No ATT prompt is needed.** App Tracking Transparency covers tracking across apps and
   websites owned by other companies. Poke sends its own events to its own PostHog
   project, links them to no identity, and shares them with no data broker or ad network.
   So there is no `NSUserTrackingUsageDescription` and no `requestTrackingAuthorization`
   call, and adding one would ask for permission Poke does not use.
