import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { bootstrapDatabase } from '../lib/db/client';
import { DatabaseBootstrapGate } from './database-bootstrap-gate';

jest.mock('../lib/db/client', () => ({
  bootstrapDatabase: jest.fn(),
}));

const mockedBootstrapDatabase = jest.mocked(bootstrapDatabase);

describe('DatabaseBootstrapGate', () => {
  afterEach(() => {
    mockedBootstrapDatabase.mockReset();
  });

  it('mounts the route tree immediately beneath a blocking bootstrap overlay', async () => {
    mockedBootstrapDatabase.mockResolvedValue(undefined);

    render(
      <DatabaseBootstrapGate>
        <Text>Route tree</Text>
      </DatabaseBootstrapGate>
    );

    expect(screen.getByText('Route tree')).toBeTruthy();
    expect(screen.getByTestId('database-bootstrap-loading')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByTestId('database-bootstrap-loading')).toBeNull();
    });
  });

  it('offers a localized retry after bootstrap fails', async () => {
    mockedBootstrapDatabase
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(undefined);

    render(
      <DatabaseBootstrapGate>
        <Text>Route tree</Text>
      </DatabaseBootstrapGate>
    );

    fireEvent.press(
      await screen.findByRole('button', { name: 'Retry opening local training data' })
    );

    expect(screen.getByText('Route tree')).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Retry opening local training data' })
      ).toBeNull();
    });
    expect(mockedBootstrapDatabase).toHaveBeenCalledTimes(2);
  });
});
