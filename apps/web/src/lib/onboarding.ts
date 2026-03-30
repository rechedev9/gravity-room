const ONBOARDING_KEY = 'onboarding-dismissed';

export function isOnboardingDismissed(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function dismissOnboarding(): void {
  localStorage.setItem(ONBOARDING_KEY, '1');
}
