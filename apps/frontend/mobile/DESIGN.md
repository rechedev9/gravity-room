# Gravity Room mobile design system

## Product intent

Gravity Room mobile is the in-gym companion for a GZCLP training block: fast to read between sets,
resilient offline, and calm under fatigue. The UI favors strong information hierarchy over decorative
fitness imagery.

The generated direction board used for the current implementation is
[`design/gravity-room-mobile-direction.png`](./design/gravity-room-mobile-direction.png). It is a visual
reference only; the production interface is composed from native React Native views and accessible
controls.

## Visual direction

- Matte near-black canvas with graphite surfaces and one-pixel borders.
- Warm off-white text rather than pure white to reduce glare in a gym.
- Electric lime is reserved for the active destination and primary/success actions.
- Blue communicates local/sync information; coral communicates failure or destructive actions.
- No glassmorphism, ornamental gradients, fake charts, or bitmap UI chrome.
- Cards group a real domain object. They are not used as generic wrappers around every label.

## Tokens

### Color

- `canvas`: `#070B12`
- `surface`: `#0D141D`
- `card`: `#111A24`
- `cardElevated`: `#17222F`
- `borderSubtle`: `#263445`
- `borderStrong`: `#405269`
- `textPrimary`: `#F4F7FB`
- `textSecondary`: `#B6C0CF`
- `textMuted`: `#7F8B9D`
- `accentPrimary`: `#C6F36A`
- `accentInfo`: `#6CB6FF`
- `accentWarning`: `#F0C86E`
- `accentDanger`: `#FF766E`

### Shape and spacing

- Screen horizontal padding: `20`.
- Card radius: `16`.
- Control radius: `12`.
- Pill radius: `999`, used only for compact statuses.
- Card padding: `14-18`.
- Default stack gap: `12`; section gap: `20`.
- Interactive controls have a minimum height of `44`.

### Typography

- Screen title: `30`, `800`, primary.
- Section title: `18`, `800`, primary.
- Card title: `17`, `700-800`, primary.
- Body: `15`, secondary, line height `22` when multiline.
- Eyebrow: `12`, `800`, uppercase and tracked.
- Numeric workout data uses tabular numerals when supported.

## Screen contracts

- **Login:** centered brand, concise value proposition, one obvious primary provider, progressive
  disclosure for email/password, and errors inside the auth panel.
- **Programs:** next-workout hero first, active programs second, preset catalog third. Cached and sync
  failure states remain explicit.
- **Tracker:** a real top-level destination. Workout progress and local sync state precede exercise
  cards; each exercise shows its prescription as a set table and keeps result/AMRAP/RPE actions large.
- **Profile:** identity, current read-only preferences, local/offline status, and a visually quiet
  sign-out action. Controls that have no persistence contract are not presented as editable.
- **Bottom navigation:** exactly Programs, Workout, and Profile for authenticated users. Every item has
  an icon, translated label, selected state, and safe-area padding.

## Interaction and accessibility rules

- Optimistic workout edits persist locally before remote sync is attempted.
- Offline or failed sync states stay visible and recover through an explicit retry path.
- Failure and sync states include text or shape, never color alone.
- Every user-visible string is translated through i18next.
- Touch targets are at least `44x44` where the platform allows it.
- Auth forms remain reachable when the keyboard is visible.
- Screen content observes the top safe area; the authenticated navigation owns the bottom safe area.
