import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppErrorBoundary } from './app-error-boundary';

let shouldCrash = true;

function CrashProbe() {
  if (shouldCrash) {
    throw new Error('render failed');
  }

  return <Text>Recovered route</Text>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    shouldCrash = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('contains a render error and lets the user retry the route tree', async () => {
    render(
      <AppErrorBoundary>
        <CrashProbe />
      </AppErrorBoundary>
    );

    const retryButton = await screen.findByRole('button', { name: 'Retry loading Gravity Room' });
    shouldCrash = false;
    fireEvent.press(retryButton);

    expect(await screen.findByText('Recovered route')).toBeTruthy();
  });
});
