import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import TabsLayout from '../app/(tabs)/_layout';
import ProfileStackLayout from '../app/(tabs)/profile/_layout';
import ProgramsStackLayout from '../app/(tabs)/programs/_layout';
import TrackerStackLayout from '../app/(tabs)/tracker/_layout';
import { PUBLIC_ROUTE_PATHS, ROUTE_FILE_IDS } from './route-manifest.generated';

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
  it('uses the tab stack names present in the generated filesystem manifest', () => {
    expect(ROUTE_FILE_IDS).toEqual(
      expect.arrayContaining([
        '(tabs)/programs/_layout',
        '(tabs)/programs/index',
        '(tabs)/tracker/_layout',
        '(tabs)/tracker/index',
        '(tabs)/profile/_layout',
        '(tabs)/profile/index',
      ])
    );
    expect(ROUTE_FILE_IDS).not.toContain('(tabs)/programs');
    expect(ROUTE_FILE_IDS).not.toContain('(tabs)/tracker');
    expect(ROUTE_FILE_IDS).not.toContain('(tabs)/profile');
  });

  it('reserves every protected Mobile v2 secondary destination in the real manifest', () => {
    expect(PUBLIC_ROUTE_PATHS).toEqual(
      expect.arrayContaining([
        '/program/[instanceId]',
        '/program/new',
        '/program/editor/[definitionId]',
        '/workout/history',
        '/workout/[sessionId]',
        '/exercise',
        '/exercise/[exerciseId]',
        '/sync',
      ])
    );
  });

  it('preserves a tab screen state while switching among the three primary tabs', async () => {
    renderRouter(
      {
        '(tabs)/_layout': TabsLayout,
        '(tabs)/programs/_layout': ProgramsStackLayout,
        '(tabs)/programs/index': ProgramsProbe,
        '(tabs)/tracker/_layout': TrackerStackLayout,
        '(tabs)/tracker/index': TrackerProbe,
        '(tabs)/profile/_layout': ProfileStackLayout,
        '(tabs)/profile/index': ProfileProbe,
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
