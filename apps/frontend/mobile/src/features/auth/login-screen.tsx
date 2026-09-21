import { TextInput } from '../../ui/text-input';
import { useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../shell/auth-provider';
import { colors, spacing, type } from '../../shell/design';
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
  const { configured: googleConfigured, disabled, promptAsync } = useGoogleIdTokenPrompt();

  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [devSubmitting, setDevSubmitting] = useState(false);

  // Email/password progressive-disclosure form state (mirrors the web login page).
  const [showEmail, setShowEmail] = useState(!googleConfigured);
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const nameInputRef = useRef<NativeTextInput>(null);
  const passwordInputRef = useRef<NativeTextInput>(null);

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
    <Screen padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoiding}
      >
        <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea}>
          <ScrollView
            testID="login-scroll-view"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card style={styles.loginCard}>
              <View style={styles.brand}>
                <View style={styles.brandMark}>
                  <Ionicons accessible={false} name="barbell" size={28} color={colors.onAccent} />
                </View>
                <Kicker noRule>{t('login.eyebrow')}</Kicker>
              </View>
              <Text style={styles.title}>{t('login.title')}</Text>
              <Text style={styles.body}>{t('login.google_body')}</Text>

              {googleConfigured ? (
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
              ) : null}

              {googleError ? (
                <View style={styles.errorBanner} accessibilityRole="alert">
                  <Text style={styles.errorBannerText}>{googleError}</Text>
                </View>
              ) : null}

              {googleConfigured ? (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>{t('login.divider')}</Text>
                  <View style={styles.dividerLine} />
                </View>
              ) : null}

              {googleConfigured && !showEmail ? (
                <Button
                  accessibilityLabel={t('login.email.toggle')}
                  onPress={() => setShowEmail(true)}
                >
                  {t('login.email.toggle')}
                </Button>
              ) : (
                <View style={styles.form}>
                  <View style={styles.field}>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => {
                        if (emailMode === 'signup') {
                          nameInputRef.current?.focus();
                        } else {
                          passwordInputRef.current?.focus();
                        }
                      }}
                      placeholder={t('login.email.email_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      style={styles.input}
                      label={t('login.email.email_label')}
                    />
                  </View>

                  {emailMode === 'signup' ? (
                    <View style={styles.field}>
                      <TextInput
                        ref={nameInputRef}
                        value={name}
                        onChangeText={setName}
                        returnKeyType="next"
                        submitBehavior="submit"
                        onSubmitEditing={() => {
                          passwordInputRef.current?.focus();
                        }}
                        placeholder={t('login.email.name_placeholder')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="words"
                        textContentType="name"
                        style={styles.input}
                        label={t('login.email.name_label')}
                      />
                    </View>
                  ) : null}

                  <View style={styles.field}>
                    <TextInput
                      ref={passwordInputRef}
                      value={password}
                      onChangeText={setPassword}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        void handleEmailSubmit();
                      }}
                      placeholder={t('login.email.password_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType={emailMode === 'signup' ? 'newPassword' : 'password'}
                      style={styles.input}
                      label={t('login.email.password_label')}
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
                    style={styles.modeToggleButton}
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
            </Card>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoiding: { flex: 1 },
  bottomSafeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: 20,
    paddingBottom: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 480,
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 8,
    gap: 16,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 10,
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
  modeToggleButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  errorBanner: {
    borderRadius: 10,
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
    borderRadius: 10,
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
