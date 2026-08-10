---
score: 37
p0: 0
p1: 0
method: two-independent-assessments
timestamp: 2026-08-10T07-45-12Z
slug: mobile-app-tabs-index-tsx
---
# Today screen critique

## Assessment method

Two independent reviews were used. The first was a design and usability review of current web and iOS captures. The second ran the Impeccable static detector exactly once and checked the Free flow in a separate 390 by 844 browser session.

## Result

Release-ready after fixes. The screen is specific to Poke and keeps the next-shot task before analysis or promotion. No P0 or P1 issue remains in the reviewed scope.

## Nielsen score

| Heuristic | Score |
|---|---:|
| Visibility of system status | 4 |
| Match with the real world | 4 |
| User control and freedom | 3 |
| Consistency and standards | 4 |
| Error prevention | 4 |
| Recognition rather than recall | 4 |
| Flexibility and efficiency | 4 |
| Aesthetic and minimalist design | 3 |
| Error recovery | 3 |
| Help and documentation | 4 |
| **Total** | **37/40** |

## Resolved findings

- Dark green now gives the main action, status text, and active tab sufficient contrast.
- Inactive tab labels now use the darker muted text token.
- The medication rail shows more than four items, keeps a partial next item visible, and includes a compact schedule status.
- The unsupported level state names the medication and explains the missing supported half-life without showing an empty chart.
- The Free preview keeps the real curve visible as a blurred shape while it hides exact values from assistive technology.
- The selected medication uses a small identity dot instead of a control-like vertical mark.

## Detector evidence

The static detector returned zero findings for `mobile/app/(tabs)/index.tsx` and `mobile/src/components/today-medication-section.tsx`. The browser detector found the bottom-tab contrast problem that was fixed after the run. Its remaining layout-transition and text-occlusion messages were false positives from hidden safe-area probes and the intentional Free chart blur.

## Tradeoffs

- The level preview remains above Track today because it is a useful medication fact for Pro and a restrained product explanation for Free. It uses one action and does not block shot logging.
- A narrow phone can truncate a long medication name, but each rail item also has schedule status and a full accessibility label. The selected card shows the full medication name.
- The iPad App Store capture was not updated in this run because the locked Mac prevented the one-time Expo Go confirmation. The iPhone capture and the shipped responsive code were verified.

Questions skipped: the findings were straightforward and fixed before release.
