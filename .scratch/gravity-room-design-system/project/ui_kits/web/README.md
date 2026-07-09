# Gravity Room — Web UI Kit

High-fidelity click-thru recreation of the Gravity Room web SPA, lifted from
`gravity-room/apps/frontend/web/`. The kit covers the marketing landing
page and the in-app surfaces (dashboard, program catalog, workout tracker,
sign-in).

## Run

Open `index.html`. It loads React 18 + Babel from CDN, the design-system
tokens from `../../colors_and_type.css`, and the JSX components below.

## Components

| File                         | What it is                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| `App.jsx`                    | Top-level router. Manages `route` state and renders one of the screens. |
| `chrome/Nav.jsx`             | Sticky transparent → opaque nav with logo, link group, sign-in CTA.     |
| `chrome/Footer.jsx`          | Two-column footer with discord/github SVG marks.                        |
| `chrome/AppShell.jsx`        | In-app shell: sidebar + topbar + content slot.                          |
| `primitives/Button.jsx`      | Primary / outline / ghost / danger variants.                            |
| `primitives/Badge.jsx`       | Status / category / neutral variants.                                   |
| `primitives/Eyebrow.jsx`     | Mono uppercase eyebrow + section-label hairline rule.                   |
| `primitives/KpiCard.jsx`     | Mono label + Bebas data number + sub-label + trend.                     |
| `primitives/ProgramCard.jsx` | Category-washed program card with meta pills.                           |
| `primitives/SetCell.jsx`     | One slot in the tracker's set grid (`done` / `fail` / `todo`).          |
| `primitives/ProgressBar.jsx` | Gold fill with edge glow + meta row.                                    |
| `primitives/Field.jsx`       | Sharp-corner input + label + optional weight variant.                   |
| `screens/Landing.jsx`        | Hero → features → how-it-works → CTA → footer.                          |
| `screens/SignIn.jsx`         | Email + password centered card.                                         |
| `screens/Dashboard.jsx`      | KPIs, recent workouts table, next session card.                         |
| `screens/Programs.jsx`       | Catalog grid of ProgramCards.                                           |
| `screens/Tracker.jsx`        | Active workout view with set grid + progress bar.                       |

## Design fidelity

Visuals were taken directly from the Tailwind 4 `globals.css` tokens and the
React components in `gravity-room/apps/frontend/web/src/`. The marketing
landing copy is verbatim from `home/Hero.tsx`, `home/HowItWorks.tsx`, and
the route translation files. The dashboard / tracker / programs surfaces
match the styling conventions of the codebase but use simplified mock data.
