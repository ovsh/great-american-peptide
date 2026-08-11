---
paths:
  - "**/mobile/app/**"
  - "**/mobile/src/components/**"
  - "**/mobile/src/theme/**"
---

# UI work

- Read `mobile/src/theme/` before any visual change. Colour, spacing and type are tokens.
  Never write a raw hex value or a magic number.
- Design every screen for a phone first. The iPad build uses the same components.
- Keep labels on charts and on the body diagram visible without a tap.
- Router paths are absolute (`/onboarding/plan`), never relative (`./plan`). Relative
  paths give a 404 on web.
- The Americana theme is removed. If you find cream `#F2E9D8`, crimson, gold, the Fraunces
  serif, `BrandSeal`, `MastHead` or `Eyebrow`, delete it. Do not add it back.
- An empty state must say it is empty. Do not fill a shipping screen with example data.
