# Gravity Room — Design system

Captured read-only from project source. Default theme is **Oro** (forged-iron dark); the
**classic-light** skin re-declares the same semantic tokens so utilities re-theme without
component changes.

Sources read:

- `gravity-room/packages/design-tokens/src/tokens.ts` — shared source for the mobile app and the web dark theme.
- `gravity-room/apps/frontend/web/src/styles/tokens.css` — generated from `tokens.ts` (`@theme`).
- `gravity-room/apps/frontend/web/src/styles/globals.css` — web-only `@theme` tokens, the classic-light skin, component classes, `@font-face`.
- `gravity-room/apps/frontend/web/src/components/button.tsx` — Button variants and sizes.
- `gravity-room/apps/frontend/web/scripts/generate-tokens-css.ts` — how `tokens.css` is generated.

---

## Colors — Oro (default dark)

### Surfaces

Source: `apps/frontend/web/src/styles/tokens.css`

| Token                    | Value     | Usage                           |
| ------------------------ | --------- | ------------------------------- |
| `--color-body`           | `#111110` | App canvas / page background    |
| `--color-card`           | `#1c1c1a` | Card and panel surface          |
| `--color-surface-2`      | `#272724` | Raised surface / secondary fill |
| `--color-header`         | `#141413` | Header / tooltip background     |
| `--color-ink`            | `#0a0908` | Deepest ink surface             |
| `--color-th`             | `#272724` | Table header cell               |
| `--color-hover-row`      | `#272724` | Hovered table row               |
| `--color-progress-track` | `#272724` | Progress bar track              |
| `--color-error-bg`       | `#2c0806` | Error surface background        |
| `--color-tooltip-bg`     | `#141413` | Tooltip background              |

### Text

Source: `apps/frontend/web/src/styles/tokens.css`

| Token                  | Value     | Usage                   |
| ---------------------- | --------- | ----------------------- |
| `--color-main`         | `#ebe7e0` | Primary body text       |
| `--color-title`        | `#ebe7e0` | Titles                  |
| `--color-heading`      | `#ebe7e0` | Headings                |
| `--color-muted`        | `#b7b7ab` | Secondary text          |
| `--color-label`        | `#96968b` | Labels / muted captions |
| `--color-info`         | `#96968b` | Info text               |
| `--color-error`        | `#e86154` | Error text              |
| `--color-tooltip-text` | `#ebe7e0` | Tooltip text            |

### Borders

Source: `apps/frontend/web/src/styles/tokens.css`

| Token                | Value     | Usage                        |
| -------------------- | --------- | ---------------------------- |
| `--color-rule`       | `#30302c` | Hairline rule / divider      |
| `--color-rule-light` | `#45453e` | Stronger rule / hover border |
| `--color-error-line` | `#602a25` | Error border                 |

### Accent (gold is the scarce signal)

Source: `apps/frontend/web/src/styles/tokens.css`

| Token                     | Value     | Usage                                     |
| ------------------------- | --------- | ----------------------------------------- |
| `--color-accent`          | `#eab53b` | Primary accent / current action           |
| `--color-accent-hover`    | `#f8c64e` | Accent hover                              |
| `--color-accent-deep`     | `#aa7d25` | Deep accent / default-button hover border |
| `--color-accent-dim`      | `#5e4925` | Dim accent / selection background         |
| `--color-on-accent`       | `#0a0704` | Text/icon on accent                       |
| `--color-btn-ring`        | `#eab53b` | Button focus ring                         |
| `--color-btn`             | `#1c1c1a` | Button surface                            |
| `--color-btn-text`        | `#eab53b` | Button text                               |
| `--color-btn-active`      | `#eab53b` | Active button surface                     |
| `--color-btn-active-text` | `#0a0704` | Active button text                        |
| `--color-victory`         | `#eab53b` | Victory / success CTA surface             |
| `--color-victory-on`      | `#0a0704` | Text on victory                           |

### Semantic / state

Source: `apps/frontend/web/src/styles/tokens.css`

| Token             | Value     | Usage            |
| ----------------- | --------- | ---------------- |
| `--color-online`  | `#66ba7a` | Online indicator |
| `--color-ok`      | `#66ba7a` | Success          |
| `--color-ok-bg`   | `#0f2416` | Success surface  |
| `--color-fail`    | `#e86154` | Failure          |
| `--color-fail-bg` | `#2c0806` | Failure surface  |
| `--color-warn`    | `#ed990e` | Warning          |

### Web-only Oro additions

Source: `apps/frontend/web/src/styles/globals.css` (`@theme`)

| Token                    | Value                     | Usage                      |
| ------------------------ | ------------------------- | -------------------------- |
| `--color-changed`        | `oklch(0.22 0.04 70)`     | Changed-value highlight    |
| `--color-victory-glow`   | `oklch(0.8 0.145 84 / 0)` | Victory glow (transparent) |
| `--color-ok-ring`        | `oklch(0.36 0.06 150)`    | Success ring               |
| `--color-fail-ring`      | `var(--color-error-line)` | Failure ring               |
| `--color-stage-1`        | `var(--color-main)`       | Stage 1                    |
| `--color-stage-2`        | `oklch(0.68 0.16 50)`     | Stage 2                    |
| `--color-stage-3`        | `oklch(0.58 0.21 25)`     | Stage 3                    |
| `--color-chart-grid`     | `var(--color-rule)`       | Chart grid                 |
| `--color-chart-text`     | `oklch(0.52 0.015 75)`    | Chart text                 |
| `--color-chart-line`     | `var(--color-accent)`     | Chart line                 |
| `--color-chart-ok`       | `var(--color-ok)`         | Chart success              |
| `--color-chart-fail`     | `var(--color-fail)`       | Chart failure              |
| `--color-chart-pr`       | `var(--color-accent)`     | Chart PR marker            |
| `--color-heat`           | `oklch(0.42 0.07 84)`     | Heatmap "trained" fill     |
| `--color-sidebar`        | `var(--color-header)`     | Sidebar surface            |
| `--color-sidebar-active` | `var(--color-card)`       | Active sidebar item        |
| `--color-sidebar-border` | `var(--color-rule)`       | Sidebar border             |

---

## Colors — classic-light skin

Source: `apps/frontend/web/src/styles/globals.css` (`html[data-theme='classic-light']`)

Warm paper, charcoal type, forged-gold accent. `color-scheme: light`.

### Surfaces

| Token                    | Value                  |
| ------------------------ | ---------------------- |
| `--color-body`           | `oklch(0.97 0.008 85)` |
| `--color-card`           | `oklch(1 0.002 85)`    |
| `--color-surface-2`      | `oklch(0.94 0.012 85)` |
| `--color-header`         | `oklch(0.955 0.01 85)` |
| `--color-ink`            | `oklch(0.22 0.02 70)`  |
| `--color-th`             | `oklch(0.94 0.012 85)` |
| `--color-hover-row`      | `oklch(0.94 0.014 85)` |
| `--color-progress-track` | `oklch(0.9 0.014 85)`  |
| `--color-changed`        | `oklch(0.94 0.04 85)`  |
| `--color-error-bg`       | `oklch(0.95 0.03 25)`  |
| `--color-tooltip-bg`     | `oklch(0.22 0.02 70)`  |

### Text

| Token                  | Value                  |
| ---------------------- | ---------------------- |
| `--color-main`         | `oklch(0.22 0.02 70)`  |
| `--color-title`        | `oklch(0.18 0.025 70)` |
| `--color-heading`      | `oklch(0.18 0.025 70)` |
| `--color-muted`        | `oklch(0.45 0.02 75)`  |
| `--color-label`        | `oklch(0.48 0.02 75)`  |
| `--color-info`         | `oklch(0.48 0.02 75)`  |
| `--color-error`        | `oklch(0.52 0.18 25)`  |
| `--color-tooltip-text` | `oklch(0.97 0.008 85)` |

### Borders

| Token                | Value                  |
| -------------------- | ---------------------- |
| `--color-rule`       | `oklch(0.84 0.016 80)` |
| `--color-rule-light` | `oklch(0.7 0.025 80)`  |
| `--color-error-line` | `oklch(0.7 0.08 25)`   |

### Accent (deep gold for contrast on white paper)

| Token                     | Value                     |
| ------------------------- | ------------------------- |
| `--color-accent`          | `oklch(0.55 0.14 80)`     |
| `--color-accent-hover`    | `oklch(0.48 0.145 80)`    |
| `--color-accent-deep`     | `oklch(0.42 0.12 78)`     |
| `--color-accent-dim`      | `oklch(0.88 0.05 85)`     |
| `--color-on-accent`       | `oklch(0.99 0.005 85)`    |
| `--color-btn-ring`        | `oklch(0.55 0.14 80)`     |
| `--color-btn`             | `oklch(1 0.002 85)`       |
| `--color-btn-text`        | `oklch(0.55 0.14 80)`     |
| `--color-btn-active`      | `oklch(0.55 0.14 80)`     |
| `--color-btn-active-text` | `oklch(0.99 0.005 85)`    |
| `--color-victory`         | `oklch(0.55 0.14 80)`     |
| `--color-victory-on`      | `oklch(0.99 0.005 85)`    |
| `--color-victory-glow`    | `oklch(0.55 0.14 80 / 0)` |

### Semantic / state

| Token               | Value                  |
| ------------------- | ---------------------- |
| `--color-online`    | `oklch(0.52 0.14 150)` |
| `--color-ok`        | `oklch(0.48 0.13 150)` |
| `--color-ok-bg`     | `oklch(0.94 0.03 150)` |
| `--color-ok-ring`   | `oklch(0.72 0.08 150)` |
| `--color-fail`      | `oklch(0.52 0.18 25)`  |
| `--color-fail-bg`   | `oklch(0.95 0.03 25)`  |
| `--color-fail-ring` | `oklch(0.72 0.1 25)`   |
| `--color-warn`      | `oklch(0.62 0.14 70)`  |

### Stage / chart / heat / sidebar

| Token                    | Value                   |
| ------------------------ | ----------------------- |
| `--color-stage-1`        | `oklch(0.22 0.02 70)`   |
| `--color-stage-2`        | `oklch(0.55 0.14 50)`   |
| `--color-stage-3`        | `oklch(0.5 0.18 25)`    |
| `--color-chart-grid`     | `oklch(0.88 0.014 80)`  |
| `--color-chart-text`     | `oklch(0.48 0.02 75)`   |
| `--color-chart-line`     | `oklch(0.55 0.14 80)`   |
| `--color-chart-ok`       | `oklch(0.48 0.13 150)`  |
| `--color-chart-fail`     | `oklch(0.52 0.18 25)`   |
| `--color-chart-pr`       | `oklch(0.55 0.14 80)`   |
| `--color-heat`           | `oklch(0.78 0.08 80)`   |
| `--color-sidebar`        | `oklch(0.985 0.006 85)` |
| `--color-sidebar-active` | `oklch(0.94 0.02 85)`   |
| `--color-sidebar-border` | `oklch(0.84 0.016 80)`  |

---

## Typography

### Families

Source: `packages/design-tokens/src/tokens.ts` (`fonts`), `apps/frontend/web/src/styles/globals.css` (`@font-face`, body)

| Role    | Family           | Fallback (web)                         | Source note                                                                     |
| ------- | ---------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Display | `Bebas Neue`     | `system-ui`                            | Industrial condensed headers                                                    |
| Body    | `Barlow`         | `system-ui, -apple-system, sans-serif` | Clean readable prose; also `Barlow SemiBold` / `Barlow Bold` names in tokens.ts |
| Mono    | `JetBrains Mono` | `monospace`                            | Data, weights, sets/reps; variable font covering 400–600                        |

Web `@font-face` weights loaded (globals.css): Bebas Neue 400; Barlow 400/500/600/700;
JetBrains Mono variable `100 800`. Base `body` font is Barlow 14px / line-height 1.5.

### Type utilities

Source: `apps/frontend/web/src/styles/tokens.css` (`@utility`); mirrors `typeScale` in `packages/design-tokens/src/tokens.ts`

| Utility                  | Family         | Weight | Size | Line height | Letter spacing | Other             |
| ------------------------ | -------------- | ------ | ---- | ----------- | -------------- | ----------------- |
| `type-kicker`            | JetBrains Mono | 700    | 10px | —           | 0.8px          | uppercase         |
| `type-display`           | Barlow         | 700    | 30px | 36px        | -0.5px         | —                 |
| `type-display-sm`        | Barlow         | 700    | 26px | 32px        | -0.3px         | —                 |
| `type-title`             | Barlow         | 600    | 20px | —           | —              | —                 |
| `type-body`              | Barlow         | 400    | 16px | 24px        | —              | —                 |
| `type-meta`              | JetBrains Mono | 700    | 12px | —           | 0.4px          | —                 |
| `type-button`            | Barlow         | 600    | 14px | —           | 0.1px          | —                 |
| `text-2xs` (globals.css) | —              | —      | 10px | 1.4         | —              | size-only utility |

Note: `tokens.ts` `typeScale` also defines `displayData` (Barlow Bold, 64px, weight 400,
letter-spacing 0.6, line-height 64) used by the mobile app; it has no web `type-*` utility.
The `fontWeight` entries in `tokens.ts` encode the custom face name rather than a CSS weight
(700+ on a custom face falls back to system bold on Android).

### Font utility classes

Source: `apps/frontend/web/src/styles/globals.css`

| Class                | Family                      | Letter spacing | Usage                                       |
| -------------------- | --------------------------- | -------------- | ------------------------------------------- |
| `.font-mono`         | `JetBrains Mono, monospace` | —              | Data, weights, labels, monospaced UI        |
| `.font-display`      | `Bebas Neue, system-ui`     | 0.04em         | Display headings                            |
| `.font-display-data` | `Bebas Neue, system-ui`     | 0.02em         | Stat numbers (tighter than `.font-display`) |

---

## Spacing

Source: `apps/frontend/web/src/styles/tokens.css`; mirrors `spacing` in `packages/design-tokens/src/tokens.ts`

| Token                 | Value  |
| --------------------- | ------ |
| `--space-screen-x`    | `20px` |
| `--space-stack`       | `12px` |
| `--space-stack-large` | `16px` |
| `--space-card`        | `16px` |
| `--space-control-y`   | `12px` |
| `--space-control-x`   | `16px` |

`tokens.ts` also defines `tabClearance: 96` (mobile scroll clearance) with no web token.

---

## Radius

Source: `apps/frontend/web/src/styles/tokens.css` (shared with mobile) + `globals.css`

| Token              | Value                                 |
| ------------------ | ------------------------------------- |
| `--radius-control` | `10px`                                |
| `--radius-card`    | `16px`                                |
| `--radius-chip`    | `24px`                                |
| `--radius-base`    | `var(--radius-control)` (globals.css) |
| `--radius-pill`    | `9999px` (globals.css)                |

---

## Shadows

Source: `apps/frontend/web/src/styles/globals.css` (`@theme`; Oro values). Flat dark drops only.

| Token                    | Value                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| `--shadow-card`          | `0 1px 2px 0 oklch(0 0 0 / 0.3)`                                        |
| `--shadow-elevated`      | `0 8px 32px 0 oklch(0 0 0 / 0.6)`                                       |
| `--shadow-dialog`        | `0 8px 24px 0 oklch(0 0 0 / 0.5)`                                       |
| `--shadow-inset-subtle`  | `inset 0 0 0 1px oklch(1 0 0 / 0.02)`                                   |
| `--shadow-victory`       | `none`                                                                  |
| `--shadow-card-hover`    | `0 4px 20px 0 oklch(0 0 0 / 0.45)`                                      |
| `--shadow-toolbar`       | `0 1px 0 0 oklch(0 0 0 / 0.4)`                                          |
| `--shadow-glow-success`  | `none`                                                                  |
| `--shadow-glow-fail`     | `none`                                                                  |
| `--shadow-glow-gold`     | `none`                                                                  |
| `--shadow-pressed-steel` | `inset 0 1px 0 oklch(1 0 0 / 0.25), inset 0 -2px 0 oklch(0 0 0 / 0.18)` |

Classic-light overrides `--shadow-card`, `--shadow-elevated`, `--shadow-dialog`,
`--shadow-inset-subtle`, `--shadow-card-hover`, `--shadow-toolbar`, `--shadow-pressed-steel`
with warm low-opacity drops (see globals.css).

---

## Motion

Source: `apps/frontend/web/src/styles/globals.css` (`@theme`)

### Durations

| Token                | Value   |
| -------------------- | ------- |
| `--duration-instant` | `120ms` |
| `--duration-fast`    | `180ms` |
| `--duration-base`    | `240ms` |
| `--duration-slow`    | `320ms` |
| `--duration-press`   | `80ms`  |

### Easings

| Token               | Value                           |
| ------------------- | ------------------------------- |
| `--ease-out-expo`   | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-standard`   | `cubic-bezier(0.4, 0, 0.2, 1)`  |
| `--ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)`    |
| `--ease-press`      | `cubic-bezier(0.3, 0, 0.7, 1)`  |

Also: `--press-translate-y: 1px`. All motion is disabled under
`prefers-reduced-motion: reduce`.

---

## Components

### Button

Source: `apps/frontend/web/src/components/button.tsx`

Base classes: `type-button border rounded-control text-center`, press transition
(`duration-[var(--duration-press)] ease-[var(--ease-press)]`), `active:translate-y-px`,
`focus-visible:ring-2 ring-accent`, `disabled:opacity-35`, `disabled:cursor-not-allowed`,
`inline-flex items-center justify-center gap-2`. Gold is the scarce signal.

Variants:

| Variant   | Classes                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| `default` | `bg-transparent text-main border-rule-light hover:border-accent-deep hover:text-accent` |
| `primary` | `bg-accent text-on-accent border-accent-hover hover:bg-accent-hover`                    |
| `victory` | `bg-victory text-victory-on border-accent-hover hover:bg-accent-hover`                  |
| `danger`  | `bg-transparent border-fail text-fail hover:bg-fail hover:text-on-accent`               |
| `ghost`   | `border-transparent text-muted hover:text-main`                                         |

Sizes:

| Size           | Classes                          |
| -------------- | -------------------------------- |
| `sm`           | `px-3 py-2 min-h-[44px] sm:px-4` |
| `md` (default) | `px-4 py-3 min-h-[44px] sm:px-5` |
| `lg`           | `w-full px-6 py-3 min-h-[48px]`  |

Defaults: `variant="default"`, `size="md"`. Disabled state uses opacity 0.35.

### Card

Source: `apps/frontend/web/src/styles/globals.css` (`.card`, `.card-interactive`)

`box-shadow: var(--shadow-card)`; transitions border-color/box-shadow/transform. On hover:
`border-color: var(--color-rule-light)` and `box-shadow: var(--shadow-card-hover)`.
`.card-interactive:hover` adds `transform: translateY(-1px)`. (Paired with `--radius-card`
= 16px and `--color-card` surface.)

### Hatch

Source: `apps/frontend/web/src/styles/globals.css` (`.hatch`, `.hatch-dim`)

45° safety striping — the "this matters" marker.

- `.hatch`: `repeating-linear-gradient(-45deg, color-mix(in oklch, var(--color-accent) 50%, transparent) 0 1px, transparent 1px 7px)`
- `.hatch-dim`: same with `var(--color-rule-light) 70%`.

### Accent-left edge

Source: `apps/frontend/web/src/styles/globals.css` (`.accent-left-gold`, `.accent-left-muted`)

Left machined edge on slot / program cards.

- `.accent-left-gold`: `border-left: 3px solid var(--color-accent)`
- `.accent-left-muted`: `border-left: 3px solid var(--color-rule-light)`

### Section-label

Source: `apps/frontend/web/src/styles/globals.css` (`.section-label`)

Horizontal rule with centered label. `display: flex; align-items: center; gap: 12px`,
`font-family: 'JetBrains Mono', monospace`, `font-size: 10px`, `font-weight: 600`,
`letter-spacing: 0.08em`, `text-transform: uppercase`, `color: var(--color-label)`.
`::before` and `::after` are `flex: 1; height: 1px; background: var(--color-rule)`.

### Kicker

Source: `apps/frontend/web/src/styles/tokens.css` (`type-kicker` utility), `packages/design-tokens/src/tokens.ts` (`typeScale.kicker`)

Mono eyebrow label: JetBrains Mono, 700, 10px, letter-spacing 0.8px, uppercase.

Related labels in `globals.css`: `.chalk-stamp` / `.dash-section-title` (mono, 11px, 700,
0.08em, uppercase, label color) and `.week-badge` (mono, 10px, 0.06em).

---

## Known inconsistencies

- `tokens.css` declares the palette in **hex** (`#eab53b`, …) while `globals.css`
  overrides and extends colors in **oklch** (web-only tokens and the classic-light skin).
- `--sidebar-width-collapsed: 224px` is **kept only for back-compat** — it equals
  `--sidebar-width` (224px) to prevent a JS-driven width swap; the sidebar no longer
  hover-collapses.
- The `kicker` type (`type-kicker` / `typeScale.kicker`) and the `text-2xs` utility are
  both **10px** — the same size the `.section-label` and `.week-badge` labels also use.
