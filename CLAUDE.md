@AGENTS.md

## Claude Code

<!-- Maintainer note: block-level HTML comments are stripped before this file enters
     context, so notes like this one are free. Keep them for humans only. -->

- Path-scoped rules live in `.claude/rules/`. They load when you open a matching file.
  They are **not** re-injected after `/compact`. If a long session has been compacted and
  you are editing UI or store files, read the matching rule again.
- `AGENTS.md` is imported above, so it loads in full at launch. The two files share one
  200-line budget. Before you add a line to either, apply the keep-or-cut test in
  `docs/agent-docs.md`.
