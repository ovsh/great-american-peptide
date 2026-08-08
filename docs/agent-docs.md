# How we document features for agents

The problem: an agent reads a fixed amount of text before it starts to lose the thread.
Every line you add to an always-loaded file makes every other line a little weaker. But if
you delete the reason for a decision, the next agent removes the decision itself, because
it cannot see why the decision was there.

So the rule is not "write less". The rule is **move text down, never out**.

## The four layers

| Layer | File | Loads | Size |
|---|---|---|---|
| 1. Map | `AGENTS.md` + `CLAUDE.md` | Always, at launch | 200 lines, both together |
| 2. Scoped rules | `.claude/rules/*.md` | Only when an agent opens a matching file | About 20 lines each |
| 3. Reference | `mobile/docs/*.md` | Only when a trigger line sends the agent there | No limit |
| 4. Decisions | `mobile/DECISIONS.md` | Only when an agent is about to undo a choice | No limit, append only |

`CLAUDE.md` imports `AGENTS.md` with `@AGENTS.md`, because Claude Code does not read
`AGENTS.md` on its own. Codex and the other tools read `AGENTS.md` directly. One source,
two doors.

**An `@import` does not save context.** The imported file loads in full at launch, the same
as if you had pasted it. Only layers 2, 3 and 4 are actually lazy.

## The keep-or-cut test

A line earns a place in layer 1 or 2 only if it is at least one of these:

1. **Failure-backed** — you watched an agent get this wrong without the line.
2. **Tool-enforceable** — it names a real command, path, or identifier.
3. **Decision-encoding** — it records a choice the team made, not a fact of the world.
4. **Triggerable** — it tells the agent when to go read something else.

If a line is none of the four, it is trivia. Cut it.

The strongest single filter: **cut anything an agent can read off the codebase.** Folder
listings, dependency lists, framework summaries, "this project uses TypeScript". The agent
can `ls`. Keep the traps, the reasons, and the places where this repo differs from the
default behaviour of its tools.

## Adding a new feature

Work down the layers. Stop at the first one that fits.

1. **Nothing.** The default. If the code and its names explain the feature, write no doc.
2. **A decision entry** in `mobile/DECISIONS.md`, if you chose one approach over another
   and a future agent could reasonably choose the other. Record the road not taken.
3. **A reference file** in `mobile/docs/`, if the feature has a procedure — a build order,
   a console setup, a submission sequence. Then add **one row** to the "Read these when"
   table in `AGENTS.md`. The row is the whole cost.
4. **A scoped rule** in `.claude/rules/`, only if an agent must not get this wrong while
   editing a known set of files. Set `paths:` to those files.
5. **A line in `AGENTS.md`**, last resort, only for a trap that applies everywhere.

## Pruning

Prune layers 1 and 2 hard. Rewrite them in place; git holds the history.

Prune on these triggers, not on a schedule:

- A rule fires for something that no longer exists. Delete the line.
- Two lines say the same thing. Merge them.
- `AGENTS.md` plus `CLAUDE.md` pass 200 lines. Demote the least-triggered content to
  layer 3, and leave a "read this when" row behind.
- A reference file is never opened. Do not delete it. Fix its trigger row, or accept that
  it is now history and say so at the top of the file.

Never prune layer 4. See below.

## Decisions are append-only

`mobile/DECISIONS.md` is the one file that only grows. When a decision changes:

- Write a new row.
- Set the old row's status to `Superseded by #N`.
- **Leave the old row's text alone.** Do not correct it. It was true at the time, and the
  reason it was made is the part you cannot rebuild later.

A decision row has four parts: what was decided, why, what it cost, and its status. Keep it
to a few lines. The value is the chain, not any one link.

## What does not go in a decision record

Dated narrative. "At 01:50 phase 1 landed and we fixed the router paths." That is a run log.
It belongs in `mobile/docs/`, with a date in the filename, and it is read once. If a run log
contains a real decision, lift the decision into `DECISIONS.md` and leave the log where it is.

## Checking your work

- Run `/context` in Claude Code. Confirm `CLAUDE.md` appears under **Memory files**.
- Run `/doctor`. It proposes trims for a checked-in `CLAUDE.md`, using the same rule as
  above: cut what is derivable, keep pitfalls and reasons.
- Launch Claude Code from the repo root. `.claude/rules/` is found relative to the folder
  you start in, so starting inside `mobile/` skips the rules.
- Path-scoped rules and nested `CLAUDE.md` files do **not** come back after `/compact`.
  Root `CLAUDE.md` does.
