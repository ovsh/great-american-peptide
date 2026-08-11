# Copy

Scope: every word Poke shows. Short file on purpose — the rules are few and absolute.

## Voice

Plain, short, explicit. Sentence case. A user who is anxious about an injection reads this app; it
answers, it does not perform.

## Rules

1. **Say what the thing is.** A first-time reader must learn from a headline alone that Poke is a
   GLP-1 and peptide shot tracker. Abstract poster copy ("Your journey, beautifully tracked") is
   rejected on sight. Name GLP-1 and peptides.
2. **A call to action uses the app's own action vocabulary.** The app logs shots, so the first-run
   CTA is `Log my first shot`, not `Get started`. Never introduce a verb the UI does not use.
3. **Cut any caption the visual already carries.** `7-day trend` above a seven-day chart is deleted,
   not shortened.
4. **No boilerplate repeated per row.** If a subtitle would be identical on every row of a list, it
   belongs somewhere else or nowhere.
5. **Never invent a statistic.** No "82 % of users…". If a real number is needed, it carries a real
   source; a placeholder is marked as a placeholder and never ships.
6. **No health claims and no dosing advice, ever.** The app records what happened. It does not
   predict an outcome, promise a result, or suggest an amount.
7. **The estimate line is fixed and non-negotiable:**
   `Estimate only. Do not use it to make dosing decisions.`
   It lives behind the (i), together with the evidence tier and the source. It is never rewritten
   and never dropped.
8. **Name the evidence honestly.** Use the strings in `EVIDENCE_LABELS` (`src/domain/peptides.ts`):
   "Half-life from the drug label" / "from a human study" / "Estimated half-life, limited evidence"
   / "No published half-life". Never round an estimate up into a fact.
9. **Write out the punctuation the app can render.** No em-dashes in UI strings; the mid-dot
   separator is written out where it reads better as a word.
10. **A locked feature says what it gives, not what it costs.** `Unlock exact levels` — the noun is
    the value, the pill is small, and there is no bordered box around it.
11. **Times and dates are human.** `Logged 9:02 am`, `Every Monday`, `In 7 days`. Lowercase the
    meridiem.

## Rejected phrasings, kept as a warning

| Rejected | Why | Shipped instead |
|---|---|---|
| `Get started` | Not the app's verb. | `Log my first shot` |
| `7-day trend` | The chart already is one. | (deleted) |
| `Unlock with Poke Pro` in a bordered box | Sells the tier, hides the shape. | `Unlock exact levels` pill on the live curve |
| `No supported half-life for this medication.` | A text-only state. | A designed flat-baseline state with a hint chip |
| `Estimate only…` as a permanent footer | Caption noise on every render. | The same line, behind the (i) |
