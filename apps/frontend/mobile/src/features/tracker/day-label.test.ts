import { distinctDayLabel } from './day-label';

describe('distinctDayLabel', () => {
  it('drops the week and day numbers the header already shows', () => {
    expect(distinctDayLabel('Dia 2')).toBeNull();
    expect(distinctDayLabel('Day 3')).toBeNull();
    expect(distinctDayLabel('Semana 1 - Día 4')).toBeNull();
  });

  it('keeps the part that names the session', () => {
    expect(distinctDayLabel('Semana 1 - Dia 1(SQUAT)')).toBe('SQUAT');
    expect(distinctDayLabel('Day 2 - Upper body')).toBe('Upper body');
    expect(distinctDayLabel('Push')).toBe('Push');
  });
});
