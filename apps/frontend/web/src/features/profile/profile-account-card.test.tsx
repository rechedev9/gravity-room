import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { ProfilePreferences } from './profile-account-card';

describe('ProfilePreferences accessibility', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('localizes the weight-unit control name and gives it a touch-sized target', () => {
    render(<ProfilePreferences unit="kg" onToggleUnit={vi.fn()} />);

    const unitToggle = screen.getByRole('button', { name: 'Switch to pounds' });
    expect(unitToggle).toHaveClass('min-h-11');
    expect(unitToggle).not.toHaveAccessibleName('Cambiar a pounds');
  });
});
