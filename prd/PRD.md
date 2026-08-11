# Peptide Tracker — PRD

A native iOS app for logging peptide injections, tracking estimated drug levels, and watching weight progress. Sub-app of the Great American Peptide Co. brand. Lives in `mobile/` (proposal).

Source design refs in [reference/](reference/).

---

## TL;DR

- **Stack:** Expo + React Native + TypeScript, expo-sqlite, Zustand, Victory Native XL for charts, Expo Router
- **No backend, no login.** Local-first. Optional iCloud + Apple Health sync later.
- **MVP:** single-med Today + Log Shot + History + reminders
- **After MVP:** multi-med, body-site picker, PK chart, Apple Health
- **Brand bridge:** same cream/navy/red as the landing site, but editorial serif headings replace Oswald — wax-seal medallion vs. rally-poster

---

## 1. Goals

| # | Goal | How we'll know it's working |
|---|---|---|
| 1 | Logging a shot takes <10s | Time-to-log measured; 2 taps from Today |
| 2 | One honest answer per screen | Every screen has a single hero number or next action |
| 3 | Show, don't make people calculate | Estimated level, peak/trough, site rotation — all derived |
| 4 | Local-first by default | Fully usable offline, no account; cloud is opt-in only |
| 5 | Restrained brand | Editorial type, patriotic only via stars and seal — never costume |

### Non-goals

- Not a medical device. No diagnosis, no dosing recommendations.
- Not a peptide store (sales live on `shop.peptide.industries`).
- No social, feed, sharing, leaderboards.
- No web client at MVP. iOS only through launch.

### Target user

30–55 year-old US male using GLP-1s (Tirzepatide / Semaglutide), recovery peptides (BPC-157, TB-500), or longevity stacks. Already self-injecting. Currently tracks in Notes app or a spreadsheet. Cares about consistency and seeing weight come down. Suspicious of ad-supported wellness apps.

---

## 2. Features / requirements

P0 = MVP, P1 = next, P2 = later. Mapped to the 14 screens across the two design mocks in `reference/`.

### Today / Home
| # | Feature | Pri |
|---|---|---|
| 1.1 | "Today's next step" hero card with one-tap log | P0 |
| 1.2 | Stat trio: weight / BMI / estimated level | P0 (weight, BMI) / P1 (level) |
| 1.3 | Mini medication-level sparkline (deep-link to Reports) | P1 |
| 1.4 | Multiple "Due Today" cards (multi-med) | P1 |

### Log Shot
| # | Feature | Pri |
|---|---|---|
| 2.1 | Medication picker | P0 single / P1 multi |
| 2.2 | Dose stepper (defaults to last-used) | P0 |
| 2.3 | Date + time picker (defaults to now) | P0 |
| 2.4 | Notes (120 char) | P0 |
| 2.5 | Route (SC / IM) | P1 |
| 2.6 | Body-site picker w/ diagram (front/back, 24 sites) | P1 |
| 2.7 | Site-rotation suggestion | P1 |

### Medications (multi-med)
| # | Feature | Pri |
|---|---|---|
| 3.1 | Active medications list | P1 |
| 3.2 | Add / edit medication (name, dose, route, frequency) | P1 |
| 3.3 | Pause / archive | P1 |
| 3.4 | Peptide preset library (8–10 common, with half-life) | P1 |

### Reports
| # | Feature | Pri |
|---|---|---|
| 4.1 | Estimated level + trend (rising/falling/steady) | P1 |
| 4.2 | Time-range chart 7D/14D/30D/90D/ALL | P1 |
| 4.3 | Peak / trough / avg | P1 |
| 5.1 | Weight + BMI tabs with hero number + delta | P0 |
| 5.2 | Time-range chart 7D/30D/90D/1Y/ALL | P0 |
| 5.3 | Manual weight entry | P0 |

### Calendar
| # | Feature | Pri |
|---|---|---|
| 6.1 | Monthly grid with colored dots per medication | P1 |
| 6.2 | Selected-day detail list | P1 |

### History
| # | Feature | Pri |
|---|---|---|
| 7.1 | Chronological list grouped by month | P0 |
| 7.2 | Tap row → edit / soft-delete | P0 |
| 7.3 | Filter by medication | P1 |
| 7.4 | Site-rotation insight panel | P1 |

### Profile / Settings
| # | Feature | Pri |
|---|---|---|
| 8.1 | Reminder time (global → per-med in P1) | P0 |
| 8.2 | Units (lbs/kg, mg/mcg) | P0 |
| 8.3 | Notifications master toggle | P0 |
| 8.4 | Export data (CSV) | P0 |
| 8.5 | Apple Health connection | P3 |
| 8.6 | iCloud sync | P3 |
| 8.7 | Help / disclaimer (App Store requirement) | P0 |

### Cross-cutting
3-screen onboarding (P0) · disclaimer accept on first launch (P0) · local notifications for reminders + missed-dose nudge (P0) · empty states (P0) · accessibility WCAG AA + VoiceOver + Dynamic Type (P0) · dark mode (P2).

---

## 3. Design system

Sub-brand of the existing Great American Peptide Co. landing site. **Same palette, different typography.** The landing uses Oswald for rally-poster energy; the app uses an editorial serif on cream for clinical calm.

### Colors

| Token | Hex | Use |
|---|---|---|
| `background` | `#F5EBD0` | Parchment canvas |
| `surface` | `#FFFFFF` | Cards |
| `ink` | `#0F1B2D` | Primary text (deeper than landing's #002868 for body contrast) |
| `inkMuted` | `#5A6478` | Captions |
| `red` | `#B0202E` | Primary CTA, current day, alerts |
| `gold` | `#C9A961` | Seal/star accents only — never CTAs |
| `success` | `#3F7D4F` | "Healthy", "On time", "Connected" pills |
| `warning` | `#C58A2E` | "Late", "Due today" |
| `border` | `#E5DDC8` | Card borders |

Med color slots (assigned in order): red, navy, success-green, gold, purple, teal.

All text combinations must clear WCAG AA. Body text on background is 13.8:1 (AAA).

### Typography

Serif headings, sans body. Free Google equivalents listed.

- **Serif:** Fraunces (commercial: Tiempos / Canela)
- **Sans:** Inter
- **Mono:** JetBrains Mono (tabular numbers only)

| Token | Size/Line | Weight | Family | Use |
|---|---|---|---|---|
| `display` | 40/44 | 600 | serif | Screen titles |
| `h1` | 32/38 | 600 | serif | Hero numbers (194.8 lbs) |
| `h2` | 24/30 | 600 | serif | Section headlines |
| `body` | 16/22 | 400 | sans | Default UI |
| `eyebrow` | 11/14 | 700 | sans | All-caps labels, `letterSpacing: 1.5` |

Rule: serif for any number a user reads as a "headline" (current weight, level, dose hero). Sans inside list rows.

### Spacing & radius

Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48.
Radius: card = 14, hero = 20, pill = 999.
Card padding default 16; screen horizontal padding 20.

### Components

Primitives: `Text`, `Box`, `Stack`, `Button` (primary/secondary/ghost), `Pill`, `Eyebrow`, `Card`.
Forms: `Input`, `Stepper`, `Select`, `Toggle`, `DatePicker`, `Textarea`.
Display: `StatCard`, `EmptyState`, `Sparkline`, `LineChart`, `MonthGrid`.
Specialized: `MedVialIcon`, `BodyDiagram` (front/back torso, tap zones), `BottomNav` (5 slots: Home / Calendar / Seal / History / Profile), `TimeRangeToggle`.

### Screen pattern

Repeated structure for every section:
```
EYEBROW LABEL          (11pt, all-caps, letter-spaced)
Hero Number            (32pt serif)
secondary caption      (14pt sans, muted)
[chart or list]
```

### Motion

220ms base transitions. Tap: scale to 0.97 over 100ms. Numbers count-up over 320ms when changing. No bounces, no confetti. Light haptic on save.

### Don'ts

No gradients except gold seal accents. No emojis as functional icons (Lucide + custom SVG only). No color-coded text without a pill (colorblind users need shape). No serif on inputs. No dark mode at MVP (tokens ready, but ship when approved).

---

## 4. Tech decisions

### Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Expo SDK 53+ (managed) | Fastest path to TestFlight; OTA via EAS |
| Language | TypeScript strict | Catches dose/unit math bugs at compile time |
| Navigation | Expo Router (file-based, typed) | Stable, deep-link-ready |
| State | Zustand | 2KB, no boilerplate; nothing async to cache without a backend |
| Persistence | `expo-sqlite` | Time-series data + queries |
| Charts | Victory Native XL (Skia-backed) | Performant, declarative |
| Animation | `react-native-reanimated` 3 | Required by Expo Router |
| Body diagram | `react-native-svg` | Vector + tap targets, no native module |
| Forms | `react-hook-form` + `zod` | Lightweight validation |
| Notifications | `expo-notifications` | Local-only; remote needs a server |
| Health | `react-native-health` | HealthKit integration (Phase 4) |
| Date | `date-fns` | Tree-shakeable |
| Icons | `lucide-react-native` | Stroke icons matching brand |
| Build | EAS Build + EAS Submit | Native part is hands-off |
| Test | Jest + RNTL (unit) · Maestro (E2E) | RN standard |

### Why no backend / no login

User said no login. Combined with: every feature works offline, health data is sensitive, we're a small team. A backend would buy us cloud sync and analytics. Defer until users ask.

When a backend is needed later: Sign-in with Apple → tRPC server on Vercel/Fly → Postgres on Neon → SQLite delta sync.

### Data model

Five SQLite tables:

- **medications** — name, preset_id, default dose/unit/route, frequency, half_life_hours, color_index, status (active/paused/archived)
- **injections** — medication_id, dose, unit, route, site_id, taken_at, scheduled_at, notes, soft-delete
- **measurements** — kind (weight/bmi/height), value, unit, taken_at, source (manual/healthkit), source_id (HK UUID for dedup)
- **body_sites** — lookup table, ~24 rows (region × side × view × route)
- **preferences** — single-row config (units, reminder time, flags, start weight, height)

Repository layer is the only thing talking to SQLite. Pure business logic in `domain/` (PK math, rotation, units).

### Pharmacokinetic model

The "Estimated Level" chart needs PK math. Two paths:

- **Path A — exponential decay** (recommended): `C(t) = sum over doses of D · e^(-k(t-t₀))` where `k = ln(2) / half_life`. One parameter per peptide. Accurate enough for trends.
- **Path B — one-compartment with absorption**: more accurate, requires bioavailability + absorption rate per peptide (often unpublished for non-FDA peptides).

Ship A. Label the chart "Estimated Level — for trends, not dosing." Add B in P5+ if a user requests it.

Half-life data: ship a curated JSON (`domain/peptides.ts`) with cited sources for 8–10 common peptides. Allow user override.

### Folder structure

```
peptide-lab/
├── mobile/                      # the new app
│   ├── app/                     # Expo Router routes
│   │   ├── (tabs)/              # Home, Calendar, History, Profile
│   │   ├── log-shot/            # modal flow (form, site)
│   │   ├── medications/         # list, new, [id]
│   │   ├── reports/             # level, progress
│   │   ├── onboarding/
│   │   └── settings/
│   ├── src/
│   │   ├── components/          # shared UI
│   │   ├── theme/               # tokens
│   │   ├── db/                  # schema + migrations
│   │   ├── repositories/        # data-access
│   │   ├── stores/              # Zustand
│   │   ├── services/            # notifications, healthkit, export
│   │   └── domain/              # pk, rotation, peptides, units
│   └── assets/
└── (existing landing-site files)
```

### Privacy

All data on-device by default. App Store privacy label: **Data Not Collected**. Disclaimer screen on first launch ("not a medical device, not medical advice, talk to a doctor"). No analytics SDK at launch.

---

## 5. Phasing

Six phases, no fixed dates. Solo-engineer estimates in calendar weeks for budgeting.

| Phase | Scope | Exit | Est |
|---|---|---|---|
| **0 — Foundation** | Expo scaffold, theme tokens, base components, Storybook, SQLite migrations | Every primitive renders on device; schema migrates clean | 1 wk |
| **1 — MVP single-med** | Onboarding · Today · Log Shot · History · Settings · CSV export · daily reminders · disclaimer | TestFlight build live, internal beta open, time-to-log <10s | 2 wk |
| **2 — Multi-med + body site** | Medications list · add/edit · multi-med Today · route + body-site picker · rotation insight · Calendar · color-coding | 3-medication user sees correct due-today, color coding, rotation suggestion | 2 wk |
| **3 — Progress + PK** | Weight/BMI Progress screen · PK model (Path A) · level chart with peak/trough/avg · Today sparkline | PK chart matches expected curves on test fixtures; no dropped frames at 90D | 2 wk |
| **4 — Apple Health + polish + App Store** | HealthKit read · iCloud sync (if approved) · onboarding polish · empty-state illustrations · screenshots · privacy policy · accessibility audit | App Store review submitted; cold start <2s; size <40MB | 1.5 wk |
| **5 — Post-launch** | Android · cloud sync · preset library expansion · iOS widget · Watch companion · CSV import | Each becomes its own spec when prioritized | — |

### Risks worth flagging

- **App Store rejects health-adjacent app for medical claims** — mitigate with disclaimer screen, careful copy, no "level recommendation" language.
- **PK model looks wrong-enough to be embarrassing** — ship with "for trends, not dosing" caveat; let users override half-life.
- **Body diagram art looks amateur** — commission editorial line illustration before Phase 2.
- **Local-only means users lose data on phone reset** — Phase 1 ships CSV export; Phase 4 ships iCloud sync.

---

## 6. Open questions

Decisions to lock. Recommendations are my read, not commitments.

### Block Phase 0

| # | Question | Recommendation |
|---|---|---|
| 1 | Subfolder name: `mobile/`, `tracker/`, `app/`? | `mobile/` — clearest, no collision |
| 2 | Wordmark: "PEPTIDE COMPANY" or "PEPTIDE CO."? | "PEPTIDE CO." — fits the mobile header |
| 3 | Same brand as the testing lab, or sub-brand? | Same brand at MVP; revisit if positioning conflicts |
| 4 | iOS only at MVP? | Yes through Phase 4 |

### Block Phase 2

| # | Question | Recommendation |
|---|---|---|
| 5 | Body diagram art source: custom, stock, or abstract regions? | Custom-drawn editorial line illustration (~$500–$1500 illustrator fee) |
| 6 | Site granularity: 12 / 24 / 40+ sites? | 24 — captures rotation patterns without overwhelming |

### Block Phase 3

| # | Question | Recommendation |
|---|---|---|
| 7 | PK model fidelity: exponential decay or one-compartment with absorption? | Exponential decay. Defer the harder model. |
| 8 | Half-life data sourcing: papers, manufacturer, community refs? | Curated JSON with cited sources; user override allowed |
| 9 | Therapeutic windows ("within expected range" copy)? | Drop it — regulatory risk on non-FDA peptides. Use trend language. |

### Block Phase 4

| # | Question | Recommendation |
|---|---|---|
| 10 | Cloud sync: iCloud (CloudKit) or login + backend? | iCloud at Phase 4. Login deferred indefinitely. |
| 11 | Export format: CSV, JSON, PDF? | CSV at Phase 1. JSON at Phase 4 (round-trip). PDF at Phase 5. |

### Strategic — affect direction, not blocking

| # | Question | Recommendation |
|---|---|---|
| 12 | Monetization: free / freemium / one-time / subscription? | Free at launch. Revisit after 6 months / 1k installs. Lean toward one-time + free iCloud sync for owners. |
| 13 | Analytics? | None at launch. Opt-in PostHog later if needed. |
| 14 | Onboarding: ask for current weight + height + reminder, or just reminder? | Current weight + height + reminder. No target weight (nag-app trap). |
| 15 | Notification copy tone? | Factual: "Tirzepatide · 2.5 mg" |
| 16 | Compliance copy review (lawyer)? | Healthtech lawyer for 2hr review in Phase 4 |
| 17 | Beta user pool? | Existing network + small Reddit recruit (r/Peptides) |
