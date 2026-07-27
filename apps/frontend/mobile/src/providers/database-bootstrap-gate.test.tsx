import { fireEvent, render, screen } from '@testing-library/react-native';
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

  it('does not mount the route tree until the local database is ready', async () => {
    mockedBootstrapDatabase.mockResolvedValue(undefined);

    render(
      <DatabaseBootstrapGate>
        <Text>Route tree</Text>
      </DatabaseBootstrapGate>
    );

    expect(screen.queryByText('Route tree')).toBeNull();
    expect(await screen.findByText('Route tree')).toBeTruthy();
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

    expect(await screen.findByText('Route tree')).toBeTruthy();
    expect(mockedBootstrapDatabase).toHaveBeenCalledTimes(2);
  });
});
