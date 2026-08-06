# The Great American Peptide Company — Design System

> Visual language inspired by the TrumpCard.gov aesthetic: gold-foil luxury, patriotic palette, bold typography, minimal-but-prestigious landing-page feel. Designed for a domestic American testing lab brand that telegraphs quality, tradition, and national pride.

---

## 1. Brand Concept

**Name candidates:**
- The Great American Peptide Company
- The Great American Testing Lab

**One-line:** American-made, rigorously tested peptides. Quality you can see.

**Voice:** Confident, declarative, patriotic without cheese. "Built here. Tested here. Period."

**Aesthetic anchor:** gold foil on navy. Old-money political memorabilia meets modern SaaS landing page. Think: a presidential medallion redesigned by Stripe.

---

## 2. Color Tokens

### Primary

| Token | Hex | Use |
|---|---|---|
| `--color-gold` | `#D4AF37` | Hero card foil, CTAs, accents, seals |
| `--color-gold-deep` | `#B8860B` | Hover states, shadows on gold elements |
| `--color-gold-highlight` | `#F4D57A` | Gradient highlights, shine effects |
| `--color-navy` | `#002868` | Primary background, hero, headings on cream |
| `--color-red` | `#BF0A30` | Alert CTAs, accents, flag elements |
| `--color-cream` | `#FFF8E7` | Body background, cards on dark |
| `--color-ink` | `#0A0A0A` | Body text on light backgrounds |
| `--color-parchment` | `#F5EBD0` | Aged-paper feel for mid-grounds |

### Gold foil treatment

Gold should feel **metallic**, not flat. Always use a gradient:

```css
--gradient-gold-foil: linear-gradient(135deg, #F4D57A 0%, #D4AF37 45%, #B8860B 100%);
```

For extra shimmer on hero elements, layer a subtle radial highlight on top.

---

## 3. Typography

### Stacks

Using **free Google Fonts equivalents** to the Trump-era Gotham + Impact style:

```css
--font-display: "Oswald", "Impact", "Arial Black", sans-serif;   /* condensed, bold, political-rally energy */
--font-heading: "Montserrat", "Gotham", "Helvetica", sans-serif; /* geometric, clean, confident */
--font-body:    "Inter", "Helvetica Neue", system-ui, sans-serif;/* readable, modern */
--font-serif:   "Playfair Display", "Didot", Georgia, serif;     /* gravitas on certificates, seal text */
--font-script:  "Great Vibes", "Caveat", cursive;                /* signature / hand-signed feel */
```

### Scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `--text-hero` | 88px / 5.5rem | 700-800 | Landing hero only |
| `--text-h1` | 56px / 3.5rem | 700 | Section headlines |
| `--text-h2` | 40px / 2.5rem | 700 | Subsections |
| `--text-h3` | 28px / 1.75rem | 600 | Cards |
| `--text-body-lg` | 20px / 1.25rem | 400 | Hero body |
| `--text-body` | 17px / 1.0625rem | 400 | Default |
| `--text-small` | 14px / 0.875rem | 500 | Meta, captions |
| `--text-eyebrow` | 13px / 0.8125rem | 700 | All-caps labels, letter-spaced 0.15em |

### Rules

- Hero headlines in **Oswald** (condensed, rally-poster energy): `THE GREAT AMERICAN PEPTIDE COMPANY`
- Subheads in **Montserrat** Bold
- Body in **Inter** — never use a condensed font for paragraphs
- Signatures, trust marks, "Signed by..." in **Great Vibes** script
- Certificate / official-document text in **Playfair Display**

---

## 4. Spacing & Layout

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
--space-16: 64px;
--space-24: 96px;
--space-32: 128px;

--container-narrow: 720px;    /* marketing copy */
--container: 1080px;          /* default */
--container-wide: 1280px;     /* hero sections */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 16px;
--radius-card: 18px;          /* matches credit-card corner radius */
```

Generous vertical padding on sections: **96–128px** top/bottom. Landing pages should breathe.

---

## 5. Signature Components

### 5.1 The Gold Card (hero centerpiece)

The visual anchor of the whole brand. A credit-card-sized gold foil element, slightly tilted, with embossed typography.

```
┌──────────────────────────────────────────┐
│  ⭐                                       │
│       THE GREAT AMERICAN                  │
│       PEPTIDE COMPANY                     │
│                                           │
│       ━━━━━━━━━━━━                        │
│       99.8% PURE · TESTED IN USA          │
│                                           │
│       [ signature ]                       │
└──────────────────────────────────────────┘
```

**Specs:**
- Aspect ratio: 1.586:1 (ISO 7810 credit card)
- Background: `--gradient-gold-foil`
- Border: 2px solid `--color-gold-deep`
- Shadow: `0 24px 60px -12px rgba(212, 175, 55, 0.4)`
- Embossed text effect: dark text with inset shadow
- Rotate: `transform: rotate(-4deg)` at rest, `rotate(0)` on hover
- Include a 5-point star, brand mark, lot number, signature

### 5.2 Buttons

**Primary CTA (gold foil):**
```css
.btn-primary {
  background: var(--gradient-gold-foil);
  color: var(--color-navy);
  font-family: var(--font-heading);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 18px 36px;
  border: 2px solid var(--color-gold-deep);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.35);
  transition: transform 150ms, box-shadow 150ms;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(212, 175, 55, 0.5);
}
```

**Secondary CTA (navy on cream):**
- Navy background, cream text, same dimensions, no gradient

**Ghost CTA:** transparent + 2px navy border, becomes filled on hover.

### 5.3 Eyebrow / Trust Badge

All-caps, letter-spaced, small:

```
★ CERTIFIED 99.8% PURE · LOT #GAPC-2026-A041
```

### 5.4 Sections

- **Hero:** navy background, cream headline, gold card floating right, subtle star-field texture at 5% opacity
- **Feature:** cream background, navy headline, red accents on stats
- **Certificate-style:** parchment background, Playfair display, wax-seal style gold medallion

### 5.5 Star & Stripe Motifs

- **5-point star** as repeating background element, low opacity (`rgba(212,175,55,0.06)`)
- **Stripe border:** alternating red/white 4px stripes as section dividers
- **Eagle silhouette:** monochrome gold, used sparingly as watermark behind certificates

**Rule:** never more than ONE loud patriotic element per viewport. One gold card, OR one eagle, OR one flag-stripe border. Stacking them reads as parody.

---

## 6. Imagery

- **Lab photography:** hyper-clean, high-contrast. Scientist hands on HPLC equipment. Vials in row. Always with **warm gold tungsten** white balance, never cool blue clinical.
- **American product shots:** peptide vial on reclaimed wood or polished brass, American flag softly out of focus behind.
- **No stock photos of generic lab coats.** Commission or buy specific shots.
- **Certificates:** mimic real US government certificate aesthetics — ornate border, serial number, embossed seal.

---

## 7. Voice Examples

**Headline voice:**
- ✅ "Tested in America. Period."
- ✅ "Every lot. Every peptide. Verified."
- ✅ "The standard you can actually see."
- ❌ "Leveraging AI-driven analytics to optimize peptide QC outcomes"

**Body voice:**
- Short sentences. Periods, not commas.
- Declarative, not hedging.
- Specific numbers over adjectives: "99.8% pure" > "high purity"

---

## 8. Don'ts

- No flat yellow pretending to be gold — always use the gold-foil gradient
- No blue gradients. Navy is flat.
- No rounded buttons (pill shapes). Use sharp or slightly rounded corners (4–8px).
- No Comic Sans patriotism. No clipart eagles.
- No gradient text on body copy — gold gradients ONLY on CTAs and the gold card
- No more than 2 type families per page (one display + one body)

---

## 9. File Inventory

```
peptide-lab/
├── design-system.md      ← this file
├── tokens.css            ← CSS custom properties (ready to import)
└── index.html            ← example hero section using the system
```

See `tokens.css` for copy-paste CSS variables and `index.html` for a working reference implementation.
