import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileScreen } from './profile-screen';

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
