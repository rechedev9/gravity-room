import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LoginScreen } from './login-screen';
import type { AuthActionResult } from '../../app/auth-provider';

const mockSignInWithGoogle = jest.fn<Promise<void>, [string]>();
const mockSignInWithEmail = jest.fn<Promise<AuthActionResult>, [string, string]>();
const mockSignUpWithEmail = jest.fn<
  Promise<AuthActionResult>,
  [string, string, string | undefined]
>();
const mockPromptAsync = jest.fn<Promise<string | null>, []>();
const mockUseGoogleIdTokenPrompt = jest.fn<
  { readonly disabled: boolean; readonly promptAsync: () => Promise<string | null> },
  []
>();

jest.mock('../../app/auth-provider', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    signInWithEmail: mockSignInWithEmail,
    signUpWithEmail: mockSignUpWithEmail,
  }),
}));

jest.mock('./google-sign-in', () => ({
  useGoogleIdTokenPrompt: () => mockUseGoogleIdTokenPrompt(),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    mockUseGoogleIdTokenPrompt.mockReturnValue({
      disabled: false,
      promptAsync: () => mockPromptAsync(),
    });
  });

  afterEach(() => {
    mockPromptAsync.mockReset();
    mockSignInWithGoogle.mockReset();
    mockSignInWithEmail.mockReset();
    mockSignUpWithEmail.mockReset();
    mockUseGoogleIdTokenPrompt.mockReset();
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
});
