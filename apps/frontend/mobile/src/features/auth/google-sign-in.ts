import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { canPersistRefreshToken } from '../../lib/auth/secure-storage';

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthResult = {
  readonly disabled: boolean;
  readonly promptAsync: () => Promise<string | null>;
};

function readConfiguredClientId(value: string | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return undefined;
}

export function useGoogleIdTokenPrompt(): GoogleAuthResult {
  const defaultClientId = readConfiguredClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
  const androidClientId = readConfiguredClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
  const iosClientId = readConfiguredClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const webClientId = readConfiguredClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const hasConfiguredClientId =
    defaultClientId !== undefined ||
    androidClientId !== undefined ||
    iosClientId !== undefined ||
    webClientId !== undefined;
  // The mobile Google endpoint returns a body refresh token. Production Expo
  // Web must use the cookie-backed web auth flow instead of exposing that token
  // to JavaScript storage, so do not even start this exchange there.
  const bodyRefreshTokenAllowed = canPersistRefreshToken(Platform.OS, __DEV__);

  const [request, _response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: defaultClientId ?? 'missing-google-client-id',
    ...(androidClientId !== undefined ? { androidClientId } : {}),
    ...(iosClientId !== undefined ? { iosClientId } : {}),
    ...(webClientId !== undefined ? { webClientId } : {}),
    selectAccount: true,
  });

  useEffect(() => {
    void WebBrowser.warmUpAsync().catch(() => {
      // Browser warm-up is an optimization; auth remains usable if it fails.
    });
    return () => {
      void WebBrowser.coolDownAsync().catch(() => {
        // Cleanup failure must not surface as an unhandled rejection.
      });
    };
  }, []);

  return {
    disabled: request === null || !hasConfiguredClientId || !bodyRefreshTokenAllowed,
    promptAsync: async () => {
      if (!hasConfiguredClientId || !bodyRefreshTokenAllowed) {
        return null;
      }

      const result = await promptAsync();
      if (result.type !== 'success') {
        return null;
      }

      const idToken = result.params.id_token;
      return typeof idToken === 'string' && idToken.length > 0 ? idToken : null;
    },
  };
}
