# Calm — the design principles

Scope: what every Poke screen must be. These rules are requirements, not preferences. They were
paid for one rejected mockup at a time during the Today redesign of 1.2.2, and each one names the
mistake it exists to prevent.

Poke is a medical-adjacent record keeper. It records what the user did; it never promises a result.
The tone is calm, clinical-but-warm, generous with whitespace, green as the single accent.

---

## 1. One selection axis per screen

A screen may have exactly **one** thing the user selects. Today selects a medication. History
selects a period. Progress selects a metric.

Two cursors on one screen was the root cause of every "this is overwhelming" reaction in round 1.
A day cursor plus a medication cursor made the user answer two questions before reading one number.

- When a second axis appears, **delete an axis before you add a fold**. A component that needs a
  fold, a cap ("+1 more"), and a six-panel state study to stay manageable is overweight. The
  overweight is the tell. Simplify; do not compress.
- Time travel belongs to History. It does not belong on Today or Progress.
- The user's chosen focus is **sticky**: persist it, and open the screen on it.

## 2. Visual first, words last

Every state gets a designed visual. A sentence in body text is not a state.

- **Text-only states are banned.** No-data, unsupported, locked, error, zero-items — each is a
  drawn thing: a flat baseline with a hint chip, a dimmed shape, a mark. If the only design you
  have is a paragraph, the state is not designed yet.
- Fewer labels, fewer captions, more shape. Delete any caption whose content the visual already
  carries ("7-day trend" over a seven-day chart is noise).
- No dense stacked text. Three or more stacked text lines in one card is a redesign trigger.
- No boilerplate subtitle repeated on every row of a list. If every row says the same thing, the
  row is not the place to say it.
- Nothing legible may be smaller than about 12 px, and no meaningful mark may be smaller than
  about 16 pt. 11 px dots were unreadable and got deleted.
- Charts label themselves. A reading must be visible without a hover, a tap, or a tooltip.

## 3. Let the chart's axis carry the structure

The Today curve has no grid, no axis numbers, and no legend. Its x-axis **is** the week, and each
column carries the day's own mark:

| Mark | Means |
|---|---|
| Check on a filled dot | The user logged a shot |
| Filled ring | Due today |
| Hollow ring | The schedule names this day |
| Short dash | A day off |

That row replaced a day selector, a due banner, and a "1 more" cap. Prefer this move on any new
screen: put the meaning **into** the chart's own axis instead of into chrome around it.

## 4. The primary action never disappears

The action a screen exists for is a permanent slot. It may change emphasis; it may never vanish and
never move.

Today's log band sits at the foot of the hero card in all three states: quiet gray when nothing is
due, solid `successDeep` when a dose is due, soft green reading `Logged 9:02 am` after a shot — and
still tappable, because a second shot happens. The old band existed only on due and unscheduled
days, so the one thing the app is for was absent five days out of seven.

Rule: **emphasis is stateful, presence is not.**

## 5. No headers the tab bar already gives you

Today has no "Today" title. It has a slim date line and a streak chip. The tab bar names the tab.
Reclaim that vertical space for the content.

## 6. Honest data, disclosed on demand

- Every estimate names its basis. `src/domain/peptides.ts` carries an evidence tier per preset:
  `label` (drug label), `trial` (human study), `estimate` (limited evidence, must state the
  species / scaling / consensus caveat), `unsourced` (no published half-life — such a preset
  carries no half-life at all, and the screen must show a designed no-curve state).
- The disclaimer, the evidence tier, and the source live **behind an (i)**, in a sheet — never as a
  permanent footer caption under the chart. The line itself is never dropped:
  `Estimate only. Do not use it to make dosing decisions.`
- The app never proposes a dose. Presets carry no `defaultDose`. This is an App Review commitment,
  not a style choice.
- No health claims, no invented statistics. See [`copy.md`](copy.md).

## 7. The free tier shows the shape and withholds the numbers

- Draw the real curve. **Never blur it**, never cover it with a bordered lock box.
- Withhold the reading: the value chip becomes a small `Unlock exact levels` pill in the same
  position. Small, quiet, one line.
- Two medications are free; the third asks for Pro.
- A locked state is still a designed visual, by rule 2.

## 8. Lists are slim rows, and the order is the user's

A list row is one line: color dot, name, one status chip. Tap to focus (persisted). Hold to
reorder (persisted `sort_order`). The add row is last and always present — an add affordance may
not be conditional on the list being non-empty or on it being short.

A list must be designed at 0, 1, 2, and many items before it ships. One item must not look silly.

## 9. Celebrate once, quietly

Poke is a medical app, and a logged shot is not confetti. One ring leaves the day's mark, in the
medication's color, once. See [`motion.md`](motion.md) § one fun moment.

---

## Reviewer's checklist

A screen is not done until every line is true.

- [ ] Exactly one selection axis.
- [ ] No state renders as a bare sentence.
- [ ] No card stacks three or more text lines.
- [ ] The primary action is present in every state, in the same place.
- [ ] No screen title duplicating the tab name.
- [ ] Every caption survives the question "does the visual already say this?".
- [ ] Free and Pro both drawn; the free version has shape, not blur.
- [ ] 0 / 1 / 2 / many drawn for every list.
- [ ] Estimate disclosure reachable, never a permanent caption.
- [ ] Every value readable without interaction; nothing meaningful under ~16 pt.
