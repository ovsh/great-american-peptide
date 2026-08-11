# Poke — project instructions

## iOS builds: local only

- Build iOS locally with `xcodebuild` against the worktree's `ios/` directory
  (run `npx expo prebuild --platform ios --no-install` first if `ios/` is missing,
  then `pod install` with `LANG=en_US.UTF-8`).
- NEVER queue an EAS cloud build (`eas build`) unless the user explicitly asks for
  one in the current conversation. The EAS build quota is limited and paid.
- Known machine issue: local simulator builds fail in actool with
  "Failed to launch AssetCatalogSimulatorAgent via CoreSimulator spawn".
  `sudo xcodebuild -runFirstLaunch` does NOT fix it. Likely cause: Xcode 16.2 is
  too old for this macOS (Darwin 25 / macOS 26); the durable fix is upgrading
  Xcode. Working workaround for Debug/simulator verification builds: add
  `EXCLUDED_SOURCE_FILE_NAMES='*.xcassets'` to the xcodebuild invocation
  (app builds and runs without icon/splash art). Do not fall back to EAS.
- Debug builds load JS from Metro on port 8081. Start Metro from the SAME worktree
  you built from (`CI=1 npx expo start --port 8081`); kill stale Metro processes
  from other checkouts first (`lsof -ti :8081`).

## Repo layout

- Active development branch: `codex/immaculate-home-1.2.2`, checked out in the
  worktree `/Users/ovsh/.codex/worktrees/immaculate-poke` (NOT in this checkout's
  `mobile/`). Check `git worktree list` before editing mobile code.
- The design constitution lives in `mobile/docs/design/` (principles.md,
  motion.md, copy.md) on that branch. Read it before UI work; new screens must
  pass its checklist.

## Design rules (project-specific)

- Color meanings are fixed: green = dose/success and the single accent,
  amber = weight, violet = side effects, medication ramp = identity only.
- Half-life data in `src/domain/peptides.ts` must cite a source; the app never
  suggests doses and never ships invented statistics.
