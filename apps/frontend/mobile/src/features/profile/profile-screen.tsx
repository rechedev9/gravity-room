import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, type } from '../../shell/design';
import { useSyncStatus } from '../../shell/sync-status-provider';
import type { AuthUser } from '../../lib/auth/session-response';
import {
  LANGUAGE_CHOICES,
  setLanguagePreference,
  useLanguagePreference,
  type LanguagePreference,
} from '../../lib/i18n/language-preference';
import { describeSyncAge } from '../../lib/settings/sync-age';
import { webAccountUrl, webPrivacyUrl } from '../../lib/settings/web-account-url';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import { ScreenHeader } from '../../ui/screen-header';
import { SegmentedChoice } from '../../ui/segmented-choice';
import { SettingsRow, SwitchRow } from '../../ui/settings-row';
import { IdentityCard } from './identity-card';
import { useRestAlerts } from '../settings/use-rest-alerts';

type ProfileScreenProps = {
  readonly user: AuthUser;
  readonly onSignOut: () => Promise<void>;
};

const SYNC_AGE_REFRESH_MS = 30_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function ProfileScreen({ onSignOut, user }: ProfileScreenProps) {
  const { t, i18n } = useTranslation();
  const language = useLanguagePreference();
  const alerts = useRestAlerts();
  const sync = useSyncStatus();
  const now = useNow(SYNC_AGE_REFRESH_MS);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  async function handleSignOut(): Promise<void> {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await onSignOut();
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  }

  async function openWeb(url: string): Promise<void> {
    setLinkFailed(false);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkFailed(true);
    }
  }

  const pending = sync?.status?.total ?? 0;
  const needsAttention = (sync?.status?.needsAttention ?? 0) > 0;
  const syncStatus = !sync
    ? null
    : sync.readError
      ? t('settings.sync.unavailable')
      : needsAttention
        ? t('settings.sync.attention')
        : pending > 0
          ? t('settings.sync.pending', { count: pending })
          : sync.offline
            ? t('settings.sync.offline')
            : t('settings.sync.synced');
  const syncIcon =
    sync?.readError || needsAttention
      ? 'alert-circle-outline'
      : pending > 0
        ? 'cloud-upload-outline'
        : sync?.offline
          ? 'cloud-offline-outline'
          : 'cloud-done-outline';
  const syncedAt = sync?.lastSyncedAt ?? null;
  const age = syncedAt === null ? null : describeSyncAge(now, syncedAt);
  const lastSynced =
    syncedAt === null || age === null
      ? t('settings.sync.never')
      : age.kind === 'just_now'
        ? t('settings.sync.just_now')
        : age.kind === 'date'
          ? new Date(syncedAt).toLocaleDateString(i18n.language, {
              day: 'numeric',
              month: 'short',
            })
          : t(`settings.sync.${age.kind}`, { count: age.count });
  const restAlertsDescription =
    alerts.access === 'unsupported'
      ? t('settings.rest_alerts.unsupported')
      : !alerts.enabled
        ? t('settings.rest_alerts.off')
        : alerts.access === 'blocked'
          ? t('settings.rest_alerts.blocked')
          : t('settings.rest_alerts.on');
  const version = Constants.expoConfig?.version;

  return (
    <Screen padded={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader eyebrow={t('profile.eyebrow')} title={t('profile.title')} />

        <IdentityCard
          name={user.name ?? t('profile.default_name')}
          email={user.email}
          initialsFrom={user.name ?? user.email}
          note={t('profile.session_note')}
        />

        <View style={styles.section}>
          <Kicker>{t('settings.sections.preferences')}</Kicker>
          <Card style={styles.group}>
            <View style={styles.languageBlock}>
              <Text style={styles.rowLabel}>{t('settings.language.label')}</Text>
              <SegmentedChoice<LanguagePreference>
                label={t('settings.language.label')}
                value={language}
                options={LANGUAGE_CHOICES.map((choice) => ({
                  value: choice,
                  label: t(`settings.language.${choice}`),
                }))}
                onChange={(next) => {
                  void setLanguagePreference(next);
                }}
              />
              <Text style={styles.hint}>{t('settings.language.hint')}</Text>
            </View>
            <SwitchRow
              last
              icon="notifications-outline"
              label={t('settings.rest_alerts.label')}
              description={restAlertsDescription}
              value={alerts.active}
              disabled={alerts.access === null || alerts.access === 'unsupported'}
              onValueChange={(next) => {
                void (next ? alerts.turnOn() : alerts.turnOff());
              }}
            />
          </Card>
        </View>

        {sync ? (
          <View style={styles.section}>
            <Kicker>{t('settings.sections.sync')}</Kicker>
            <Card style={styles.group}>
              <SettingsRow
                icon={syncIcon}
                label={t('settings.sync.status')}
                value={syncStatus ?? ''}
              />
              <SettingsRow icon="time-outline" label={t('settings.sync.last')} value={lastSynced} />
              <View style={styles.syncAction}>
                <Button onPress={sync.retry} accessibilityLabel={t('sync.retry_label')}>
                  {t('settings.sync.now')}
                </Button>
              </View>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <Kicker>{t('settings.sections.about')}</Kicker>
          <Card style={styles.group}>
            <SettingsRow
              icon="person-circle-outline"
              label={t('settings.about.account')}
              description={t('settings.about.account_hint')}
              external
              onPress={() => {
                void openWeb(webAccountUrl());
              }}
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              label={t('settings.about.privacy')}
              external
              onPress={() => {
                void openWeb(webPrivacyUrl());
              }}
            />
            <SettingsRow
              last
              icon="information-circle-outline"
              label={t('settings.about.version')}
              value={version ?? ''}
            />
          </Card>
          {linkFailed ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {t('settings.about.open_failed')}
            </Text>
          ) : null}
        </View>

        {signOutFailed ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {t('profile.sign_out_error')}
          </Text>
        ) : null}
        <Button
          accessibilityLabel={t('profile.sign_out_accessibility')}
          disabled={signingOut}
          isLoading={signingOut}
          onPress={() => {
            void handleSignOut();
          }}
        >
          {signingOut
            ? t('profile.signing_out')
            : signOutFailed
              ? t('profile.retry_sign_out')
              : t('profile.sign_out')}
        </Button>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
    paddingBottom: spacing.tabClearance,
    gap: spacing.stackLarge,
  },
  section: { gap: spacing.stack },
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  languageBlock: {
    gap: 10,
    padding: spacing.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  rowLabel: { ...type.body, color: colors.textPrimary, lineHeight: 22 },
  hint: { ...type.body, fontSize: 13, lineHeight: 18 },
  syncAction: { padding: spacing.card, paddingTop: 12 },
  errorText: { color: colors.textError, fontSize: 14, lineHeight: 20 },
});
