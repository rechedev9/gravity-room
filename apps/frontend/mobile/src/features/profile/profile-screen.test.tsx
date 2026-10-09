import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileScreen } from './profile-screen';
import { setLanguagePreference } from '../../lib/i18n/language-preference';

const USER = {
  id: 'user-123',
  email: 'athlete@example.com',
  name: 'Test Athlete',
  avatarUrl: null,
} as const;

describe('ProfileScreen sign-out', () => {
  it('shows a retry state while retaining the profile after secure deletion fails', async () => {
    const onSignOut = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('SecureStore deletion failed'))
      .mockResolvedValueOnce();

    render(<ProfileScreen user={USER} onSignOut={onSignOut} />);

    fireEvent.press(screen.getByRole('button', { name: 'Sign out of Gravity Room' }));

    expect(
      await screen.findByText(
        'Secure sign-out could not be completed. Your session is still shown so you can retry.'
      )
    ).toBeTruthy();
    expect(screen.getByText('athlete@example.com')).toBeTruthy();
    expect(screen.getByText('Retry sign out')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Sign out of Gravity Room' }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(2));
  });
});

describe('ProfileScreen settings', () => {
  afterEach(async () => {
    await setLanguagePreference('system', { get: async () => null, set: async () => undefined });
  });

  it('shows the identity and app version', () => {
    render(<ProfileScreen user={USER} onSignOut={jest.fn()} />);
    expect(screen.getByText('Test Athlete')).toBeTruthy();
    expect(screen.getByText('TA')).toBeTruthy();
    expect(screen.getByText('Version')).toBeTruthy();
  });

  it('switches the interface language immediately from the language choice', async () => {
    render(<ProfileScreen user={USER} onSignOut={jest.fn()} />);
    expect(screen.getByText('Preferences')).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: 'Español' }));

    expect(await screen.findByText('Preferencias')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión de Gravity Room' })).toBeTruthy();
  });
});
