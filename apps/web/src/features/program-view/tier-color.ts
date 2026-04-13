import type { GenericSlotRow } from '@gzclp/shared/types';

export function tierColorClass(role: GenericSlotRow['role']): string {
  if (role === 'primary') return 'text-accent';
  if (role === 'secondary') return 'text-main';
  return 'text-muted';
}
