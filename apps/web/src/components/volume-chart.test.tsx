/**
 * volume-chart.test.tsx — DOM structure tests for VolumeChart.
 * Canvas drawing cannot be tested in happy-dom — tests verify
 * DOM structure, accessibility attributes, and prop handling.
 */
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { VolumeChart } from './volume-chart';
import type { VolumeDataPoint } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: VolumeDataPoint[] = [
  { workout: 1, volumeKg: 2400 },
  { workout: 2, volumeKg: 2800 },
  { workout: 3, volumeKg: 3100, date: '15 feb' },
];

const EMPTY_DATA: VolumeDataPoint[] = [];

// ---------------------------------------------------------------------------
// Task 9.6 — VolumeChart
// ---------------------------------------------------------------------------

describe('VolumeChart', () => {
  it('renders <canvas> with aria-label containing the label prop', () => {
    const { container } = render(
      <VolumeChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />
    );

    const canvas = container.querySelector('canvas');

    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-label')).toContain('Volumen por Sesión (kg)');
  });

  it('<figure> container has data-testid="volume-chart"', () => {
    render(<VolumeChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />);

    const figure = screen.getByTestId('volume-chart');

    expect(figure).toBeDefined();
    expect(figure.tagName.toLowerCase()).toBe('figure');
  });

  it('renders without crash when data is empty array', () => {
    expect(() => {
      render(<VolumeChart data={EMPTY_DATA} label="Volumen por Sesión (kg)" />);
    }).not.toThrow();
  });

  it('renders without crash with valid VolumeDataPoint[] data', () => {
    expect(() => {
      render(<VolumeChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />);
    }).not.toThrow();
  });

  it('figure wrapper is present', () => {
    const { container } = render(
      <VolumeChart data={SAMPLE_DATA} label="Volumen por Sesión (kg)" />
    );

    const figure = container.querySelector('figure');

    expect(figure).not.toBeNull();
  });
});
