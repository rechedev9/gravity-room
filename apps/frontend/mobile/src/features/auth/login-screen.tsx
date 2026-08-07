import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/auth-provider';
import { colors, radii, spacing, typography } from '../../app/design';
import { BrandMark } from '../../components/brand-mark';
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <BrandMark />
            <Text style={styles.eyebrow}>{t('login.eyebrow')}</Text>
          </View>
          <View style={styles.intro}>
            <Text style={styles.title}>{t('login.title')}</Text>
            <Text style={styles.body}>{t('login.google_body')}</Text>
          </View>

          <View style={styles.authPanel}>
            {signInWithDev ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('login.dev.button')}
                testID="dev-login-button"
                disabled={devSubmitting}
                onPress={() => {
                  void handleDevLogin();
                }}
                style={({ pressed }) => [
                  styles.devButton,
                  devSubmitting ? styles.buttonDisabled : null,
                  pressed && !devSubmitting ? styles.buttonPressed : null,
                ]}
              >
                <Text style={styles.devButtonLabel}>
                  {devSubmitting ? t('login.dev.submitting') : t('login.dev.button')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={googleLabel}
              disabled={disabled || googleSubmitting}
              onPress={() => {
                void handleGooglePress();
              }}
              style={({ pressed }) => [
                styles.button,
                disabled || googleSubmitting ? styles.buttonDisabled : null,
                pressed && !disabled && !googleSubmitting ? styles.buttonPressed : null,
              ]}
            >
              <View style={styles.googleMark}>
                <Text style={styles.googleMarkLabel}>G</Text>
              </View>
              <Text style={styles.buttonLabel}>{googleLabel}</Text>
            </Pressable>

            {googleError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <View style={styles.errorDot} />
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
                <View style={styles.mailGlyph} />
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
                  style={[
                    styles.button,
                    styles.emailSubmit,
                    !canSubmit ? styles.buttonDisabled : null,
                  ]}
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
                  style={styles.modeToggleButton}
                >
                  <Text style={styles.modeToggle}>
                    {emailMode === 'signin'
                      ? t('login.email.to_signup')
                      : t('login.email.to_signin')}
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
          <Text style={styles.footer}>{t('login.footer')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: 28,
    paddingBottom: 24,
    gap: spacing.stackLarge,
  },
  brandBlock: {
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    color: colors.textPrimary,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  intro: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  authPanel: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: spacing.card,
    gap: spacing.stack,
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radii.control,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: colors.textOnAccent,
    fontSize: typography.body,
    fontWeight: '800',
  },
  googleMark: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
  },
  googleMarkLabel: {
    color: colors.canvas,
    fontSize: 13,
    fontWeight: '900',
  },
  devButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  devButtonLabel: {
    color: colors.accentInfo,
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  dividerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 18,
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  mailGlyph: {
    width: 19,
    height: 14,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    borderRadius: 3,
  },
  form: {
    gap: spacing.stack,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: typography.body,
  },
  emailSubmit: {
    marginTop: 2,
  },
  modeToggleButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.accentDangerMuted,
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
  errorBannerText: {
    flex: 1,
    color: colors.textError,
    fontSize: 13,
    lineHeight: 18,
  },
  formMessage: {
    borderRadius: radii.control,
    borderWidth: 1,
    padding: 12,
  },
  formMessageError: {
    borderColor: colors.accentDangerMuted,
    backgroundColor: colors.accentDangerMuted,
  },
  formMessageSuccess: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  formMessageErrorText: {
    color: colors.textError,
    fontSize: 14,
  },
  formMessageSuccessText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
});
