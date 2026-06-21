# Gravity Room mobile design system

## Product intent

Gravity Room mobile is the in-gym companion for a GZCLP training block: fast to read between sets, resilient offline, and calm under fatigue.

## Tokens

### Color

- `bg.canvas`: `#050816` — app background.
- `bg.card`: `#111827` — elevated panels and cards.
- `border.subtle`: `#334155` — low-contrast controls.
- `text.primary`: `#F8FAFC` — primary copy.
- `text.secondary`: `#CBD5E1` — supporting copy.
- `text.muted`: `#94A3B8` — metadata.
- `accent.primary`: `#8B9AF4` — section labels and active nav.
- `accent.success`: `#22C55E` — logged success.
- `accent.warning`: `#FBBF24` — sync notice.
- `accent.danger`: `#F97316` — logged fail or destructive-adjacent action.
- `text.error`: `#FCA5A5` — errors.

### Shape and spacing

- Screen horizontal padding: `24`.
- Card radius: `20`.
- Pill radius: `999`.
- Card padding: `16-18`.
- Control vertical padding: `10-12`.
- Default stack gap: `12-14`.

### Typography

- Screen title: `28-30`, `700`, primary.
- Card title: `18-20`, `600-700`, primary.
- Body: `16`, secondary, line height `24` when multiline.
- Eyebrow: `13-14`, `700`, uppercase, tracked.

## Components

- Auth shell: centered, one primary CTA, no secondary distractions.
- Program list: local-first list, explicit cached/sync/error states.
- Tracker: one workout at a time, high-contrast result controls, AMRAP/RPE steppers after success only.
- Profile: account identity and data/session actions.
- Bottom nav: authenticated shell only; two top-level destinations for now: Programs and Profile.

## Interaction rules

- Optimistic workout edits must persist locally before remote sync is attempted.
- Offline or failed sync states stay visible and recover via retry.
- Destructive account/session actions must remain accessible but visually quieter than workout actions.
- Touch targets should be at least `44px` high through padding/min width.
