# The design loop

Scope: how a Poke screen gets redesigned. This is the procedure that produced the 1.2.2 Today
screen. Follow it in order; the order is where most of the value is.

---

## The loop

1. **Read the real thing first.** The current screen's code, the components it uses, the domain
   module behind it, and `src/theme`. Then write **one shared brief file** and give every agent the
   same one. Divergence must come from the concepts, not from agents guessing different facts.
2. **Diverge in parallel.** Two or three variants at once, each with a *named concept* stated in one
   sentence, each answering the same brief. Never brief a variant to be "a safer version" of
   another one — a hedge produces nothing to choose between.
3. **Owner critique, then converge.** Round 2 combines the winning elements. Name what was killed
   and why in the mockup itself.
4. **State study before you commit to a layout.** Draw 0 / 1 / 2 / many items, free vs Pro, no-data,
   and mid-gesture. If a component only survives the study with a fold, a cap, and six panels, it
   is overweight: delete an axis instead of compressing the layout
   (see [`principles.md`](principles.md) § 1).
5. **Freeze the layout, then design motion.** One interactive prototype, a spec column generated
   from the constants it runs on, then a Reanimated port reading `src/theme/motion.ts`.
6. **Implement, gate, commit.** One commit per feature.

Simplification comes from **deleting a control**, not from tightening spacing. Every time the loop
produced a calmer screen, an axis had been removed.

---

## Mockup conventions

Deliverable: one **self-contained HTML file** per concept, in the session scratchpad's `variants/`
directory, named `<screen>-<concept>.html`.

- **A rack of labelled iPhone columns**, 393 × 852 pt each, side by side on a scrollable page.
  Three states minimum, each with a label saying which state it is. Include the tab bar and the FAB
  so the composition reads real.
- **Tokens verbatim** from `src/theme`, declared once as CSS custom properties at the top. A colour
  that is not a token is a bug in the mockup.
- **Real data and real math.** Named medications, real doses, a plausible weight. Curves are drawn
  from the actual exponential-decay model, not sketched as a wave and never as a gray box.
- **No text-only states**, in the mockup either. If the mockup fakes a state with a sentence, the
  implementation will ship a sentence.
- **A recommendation block** at the end: what to keep, what to drop, what the concept costs.
- Font: `Inter, -apple-system, …`. Loading Inter from Google Fonts is allowed; the file must degrade
  without it. Inter is the app's token font — a design tool that flags it as "overused" is wrong
  here; classify it as intentional.

### Pitfalls, all of them paid for

- Never declare `const top` at global scope in a mockup script. It collides with `window.top` and
  renders a blank page.
- The chat side panel does not run JavaScript. Interactive prototypes must be viewed over
  `localhost`; serve the variants directory (`launch.json` entry `mockups`, port 8899).
- Screenshot the rack before reviewing. A concept that only reads well while scrolling is not
  finished.

---

## Model policy

| Work | Model |
|---|---|
| Design concepts and mockups | `fable` |
| Reading code, research, implementation | `opus` |
| Review of a plan or an implementation | `fable` or `opus` |

Design subagents load the `frontend-design` skill, the shared brief, and `docs/design/`.

---

## Gates

Before every commit:

```
npx tsc --noEmit
npx expo lint
npx expo export -p ios     # native-adjacent changes only
```

One commit per feature, with the co-author trailer.

### Verifying on a device

Local `xcodebuild` is broken on this machine (an `actool` / CoreSimulator FIFO handshake; Apple's
advice is to reboot). The working path is an EAS build with `--profile simulator`, installed with
`simctl` and driven through the simulator MCP. Budget for it — it is not fast.

---

## What a review looks for

Run the checklist at the end of [`principles.md`](principles.md) against every mockup before an
opinion is offered. Then, and only then, judge taste. A variant that fails a checklist line is not
"a different direction"; it is unfinished.
