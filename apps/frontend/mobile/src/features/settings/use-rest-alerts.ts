import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  openRestAlertsSettings,
  readRestAlertsAccess,
  requestRestAlertsAccess,
  type RestAlertsAccess,
} from '../../lib/rest/rest-alerts-access';
import {
  markRestAlertsPromptSeen,
  setRestAlertsEnabled,
  useRestAlertsPreference,
} from '../../lib/rest/rest-alerts-preference';

export interface RestAlertsControls {
  /** Null until the system permission has been read. */
  readonly access: RestAlertsAccess | null;
  readonly enabled: boolean;
  /** Alerts will actually fire: allowed by the system and wanted by the lifter. */
  readonly active: boolean;
  readonly showInvitation: boolean;
  readonly turnOn: () => Promise<void>;
  readonly turnOff: () => Promise<void>;
  readonly openSettings: () => Promise<void>;
  readonly dismissInvitation: () => Promise<void>;
}

/** The only place that may open the system permission dialog; always from a user action. */
export function useRestAlerts(): RestAlertsControls {
  const preference = useRestAlertsPreference();
  const [access, setAccess] = useState<RestAlertsAccess | null>(null);

  const refresh = useCallback(async (): Promise<RestAlertsAccess> => {
    let next: RestAlertsAccess;
    try {
      next = await readRestAlertsAccess();
    } catch {
      next = 'unsupported';
    }
    setAccess(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
    // The lifter may change the permission in system settings and come back.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const turnOn = useCallback(async (): Promise<void> => {
    await setRestAlertsEnabled(true);
    const current = await refresh();
    try {
      if (current === 'askable') setAccess(await requestRestAlertsAccess());
      else if (current === 'blocked') await openRestAlertsSettings();
    } catch {
      await refresh();
    }
  }, [refresh]);

  return {
    access,
    enabled: preference.enabled,
    active: access === 'granted' && preference.enabled,
    showInvitation:
      preference.loaded && !preference.promptSeen && !preference.chosen && access === 'askable',
    turnOn,
    turnOff: () => setRestAlertsEnabled(false),
    openSettings: () => openRestAlertsSettings().catch(() => undefined),
    dismissInvitation: () => markRestAlertsPromptSeen(),
  };
}
