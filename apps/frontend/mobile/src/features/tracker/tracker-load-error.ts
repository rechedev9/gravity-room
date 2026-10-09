import { ProgramDefinitionFetchError } from '../../lib/tracker/program-definition-error';

export type TrackerLoadFailure = 'missing_template' | 'template_unreadable' | 'unavailable';

/** Maps a tracker bootstrap failure to the copy and skip behavior the screen shows. */
export function classifyTrackerLoadFailure(error: unknown): TrackerLoadFailure {
  if (!(error instanceof ProgramDefinitionFetchError)) return 'unavailable';
  if (error.status === 404) return 'missing_template';
  if (error.status === 500) return 'template_unreadable';
  return 'unavailable';
}
