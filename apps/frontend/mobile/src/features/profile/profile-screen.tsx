import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../../app/design';
import type { AuthUser } from '../../lib/auth/session';

type ProfileScreenProps = {
  readonly user: AuthUser;
  readonly onSignOut: () => Promise<void>;
};

export function ProfileScreen({ onSignOut, user }: ProfileScreenProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.name}>{user.name ?? 'Gravity Room athlete'}</Text>
          <Text style={styles.body}>{user.email}</Text>
          <Text style={styles.caption}>Your mobile session is stored securely on this device.</Text>
        </View>
        <Pressable
          accessibilityLabel="Sign out of Gravity Room"
          accessibilityRole="button"
          disabled={signingOut}
          onPress={() => {
            void handleSignOut();
          }}
          style={[styles.signOutButton, signingOut ? styles.disabledButton : null]}
        >
          <Text style={styles.signOutLabel}>{signingOut ? 'Signing out...' : 'Sign out'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    gap: spacing.stack,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.card,
    gap: 8,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  caption: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  signOutButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  signOutLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
