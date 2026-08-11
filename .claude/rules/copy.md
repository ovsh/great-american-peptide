---
paths:
  - "**/mobile/app/**"
  - "**/mobile/src/components/**"
  - "**/mobile/src/stores/**"
  - "**/mobile/src/services/**"
  - "**/mobile/store.config.json"
---

# Copy

The voice is plain. Run `/content-writer` in `plain` mode for any pass over more than a
few strings.

- No em-dashes. One comma per sentence. A legal list of negations keeps its commas.
- No mid-dot separators (`·`) anywhere in user-facing copy. A mid-dot glues fragments
  together; write the sentence instead. "0.5 mg · Every Monday" becomes "0.5 mg every
  Monday". "Logged 1:04 am · left thigh" becomes "Logged at 1:04 am in the left thigh".
- Active voice. No contractions. Poke is the actor by name, never "we" and never a bare
  "it" that could point at two things.
- A button label names what happens when you press it. Read the handler before you write
  the label.
- Do not name a feature the code does not have. Before you strip a hedge, grep the thing
  it hedges. A hedge over an unbuilt feature is load-bearing.
- Trace every `${...}` to its real fallbacks. When a template joins a list, phrase it as
  a sentence or use commas, never mid-dots.
- Never put a number in a dose field as a placeholder. `review.notes` promises Poke never
  proposes a number.
- Medical and subscription strings get clearer, never weaker. Show the owner before and
  after, apart from the rest. Never quote a button label inside legal text.
- `grep` a string before you rename it. `store.config.json` `review.notes` names buttons
  App Review must press, `store-assets/app-store/copy/app-store-listing.md` mirrors the
  listing, and `SPEC-POKE.md:93` names the tagline and the first button.
