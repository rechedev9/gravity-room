import { RestTimer, restSecondsForRole, type RestTimerEffects } from './rest-timer';

function setup() {
  let now = 1_000;
  const effects = {
    schedule: jest
      .fn<ReturnType<RestTimerEffects['schedule']>, Parameters<RestTimerEffects['schedule']>>()
      .mockResolvedValue('notification-1'),
    cancel: jest.fn(async () => undefined),
    complete: jest.fn(async () => undefined),
  };
  return {
    effects,
    timer: new RestTimer(effects, () => now),
    setNow: (time: number) => {
      now = time;
    },
  };
}

it.each([
  ['primary', 180],
  ['secondary', 120],
  ['accessory', 90],
  [undefined, 90],
] as const)('uses the rest duration for %s', (role, seconds) => {
  expect(restSecondsForRole(role)).toBe(seconds);
});

it('finishes once after JS was suspended beyond the deadline', async () => {
  const { effects, timer, setNow } = setup();
  timer.start(180);
  await Promise.resolve();
  expect(effects.schedule).toHaveBeenCalledWith(181_000);
  setNow(61_000);
  timer.tick();
  expect(timer.getSnapshot().remainingSeconds).toBe(120);
  setNow(190_000);
  timer.tick();
  timer.tick();
  expect(timer.getSnapshot().endsAt).toBeNull();
  expect(effects.complete).toHaveBeenCalledTimes(1);
  expect(effects.cancel).toHaveBeenCalledWith('notification-1');
});

it('cancels a notification that finishes scheduling after skip', async () => {
  const { effects, timer } = setup();
  let release: ((id: string) => void) | undefined;
  effects.schedule.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  timer.start(90);
  timer.skip();
  release?.('late-notification');
  await Promise.resolve();
  expect(effects.cancel).toHaveBeenCalledWith('late-notification');
  expect(effects.complete).not.toHaveBeenCalled();
  expect(timer.getSnapshot().endsAt).toBeNull();
});

it('cancels an older notification without replacing the new timer', async () => {
  const { effects, timer, setNow } = setup();
  let release: ((id: string) => void) | undefined;
  effects.schedule.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  timer.start(90);
  setNow(2_000);
  timer.start(120);
  await Promise.resolve();
  release?.('old-notification');
  await Promise.resolve();
  expect(effects.cancel).toHaveBeenCalledWith('old-notification');
  expect(timer.getSnapshot().endsAt).toBe(122_000);
  timer.skip();
  expect(effects.cancel).toHaveBeenCalledWith('notification-1');
});

it('keeps counting when notification permission is denied', async () => {
  const { effects, timer, setNow } = setup();
  effects.schedule.mockResolvedValue(null);
  timer.start(90);
  await Promise.resolve();
  expect(timer.getSnapshot().alertUnavailable).toBe(true);
  setNow(21_000);
  timer.tick();
  expect(timer.getSnapshot().remainingSeconds).toBe(70);
});

it('leaves an existing timer intact when asked to start an invalid duration', () => {
  const { timer } = setup();
  timer.start(90);
  expect(() => timer.start(NaN)).toThrow();
  expect(timer.getSnapshot().endsAt).toBe(91_000);
});

it('disposes notifications and prevents future completion after logout', async () => {
  const { effects, timer, setNow } = setup();
  const listener = jest.fn();
  timer.start(90);
  await Promise.resolve();
  timer.subscribe(listener);
  timer.dispose();
  setNow(1_000_000);
  timer.tick();
  expect(effects.cancel).toHaveBeenCalledWith('notification-1');
  expect(effects.complete).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled();
});

it('does not restart from a late set-save callback after the owner unmounts', () => {
  const { timer, effects } = setup();
  timer.dispose();
  timer.start(90);
  expect(effects.schedule).not.toHaveBeenCalled();
  expect(timer.getSnapshot().endsAt).toBeNull();
});
