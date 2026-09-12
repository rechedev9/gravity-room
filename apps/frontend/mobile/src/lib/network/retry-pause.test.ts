import { rebaseRetryDeadline, RetryPause } from './retry-pause';

describe('retry pause clock correction', () => {
  it.each([
    [160000, 100000, 100000, 160000],
    [160000, 100000, 130000, 160000],
    [160000, 100000, 160001, 160000],
    [160000, 100000, 90000, 150000],
    [160000, 100000, -100000, -40000],
    [100000, 100000, 90000, 90000],
    [90000, 100000, 80000, 80000],
  ])('rebases deadline %s recorded at %s for clock %s', (deadline, recorded, now, expected) => {
    expect(rebaseRetryDeadline(deadline, recorded, now)).toBe(expected);
  });

  it('rebases once at the new anchor instead of sliding on every read', () => {
    const pause = new RetryPause(160000, 100000);
    expect(pause.readDeadline(90000)).toBe(150000);
    expect(pause.readDeadline(90000)).toBe(150000);
    expect(pause.readDeadline(100000)).toBe(150000);
    expect(pause.readDeadline(149999)).toBe(150000);
  });

  it('can rebase again after a further backwards correction', () => {
    const pause = new RetryPause(160000, 100000);
    expect(pause.readDeadline(90000)).toBe(150000);
    expect(pause.readDeadline(80000)).toBe(140000);
    expect(pause.readDeadline(80001)).toBe(140000);
  });

  it('leaves expiry and reset decisions to the caller', () => {
    const pause = new RetryPause(160000, 100000);
    expect(pause.readDeadline(160000)).toBe(160000);
    expect(pause.readDeadline(170000)).toBe(160000);
    const replacement = new RetryPause(180000, 170000);
    expect(replacement.readDeadline(170000)).toBe(180000);
    expect(pause.readDeadline(170000)).toBe(160000);
  });

  it('anchors to recording, not the most recent forward read', () => {
    const pause = new RetryPause(160000, 100000);
    expect(pause.readDeadline(140000)).toBe(160000);
    expect(pause.readDeadline(130000)).toBe(160000);
  });

  it('keeps independently scoped pauses isolated', () => {
    const auth = new RetryPause(160000, 100000);
    const outbox = new RetryPause(200000, 100000);
    expect(auth.readDeadline(90000)).toBe(150000);
    expect(outbox.readDeadline(100000)).toBe(200000);
    expect(outbox.readDeadline(80000)).toBe(180000);
    expect(auth.readDeadline(100000)).toBe(150000);
  });

  it('preserves long server pauses without owning a platform timer', () => {
    const pause = new RetryPause(1e12, 100000);
    expect(pause.readDeadline(0)).toBe(1e12 - 100000);
    expect(pause.readDeadline(300000)).toBe(1e12 - 100000);
  });
});
