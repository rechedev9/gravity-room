# Program artwork and My plans

18 original covers generated with the built-in imagegen tool from the catalog's
actual descriptions and training background. [Gallery](./gallery.html),
[contact sheet](./gallery.webp), and [exact prompts](./prompts.json).

Assets: `apps/frontend/mobile/assets/programs/`. Each routine has a 960 × 640
WebP cover and 320 × 213 thumbnail. The collection is approximately 1.5 MB and
bundled by Metro for offline use. Lookup uses the stable program ID; renamed
instances keep their art. Unknown/custom programs use a neutral barbell fallback.
Migration 5 adds nullable artwork identity to existing owner-partitioned summaries.

My plans features the most recently updated plan, compact remaining plans,
localized dates, and a direct Explore entry. No inferred active state or invented
progress. Explore shows the same art in its featured card, all rows, and details.

## Verification

- Android Pixel 7 / API 35 / Expo Go: searched all 18 routines and opened/closed
  their detail sheets. Visually inspected the artwork collection and representative
  native covers and rows.
- Created Caparazón de Tortuga from its illustrated detail sheet. It opened Train;
  My plans displayed its matching cover and retained all three prior plans.
- Logged a set, opened the same plan through My plans, and verified the next set
  remained selected. One Train tracker now owns editing across all entry points;
  legacy workout deep links redirect there. A second set was logged, then Expo Go
  was force-stopped and reopened: both sets remained and set 3 was pending
  ([restart proof](./restored-android.webp)).
- Playwright CLI checked all 18 gallery images loaded. Console's only gallery error
  was the static server's missing favicon. Browser sessions were closed.
- Expo Web preview login was captured and its console reviewed. Local cross-origin
  auth initially failed CORS; a test-only request forwarder reached the API but
  login still failed during local session setup. This is not evidence of a working
  authenticated Expo Web flow. Android is the real application-path verification.
- Mobile suite: 238 tests / 27 suites pass, plus the focused router regression.
  Real SQLite verifies migration from version 4 retains rows and that renamed
  plans preserve artwork identity and account isolation.
- Initial Codex review found two actionable regressions: duplicate retained
  trackers and catalog creation replacing cached summaries. Both were fixed;
  router state preservation and creation without a summaries query have regression
  coverage. Final branch review and CI results are recorded in the PR.

Screenshots: [My plans](./my-plans-android.webp), [Explore](./explore-android.webp),
[details](./detail-android.webp), [created plan](./created-my-plans-android.webp),
[Train after creation](./created-android.webp), [Expo Web login](./expo-web-login.webp).

This supersedes the separate workout stack and naming described in earlier
verification checkpoints. The parent mesocycle domain/API work is still separate.
