/** Default rest between accessory / unknown-role sets (seconds). */
export const DEFAULT_REST_SECONDS = 90;

/**
 * Recommended rest length by GZCLP-style slot role.
 * Primary (T1) needs more recovery than accessories.
 */
export function restSecondsForRole(role: string | undefined): number {
  switch (role) {
    case 'primary':
      return 180;
    case 'secondary':
      return 120;
    default:
      return DEFAULT_REST_SECONDS;
  }
}

/**
 * How many confirmable set rows the detailed tracker will show for a slot.
 * Prescription ladders include warm-ups; `slot.sets` alone is only the last
 * working prescription group and under-counts those rows.
 */
export function plannedConfirmableSets(slot: {
  readonly sets: number;
  readonly prescriptions?: readonly { readonly sets: number }[] | undefined;
}): number {
  const prescriptions = slot.prescriptions;
  if (prescriptions !== undefined && prescriptions.length > 0) {
    return prescriptions.reduce((sum, entry) => sum + entry.sets, 0);
  }
  return slot.sets;
}
