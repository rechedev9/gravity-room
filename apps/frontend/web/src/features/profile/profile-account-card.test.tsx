import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { ProfileAccountCard } from './profile-account-card';

describe('ProfileAccountCard accessibility', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('localizes the weight-unit control name and gives it a touch-sized target', () => {
    render(
      <ProfileAccountCard
        user={{
          id: 'qa6-user',
          email: 'qa6-user@example.com',
          name: 'QA 6',
          avatarUrl: undefined,
        }}
        displayName="QA 6"
        userInitials="Q6"
        avatarUploading={false}
        fileInputRef={createRef<HTMLInputElement>()}
        unit="kg"
        onAvatarClick={vi.fn()}
        onFileChange={vi.fn()}
        onRemoveAvatar={vi.fn()}
        onDeleteRequest={vi.fn()}
        onUpdateName={vi.fn(async () => {})}
        onToggleUnit={vi.fn()}
      />
    );

    const unitToggle = screen.getByRole('button', { name: 'Switch to pounds' });
    expect(unitToggle).toHaveClass('min-h-11');
    expect(unitToggle).not.toHaveAccessibleName('Cambiar a pounds');
  });
});
