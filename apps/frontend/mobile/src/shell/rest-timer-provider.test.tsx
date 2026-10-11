import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Button } from 'react-native';
import { restAlerts } from '../lib/rest/rest-alerts';
import i18n from '../lib/i18n';
import {
  restoreRestAlertsPreference,
  setRestAlertsEnabled,
} from '../lib/rest/rest-alerts-preference';
import { RestTimerBanner, RestTimerProvider, useRestTimer } from './rest-timer-provider';

jest.mock('../lib/rest/rest-alerts', () => ({
  restAlerts: {
    schedule: jest.fn(async () => 'notification'),
    cancel: jest.fn(async () => undefined),
    complete: jest.fn(async () => undefined),
  },
}));

function Controls() {
  const timer = useRestTimer();
  return (
    <>
      <Button title="Start rest" onPress={() => timer.start(90)} />
      <Button title="Replace rest" onPress={() => timer.start(120)} />
      <RestTimerBanner />
    </>
  );
}

const memory = { get: async () => null, set: async () => undefined };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_000);
  jest.clearAllMocks();
  jest.spyOn(globalThis, 'setInterval');
  jest.spyOn(globalThis, 'clearInterval');
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  return setRestAlertsEnabled(true, memory);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('keeps the replacement banner accurate when an old cancellation fails', async () => {
  let rejectCancellation = (_error: Error): void => {};
  jest.mocked(restAlerts.cancel).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectCancellation = reject;
      })
  );
  const view = render(
    <RestTimerProvider>
      <Controls />
    </RestTimerProvider>
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Start rest'));
  });
  expect(screen.getByText('1:30')).toBeTruthy();
  await act(async () => {
    fireEvent.press(screen.getByText('Replace rest'));
  });
  expect(screen.getByText('2:00')).toBeTruthy();
  await act(async () => {
    rejectCancellation(new Error('old notification failed'));
  });
  expect(screen.queryByText(i18n.t('rest.alert_unavailable'))).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: i18n.t('rest.skip') }));
  expect(screen.queryByText('2:00')).toBeNull();
  view.unmount();
  expectProviderIntervalsReleased();
});

it('shows the current alert failure while retaining a usable skip action', async () => {
  jest.mocked(restAlerts.schedule).mockImplementationOnce(() => {
    throw new Error('native unavailable');
  });
  const view = render(
    <RestTimerProvider>
      <Controls />
    </RestTimerProvider>
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Start rest'));
  });
  expect(screen.getByText('1:30')).toBeTruthy();
  expect(screen.getByText(i18n.t('rest.alert_unavailable'))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: i18n.t('rest.skip') }));
  expect(screen.queryByText('1:30')).toBeNull();
  view.unmount();
  expectProviderIntervalsReleased();
});

it('does not nag about unavailable alerts once the lifter turned them off', async () => {
  await setRestAlertsEnabled(false, memory);
  jest.mocked(restAlerts.schedule).mockResolvedValueOnce(null);
  const view = render(
    <RestTimerProvider>
      <Controls />
    </RestTimerProvider>
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Start rest'));
  });
  expect(screen.getByText('1:30')).toBeTruthy();
  expect(screen.queryByText(i18n.t('rest.alert_unavailable'))).toBeNull();
  view.unmount();
});

it('does not nag about unavailable alerts when the lifter was never asked for them', async () => {
  await restoreRestAlertsPreference(memory, async () => 'askable');
  jest.mocked(restAlerts.schedule).mockResolvedValueOnce(null);
  const view = render(
    <RestTimerProvider>
      <Controls />
    </RestTimerProvider>
  );
  await act(async () => {
    fireEvent.press(screen.getByText('Start rest'));
  });
  expect(screen.getByText('1:30')).toBeTruthy();
  expect(screen.queryByText(i18n.t('rest.alert_unavailable'))).toBeNull();
  view.unmount();
});

function expectProviderIntervalsReleased() {
  const intervals = jest.mocked(setInterval);
  const indexes = intervals.mock.calls.flatMap((args, index) => (args[1] === 250 ? [index] : []));
  expect(indexes.length).toBeGreaterThan(0);
  for (const index of indexes) {
    const result = intervals.mock.results[index];
    expect(result?.type).toBe('return');
    expect(clearInterval).toHaveBeenCalledWith(result?.value);
  }
}
