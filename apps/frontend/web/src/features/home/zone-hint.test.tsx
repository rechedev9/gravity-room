import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';

// Mock motion/react so the AnimatePresence/motion wrappers render as plain
// elements without animation side-effects (mirrors home-mentor-widget.test.tsx).
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string | symbol) =>
        ({ children, ...rest }: { children?: React.ReactNode; [k: string]: unknown }) =>
          createElement(String(tag) as 'div', rest as Record<string, unknown>, children),
    }
  ),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { ZoneHint } from './zone-hint';
import { saveTourState, loadTourState } from './mentor-tour-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Install a window.plausible spy and return the recorded calls + a restorer. */
function makePlausibleSpy() {
  const calls: Array<[string, unknown]> = [];
  const spy = (event: string, opts?: unknown) => {
    calls.push([event, opts]);
  };
  Object.defineProperty(window, 'plausible', { value: spy, writable: true, configurable: true });
  return {
    calls,
    restore() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).plausible = undefined;
    },
  };
}

// The dismiss button aria-label resolves to the Spanish copy (project default).
const DISMISS_LABEL = 'Cerrar este consejo';
// Spanish "home" zone hint text.
const HOME_HINT = 'Tu programa activo vive aquí.';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ZoneHint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('visibility', () => {
    it('renders the hint for a zone that has not been dismissed', () => {
      render(createElement(ZoneHint, { zone: 'home' }));
      expect(screen.getByText(new RegExp(HOME_HINT))).toBeInTheDocument();
    });

    it('does not render when the zone hint was already dismissed in storage', () => {
      saveTourState({ version: 2, dismissedZones: ['home'] });
      const { container } = render(createElement(ZoneHint, { zone: 'home' }));
      expect(container.querySelector('aside')).toBeNull();
    });

    it('does not render when the whole checklist was dismissed', () => {
      saveTourState({ version: 2, checklistDismissed: true });
      const { container } = render(createElement(ZoneHint, { zone: 'programs' }));
      expect(container.querySelector('aside')).toBeNull();
    });
  });

  describe('dismissal', () => {
    it('marks the zone as visited in storage when dismissed', () => {
      render(createElement(ZoneHint, { zone: 'home' }));
      fireEvent.click(screen.getByLabelText(DISMISS_LABEL));
      expect(loadTourState()?.dismissedZones).toContain('home');
    });

    it('hides the hint from the DOM after dismissal', () => {
      const { container } = render(createElement(ZoneHint, { zone: 'home' }));
      fireEvent.click(screen.getByLabelText(DISMISS_LABEL));
      expect(container.querySelector('aside')).toBeNull();
    });
  });

  describe('analytics', () => {
    it('fires mentor_tour_zone_visit with the zone name on dismiss', () => {
      const plausible = makePlausibleSpy();
      render(createElement(ZoneHint, { zone: 'tracker' }));
      fireEvent.click(screen.getByLabelText(DISMISS_LABEL));
      const visitCalls = plausible.calls.filter(([e]) => e === 'mentor_tour_zone_visit');
      expect(visitCalls.length).toBe(1);
      expect(visitCalls[0][1]).toEqual({ props: { zone: 'tracker' } });
      plausible.restore();
    });

    it('does not fire the event before the hint is dismissed', () => {
      const plausible = makePlausibleSpy();
      render(createElement(ZoneHint, { zone: 'profile' }));
      const visitCalls = plausible.calls.filter(([e]) => e === 'mentor_tour_zone_visit');
      expect(visitCalls.length).toBe(0);
      plausible.restore();
    });
  });
});
