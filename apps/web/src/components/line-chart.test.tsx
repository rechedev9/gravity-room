/**
 * line-chart.test.tsx — structural tests for the Recharts LineChart.
 * Canvas implementation replaced by Recharts SVG renderer.
 */
import { describe, it, expect } from 'bun:test';
import { render } from '@testing-library/react';
import { LineChart } from './charts/line-chart';
import type { ChartDataPoint } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATA_WITH_RESULTS: ChartDataPoint[] = [
  { workout: 1, weight: 60, stage: 0, result: 'success' },
  { workout: 2, weight: 62.5, stage: 0, result: 'success' },
  { workout: 3, weight: 65, stage: 0, result: 'fail' },
];

const EMPTY_DATA: ChartDataPoint[] = [];

// ---------------------------------------------------------------------------
// Accessibility & structure
// ---------------------------------------------------------------------------

describe('LineChart', () => {
  describe('accessibility', () => {
    it('renders a <details> element containing a <table> with correct row count', () => {
      render(<LineChart data={DATA_WITH_RESULTS} label="Sentadilla" />);

      const details = document.querySelector('details');
      expect(details).not.toBeNull();

      const table = details?.querySelector('table');
      expect(table).not.toBeNull();

      const rows = table?.querySelectorAll('tbody tr');
      expect(rows?.length).toBe(DATA_WITH_RESULTS.length);
    });

    it('renders a <figcaption> with sr-only class containing the label', () => {
      render(<LineChart data={DATA_WITH_RESULTS} label="Press Banca" />);

      const figcaption = document.querySelector('figcaption');
      expect(figcaption?.textContent).toBe('Press Banca');
      expect(figcaption?.className).toContain('sr-only');
    });

    it('renders a <figure> wrapper', () => {
      render(<LineChart data={DATA_WITH_RESULTS} label="Peso Muerto" />);
      expect(document.querySelector('figure')).not.toBeNull();
    });

    it('accessibility <details> table still renders (regression guard)', () => {
      render(<LineChart data={DATA_WITH_RESULTS} label="Sentadilla" />);
      const details = document.querySelector('details');
      expect(details).not.toBeNull();
      expect(details?.querySelector('table')).not.toBeNull();
    });
  });

  describe('empty / minimal data handling', () => {
    it('renders without crash for empty data', () => {
      expect(() => {
        render(<LineChart data={EMPTY_DATA} label="Sentadilla" />);
      }).not.toThrow();
    });

    it('renders without crash when mode="numeric" prop provided', () => {
      expect(() => {
        render(
          <LineChart data={DATA_WITH_RESULTS} label="RPE Test" mode="numeric" yAxisLabel="RPE" />
        );
      }).not.toThrow();
    });
  });
});
