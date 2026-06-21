import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoginScreen } from '../features/auth/login-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { ProgramsScreen } from '../features/programs/programs-screen';
import { useAuth } from './auth-provider';
import { colors, radii } from './design';
import { AppProviders } from './providers';

type MobileTab = 'programs' | 'profile';

function AppShell() {
  const { loading, signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('programs');

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.authenticatedShell}>
        <View style={styles.screenSlot}>
          {activeTab === 'programs' ? (
            <ProgramsScreen />
          ) : (
            <ProfileScreen user={user} onSignOut={signOut} />
          )}
        </View>
        <View style={styles.bottomNav}>
          <Pressable
            accessibilityLabel="Open programs tab"
            accessibilityRole="button"
            onPress={() => setActiveTab('programs')}
            style={[styles.navItem, activeTab === 'programs' ? styles.navItemActive : null]}
          >
            <Text style={[styles.navText, activeTab === 'programs' ? styles.navTextActive : null]}>
              Programs
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open profile tab"
            accessibilityRole="button"
            onPress={() => setActiveTab('profile')}
            style={[styles.navItem, activeTab === 'profile' ? styles.navItemActive : null]}
          >
            <Text style={[styles.navText, activeTab === 'profile' ? styles.navTextActive : null]}>
              Profile
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return <LoginScreen />;
}

export function App() {
  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <AppShell />
      </View>
    </AppProviders>
  );
}

export default App;

const styles = StyleSheet.create({
  authenticatedShell: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  screenSlot: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 12,
  },
  navItemActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.card,
  },
  navText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  navTextActive: {
    color: colors.textPrimary,
  },
});
