import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

// Side-effect import: initializes i18next (device-locale detection + catalogs)
// before any screen calls useTranslation.
import '../lib/i18n';
import { LoginScreen } from '../features/auth/login-screen';
import { ProfileScreen } from '../features/profile/profile-screen';
import { ProgramsScreen } from '../features/programs/programs-screen';
import { TrackerScreen } from '../features/tracker/tracker-screen';
import type { AuthUser } from '../lib/auth/session';
import { TabIcon } from '../components/tab-icon';
import { useAuth } from './auth-provider';
import { colors, spacing } from './design';
import { AppProviders } from './providers';

type MobileTab = 'programs' | 'tracker' | 'profile';

const TABS = ['programs', 'tracker', 'profile'] as const satisfies readonly MobileTab[];

function AppShell() {
  const { loading, signOut, user } = useAuth();

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
    return <AuthenticatedShell key={user.id} onSignOut={signOut} user={user} />;
  }

  return <LoginScreen />;
}

type AuthenticatedShellProps = {
  readonly user: AuthUser;
  readonly onSignOut: () => Promise<void>;
};

function AuthenticatedShell({ onSignOut, user }: AuthenticatedShellProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MobileTab>('programs');
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);

  function openProgram(programInstanceId: string): void {
    setActiveProgramId(programInstanceId);
    setActiveTab('tracker');
  }

  return (
    <View style={styles.authenticatedShell}>
      <View style={styles.screenSlot}>
        {activeTab === 'programs' ? (
          <ProgramsScreen onOpenProgram={openProgram} />
        ) : activeTab === 'tracker' ? (
          activeProgramId ? (
            <TrackerScreen
              programInstanceId={activeProgramId}
              onBack={() => setActiveTab('programs')}
            />
          ) : (
            <View style={styles.trackerEmpty}>
              <View style={styles.trackerEmptyIcon}>
                <TabIcon active name="tracker" />
              </View>
              <Text style={styles.trackerEmptyTitle}>{t('tracker.empty.title')}</Text>
              <Text style={styles.trackerEmptyBody}>{t('tracker.empty.body')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveTab('programs')}
                style={({ pressed }) => [
                  styles.trackerEmptyButton,
                  pressed ? styles.primaryPressed : null,
                ]}
              >
                <Text style={styles.trackerEmptyButtonLabel}>{t('tracker.empty.action')}</Text>
              </Pressable>
            </View>
          )
        ) : (
          <ProfileScreen user={user} onSignOut={onSignOut} />
        )}
      </View>
      <SafeAreaView edges={['bottom']} style={styles.bottomNavSafe}>
        <View style={styles.bottomNav}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                accessibilityLabel={t(`nav.open_${tab}`)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveTab(tab)}
                style={styles.navItem}
              >
                <TabIcon active={isActive} name={tab} />
                <Text style={[styles.navText, isActive ? styles.navTextActive : null]}>
                  {t(`nav.${tab}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
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
  bottomNavSafe: {
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 4,
  },
  navText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  navTextActive: {
    color: colors.accentPrimary,
  },
  trackerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    gap: 12,
    backgroundColor: colors.canvas,
  },
  trackerEmptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    marginBottom: 4,
  },
  trackerEmptyTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  trackerEmptyBody: {
    maxWidth: 320,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  trackerEmptyButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  trackerEmptyButtonLabel: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryPressed: {
    backgroundColor: colors.accentPrimaryPressed,
  },
});
