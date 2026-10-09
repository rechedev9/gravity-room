import { type } from './design';

describe('type tokens', () => {
  it('never combine a custom face with a bold fontWeight', () => {
    // Android resolves that pair to system Roboto Bold instead of the loaded face.
    const offenders = Object.entries(type).filter(([, style]) => {
      const weight = 'fontWeight' in style ? Number(style.fontWeight) : 0;
      return weight >= 700;
    });
    expect(offenders.map(([name]) => name)).toEqual([]);
  });
});
