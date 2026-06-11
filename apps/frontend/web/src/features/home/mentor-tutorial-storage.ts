/**
 * Persistent storage for the home mentor/tutorial widget.
 * Uses localStorage with a versioned key so future schema changes
 * can be handled cleanly.
 */

export const MENTOR_STORAGE_KEY = 'gravity-room:mentor-tutorial:v1' as const;

export type MentorStep =
  | 'fresh'
  | 'collapsed'
  | 'expanded_intro'
  | 'step_home'
  | 'step_programs'
  | 'step_tracker'
  | 'step_profile'
  | 'completed'
  | 'dismissed'
  | 'returning_hint';

export interface MentorTutorialPayload {
  version: 1;
  completedAt?: string;
  dismissedAt?: string;
  lastStep?: MentorStep;
}

function isValidPayload(raw: unknown): raw is MentorTutorialPayload {
  if (typeof raw !== 'object' || raw === null) return false;
  if (!('version' in raw)) return false;
  // After 'in' narrowing, raw has a 'version' property we can read safely
  return (raw satisfies { version: unknown }).version === 1;
}

export function loadMentorState(): MentorTutorialPayload | null {
  try {
    const raw = localStorage.getItem(MENTOR_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMentorState(payload: MentorTutorialPayload): void {
  try {
    localStorage.setItem(MENTOR_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Silently ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

export function clearMentorState(): void {
  try {
    localStorage.removeItem(MENTOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Derive the initial UI step from persisted state. */
export function deriveInitialStep(persisted: MentorTutorialPayload | null): MentorStep {
  if (!persisted) return 'fresh';
  if (persisted.completedAt) return 'returning_hint';
  if (persisted.dismissedAt) return 'dismissed';
  if (persisted.lastStep) return persisted.lastStep;
  return 'fresh';
}
