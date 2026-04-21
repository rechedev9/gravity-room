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
  });
});
