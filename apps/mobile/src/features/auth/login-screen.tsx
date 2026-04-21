import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../app/auth-provider';
import { useGoogleIdTokenPrompt } from './google-sign-in';

export function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { disabled, promptAsync } = useGoogleIdTokenPrompt();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Gravity Room</Text>
        <Text style={styles.title}>Train with intent.</Text>
        <Text style={styles.body}>Pick your Google account to restore your training state.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={disabled}
          onPress={() => {
            void promptAsync()
              .then((credential) => {
                if (!credential) {
                  return;
                }

                void signInWithGoogle(credential).catch(() => {
                  // Keep the screen interactive when the mobile auth exchange fails.
                });
              })
              .catch(() => {
                // Ignore prompt failures so the user can retry the Google flow.
              });
          }}
          style={({ pressed }) => [
            styles.button,
            disabled ? styles.buttonDisabled : null,
            pressed && !disabled ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonLabel}>Continue with Google</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: {
    color: '#8B9AF4',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '700',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 16,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
