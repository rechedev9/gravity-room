import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProgramQueryProvider } from '../../shell/program-query-provider';
import {
  act,
  fireEvent,
  render as renderScreen,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import {
  getSetDrafts,
  saveSetDrafts,
  type SetDrafts,
} from '../../lib/tracker/set-draft-repository';
import { TrackerScreen } from './tracker-screen';
function render(element: ReactElement) {
  return renderScreen(<ProgramQueryProvider>{element}</ProgramQueryProvider>);
}
import { getAccessToken } from '../../lib/auth/session';
import {
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import {
  fetchProgramDefinition,
  fetchProgramDetail,
} from '../../lib/tracker/program-detail-service';
import { flushQueuedMutations } from '../../lib/sync/mutation-sync-service';
import {
  queueRecordResultMutation,
  queueUndoRestoreMutation,
} from '../../lib/tracker/tracker-mutation-service';

jest.mock('../../lib/tracker/set-draft-repository', () => ({
  getSetDrafts: jest.fn(async () => ({})),
  saveSetDrafts: jest.fn(async () => undefined),
}));

jest.mock('../../shell/rest-timer-provider', () => ({
  useRestTimer: () => ({ start: jest.fn(), skip: jest.fn() }),
}));

jest.mock('../../lib/auth/session', () => ({
  getAccessToken: jest.fn(),
}));

jest.mock('../../lib/tracker/program-detail-repository', () => ({
  getProgramDetail: jest.fn(),
  getProgramDefinition: jest.fn(),
  upsertProgramDetail: jest.fn(),
  upsertProgramDefinition: jest.fn(),
}));

jest.mock('../../lib/tracker/program-detail-service', () => ({
  fetchProgramDetail: jest.fn(),
  fetchProgramDefinition: jest.fn(),
}));

jest.mock('../../lib/sync/mutation-sync-service', () => ({
  flushQueuedMutations: jest.fn(),
}));

jest.mock('../../lib/tracker/tracker-mutation-service', () => ({
  queueRecordResultMutation: jest.fn(),
  queueUndoRestoreMutation: jest.fn(),
}));

const mockedGetAccessToken = jest.mocked(getAccessToken);
const mockedGetProgramDetail = jest.mocked(getProgramDetail);
const mockedGetProgramDefinition = jest.mocked(getProgramDefinition);
const mockedUpsertProgramDefinition = jest.mocked(upsertProgramDefinition);
const mockedUpsertProgramDetail = jest.mocked(upsertProgramDetail);
const mockedFetchProgramDetail = jest.mocked(fetchProgramDetail);
const mockedFetchProgramDefinition = jest.mocked(fetchProgramDefinition);
const mockedFlushQueuedMutations = jest.mocked(flushQueuedMutations);
const mockedQueueRecordResultMutation = jest.mocked(queueRecordResultMutation);
const mockedQueueUndoRestoreMutation = jest.mocked(queueUndoRestoreMutation);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

const TEST_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for tracker screen tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'Day A',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'squat',
        },
      ],
    },
    {
      name: 'Day B',
      slots: [
        {
          id: 'bench-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [{ sets: 5, reps: 3, amrap: false }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const TEST_DETAIL: GenericProgramDetail = {
  id: 'instance-1',
  programId: 'test-prog',
  name: 'Test Program Instance',
  config: {
    squat: 60,
    bench: 40,
  },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
};

const SQUAT_SET_LOGS = [
  { reps: 3, weight: 60 },
  { reps: 3, weight: 60 },
  { reps: 3, weight: 60 },
  { reps: 3, weight: 60 },
  { reps: 3, weight: 60 },
] as const;

function squatLogsWithLastReps(reps: number): Array<{ reps: number; weight: number }> {
  return [
    { reps: 3, weight: 60 },
    { reps: 3, weight: 60 },
    { reps: 3, weight: 60 },
    { reps: 3, weight: 60 },
    { reps, weight: 60 },
  ];
}

async function confirmSets(name: string, count: number): Promise<void> {
  for (let index = 1; index <= count; index += 1) {
    const button = await screen.findByRole('button', { name: `Confirm set ${index} for ${name}` });
    await act(async () => {
      fireEvent.press(button);
    });
  }
  const details = screen.queryByRole('button', { name: `View sets for ${name}` });
  if (details) fireEvent.press(details);
}

describe('TrackerScreen', () => {
  beforeEach(() => {
    jest.mocked(getSetDrafts).mockReset().mockResolvedValue({});
    jest.mocked(saveSetDrafts).mockReset().mockResolvedValue();
    mockedGetAccessToken.mockReturnValue('restored-access-token');
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
  });

  afterEach(() => {
    mockedGetAccessToken.mockReset();
    mockedGetProgramDetail.mockReset();
    mockedGetProgramDefinition.mockReset();
    mockedUpsertProgramDefinition.mockReset();
    mockedUpsertProgramDetail.mockReset();
    mockedFetchProgramDetail.mockReset();
    mockedFetchProgramDefinition.mockReset();
    mockedFlushQueuedMutations.mockReset();
    mockedQueueRecordResultMutation.mockReset();
    mockedQueueUndoRestoreMutation.mockReset();
  });

  it('enables Undo after queued metric writes commit and then reverts the latest edit', async () => {
    const metricWrite = createDeferred<void>();
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail
      .mockResolvedValueOnce()
      .mockReturnValueOnce(metricWrite.promise)
      .mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    await screen.findByText('Squat');
    await confirmSets('Squat', 5);
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await screen.findByText('AMRAP reps: 4');
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(
      screen.getByRole('button', { name: 'Undo latest completed result' }).props.accessibilityState
        .disabled
    ).toBe(true);
    await act(async () => metricWrite.resolve());
    await screen.findByText('AMRAP reps: 5');
    expect(
      screen.getByRole('button', { name: 'Undo latest completed result' }).props.accessibilityState
        .disabled
    ).toBe(false);
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }))
    );
    expect(screen.getByText('AMRAP reps: 4')).toBeTruthy();
    expect(screen.getByText('Logged success')).toBeTruthy();
  });

  it('does not undo a completed exercise when the metric edit being undone fails', async () => {
    const metricWrite = createDeferred<void>();
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail
      .mockResolvedValueOnce()
      .mockReturnValueOnce(metricWrite.promise)
      .mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    await screen.findByText('Squat');
    await confirmSets('Squat', 5);
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await screen.findByText('AMRAP reps: 4');
    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));
    await act(async () => metricWrite.reject(new Error('Disk full')));
    expect(screen.getByText('Logged success')).toBeTruthy();
    expect(screen.getByText('AMRAP reps: 3')).toBeTruthy();
    expect(mockedQueueUndoRestoreMutation).not.toHaveBeenCalled();
    expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(2);
  });

  it('uploads the domain outcome for a progression set followed by lower-rep backoffs', async () => {
    const baseSlot = TEST_DEFINITION.days[0]?.slots[0];
    if (!baseSlot) throw new Error('Missing fixture slot');
    const definition: ProgramDefinition = {
      ...TEST_DEFINITION,
      days: [
        {
          name: 'Day A',
          slots: [
            {
              ...baseSlot,
              stages: [{ sets: 3, reps: 6 }],
              onSuccess: { type: 'double_progression', repRangeBottom: 6, repRangeTop: 12 },
              progressionSetIndex: 0,
            },
          ],
        },
      ],
    };
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(definition);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail.mockResolvedValue();
    jest.mocked(getSetDrafts).mockResolvedValue({
      '0:squat-t1': [
        { weight: 60, reps: 12 },
        { weight: 60, reps: 5 },
      ],
    });
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.changeText(await screen.findByLabelText('Reps for set 3 of Squat'), '5');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm set 3 for Squat' }));
    await screen.findByText('Logged success');
    await waitFor(() => expect(mockedQueueRecordResultMutation).toHaveBeenCalled());
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: 'success' })
    );
  });

  it('waits for a previous mount draft commit before hydrating the same plan', async () => {
    let storedDrafts: SetDrafts = {};
    const commit = createDeferred<void>();
    mockedGetProgramDetail.mockImplementation(async (id) => ({ ...TEST_DETAIL, id }));
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    jest.mocked(getSetDrafts).mockImplementation(async () => storedDrafts);
    jest
      .mocked(saveSetDrafts)
      .mockImplementationOnce(async (_id, drafts) => {
        await commit.promise;
        storedDrafts = drafts;
      })
      .mockImplementation(async (_id, drafts) => {
        storedDrafts = drafts;
      });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tracker = (id: string) => (
      <QueryClientProvider client={client}>
        <TrackerScreen key={id} programInstanceId={id} onBack={jest.fn()} />
      </QueryClientProvider>
    );
    const view = renderScreen(tracker('instance-1'));
    fireEvent.press(await screen.findByRole('button', { name: 'Confirm set 1 for Squat' }));
    await waitFor(() => expect(saveSetDrafts).toHaveBeenCalledTimes(1));
    view.rerender(tracker('instance-2'));
    await screen.findByRole('button', { name: 'Confirm set 1 for Squat' });
    view.rerender(tracker('instance-1'));
    expect(screen.queryByRole('button', { name: 'Confirm set 1 for Squat' })).toBeNull();
    await act(async () => commit.resolve());
    fireEvent.changeText(await screen.findByLabelText('Reps for set 2 of Squat'), '4');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm set 2 for Squat' }));
    await waitFor(() => expect(saveSetDrafts).toHaveBeenCalledTimes(2));
    expect(storedDrafts['0:squat-t1']).toEqual([
      { reps: 3, weight: 60 },
      { reps: 4, weight: 60 },
    ]);
    view.unmount();
    client.clear();
  });

  it('persists and uploads the domain-derived failure when logged AMRAP reps fall below target', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: { 0: { 'squat-t1': { result: 'success', setLogs: [...SQUAT_SET_LOGS] } } },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedQueueRecordResultMutation.mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    fireEvent.press(screen.getByRole('button', { name: 'View sets for Squat' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat AMRAP reps' }));
    await screen.findByText('Logged fail');
    await waitFor(() => expect(mockedQueueRecordResultMutation).toHaveBeenCalledTimes(1));
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: 'fail', setLogs: squatLogsWithLastReps(2) })
    );
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: { 0: { 'squat-t1': { result: 'fail', setLogs: squatLogsWithLastReps(2) } } },
      })
    );
  });

  it('increments the displayed logged AMRAP when a legacy metric disagrees', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: { 'squat-t1': { result: 'success', amrapReps: 5, setLogs: squatLogsWithLastReps(8) } },
      },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail.mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    fireEvent.press(screen.getByRole('button', { name: 'View sets for Squat' }));
    await screen.findByText('AMRAP reps: 8');
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await waitFor(() =>
      expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith(
        expect.objectContaining({ amrapReps: 9, setLogs: squatLogsWithLastReps(9) })
      )
    );
  });

  it('serializes metric edits behind final-set writes without losing either result', async () => {
    const completion = createDeferred<void>();
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: { 0: { 'squat-t1': { result: 'success', setLogs: [...SQUAT_SET_LOGS] } } },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail.mockReturnValueOnce(completion.promise).mockResolvedValue();
    jest.mocked(getSetDrafts).mockResolvedValue({
      '1:bench-t1': Array.from({ length: 4 }, () => ({ weight: 40, reps: 3 })),
    });
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Confirm set 5 for Bench' }));
    await waitFor(() => expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByRole('button', { name: 'Previous workout' }));
    fireEvent.press(screen.getByRole('button', { name: 'View sets for Squat' }));
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await act(async () => {});
    expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(1);
    await act(async () => completion.resolve());
    await waitFor(() => expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(2));
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: {
          0: { 'squat-t1': expect.objectContaining({ result: 'success', amrapReps: 4 }) },
          1: {
            'bench-t1': expect.objectContaining({
              result: 'success',
              setLogs: Array.from({ length: 5 }, () => ({ weight: 40, reps: 3 })),
            }),
          },
        },
      })
    );
  });

  it('cancels pre-edit detail requests across program reentry and fetches again', async () => {
    let stored = TEST_DETAIL;
    mockedGetProgramDetail.mockImplementation(async () => stored);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockImplementation(async (detail) => {
      stored = detail;
    });
    mockedQueueRecordResultMutation.mockResolvedValue();
    const remote = createDeferred<GenericProgramDetail>();
    mockedFetchProgramDetail
      .mockReturnValueOnce(remote.promise)
      .mockImplementation(async () => stored);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tracker = (id: string) => (
      <QueryClientProvider client={client}>
        <TrackerScreen key={id} programInstanceId={id} onBack={jest.fn()} />
      </QueryClientProvider>
    );
    const view = renderScreen(tracker('instance-1'));
    await waitFor(() => expect(mockedFetchProgramDetail).toHaveBeenCalledTimes(1));
    fireEvent.press(await screen.findByRole('button', { name: 'Mark Squat fail' }));
    await waitFor(() => expect(mockedQueueRecordResultMutation).toHaveBeenCalledTimes(1));
    view.rerender(tracker('instance-2'));
    await screen.findByRole('button', { name: 'Confirm set 1 for Bench' });
    view.rerender(tracker('instance-1'));
    await waitFor(() => expect(mockedFetchProgramDetail).toHaveBeenCalledTimes(3));
    await act(async () => remote.resolve(TEST_DETAIL));
    expect(stored.results['0']?.['squat-t1']?.result).toBe('fail');
    view.unmount();
    client.clear();
  });

  it('refreshes on focus while preserving the current set editor and unfinished drafts', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedFetchProgramDetail.mockResolvedValue(TEST_DETAIL);
    jest.mocked(getSetDrafts).mockResolvedValue({ '0:squat-t1': SQUAT_SET_LOGS.slice(0, 1) });
    const tracker = (focused: boolean) => (
      <ProgramQueryProvider>
        <TrackerScreen programInstanceId="instance-1" isFocused={focused} onBack={jest.fn()} />
      </ProgramQueryProvider>
    );
    const view = renderScreen(tracker(true));
    const input = await screen.findByLabelText('Weight for set 2 of Squat');
    await waitFor(() => expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(1));
    fireEvent.changeText(input, '67');
    view.rerender(tracker(false));
    mockedFetchProgramDetail.mockResolvedValue({ ...TEST_DETAIL, name: 'Changed remotely' });
    view.rerender(tracker(true));
    await screen.findByText('Changed remotely');
    expect(mockedFetchProgramDetail).toHaveBeenCalledTimes(2);
    expect(getSetDrafts).toHaveBeenCalledTimes(1);
    expect(mockedGetProgramDetail).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Weight for set 2 of Squat').props.value).toBe('67');
    expect(screen.getByLabelText('Reps for set 2 of Squat')).toBeTruthy();
  });

  it('excludes remotely completed slots from subsequent draft saves', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    jest.mocked(getSetDrafts).mockResolvedValue({ '0:squat-t1': SQUAT_SET_LOGS.slice(0, 2) });
    mockedFetchProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: { 0: { 'squat-t1': { result: 'success', setLogs: [...SQUAT_SET_LOGS] } } },
      undoHistory: [{ i: 0, slotId: 'squat-t1' }],
    });
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    await screen.findByText('Logged success');
    fireEvent.press(screen.getByRole('button', { name: 'Continue to next unfinished workout' }));
    await act(async () => {
      fireEvent.press(await screen.findByRole('button', { name: 'Confirm set 1 for Bench' }));
    });
    expect(saveSetDrafts).toHaveBeenLastCalledWith('instance-1', {
      '1:bench-t1': [{ reps: 3, weight: 40 }],
    });
  });

  it('retries an unavailable tracker after reconnecting without remounting', async () => {
    mockedGetProgramDetail.mockResolvedValue(null);
    mockedFetchProgramDetail
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(TEST_DETAIL);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    await screen.findByText('Tracker unavailable');
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Confirm set 1 for Squat' });
    expect(mockedFetchProgramDetail).toHaveBeenCalledTimes(2);
  });

  it('preserves final-set edits through a deferred SQLite completion failure and retry', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    jest.mocked(getSetDrafts).mockResolvedValue({ '0:squat-t1': SQUAT_SET_LOGS.slice(0, 4) });
    let rejectWrite: (error: Error) => void = () => {
      throw new Error('Write not started');
    };
    mockedUpsertProgramDetail
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectWrite = reject;
          })
      )
      .mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.changeText(await screen.findByLabelText('Weight for set 5 of Squat'), '65');
    fireEvent.changeText(screen.getByLabelText('Reps for set 5 of Squat'), '8');
    fireEvent.press(screen.getByRole('button', { name: 'Confirm set 5 for Squat' }));
    await waitFor(() => expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Weight for set 5 of Squat').props.value).toBe('65');
    await act(async () => rejectWrite(new Error('Disk full')));
    await screen.findByText('Could not save this set on your device. Please try again.');
    expect(screen.getByLabelText('Reps for set 5 of Squat').props.value).toBe('8');
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Confirm set 5 for Squat' }))
    );
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        setLogs: [...SQUAT_SET_LOGS.slice(0, 4), { weight: 65, reps: 8 }],
        amrapReps: 8,
      })
    );
  });

  it('shows actual held weight in the completed double-progression next-session summary', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: { 'squat-t1': { result: 'success', setLogs: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] } },
      },
    });
    mockedGetProgramDefinition.mockResolvedValue({
      ...TEST_DEFINITION,
      days: TEST_DEFINITION.days.map((day) => ({
        ...day,
        slots: day.slots.map((slot) => ({
          ...slot,
          stages: [{ sets: 3, reps: 6, repsMax: 12 }],
          onSuccess: { type: 'double_progression', repRangeBottom: 6, repRangeTop: 12 },
        })),
      })),
    });
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    expect(await screen.findByText('Day complete')).toBeTruthy();
    expect(screen.getByText('60 kg · 3 x 6')).toBeTruthy();
    expect(screen.queryByText('65 kg · 3 x 6')).toBeNull();
  });

  it('undoes the chosen exercise draft after reload without deleting another exercise or allowing early failure', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue({
      ...TEST_DEFINITION,
      days: [{ name: 'Combined', slots: TEST_DEFINITION.days.flatMap((day) => day.slots) }],
    });
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    jest.mocked(getSetDrafts).mockResolvedValue({
      '0:squat-t1': [{ reps: 3, weight: 60 }],
      '0:bench-t1': [{ reps: 3, weight: 40 }],
    });
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    expect(await screen.findByRole('button', { name: 'Undo last set for Bench' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark Squat fail' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark Bench fail' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Undo last set for Bench' }));
    await waitFor(() =>
      expect(jest.mocked(saveSetDrafts)).toHaveBeenLastCalledWith('instance-1', {
        '0:squat-t1': [{ reps: 3, weight: 60 }],
      })
    );
    expect(await screen.findByRole('button', { name: 'Confirm set 1 for Bench' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm set 2 for Squat' })).toBeTruthy();
  });

  it('records edited weights and missed reps, totals actual volume, and continues to the pending day', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedQueueRecordResultMutation.mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    await screen.findByText('Squat', {}, { timeout: 5000 });
    const logs = [
      { weight: 62.5, reps: 3 },
      { weight: 60, reps: 2 },
      { weight: 60, reps: 3 },
      { weight: 60, reps: 3 },
      { weight: 60, reps: 3 },
    ];
    for (const [offset, entry] of logs.entries()) {
      const index = offset + 1;
      fireEvent.changeText(
        await screen.findByLabelText(`Weight for set ${index} of Squat`),
        String(entry.weight)
      );
      fireEvent.changeText(
        screen.getByLabelText(`Reps for set ${index} of Squat`),
        String(entry.reps)
      );
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: `Confirm set ${index} for Squat` }));
      });
    }
    expect(await screen.findByText('Day complete')).toBeTruthy();
    expect(screen.getByText('Logged volume: 847.5 kg')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'fail',
      setLogs: logs,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Continue to next unfinished workout' }));
    expect(await screen.findByText('Day B')).toBeTruthy();
    expect(screen.getByLabelText('Reps for set 1 of Bench').props.value).toBe('3');
  });

  it('restores unfinished sets after remounting the tracker', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    jest.mocked(getSetDrafts).mockResolvedValue({
      '0:squat-t1': [
        { reps: 3, weight: 60 },
        { reps: 3, weight: 60 },
      ],
    });

    const first = render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    const confirm = await screen.findByRole('button', { name: 'Confirm set 3 for Squat' });
    await act(async () => {
      fireEvent.press(confirm);
    });
    expect(saveSetDrafts).toHaveBeenCalledWith('instance-1', {
      '0:squat-t1': SQUAT_SET_LOGS.slice(0, 3),
    });
    first.unmount();
    jest.mocked(getSetDrafts).mockResolvedValue({ '0:squat-t1': SQUAT_SET_LOGS.slice(0, 3) });
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    expect(await screen.findByRole('button', { name: 'Confirm set 4 for Squat' })).toBeTruthy();
  });

  it('keeps the current set when SQLite rejects a draft write', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    jest.mocked(saveSetDrafts).mockRejectedValueOnce(new Error('Disk full'));
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Confirm set 1 for Squat' }));
    expect(
      await screen.findByText('Could not save this set on your device. Please try again.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm set 1 for Squat' })).toBeTruthy();
    expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();
  });

  it('renders cached workout data before the remote refresh completes', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedFetchProgramDetail.mockImplementation(() => new Promise(() => undefined));
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    await waitFor(
      () => {
        expect(screen.getByText('Day A')).toBeTruthy();
        expect(screen.getByText('Squat')).toBeTruthy();
        expect(screen.getByText('60 kg')).toBeTruthy();
      },
      { timeout: 5_000 }
    );
  });

  it('loads tracker data from remote when no cached detail exists yet', async () => {
    mockedGetProgramDetail.mockResolvedValue(null);
    mockedGetProgramDefinition.mockResolvedValue(null);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedFetchProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(mockedUpsertProgramDefinition).toHaveBeenCalledWith(TEST_DEFINITION);
    expect(mockedUpsertProgramDetail).toHaveBeenCalledWith(TEST_DETAIL);
  });

  it('repairs a corrupt local tracker cache from the remote response', async () => {
    mockedGetProgramDetail.mockRejectedValue(new SyntaxError('corrupt detail_json'));
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedFetchProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();
    expect(mockedFetchProgramDetail).toHaveBeenCalledWith('instance-1');
    expect(mockedUpsertProgramDetail).toHaveBeenCalledWith(TEST_DETAIL);
  });

  it('loads tracker data from an inline custom definition without fetching catalog detail', async () => {
    const customDefinition: ProgramDefinition = {
      ...TEST_DEFINITION,
      id: 'custom-def-1',
      name: 'Imported Program',
      source: 'custom',
    };

    mockedGetProgramDetail.mockResolvedValue(null);
    mockedGetProgramDefinition.mockResolvedValue(null);
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedFetchProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      programId: 'imported-program',
      definitionId: 'custom-def-1',
      customDefinition,
    });

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(mockedFetchProgramDefinition).not.toHaveBeenCalled();
  });

  it('waits for queued mutation flush before refreshing cached tracker data', async () => {
    const delayedFlush = createDeferred<{ processedCount: number }>();

    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
          },
        },
      },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedFlushQueuedMutations.mockReturnValue(delayedFlush.promise);
    mockedFetchProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
          },
        },
      },
    });
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(mockedFetchProgramDetail).not.toHaveBeenCalled();

    delayedFlush.resolve({ processedCount: 1 });

    await waitFor(() => {
      expect(mockedFetchProgramDetail).toHaveBeenCalledWith('instance-1');
    });
  });

  it('keeps cached tracker data when queued mutation flush fails before refresh', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
          },
        },
      },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFlushQueuedMutations.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDetail.mockResolvedValue(TEST_DETAIL);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(
      await screen.findByText('Showing cached tracker data while sync catches up.')
    ).toBeTruthy();
    expect(mockedFetchProgramDetail).not.toHaveBeenCalled();
  });

  it('marks a slot as success locally and queues the offline mutation', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
    });
    expect(mockedUpsertProgramDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': expect.objectContaining({
              result: 'success',
              amrapReps: 3,
              setLogs: [...SQUAT_SET_LOGS],
            }),
          },
        },
      })
    );
  });

  it('does not queue or append undo state when pressing success on an unchanged success slot', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
            amrapReps: 3,
            rpe: 8,
          },
        },
      },
      undoHistory: [],
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirm set/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark Squat success' })).toBeNull();

    await waitFor(() => {
      expect(mockedUpsertProgramDetail).not.toHaveBeenCalled();
      expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();
    });
  });

  it('keeps the final set editor until the local completion write succeeds', async () => {
    const upsertDetail = createDeferred<void>();

    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedUpsertProgramDetail.mockReturnValue(upsertDetail.promise);
    mockedQueueRecordResultMutation.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);

    expect(screen.queryByText('Logged success')).toBeNull();
    expect(screen.getByLabelText('Weight for set 5 of Squat')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();

    upsertDetail.resolve();

    await waitFor(() => {
      expect(mockedQueueRecordResultMutation).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 3,
        setLogs: [...SQUAT_SET_LOGS],
      });
    });
  });

  it('does not show a logged result when the local detail write fails', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedUpsertProgramDetail.mockRejectedValue(new Error('SQLite write failed'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);

    await waitFor(() => {
      expect(screen.getByText('Awaiting result')).toBeTruthy();
    });
    expect(screen.queryByText('Logged success')).toBeNull();
    expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();
  });

  it('marks a slot as fail locally and queues the offline mutation', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat fail' }));

    expect(await screen.findByText('Logged fail')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'fail',
    });
  });

  it('undoes the latest local tracker action and queues delete-result when restoring an empty slot', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedQueueUndoRestoreMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Awaiting result')).toBeTruthy();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
    });
  });

  it('restores the previous slot snapshot from undoHistory when undoing', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'fail',
          },
        },
      },
      undoHistory: [
        {
          i: 0,
          slotId: 'squat-t1',
          prev: 'success',
          prevAmrapReps: 12,
          prevRpe: 8,
        },
      ],
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueUndoRestoreMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged fail')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(screen.getByText('AMRAP reps: 12')).toBeTruthy();
    expect(screen.getByText('RPE: 8')).toBeTruthy();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 12,
      rpe: 8,
    });
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': {
              result: 'success',
              amrapReps: 12,
              rpe: 8,
            },
          },
        },
        undoHistory: [],
      })
    );
  });

  it('enables undo on first render from cached undoHistory', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
          },
        },
      },
      undoHistory: [
        {
          i: 0,
          slotId: 'squat-t1',
        },
      ],
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueUndoRestoreMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Awaiting result')).toBeTruthy();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
    });
  });

  it('reveals AMRAP and RPE controls after logging a result and persists field edits', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);

    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Increase Squat RPE' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 4')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));

    expect(await screen.findByText('RPE: 1')).toBeTruthy();
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': expect.objectContaining({
              result: 'success',
              amrapReps: 4,
              rpe: 1,
              setLogs: squatLogsWithLastReps(4),
            }),
          },
        },
      })
    );
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      setLogs: squatLogsWithLastReps(4),
      amrapReps: 4,
      rpe: 1,
    });
  });

  it('preserves existing setLogs when queueing metric-only edits', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
            amrapReps: 5,
            setLogs: [
              {
                reps: 5,
                weight: 100,
                rpe: 8,
              },
            ],
          },
        },
      },
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(screen.getByText('AMRAP reps: 5')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));

    await waitFor(() => {
      expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          results: {
            0: {
              'squat-t1': {
                result: 'success',
                amrapReps: 6,
                setLogs: [
                  {
                    reps: 6,
                    weight: 100,
                    rpe: 8,
                  },
                ],
              },
            },
          },
        })
      );
      expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 6,
        setLogs: [
          {
            reps: 6,
            weight: 100,
            rpe: 8,
          },
        ],
      });
    });
  });

  it('undoes a metric edit back to the previous success snapshot', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedQueueUndoRestoreMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 4')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(await screen.findByText('AMRAP reps: 3')).toBeTruthy();
    expect(screen.queryByText('Awaiting result')).toBeNull();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
    });
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': expect.objectContaining({
              result: 'success',
              amrapReps: 3,
              setLogs: [...SQUAT_SET_LOGS],
            }),
          },
        },
        undoHistory: [
          {
            i: 0,
            slotId: 'squat-t1',
          },
        ],
      })
    );
  });

  it('caps RPE at 10 to match the persisted domain constraints', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByRole('button', { name: 'Increase Squat RPE' })).toBeTruthy();

    for (let count = 0; count < 11; count += 1) {
      fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));
    }

    expect(await screen.findByText('RPE: 10')).toBeTruthy();
    expect(screen.queryByText('RPE: 11')).toBeNull();
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
      rpe: 10,
    });
  });

  it('does not append undo state or queue a mutation when increasing RPE past the cap', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'success',
            rpe: 10,
          },
        },
      },
      undoHistory: [],
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('RPE: 10')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));

    await waitFor(() => {
      expect(mockedUpsertProgramDetail).not.toHaveBeenCalled();
      expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('RPE: 11')).toBeNull();
  });

  it('does not show AMRAP or RPE edits when the local detail write fails', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('SQLite write failed'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));

    await waitFor(() => {
      expect(screen.getByText('AMRAP reps: 3')).toBeTruthy();
    });
    expect(screen.queryByText('AMRAP reps: 4')).toBeNull();
  });

  it('applies a queued metric edit to the restored snapshot after an earlier write fails', async () => {
    const firstWrite = createDeferred<void>();
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Offline'));
    mockedUpsertProgramDetail
      .mockResolvedValueOnce()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValue();
    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);
    await screen.findByText('Squat');
    await confirmSets('Squat', 5);
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await screen.findByText('AMRAP reps: 4');
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    await act(async () => {});
    expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(2);
    await act(async () => firstWrite.reject(new Error('SQLite write failed')));
    await waitFor(() => {
      expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 4,
        setLogs: squatLogsWithLastReps(4),
      });
    });
    expect(screen.getByText('AMRAP reps: 4')).toBeTruthy();
  });

  it('shows a lightweight sync warning when queueing a result fails after the local write succeeds', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedUpsertProgramDetail.mockResolvedValue();
    mockedQueueRecordResultMutation.mockRejectedValue(new Error('Queue unavailable'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(
      await screen.findByText("Saved locally. This change won't sync automatically.")
    ).toBeTruthy();
  });

  it('clears inline AMRAP and RPE values back to empty state', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 4')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));
    expect(await screen.findByText('RPE: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 3')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear Squat RPE' }));

    expect(await screen.findByText('RPE: -')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      setLogs: [...SQUAT_SET_LOGS],
    });
  });

  it('clears values when decrementing from 1 and removes AMRAP and RPE from the local snapshot', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));

    expect(await screen.findByText('AMRAP reps: 4')).toBeTruthy();
    expect(await screen.findByText('RPE: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat AMRAP reps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat RPE' }));

    expect(await screen.findByText('AMRAP reps: 3')).toBeTruthy();
    expect(await screen.findByText('RPE: -')).toBeTruthy();

    const persistedDetail = mockedUpsertProgramDetail.mock.calls.at(-1)?.[0];
    expect(persistedDetail).toBeDefined();
    expect(persistedDetail?.results['0']?.['squat-t1']).toEqual({
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
    });
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
    });
  });

  it('does not create RPE values when decreasing from empty state', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByRole('button', { name: 'Decrease Squat RPE' })).toBeTruthy();
    expect(screen.getByText('AMRAP reps: 3')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat RPE' }));

    expect(await screen.findByText('RPE: -')).toBeTruthy();
    expect(screen.getByText('AMRAP reps: 3')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenCalledTimes(1);
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 3,
      setLogs: [...SQUAT_SET_LOGS],
    });
  });

  it('navigates between cached workouts', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockImplementation(() => new Promise(() => undefined));
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Next workout' }));

    expect(await screen.findByText('Day B')).toBeTruthy();
    expect(screen.getByText('Bench')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Previous workout' }));

    expect(await screen.findByText('Day A')).toBeTruthy();
  });

  it('keeps non-AMRAP controls hidden and ignores stale refresh data after navigating', async () => {
    const delayedFetch = createDeferred<GenericProgramDetail>();

    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockReturnValue(delayedFetch.promise);
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Next workout' }));
    expect(await screen.findByText('Day B')).toBeTruthy();

    await confirmSets('Bench', 5);

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Increase Bench AMRAP reps' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Increase Bench RPE' })).toBeTruthy();

    delayedFetch.resolve(TEST_DETAIL);

    await waitFor(() => {
      expect(screen.getByText('Day B')).toBeTruthy();
      expect(screen.getByText('Logged success')).toBeTruthy();
      expect(mockedUpsertProgramDetail).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Day A')).toBeNull();
  });

  it('keeps AMRAP and RPE edits hidden after logging a fail', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat fail' }));

    expect(await screen.findByText('Logged fail')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Increase Squat RPE' })).toBeNull();
  });

  it('restores the previous result when undo local persistence fails', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('SQLite write failed'));

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    await waitFor(() => {
      expect(screen.getByText('Logged success')).toBeTruthy();
    });
    expect(screen.queryByText('Awaiting result')).toBeNull();
    expect(mockedQueueUndoRestoreMutation).not.toHaveBeenCalled();
  });

  it('shows the retry notice when undo delete queueing fails after the local write succeeds', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedQueueUndoRestoreMutation.mockRejectedValue(new Error('Queue unavailable'));
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    await confirmSets('Squat', 5);
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Awaiting result')).toBeTruthy();
    expect(
      await screen.findByText("Saved locally. This change won't sync automatically.")
    ).toBeTruthy();
  });

  it('shows the retry notice when undo restore queueing fails after the local write succeeds', async () => {
    mockedGetProgramDetail.mockResolvedValue({
      ...TEST_DETAIL,
      results: {
        0: {
          'squat-t1': {
            result: 'fail',
          },
        },
      },
      undoHistory: [
        {
          i: 0,
          slotId: 'squat-t1',
          prev: 'success',
          prevAmrapReps: 12,
          prevRpe: 8,
        },
      ],
    });
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueUndoRestoreMutation.mockRejectedValue(new Error('Queue unavailable'));
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    // Entry selects the first unfinished workout; reopen the completed day to edit it.
    fireEvent.press(await screen.findByRole('button', { name: 'Previous workout' }));
    const details = screen.queryByRole('button', { name: 'View sets for Squat' });
    if (details) fireEvent.press(details);

    expect(await screen.findByText('Logged fail')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest completed result' }));

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(
      await screen.findByText("Saved locally. This change won't sync automatically.")
    ).toBeTruthy();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 12,
      rpe: 8,
    });
  });
});
