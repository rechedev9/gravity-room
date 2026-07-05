import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/auth-provider';
import { colors, radii, spacing } from '../../app/design';
import { useGoogleIdTokenPrompt } from './google-sign-in';

type EmailMode = 'signin' | 'signup';
type FormMessage = { readonly kind: 'error' | 'success'; readonly text: string };

export function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { disabled, promptAsync } = useGoogleIdTokenPrompt();

  const [googleError, setGoogleError] = useState<string | null>(null);

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

  function handleGooglePress(): void {
    setGoogleError(null);
    void promptAsync()
      .then((credential) => {
        if (!credential) {
          return;
        }

        void signInWithGoogle(credential).catch(() => {
          // Keep the screen interactive when the mobile auth exchange fails.
          setGoogleError(t('login.errors.google_auth_error'));
        });
      })
      .catch(() => {
        // Ignore prompt failures so the user can retry the Google flow.
      });
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{t('login.eyebrow')}</Text>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.body}>{t('login.google_body')}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={googleLabel}
          disabled={disabled}
          onPress={handleGooglePress}
          style={({ pressed }) => [
            styles.button,
            disabled ? styles.buttonDisabled : null,
            pressed && !disabled ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonLabel}>{googleLabel}</Text>
        </Pressable>

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('login.email.toggle')}
            onPress={() => setShowEmail(true)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonLabel}>{t('login.email.toggle')}</Text>
          </Pressable>
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                emailMode === 'signin'
                  ? t('login.email.submit_signin')
                  : t('login.email.submit_signup')
              }
              disabled={!canSubmit}
              onPress={() => {
                void handleEmailSubmit();
              }}
              style={[styles.button, !canSubmit ? styles.buttonDisabled : null]}
            >
              <Text style={styles.buttonLabel}>
                {submitting
                  ? t('login.email.submitting')
                  : emailMode === 'signin'
                    ? t('login.email.submit_signin')
                    : t('login.email.submit_signup')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEmailMode((mode) => (mode === 'signin' ? 'signup' : 'signin'));
                setFormMessage(null);
              }}
            >
              <Text style={styles.modeToggle}>
                {emailMode === 'signin'
                  ? t('login.email.to_signup')
                  : t('login.email.to_signin')}
              </Text>
            </Pressable>

            {formMessage ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.formMessage,
                  formMessage.kind === 'error'
                    ? styles.formMessageError
                    : styles.formMessageSuccess,
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
          </View>
        )}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    gap: spacing.stack,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 4,
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  dividerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    gap: spacing.stack,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  modeToggle: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accentDanger,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorBannerText: {
    color: colors.textError,
    fontSize: 14,
  },
  formMessage: {
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  formMessageError: {
    borderColor: colors.accentDanger,
    backgroundColor: colors.card,
  },
  formMessageSuccess: {
    borderColor: colors.accentSuccess,
    backgroundColor: colors.card,
  },
  formMessageErrorText: {
    color: colors.textError,
    fontSize: 14,
  },
  formMessageSuccessText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
