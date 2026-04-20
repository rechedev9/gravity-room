import { render, screen } from '@testing-library/react-native';

import { App } from './App';
import { listProgramSummaries } from '../lib/programs/program-repository';
import { restoreSession } from '../lib/auth/session';

jest.mock('../lib/auth/session', () => ({
  restoreSession: jest.fn(),
}));

jest.mock('../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

const mockedRestoreSession = jest.mocked(restoreSession);
const mockedListProgramSummaries = jest.mocked(listProgramSummaries);

describe('App', () => {
  afterEach(() => {
    mockedRestoreSession.mockReset();
    mockedListProgramSummaries.mockReset();
  });

  it('renders the Google sign-in CTA', () => {
    mockedRestoreSession.mockResolvedValue(null);

    render(<App />);

    return expect(screen.findByText('Continue with Google')).resolves.toBeTruthy();
  });

  it('renders cached programs when a session is available', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedListProgramSummaries.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('Cached training blocks')).toBeTruthy();
    expect(await screen.findByText('No cached programs yet.')).toBeTruthy();
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('falls back to the signed-out shell when session restore rejects', async () => {
    mockedRestoreSession.mockRejectedValue(new Error('Network request failed'));

    render(<App />);

    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });
});
