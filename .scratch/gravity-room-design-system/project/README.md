# Gravity Room — Design System

> "For athletes who refuse to plateau."

A design system extracted from **Gravity Room** — a free, open-source
strength-training tracker built around the GZCLP linear-progression program.
It's a Bun monorepo with a Vite/React 19 web SPA, an Expo/React Native mobile
client, an ElysiaJS API, and a Python/FastAPI analytics service.

The brand voice is part **gym chalk and steel**, part **physics lab**: every
session you complete is "gravity you've conquered." The visual identity is the
inside of a dimly-lit chamber under a single gold lamp — very dark warm-black
surfaces, gold accents, condensed industrial display type, monospace data
labels. No gradients-for-gradient's-sake, no rounded pill chips, no emoji.
Borders, not shadows. Capitals, not sentence case (in the display tier).

## Sources

- **Codebase** (read-only, mounted): `gravity-room/` — see
  `gravity-room/README.md` and `gravity-room/CLAUDE.md` for the full app map.
- **GitHub**: [`rechedev/gravity-room`](https://github.com/rechedev/gravity-room)
- **Live app**: https://gravityroom.app
- **Discord**: invite link in the marketing footer

The system covers the **Web SPA** — the marketing landing page (`/`, `/en`)
plus the in-app tracker, dashboard, and program catalog (Vite + React 19 +
Tailwind 4 + TanStack Router). The mobile (Expo / React Native) client is
out of scope for this kit by design — its visual treatment is handled
separately.

---

## Index

| File / Folder | Purpose |
| --- | --- |
| `README.md` | You are here. Brand context, content + visual foundations, iconography. |
| `SKILL.md` | Agent skill manifest — how to use this kit when generating new artifacts. |
| `colors_and_type.css` | Color + type tokens + `@font-face` imports. Drop into any HTML. |
| `fonts/` | Self-hosted woff2: Bebas Neue, Barlow (400/500/600/700), JetBrains Mono variable. |
| `assets/` | Logos, hero/feature webp imagery, pattern texture. Copied verbatim from the web `public/`. |
| `preview/` | Per-token HTML cards rendered in the Design System tab. |
| `ui_kits/web/` | High-fidelity click-thru recreation of the Gravity Room web product. |

### What's in `ui_kits/web/`

- `index.html` — entry point. Boots React, imports the design tokens, renders the SPA.
- `styles.css` — Tailwind-free port of the kit's component classes (buttons, badges, KPIs, sidebar, etc.).
- `primitives.jsx` — `Button`, `Badge`, `Eyebrow`, `SectionLabel`, `Field`, `KpiCard`, `ProgramCard`, `SetCell`, `ProgressBar`.
- `chrome.jsx` — `Nav`, `Footer`, `Sidebar`, `Topbar`, `AppShell`, plus the Discord/GitHub inline SVGs.
- `screens/Landing.jsx` — marketing landing (Hero → Features → How It Works → CTA → Footer).
- `screens/SignIn.jsx` — centered sign-in card with magic-link affordance.
- `screens/Dashboard.jsx` — KPI row, recent-sessions table, "up next" workout panel.
- `screens/Programs.jsx` — catalog grid of `ProgramCard`s (strength / hyper / power).
- `screens/Tracker.jsx` — live workout: header KPIs, exercises with tappable set grids, progress bar.
- `App.jsx` — top-level router (hash-driven, `landing | signin | dashboard | programs | tracker`).

---

## CONTENT FUNDAMENTALS

**Tone.** Direct, declarative, no hedging. Like a coach who's tired of
explaining why your spreadsheet routine isn't working. Short imperative
sentences are the default.

**Casing.**
- Display headings (Bebas Neue) are written **mixed-case** but rendered in
  small-caps-like uniformity by the typeface itself — `"Train Smarter."`,
  `"Three Steps. That's It."`. Never SHOUTY all-caps in source; let the font
  do that.
- Eyebrows / labels / section markers are **UPPERCASE** with `letter-spacing:
  0.2em–0.3em`, set in JetBrains Mono at 10–11px. Examples: `FEATURES`,
  `100% FREE · SYNCS ACROSS DEVICES`, `KPI · STREAK`.
- Body copy is normal sentence case.
- Buttons are **UPPERCASE** mono with wide tracking: `GET STARTED →`.

**Pronouns.** "**You**" exclusively. Never "we." Never "I." The product
is the second voice in a coach/athlete dialog: *"You just show up and train.
The app decides when to add weight."*

**Punctuation tics.**
- The em-dash `—` separates two clauses where a period would be too hard.
  *"Real data — not guesses."*
- The bullet `·` separates short metadata phrases.
  *"100% Free · Syncs Across Devices."*
- The arrow `→` lives in every CTA. `Get Started →`, `Sign In →`,
  `See all 7 programs →`.
- The period after a fragment is intentional: *"That's It."*

**Vibe.** Brutalist-fitness meets indie-PWA. Confident, slightly poetic
("every extra kilo on the bar is gravity you've conquered"). No corporate
softeners — never "we're excited to," never "love," never "❤️."

**Bilingual.** The product ships Spanish-first (`/`) and English (`/en`).
Spanish copy is equally direct: *"Deja de adivinar en el gimnasio."* — *"Stop
guessing at the gym."* Translations are 1:1 in tone, not literal.

**No emoji.** None. The brand uses iconography (custom webp glyphs) where
other apps would reach for an emoji. The single ornamental character allowed
is the arrow `→`.

**Sample copy (lifted verbatim):**
- Hero: `Train Smarter. / Progress Faster.`
- Hero subtitle: `Stop guessing at the gym. Follow proven programs that
  automatically adjust weight, sets, and reps — so every session moves you
  forward.`
- Feature title + body: `Smart Progression — The app decides when to add
  weight and how to handle failure. You just show up and train.`
- Final CTA: `Ready to raise the gravity? / Enter the Gravity Room. / Start
  Training Today.`
- Footer tagline: `For athletes who refuse to plateau.`

---

## VISUAL FOUNDATIONS

### Color

**Mood.** Warm black. Not pure `#000`. Every neutral is biased toward orange
(`#0b0906` body, `#130f09` cards, `#1a1410` table-header). The single accent
is gold `#e8aa20` — used for the brand wordmark, primary buttons, the
title-text fill, progress-bar glow edges, and the gold ring on hover.

**Semantic pairs.**
- Surfaces: `body` / `card` / `header` / `th` get progressively warmer as you
  go up the elevation stack. Cards sit *darker* than the body in only one
  case (the `header` band); usually the card is one shade lighter.
- Text: `--color-main` `#f0e8d8` (warm cream) for body, `--color-title`
  `#f0c040` (gold) for headings, `--color-muted` `#8a7a5a` (sand) for hints,
  `--color-label` `#a89870` for slightly-stronger labels.
- Status: `--color-ok` is olive-green `#6aaa3a`, `--color-fail` is dusty red
  `#c05050`. Both have matching `-bg` and `-ring` tokens — every status badge
  is `bg + 1px ring + bold text`, never solid-fill.
- Stages (lift tiers): `--color-stage-1 #f0e8d8` cream, `--color-stage-2
  #f07000` orange, `--color-stage-3 #d02020` red. T1 → T3 in the GZCLP
  program.
- Catalog categories: strength `#4a90d9`, hypertrophy `#9b59b6`, powerlifting
  `#e05050`. Used as 8% gradient washes at the top of program cards plus the
  badge stroke + text.

### Type

- **Display — Bebas Neue 400.** Hero headlines (clamp 72→140px), section
  headlines (clamp 40→72px), card titles (24–30px). Letter-spacing
  `0.02em–0.04em`. The font is condensed and shouts; treat one display
  element per layout block.
- **Body — Barlow 400/500/600/700.** Reading text (14–16px), button labels
  when not mono. Line-height 1.5–1.7.
- **Mono — JetBrains Mono variable.** All eyebrows, labels, badges, KPI
  legends, button text on every CTA, table data. 10–12px with tracking
  `0.15em–0.3em`.
- **Stat numbers.** `font-display-data` — Bebas Neue but with tighter
  `0.02em` tracking, used for KPIs (e.g. `80 kg`, `+10 kg`, streak counts).

### Spacing & layout

- 4px-step Tailwind scale (`4 8 12 16 20 24 32 40 48 64 80`). The web app
  composes pages around 24/32/64/80 vertical rhythm (`py-14 sm:py-20` is the
  standard section pad).
- Max content width is `5xl` (1024) for marketing, `4xl` (896) for the
  centered-hero variant.
- Multi-column grids use `gap-px` over `bg-rule` — i.e. cards live on a
  1px-wide grid line that *is* the border. No outer card border + no inner
  padding on the grid.

### Backgrounds

- **Solid warm-black body**, never gradients-as-page-background.
- **Pattern texture** (`assets/pattern-bg.webp`) used very sparingly behind
  hero blocks at low opacity.
- **Grain overlay** — fixed-position SVG fractal noise at `opacity: 0.028`
  applied over the whole page. Adds the analog/film feel.
- **Radial gold glow** — `radial-gradient(ellipse, rgba(232,170,32,0.08–0.12),
  transparent 65%)` placed under hero text and behind imagery. Never a
  linear gradient; always radial, low alpha.
- **Edge-glow top rule** — `linear-gradient(90deg, transparent, rgba(232,170,
  32, 0.5), transparent)` 1px tall, animates in on card hover.
- **Hero imagery** is photo-real, warm-toned, slightly desaturated. Webp.

### Animation

- **Easings.** `--ease-out-expo (0.16, 1, 0.3, 1)` for everything entering;
  `--ease-standard (0.4, 0, 0.2, 1)` for state changes; `--ease-emphasized
  (0.2, 0, 0, 1)` for emphasis. No bounce.
- **Durations.** `instant 120ms`, `fast 180ms`, `base 240ms`, `slow 320ms`.
  Most UI uses `fast`; entrances use `slow`.
- **Patterns.** `fadeSlideUp` (8px translateY + opacity) is the canonical
  entrance. `pop-in` (scale 0.85 → 1) for badges/dots. `dropdown-enter` is
  translateY(-4px) + scale(0.97). Hovers are 200–250ms.
- `prefers-reduced-motion: reduce` cuts all transitions to 0.01ms.

### Hover & press

- **Cards.** Border lifts `--color-rule` → `--color-rule-light`, shadow grows
  to `--shadow-card-hover` (which adds a faint gold inset ring), interactive
  cards translateY(-1 to -4px). The `landing-card-glow` adds a 1px gold
  edge-glow line at the top.
- **Buttons.** Default outline button: hover *fills* with gold and inverts to
  black text — the gold is so saturated this reads as press feedback. Active
  state is `scale(0.97)`. Primary (already gold) hover is `opacity: 0.9`.
- **Nav links.** Underline slides in via `transform: scaleX(0 → 1)` from
  center. 250ms expo-out.

### Borders, radii & shadows

- **Borders are the structure.** Almost every element has a 1–2px border,
  usually `--color-rule` `#2a2218`. Borders darken on idle and brighten to
  `--color-rule-light` on hover.
- **Radii are tiny.** `rounded-sm` (2px) is the default. `rounded` (4px)
  rare. Pills (`rounded-full`) only appear on the brand logo and the small
  pulse-dots inside badges. **No rounded cards, no rounded buttons.**
- **Shadows.** Five-stop system from `--shadow-card` (subtle 1+6px) up to
  `--shadow-dialog` (32+60px + gold ring). The "glow" shadows
  (`--shadow-glow-gold`, `-success`, `-fail`) are 12–20px halos at low alpha.
- **Inset shadow.** `--shadow-inset-subtle` `inset 0 1px 0 rgba(255,255,255,
  0.02)` adds a 1px sheen on top of every card — a chrome-on-metal trick.

### Transparency & blur

- Modal backdrops: `rgba(0,0,0,0.6)` + `backdrop-filter: blur(4px)`.
- Sticky nav after scroll: `bg-header/95` + `backdrop-blur-md`.
- Disabled controls: `opacity: 0.25`. (Aggressive — the system wants
  unavailable to look really unavailable.)

### Imagery vibe

Warm, dim, masculine, slightly cinematic. Hero photo is gold-light-on-black
gym equipment. The `feature-*.webp` and `howit-*.webp` icons are tiny stylized
3D-ish glyphs (orange/gold on dark) — they look hand-rendered, not stock.
Empty states (`empty-dashboard.webp` etc.) are warm illustrations of bare
gym scenes. Black-and-white never used; everything is in the warm-amber
spectrum.

### Layout rules

- Sticky transparent top nav that fades to opaque after `scrollY > 80`.
- Vertical hairline rules at `8%` left/right gutters on the hero — half-faded
  via gradient masks. A signature flourish.
- Section labels are full-width hairlines with the label text centered:
  `<hr> LABEL <hr>`.
- Sections always re-introduce: eyebrow → display heading → 1-line subtitle
  → grid of cards.

---

## ICONOGRAPHY

Gravity Room **does not** use an icon font (no Lucide, no Heroicons, no
Material). The brand makes a deliberate choice:

1. **Brand-glyph webp imagery.** The four "feature" icons and three
   "how it works" icons are bespoke webp assets in `assets/feature-*.webp`
   and `assets/howit-*.webp` — small (48–96px) stylized renders rather than
   line icons. They render as `<img>`, not as inline SVG. This keeps weight
   low and lets the brand be illustrative where icon fonts would be generic.
2. **Inline SVG for the two third-party brand marks** — Discord and GitHub.
   These are hand-hardcoded as `<path>` data inside `shared.tsx` and reuse
   `currentColor`, so they tint to whatever surface they sit on.
3. **Status / decorative glyphs are unicode characters.** `→` (U+2192) is
   the universal CTA tail. `↑ ↓ →` mark trends in KPI cards. `✓` marks
   completed sets in the tracker grid.
4. **Numerals as iconography.** Step indicators are giant Bebas Neue
   numbers (`01 / 02 / 03`) in gold — the type *is* the icon.

**Emoji are explicitly never used.** Even in casual surfaces.

**Substitutions in this kit.** None — every brand asset was copied verbatim
from `gravity-room/apps/frontend/web/public/`. The Discord/GitHub SVGs are
the same `<path>` strings as the original. If you need an additional icon
not present in the brand kit (e.g. a settings gear, a chevron beyond `→`),
substitute from **Lucide** (stroke-based, 1.5–2px weight) and tint with
`currentColor` so it inherits the warm-cream/gold palette. Flag the
substitution in your output.

---

## SUBSTITUTIONS / OPEN QUESTIONS

- ✅ All web fonts copied — no Google Fonts fallback needed.
- ✅ All raster assets copied verbatim from web `public/`.
- ✅ Web-only scope — mobile client is intentionally out of frame.
- ⚠ No bespoke component library exists in the codebase beyond the
  hand-rolled `Button`, `KpiCard`, etc.; this kit reproduces the patterns
  rather than wrapping a Headless UI / Radix install.
