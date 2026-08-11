---
paths:
  - "**/mobile/store.config.json"
  - "**/mobile/store/**"
  - "**/mobile/eas.json"
  - "**/mobile/app.json"
---

# Store and release work

Read `mobile/docs/store-setup.md` first. It holds the live identifiers and the exact
submission order. Getting the order wrong makes App Store Connect refuse the submission.

- **The listing is code.** Edit `store.config.json`, then run `npx eas metadata:push`.
  Do not edit the listing by hand in App Store Connect. A hand edit is lost on the next push.
- **The medical wording is deliberate.** It was written to pass App Review guidelines 1.4.1
  and 1.4.2. Do not remove a disclaimer. Do not add advice, diagnosis, treatment, dose
  recommendation, or a drug brand name.
- **The review notes must keep saying the app needs no account and no sign-in.** There is no
  server. A reviewer who cannot reach the paid features will reject the build.
- **Screenshots are generated.** Put captures in `store-assets/app-store/captures/<device>/`,
  then run `node scripts/render-store-assets.mjs`. Never resize an image by hand.
- **`industries.peptide.tracker` is permanent.** The App Store record depends on it.
