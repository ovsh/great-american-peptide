# Order Flow — Bring-Up Runbook

How to take this landing page from `mailto:` lead capture to a real, paid order flow modeled on Janoshik's catalog → cart → mail-in → public verify URL pattern.

## Architecture

| Surface | Domain | Stack | Owner |
|---|---|---|---|
| Marketing landing | `peptide.industries` | Static `index.html` (this repo), deployed Vercel/Netlify | this repo |
| Storefront + checkout + ops | `shop.peptide.industries` | Shopify Basic (default theme, lightly skinned) | Shopify admin |
| COA verify URLs (Phase 2) | `verify.peptide.industries` | Static + Cloudflare Worker / Vercel route | separate repo |

Reasoning: the bespoke navy/red/cream/gold-foil aesthetic on the landing is the brand's biggest asset — porting it into Liquid would lose fidelity for weeks of work. Shopify earns its keep on checkout, payments, customer accounts, legal-page generation, refunds, email, and order admin. We graft it on at a subdomain.

## Phase 1 — Cards-only checkout

### 1. Shopify store (no code)

1. Sign up Shopify Basic, store name **The Great American Peptide Co.**
2. Create three products. Use **qty-1 pricing** for launch — defer volume tiers.

   | Product | Price | Description framing |
   |---|---|---|
   | Peptide Purity Test | $200 | "Identity & purity by HPLC-UV. We tell you what's in the vial and how clean it is." |
   | Endotoxin Test | $300 | "Pharmacy-grade bacterial contamination screen." |
   | Peptide Purity + Endotoxin Combo | $325 | "Both tests on one sample. Save $175 vs ordering separately." |

   Product copy frames the offer as **analytical testing services**, never as peptide sales. (Avoids Shopify Payments / Stripe friction on "research chemicals.")

3. Each product: one variant option named **Peptide**. Seed dropdown values:
   `Semaglutide, Tirzepatide, Retatrutide, BPC-157, TB-500, Ipamorelin, CJC-1295, GHK-Cu, MOTS-c, NAD+, Selank, Epitalon, Other (specify in order notes)`
4. Tax: most US states treat B2B research lab services as non-taxable. Default to **no tax** until accountant confirms otherwise.
5. Payments: enable **Shopify Payments**. Adds cards + Apple Pay + Shop Pay + Google Pay automatically. If Shopify Payments rejects onboarding, fall back to **Stripe** (same outcome).
6. Auto-generate legal pages from Shopify settings → Policies. Then hand-edit each:
   - **Refund Policy** — clarify refunds only before sample arrives at lab.
   - **Privacy Policy** — keep generic.
   - **Terms of Service** — add: customer affirms legal possession of the sample, results pertain only to the sample provided, no medical-device claims.
   - **Shipping Policy** → rename to **Sample Submission Policy**. Include: mailing address, packaging requirements, "do not include personal info on the vial," chain-of-custody language.
7. Customize **Order confirmation** email (Shopify admin → Notifications): include the **lab mailing address** and intake instructions ("write your order # on the vial, ship USPS First-Class to …").
8. Custom domain: point `shop.peptide.industries` at Shopify (Settings → Domains → Connect existing).

### 2. Wire the landing page to Shopify

The landing's Order CTAs already point at canonical Shopify product URLs:

```
https://shop.peptide.industries/products/peptide-purity-test
https://shop.peptide.industries/products/endotoxin-test
https://shop.peptide.industries/products/peptide-combo-test
```

When you create the products in step 1 with the names above, Shopify mints exactly these URLs. **No code change needed** — once the store is live and the domain is connected, every CTA on the landing page works.

If Shopify assigns different handles, either rename them in Shopify admin or update the three `<a href>` values in [`index.html`](index.html) (search for `shop.peptide.industries/products`).

### 3. Footer legal links

The landing footer has placeholder links pointing at:

```
https://shop.peptide.industries/policies/terms-of-service
https://shop.peptide.industries/policies/privacy-policy
https://shop.peptide.industries/policies/refund-policy
```

Shopify generates pages at exactly these paths once the policies in step 1.6 are saved. No code change needed.

### 4. Sample-intake ops (Shopify admin only)

- Use Shopify **Order tags** for sample status: `received` → `running` → `reported`.
- Workflow per order:
  1. Customer orders → Shopify confirmation email arrives with mailing address.
  2. Sample arrives at lab → tag `received`, log to ops sheet.
  3. Lab tests → tag `running`.
  4. Result ready → upload to verify system (Phase 2), tag `reported`, customer auto-emailed the verify URL.
- Use Shopify Email or Klaviyo (free tier ≤500 contacts) for the tag-triggered email.

### Verification before launch

1. Open `index.html` locally → click each Order button → confirm Shopify product page loads on each of the 3 SKUs.
2. Run a real $200 order through checkout end-to-end (yourself, real card). Confirm:
   - Order confirmation email arrives.
   - Mailing address + intake instructions are in the email body.
   - Order shows in Shopify admin with the peptide variant correctly captured.
   - Tag transitions work.
3. Visit each policy page (`/policies/terms-of-service`, `/policies/privacy-policy`, `/policies/refund-policy`, `/policies/shipping-policy`) — confirm hand-edits landed.
4. Mobile pass at 375px on `peptide.industries` — confirm the 3-card SKU picker stacks cleanly and the masthead overflow fix from `7a8752b` still holds.
5. Run Lighthouse — performance shouldn't regress more than ~5 points from pre-Shopify baseline (we haven't added any JS, only outbound links, so should be ~0 regression).

## Phase 2 — Public COA verify URLs (P1)

Standalone surface at `verify.peptide.industries`. Mirrors Janoshik's `/verify/{id}` pattern: each report gets an unguessable URL, customer gets it via email, can share with downstream buyers.

- Single Cloudflare Worker or Vercel route: `/r/{report_id}` reads from KV / D1 / Postgres and renders the COA in the same visual style as the chromatogram mock in [index.html:1561-1634](index.html:1561). Reuse that SVG template so the public report looks like the landing page promises.
- Each report: order #, peptide name, lot, test type, signed PDF link, HPLC trace data, timestamp, lab signature, accreditation number.
- Public-by-link auth model (no user accounts). UUIDv4 IDs.
- Lab tech uploads via a tiny admin form (HTTP basic auth is fine until volume justifies real auth).

Decoupled from Shopify on purpose — verify URLs are a long-lived public surface that should outlive any e-commerce platform choice.

## Phase 3 — Crypto payments (P1)

Add Coinbase Commerce or NOWPayments as a second checkout method in Shopify. ~15 minute setup, no code, accepts BTC / USDT / USDC. Ship after Phase 1 has processed ~10 card orders cleanly.

## Out of scope (intentionally)

- Customer accounts / login (verify URLs are link-based, no auth)
- Volume pricing tiers (6+, 11+, 16+, 21+) — flat-rate launch, add tiers when demand shows
- Custom Liquid theme — Shopify default theme is fine for the ≤60s the customer spends in checkout
- HPLC chromatogram auto-generation — Phase 2, lab tech uploads pre-rendered PDFs/data
