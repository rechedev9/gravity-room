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

    expect(screen.getByTestId('database-bootstrap-loading')).toBeTruthy();
    expect(
      screen.getByTestId('database-bootstrap-content', { includeHiddenElements: true }).props
    ).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(screen.getByTestId('database-bootstrap-loading').props).toMatchObject({
      accessibilityViewIsModal: true,
      importantForAccessibility: 'yes',
    });
    await waitFor(() => {
      expect(screen.queryByTestId('database-bootstrap-loading')).toBeNull();
    });
    expect(screen.getByText('Route tree')).toBeTruthy();
    expect(screen.getByTestId('database-bootstrap-content').props).toMatchObject({
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
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

    const errorOverlay = await screen.findByTestId('database-bootstrap-error');
    expect(errorOverlay.props).toMatchObject({
      accessibilityViewIsModal: true,
      importantForAccessibility: 'yes',
    });
    expect(
      screen.getByTestId('database-bootstrap-content', { includeHiddenElements: true }).props
    ).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });

    fireEvent.press(screen.getByRole('button', { name: 'Retry opening local training data' }));

    expect(screen.getByText('Route tree', { includeHiddenElements: true })).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Retry opening local training data' })
      ).toBeNull();
    });
    expect(mockedBootstrapDatabase).toHaveBeenCalledTimes(2);
  });
});
