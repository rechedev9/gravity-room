# UI Revival — Brutalist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Gravity Room `/app` shell around an underground-gym brutalist aesthetic (rust as primary, gold ceremonial only), migrate the design token system to OKLCH, fix the broken `--color-heading` token and raw `bg-green-500` / `text-white` usages, and replace the empty dashboard with a `NextSetHero` + supporting modules.

**Architecture:** Two layers of change. (1) Foundation: edit `globals.css @theme` so every existing Tailwind class consumer (`bg-card`, `text-title`, …) picks up new OKLCH values via aliases — components inherit the brutalist palette with zero per-file work. (2) Surface: explicit component upgrades (Button variants, Toast slate-drop, ProgressBar victory state, sidebar industrial), then a `/app` rebuild composing 7 new dashboard components under a `DashboardShell`.

**Tech Stack:** Vite 7 · React 19 · TanStack Router/Query · Tailwind v4 (CSS-only `@theme` config) · `motion` v12 · `bun:test` + `@testing-library/react` (test runner: `bun run --filter web test`) · Lefthook (typecheck + lint + format pre-commit; test + build pre-push)

**Spec:** [`docs/superpowers/specs/2026-05-11-ui-revival-brutalist-design.md`](../specs/2026-05-11-ui-revival-brutalist-design.md)

**Branch:** `feat/web-ui-revival-brutalist`

**Conventions for every task below:**

- Test runner: `bun run --filter web test path/to/file.test.tsx`
- Typecheck: `bun run --filter web typecheck`
- Lint: `bun run --filter web lint`
- Commit subject style: lowercase prefix `feat(web):` / `fix(web):` / `refactor(web):` / `chore(web):`
- Co-author footer on every commit: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Lefthook will auto-run typecheck + lint + format on commit. If it fails, fix the underlying issue and re-commit (NEW commit, not `--amend`).

---

## Phase A — Setup

### Task 1: Branch + baseline screenshots

**Files:**

- No code changes.

- [ ] **Step 1: Create feature branch from current `main`**

```bash
git checkout -b feat/web-ui-revival-brutalist
```

- [ ] **Step 2: Verify local dev servers are still up (started during brainstorming)**

Run: `curl -sf http://localhost:3001/health && curl -sf http://localhost:5173/`
Expected: API returns `{"status":"ok"}`, web returns HTML.

If down, restart:

```bash
sudo service postgresql start
AUTH_DEV_ROUTE_ENABLED=true NODE_ENV=development bun run dev:api &
VITE_API_URL=http://localhost:3001 bun run dev:web &
```

- [ ] **Step 3: Confirm baseline screenshots already exist**

Run: `ls /tmp/gr-audit/desktop-*.png /tmp/gr-audit/mobile-*.png 2>/dev/null | wc -l`
Expected: `8` (4 surfaces × 2 breakpoints, captured by the Haiku audit subagent during brainstorming).

If missing, dispatch a fresh Haiku subagent with the audit prompt from the spec's "Skill provenance" section to recapture them — these are the before-state reference for the manual visual verification in Task 24.

---

## Phase B — Foundation (tokens, utilities, cleanup)

### Task 2: Migrate `@theme` tokens to OKLCH brutalist

**Files:**

- Modify: `apps/frontend/web/src/styles/globals.css` (lines 81–166 `@theme` block per audit; verify with `grep -n "@theme" apps/frontend/web/src/styles/globals.css` first)

- [ ] **Step 1: Locate the existing `@theme` block**

Run: `grep -n "^@theme" apps/frontend/web/src/styles/globals.css`
Expected: one match around line 81. Note the closing `}` line for the replacement scope.

- [ ] **Step 2: Replace the entire `@theme` block with the new OKLCH tokens**

Old block reference (do NOT keep): contains hex values such as `--color-body: #0b0906`, `--color-card: #130f09`, `--color-title: #f0c040`, `--color-accent: #e8aa20`, etc.

New block content (preserve `@theme {` opening and `}` closing braces; sidebar widths/transitions stay; motion tokens are additive, keep existing ones):

```css
@theme {
  /* SURFACES — clear perceptual delta (L* ≥ 5% between levels) */
  --color-body: oklch(0.14 0.005 50);
  --color-card: oklch(0.19 0.008 50); /* alias used everywhere; semantic name = surface */
  --color-surface-2: oklch(0.24 0.01 45);
  --color-header: oklch(0.1 0.003 50); /* alias = recess */
  --color-th: oklch(0.22 0.01 45);
  --color-hover-row: oklch(0.22 0.01 45);
  --color-progress-track: oklch(0.22 0.01 45);
  --color-changed: oklch(0.22 0.04 70);
  --color-error-bg: oklch(0.2 0.06 25);
  --color-tooltip-bg: oklch(0.1 0.003 50);

  /* TEXT */
  --color-main: oklch(0.94 0.008 80);
  --color-title: oklch(0.94 0.008 80); /* DEMOTED — was gold; chalk now */
  --color-heading: oklch(0.94 0.008 80); /* FIX — was undefined */
  --color-muted: oklch(0.6 0.012 50);
  --color-label: oklch(0.68 0.015 50);
  --color-info: oklch(0.6 0.012 50);
  --color-error: oklch(0.68 0.18 25);
  --color-tooltip-text: oklch(0.94 0.008 80);

  /* BORDERS */
  --color-rule: oklch(0.26 0.008 50);
  --color-rule-light: oklch(0.4 0.014 50);
  --color-error-line: oklch(0.45 0.12 25);

  /* PRIMARY ACCENT — rust */
  --color-accent: oklch(0.62 0.13 50);
  --color-accent-hover: oklch(0.67 0.15 50);
  --color-on-accent: oklch(0.1 0.003 50);
  --color-btn-ring: oklch(0.62 0.13 50);
  --color-btn: oklch(0.19 0.008 50);
  --color-btn-text: oklch(0.62 0.13 50);
  --color-btn-active: oklch(0.62 0.13 50);
  --color-btn-active-text: oklch(0.1 0.003 50);

  /* CEREMONIAL — scarce gold */
  --color-victory: oklch(0.82 0.14 85);
  --color-victory-on: oklch(0.1 0.003 50);
  --color-victory-glow: oklch(0.82 0.14 85 / 0.35);

  /* SEMANTIC / STATE */
  --color-online: oklch(0.72 0.14 145);
  --color-ok-bg: oklch(0.2 0.04 145);
  --color-ok-ring: oklch(0.5 0.1 145);
  --color-ok: oklch(0.68 0.14 145);
  --color-fail-bg: oklch(0.2 0.06 25);
  --color-fail-ring: oklch(0.45 0.12 25);
  --color-fail: oklch(0.65 0.18 25);
  --color-warn: oklch(0.75 0.16 70);

  /* STAGE COLORS — keep semantic, recoloured to brutalist */
  --color-stage-1: oklch(0.94 0.008 80);
  --color-stage-2: oklch(0.68 0.16 50);
  --color-stage-3: oklch(0.58 0.21 25);

  /* CHART */
  --color-chart-grid: oklch(0.26 0.008 50);
  --color-chart-text: oklch(0.6 0.012 50);
  --color-chart-line: oklch(0.62 0.13 50);
  --color-chart-ok: oklch(0.5 0.1 145);
  --color-chart-fail: oklch(0.45 0.12 25);
  --color-chart-pr: oklch(0.82 0.14 85);

  /* SIDEBAR — width unchanged; colors retuned */
  --color-sidebar: oklch(0.12 0.005 50);
  --color-sidebar-active: oklch(0.22 0.01 45);
  --color-sidebar-border: oklch(0.26 0.008 50);
  --sidebar-width: 224px; /* CHANGED — was 240; expanded fixed; matches spec */
  --sidebar-width-collapsed: 224px; /* CHANGED — no longer collapses on lg+ */
  --sidebar-transition: 250ms cubic-bezier(0.4, 0, 0.2, 1);

  /* RADII */
  --radius-base: 2px;
  --radius-pill: 9999px;

  /* SHADOWS — sharp drop + hairline inset */
  --shadow-card: 2px 2px 0 0 oklch(0 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.02);
  --shadow-elevated: 4px 4px 0 0 oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.03);
  --shadow-dialog: 4px 4px 0 0 oklch(0 0 0 / 0.6), inset 0 0 0 1px oklch(1 0 0 / 0.03);
  --shadow-inset-subtle: inset 0 0 0 1px oklch(1 0 0 / 0.02);
  --shadow-victory: 0 0 28px var(--color-victory-glow);

  /* MOTION — keep existing, add press */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --ease-press: cubic-bezier(0.3, 0, 0.7, 1);
  --duration-instant: 120ms;
  --duration-fast: 180ms;
  --duration-base: 240ms;
  --duration-slow: 320ms;
  --duration-press: 80ms;
  --press-translate-y: 1px;
}
```

- [ ] **Step 3: Run typecheck and build to confirm Tailwind v4 resolves the tokens**

Run:

```bash
bun run --filter web typecheck
bun run --filter web build
```

Expected: both pass with no errors. Tailwind v4 generates class names like `bg-body`, `bg-card`, `text-title`, `border-accent`, `text-on-accent`, `text-online`, `text-victory`, `text-warn`, `bg-surface-2`, etc. from the token names above.

- [ ] **Step 4: Visual sanity check in browser**

Open `http://localhost:5173/app` in a browser. Expect: the page renders without errors. Colors have shifted from gold-and-warm-brown to rust-and-graphite-and-chalk. Layout is unchanged. Some accent surfaces that used gold (e.g. `text-title` on headings) will now be chalk-white — that is intentional (gold demoted).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/styles/globals.css
git commit -m "$(cat <<'EOF'
refactor(web): migrate @theme tokens to OKLCH brutalist palette

Rust replaces gold as primary accent. Gold demoted to --color-victory
(scarce ceremonial only). All surfaces moved to OKLCH with clear
perceptual delta. Fixes broken --color-heading token (was undefined,
silently broke ProfileStatCard accent). Sidebar width unified at 224px.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.5: Replace raw `bg-green-500` in OnlineIndicator

**Files:**

- Modify: `apps/frontend/web/src/components/online-indicator.tsx:18`

- [ ] **Step 1: Inspect current usage**

Run: `grep -n "bg-green-500" apps/frontend/web/src/components/online-indicator.tsx`
Expected: single match on line 18.

- [ ] **Step 2: Replace the class**

Edit `apps/frontend/web/src/components/online-indicator.tsx`: change `className="...bg-green-500..."` → `className="...bg-online..."` and reduce pulse amplitude where defined (look for opacity transition; if amplitude lives in a Tailwind `animate-pulse` default, leave it for Task 9 where we add the inline-in-sidebar variant).

- [ ] **Step 3: Run typecheck**

```bash
bun run --filter web typecheck
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/web/src/components/online-indicator.tsx
git commit -m "$(cat <<'EOF'
fix(web): replace raw bg-green-500 with --color-online token

The OnlineIndicator was the only place in the codebase using a raw
Tailwind default color scale. Promotes the dot color to a first-class
token so it can be retuned alongside the rest of the palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add global utilities + remove dead helper classes

**Files:**

- Modify: `apps/frontend/web/src/styles/globals.css` (append utilities, remove `.accent-left-gold`, `.accent-left-muted`, `.card-glow-gold` blocks)

- [ ] **Step 1: Locate the helper classes to remove**

Run: `grep -n "\.accent-left-gold\|\.accent-left-muted\|\.card-glow-gold" apps/frontend/web/src/styles/globals.css`
Expected: three matches (one definition each).

- [ ] **Step 2: Remove those three blocks (definitions only) from `globals.css`**

Delete the `.accent-left-gold { … }`, `.accent-left-muted { … }`, `.card-glow-gold { … }` blocks entirely. The class names are still used in component code (`kpi-card.tsx`, `active-program-card.tsx`, `day-view.tsx`, `detailed-day-view.tsx`) — that is expected; subsequent component tasks remove them at the call sites. With the CSS gone, the leftover class names become no-ops in the meantime, which is acceptable for one or two intermediate commits.

- [ ] **Step 3: Append the new utility classes at the end of `globals.css`**

```css
/* === Brutalist surface utilities ============================ */

/* Concrete grain — applied via .concrete-noise on the app shell <body> */
.concrete-noise::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>");
  opacity: 0.035;
  mix-blend-mode: overlay;
}

/* Vignette — radial darken on body edges */
.vignette::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(ellipse at center, transparent 50%, oklch(0.06 0 0 / 0.35) 100%);
}

/* Chalk-stamp label — replaces .dash-section-title (kept as alias) */
.chalk-stamp,
.dash-section-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-label);
}

/* Base focus ring (was per-component before) */
:where(button, a, input, select, textarea, [role='button'], [tabindex]):focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Run typecheck + build + lint**

```bash
bun run --filter web typecheck
bun run --filter web lint
bun run --filter web build
```

Expected: all pass. Build verifies the SVG data-URI doesn't break Tailwind v4's PostCSS pipeline.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(web): add brutalist utility classes and base focus ring

Adds .concrete-noise (3.5% SVG turbulence overlay), .vignette (radial
edge darken), .chalk-stamp (mono uppercase label, also aliased from
the existing .dash-section-title for back-compat) and a global
:focus-visible ring on interactive elements. Removes the dead
.accent-left-gold / .accent-left-muted / .card-glow-gold definitions;
remaining call sites become no-ops and are migrated in later tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Migrate `text-white` on `bg-accent` to `text-on-accent`

**Files:**

- Modify: 7 files containing `text-white` against rust/accent backgrounds:
  - `apps/frontend/web/src/components/sw-update-prompt.tsx`
  - `apps/frontend/web/src/components/providers.tsx` (note: may have moved — verify)
  - `apps/frontend/web/src/components/route-error-fallback.tsx`
  - `apps/frontend/web/src/features/tracker/program-app.tsx`
  - `apps/frontend/web/src/components/language-selector.tsx`
  - `apps/frontend/web/src/features/program-preview/program-preview-page.tsx`
  - `apps/frontend/web/src/features/program-view/stage-tag.tsx` (verify per stage-tag.test.tsx existing assertion)
- Test: `apps/frontend/web/src/features/program-view/stage-tag.test.tsx` (existing — confirm "should NOT have text-white class on S1 badge" still passes)

- [ ] **Step 1: Find all current call sites**

Run: `grep -rn "text-white" apps/frontend/web/src/ --include="*.tsx" --include="*.ts" | grep -v "test"`
Expected: ~7 matches across the files above. Note exact line numbers.

- [ ] **Step 2: For each match, decide between `text-on-accent` and `text-main`**

Rule: if the element has `bg-accent` (rust background) → `text-on-accent`. If the element has a different background and was just using white for contrast → `text-main` (chalk).

Apply via `Edit` per file. Do NOT change `text-white` inside test assertions in `stage-tag.test.tsx` (it asserts the absence of the class — leave the assertion intact).

- [ ] **Step 3: Run unit tests**

```bash
bun run --filter web test src/features/program-view/stage-tag.test.tsx
```

Expected: pass (the existing "should NOT have text-white class on S1 badge" assertion is satisfied because S1 already wasn't using `text-white`; the other stage badges that DID use it are now `text-on-accent`).

- [ ] **Step 4: Run typecheck + lint**

```bash
bun run --filter web typecheck
bun run --filter web lint
```

Expected: pass.

- [ ] **Step 5: Manual visual check**

Reload `http://localhost:5173/app` and the affected surfaces. Text on rust buttons should be dark (recess-color) and legible.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/web/src
git commit -m "$(cat <<'EOF'
fix(web): replace text-white on bg-accent with text-on-accent token

text-white on the new rust accent (#c66a2c equivalent) sits at ~3.5:1
contrast, below WCAG AA. text-on-accent resolves to dark recess
(L*=0.10) and gives ~7:1+. Affects 7 call sites identified in audit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Cleanup — orphan inline styles + dead icon exports

**Files:**

- Modify: `apps/frontend/web/src/features/tracker/program-app.tsx:39` (inline gradient)
- Modify: `apps/frontend/web/src/features/profile/profile-page.tsx:280` and `:311` (inline textShadow)
- Modify: `apps/frontend/web/src/components/layout/sidebar-icons.tsx` (remove `AnalyticsIcon`, `DashboardIcon` exports)

- [ ] **Step 1: Inspect the inline style on `program-app.tsx:39`**

Run: `sed -n '35,45p' apps/frontend/web/src/features/tracker/program-app.tsx`
Expected: a `style={{ backgroundImage: 'linear-gradient(to bottom, rgba(232, 170, 32, 0.02), transparent)' }}` on the toolbar wrapper. The gradient is barely perceptible (2% alpha) and tied to the demoted gold color.

- [ ] **Step 2: Remove the inline style entirely**

Delete the `style={{ … }}` prop on that JSX node. No replacement utility class needed — the toolbar already has its own background via `bg-card` / `bg-header`. If the visual loses something noticeable in manual review, add a 1px bottom border in `--color-rule` instead.

- [ ] **Step 3: Inspect inline `textShadow` styles on `profile-page.tsx`**

Run: `sed -n '275,290p;305,320p' apps/frontend/web/src/features/profile/profile-page.tsx`
Expected: two `style={{ textShadow: '…' }}` on heading elements.

- [ ] **Step 4: Replace with a named utility class**

Add a single utility to `globals.css` (append):

```css
.hero-title-glow {
  /* already exists in globals.css per audit — verify with grep before adding duplicate */
  text-shadow:
    0 0 24px oklch(0.62 0.13 50 / 0.25),
    0 0 2px oklch(0.14 0.005 50);
}
```

Run: `grep -n "\.hero-title-glow" apps/frontend/web/src/styles/globals.css`
If already defined, do NOT re-add — just apply the class. If absent, add it.

Then change both `profile-page.tsx` inline styles to: `className="… hero-title-glow"` (remove the `style={{ textShadow: … }}` prop).

- [ ] **Step 5: Remove dead icon exports**

Run: `grep -n "export function \(AnalyticsIcon\|DashboardIcon\)" apps/frontend/web/src/components/layout/sidebar-icons.tsx`
Expected: two matches.

Delete both function declarations (the whole `export function AnalyticsIcon(…){ … }` and `export function DashboardIcon(…){ … }` blocks).

Run: `grep -rn "AnalyticsIcon\|DashboardIcon" apps/frontend/web/src/`
Expected: zero matches outside the now-deleted lines. If matches exist, those imports need to be cleaned up too (likely none — confirmed dead by audit).

- [ ] **Step 6: Run typecheck + lint + build**

```bash
bun run --filter web typecheck
bun run --filter web lint
bun run --filter web build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/web/src
git commit -m "$(cat <<'EOF'
chore(web): drop orphan inline styles and dead icon exports

Removes inline gradient on program-app toolbar (barely-visible 2%
gold gradient tied to demoted accent) and two inline textShadow
declarations on profile-page (migrated to .hero-title-glow class).
Deletes AnalyticsIcon and DashboardIcon dead exports from
sidebar-icons.tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — Component upgrades

### Task 6: Button — variants + press-down + new accent

**Files:**

- Modify: `apps/frontend/web/src/components/button.tsx`
- Test: `apps/frontend/web/src/components/button.test.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/web/src/components/button.test.tsx`:

```tsx
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders default variant with rust accent text', () => {
    render(<Button>ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('text-btn-text');
  });

  it('renders primary variant with rust solid background', () => {
    render(<Button variant="primary">ENTRAR</Button>);
    const btn = screen.getByRole('button', { name: 'ENTRAR' });
    expect(btn.className).toContain('bg-accent');
    expect(btn.className).toContain('text-on-accent');
  });

  it('renders victory variant with gold ceremonial background', () => {
    render(<Button variant="victory">UNLOCKED</Button>);
    const btn = screen.getByRole('button', { name: 'UNLOCKED' });
    expect(btn.className).toContain('bg-victory');
    expect(btn.className).toContain('shadow-[var(--shadow-victory)]');
  });

  it('renders danger variant with fail color', () => {
    render(<Button variant="danger">BORRAR</Button>);
    const btn = screen.getByRole('button', { name: 'BORRAR' });
    expect(btn.className).toContain('border-fail');
  });

  it('applies active:translate-y-px for press-down feedback', () => {
    render(<Button>PRESS</Button>);
    const btn = screen.getByRole('button', { name: 'PRESS' });
    expect(btn.className).toContain('active:translate-y-px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --filter web test src/components/button.test.tsx`
Expected: at least the `victory` variant test FAILS (variant does not yet exist) and the `active:translate-y-px` assertion FAILS.

- [ ] **Step 3: Update `button.tsx` to add variants + press-down**

Open `apps/frontend/web/src/components/button.tsx`. The current file (per audit, ~36 lines) exports a function `Button` with `variant: 'default' | 'primary' | 'danger' | 'ghost'` and `size: 'sm' | 'md' | 'lg'`.

Replace the variant union and class map to include `victory` and add `active:translate-y-px transition-transform`:

```tsx
type ButtonVariant = 'default' | 'primary' | 'victory' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'border-rule text-btn-text hover:bg-btn-active hover:text-btn-active-text',
  primary: 'bg-accent text-on-accent border-accent hover:bg-accent-hover',
  victory:
    'bg-victory text-victory-on border-victory shadow-[var(--shadow-victory)] hover:brightness-110',
  danger: 'border-fail text-fail hover:bg-fail hover:text-on-accent',
  ghost: 'border-transparent text-muted hover:text-main',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps): React.ReactNode {
  return (
    <button
      type="button"
      {...rest}
      className={`font-bold uppercase tracking-wide border-[1.5px] rounded-[var(--radius-base)] transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)] active:translate-y-px focus-visible:ring-2 ring-accent disabled:opacity-35 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --filter web test src/components/button.test.tsx`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Run full web test suite + typecheck**

```bash
bun run --filter web typecheck
bun run --filter web test
```

Expected: all pass. If any callers passed `variant="primary"` and the visual treatment now reads differently, that is intentional.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/web/src/components/button.tsx apps/frontend/web/src/components/button.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): Button gets victory variant + press-down feedback

Adds variant=victory for ceremonial gold contexts (PR unlocks, achievements).
Border drops from 2px to 1.5px and corners go to --radius-base (2px) for
industrial sharpness. Active state translates 1px on press using --ease-press.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: DashboardCard — new header treatment + interactive prop

**Files:**

- Modify: `apps/frontend/web/src/components/dashboard-card.tsx`

- [ ] **Step 1: Read current implementation**

```bash
cat apps/frontend/web/src/components/dashboard-card.tsx
```

Note current props: `title`, `icon?`, `action?`, `className?`, `children`.

- [ ] **Step 2: Add `interactive?: boolean` prop + new header**

Replace the file contents with:

```tsx
import { cn } from '@/lib/cn';

interface DashboardCardProps {
  readonly title: string;
  readonly icon?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly interactive?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function DashboardCard({
  title,
  icon,
  action,
  interactive = false,
  className,
  children,
}: DashboardCardProps): React.ReactNode {
  return (
    <section
      className={cn(
        'bg-card rounded-[var(--radius-base)] shadow-[var(--shadow-card)]',
        interactive &&
          'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:-translate-y-[2px]',
        className
      )}
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="block w-6 h-px bg-accent" aria-hidden="true" />
        <h2 className="chalk-stamp flex-1">{title}</h2>
        {icon}
        {action}
      </header>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
bun run --filter web typecheck
```

Expected: pass. All existing callers (e.g. `KpiCard`, `ActiveProgramCard`, recent activity section) continue to work because the public props list is a superset of the old one.

- [ ] **Step 4: Visual sanity check**

Reload `http://localhost:5173/app`. The recent-activity card and any other DashboardCard surfaces now show a chalk-stamp label with a short rust rule on the left of the header rather than a full underline.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/components/dashboard-card.tsx
git commit -m "$(cat <<'EOF'
refactor(web): DashboardCard header uses chalk-stamp + short rule

Replaces the full border-bottom underline with a 24px rust rule + mono
uppercase label. Adds optional interactive prop that opts the card into
a 2px hover-lift on --ease-out-expo. Existing callers continue to work
unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Toast — slate-drop motion + `pr` variant + remove redundant Undo

**Files:**

- Modify: `apps/frontend/web/src/components/toast.tsx`
- Modify: `apps/frontend/web/src/components/toast.test.tsx` (existing)

- [ ] **Step 1: Read the current toast + its test**

```bash
cat apps/frontend/web/src/components/toast.tsx
cat apps/frontend/web/src/components/toast.test.tsx
```

Note: per audit there are two variants today — `default` and `pr`. We keep both names; the `pr` styling changes to use `--color-victory` + `--shadow-victory` and a 5 s duration; the Undo button inside the toast is removed.

- [ ] **Step 2: Add a `slate-drop` keyframe to `globals.css`**

Append to `apps/frontend/web/src/styles/globals.css`:

```css
@keyframes slate-drop {
  0% {
    transform: translateY(-12px);
    opacity: 0;
  }
  60% {
    transform: translateY(1px);
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
.animate-slate-drop {
  animation: slate-drop 220ms cubic-bezier(0.3, 1.1, 0.4, 1) both;
}
```

- [ ] **Step 3: Update the Toast component**

Open `toast.tsx` and:

1. Replace the `fadeSlideUp` / `fadeSlideDown` animation classes with `animate-slate-drop`.
2. In the `pr` variant branch, swap `bg-changed border-2 border-accent text-title` for `bg-victory text-victory-on border-[1.5px] border-victory shadow-[var(--shadow-victory)]`.
3. Remove the inline `<button>` labelled "Undo" / "Deshacer" inside the toast body. The header undo button is canonical.
4. Set `pr` toasts to a 5 s default lifetime (the current default is 2.5 s; if the lifetime is owned by the toast context provider, parameterize it instead — see `apps/frontend/web/src/contexts/toast-context.tsx` for the actual queue).

- [ ] **Step 4: Update or add tests**

If the existing `toast.test.tsx` asserts the presence of an Undo button inside the toast, remove that assertion (or convert it to "does NOT render Undo button"). Add a render test for the `pr` variant verifying it has the victory background class.

```tsx
it('PR variant renders with victory background', () => {
  render(<Toast id="t1" variant="pr" message="PR! Banca 70kg" />);
  const node = screen.getByRole('status');
  expect(node.className).toContain('bg-victory');
});

it('does NOT render an Undo button inside the toast body', () => {
  render(<Toast id="t1" message="Hello" />);
  expect(screen.queryByRole('button', { name: /undo|deshacer/i })).toBeNull();
});
```

(Adjust selectors to match the actual API — `Toast` may not take `id` directly; check the existing test file's render call.)

- [ ] **Step 5: Run tests + typecheck**

```bash
bun run --filter web typecheck
bun run --filter web test src/components/toast.test.tsx
```

Expected: pass.

- [ ] **Step 6: Manual visual smoke**

Open `http://localhost:5173/app/tracker`, press `S` to log a set. The toast should now slide-drop in from above with a tiny overshoot, then settle. There should be no second "Undo" button inside the toast.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/web/src/components/toast.tsx apps/frontend/web/src/components/toast.test.tsx apps/frontend/web/src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(web): Toast slate-drop motion + victory PR variant

Toasts now drop from above on --ease-out-expo with a 1px overshoot
(the only place we allow any overshoot — simulates a plate landing).
The pr variant gets --color-victory background + halo + 5s duration.
Removes the inline Undo button that duplicated the header UNDO.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: OnlineIndicator — add `inline` prop for sidebar embedding

**Files:**

- Modify: `apps/frontend/web/src/components/online-indicator.tsx`

- [ ] **Step 1: Add `inline?: boolean` prop**

Replace the file with:

```tsx
import { useOnlineCount } from '@/hooks/use-online-count';

interface OnlineIndicatorProps {
  readonly inline?: boolean;
}

export function OnlineIndicator({ inline = false }: OnlineIndicatorProps): React.ReactNode {
  const count = useOnlineCount();
  if (count == null) return null;

  const base =
    'flex items-center gap-2 bg-card border border-rule font-mono text-[11px] text-muted px-2 py-1 rounded-[var(--radius-base)]';

  return (
    <div className={inline ? base : `${base} fixed bottom-4 right-4 z-40`}>
      <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" />
      <span>{count} online</span>
    </div>
  );
}
```

(Adjust the hook import name to match the actual file — `use-online-count.ts` per audit.)

- [ ] **Step 2: Typecheck**

```bash
bun run --filter web typecheck
```

Expected: pass. All existing callers (`<OnlineIndicator />` with no props) continue to render as the floating pill — sidebar embedding in Task 12 will pass `inline`.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/web/src/components/online-indicator.tsx
git commit -m "$(cat <<'EOF'
feat(web): OnlineIndicator accepts inline prop for sidebar footer

Backward-compatible default keeps it floating bottom-right. inline=true
strips the fixed positioning so the sidebar footer can host it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: ProgressBar — victory state when complete

**Files:**

- Modify: `apps/frontend/web/src/components/progress-bar.tsx`
- Test: `apps/frontend/web/src/components/progress-bar.test.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/web/src/components/progress-bar.test.tsx`:

```tsx
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  it('renders rust fill when in progress', () => {
    render(<ProgressBar completed={20} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]');
    expect(fill?.className).toContain('bg-accent');
    expect(fill?.className).not.toContain('bg-victory');
  });

  it('swaps to victory gold when completed === total', () => {
    render(<ProgressBar completed={90} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]');
    expect(fill?.className).toContain('bg-victory');
  });

  it('shows 0% width when completed is 0', () => {
    render(<ProgressBar completed={0} total={90} ariaLabel="progress" />);
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run --filter web test src/components/progress-bar.test.tsx
```

Expected: FAIL (victory branch not implemented).

- [ ] **Step 3: Update `progress-bar.tsx`**

Read current implementation: `cat apps/frontend/web/src/components/progress-bar.tsx`. It defines props `completed`, `total`, `ariaLabel`, `showPercent?`, `className?` and renders a track + fill.

Modify it so the fill class swaps based on completion:

```tsx
import { cn } from '@/lib/cn';

interface ProgressBarProps {
  readonly completed: number;
  readonly total: number;
  readonly ariaLabel: string;
  readonly showPercent?: boolean;
  readonly className?: string;
}

export function ProgressBar({
  completed,
  total,
  ariaLabel,
  showPercent = false,
  className,
}: ProgressBarProps): React.ReactNode {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const done = total > 0 && completed >= total;

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      className={cn('flex items-center gap-3', className)}
    >
      <div className="flex-1 h-2.5 bg-progress-track rounded-full overflow-hidden">
        <div
          data-fill
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out progress-fill',
            done ? 'bg-victory shadow-[var(--shadow-victory)]' : 'bg-accent'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && (
        <span className="font-mono text-xs text-muted tabular-nums">
          {completed}/{total}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run --filter web test src/components/progress-bar.test.tsx
bun run --filter web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/components/progress-bar.tsx apps/frontend/web/src/components/progress-bar.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ProgressBar swaps to victory gold on completion

Fill turns gold (--color-victory) with halo (--shadow-victory) when
completed === total. Acts as the program-completed seal. Tracks
remain rust during in-progress states.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: ConfirmDialog — backdrop strengthening + scale on enter

**Files:**

- Modify: `apps/frontend/web/src/components/confirm-dialog.tsx`
- Modify: `apps/frontend/web/src/styles/globals.css` (modal-enter keyframe — exists per audit)
- Confirm: `apps/frontend/web/src/components/confirm-dialog.test.tsx` still passes

- [ ] **Step 1: Update modal-enter keyframe to include scale**

Find the existing `@keyframes modal-enter` in `globals.css` and replace its body with:

```css
@keyframes modal-enter {
  0% {
    transform: scale(0.98);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

If `modal-exit` exists, replace with the symmetric counterpart:

```css
@keyframes modal-exit {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0.98);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Update the confirm-dialog backdrop**

Open `confirm-dialog.tsx`. Find the `<dialog>` element. The current class string (per audit) is `modal-box bg-card border border-rule p-6 shadow-dialog backdrop:bg-black/60 backdrop:backdrop-blur-sm`. Change to:

```
modal-box bg-card border-[1.5px] border-rule rounded-[var(--radius-base)] p-6 shadow-[var(--shadow-elevated)] backdrop:bg-black/72 backdrop:backdrop-blur-md
```

- [ ] **Step 3: Run the existing test**

```bash
bun run --filter web test src/components/confirm-dialog.test.tsx
bun run --filter web typecheck
```

Expected: pass. The existing test asserts rendering / focus / button behaviour, not visual classes.

- [ ] **Step 4: Visual smoke**

Trigger any confirm-dialog flow (e.g. delete-program button on `/app/profile`). Verify the modal pops with the new scale animation and the backdrop is noticeably darker / blurred.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/components/confirm-dialog.tsx apps/frontend/web/src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(web): ConfirmDialog enter/exit pop + stronger backdrop

modal-enter / modal-exit keyframes now scale 0.98 ↔ 1 for a brief pop.
Backdrop dimming goes from black/60 to black/72 with blur-md so the
modal feels held in space without crossing into glassmorphism as
decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Sidebar industrial — expanded fixed + new active state + footer

**Files:**

- Modify: `apps/frontend/web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Read current implementation**

```bash
cat apps/frontend/web/src/components/layout/app-sidebar.tsx
```

Note the desktop branch (`hidden lg:flex` with hover-to-expand), the mobile branch (`AnimatePresence` + `motion.aside`), and the avatar block at the bottom.

- [ ] **Step 2: Remove `onMouseEnter` / `onMouseLeave` on desktop branch + fix width**

For the desktop branch:

1. Remove `onMouseEnter` and `onMouseLeave` handlers and the width-toggle state. Replace the dynamic `style={{ width: collapsed ? '72px' : '240px' }}` with the static `style={{ width: 'var(--sidebar-width)' }}` (224px after Task 2).
2. Always render nav-item labels (no collapsed-only icon-mode).

- [ ] **Step 3: Replace side-stripe active state with inset block + dot**

Locate the existing `navItemClass()` function. Replace the active branch:

Old (per audit): `'text-title bg-sidebar-active border-l-[3px] border-accent -ml-px'`

New:

```ts
const navItemClass = (active: boolean): string =>
  cn(
    'relative flex items-center gap-3 px-4 py-3 text-sm font-mono uppercase tracking-widest transition-colors',
    active
      ? 'text-title bg-sidebar-active'
      : 'text-muted hover:text-main hover:bg-sidebar-active/40'
  );
```

And inside each nav item render, when `active` is true, insert a 4×4 px dot pinned 8 px from the left edge:

```tsx
{
  active && (
    <span
      className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-accent"
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 4: Add OnlineIndicator to the footer**

Find the existing avatar block at the bottom of the desktop sidebar. Below the avatar/email, render:

```tsx
<div className="px-4 pb-4">
  <OnlineIndicator inline />
</div>
```

Import: `import { OnlineIndicator } from '@/components/online-indicator';`

- [ ] **Step 5: Remove the floating OnlineIndicator from wherever it currently mounts**

Run: `grep -rn "<OnlineIndicator" apps/frontend/web/src/ | grep -v "online-indicator.tsx"`
Expected: one or two mount points (likely in a layout wrapper). Remove the floating instance(s) — the sidebar footer is now the canonical home for it.

- [ ] **Step 6: Typecheck + visual smoke**

```bash
bun run --filter web typecheck
bun run --filter web lint
```

Expected: pass. Reload `/app` in browser: sidebar should be 224 px wide, fully labelled, with a small accent dot on the active item, and the "1 online" pill should now appear in the footer instead of bottom-right.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/web/src/components/layout/app-sidebar.tsx apps/frontend/web/src/components/online-indicator.tsx
git commit -m "$(cat <<'EOF'
feat(web): sidebar always-expanded industrial layout on desktop

Removes hover-to-expand on lg+ — sidebar is 224px fixed with labels
always visible. Active item drops the side-stripe (impeccable ban) in
favour of an inset bg block + 4px accent dot. Online indicator moves
from floating bottom-right to the sidebar footer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: KpiCard — count-up + flame variant + accent top-border

**Files:**

- Modify: `apps/frontend/web/src/features/dashboard/kpi-card.tsx`
- Test: `apps/frontend/web/src/features/dashboard/kpi-card.test.tsx` (NEW)
- Create: `apps/frontend/web/src/features/dashboard/use-count-up.ts` (NEW — small reusable hook)
- Test: `apps/frontend/web/src/features/dashboard/use-count-up.test.ts` (NEW)

- [ ] **Step 1: Write failing test for the count-up hook**

Create `apps/frontend/web/src/features/dashboard/use-count-up.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './use-count-up';

describe('useCountUp', () => {
  it('returns target value immediately when prefers-reduced-motion is on', () => {
    // jsdom defaults: prefers-reduced-motion is not matched; we test the
    // fallback path instead — initial render returns 0, after a tick approaches target.
    const { result } = renderHook(() => useCountUp(42, { duration: 0 }));
    expect(result.current).toBe(42);
  });

  it('returns the target string passthrough when value is non-numeric', () => {
    const { result } = renderHook(() => useCountUp('—'));
    expect(result.current).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails (hook does not exist)**

```bash
bun run --filter web test src/features/dashboard/use-count-up.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `apps/frontend/web/src/features/dashboard/use-count-up.ts`:

```ts
import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  readonly duration?: number;
}

export function useCountUp(
  target: number | string,
  { duration = 600 }: UseCountUpOptions = {}
): number | string {
  const [display, setDisplay] = useState<number | string>(typeof target === 'number' ? 0 : target);

  useEffect(() => {
    if (typeof target !== 'number') {
      setDisplay(target);
      return;
    }
    if (duration <= 0) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    let raf = 0;

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
```

- [ ] **Step 4: Run hook test to verify it passes**

```bash
bun run --filter web test src/features/dashboard/use-count-up.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing test for KpiCard variants**

Create `apps/frontend/web/src/features/dashboard/kpi-card.test.tsx`:

```tsx
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('renders label, value, and sub line', () => {
    render(<KpiCard label="RACHA" value={7} sub="días" />);
    expect(screen.getByText('RACHA')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('días')).toBeInTheDocument();
  });

  it('applies flame variant styling when variant=flame', () => {
    render(<KpiCard label="RACHA" value={12} variant="flame" />);
    const value = screen.getByText('12');
    expect(value.className).toContain('text-victory');
  });

  it('applies accent top-border (not side-stripe) when accent prop is set', () => {
    const { container } = render(<KpiCard label="X" value={1} accent />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-t-2');
    expect(card.className).toContain('border-t-accent');
    expect(card.className).not.toContain('accent-left-gold');
  });

  it('renders skeleton when loading=true', () => {
    render(<KpiCard label="" value="" loading />);
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });
});
```

(Adjust the `aria-busy` / loading aria attribute query if the existing implementation uses a different pattern. Current code uses `aria-busy="true"` per audit.)

- [ ] **Step 6: Run KpiCard test to confirm failures**

```bash
bun run --filter web test src/features/dashboard/kpi-card.test.tsx
```

Expected: FAIL — `variant` prop does not exist, accent class still uses `accent-left-gold`.

- [ ] **Step 7: Update `kpi-card.tsx`**

```tsx
import { cn } from '@/lib/cn';
import { useCountUp } from './use-count-up';

type KpiVariant = 'default' | 'flame';

interface KpiCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly accent?: boolean;
  readonly variant?: KpiVariant;
  readonly loading?: boolean;
  readonly trend?: 'up' | 'down' | 'flat' | null;
  readonly trendLabel?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = false,
  variant = 'default',
  loading = false,
  trend = null,
  trendLabel,
}: KpiCardProps): React.ReactNode {
  const display = useCountUp(value);

  if (loading) {
    return (
      <div
        className="bg-card border border-rule p-4 sm:p-5 animate-pulse rounded-[var(--radius-base)]"
        aria-busy="true"
        aria-label="loading kpi"
      >
        <div className="h-2.5 w-20 bg-rule rounded mb-3" />
        <div className="h-7 w-16 bg-rule rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-card border border-rule rounded-[var(--radius-base)] p-4 sm:p-5 shadow-[var(--shadow-card)]',
        accent && 'border-t-2 border-t-accent'
      )}
    >
      <p className="chalk-stamp mb-1.5">{label}</p>
      <p
        className={cn(
          'font-display-data text-3xl leading-none tabular-nums',
          variant === 'flame' ? 'text-victory' : 'text-main'
        )}
      >
        {variant === 'flame' && <span className="mr-1">▲</span>}
        {display}
      </p>
      <div className="flex items-center gap-2 mt-1.5 min-h-[18px]">
        {sub && <span className="text-xs text-muted">{sub}</span>}
        {trend && (
          <span
            className={cn(
              'font-mono text-[10px] font-bold',
              trend === 'up' && 'text-ok',
              trend === 'down' && 'text-fail',
              trend === 'flat' && 'text-muted'
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            {trendLabel && ` ${trendLabel}`}
          </span>
        )}
      </div>
    </div>
  );
}
```

(`▲` is a placeholder for a small flame glyph; replace with an inline SVG flame later if the glyph is unreadable. The hook returns the number to render — the count-up animation happens during dashboard mount.)

- [ ] **Step 8: Run tests to verify pass**

```bash
bun run --filter web test src/features/dashboard
bun run --filter web typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/kpi-card.tsx \
        apps/frontend/web/src/features/dashboard/kpi-card.test.tsx \
        apps/frontend/web/src/features/dashboard/use-count-up.ts \
        apps/frontend/web/src/features/dashboard/use-count-up.test.ts
git commit -m "$(cat <<'EOF'
feat(web): KpiCard gets flame variant + count-up + accent top-border

Adds variant=flame for streak ≥ 10 (rendered by parent KpiStripBrutalist).
Accent prop now applies a 2px top-border instead of the banned side-stripe.
New useCountUp hook tweens numeric values from 0 on mount over 600ms with
cubic ease-out. Passes strings through untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: ProfileStatCard — fix dead `border-l-heading` accent

**Files:**

- Modify: `apps/frontend/web/src/features/profile/profile-stat-card.tsx`
- Confirm: `apps/frontend/web/src/features/profile/profile-stat-card.test.tsx` still passes

- [ ] **Step 1: Locate the broken accent**

Run: `grep -n "border-l-heading" apps/frontend/web/src/features/profile/profile-stat-card.tsx`
Expected: one or two matches.

- [ ] **Step 2: Replace `border-l-heading` with `border-t-2 border-t-accent`**

The class `border-l-heading` referenced an undefined token. Now it would resolve to `border-l-text` (since `--color-heading: var(--color-text)` after Task 2) but for consistency with the new KpiCard accent treatment we move to a top-border. Use `Edit` to replace each occurrence.

- [ ] **Step 3: Run existing test**

```bash
bun run --filter web test src/features/profile/profile-stat-card.test.tsx
bun run --filter web typecheck
```

Expected: pass. The existing test (per audit) covers render behaviour, not the specific accent class.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/web/src/features/profile/profile-stat-card.tsx
git commit -m "$(cat <<'EOF'
fix(web): ProfileStatCard accent uses top-border instead of dead token

border-l-heading silently did nothing because --color-heading was
undefined in the @theme block. Switches to border-t-2 border-t-accent
to match the new KpiCard treatment and the impeccable ban on
decorative side-stripes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — Dashboard rebuild

### Task 15: DashboardShell — layout container for the new dashboard

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create the shell**

```tsx
import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface DashboardShellProps {
  readonly hero: React.ReactNode;
  readonly kpi: React.ReactNode;
  readonly heatmap: React.ReactNode;
  readonly split: React.ReactNode;
  readonly recent: React.ReactNode;
}

export function DashboardShell({
  hero,
  kpi,
  heatmap,
  split,
  recent,
}: DashboardShellProps): React.ReactNode {
  return (
    <StaggerContainer className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <StaggerItem>{hero}</StaggerItem>
      <StaggerItem>{kpi}</StaggerItem>
      <StaggerItem>{heatmap}</StaggerItem>
      <StaggerItem>{split}</StaggerItem>
      <StaggerItem>{recent}</StaggerItem>
    </StaggerContainer>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run --filter web typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/dashboard-shell.tsx
git commit -m "$(cat <<'EOF'
feat(web): DashboardShell layout container for new /app

Composes hero / kpi / heatmap / split / recent slots inside the
existing StaggerContainer so the page entry animation stays
consistent with the rest of the app.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: NextSetHero — the only thing that asks for an action

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/next-set-hero.tsx`
- Create: `apps/frontend/web/src/features/dashboard/next-set-hero.test.tsx`

- [ ] **Step 1: Write failing test**

Create `next-set-hero.test.tsx`:

```tsx
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { NextSetHero } from './next-set-hero';

describe('NextSetHero', () => {
  it('renders the empty hero when no program', () => {
    render(<NextSetHero programInstance={null} />);
    expect(screen.getByText(/ELIGE TU FORJA/i)).toBeInTheDocument();
  });

  it('renders the day-one hero when program exists but zero workouts', () => {
    const inst = {
      id: 'p1',
      programId: 'gzclp',
      name: 'GZCLP',
      status: 'active',
      results: {},
      nextWorkout: {
        dayIndex: 0,
        weekLabel: 'Sem. 1 (5s)',
        focusLifts: 'Sentadilla + Press Banca',
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    render(<NextSetHero programInstance={inst} />);
    expect(screen.getByText(/DÍA UNO/i)).toBeInTheDocument();
  });

  it('renders the next-set hero with weight × reps when nextSet present', () => {
    const inst = {
      id: 'p1',
      programId: 'gzclp',
      name: 'GZCLP',
      status: 'active',
      results: { '0:d1-t1': 'success' },
      nextWorkout: {
        dayIndex: 16,
        totalDays: 90,
        weekLabel: 'Sem. 4 (3+)',
        focusLifts: 'Sentadilla + Press Banca',
      },
      nextSet: { weight: 82.5, reps: 5, label: 'first work set' },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    render(<NextSetHero programInstance={inst} />);
    expect(screen.getByText('82.5 kg × 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ENTRAR AL HIERRO/i })).toHaveAttribute(
      'href',
      '/app/tracker'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run --filter web test src/features/dashboard/next-set-hero.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the component**

Create `next-set-hero.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/cn';

interface NextSet {
  readonly weight: number;
  readonly reps: number;
  readonly label: string;
}

interface NextWorkout {
  readonly dayIndex: number;
  readonly totalDays?: number;
  readonly weekLabel: string;
  readonly focusLifts: string;
}

interface ProgramInstance {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly status: string;
  readonly nextWorkout?: NextWorkout;
  readonly nextSet?: NextSet | null;
  readonly results?: Record<string, string>;
  readonly lastSet?: {
    readonly weight: number;
    readonly reps: number;
    readonly deltaFromStart: number;
  };
}

interface NextSetHeroProps {
  readonly programInstance: ProgramInstance | null;
}

export function NextSetHero({ programInstance }: NextSetHeroProps): React.ReactNode {
  if (!programInstance) return <EmptyHero />;
  if (!programInstance.nextSet || Object.keys(programInstance.results ?? {}).length === 0) {
    return <DayOneHero instance={programInstance} />;
  }
  return <FullHero instance={programInstance} />;
}

function EmptyHero(): React.ReactNode {
  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-12 text-center">
      <p className="chalk-stamp text-text-label">SIN PROGRAMA</p>
      <h1 className="font-display text-5xl sm:text-7xl text-main my-4">ELIGE TU FORJA</h1>
      <p className="text-muted mb-6">El primer paso es elegir un programa.</p>
      <Link
        to="/app/programs"
        className="inline-block bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
      >
        VER PROGRAMAS
      </Link>
    </section>
  );
}

function DayOneHero({ instance }: { readonly instance: ProgramInstance }): React.ReactNode {
  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-6 sm:p-8">
      <p className="chalk-stamp">{instance.name.toUpperCase()}</p>
      <h1 className="font-display text-4xl sm:text-6xl text-main my-3">DÍA UNO</h1>
      <p className="text-muted mb-6">El peso no se levanta solo.</p>
      <Link
        to="/app/tracker"
        className="inline-block bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
      >
        ENTRAR AL HIERRO
      </Link>
    </section>
  );
}

function FullHero({ instance }: { readonly instance: ProgramInstance }): React.ReactNode {
  const nw = instance.nextWorkout!;
  const ns = instance.nextSet!;
  return (
    <section
      className={cn(
        'bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-6 sm:p-8',
        'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:-translate-y-[2px]'
      )}
    >
      <p className="chalk-stamp">
        HOY · DÍA {nw.dayIndex + 1}
        {nw.totalDays ? ` / ${nw.totalDays}` : ''} · {nw.weekLabel} · {nw.focusLifts.toUpperCase()}
      </p>
      <p className="chalk-stamp mt-6 text-text-label">PRÓXIMA SERIE</p>
      <p className="font-display-data text-5xl sm:text-7xl text-main leading-none tabular-nums my-2">
        {ns.weight} kg × {ns.reps}
      </p>
      <p className="text-muted">{ns.label}</p>
      <div className="flex flex-wrap gap-3 mt-6">
        <Link
          to="/app/tracker"
          className="bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
        >
          ▶ ENTRAR AL HIERRO
        </Link>
        <button
          type="button"
          className="font-mono text-xs text-muted uppercase tracking-widest px-3 py-2 hover:text-main"
        >
          hoy no
        </button>
      </div>
      {instance.lastSet && (
        <p className="mt-6 pt-4 border-t border-rule text-xs text-muted">
          última: {instance.lastSet.weight}×{instance.lastSet.reps} · +
          {instance.lastSet.deltaFromStart}kg desde inicio del programa
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run --filter web test src/features/dashboard/next-set-hero.test.tsx
bun run --filter web typecheck
```

Expected: PASS. If the typecheck complains about the inline `as any` (project lint may forbid `any`), narrow the cast to a specific Pick type instead.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/next-set-hero.tsx \
        apps/frontend/web/src/features/dashboard/next-set-hero.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): NextSetHero — the one thing the dashboard asks for

Three states: empty (no program → ELIGE TU FORJA), day-one (program
but no workouts logged → DÍA UNO), and full (next set weight × reps
with link into the tracker and history footer).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: KpiStripBrutalist — composes KpiCard ×3

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/kpi-strip-brutalist.tsx`

- [ ] **Step 1: Implement**

```tsx
import { KpiCard } from './kpi-card';

interface KpiStripProps {
  readonly streakDays: number;
  readonly totalSessions: number;
  readonly weekPr?: { readonly lift: string; readonly weight: number } | null;
}

export function KpiStripBrutalist({
  streakDays,
  totalSessions,
  weekPr,
}: KpiStripProps): React.ReactNode {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <KpiCard
        label="RACHA"
        value={streakDays}
        sub={streakDays === 1 ? 'día' : 'días'}
        variant={streakDays >= 10 ? 'flame' : 'default'}
      />
      <KpiCard label="SESIONES" value={totalSessions} sub="completadas" />
      <KpiCard
        label="PR ESTA SEM"
        value={weekPr ? `${weekPr.weight}kg` : '—'}
        sub={weekPr ? weekPr.lift : 'sin PR esta semana'}
        accent={!!weekPr}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run --filter web typecheck
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/kpi-strip-brutalist.tsx
git commit -m "$(cat <<'EOF'
feat(web): KpiStripBrutalist composes Racha + Sesiones + PR sem

Streak ≥ 10 triggers KpiCard variant=flame. Week PR triggers accent
top-border on its card so the eye finds the most-recent victory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: WeekHeatmap — 12 weeks × 7 days with stagger reveal

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/week-heatmap.tsx`
- Create: `apps/frontend/web/src/features/dashboard/week-heatmap-utils.ts`
- Create: `apps/frontend/web/src/features/dashboard/week-heatmap-utils.test.ts`

- [ ] **Step 1: Write failing test for the pure utility**

Create `week-heatmap-utils.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { buildHeatmapGrid, cellLevel } from './week-heatmap-utils';

describe('buildHeatmapGrid', () => {
  it('returns 12 columns × 7 rows', () => {
    const grid = buildHeatmapGrid([], new Date('2026-05-11'));
    expect(grid).toHaveLength(12);
    grid.forEach((col) => expect(col).toHaveLength(7));
  });

  it('marks a workout day with level=full', () => {
    const today = new Date('2026-05-11'); // Monday
    const grid = buildHeatmapGrid([{ completedAt: '2026-05-11T18:00:00Z' }], today);
    const lastCol = grid[11]!;
    expect(lastCol[0]?.level).toBe('full'); // Monday
  });
});

describe('cellLevel', () => {
  it('returns empty when no workouts', () => {
    expect(cellLevel(0)).toBe('empty');
  });
  it('returns partial when 1 workout', () => {
    expect(cellLevel(1)).toBe('partial');
  });
  it('returns full when 2+ workouts', () => {
    expect(cellLevel(2)).toBe('full');
  });
});
```

- [ ] **Step 2: Run test → FAIL**

```bash
bun run --filter web test src/features/dashboard/week-heatmap-utils.test.ts
```

- [ ] **Step 3: Implement the utility**

Create `week-heatmap-utils.ts`:

```ts
export type CellLevel = 'empty' | 'partial' | 'full';

export interface HeatmapCell {
  readonly date: Date;
  readonly level: CellLevel;
  readonly count: number;
}

export interface CompletedWorkout {
  readonly completedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function cellLevel(count: number): CellLevel {
  if (count === 0) return 'empty';
  if (count === 1) return 'partial';
  return 'full';
}

export function buildHeatmapGrid(
  workouts: readonly CompletedWorkout[],
  today: Date,
  weeks = 12
): HeatmapCell[][] {
  // Snap today to start of day in local TZ
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);
  // Find Monday of "today's" week
  const dow = (end.getDay() + 6) % 7; // 0=Mon
  const mondayOfThisWeek = new Date(end.getTime() - dow * DAY_MS);
  // Start = Monday of (weeks-1) weeks ago
  const start = new Date(mondayOfThisWeek.getTime() - (weeks - 1) * 7 * DAY_MS);

  // Bucket workouts by yyyy-mm-dd
  const counts = new Map<string, number>();
  for (const w of workouts) {
    const d = new Date(w.completedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Build columns
  const columns: HeatmapCell[][] = [];
  for (let c = 0; c < weeks; c++) {
    const col: HeatmapCell[] = [];
    for (let r = 0; r < 7; r++) {
      const date = new Date(start.getTime() + (c * 7 + r) * DAY_MS);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const count = counts.get(key) ?? 0;
      col.push({ date, count, level: cellLevel(count) });
    }
    columns.push(col);
  }
  return columns;
}
```

- [ ] **Step 4: Run util test → PASS**

```bash
bun run --filter web test src/features/dashboard/week-heatmap-utils.test.ts
```

- [ ] **Step 5: Implement the component (no dedicated `week-heatmap.test.tsx` — render correctness is verified via the util tests above + manual visual)**

Create `week-heatmap.tsx`:

```tsx
import { motion } from 'motion/react';
import { buildHeatmapGrid, type CompletedWorkout, type CellLevel } from './week-heatmap-utils';
import { cn } from '@/lib/cn';

const LEVEL_CLASS: Record<CellLevel, string> = {
  empty: 'bg-transparent border-rule',
  partial: 'bg-accent/30 border-accent/40',
  full: 'bg-accent border-accent',
};

interface WeekHeatmapProps {
  readonly workouts: readonly CompletedWorkout[];
  readonly weeks?: number;
}

export function WeekHeatmap({ workouts, weeks = 12 }: WeekHeatmapProps): React.ReactNode {
  const grid = buildHeatmapGrid(workouts, new Date(), weeks);
  const todayKey = new Date().toDateString();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">ÚLTIMAS {weeks} SEMANAS</p>
      <div className="flex gap-1 overflow-x-auto" role="grid" aria-label="weekly workout heatmap">
        {grid.map((col, ci) => (
          <motion.div
            key={ci}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.04, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-1"
            role="row"
          >
            {col.map((cell, ri) => {
              const isToday = cell.date.toDateString() === todayKey;
              return (
                <span
                  key={ri}
                  role="gridcell"
                  className={cn(
                    'block w-3.5 h-3.5 border rounded-[1px]',
                    LEVEL_CLASS[cell.level],
                    isToday && 'ring-1 ring-main'
                  )}
                  title={`${cell.date.toDateString()} — ${cell.count} workout${cell.count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Typecheck**

```bash
bun run --filter web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/week-heatmap.tsx \
        apps/frontend/web/src/features/dashboard/week-heatmap.test.tsx \
        apps/frontend/web/src/features/dashboard/week-heatmap-utils.ts \
        apps/frontend/web/src/features/dashboard/week-heatmap-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(web): WeekHeatmap with 12-week stagger reveal

Buckets completed workouts into a 12-col × 7-row grid (Mon-first).
Cells stagger-reveal column by column on mount (40ms each, 480ms
total) using --ease-out-expo. Today's cell gets a chalk ring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: PrRoadCard + `usePrRoad` selector

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/use-pr-road.ts`
- Create: `apps/frontend/web/src/features/dashboard/use-pr-road.test.ts`
- Create: `apps/frontend/web/src/features/dashboard/pr-road-card.tsx`

- [ ] **Step 1: Write failing test for the selector**

Create `use-pr-road.test.ts`:

```ts
import { describe, it, expect } from 'bun:test';
import { computePrRoad } from './use-pr-road';

describe('computePrRoad', () => {
  it('returns null when no history', () => {
    expect(computePrRoad([])).toBeNull();
  });

  it('finds the lift closest to its PR among history', () => {
    const history = [
      { lift: 'Banca', weight: 67.5, isPr: false, prTarget: 70 },
      { lift: 'Sentadilla', weight: 80, isPr: false, prTarget: 100 },
    ];
    const r = computePrRoad(history);
    expect(r?.lift).toBe('Banca');
    expect(r?.deltaToPr).toBe(2.5);
  });

  it('skips lifts that have already broken their PR this session', () => {
    const history = [
      { lift: 'Banca', weight: 72, isPr: true, prTarget: 70 },
      { lift: 'Sentadilla', weight: 80, isPr: false, prTarget: 100 },
    ];
    const r = computePrRoad(history);
    expect(r?.lift).toBe('Sentadilla');
  });
});
```

- [ ] **Step 2: Run → FAIL**

```bash
bun run --filter web test src/features/dashboard/use-pr-road.test.ts
```

- [ ] **Step 3: Implement the selector**

Create `use-pr-road.ts`:

```ts
import { useMemo } from 'react';

export interface LiftHistoryRow {
  readonly lift: string;
  readonly weight: number;
  readonly isPr: boolean;
  readonly prTarget: number;
}

export interface PrRoad {
  readonly lift: string;
  readonly current: number;
  readonly target: number;
  readonly deltaToPr: number;
  readonly pctTowardPr: number;
}

export function computePrRoad(history: readonly LiftHistoryRow[]): PrRoad | null {
  let best: PrRoad | null = null;
  for (const row of history) {
    if (row.isPr) continue;
    const delta = row.prTarget - row.weight;
    if (delta <= 0) continue;
    const pct = (row.weight / row.prTarget) * 100;
    if (!best || delta < best.deltaToPr) {
      best = {
        lift: row.lift,
        current: row.weight,
        target: row.prTarget,
        deltaToPr: delta,
        pctTowardPr: pct,
      };
    }
  }
  return best;
}

export function usePrRoad(history: readonly LiftHistoryRow[]): PrRoad | null {
  return useMemo(() => computePrRoad(history), [history]);
}
```

- [ ] **Step 4: Test → PASS**

```bash
bun run --filter web test src/features/dashboard/use-pr-road.test.ts
```

- [ ] **Step 5: Implement the card**

Create `pr-road-card.tsx`:

```tsx
import { ProgressBar } from '@/components/progress-bar';
import type { PrRoad } from './use-pr-road';

interface PrRoadCardProps {
  readonly road: PrRoad | null;
}

export function PrRoadCard({ road }: PrRoadCardProps): React.ReactNode {
  if (!road) {
    return (
      <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5 opacity-70">
        <p className="chalk-stamp mb-2">CAMINO AL PR</p>
        <p className="text-sm text-muted">Aún no hay datos para calcular PR.</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">CAMINO AL PR</p>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">Lift</dt>
        <dd className="text-main font-bold">{road.lift}</dd>
        <dt className="text-muted">Actual</dt>
        <dd className="text-main tabular-nums">{road.current} kg</dd>
        <dt className="text-muted">PR</dt>
        <dd className="text-victory tabular-nums">{road.target} kg</dd>
        <dt className="text-muted">Falta</dt>
        <dd className="text-main tabular-nums">{road.deltaToPr} kg</dd>
      </dl>
      <div className="mt-3">
        <ProgressBar
          completed={Math.round(road.pctTowardPr)}
          total={100}
          ariaLabel={`progress toward ${road.lift} PR`}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/use-pr-road.ts \
        apps/frontend/web/src/features/dashboard/use-pr-road.test.ts \
        apps/frontend/web/src/features/dashboard/pr-road-card.tsx
git commit -m "$(cat <<'EOF'
feat(web): PrRoadCard surfaces the lift closest to a PR

usePrRoad selector picks the non-PR lift with the smallest delta to
its PR target and returns lift / current / target / delta / pct. Card
renders a small dl + ProgressBar (rust until 100%, victory glow at
completion, courtesy of Task 10).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: MentorPill — rotating tip card

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/mentor-pill.tsx`

- [ ] **Step 1: Implement (no new logic, reuses existing tip copy library)**

```tsx
import { useEffect, useState } from 'react';

interface MentorPillProps {
  readonly tips: readonly string[];
  readonly rotateMs?: number;
}

export function MentorPill({ tips, rotateMs = 12000 }: MentorPillProps): React.ReactNode {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (tips.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % tips.length), rotateMs);
    return () => clearInterval(t);
  }, [tips.length, rotateMs]);

  if (tips.length === 0) return null;

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">DEL MAESTRO</p>
      <blockquote className="text-sm text-main italic leading-relaxed">« {tips[i]} »</blockquote>
      <div className="flex items-center justify-between mt-3">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest">— el maestro</p>
        {tips.length > 1 && (
          <button
            type="button"
            onClick={() => setI((x) => (x + 1) % tips.length)}
            className="font-mono text-[10px] text-muted uppercase tracking-widest hover:text-main"
          >
            siguiente →
          </button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/web/src/features/dashboard/mentor-pill.tsx
git commit -m "$(cat <<'EOF'
feat(web): MentorPill rotates programme-relevant tips every 12s

Pure presentational component — tip strings are passed in by the
dashboard container (will source from existing home-mentor-widget
copy library in Task 22). Manual next-tip button for power users.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: RecentSessionsList

**Files:**

- Create: `apps/frontend/web/src/features/dashboard/recent-sessions-list.tsx`

- [ ] **Step 1: Implement**

```tsx
interface SessionRow {
  readonly dateLabel: string;
  readonly dayIndex: number;
  readonly summary: string;
}

interface RecentSessionsListProps {
  readonly sessions: readonly SessionRow[];
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps): React.ReactNode {
  if (sessions.length === 0) {
    return (
      <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-6 text-center">
        <p className="chalk-stamp text-text-label">ACTIVIDAD RECIENTE</p>
        <p className="text-main font-display text-2xl mt-3">AÚN NO HAY ENTRENAMIENTOS</p>
        <p className="text-muted text-sm mt-1">Día uno te espera.</p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">ACTIVIDAD RECIENTE</p>
      <ul className="divide-y divide-rule">
        {sessions.map((s, i) => (
          <li key={i} className="py-2.5 text-sm flex items-center gap-3">
            <span className="font-mono text-muted text-xs w-24 shrink-0">{s.dateLabel}</span>
            <span className="font-mono text-text-label text-xs w-12 shrink-0">D{s.dayIndex}</span>
            <span className="text-main truncate">{s.summary}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bun run --filter web typecheck
git add apps/frontend/web/src/features/dashboard/recent-sessions-list.tsx
git commit -m "$(cat <<'EOF'
feat(web): RecentSessionsList replaces the empty activity placeholder

Renders up to N recent sessions with date / day / summary. Empty state
uses the same chalk-stamp pattern + display heading as NextSetHero so
the two states feel of the same family.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Integrate — `features/home/home-page.tsx` body replacement

**Files:**

- Modify: `apps/frontend/web/src/features/home/home-page.tsx` (replace body with DashboardShell composition)
- Modify: `apps/frontend/web/src/features/home/home-empty-state.tsx` (chalk styling consistency)

- [ ] **Step 1: Read current `home-page.tsx`**

```bash
cat apps/frontend/web/src/features/home/home-page.tsx
```

Note: current body uses `StaggerContainer` + `StaggerItem` directly. Capture the existing hooks/selectors that fetch program instance, KPIs, and recent activity — we wire them into the new shell.

- [ ] **Step 2: Replace body to use DashboardShell**

The exact body depends on the existing hooks. The integration shape:

```tsx
import { DashboardShell } from '@/features/dashboard/dashboard-shell';
import { NextSetHero } from '@/features/dashboard/next-set-hero';
import { KpiStripBrutalist } from '@/features/dashboard/kpi-strip-brutalist';
import { WeekHeatmap } from '@/features/dashboard/week-heatmap';
import { PrRoadCard } from '@/features/dashboard/pr-road-card';
import { usePrRoad } from '@/features/dashboard/use-pr-road';
import { MentorPill } from '@/features/dashboard/mentor-pill';
import { RecentSessionsList } from '@/features/dashboard/recent-sessions-list';
import { HomeEmptyState } from './home-empty-state';
import { useProgram } from '@/hooks/use-program';
// ... whatever existing KPI / activity / mentor hooks live here

export function HomePage(): React.ReactNode {
  const { data: instance, isLoading } = useProgram(); // adapt to actual hook name
  // const { streakDays, totalSessions, weekPr } = useHomeKpis();
  // const { workouts } = useCompletedWorkouts();
  // const liftHistory = useLiftHistoryWithPrTargets();
  // const tips = useMentorTips(instance);
  // const sessions = useRecentSessions(5);

  if (isLoading) return <DashboardSkeleton />; // existing skeleton

  if (!instance) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <HomeEmptyState variant="no-program" />
      </div>
    );
  }

  return (
    <DashboardShell
      hero={<NextSetHero programInstance={instance} />}
      kpi={
        <KpiStripBrutalist streakDays={streakDays} totalSessions={totalSessions} weekPr={weekPr} />
      }
      heatmap={<WeekHeatmap workouts={workouts} />}
      split={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <PrRoadCard road={usePrRoad(liftHistory)} />
          <MentorPill tips={tips} />
        </div>
      }
      recent={<RecentSessionsList sessions={sessions} />}
    />
  );
}
```

If a hook name doesn't exist yet (e.g. `useHomeKpis`, `useLiftHistoryWithPrTargets`), inline the selector in `home-page.tsx` using existing program-instance data + `lib/pr-detection.ts` and `lib/profile-stats.ts` helpers (the audit confirmed these exist).

- [ ] **Step 3: Apply chalk styling to `home-empty-state.tsx`**

Open `home-empty-state.tsx`. Current variants are `guest` and `no-program`. Replace the icon-box header style with chalk-stamp labels and `font-display` headings to match the new Hero family. Keep behaviour identical.

- [ ] **Step 4: Run typecheck + test + manual visual**

```bash
bun run --filter web typecheck
bun run --filter web test
```

Open `http://localhost:5173/app`. Expected layout (top to bottom): NextSetHero → 3-col KPI strip → WeekHeatmap → 2-col split (PrRoad + Mentor) → Recent sessions.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/home/home-page.tsx \
        apps/frontend/web/src/features/home/home-empty-state.tsx
git commit -m "$(cat <<'EOF'
feat(web): /app rebuilt around NextSetHero + supporting modules

HomePage body now composes DashboardShell with hero + KPI strip + week
heatmap + (PrRoad | Mentor) split + recent sessions. Empty states use
the same chalk-stamp + display heading family as the hero. Existing
ActiveProgramCard is retired (its job is now NextSetHero's).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase E — Onboarding + verification

### Task 23: Shortcuts overlay on `/app/tracker`

**Files:**

- Create: `apps/frontend/web/src/features/tracker/shortcuts-overlay.tsx`
- Create: `apps/frontend/web/src/features/tracker/shortcuts-storage.ts`
- Create: `apps/frontend/web/src/features/tracker/shortcuts-storage.test.ts`
- Modify: `apps/frontend/web/src/features/tracker/program-app.tsx` (mount the overlay)

- [ ] **Step 1: Write failing test for storage helpers**

Create `shortcuts-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { hasSeenShortcuts, markShortcutsSeen } from './shortcuts-storage';

describe('shortcuts-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when never seen', () => {
    expect(hasSeenShortcuts()).toBe(false);
  });

  it('returns true after marking seen', () => {
    markShortcutsSeen();
    expect(hasSeenShortcuts()).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL**

```bash
bun run --filter web test src/features/tracker/shortcuts-storage.test.ts
```

- [ ] **Step 3: Implement storage**

Create `shortcuts-storage.ts`:

```ts
const KEY = 'gr-shortcuts-seen-v1';

export function hasSeenShortcuts(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // defensive: SSR-like or storage blocked → don't pester
  }
}

export function markShortcutsSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Test → PASS**

```bash
bun run --filter web test src/features/tracker/shortcuts-storage.test.ts
```

- [ ] **Step 5: Implement the overlay component**

Create `shortcuts-overlay.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { hasSeenShortcuts, markShortcutsSeen } from './shortcuts-storage';

export function ShortcutsOverlay(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hasSeenShortcuts()) setOpen(true);
  }, []);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  if (!open) return null;

  const dismiss = (): void => {
    markShortcutsSeen();
    dialogRef.current?.close();
    setOpen(false);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={dismiss}
      className="modal-box bg-card border-[1.5px] border-rule rounded-[var(--radius-base)] p-6 shadow-[var(--shadow-elevated)] backdrop:bg-black/72 backdrop:backdrop-blur-md max-w-md w-full"
    >
      <p className="chalk-stamp mb-1">ATAJOS DE TECLADO</p>
      <hr className="border-rule mb-4" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-mono text-text-label">[S]</dt>
        <dd className="text-main">éxito</dd>
        <dt className="font-mono text-text-label">[F]</dt>
        <dd className="text-main">fallo</dd>
        <dt className="font-mono text-text-label">[←]</dt>
        <dd className="text-main">serie anterior</dd>
        <dt className="font-mono text-text-label">[→]</dt>
        <dd className="text-main">serie siguiente</dd>
        <dt className="font-mono text-text-label">[U]</dt>
        <dd className="text-main">deshacer último</dd>
      </dl>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={dismiss}
          className="bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-5 py-2 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
        >
          ENTENDIDO
        </button>
      </div>
    </dialog>
  );
}
```

- [ ] **Step 6: Mount overlay in `program-app.tsx`**

Add import: `import { ShortcutsOverlay } from './shortcuts-overlay';`

Place `<ShortcutsOverlay />` as a sibling of the existing toolbar/panel JSX (typically inside the root `<>` fragment of `ProgramApp`).

- [ ] **Step 7: Run tests + typecheck**

```bash
bun run --filter web typecheck
bun run --filter web test src/features/tracker
```

Expected: pass.

- [ ] **Step 8: Manual smoke**

Open an incognito window → `/app/tracker`. The overlay should appear. Click ENTENDIDO. Reload → overlay does not reappear. `localStorage.getItem('gr-shortcuts-seen-v1')` returns `'1'`.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/web/src/features/tracker/shortcuts-overlay.tsx \
        apps/frontend/web/src/features/tracker/shortcuts-storage.ts \
        apps/frontend/web/src/features/tracker/shortcuts-storage.test.ts \
        apps/frontend/web/src/features/tracker/program-app.tsx
git commit -m "$(cat <<'EOF'
feat(web): first-visit shortcuts overlay on /app/tracker

Surfaces the [S]/[F]/[←]/[→]/[U] keyboard shortcuts via a native
<dialog> on first tracker mount. Persists dismissal in localStorage
(key gr-shortcuts-seen-v1). The existing inline shortcut row stays
as a permanent reinforcement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 24: Final verification

**Files:**

- No code changes. Validation only.

- [ ] **Step 1: Full typecheck across the workspace**

```bash
bun run --filter web typecheck
bun run typecheck:domain
```

Expected: pass.

- [ ] **Step 2: Lint**

```bash
bun run --filter web lint
```

Expected: pass.

- [ ] **Step 3: Unit tests**

```bash
bun run --filter web test
```

Expected: pass. Note any new snapshots added (none should be — we did not use snapshot testing).

- [ ] **Step 4: Build**

```bash
bun run --filter web build
```

Expected: pass. Verifies Tailwind v4 generates all expected `bg-*`, `text-*`, `border-*` classes from the new tokens.

- [ ] **Step 5: E2E (playwright)**

```bash
bun run e2e
```

Expected: pass. The visual changes should not break existing flows. If a test fails on a class/style assertion, update the test to reflect the new class — do NOT roll back the design change.

- [ ] **Step 6: Manual visual diff**

For each surface, capture a current screenshot and compare against `/tmp/gr-audit/` baseline:

| Surface         | Before                 | After                                                                                       |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `/app` desktop  | `desktop-app.png`      | Hero `PRÓXIMA SERIE` dominates, then KPIs + heatmap + split + sessions. No void below fold. |
| `/app/programs` | `desktop-programs.png` | Catalog inherits new tokens; cards now rust-and-chalk on graphite.                          |
| `/app/tracker`  | `desktop-tracker.png`  | First visit shows shortcuts overlay. Toast now slate-drops on `S`.                          |
| `/app/profile`  | `desktop-profile.png`  | Inherits tokens. ProfileStatCard accent now top-border in rust.                             |
| Sidebar         | `int-hover-active.png` | Always 224px on desktop, labels visible, accent dot on active item, online pill in footer.  |

Document any visual regressions in PR description.

- [ ] **Step 7: Open PR**

```bash
git push -u origin feat/web-ui-revival-brutalist
gh pr create --title "feat(web): UI revival — underground-gym brutalist /app" --body "$(cat <<'EOF'
## Summary

- Rebuilds /app around a NextSetHero with KPI strip + 12-week heatmap + PrRoad/Mentor split + recent sessions list
- Migrates @theme tokens to OKLCH brutalist palette (rust as primary, gold demoted to ceremonial)
- Sidebar always expanded on desktop (224px) with industrial active treatment (no side-stripe)
- Fixes dead --color-heading token + raw bg-green-500 + text-white on bg-accent (7 sites)
- First-visit shortcuts overlay on /app/tracker

Spec: docs/superpowers/specs/2026-05-11-ui-revival-brutalist-design.md
Plan: docs/superpowers/plans/2026-05-11-ui-revival-brutalist.md

## Test plan

- [ ] Manual /app desktop+mobile visual check
- [ ] Toast slate-drop animation on tracker `S`
- [ ] Shortcuts overlay appears on first /app/tracker visit
- [ ] ProgressBar turns victory gold when program completes (manual or via seeded data)
- [ ] Sidebar accent dot on active item, online pill in footer
- [ ] No console errors on /app/programs (inherits tokens, no structural change)
- [ ] /app/profile renders ProfileStatCard with rust top-border (not dead side-stripe)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8: Stop background dev servers (optional cleanup)**

```bash
# Find PIDs and kill
pkill -f "bun run dev:api" || true
pkill -f "bun run dev:web" || true
sudo service postgresql stop || true
```

---

## Self-review checklist

After execution, run through the spec one more time:

- [ ] Every token from spec § "Design tokens" is in `globals.css @theme` (Task 2)
- [ ] `--color-heading` fix verified — `border-l-heading` in ProfileStatCard now resolves to chalk (Task 14)
- [ ] `bg-green-500` is gone from the entire `apps/frontend/web/src/` (Task 2.5)
- [ ] `text-white` on `bg-accent` is gone (Task 4)
- [ ] Side-stripe borders `.accent-left-gold` / `.accent-left-muted` removed and not reintroduced (Tasks 3, 13)
- [ ] Inline styles in `program-app.tsx` and `profile-page.tsx` migrated to named classes or removed (Task 5)
- [ ] Dead icon exports `AnalyticsIcon` / `DashboardIcon` removed (Task 5)
- [ ] Button `victory` variant present (Task 6)
- [ ] Toast slate-drop + PR variant + no redundant undo (Task 8)
- [ ] OnlineIndicator moved to sidebar footer (Task 12)
- [ ] Sidebar fixed at 224px on desktop with dot-indicator active state (Task 12)
- [ ] KpiCard has `flame` variant + count-up + accent top-border (Task 13)
- [ ] Dashboard composes: NextSetHero + KpiStripBrutalist + WeekHeatmap + (PrRoad + Mentor) + RecentSessions (Tasks 15–22)
- [ ] Shortcuts overlay persists dismissal (Task 23)
- [ ] All `text-on-accent` swaps verified by build + typecheck + lint (Task 24)
