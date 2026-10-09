import { describeSyncAge } from './sync-age';

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

it('buckets elapsed time', () => {
  expect(describeSyncAge(NOW, NOW - 20_000)).toEqual({ kind: 'just_now' });
  expect(describeSyncAge(NOW, NOW - 5 * 60_000)).toEqual({ kind: 'minutes', count: 5 });
  expect(describeSyncAge(NOW, NOW - 3 * 3_600_000 - 1000)).toEqual({ kind: 'hours', count: 3 });
  expect(describeSyncAge(NOW, NOW - 2 * 86_400_000)).toEqual({ kind: 'date' });
});

it('treats a clock set back as just now', () => {
  expect(describeSyncAge(NOW, NOW + 90_000)).toEqual({ kind: 'just_now' });
});
