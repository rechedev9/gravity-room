import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LoginScreen } from './login-screen';

const mockSignInWithGoogle = jest.fn<Promise<void>, [string]>();
const mockPromptAsync = jest.fn<Promise<string | null>, []>();
const mockUseGoogleIdTokenPrompt = jest.fn<
  { readonly disabled: boolean; readonly promptAsync: () => Promise<string | null> },
  []
>();

jest.mock('../../app/auth-provider', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
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

  it('swallows sign-in failures after receiving a Google credential', async () => {
    mockPromptAsync.mockResolvedValue('google-id-token');
    mockSignInWithGoogle.mockRejectedValue(new Error('Mobile auth exchange failed'));

    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledWith('google-id-token');
    });
  });
});
