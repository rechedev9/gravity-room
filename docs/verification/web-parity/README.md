# Web parity with the mobile app

The web app now takes its dark palette, radii, type voice and phone navigation
from the mobile app. Tokens live once in `@gzclp/design-tokens`; program cover
geometry and catalog filtering live once in `@gzclp/domain`.

Captured from a production build served by `vite preview` against a local API,
at 390x844 and 1440x900, signed in through the dev route with a seeded GZCLP
program. `before-*` are from the audit that preceded the change.

| Screen           | Before                         | After                         |
| ---------------- | ------------------------------ | ----------------------------- |
| Tracker, phone   | `before-tracker-phone.webp`    | `after-tracker-phone.webp`    |
| Tracker, desktop | `before-tracker-desktop.webp`  | `after-tracker-desktop.webp`  |
| Login, phone     | `before-login-phone.webp`      | `after-login-phone.webp`      |
| Programs         | `before-programs-desktop.webp` | `after-programs-desktop.webp` |
| Home, phone      |                                | `after-home-phone.webp`       |
| More, phone      |                                | `after-more-phone.webp`       |

## What changed

- Phone widths: five-tab bottom bar (Train, My plans, Explore, Exercises, More)
  in place of the top bar with a drawer. The desktop sidebar stays.
- Tracker: week chips, day selector with completed checks, slot cards with set
  rows, rest timer as a banner above the tab bar. Both views, the side panel and
  the calendar navigator are kept.
- Cards at 16px radius, controls at 10px, pills at 24px. Headings and buttons in
  Barlow sentence case inside `/app` and login. Landing, legal and exercise wiki
  pages keep their editorial style.

## Not covered

The Insights page still titles its cards with raw exercise ids, and no full
regression pass over both themes and both locales was done after the tracker
restyle.
