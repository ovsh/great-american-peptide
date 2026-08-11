# Poke design docs

Guidance, not history. These four files are the design system as it was settled during the
Today-screen redesign of version 1.2.2 (August 2026). They are written so that an agent who has
read nothing else can design a new Poke screen correctly.

Read in this order:

| File | Answers |
|---|---|
| [`principles.md`](principles.md) | What a Poke screen must be, and what it may never do. |
| [`motion.md`](motion.md) | Which token every animation uses, and how much motion is allowed. |
| [`copy.md`](copy.md) | How Poke writes words. |
| [`process.md`](process.md) | How a redesign is run: rounds, mockups, models, gates. |

Tokens are code, not documentation: `src/theme/colors.ts`, `spacing.ts`, `typography.ts`,
`motion.ts`. Never restate a token value in a component; import it.

The reference implementation of every rule in these files is the Today screen:
`app/(tabs)/index.tsx` and `src/components/today-*.tsx`.
