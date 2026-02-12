import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { AuthProvider } from '@/contexts/auth-context';

/**
 * Renders a component wrapped in all app providers.
 * Since Supabase env vars aren't set in tests, AuthProvider gracefully
 * provides configured=false, user=null — no mocking needed.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return <AuthProvider>{children}</AuthProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
