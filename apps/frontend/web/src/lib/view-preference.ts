export type ViewMode = 'detailed' | 'compact';

const VIEW_PREFERENCE_KEY = 'view-preference';

function isViewMode(value: string | null): value is ViewMode {
  return value === 'detailed' || value === 'compact';
}

export function getViewPreference(): ViewMode {
  const stored = localStorage.getItem(VIEW_PREFERENCE_KEY);
  return isViewMode(stored) ? stored : 'detailed';
}

export function saveViewPreference(mode: ViewMode): void {
  localStorage.setItem(VIEW_PREFERENCE_KEY, mode);
}
