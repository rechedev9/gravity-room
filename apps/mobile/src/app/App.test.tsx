import { render, screen } from '@testing-library/react-native';

import { App } from './App';
import { listProgramSummaries, upsertProgramSummaries } from '../lib/programs/program-repository';
import { fetchProgramSummaries } from '../lib/programs/program-service';
import { restoreSession } from '../lib/auth/session';

jest.mock('../lib/auth/session', () => ({
  restoreSession: jest.fn(),
}));

jest.mock('../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

jest.mock('../lib/programs/program-service', () => ({
  fetchProgramSummaries: jest.fn(),
}));

const mockedRestoreSession = jest.mocked(restoreSession);
const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedUpsertProgramSummaries = jest.mocked(upsertProgramSummaries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);

describe('App', () => {
  afterEach(() => {
    mockedRestoreSession.mockReset();
    mockedListProgramSummaries.mockReset();
    mockedUpsertProgramSummaries.mockReset();
    mockedFetchProgramSummaries.mockReset();
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
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('Cached training blocks')).toBeTruthy();
    expect(await screen.findByText('No cached programs yet.')).toBeTruthy();
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('hydrates the local cache from remote program summaries before rendering', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockResolvedValue([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    render(<App />);

    expect(await screen.findByText('Power Block')).toBeTruthy();
    expect(mockedFetchProgramSummaries).toHaveBeenCalledTimes(1);
    expect(mockedUpsertProgramSummaries).toHaveBeenCalledWith([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
  });

  it('renders a load error instead of the empty cache state when program loading fails', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));
    mockedListProgramSummaries.mockRejectedValue(new Error('SQLite unavailable'));

    render(<App />);

    expect(await screen.findByText('Unable to load cached programs.')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('No cached programs yet.')).toBeNull();
  });

  it('falls back to the signed-out shell when session restore rejects', async () => {
    mockedRestoreSession.mockRejectedValue(new Error('Network request failed'));

    render(<App />);

    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });
});
