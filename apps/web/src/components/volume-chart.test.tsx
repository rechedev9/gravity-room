/**
 * volume-chart.test.tsx — structural tests for the Recharts BarChart.
 * Canvas implementation replaced by Recharts SVG renderer.
 */
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { BarChart } from './charts/bar-chart';
import type { VolumeDataPoint } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: VolumeDataPoint[] = [
  { workout: 1, volumeKg: 2400 },
  { workout: 2, volumeKg: 2800 },
  { workout: 3, volumeKg: 3100, date: '2026-02-15' },
];

const EMPTY_DATA: VolumeDataPoint[] = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BarChart (VolumeChart replacement)', () => {
  it('<figure> container has data-testid="volume-chart"', () => {
    render(<BarChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />);

    const figure = screen.getByTestId('volume-chart');

    expect(figure).toBeDefined();
    expect(figure.tagName.toLowerCase()).toBe('figure');
  });

  it('renders without crash when data is empty array', () => {
    expect(() => {
      render(<BarChart data={EMPTY_DATA} label="Volumen por Sesión (kg)" />);
    }).not.toThrow();
  });

  it('renders without crash with valid VolumeDataPoint[] data', () => {
    expect(() => {
      render(<BarChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />);
    }).not.toThrow();
  });

  it('figure wrapper is present', () => {
    const { container } = render(<BarChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />);

    expect(container.querySelector('figure')).not.toBeNull();
  });
});
