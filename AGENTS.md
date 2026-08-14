# Poke — agent guide

Expo 54 + expo-router + SQLite iOS app, shipped as **Poke: Peptide & GLP-1 Log**
(bundle `industries.peptide.tracker`, App Store Connect app `6764757185`).

The repo root is a static marketing site. The app is in `mobile/`. Work in `mobile/`
unless the task is about the website.

## Commands

Run all of these from `mobile/`.

| Task | Command |
|---|---|
| Web preview — the fast loop | `npm run web` |
| iOS simulator | `npm run ios` |
| Lint | `npm run lint` |
| Typecheck | `npx tsc --noEmit` |
| Store build | `npx eas build --platform ios --profile production` |
| Push the store listing | `npx eas metadata:push` |

There is no test runner. Domain tests run one at a time with `npx tsx`.

## Layout

- `mobile/src/domain/` — pure math: pk, reconstitution, rotation, scheduling, units. No React.
- `mobile/src/db/`, `mobile/src/repositories/` — SQLite schema and all data access.
- `mobile/app/` — expo-router screens. Routing comes from the file names.
- `mobile/store.config.json` — the App Store listing as code.

## Rules you cannot get from the code

- **Router paths are absolute.** A relative path such as `./taking` gives a 404 on web.
- **Do not change `src/domain/` to fix a UI problem.** The math is correct and load-bearing.
  Fix the caller instead.
- **Build on EAS, not locally.** The local Xcode does not archive this project cleanly.
- **Do not soften the medical wording** in `store.config.json` or in on-screen copy. The app
  must not advise, diagnose, treat, or recommend a dose. See `mobile/docs/store-setup.md` §1A.
- **The bundle id never changes.** The App Store record depends on it.
- **No placeholder or fake data in a shipping screen.** An empty state must say it is empty.

## Read these when

| Read | When |
|---|---|
| `mobile/DECISIONS.md` | Before you change or undo an architectural choice. |
| `mobile/docs/store-setup.md` | Any App Store, subscription, or RevenueCat work. |
| `mobile/docs/dev-server.md` | The dev server or the simulator misbehaves. |
| `mobile/SPEC-POKE.md` | You need the product intent behind a screen. |
| `mobile/docs/market.md` | Pricing, competitors, or positioning. Dated Aug 2026 — re-check before you act. |
| `mobile/docs/competitor-creative.md` | You are writing an ad, a store video, or social creative. |
| `mobile/docs/ai-chat.md` | Any work on the AI chat, its prompts, or its evals. |
| `docs/agent-docs.md` | You are about to add, move, or prune documentation. |
