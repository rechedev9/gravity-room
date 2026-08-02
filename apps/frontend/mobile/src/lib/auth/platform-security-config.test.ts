import appConfig from '../../../app.json';

describe('native transport security configuration', () => {
  it.each([
    {
      platform: 'Android',
      actual: appConfig.expo.android.usesCleartextTraffic,
      expected: false,
    },
    {
      platform: 'iOS arbitrary loads',
      actual: appConfig.expo.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads,
      expected: false,
    },
    {
      platform: 'iOS local networking',
      actual: appConfig.expo.ios.infoPlist.NSAppTransportSecurity.NSAllowsLocalNetworking,
      expected: false,
    },
  ])('disables cleartext transport for $platform', ({ actual, expected }) => {
    expect(actual).toBe(expected);
  });
});
