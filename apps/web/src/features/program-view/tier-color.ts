import type { GenericSlotRow } from '@gzclp/shared/types';

/** Tier badge color based on role */
export function tierColorClass(role: GenericSlotRow['role']): string {
  if (role === 'primary') return 'text-accent';
  if (role === 'secondary') return 'text-main';
  return 'text-muted';
}
