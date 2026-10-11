import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileScreen } from './profile-screen';
import { setLanguagePreference } from '../../lib/i18n/language-preference';
import {
  openRestAlertsSettings,
  readRestAlertsAccess,
  requestRestAlertsAccess,
} from '../../lib/rest/rest-alerts-access';
import {
  getRestAlertsPreference,
  restoreRestAlertsPreference,
} from '../../lib/rest/rest-alerts-preference';

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

describe('ProfileScreen rest alerts switch', () => {
  const readAccess = jest.mocked(readRestAlertsAccess);
  const requestAccess = jest.mocked(requestRestAlertsAccess);
  const noStorage = { get: async () => null, set: async () => undefined };

  async function renderSwitch(access: Awaited<ReturnType<typeof readRestAlertsAccess>>) {
    readAccess.mockResolvedValue(access);
    await restoreRestAlertsPreference(noStorage, readAccess);
    render(<ProfileScreen user={USER} onSignOut={jest.fn()} />);
    const toggle = await screen.findByRole('switch', { name: 'Rest timer alerts' });
    await waitFor(() => expect(toggle.props.accessibilityState.disabled).toBe(false));
    return toggle;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts off before the permission is asked and asks only when switched on', async () => {
    requestAccess.mockResolvedValue('granted');
    const toggle = await renderSwitch('askable');

    expect(getRestAlertsPreference().enabled).toBe(false);
    expect(toggle.props.accessibilityState.checked).toBe(false);
    expect(screen.getByText('Off. The timer still counts down on screen.')).toBeTruthy();
    expect(requestAccess).not.toHaveBeenCalled();

    fireEvent.press(toggle);

    await waitFor(() => expect(requestAccess).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getRestAlertsPreference().enabled).toBe(true));
    expect(
      screen.getByRole('switch', { name: 'Rest timer alerts' }).props.accessibilityState.checked
    ).toBe(true);
  });

  it('turns alerts off while the permission is still waiting', async () => {
    requestAccess.mockResolvedValue('askable');
    const toggle = await renderSwitch('askable');
    fireEvent.press(toggle);
    await waitFor(() => expect(getRestAlertsPreference().enabled).toBe(true));
    expect(await screen.findByText('Allow notifications')).toBeTruthy();
    requestAccess.mockClear();

    fireEvent.press(screen.getByRole('switch', { name: 'Rest timer alerts' }));

    await waitFor(() => expect(getRestAlertsPreference().enabled).toBe(false));
    expect(requestAccess).not.toHaveBeenCalled();
    expect(screen.queryByText('Allow notifications')).toBeNull();
    expect(screen.getByText('Off. The timer still counts down on screen.')).toBeTruthy();
  });

  it('tells the truth when alerts are wanted but the system blocks them', async () => {
    const toggle = await renderSwitch('blocked');
    fireEvent.press(toggle);
    await waitFor(() => expect(getRestAlertsPreference().enabled).toBe(true));

    expect(
      await screen.findByText(
        'Notifications are blocked for Gravity Room, so no alert will sound. Allow them in system settings.'
      )
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    await waitFor(() => expect(jest.mocked(openRestAlertsSettings)).toHaveBeenCalled());
  });

  it('keeps alerts on for a lifter who already granted the permission', async () => {
    const toggle = await renderSwitch('granted');

    expect(getRestAlertsPreference().enabled).toBe(true);
    expect(toggle.props.accessibilityState.checked).toBe(true);
    expect(
      screen.getByText('A sound and a notification when your rest ends, even with the screen off.')
    ).toBeTruthy();
  });
});
