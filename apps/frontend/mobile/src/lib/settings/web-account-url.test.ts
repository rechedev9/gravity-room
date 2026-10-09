import { webAppUrl } from './web-account-url';

describe('webAppUrl', () => {
  it('uses the https API origin', () => {
    expect(webAppUrl('/app/profile', 'https://api.example.com/api', false)).toBe(
      'https://api.example.com/app/profile'
    );
  });

  it('falls back to the public site for local or missing configuration', () => {
    expect(webAppUrl('/privacy', 'http://localhost:3001', true)).toBe(
      'https://gravityroom.app/privacy'
    );
    expect(webAppUrl('/privacy', undefined, false)).toBe('https://gravityroom.app/privacy');
  });
});
