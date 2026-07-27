import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../app/(tabs)/_layout';

function ProgramsProbe() {
  const [visits, setVisits] = useState(0);

  return (
    <Pressable
      accessibilityLabel="Increment programs state"
      accessibilityRole="button"
      onPress={() => setVisits((current) => current + 1)}
    >
      <Text>{`Programs state ${visits}`}</Text>
    </Pressable>
  );
}

function TrackerProbe() {
  return <Text>Tracker route</Text>;
}

function ProfileProbe() {
  return <Text>Profile route</Text>;
}

describe('primary tab integration', () => {
  it('preserves a tab screen state while switching among the three primary tabs', async () => {
    renderRouter(
      {
        '(tabs)/_layout': TabsLayout,
        '(tabs)/programs': ProgramsProbe,
        '(tabs)/tracker': TrackerProbe,
        '(tabs)/profile': ProfileProbe,
      },
      { initialUrl: '/programs' }
    );

    fireEvent.press(screen.getByRole('button', { name: 'Increment programs state' }));
    expect(screen.getByText('Programs state 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open tracker tab' }));
    expect(await screen.findByText('Tracker route')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open programs tab' }));
    expect(await screen.findByText('Programs state 1')).toBeTruthy();
  });
});
