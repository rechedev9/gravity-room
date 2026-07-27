import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import ExerciseDetailRoute from '../app/(protected)/exercise/[exerciseId]';

function ProgramsProbe() {
  return <Text>Programs fallback probe</Text>;
}

describe('deferred route cold-link integration', () => {
  it('rejects an invalid dynamic identifier and exits to Programs without history', async () => {
    renderRouter(
      {
        '(protected)/exercise/[exerciseId]': ExerciseDetailRoute,
        '(protected)/(tabs)/programs/index': ProgramsProbe,
      },
      { initialUrl: '/exercise/bad.value' }
    );

    expect(screen.getByText('This link is invalid or incomplete.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Leave this reserved screen' }));

    expect(await screen.findByText('Programs fallback probe')).toBeTruthy();
  });
});
