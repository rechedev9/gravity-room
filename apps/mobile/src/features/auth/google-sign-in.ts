import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

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

  const [request, _response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: defaultClientId ?? 'missing-google-client-id',
    ...(androidClientId !== undefined ? { androidClientId } : {}),
    ...(iosClientId !== undefined ? { iosClientId } : {}),
    ...(webClientId !== undefined ? { webClientId } : {}),
    selectAccount: true,
  });

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  return {
    disabled: request === null || !hasConfiguredClientId,
    promptAsync: async () => {
      if (!hasConfiguredClientId) {
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
