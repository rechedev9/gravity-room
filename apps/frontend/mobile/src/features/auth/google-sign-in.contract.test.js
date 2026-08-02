const { readFileSync } = require('node:fs');
const { join } = require('node:path');

describe('google-sign-in Expo env contract', () => {
  it('uses statically referenced Expo public Google client IDs so Metro can inline them', () => {
    const source = readFileSync(join(__dirname, 'google-sign-in.ts'), 'utf8');

    expect(source).toContain('process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID');
    expect(source).toContain('process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
    expect(source).toContain('process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    expect(source).toContain('process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    expect(source).not.toContain("Reflect.get(globalThis, 'process')");
    expect(source).toContain('canPersistRefreshToken(Platform.OS, __DEV__)');
  });

  it('rejects unsupported production Expo Web before the server exchange can mint a session', () => {
    const source = readFileSync(join(__dirname, '../../lib/auth/session.ts'), 'utf8');
    const policyGuard = source.indexOf('if (!canPersistRefreshToken(Platform.OS, __DEV__))');
    const serverExchange = source.indexOf(
      'const authenticated = await authenticateWithGoogleIdToken(credential);'
    );

    expect(policyGuard).toBeGreaterThan(-1);
    expect(serverExchange).toBeGreaterThan(policyGuard);
  });
});
