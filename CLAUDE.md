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

## iOS builds: local only

- Build locally. NEVER queue an EAS cloud build (`eas build` without `--local`) unless
  the user explicitly asks for one in the current conversation — the quota is paid.
- Known machine issue: actool fails with "Failed to launch AssetCatalogSimulatorAgent
  via CoreSimulator spawn" on every target (Xcode 16.2 on macOS 26 skew).
  `sudo xcodebuild -runFirstLaunch` does NOT fix it; upgrading Xcode does. Until then:
  Debug/simulator verification builds work with `EXCLUDED_SOURCE_FILE_NAMES='*.xcassets'`;
  production builds are blocked on the Xcode upgrade. Do not fall back to EAS cloud.
- Active development may live in a git worktree (`git worktree list` before editing
  mobile code); Metro must run from the same worktree you built.
