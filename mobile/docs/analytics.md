# Product analytics: retired

Poke removed PostHog before the 1.6.1 release. The SDK, key, event schema and all event
calls are gone.

The old event list included medical-context actions such as logging a shot, a weight, a
side effect and an Apple Health connection. No raw value left the device, but a persistent
analytics identifier still made those action names an off-device health-behavior record.
Poke does not keep that record.

RevenueCat remains for subscription functions. Meta remains for ad attribution. Read
`docs/ads-attribution.md` before you change either service. Do not add product analytics
without a new privacy design, an explicit product decision and updated App Store privacy
answers before the build ships.
