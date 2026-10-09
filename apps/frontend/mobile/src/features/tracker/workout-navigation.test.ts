import { workoutScrollTarget } from './workout-navigation';

describe('workoutScrollTarget', () => {
  const base = { viewportHeight: 800, margin: 20 };

  it('keeps the header in view when the active exercise already fits', () => {
    expect(workoutScrollTarget({ ...base, heroTop: 300, heroBottom: 560 })).toBe(0);
  });

  it('scrolls just enough to reveal an active exercise below the fold', () => {
    expect(workoutScrollTarget({ ...base, heroTop: 700, heroBottom: 940 })).toBe(160);
  });

  it('never scrolls past the top edge of a tall active exercise', () => {
    expect(workoutScrollTarget({ ...base, heroTop: 300, heroBottom: 1400 })).toBe(280);
  });
});
