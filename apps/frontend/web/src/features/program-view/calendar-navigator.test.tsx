import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarNavigator } from './calendar-navigator';
import { loadNavMode, saveNavMode } from './program-navigation-preference';
import type { GenericWorkoutRow } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRows(count: number): GenericWorkoutRow[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    dayName: `Day ${i + 1}`,
    slots: [],
    isChanged: false,
    completedAt: undefined,
  }));
}

// NOTE: No react-i18next mock here — the global test setup (test/setup.ts) initialises
// i18n with real ES translations so components render translated text.
// Assertions below use the actual Spanish translations from the ES locale file.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarNavigator', () => {
  let onSelectDay: ReturnType<typeof mock>;

  beforeEach(() => {
    onSelectDay = mock();
  });

  // ── Jump to workout ──────────────────────────────────────────────────────

  describe('jump to workout', () => {
    it('selects workout 1 (index 0) when user types 1 and clicks Go', () => {
      const rows = makeRows(200);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={50}
          currentDayIndex={50}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: /Ir al entrenamiento indicado/i }));

      expect(onSelectDay).toHaveBeenCalledWith(0);
    });

    it('selects workout 200 (index 199) when user types 200', () => {
      const rows = makeRows(200);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.click(screen.getByRole('button', { name: /Ir al entrenamiento indicado/i }));

      expect(onSelectDay).toHaveBeenCalledWith(199);
    });

    it('shows error and does not call onSelectDay for out-of-range value', () => {
      const rows = makeRows(10);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.submit(screen.getByRole('form'));

      expect(onSelectDay).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    it('submits on Enter key in the input', () => {
      const rows = makeRows(200);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '42' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSelectDay).toHaveBeenCalledWith(41);
    });
  });

  // ── Week chips ───────────────────────────────────────────────────────────

  describe('week chips', () => {
    it('renders correct number of week chips for 200 workouts at 4/week = 50 weeks', () => {
      const rows = makeRows(200);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const chips = screen.getAllByRole('tab');
      expect(chips.length).toBe(50);
    });

    it('clicking Week 38 chip calls onSelectDay with first day of week 38', () => {
      const rows = makeRows(200);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Week 38 is 0-indexed week 37 → first day = 37 * 4 = 148
      // All chips have the same aria-label key (mock returns key without interpolation)
      // so we select by index (37 = week 38, 0-indexed)
      const chips = screen.getAllByRole('tab');
      expect(chips.length).toBe(50);
      fireEvent.click(chips[37]); // week index 37 = "Week 38"

      expect(onSelectDay).toHaveBeenCalledWith(148);
    });

    it('active week chip has aria-selected=true', () => {
      const rows = makeRows(20);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={4} // week 1 (0-indexed), 4/4 = week index 1
          currentDayIndex={4}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const chips = screen.getAllByRole('tab');
      // selectedDayIndex=4 → weekIndex=1 → second chip
      expect(chips[1].getAttribute('aria-selected')).toBe('true');
      expect(chips[0].getAttribute('aria-selected')).toBe('false');
    });
  });

  // ── Incomplete final week ────────────────────────────────────────────────

  describe('incomplete final week', () => {
    it('does not crash when last week has fewer rows than workoutsPerWeek', () => {
      // 10 rows, 4/week → last week has 2 rows
      const rows = makeRows(10);
      expect(() =>
        render(
          <CalendarNavigator
            rows={rows}
            selectedDayIndex={8} // in last week
            currentDayIndex={8}
            workoutsPerWeek={4}
            context="tracker"
            onSelectDay={onSelectDay}
          />
        )
      ).not.toThrow();
    });

    it('renders only 2 tiles for a 2-row final week (no undefined tiles)', () => {
      const rows = makeRows(10); // 10 rows, 4/week → weeks: [0-3],[4-7],[8-9]
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={8}
          currentDayIndex={8}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Tiles are buttons with data-testid="day-tile"
      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(2);
    });
  });

  // ── Week rendering for different workoutsPerWeek values ─────────────────

  describe('week rendering by workoutsPerWeek', () => {
    it('renders 3 tiles for a 3x/week program (first week)', () => {
      const rows = makeRows(12); // 4 weeks of 3
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(3);
    });

    it('renders 4 tiles for a 4x/week program (first week)', () => {
      const rows = makeRows(20);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(4);
    });

    it('renders 6 tiles for a 6x/week program (first week)', () => {
      const rows = makeRows(24);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={6}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(6);
    });

    it('renders correct number of week chips for 3x/week (12 workouts = 4 weeks)', () => {
      const rows = makeRows(12);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const chips = screen.getAllByRole('tab');
      expect(chips.length).toBe(4);
    });

    it('renders correct number of week chips for 6x/week (18 workouts = 3 weeks)', () => {
      const rows = makeRows(18);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={6}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const chips = screen.getAllByRole('tab');
      expect(chips.length).toBe(3);
    });
  });

  // ── Tile state: selected / current / completed ───────────────────────────

  describe('tile states', () => {
    it('selected tile has aria-current=true, others do not', () => {
      const rows = makeRows(4);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={1}
          currentDayIndex={2}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');

      // Only the selected tile (index 1) should have aria-current=true
      expect(tiles[1].getAttribute('aria-current')).toBe('true');
      expect(tiles[0].getAttribute('aria-current')).toBeNull();
      expect(tiles[2].getAttribute('aria-current')).toBeNull();
      expect(tiles[3].getAttribute('aria-current')).toBeNull();
    });

    it('completed tile via completedDayIndices shows completed state (dot indicator)', () => {
      const rows = makeRows(4);
      const completedDayIndices = new Set([0, 1]);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={2}
          currentDayIndex={3}
          workoutsPerWeek={4}
          completedDayIndices={completedDayIndices}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Completed tiles show a dot (●) indicator
      const dots = screen.getAllByText('●');
      expect(dots.length).toBe(2);
    });

    it('completed tile via resultTimestamps shows completed state when completedDayIndices is absent', () => {
      const rows = makeRows(4);
      const resultTimestamps: Record<string, string> = {
        '0': '2024-01-01T10:00:00Z',
        '1': '2024-01-02T10:00:00Z',
      };
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={2}
          currentDayIndex={3}
          workoutsPerWeek={4}
          resultTimestamps={resultTimestamps}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const dots = screen.getAllByText('●');
      expect(dots.length).toBe(2);
    });

    it('completedDayIndices takes priority over resultTimestamps', () => {
      const rows = makeRows(4);
      // completedDayIndices marks only index 0 as complete
      const completedDayIndices = new Set([0]);
      // resultTimestamps would mark 0 and 1 as complete if used
      const resultTimestamps: Record<string, string> = {
        '0': '2024-01-01T10:00:00Z',
        '1': '2024-01-02T10:00:00Z',
      };
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={2}
          currentDayIndex={3}
          workoutsPerWeek={4}
          completedDayIndices={completedDayIndices}
          resultTimestamps={resultTimestamps}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Only 1 dot because completedDayIndices wins
      const dots = screen.getAllByText('●');
      expect(dots.length).toBe(1);
    });

    it('current tile (not selected) shows arrow indicator', () => {
      const rows = makeRows(4);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={2}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const arrows = screen.getAllByText('▶');
      expect(arrows.length).toBe(1);
    });

    it('selected tile does not show current arrow even when indices match', () => {
      // When selectedDayIndex === currentDayIndex, tile is 'selected', not 'current'
      const rows = makeRows(4);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={1}
          currentDayIndex={1}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // No arrow because the tile is 'selected', not 'current'
      expect(screen.queryAllByText('▶').length).toBe(0);
    });
  });

  // ── Preview context edge cases ───────────────────────────────────────────

  describe('preview context edge cases', () => {
    it('preview with currentDayIndex=0 and no timestamps does not crash', () => {
      const rows = makeRows(8);
      expect(() =>
        render(
          <CalendarNavigator
            rows={rows}
            selectedDayIndex={0}
            currentDayIndex={0}
            workoutsPerWeek={4}
            context="preview"
            onSelectDay={onSelectDay}
          />
        )
      ).not.toThrow();
    });

    it('preview with currentDayIndex=0 renders all tiles without reading timestamps', () => {
      const rows = makeRows(4);
      // No resultTimestamps, no completedDayIndices — should not crash
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(4);
    });

    it('clicking any tile in preview calls onSelectDay with correct index', () => {
      const rows = makeRows(4);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      const tiles = screen.getAllByTestId('day-tile');

      fireEvent.click(tiles[2]); // 3rd tile = index 2
      expect(onSelectDay).toHaveBeenCalledWith(2);
    });

    it('preview shows program-weeks label badge (no real calendar)', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      const badge = screen.getByTestId('preview-program-weeks-label');
      expect(badge).toBeTruthy();
    });

    it('preview does NOT show reading selector (Programa | Historial real)', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      // Reading mode buttons have aria-pressed and text matching reading_mode keys
      const readingButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Programa') || b.textContent?.includes('Historial real'))
        );
      expect(readingButtons.length).toBe(0);
    });
  });

  // ── ARIA / keyboard ──────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('selected tile has aria-current=true', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={2}
          currentDayIndex={3}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const selectedTile = screen
        .getAllByRole('button')
        .find((b) => b.getAttribute('aria-current') === 'true');
      expect(selectedTile).toBeTruthy();
    });

    it('jump input has an associated label', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const input = screen.getByRole('spinbutton');
      // Input should be labelled (either via htmlFor or aria-labelledby)
      expect(input.getAttribute('aria-labelledby') !== null || input.id !== '').toBe(true);
    });

    it('preview context allows selecting future day tiles (no tiles disabled)', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={2}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      // No day tiles should be disabled in preview — all days must be selectable
      const disabledTiles = screen
        .getAllByTestId('day-tile')
        .filter((b) => b.hasAttribute('disabled'));
      expect(disabledTiles.length).toBe(0);
    });

    it('preview context: clicking a future day tile calls onSelectDay', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={2}
          workoutsPerWeek={4}
          context="preview"
          onSelectDay={onSelectDay}
        />
      );

      // All day tiles are enabled; click the 4th tile (index 3, future day)
      const dayTiles = screen.getAllByTestId('day-tile');
      expect(dayTiles.length).toBe(4); // first week has 4 tiles
      fireEvent.click(dayTiles[3]); // 4th tile = index 3 (future day)
      expect(onSelectDay).toHaveBeenCalledWith(3);
    });
  });

  // ── Nav mode selector ────────────────────────────────────────────────────

  describe('nav mode selector', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    afterEach(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    it('renders three mode buttons: Day, Week, Month', () => {
      const rows = makeRows(12);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Nav mode buttons are identified by nav_mode text content
      const modeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      expect(modeButtons.length).toBe(3);
    });

    it('defaults to week mode (week chips visible)', () => {
      const rows = makeRows(12);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // In week mode, week chips (role=tab) should be visible
      const chips = screen.getAllByRole('tab');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('switching to day mode hides week chips and shows jump form', () => {
      const rows = makeRows(12);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Click the Day mode button (nav_mode.day)
      const modeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      fireEvent.click(modeButtons[0]); // Day

      // Week chips should be gone
      expect(screen.queryAllByRole('tab').length).toBe(0);
      // Jump form should be present (spinbutton input)
      expect(screen.getByRole('spinbutton')).toBeTruthy();
    });

    it('switching to month mode shows month page navigation', () => {
      const rows = makeRows(24);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Click the Month mode button (nav_mode.month)
      const modeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      fireEvent.click(modeButtons[2]); // Month

      // Month navigation arrows should be present
      const prevBtn = screen.getByRole('button', { name: /Página anterior del mes/i });
      const nextBtn = screen.getByRole('button', { name: /Página siguiente del mes/i });
      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
    });

    it('selected mode button has aria-pressed=true', () => {
      const rows = makeRows(12);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const modeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );

      // Default is week (index 1)
      expect(modeButtons[1].getAttribute('aria-pressed')).toBe('true');
      expect(modeButtons[0].getAttribute('aria-pressed')).toBe('false');
      expect(modeButtons[2].getAttribute('aria-pressed')).toBe('false');

      // Switch to month
      fireEvent.click(modeButtons[2]);
      const updatedButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      expect(updatedButtons[2].getAttribute('aria-pressed')).toBe('true');
      expect(updatedButtons[1].getAttribute('aria-pressed')).toBe('false');
    });
  });

  // ── Nav mode persistence ─────────────────────────────────────────────────

  describe('nav mode persistence (program-navigation-preference)', () => {
    beforeEach(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    afterEach(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });

    it('loadNavMode returns "week" when localStorage is empty', () => {
      expect(loadNavMode()).toBe('week');
    });

    it('saveNavMode + loadNavMode round-trips correctly for all modes', () => {
      for (const mode of ['day', 'week', 'month'] as const) {
        saveNavMode(mode);
        expect(loadNavMode()).toBe(mode);
      }
    });

    it('loadNavMode returns "week" for an invalid stored value', () => {
      try {
        localStorage.setItem('gravity-room:program-navigation-mode:v1', 'invalid');
      } catch {
        /* ignore */
      }
      expect(loadNavMode()).toBe('week');
    });

    it('switching to month mode persists to localStorage', () => {
      const rows = makeRows(24);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const modeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      fireEvent.click(modeButtons[2]); // Month

      expect(loadNavMode()).toBe('month');
    });

    it('CalendarNavigator reads persisted mode on mount', () => {
      // Pre-set month mode in storage
      saveNavMode('month');

      const rows = makeRows(24);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={3}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Month mode should be active: month nav buttons visible
      const prevBtn = screen.queryByRole('button', { name: /Página anterior del mes/i });
      expect(prevBtn).toBeTruthy();

      // Week chips should NOT be visible
      expect(screen.queryAllByRole('tab').length).toBe(0);
    });
  });

  // ── MonthView: tile content, prev/next/current controls ─────────────────

  describe('MonthView improvements', () => {
    /** Switch to month mode and return the component. */
    function renderInMonthMode(
      rows: GenericWorkoutRow[],
      opts: {
        selectedDayIndex?: number;
        currentDayIndex?: number;
        workoutsPerWeek?: number;
        completedDayIndices?: ReadonlySet<number>;
      } = {}
    ) {
      const {
        selectedDayIndex = 0,
        currentDayIndex = 0,
        workoutsPerWeek = 4,
        completedDayIndices,
      } = opts;
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={selectedDayIndex}
          currentDayIndex={currentDayIndex}
          workoutsPerWeek={workoutsPerWeek}
          completedDayIndices={completedDayIndices}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );
      // Switch to month mode
      const modeButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Mes'));
      fireEvent.click(modeButtons[0]);
    }

    it('month tiles show workout number in their text content', () => {
      const rows = makeRows(8);
      renderInMonthMode(rows, { workoutsPerWeek: 4 });

      const tiles = screen.getAllByTestId('day-tile');

      // First tile should contain "1" (workout number)
      expect(tiles[0].textContent).toContain('1');
    });

    it('month tiles show abbreviated dayName', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, { workoutsPerWeek: 4 });

      const tiles = screen.getAllByTestId('day-tile');

      // dayName is "Day 1", "Day 2", etc. — should appear (possibly truncated)
      expect(tiles[0].textContent).toContain('Day 1');
    });

    it('month tiles have accessible title with full workout name', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, { workoutsPerWeek: 4 });

      const tiles = screen.getAllByTestId('day-tile');

      // title attribute should include workout number and full dayName
      expect(tiles[0].getAttribute('title')).toContain('#1');
      expect(tiles[0].getAttribute('title')).toContain('Day 1');
    });

    it('month tiles have aria-label and aria-current for selected tile', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 0,
        currentDayIndex: 1,
      });

      const tiles = screen.getAllByTestId('day-tile');

      // Selected tile has aria-current=true
      expect(tiles[0].getAttribute('aria-current')).toBe('true');
      // Non-selected tiles do not have aria-current
      expect(tiles[1].getAttribute('aria-current')).toBeNull();
      expect(tiles[2].getAttribute('aria-current')).toBeNull();
    });

    it('completed month tile shows dot icon (●)', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 2,
        currentDayIndex: 3,
        completedDayIndices: new Set([0, 1]),
      });

      const dots = screen.getAllByText('●');
      expect(dots.length).toBe(2);
    });

    it('current month tile shows arrow icon (▶)', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 0,
        currentDayIndex: 2,
      });

      const arrows = screen.getAllByText('▶');
      expect(arrows.length).toBe(1);
    });

    it('month tiles have min-h-[44px] class for touch targets', () => {
      const rows = makeRows(4);
      renderInMonthMode(rows, { workoutsPerWeek: 4 });

      const tiles = screen.getAllByTestId('day-tile');

      // All tiles should have the 44px min-height class
      for (const tile of tiles) {
        expect(tile.className).toContain('min-h-[44px]');
      }
    });

    it('prev/next navigation buttons have min-h-[44px] for touch targets', () => {
      const rows = makeRows(24);
      renderInMonthMode(rows, { workoutsPerWeek: 3 });

      const prevBtn = screen.getByRole('button', { name: /Página anterior del mes/i });
      const nextBtn = screen.getByRole('button', { name: /Página siguiente del mes/i });

      expect(prevBtn.className).toContain('min-h-[44px]');
      expect(nextBtn.className).toContain('min-h-[44px]');
    });

    it('"Current" button appears when on a different page than currentDayIndex', () => {
      // 200 rows, 4/week = 50 weeks = 13 month pages
      // currentDayIndex=0 → page 0; selectedDayIndex=100 → week 25 → page 6
      const rows = makeRows(200);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 100,
        currentDayIndex: 0,
      });

      // The "Current" button should be visible since we're on page 6 but current is page 0
      const currentBtn = screen.queryByTestId('month-current-btn');
      expect(currentBtn).toBeTruthy();
    });

    it('"Current" button is hidden when already on the current page', () => {
      const rows = makeRows(200);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 0,
        currentDayIndex: 0,
      });

      // Both selected and current are on page 0 — no "Current" button needed
      const currentBtn = screen.queryByTestId('month-current-btn');
      expect(currentBtn).toBeNull();
    });

    it('"Current" button jumps to the page containing currentDayIndex', () => {
      // currentDayIndex=0 → page 0; selectedDayIndex=100 → page 6
      const rows = makeRows(200);
      renderInMonthMode(rows, {
        workoutsPerWeek: 4,
        selectedDayIndex: 100,
        currentDayIndex: 0,
      });

      const currentBtn = screen.getByTestId('month-current-btn');
      fireEvent.click(currentBtn);

      // After clicking, "Current" button should now be hidden (we're on the current page)
      expect(screen.queryByTestId('month-current-btn')).toBeNull();

      // Prev button should be disabled (we're on page 0)
      const prevBtn = screen.getByRole('button', { name: /Página anterior del mes/i });
      expect(prevBtn.hasAttribute('disabled')).toBe(true);
    });

    it('prev button is disabled on first page', () => {
      const rows = makeRows(24);
      renderInMonthMode(rows, { workoutsPerWeek: 3, selectedDayIndex: 0 });

      const prevBtn = screen.getByRole('button', { name: /Página anterior del mes/i });
      expect(prevBtn.hasAttribute('disabled')).toBe(true);
    });

    it('next button is disabled on last page', () => {
      // 12 rows, 3/week = 4 weeks = 1 month page
      const rows = makeRows(12);
      renderInMonthMode(rows, { workoutsPerWeek: 3, selectedDayIndex: 0 });

      const nextBtn = screen.getByRole('button', { name: /Página siguiente del mes/i });
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });

    it('clicking next page shows next set of weeks', () => {
      // 200 rows, 4/week = 50 weeks = 13 pages; start on page 1
      const rows = makeRows(200);
      renderInMonthMode(rows, { workoutsPerWeek: 4, selectedDayIndex: 0 });

      const nextBtn = screen.getByRole('button', { name: /Página siguiente del mes/i });
      fireEvent.click(nextBtn);

      // After clicking next, prev button should be enabled (no longer on first page)
      const prevBtn = screen.getByRole('button', { name: /Página anterior del mes/i });
      expect(prevBtn.hasAttribute('disabled')).toBe(false);
    });

    it('month view renders tiles for all weeks on the page', () => {
      // 16 rows, 4/week = 4 weeks = 1 page; all 16 tiles visible
      const rows = makeRows(16);
      renderInMonthMode(rows, { workoutsPerWeek: 4, selectedDayIndex: 0 });

      const tiles = screen.getAllByTestId('day-tile');
      expect(tiles.length).toBe(16);
    });

    it('large program (200 workouts) renders without horizontal overflow (no scroll)', () => {
      // Smoke test: renders without throwing for a large program
      const rows = makeRows(200);
      expect(() =>
        renderInMonthMode(rows, {
          workoutsPerWeek: 4,
          selectedDayIndex: 100,
          currentDayIndex: 100,
        })
      ).not.toThrow();
    });
  });

  describe('tracker reading selector', () => {
    it('tracker shows reading selector with two buttons', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Reading mode buttons: "calendar_navigator.reading_mode.program" and "...history"
      const readingButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Programa') || b.textContent?.includes('Historial real'))
        );
      expect(readingButtons.length).toBe(2);
    });

    it('tracker defaults to program reading mode (program view visible)', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // In program mode, nav mode selector (Day/Week/Month) should be visible
      const navModeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      expect(navModeButtons.length).toBe(3);

      // History microcopy should NOT be visible
      expect(screen.queryByTestId('history-microcopy')).toBeNull();
    });

    it('switching to history mode shows microcopy', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      // Click "Historial real" button
      const readingButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Historial real'));
      expect(readingButtons.length).toBe(1);
      fireEvent.click(readingButtons[0]);

      // Microcopy should appear
      const microcopy = screen.getByTestId('history-microcopy');
      expect(microcopy).toBeTruthy();
      expect(microcopy.textContent).toContain('Las fechas reales aparecen');
    });

    it('history mode with no completed workouts shows empty state', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
          // no resultTimestamps, no completedDayIndices
        />
      );

      const readingButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Historial real'));
      fireEvent.click(readingButtons[0]);

      expect(screen.getByTestId('history-empty')).toBeTruthy();
    });

    it('history mode with completedDayIndices shows completed sessions', () => {
      const rows = makeRows(8);
      const completedDayIndices = new Set([0, 2, 4]);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={5}
          workoutsPerWeek={4}
          context="tracker"
          completedDayIndices={completedDayIndices}
          onSelectDay={onSelectDay}
        />
      );

      const readingButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Historial real'));
      fireEvent.click(readingButtons[0]);

      // Should show 3 completed session buttons (#1, #3, #5)
      const sessionButtons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent?.includes('#'));
      expect(sessionButtons.length).toBe(3);
    });

    it('history mode with resultTimestamps shows real dates', () => {
      const rows = makeRows(4);
      const resultTimestamps: Record<string, string> = {
        '0': '2024-03-15T10:00:00Z',
        '1': '2024-03-17T10:00:00Z',
      };
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={2}
          workoutsPerWeek={4}
          context="tracker"
          resultTimestamps={resultTimestamps}
          onSelectDay={onSelectDay}
        />
      );

      const readingButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Historial real'));
      fireEvent.click(readingButtons[0]);

      // Should show 2 completed sessions
      const sessionButtons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent?.includes('#'));
      expect(sessionButtons.length).toBe(2);
    });

    it('history mode does NOT show nav mode selector (Day/Week/Month)', () => {
      const rows = makeRows(8);
      render(
        <CalendarNavigator
          rows={rows}
          selectedDayIndex={0}
          currentDayIndex={0}
          workoutsPerWeek={4}
          context="tracker"
          onSelectDay={onSelectDay}
        />
      );

      const readingButtons = screen
        .getAllByRole('button')
        .filter((b) => b.hasAttribute('aria-pressed') && b.textContent?.includes('Historial real'));
      fireEvent.click(readingButtons[0]);

      // Nav mode buttons (Day/Week/Month) should not be visible
      const navModeButtons = screen
        .getAllByRole('button')
        .filter(
          (b) =>
            b.hasAttribute('aria-pressed') &&
            (b.textContent?.includes('Día') ||
              b.textContent?.includes('Semana') ||
              b.textContent?.includes('Mes'))
        );
      expect(navModeButtons.length).toBe(0);
    });
  });
});
