import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import TabsLayout from '../app/(protected)/(tabs)/_layout';
import ProfileStackLayout from '../app/(protected)/(tabs)/profile/_layout';
import ProgramsStackLayout from '../app/(protected)/(tabs)/programs/_layout';
import TrackerStackLayout from '../app/(protected)/(tabs)/tracker/_layout';
import TrackerRoute from '../app/(protected)/(tabs)/tracker/index';
import { TrackerHomeScreen } from '../features/tracker/tracker-home-screen';
import { PUBLIC_ROUTE_PATHS, ROUTE_FILE_IDS } from './route-manifest.generated';

jest.mock('../features/tracker/tracker-home-screen', () => ({
  TrackerHomeScreen: jest.fn(() => null),
}));

const mockedTrackerHomeScreen = jest.mocked(TrackerHomeScreen);

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

function ProfileProbe() {
  return <Text>Profile route</Text>;
}

describe('primary tab integration', () => {
  afterEach(() => {
    mockedTrackerHomeScreen.mockClear();
  });

  it('uses the tab stack names present in the generated filesystem manifest', () => {
    expect(ROUTE_FILE_IDS).toEqual(
      expect.arrayContaining([
        '(protected)/(tabs)/programs/_layout',
        '(protected)/(tabs)/programs/index',
        '(protected)/(tabs)/tracker/_layout',
        '(protected)/(tabs)/tracker/index',
        '(protected)/(tabs)/profile/_layout',
        '(protected)/(tabs)/profile/index',
      ])
    );
    expect(ROUTE_FILE_IDS).not.toContain('(protected)/(tabs)/programs');
    expect(ROUTE_FILE_IDS).not.toContain('(protected)/(tabs)/tracker');
    expect(ROUTE_FILE_IDS).not.toContain('(protected)/(tabs)/profile');
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
        '(protected)/(tabs)/_layout': TabsLayout,
        '(protected)/(tabs)/programs/_layout': ProgramsStackLayout,
        '(protected)/(tabs)/programs/index': ProgramsProbe,
        '(protected)/(tabs)/tracker/_layout': TrackerStackLayout,
        '(protected)/(tabs)/tracker/index': TrackerRoute,
        '(protected)/(tabs)/profile/_layout': ProfileStackLayout,
        '(protected)/(tabs)/profile/index': ProfileProbe,
      },
      { initialUrl: '/programs' }
    );

    fireEvent.press(screen.getByRole('button', { name: 'Increment programs state' }));
    expect(screen.getByText('Programs state 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open tracker tab' }));
    await waitFor(() => {
      expect(mockedTrackerHomeScreen).toHaveBeenLastCalledWith({ refreshRevision: 1 }, undefined);
    });

    fireEvent.press(screen.getByRole('button', { name: 'Open programs tab' }));
    expect(await screen.findByText('Programs state 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open tracker tab' }));
    await waitFor(() => {
      expect(mockedTrackerHomeScreen).toHaveBeenLastCalledWith({ refreshRevision: 2 }, undefined);
    });
  });
});
