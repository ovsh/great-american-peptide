---
version: 1
slug: "mobile-app-tabs-index-tsx"
primary_target: "mobile/app/(tabs)/index.tsx"
related_targets: []
---

Scope and mode: Redesign the existing iOS Today screen in Operate mode. Keep the Poke visual identity, routes, data model, medical position, and bottom navigation.

Audience and job: A person checks the app before or after a scheduled injection. They must select the correct medication, understand the next-shot state, and log a due shot in seconds.

Primary outcome: The next-shot state and action are the first clear task. A user with several medications can scan and switch without paging full cards. Weight and side effects stay available as secondary logging actions.

Proof and content: Use only active medications, saved schedules, logged injections, saved weight, saved side effects, and level estimates from logged shots with a cited half-life. Free and Pro use the same real chart calculation.

Chosen direction: Use a dense horizontal medication rail with several items visible and the next item peeking. The selected medication card is compact and high contrast. It uses no large bottle. A due shot gets one green action band across the full card bottom. The estimated-level card follows. Free blurs the real chart behind one centered Poke Pro action. Pro shows exact values and a Details action. Track today is one card with two rows.

Memorable moment: The due state reads as one compact block that ends in a full-width Log shot action. The premium preview keeps the real curve visible as shape, but hides its exact values.

States: No medication, one medication, many medications, due, upcoming, logged today, unscheduled, no shots, no cited half-life, Free, Pro, saved weight, no weight, saved side effect, and no side effect.

Constraints: Use mobile-safe areas and 44-point targets. Show chart labels without hover. Do not expose blurred exact values to accessibility services. Do not change `mobile/src/domain/`. Do not add fake data. Keep absolute routes. Support narrow iPhone widths and the current 600-point content cap.

Anti-goals: No dashboard grid, no pager dots, no giant vial art, no full-screen paywall, no blurred next-shot task, no dose recommendation, and no urgent Log shot action for a future scheduled dose.

Open decisions: None. The user approved the structure through the reference and generated-image rounds, then asked for autonomous execution.
