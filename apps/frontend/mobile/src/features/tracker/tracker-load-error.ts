export type TrackerLoadFailure = 'missing_template' | 'template_unreadable' | 'unavailable';

/** Maps a tracker bootstrap failure to the copy and skip behavior the screen shows. */
export function classifyTrackerLoadFailure(error: unknown): TrackerLoadFailure {
  const message = error instanceof Error ? error.message : '';
  if (!message.startsWith('Program definition fetch failed')) return 'unavailable';
  if (message.includes('status 404')) return 'missing_template';
  if (message.includes('status 500')) return 'template_unreadable';
  return 'unavailable';
}
