import { heroRevealTarget, workoutScrollTarget } from './workout-navigation';

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

describe('heroRevealTarget', () => {
  const base = { viewportHeight: 700, margin: 20 };

  it('does nothing while the active exercise is fully visible', () => {
    expect(heroRevealTarget({ ...base, scrollY: 0, heroTop: 200, heroBottom: 600 })).toBeNull();
  });

  it('brings the bottom of a card that grew or lost viewport into view', () => {
    expect(heroRevealTarget({ ...base, scrollY: 0, heroTop: 400, heroBottom: 760 })).toBe(80);
  });

  it('stops at the card top when the card is taller than the viewport', () => {
    expect(heroRevealTarget({ ...base, scrollY: 100, heroTop: 300, heroBottom: 1300 })).toBe(280);
    expect(heroRevealTarget({ ...base, scrollY: 400, heroTop: 300, heroBottom: 1300 })).toBeNull();
  });

  it('scrolls back up when the active exercise is entirely above the viewport', () => {
    expect(heroRevealTarget({ ...base, scrollY: 900, heroTop: 100, heroBottom: 400 })).toBe(80);
  });
});
