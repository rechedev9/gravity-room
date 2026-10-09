/** Expo web preview has no background notifications; there is nothing to ask for. */
export type RestAlertsAccess = 'granted' | 'askable' | 'blocked' | 'unsupported';

export async function ensureRestAlertChannel(): Promise<void> {}

export async function readRestAlertsAccess(): Promise<RestAlertsAccess> {
  return 'unsupported';
}

export async function requestRestAlertsAccess(): Promise<RestAlertsAccess> {
  return 'unsupported';
}

export async function openRestAlertsSettings(): Promise<void> {}
