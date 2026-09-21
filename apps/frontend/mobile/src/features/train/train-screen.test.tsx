import { render, screen, waitFor } from '@testing-library/react-native';

import { TrainScreen } from './train-screen';
import type { TrackerLoadFailure } from '../tracker/tracker-load-error';
import type { ProgramSummariesData } from '../../lib/programs/program-queries';

const mockSummaries: { current: ProgramSummariesData | undefined; error: Error | null } = {
  current: undefined,
  error: null,
};

jest.mock('../../lib/programs/program-queries', () => ({
  useProgramSummaries: () => ({
    data: mockSummaries.current,
    isPending: mockSummaries.current === undefined && mockSummaries.error === null,
    isError: mockSummaries.error !== null,
    isFetching: false,
    error: mockSummaries.error,
    refetch: jest.fn(),
  }),
}));

jest.mock('../tracker/tracker-screen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    TrackerScreen: ({
      programInstanceId,
      onTemplateUnavailable,
    }: {
      readonly programInstanceId: string;
      readonly onTemplateUnavailable?: (failure: TrackerLoadFailure) => void;
    }) => {
      React.useEffect(() => {
        if (programInstanceId === 'custom-meso') onTemplateUnavailable?.('missing_template');
        if (programInstanceId === 'full-body') onTemplateUnavailable?.('template_unreadable');
      }, [onTemplateUnavailable, programInstanceId]);
      return React.createElement(Text, null, `tracking ${programInstanceId}`);
    },
  };
});

const plan = (id: string) => ({
  id,
  title: id,
  updatedAt: '2026-08-31T00:00:00.000Z',
});

describe('TrainScreen', () => {
  afterEach(() => {
    mockSummaries.current = undefined;
    mockSummaries.error = null;
  });

  it('skips plans whose templates cannot be opened and trains the next one', async () => {
    mockSummaries.current = {
      programs: [plan('custom-meso'), plan('full-body'), plan('gzclp-instance')],
      cached: false,
    };

    render(<TrainScreen requestedProgramId={null} onOpenPrograms={jest.fn()} />);

    expect(await screen.findByText('tracking gzclp-instance')).toBeTruthy();
    expect(screen.queryByText('tracking custom-meso')).toBeNull();
    expect(screen.queryByText('tracking full-body')).toBeNull();
  });

  it('keeps a plan the user opened even when its template cannot be loaded', async () => {
    mockSummaries.current = {
      programs: [plan('gzclp-instance')],
      cached: false,
    };

    render(<TrainScreen requestedProgramId="custom-meso" onOpenPrograms={jest.fn()} />);

    expect(await screen.findByText('tracking custom-meso')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText('tracking gzclp-instance')).toBeNull();
    });
  });
});
