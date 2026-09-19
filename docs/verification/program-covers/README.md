# Code-drawn program covers

Replaces the 18 image-generated WebP covers (see
[`../program-artwork/`](../program-artwork/README.md)) with deterministic SVG
covers rendered at runtime. No raster program assets remain in the mobile bundle
(−1.5 MB), and custom plans no longer fall back to a barbell icon.

## Design

- `src/lib/programs/program-cover-spec.ts` (pure, tested): identity → 32-bit
  FNV-1a seed → mulberry32 rhythm values. Category selects the motif
  (strength → bars, hypertrophy → columns, powerlifting → arcs, unknown/custom →
  hatch), level selects density (3–4 / 5–6 / 7–8 shapes), weekly sessions become
  a tick row, and the name is abbreviated to a 2–4 character monogram
  (`GZCLP → GZ`, `5/3/1 Boring But Big → BBB`, `La Sala del Tiempo 2 → ST2`).
  Metadata comes from the props when Explore has a `CatalogEntry`, otherwise from
  `PROGRAM_CATALOG` in `@gzclp/domain` by program id, otherwise from the title.
- `src/ui/program-cover.tsx`: `react-native-svg` renderer using only design
  tokens (`surface2`, `rule`, `ruleStrong`, `accent`, `accentDim`,
  `textPrimary`) and Bebas Neue for the monogram. Cover draws on a 180 × 100
  viewBox, thumbnail on 72 × 64; both scale with `preserveAspectRatio slice`.
  The thumbnail drops the tick row and overlays the monogram on a translucent
  plate.
- `src/ui/program-artwork.tsx` keeps its name, sizes and clipping; callers now
  pass `title` (My plans) or the full catalog metadata (Explore).

## Verification (2026-09-19)

- `pnpm --filter mobile typecheck`, `lint`, `test` (51 suites / 637 tests),
  root `pnpm run test:mobile:lint` (17, now asserting `.webp` `require()` is
  rejected) and `expo export --platform android` all pass.
- Android emulator `gravity-api35` (Pixel-class, API 35, Expo Go) against the
  local API + Postgres, signed in with the dev route. Explore featured card, all
  catalog rows, the detail sheet and My plans (hero + rows, plan created before
  this change so the id-based lookup path is exercised) render the new covers
  with the Bebas monogram; all four motifs appear.

Screenshots: [Explore](./explore-android.webp),
[catalog rows](./explore-rows-android.webp),
[powerlifting rows](./explore-powerlifting-android.webp),
[detail sheet](./detail-android.webp), [My plans](./my-plans-android.webp).

## Limits

No physical device or iOS run. Expo Go's existing `expo-notifications` console
error is unrelated. Text width in the SVG is estimated (0.42 em per glyph), so
the accent underline is approximate rather than measured.
