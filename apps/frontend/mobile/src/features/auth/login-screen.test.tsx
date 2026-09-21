import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ForwardedRef } from 'react';
import { type TextInputProps, TextInput as NativeTextInput } from 'react-native';

import { LoginScreen } from './login-screen';
import type { AuthActionResult } from '../../shell/auth-provider';

type MockTextInputProps = TextInputProps & { readonly label: string };

const mockSignInWithGoogle = jest.fn<Promise<void>, [string]>();
const mockSignInWithEmail = jest.fn<Promise<AuthActionResult>, [string, string]>();
const mockSignUpWithEmail = jest.fn<
  Promise<AuthActionResult>,
  [string, string, string | undefined]
>();
const mockSignInWithDev = jest.fn<Promise<AuthActionResult>, []>();
const mockPromptAsync = jest.fn<Promise<string | null>, []>();
const mockFocus = jest.fn<void, [string]>();
const mockUseGoogleIdTokenPrompt = jest.fn<
  {
    readonly configured: boolean;
    readonly disabled: boolean;
    readonly promptAsync: () => Promise<string | null>;
  },
  []
>();

jest.mock('../../shell/auth-provider', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
    signInWithDev: mockSignInWithDev,
  }),
}));

jest.mock('./google-sign-in', () => ({
  useGoogleIdTokenPrompt: () => mockUseGoogleIdTokenPrompt(),
}));

jest.mock('../../ui/text-input', () => {
  const React = require('react');
  const { TextInput: mockNativeTextInput } = require('react-native');

  return {
    TextInput: React.forwardRef(function MockTextInput(
      { label, ...props }: MockTextInputProps,
      ref: ForwardedRef<NativeTextInput>
    ) {
      React.useImperativeHandle(ref, () => ({ focus: () => mockFocus(label) }));
      return React.createElement(mockNativeTextInput, { ...props, accessibilityLabel: label });
    }),
  };
});

describe('LoginScreen', () => {
  beforeEach(() => {
    mockUseGoogleIdTokenPrompt.mockReturnValue({
      configured: true,
      disabled: false,
      promptAsync: () => mockPromptAsync(),
    });
  });

  afterEach(() => {
    mockPromptAsync.mockReset();
    mockSignInWithGoogle.mockReset();
    mockSignInWithEmail.mockReset();
    mockSignUpWithEmail.mockReset();
    mockSignInWithDev.mockReset();
    mockUseGoogleIdTokenPrompt.mockReset();
    mockFocus.mockReset();
  });

  it('calls signInWithDev when the Dev Login button is pressed', async () => {
    mockSignInWithDev.mockResolvedValue({ ok: true });

    render(<LoginScreen />);

    fireEvent.press(screen.getByTestId('dev-login-button'));

    await waitFor(() => {
      expect(mockSignInWithDev).toHaveBeenCalledTimes(1);
    });
  });

  it('exchanges the prompted Google credential when the CTA is pressed', async () => {
    mockPromptAsync.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockResolvedValue();

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledWith('google-id-token');
    });
  });

  it('prevents duplicate Google exchanges while the first sign-in is pending', async () => {
    let resolveSignIn: (() => void) | undefined;
    mockPromptAsync.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignIn = resolve;
        })
    );

    render(<LoginScreen />);

    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    fireEvent.press(googleButton);
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    fireEvent.press(googleButton);

    expect(mockPromptAsync).toHaveBeenCalledTimes(1);
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSignIn?.();
      await Promise.resolve();
    });
  });

  it('ignores dismissed Google auth prompts', async () => {
    mockPromptAsync.mockResolvedValue(null);

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it('swallows prompt failures without attempting sign-in', async () => {
    mockPromptAsync.mockRejectedValue(new Error('Auth session failed'));

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockSignInWithGoogle).not.toHaveBeenCalled();
  });

  it('surfaces a Google error banner when the credential exchange fails', async () => {
    mockPromptAsync.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockRejectedValue(new Error('Mobile auth exchange failed'));

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledWith('google-id-token');
    });
    expect(await screen.findByText('Error signing in with Google. Please try again.')).toBeTruthy();
  });

  it('signs in with email and password after revealing the email form', async () => {
    mockSignInWithEmail.mockResolvedValue({ ok: true });

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'athlete@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'correct-horse');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('athlete@example.com', 'correct-horse');
    });
  });

  it('keeps the full login flow scrollable above the keyboard and submits from password Done', async () => {
    mockSignInWithEmail.mockResolvedValue({ ok: true });

    render(<LoginScreen />);

    const scrollView = screen.getByTestId('login-scroll-view');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.contentContainerStyle).toEqual(
      expect.objectContaining({ flexGrow: 1, justifyContent: 'center' })
    );

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'athlete@example.com');
    const password = screen.getByPlaceholderText('Your password');
    fireEvent.changeText(password, 'correct-horse');
    fireEvent(password, 'submitEditing');

    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('athlete@example.com', 'correct-horse');
    });
  });

  it('moves focus through the email form without dismissing the keyboard', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    const email = screen.getByPlaceholderText('you@example.com');
    expect(email.props.submitBehavior).toBe('submit');
    fireEvent(email, 'submitEditing');
    expect(mockFocus).toHaveBeenCalledWith('Password');

    fireEvent.press(screen.getByRole('button', { name: 'Need an account? Sign up' }));
    const signupEmail = screen.getByPlaceholderText('you@example.com');
    const name = screen.getByPlaceholderText('Your name (optional)');
    expect(signupEmail.props.submitBehavior).toBe('submit');
    expect(name.props.submitBehavior).toBe('submit');
    fireEvent(signupEmail, 'submitEditing');
    expect(mockFocus).toHaveBeenLastCalledWith('Name');
    fireEvent(name, 'submitEditing');
    expect(mockFocus).toHaveBeenLastCalledWith('Password');
  });

  it('gives the mode switch a full touch target', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));

    expect(screen.getByRole('button', { name: 'Need an account? Sign up' }).props.style).toEqual(
      expect.objectContaining({ minHeight: 44, justifyContent: 'center' })
    );
  });

  it('shows the verify-email message for the EMAIL_NOT_VERIFIED sign-in code', async () => {
    mockSignInWithEmail.mockResolvedValue({ ok: false, code: 'EMAIL_NOT_VERIFIED' });

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'athlete@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'unverified');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Verify your email before signing in. Check your inbox.')
    ).toBeTruthy();
  });

  it('shows the invalid-credentials message for the INVALID_CREDENTIALS sign-in code', async () => {
    mockSignInWithEmail.mockResolvedValue({ ok: false, code: 'INVALID_CREDENTIALS' });

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'athlete@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'wrong');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
  });

  it('creates an account and shows the verification notice on sign-up', async () => {
    mockSignUpWithEmail.mockResolvedValue({ ok: true });

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.press(screen.getByText('Need an account? Sign up'));

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your name (optional)'), 'New Athlete');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'brand-new-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalledWith(
        'new@example.com',
        'brand-new-pass',
        'New Athlete'
      );
    });
    expect(
      await screen.findByText(
        'Account created. Check your email to verify your address before signing in.'
      )
    ).toBeTruthy();
  });

  it('blocks sign-up with a short password before calling the API', async () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.press(screen.getByText('Need an account? Sign up'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'new@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(mockSignUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows the email-taken message when sign-up conflicts', async () => {
    mockSignUpWithEmail.mockResolvedValue({ ok: false, code: 'EMAIL_TAKEN' });

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    fireEvent.press(screen.getByText('Need an account? Sign up'));
    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'taken@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Your password'), 'another-pass');
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  });

  it('uses email sign-in as the primary control when Google is not configured', () => {
    mockUseGoogleIdTokenPrompt.mockReturnValue({
      configured: false,
      disabled: true,
      promptAsync: () => mockPromptAsync(),
    });

    render(<LoginScreen />);

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});
