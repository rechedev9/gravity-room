import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../app/design';
import { BrandMark } from '../../components/brand-mark';
import type { AuthUser } from '../../lib/auth/session';

type ProfileScreenProps = {
  readonly user: AuthUser;
  readonly onSignOut: () => Promise<void>;
};

export function ProfileScreen({ onSignOut, user }: ProfileScreenProps) {
  const { i18n, t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut(): Promise<void> {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await onSignOut();
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  }

  const languageLabel =
    i18n.resolvedLanguage === 'es' ? t('profile.spanish') : t('profile.english');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('profile.eyebrow')}</Text>
          <Text style={styles.title}>{t('profile.title')}</Text>
        </View>

        <View style={styles.identityCard}>
          <BrandMark compact />
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{user.name ?? t('profile.default_name')}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
          <View style={styles.secureBadge}>
            <View style={styles.secureDot} />
            <Text style={styles.secureBadgeLabel}>{t('profile.secure')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.preferences')}</Text>
          <View style={styles.listCard}>
            <ProfileRow glyph="kg" label={t('profile.units')} value={t('profile.kilograms')} />
            <ProfileRow glyph="Aa" label={t('profile.language')} value={languageLabel} />
            <ProfileRow
              glyph="R"
              label={t('profile.rest_timer')}
              value={t('profile.rest_timer_value')}
              last
            />
          </View>
          <Text style={styles.sectionHint}>{t('profile.preferences_hint')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.sync_title')}</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncIcon}>
              <View style={styles.syncIconDot} />
            </View>
            <View style={styles.syncCopy}>
              <Text style={styles.syncTitle}>{t('profile.sync_ready')}</Text>
              <Text style={styles.syncBody}>{t('profile.session_note')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.account')}</Text>
          {signOutFailed ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>{t('profile.sign_out_error')}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityLabel={t('profile.sign_out_accessibility')}
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() => {
              void handleSignOut();
            }}
            style={({ pressed }) => [
              styles.signOutButton,
              signingOut ? styles.disabledButton : null,
              pressed && !signingOut ? styles.pressedButton : null,
            ]}
          >
            <Text style={styles.signOutGlyph}>↪</Text>
            <Text style={styles.signOutLabel}>
              {signingOut
                ? t('profile.signing_out')
                : signOutFailed
                  ? t('profile.retry_sign_out')
                  : t('profile.sign_out')}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.version}>{t('profile.version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type ProfileRowProps = {
  readonly glyph: string;
  readonly label: string;
  readonly value: string;
  readonly last?: boolean;
};

function ProfileRow({ glyph, label, value, last = false }: ProfileRowProps) {
  return (
    <View style={[styles.profileRow, last ? styles.profileRowLast : null]}>
      <View style={styles.rowGlyph}>
        <Text style={styles.rowGlyphLabel}>{glyph}</Text>
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 36,
    gap: spacing.stackLarge,
  },
  header: { gap: 3 },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.textPrimary, fontSize: typography.screenTitle, fontWeight: '800' },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 14,
  },
  identityCopy: { flex: 1, gap: 3 },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  email: { color: colors.textMuted, fontSize: 12 },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentSuccess },
  secureBadgeLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sectionTitle, fontWeight: '800' },
  listCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  profileRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 13,
  },
  profileRowLast: { borderBottomWidth: 0 },
  rowGlyph: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rowGlyphLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800' },
  rowLabel: { flex: 1, color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  rowValue: { color: colors.textMuted, fontSize: 12 },
  sectionHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: 14,
  },
  syncIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.cardElevated,
  },
  syncIconDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accentInfo },
  syncCopy: { flex: 1, gap: 4 },
  syncTitle: { color: colors.accentInfo, fontSize: 14, fontWeight: '800' },
  syncBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: radii.control,
    backgroundColor: colors.accentDangerMuted,
    padding: 12,
  },
  errorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentDanger,
    marginTop: 5,
  },
  errorText: { flex: 1, color: colors.textError, fontSize: 12, lineHeight: 18 },
  signOutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.accentDangerMuted,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
  },
  disabledButton: { opacity: 0.55 },
  pressedButton: { opacity: 0.75 },
  signOutGlyph: { color: colors.accentDanger, fontSize: 17, fontWeight: '700' },
  signOutLabel: { color: colors.accentDanger, fontSize: 14, fontWeight: '800' },
  version: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
