import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '../../app/design';
import type { AuthUser } from '../../lib/auth/session';
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
        <Text style={styles.name}>{user.name ?? t('profile.default_name')}</Text>
        <Text style={styles.body}>{user.email}</Text>
        <Text style={styles.caption}>{t('profile.session_note')}</Text>
      </Card>
      {signOutFailed ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {t('profile.sign_out_error')}
        </Text>
      ) : null}
      <Button
        variant="danger"
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
  caption: {
    ...type.body,
  },
  errorText: {
    color: colors.textError,
    fontSize: 14,
    lineHeight: 20,
  },
});
