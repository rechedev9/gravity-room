import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardShell } from './dashboard-shell';

describe('DashboardShell', () => {
  it('renders only the sections that are provided (progressive disclosure)', () => {
    render(
      <DashboardShell hero={<div>HERO</div>} kpi={<div>KPI</div>} recent={<div>RECENT</div>} />
    );

    expect(screen.getByText('HERO')).toBeInTheDocument();
    expect(screen.getByText('KPI')).toBeInTheDocument();
    expect(screen.getByText('RECENT')).toBeInTheDocument();
    expect(screen.queryByText('HEATMAP')).not.toBeInTheDocument();
    expect(screen.queryByText('SPLIT')).not.toBeInTheDocument();
  });

  it('renders every provided section in dashboard order', () => {
    render(
      <DashboardShell
        mentor={<div>MENTOR</div>}
        hero={<div>HERO</div>}
        kpi={<div>KPI</div>}
        heatmap={<div>HEATMAP</div>}
        split={<div>SPLIT</div>}
        recent={<div>RECENT</div>}
      />
    );

    const labels = ['MENTOR', 'HERO', 'KPI', 'HEATMAP', 'SPLIT', 'RECENT'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
