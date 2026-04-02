import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ProfileStatCard } from './profile-stat-card';

describe('ProfileStatCard', () => {
  it('should render value and label', () => {
    render(<ProfileStatCard value="42" label="Workouts" />);

    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Workouts')).toBeTruthy();
  });

  it('should render sublabel when provided', () => {
    render(<ProfileStatCard value="42" label="Workouts" sublabel="of 90" />);

    expect(screen.getByText('of 90')).toBeTruthy();
  });

  it('should apply gold left border when accent is true', () => {
    const { container } = render(<ProfileStatCard value="80 kg" label="Squat" accent />);
    const card = container.firstElementChild as HTMLElement;

    expect(card.className).toContain('border-l-2');
    expect(card.className).toContain('border-l-heading');
  });

  it('should render badge when provided', () => {
    render(<ProfileStatCard value="80 kg" label="Squat" badge="+20 kg" badgeVariant="success" />);

    expect(screen.getByText('+20 kg')).toBeTruthy();
  });

  it('should render progress bar with correct role and aria attributes', () => {
    render(
      <ProfileStatCard
        value="27%"
        label="Completion"
        progress={{ value: 27, label: '24 of 90 workouts' }}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeTruthy();
    expect(progressbar.getAttribute('aria-valuenow')).toBe('27');
    expect(progressbar.getAttribute('aria-label')).toBe('24 of 90 workouts');
  });

  it('should clamp progress value between 0 and 100', () => {
    const { container } = render(
      <ProfileStatCard value="100%" label="Done" progress={{ value: 150, label: 'Clamped' }} />
    );

    const fill = container.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('should apply font-display-data class to value element (REQ-TYPO-001)', () => {
    const { container } = render(<ProfileStatCard value="80 kg" label="Squat" />);

    const valueParagraph = container.querySelector('p');

    expect(valueParagraph?.className).toContain('font-display-data');
  });

  it('should NOT have plain font-extrabold class on value element', () => {
    const { container } = render(<ProfileStatCard value="80 kg" label="Squat" />);

    const valueParagraph = container.querySelector('p');

    expect(valueParagraph?.className).not.toContain('font-extrabold');
  });
});
