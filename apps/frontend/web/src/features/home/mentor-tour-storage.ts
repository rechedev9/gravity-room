/**
 * Persistent storage for the contextual mentor tour (v2).
 *
 * Tracks which zones the user has visited/dismissed so that:
 *  - New users see a progressive checklist on Home.
 *  - Each zone page shows a one-time inline hint.
 *  - Returning users never see repeated prompts.
 *
 * Key: gravity-room:mentor-tour:v2
 */

export const MENTOR_TOUR_KEY = 'gravity-room:mentor-tour:v2' as const;

export type TourZone = 'home' | 'programs' | 'preview' | 'tracker' | 'profile';

export const TOUR_ZONES: readonly TourZone[] = [
  'home',
  'programs',
  'preview',
  'tracker',
  'profile',
];

export interface MentorTourPayload {
  version: 2;
  /** Zones whose inline hint has been dismissed by the user. */
  dismissedZones?: TourZone[];
  /** Whether the Home checklist widget itself has been dismissed. */
  checklistDismissed?: boolean;
  /** Whether the user has explicitly started the tour (clicked "Empezar mini tutorial"). */
  tourStarted?: boolean;
  /** ISO timestamp when the checklist was completed (all zones visited). */
  completedAt?: string;
}

function isValidPayload(raw: unknown): raw is MentorTourPayload {
  if (typeof raw !== 'object' || raw === null) return false;
  if (!('version' in raw)) return false;
  // Access via index signature — object is narrowed to non-null object above
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(raw));
  return obj['version'] === 2;
}

export function loadTourState(): MentorTourPayload | null {
  try {
    const raw = localStorage.getItem(MENTOR_TOUR_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveTourState(payload: MentorTourPayload): void {
  try {
    localStorage.setItem(MENTOR_TOUR_KEY, JSON.stringify(payload));
  } catch {
    // Silently ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

export function clearTourState(): void {
  try {
    localStorage.removeItem(MENTOR_TOUR_KEY);
  } catch {
    // ignore
  }
}

/** Returns the current state, initialising with defaults if absent. */
function getOrInit(): MentorTourPayload {
  return loadTourState() ?? { version: 2 };
}

/** Mark a zone hint as dismissed. Idempotent. */
export function dismissZoneHint(zone: TourZone): void {
  const state = getOrInit();
  const dismissed = new Set(state.dismissedZones ?? []);
  dismissed.add(zone);
  const next: MentorTourPayload = { ...state, dismissedZones: [...dismissed] };
  // Auto-complete when all zones dismissed
  if (!next.completedAt && TOUR_ZONES.every((z) => dismissed.has(z))) {
    next.completedAt = new Date().toISOString();
  }
  saveTourState(next);
}

/** Returns true if the zone hint should be shown (not yet dismissed). */
export function shouldShowZoneHint(zone: TourZone): boolean {
  const state = loadTourState();
  if (!state) return true; // brand-new user
  if (state.checklistDismissed) return false; // user opted out entirely
  return !(state.dismissedZones ?? []).includes(zone);
}

/** Dismiss the Home checklist widget entirely. */
export function dismissChecklist(): void {
  const state = getOrInit();
  saveTourState({ ...state, checklistDismissed: true });
}

/** Returns true if the Home checklist should be shown. */
export function shouldShowChecklist(): boolean {
  const state = loadTourState();
  if (!state) return false; // brand-new: show prompt first
  if (state.checklistDismissed) return false;
  if (state.completedAt) return false;
  if (!state.tourStarted) return false; // prompt not yet accepted
  return true;
}

/** Returns the set of zones whose hints have been dismissed. */
export function getDismissedZones(): ReadonlySet<TourZone> {
  const state = loadTourState();
  return new Set(state?.dismissedZones ?? []);
}

/**
 * Returns true if the initial welcome prompt should be shown.
 * Only for brand-new users who have not yet started or dismissed the tour.
 */
export function shouldShowPrompt(): boolean {
  const state = loadTourState();
  if (!state) return true; // brand-new user
  if (state.checklistDismissed) return false;
  if (state.tourStarted) return false;
  return true;
}

/** Mark the tour as started (user clicked "Empezar mini tutorial"). */
export function startTour(): void {
  const state = getOrInit();
  saveTourState({ ...state, tourStarted: true });
}
