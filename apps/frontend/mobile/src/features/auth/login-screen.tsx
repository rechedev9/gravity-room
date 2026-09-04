import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/auth-provider';
import { colors, spacing, type } from '../../app/design';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';
import { useGoogleIdTokenPrompt } from './google-sign-in';

type EmailMode = 'signin' | 'signup';
type FormMessage = { readonly kind: 'error' | 'success'; readonly text: string };

export function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, signInWithDev } = useAuth();
  const { disabled, promptAsync } = useGoogleIdTokenPrompt();

  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [devSubmitting, setDevSubmitting] = useState(false);

  // Email/password progressive-disclosure form state (mirrors the web login page).
  const [showEmail, setShowEmail] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);

  /** Localizes an API error code, falling back to the generic message. */
  const codeMessage = (code: string | undefined): string =>
    t([`login.errors.${code ?? 'generic'}`, 'login.errors.generic']);

  async function handleGooglePress(): Promise<void> {
    if (googleSubmitting) {
      return;
    }

    setGoogleError(null);
    setGoogleSubmitting(true);
    try {
      const credential = await promptAsync();
      if (credential) {
        await signInWithGoogle(credential);
      }
    } catch {
      // Keep the screen interactive when prompting or the token exchange fails.
      setGoogleError(t('login.errors.google_auth_error'));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleEmailSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }

    // Match the server's 8-char minimum client-side so sign-up gives an
    // actionable message instead of a round-trip that returns a generic error.
    if (emailMode === 'signup' && password.length < 8) {
      setGoogleError(null);
      setFormMessage({ kind: 'error', text: t('login.email.password_min') });
      return;
    }

    setGoogleError(null);
    setFormMessage(null);
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      if (emailMode === 'signin') {
        const result = await signInWithEmail(trimmedEmail, password);
        // A successful sign-in swaps this screen for the app shell via the auth
        // context, so there is nothing more to render here on success.
        if (!result.ok) {
          setFormMessage({ kind: 'error', text: codeMessage(result.code) });
        }
      } else {
        const result = await signUpWithEmail(trimmedEmail, password, name.trim() || undefined);
        if (result.ok) {
          setFormMessage({ kind: 'success', text: t('login.signup_success') });
        } else {
          setFormMessage({ kind: 'error', text: codeMessage(result.code) });
        }
      }
    } catch {
      setFormMessage({ kind: 'error', text: codeMessage(undefined) });
    } finally {
      setSubmitting(false);
    }
  }

  const googleLabel = t('login.social.google');

  async function handleDevLogin(): Promise<void> {
    if (!signInWithDev || devSubmitting) {
      return;
    }
    setGoogleError(null);
    setFormMessage(null);
    setDevSubmitting(true);
    try {
      const result = await signInWithDev();
      if (!result.ok) {
        setFormMessage({ kind: 'error', text: codeMessage(result.code) });
      }
    } catch {
      setFormMessage({ kind: 'error', text: codeMessage(undefined) });
    } finally {
      setDevSubmitting(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <Card focal>
        <Kicker noRule>{t('login.eyebrow')}</Kicker>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.body}>{t('login.google_body')}</Text>

        {signInWithDev ? (
          <Button
            testID="dev-login-button"
            accessibilityLabel={t('login.dev.button')}
            disabled={devSubmitting}
            isLoading={devSubmitting}
            onPress={() => {
              void handleDevLogin();
            }}
          >
            {devSubmitting ? t('login.dev.submitting') : t('login.dev.button')}
          </Button>
        ) : null}

        <Button
          variant="primary"
          accessibilityLabel={googleLabel}
          disabled={disabled || googleSubmitting}
          isLoading={googleSubmitting}
          onPress={() => {
            void handleGooglePress();
          }}
        >
          {googleLabel}
        </Button>

        {googleError ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorBannerText}>{googleError}</Text>
          </View>
        ) : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>{t('login.divider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {!showEmail ? (
          <Button accessibilityLabel={t('login.email.toggle')} onPress={() => setShowEmail(true)}>
            {t('login.email.toggle')}
          </Button>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('login.email.email_label')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('login.email.email_placeholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
                accessibilityLabel={t('login.email.email_label')}
              />
            </View>

            {emailMode === 'signup' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('login.email.name_label')}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('login.email.name_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  textContentType="name"
                  style={styles.input}
                  accessibilityLabel={t('login.email.name_label')}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('login.email.password_label')}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('login.email.password_placeholder')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType={emailMode === 'signup' ? 'newPassword' : 'password'}
                style={styles.input}
                accessibilityLabel={t('login.email.password_label')}
              />
            </View>

            <Button
              variant="primary"
              accessibilityLabel={
                emailMode === 'signin'
                  ? t('login.email.submit_signin')
                  : t('login.email.submit_signup')
              }
              disabled={!canSubmit}
              isLoading={submitting}
              onPress={() => {
                void handleEmailSubmit();
              }}
            >
              {submitting
                ? t('login.email.submitting')
                : emailMode === 'signin'
                  ? t('login.email.submit_signin')
                  : t('login.email.submit_signup')}
            </Button>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEmailMode((mode) => (mode === 'signin' ? 'signup' : 'signin'));
                setFormMessage(null);
              }}
            >
              <Text style={styles.modeToggle}>
                {emailMode === 'signin' ? t('login.email.to_signup') : t('login.email.to_signin')}
              </Text>
            </Pressable>
          </View>
        )}

        {formMessage ? (
          <View
            accessibilityRole="alert"
            testID="login-form-message"
            style={[
              styles.formMessage,
              formMessage.kind === 'error' ? styles.formMessageError : styles.formMessageSuccess,
            ]}
          >
            <Text
              style={
                formMessage.kind === 'error'
                  ? styles.formMessageErrorText
                  : styles.formMessageSuccessText
              }
            >
              {formMessage.text}
            </Text>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'center',
    paddingBottom: 24,
  },
  title: {
    ...type.display,
    marginTop: 4,
  },
  body: {
    ...type.body,
    marginBottom: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.rule,
  },
  dividerLabel: {
    ...type.kicker,
  },
  form: {
    gap: spacing.stack,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    ...type.kicker,
  },
  input: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.header,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 44,
  },
  modeToggle: {
    ...type.kicker,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.errorLine,
    backgroundColor: colors.errorBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: colors.textError,
    fontSize: 13,
  },
  formMessage: {
    borderRadius: 2,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formMessageError: {
    borderColor: colors.errorLine,
    backgroundColor: colors.errorBg,
  },
  formMessageSuccess: {
    borderColor: colors.rule,
    backgroundColor: colors.header,
  },
  formMessageErrorText: {
    color: colors.textError,
    fontSize: 13,
  },
  formMessageSuccessText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
