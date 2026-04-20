import { render, screen } from '@testing-library/react-native';

import { App } from './App';
import { restoreSession } from '../lib/auth/session';

jest.mock('../lib/auth/session', () => ({
  restoreSession: jest.fn(),
}));

const mockedRestoreSession = jest.mocked(restoreSession);

describe('App', () => {
  afterEach(() => {
    mockedRestoreSession.mockReset();
  });

  it('renders the Google sign-in CTA', () => {
    mockedRestoreSession.mockResolvedValue(null);

    render(<App />);

    return expect(screen.findByText('Continue with Google')).resolves.toBeTruthy();
  });

  it('renders the restored user profile when a session is available', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    render(<App />);

    expect(await screen.findByText('Test Athlete')).toBeTruthy();
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('falls back to the signed-out shell when session restore rejects', async () => {
    mockedRestoreSession.mockRejectedValue(new Error('Network request failed'));

    render(<App />);

    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });
});
