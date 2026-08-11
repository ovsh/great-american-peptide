# Motion

Scope: every animation in Poke. The numbers live in `src/theme/motion.ts` and nowhere else. This
file says which token an animation takes and how much motion a screen is allowed to have.

One rule above all the others: **motion is read from the token table, never typed into a
component.** If a screen needs a duration that is not in the table, the screen is wrong or the table
is short by one considered entry — decide which, then change the table.

---

## The tokens

### Durations (ms)

| Token | Value | Belongs to |
|---|---|---|
| `press` | 90 | Pointer-down feedback only. Half of `fast`, so a press registers before the finger settles. |
| `fast` | 150 | Micro: label swaps, chip tints, a lift, the press release. |
| `base` | 220 | Selection: focus switch, a curve morphing to another medication, a row settling. |
| `slow` | 320 | Content: a curve redraw, rows parting, the celebration pulse. |
| `draw` | 460 | A curve drawing itself on arrival. Once per mount. |
| `beat` | 65 | The stagger unit. Every staggered event lands on a multiple of it. |
| `hold` | 250 | Long-press gate before a row lifts. Nothing moves during it. |

`beat` is `onboardingMotion.holdMs` reused, so the log sequence and the onboarding transition count
in the same rhythm. `draw ÷ 7 columns = 65.7 ms`, which is the beat again — that is why the arrival
wipe and the curve draw stay in step.

### Easings

| Token | Curve | Belongs to |
|---|---|---|
| `standard` | `bezier(0.42, 0, 0.58, 1)` | The default. Measured off the onboarding recording. |
| `out` | `bezier(0.2, 0.7, 0.3, 1)` | Entrances; anything decelerating into place. |
| `in` | `bezier(0.5, 0, 0.9, 0.4)` | Exits; the shot dot falling onto the curve. |
| `linear` | `linear` | The metronome of rule 5: an arrival wipe crossing an axis. Nothing else. |

### Springs

| Token | damping / stiffness / mass | Belongs to |
|---|---|---|
| `settle` | 20 / 180 / 1 | The approved soft landing — about 4 % overshoot and back. Redrawn curves, dropped rows. |
| `pop` | 12 / 260 / 0.9 | A mark appearing with intent. |
| `lift` | 24 / 300 / 1 | A row leaving the surface under a finger. |

### Travel

`rise.card = 14`, `rise.line = 8`. That is how far a card and a small header line move on arrival.
Nothing travels further than a card.

---

## The rules

1. **Transform and opacity only** — plus `animatedProps` for SVG geometry. Never animate layout,
   width, height, or color of a laid-out box by re-render. Color moves through
   `interpolateColor` on a shared value.
2. **Reduce motion collapses everything.** `useReducedMotion()` must reach every animated
   component. The reduced path is the same end state reached in one frame: `timeTo` and `springTo`
   already do it, and `beatDelay` returns 0. A reduced-motion user sees no stagger, not a faster
   stagger.
3. **Arrival happens once, per cold mount, and finishes under 700 ms.** Today's last frame is at
   670 ms: header 0, hero 1 beat, list and curve and axis 2 beats, track card 3 beats.
4. **A stagger is a beat grid, not a set of hand-picked delays.** Write the delays as multiples of
   `motion.beat` in a named `*Beats` object next to `logBeats` and `arrivalBeats`.
5. **A metronome is linear; the easing belongs to the thing that lands.** The arrival wipe crosses
   the axis at `Easing.linear`; each mark carries its own eased pop.
6. **Never let the user see something half-swapped.** Facts that belong together (a name and its
   dose) leave together and return together, with the content changed while nothing is on screen.
   `useSwapTransition` in `src/components/today-motion.tsx` is that pattern.
7. **A fill drains, it does not cut.** State-to-state color goes through an interpolation, so a
   logged shot drains the solid green rather than replacing it.
8. **Legal copy does not move.** The (i) button is excluded from every entrance, stagger, and swap.
9. **A hold is a gate with nothing in it.** 250 ms of stillness, cancelled if the finger travels,
   so a scroll never becomes a drag. The lift is a mode change and the card must say so — swap the
   dot for a grip in the same-width slot so no text moves.
10. **A drop lands before the list re-orders.** Nothing may jump by a row height.

---

## One fun moment per screen

Each screen gets exactly one moment with delight in it, and every event in that moment lands on the
beat grid. Today's is the log sequence:

| Beat | ms | Event |
|---|---|---|
| 0 | 0 | The band fills and the label swaps. |
| 1 | 65 | The shot dot starts falling. |
| 4 | 260 | It lands; the forecast springs upward out of it on `settle`. |
| 5 | 325 | The day's ring fills into a check and pops; one soft ring leaves it. |
| 6 | 390 | The streak, last. |

Doctrine:

- **One.** A second delightful moment on the same screen makes both of them noise.
- It attaches to the action the screen exists for, never to arrival or navigation.
- It is one gesture — one ring, one pulse, one spring. Not confetti, not a burst, not a sound. This
  is a medical app.
- It is under 400 ms end to end and it never blocks input.
- It collapses to nothing under reduce-motion, and the app is still correct without it.

## Prototype before you port

Motion is designed in an interactive HTML prototype **after** the layout is frozen, never during
layout exploration. The prototype prints a spec column generated from the same constants it runs
on, so the spec cannot drift from the demo. The Reanimated port then reads those constants from
`src/theme/motion.ts` — one table, two consumers.
