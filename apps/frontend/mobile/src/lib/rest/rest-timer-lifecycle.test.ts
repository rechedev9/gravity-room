import { RestTimer } from './rest-timer';

function deferred<T>() {
  let resolve = (_value: T): void => {};
  let reject = (_error: Error): void => {};
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function setup() {
  let now = 1_000;
  const effects = {
    schedule: jest.fn<Promise<string | null>, [number]>().mockResolvedValue('notification'),
    cancel: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    complete: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };
  const timer = new RestTimer(effects, () => now);
  return {
    timer,
    effects,
    setNow: (value: number) => {
      now = value;
    },
  };
}

it('does not mark a replacement unavailable when the old cancellation fails', async () => {
  const { timer, effects } = setup();
  const cancellation = deferred<void>();
  effects.cancel.mockReturnValueOnce(cancellation.promise);
  timer.start(90);
  await Promise.resolve();
  timer.start(120);
  await Promise.resolve();
  cancellation.reject(new Error('old cancellation failed'));
  await Promise.resolve();
  expect(timer.getSnapshot()).toEqual({
    endsAt: 121_000,
    remainingSeconds: 120,
    alertUnavailable: false,
  });
});

it('ignores a failed old completion after a new rest begins', async () => {
  const { timer, effects, setNow } = setup();
  const completion = deferred<void>();
  effects.complete.mockReturnValueOnce(completion.promise);
  timer.start(90);
  await Promise.resolve();
  setNow(91_000);
  timer.tick();
  timer.start(120);
  completion.reject(new Error('old haptic failed'));
  await Promise.resolve();
  expect(timer.getSnapshot()).toEqual({
    endsAt: 211_000,
    remainingSeconds: 120,
    alertUnavailable: false,
  });
});

it.each(['skip', 'dispose'] as const)(
  'does not publish a late cancellation error after %s',
  async (action) => {
    const { timer, effects } = setup();
    const cancellation = deferred<void>();
    effects.cancel.mockReturnValueOnce(cancellation.promise);
    timer.start(90);
    await Promise.resolve();
    timer[action]();
    const snapshot = timer.getSnapshot();
    const listener = jest.fn();
    const unsubscribe = timer.subscribe(listener);
    cancellation.reject(new Error('late cancellation failed'));
    await Promise.resolve();
    expect(timer.getSnapshot()).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  }
);

it('does not publish a late completion error after disposal and reactivation', async () => {
  const { timer, effects, setNow } = setup();
  const completion = deferred<void>();
  effects.complete.mockReturnValueOnce(completion.promise);
  timer.start(90);
  setNow(91_000);
  timer.tick();
  timer.dispose();
  timer.activate();
  timer.start(120);
  completion.reject(new Error('late haptic failed'));
  await Promise.resolve();
  expect(timer.getSnapshot().alertUnavailable).toBe(false);
});

it('still reports an alert failure for the current timer', async () => {
  const { timer, effects } = setup();
  effects.schedule.mockRejectedValueOnce(new Error('permission failure'));
  timer.start(90);
  await Promise.resolve();
  expect(timer.getSnapshot()).toEqual({
    endsAt: 91_000,
    remainingSeconds: 90,
    alertUnavailable: true,
  });
});

it('keeps the countdown when a native schedule method throws synchronously', () => {
  const { timer, effects } = setup();
  effects.schedule.mockImplementationOnce(() => {
    throw new Error('native unavailable');
  });
  expect(() => timer.start(90)).not.toThrow();
  expect(timer.getSnapshot()).toEqual({
    endsAt: 91_000,
    remainingSeconds: 90,
    alertUnavailable: true,
  });
});

it('finishes once when a native haptic method throws synchronously', () => {
  const { timer, effects, setNow } = setup();
  effects.complete.mockImplementationOnce(() => {
    throw new Error('native unavailable');
  });
  timer.start(90);
  setNow(91_000);
  expect(() => timer.tick()).not.toThrow();
  timer.tick();
  expect(effects.complete).toHaveBeenCalledTimes(1);
  expect(timer.getSnapshot()).toEqual({
    endsAt: null,
    remainingSeconds: 0,
    alertUnavailable: true,
  });
});

it('cleans up a late scheduled notification even when its cancellation rejects', async () => {
  const { timer, effects } = setup();
  const scheduling = deferred<string | null>();
  effects.schedule.mockReturnValueOnce(scheduling.promise);
  effects.cancel.mockRejectedValueOnce(new Error('cancel failed'));
  timer.start(90);
  timer.start(120);
  scheduling.resolve('late-notification');
  await Promise.resolve();
  await Promise.resolve();
  expect(effects.cancel).toHaveBeenCalledWith('late-notification');
  expect(timer.getSnapshot().alertUnavailable).toBe(false);
});

it('cancels the active notification after an old scheduling request resolves', async () => {
  const { timer, effects } = setup();
  const scheduling = deferred<string | null>();
  effects.schedule
    .mockReturnValueOnce(scheduling.promise)
    .mockResolvedValueOnce('new-notification');
  timer.start(90);
  timer.start(120);
  await Promise.resolve();
  scheduling.resolve('old-notification');
  await Promise.resolve();
  timer.skip();
  expect(effects.cancel.mock.calls).toEqual([['old-notification'], ['new-notification']]);
});

it.each([Number.MAX_VALUE, 8_640_000_000_001])(
  'rejects unrepresentable duration %s without replacing a timer',
  async (duration) => {
    const { timer, effects } = setup();
    timer.start(90);
    await Promise.resolve();
    const snapshot = timer.getSnapshot();
    expect(() => timer.start(duration)).toThrow('valid date');
    expect(timer.getSnapshot()).toBe(snapshot);
    expect(effects.cancel).not.toHaveBeenCalled();
    expect(effects.schedule).toHaveBeenCalledTimes(1);
  }
);

it('rejects an invalid wall clock before releasing a valid notification', async () => {
  const { timer, effects, setNow } = setup();
  timer.start(90);
  await Promise.resolve();
  setNow(Number.NaN);
  expect(() => timer.start(120)).toThrow('valid date');
  expect(effects.cancel).not.toHaveBeenCalled();
  expect(timer.getSnapshot().endsAt).toBe(91_000);
});
