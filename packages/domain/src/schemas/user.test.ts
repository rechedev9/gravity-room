import { describe, expect, it } from 'vitest';
import { parseUserSafe } from './user';

describe('parseUserSafe weight unit', () => {
  const base = { id: 'u1', email: 'a@b.co' };

  it('keeps a valid unit from the account', () => {
    expect(parseUserSafe({ ...base, weightUnit: 'lbs' })?.weightUnit).toBe('lbs');
  });

  it('leaves the unit out when an older API does not send it', () => {
    expect(parseUserSafe(base)).toEqual(base);
  });

  it('drops an unknown unit instead of rejecting the user', () => {
    expect(parseUserSafe({ ...base, weightUnit: 'stone' })).toEqual(base);
  });
});
