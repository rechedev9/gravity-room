import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import i18n from 'i18next';
import { createElement } from 'react';

// Mock framer-motion / motion to avoid animation side-effects in tests
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

// Mock TanStack Router Link so it renders as a plain anchor in tests
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children?: React.ReactNode;
    to?: string;
    onClick?: () => void;
  }) => createElement('a', { href: to, onClick }, children),
}));

import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { HomeMentorWidget } from './home-mentor-widget';
import { MENTOR_TOUR_KEY, saveTourState, loadTourState, TOUR_ZONES } from './mentor-tour-storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWidget() {
  return render(createElement(HomeMentorWidget));
}

/** Open the checklist popover (requires widget to be in checklist mode). */
function openPopover() {
  // The trigger button contains the title "Sensei de la Sala" (ES) or "Gravity Sensei" (EN)
  const trigger = screen.queryByText('Sensei de la Sala') ?? screen.queryByText('Gravity Sensei');
  if (trigger) fireEvent.click(trigger.closest('button') ?? trigger);
}

/** Install a window.plausible spy and return it. Call restore() when done. */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeMentorWidget', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    cleanup();
    localStorage.clear();
    // Reset language to Spanish (project default)
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  // ── Initial prompt (fresh state) ─────────────────────────────────────────

  describe('fresh state (empty localStorage) — initial prompt', () => {
    it('shows the welcome prompt title', () => {
      renderWidget();
      expect(screen.getByText('Bienvenido, ¿quieres un pequeño tutorial?')).toBeInTheDocument();
    });

    it('shows "Empezar mini tutorial" CTA', () => {
      renderWidget();
      expect(screen.getByText('Empezar mini tutorial')).toBeInTheDocument();
    });

    it('shows dismiss (✕) button on prompt', () => {
      renderWidget();
      // The prompt dismiss button has aria-label "Cerrar lista del tour"
      expect(screen.getByLabelText('Cerrar lista del tour')).toBeInTheDocument();
    });

    it('does NOT show the checklist title on fresh state', () => {
      renderWidget();
      expect(screen.queryByText('Sensei de la Sala')).not.toBeInTheDocument();
    });
  });

  // ── Prompt → Checklist transition ────────────────────────────────────────

  describe('start → checklist transition', () => {
    it('clicking "Empezar mini tutorial" reveals the checklist pill', () => {
      renderWidget();
      fireEvent.click(screen.getByText('Empezar mini tutorial'));
      expect(screen.getByText('Sensei de la Sala')).toBeInTheDocument();
    });

    it('clicking "Empezar mini tutorial" persists tourStarted to localStorage', () => {
      renderWidget();
      fireEvent.click(screen.getByText('Empezar mini tutorial'));
      expect(loadTourState()?.tourStarted).toBe(true);
    });

    it('shows all 5 zone labels after starting and opening popover', () => {
      renderWidget();
      fireEvent.click(screen.getByText('Empezar mini tutorial'));
      openPopover();
      expect(screen.getByText('Inicio')).toBeInTheDocument();
      expect(screen.getByText('Programas')).toBeInTheDocument();
      expect(screen.getByText('Vista previa')).toBeInTheDocument();
      expect(screen.getByText('Tracker')).toBeInTheDocument();
      expect(screen.getByText('Perfil')).toBeInTheDocument();
    });

    it('shows zone navigation links (→) for all zones after starting and opening popover', () => {
      renderWidget();
      fireEvent.click(screen.getByText('Empezar mini tutorial'));
      openPopover();
      // Each undone zone renders a link ending in "→"
      const links = screen.getAllByText('→');
      expect(links.length).toBe(5);
    });
  });

  // ── Prompt dismiss ("✕") ─────────────────────────────────────────────────

  describe('dismiss prompt ("Ahora no")', () => {
    it('hides the widget when dismiss (✕) is clicked on prompt', () => {
      const { container } = renderWidget();
      fireEvent.click(screen.getByLabelText('Cerrar lista del tour'));
      expect(container.firstChild).toBeNull();
    });

    it('persists checklistDismissed to localStorage after prompt dismiss', () => {
      renderWidget();
      fireEvent.click(screen.getByLabelText('Cerrar lista del tour'));
      expect(loadTourState()?.checklistDismissed).toBe(true);
    });

    it('does not show prompt again when checklistDismissed is true', () => {
      saveTourState({ version: 2, checklistDismissed: true });
      const { container } = renderWidget();
      expect(container.firstChild).toBeNull();
    });
  });

  // ── English copy ─────────────────────────────────────────────────────────

  describe('English copy', () => {
    it('renders English prompt when language is en', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      renderWidget();
      expect(screen.getByText('Welcome! Would you like a quick tutorial?')).toBeInTheDocument();
      expect(screen.getByText('Start mini tutorial')).toBeInTheDocument();
    });

    it('renders English checklist pill title after starting', async () => {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      renderWidget();
      fireEvent.click(screen.getByText('Start mini tutorial'));
      expect(screen.getByText('Gravity Sensei')).toBeInTheDocument();
    });
  });

  // ── Dismiss checklist ────────────────────────────────────────────────────

  describe('dismiss checklist', () => {
    it('hides the widget when dismiss (✕) is clicked on pill', () => {
      saveTourState({ version: 2, tourStarted: true });
      const { container } = renderWidget();
      const dismissBtn = screen.getByLabelText('Cerrar lista del tour');
      fireEvent.click(dismissBtn);
      expect(container.firstChild).toBeNull();
    });

    it('persists checklistDismissed to localStorage after dismiss', () => {
      saveTourState({ version: 2, tourStarted: true });
      renderWidget();
      fireEvent.click(screen.getByLabelText('Cerrar lista del tour'));
      expect(loadTourState()?.checklistDismissed).toBe(true);
    });
  });

  // ── Zone link click marks zone ────────────────────────────────────────────

  describe('zone link interaction', () => {
    it('clicking a zone link marks it as visited in storage', () => {
      saveTourState({ version: 2, tourStarted: true });
      renderWidget();
      openPopover();
      // Click the first "→" link (home zone)
      const links = screen.getAllByText('→');
      fireEvent.click(links[0]);
      const state = loadTourState();
      expect(state?.dismissedZones).toContain('home');
    });
  });

  // ── All zones done ────────────────────────────────────────────────────────

  describe('all zones done', () => {
    it('shows all_done_short message when all zones are dismissed', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: [...TOUR_ZONES] });
      renderWidget();
      expect(screen.getByText('Tour completado.')).toBeInTheDocument();
    });

    it('shows reset button when all zones are done', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: [...TOUR_ZONES] });
      renderWidget();
      expect(screen.getByText('Reiniciar tour')).toBeInTheDocument();
    });

    it('reset button clears storage and shows prompt again', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: [...TOUR_ZONES] });
      renderWidget();
      fireEvent.click(screen.getByText('Reiniciar tour'));
      expect(screen.getByText('Bienvenido, ¿quieres un pequeño tutorial?')).toBeInTheDocument();
      expect(loadTourState()).toBeNull();
    });
  });

  // ── Dismissed state from storage ─────────────────────────────────────────

  describe('dismissed state from storage', () => {
    it('renders nothing when checklistDismissed is true in storage', () => {
      saveTourState({ version: 2, checklistDismissed: true });
      const { container } = renderWidget();
      expect(container.firstChild).toBeNull();
    });
  });

  // ── Partial progress (tourStarted) ───────────────────────────────────────

  describe('partial progress', () => {
    it('shows correct progress count in popover when some zones are dismissed', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: ['home', 'programs'] });
      renderWidget();
      openPopover();
      // Popover header shows "2/5"
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });

    it('shows done zones as struck-through and undone zones with → links', () => {
      saveTourState({ version: 2, tourStarted: true, dismissedZones: ['home'] });
      renderWidget();
      openPopover();
      // "Inicio" should be struck-through (line-through class)
      const inicioEl = screen.getByText('Inicio');
      expect(inicioEl.className).toContain('line-through');
      // 4 remaining zones have "→" links
      const links = screen.getAllByText('→');
      expect(links.length).toBe(4);
    });
  });

  // ── Corrupted / empty localStorage ───────────────────────────────────────

  describe('corrupted localStorage', () => {
    it('falls back to prompt when localStorage has corrupted JSON', () => {
      localStorage.setItem(MENTOR_TOUR_KEY, 'not-valid-json!!!');
      renderWidget();
      expect(screen.getByText('Bienvenido, ¿quieres un pequeño tutorial?')).toBeInTheDocument();
    });

    it('falls back to prompt when localStorage has wrong schema version', () => {
      localStorage.setItem(MENTOR_TOUR_KEY, JSON.stringify({ version: 1 }));
      renderWidget();
      expect(screen.getByText('Bienvenido, ¿quieres un pequeño tutorial?')).toBeInTheDocument();
    });
  });

  // ── completedAt suppresses checklist ─────────────────────────────────────

  describe('completedAt in storage', () => {
    it('shows all_done_short when completedAt is set (all zones visited)', () => {
      saveTourState({
        version: 2,
        tourStarted: true,
        dismissedZones: [...TOUR_ZONES],
        completedAt: '2024-01-01T00:00:00.000Z',
      });
      renderWidget();
      expect(screen.getByText('Tour completado.')).toBeInTheDocument();
    });
  });

  // ── Aggregate analytics ───────────────────────────────────────────────────

  describe('aggregate analytics events', () => {
    it('fires mentor_tutorial_start when "Empezar mini tutorial" is clicked', () => {
      const plausible = makePlausibleSpy();
      renderWidget();
      fireEvent.click(screen.getByText('Empezar mini tutorial'));
      const startCalls = plausible.calls.filter(([e]) => e === 'mentor_tutorial_start');
      expect(startCalls.length).toBe(1);
      expect(startCalls[0][1]).toBeUndefined();
      plausible.restore();
    });

    it('fires mentor_tutorial_complete when last zone is clicked', () => {
      // Pre-dismiss all zones except the last one
      const allButLast = TOUR_ZONES.slice(0, -1);
      saveTourState({ version: 2, tourStarted: true, dismissedZones: allButLast });
      const plausible = makePlausibleSpy();
      renderWidget();
      openPopover();
      const links = screen.getAllByText('→');
      fireEvent.click(links[0]); // only one link remains
      const completeCalls = plausible.calls.filter(([e]) => e === 'mentor_tutorial_complete');
      expect(completeCalls.length).toBe(1);
      expect(completeCalls[0][1]).toBeUndefined();
      plausible.restore();
    });

    it('does NOT fire mentor_tutorial_complete when not all zones are done', () => {
      saveTourState({ version: 2, tourStarted: true });
      const plausible = makePlausibleSpy();
      renderWidget();
      openPopover();
      const links = screen.getAllByText('→');
      fireEvent.click(links[0]); // only first zone clicked
      const completeCalls = plausible.calls.filter(([e]) => e === 'mentor_tutorial_complete');
      expect(completeCalls.length).toBe(0);
      plausible.restore();
    });
  });
});
