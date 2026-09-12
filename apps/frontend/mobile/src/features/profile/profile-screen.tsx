import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '../../shell/design';
import type { AuthUser } from '../../lib/auth/session-response';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';

type ProfileScreenProps = {
  readonly user: AuthUser;
  readonly onSignOut: () => Promise<void>;
};

export function ProfileScreen({ onSignOut, user }: ProfileScreenProps) {
  const { t } = useTranslation();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

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

  return (
    <Screen>
      <Kicker>{t('profile.eyebrow')}</Kicker>
      <Text style={styles.title}>{t('profile.title')}</Text>
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Ionicons accessible={false} name="person-outline" size={26} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user.name ?? t('profile.default_name')}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>
        <View style={styles.securityNote}>
          <Ionicons
            accessible={false}
            name="lock-closed-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.caption}>{t('profile.session_note')}</Text>
        </View>
      </Card>
      {signOutFailed ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {t('profile.sign_out_error')}
        </Text>
      ) : null}
      <Button
        variant="ghost"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.displaySm,
  },
  name: {
    ...type.title,
  },
  body: {
    ...type.body,
  },
  caption: { ...type.body, fontSize: 13, lineHeight: 19, flex: 1 },
  email: { ...type.body, fontSize: 14, lineHeight: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: colors.rule,
    paddingTop: 16,
    marginTop: 8,
  },
  errorText: {
    color: colors.textError,
    fontSize: 14,
    lineHeight: 20,
  },
});
