import type { RestTimerEffects } from './rest-timer';

/** Expo web preview: the native OS owns background notifications on mobile. */
export const restAlerts: RestTimerEffects = {
  schedule: async () => null,
  cancel: async () => undefined,
  complete: async () => undefined,
};
