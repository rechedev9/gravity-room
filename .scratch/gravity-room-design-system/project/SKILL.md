---
name: gravity-room-design
description: Use this skill to generate well-branded interfaces and assets for Gravity Room — a free, open-source strength-training tracker — either for production or throwaway prototypes/mocks/decks. Contains essential design guidelines, colors, type, fonts, assets, and a UI kit (landing + dashboard + programs catalog + workout tracker) for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available
files. The README is the authoritative brand brief; everything else (CSS
tokens, fonts, assets, preview cards, the UI kit) is downstream of it.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.),
copy the assets out and create static HTML files for the user to view. The
fastest path to a Gravity-Room-correct artifact is:

1. Link `colors_and_type.css` (it `@font-face`s the three families and
   defines all the color/type/spacing variables).
2. Pull warm-black surfaces (`--color-body`, `--color-card`, `--color-header`),
   gold accent (`--color-accent` `#e8aa20`), warm-cream text (`--color-main`
   `#f0e8d8`), gold title (`--color-title` `#f0c040`), sand muted
   (`--color-muted` `#8a7a5a`).
3. Use Bebas Neue for displays (loud, condensed, slight tracking 0.02–0.04em),
   Barlow for body, JetBrains Mono for **all** eyebrows / labels / badges /
   buttons (10–11px, tracking 0.2em–0.3em, UPPERCASE).
4. Square corners. Borders, not pills. No rounded buttons or rounded cards
   — `--radius-sm` (2px) is the default; `--radius-pill` exists _only_ for
   the brand logo and dot indicators.
5. Use the brand assets in `assets/` (logos, hero, feature webp glyphs, the
   `howit-*.webp` imagery). Never invent SVG icons; use Lucide for any new
   line icon and flag the substitution.
6. Status, category, and stage tokens are real and semantic — see the
   "Color" section in README. T1/T2/T3 = cream/orange/red. ok = olive,
   fail = dusty red. Strength/hyper/power = blue/purple/red, used as 8%
   wash + ring + text.

If working on production code, copy these tokens into the host project's
Tailwind theme or CSS-vars layer, install Bebas Neue + Barlow + JetBrains
Mono via `@font-face` (or self-host the woff2s in `fonts/`), and import the
component patterns by reading `ui_kits/web/primitives.jsx`,
`ui_kits/web/chrome.jsx`, and `ui_kits/web/styles.css` as references — they
are simplified-cosmetic versions of the real components in
`gravity-room/apps/frontend/web/src/`.

If the user invokes this skill without any other guidance, ask them:

1. What surface? (marketing page, in-app screen, slide, social card, app icon, etc.)
2. Production or throwaway?
3. Any specific copy they want carried through, or write it in-voice?
4. Any particular brand element to lean on (the gold gravity well, the GZCLP
   tier ladder, the set-grid as iconography)?

Then act as an expert designer who outputs HTML artifacts _or_ production
code, depending on the need.

## File map

| Path                  | What's there                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `README.md`           | Full brand brief — content fundamentals, visual foundations, iconography. **Start here.**                   |
| `colors_and_type.css` | Drop-in CSS — `@font-face`, color/type/spacing/shadow tokens, semantic typography classes.                  |
| `fonts/`              | Self-hosted woff2 files (Bebas Neue, Barlow 400/500/600/700, JetBrains Mono variable).                      |
| `assets/`             | Logos, hero/feature/howit imagery, splash, og, pattern texture. Verbatim from `gravity-room` web `public/`. |
| `preview/`            | Per-token HTML cards. Useful as quick visual references when answering "what does X look like?".            |
| `ui_kits/web/`        | Click-thru web kit. `index.html` is the entry; small JSX components and a single `styles.css`.              |
