import { ApiError } from '@gzclp/api-client/api-error';
import { ProgramDefinitionFetchError } from '../../lib/tracker/program-definition-error';
import { classifyTrackerLoadFailure } from './tracker-load-error';

describe('classifyTrackerLoadFailure', () => {
  it('reports a template missing from the catalog on a definition 404', () => {
    const error = new ProgramDefinitionFetchError(new ApiError('Not found', 404));
    expect(classifyTrackerLoadFailure(error)).toBe('missing_template');
  });

  it('reports an unreadable template on a definition 500', () => {
    const error = new ProgramDefinitionFetchError(new ApiError('Boom', 500));
    expect(classifyTrackerLoadFailure(error)).toBe('template_unreadable');
  });

  it('does not blame the template when the plan itself is missing', () => {
    expect(classifyTrackerLoadFailure(new ApiError('Plan not found', 404))).toBe('unavailable');
  });

  it('treats other definition failures and non-API errors as unavailable', () => {
    const throttled = new ProgramDefinitionFetchError(new ApiError('Slow down', 429));
    expect(classifyTrackerLoadFailure(throttled)).toBe('unavailable');
    expect(classifyTrackerLoadFailure(new Error('Offline'))).toBe('unavailable');
  });
});
