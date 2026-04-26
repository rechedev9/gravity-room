import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { TrackerScreen } from './tracker-screen';
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

describe('TrackerScreen', () => {
  beforeEach(() => {
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

  it('renders cached workout data before the remote refresh completes', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedFetchProgramDetail.mockImplementation(() => new Promise(() => undefined));
    mockedFetchProgramDefinition.mockResolvedValue(TEST_DEFINITION);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Day A')).toBeTruthy();
    expect(screen.getByText('Squat')).toBeTruthy();
    expect(screen.getByText('60 kg')).toBeTruthy();
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
    });
    expect(mockedUpsertProgramDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': {
              result: 'success',
            },
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

    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

    await waitFor(() => {
      expect(mockedUpsertProgramDetail).not.toHaveBeenCalled();
      expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();
    });
  });

  it('shows the logged result immediately while waiting for the local detail write', async () => {
    const upsertDetail = createDeferred<void>();

    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedUpsertProgramDetail.mockReturnValue(upsertDetail.promise);
    mockedQueueRecordResultMutation.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

    expect(screen.getByText('Logged success')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).not.toHaveBeenCalled();

    upsertDetail.resolve();

    await waitFor(() => {
      expect(mockedQueueRecordResultMutation).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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

    expect(await screen.findByText('Logged fail')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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

    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Increase Squat RPE' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));

    expect(await screen.findByText('RPE: 1')).toBeTruthy();
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: {
          0: {
            'squat-t1': expect.objectContaining({
              result: 'success',
              amrapReps: 1,
              rpe: 1,
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
      amrapReps: 1,
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
                    reps: 5,
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
            reps: 5,
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

    expect(await screen.findByText('Logged success')).toBeTruthy();
    expect(screen.getByText('AMRAP reps: -')).toBeTruthy();
    expect(screen.queryByText('Awaiting result')).toBeNull();
    expect(mockedQueueUndoRestoreMutation).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
    });
    expect(mockedUpsertProgramDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));

    await waitFor(() => {
      expect(screen.getByText('AMRAP reps: -')).toBeTruthy();
    });
    expect(screen.queryByText('AMRAP reps: 1')).toBeNull();
  });

  it('does not roll back a newer edit when an older local write fails late', async () => {
    const firstWrite = createDeferred<void>();
    const secondWrite = createDeferred<void>();

    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail
      .mockReturnValueOnce(firstWrite.promise)
      .mockReturnValueOnce(secondWrite.promise);

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 1')).toBeTruthy();

    secondWrite.resolve();

    await waitFor(() => {
      expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 1,
      });
    });

    firstWrite.reject(new Error('SQLite write failed'));

    await waitFor(() => {
      expect(screen.getByText('Logged success')).toBeTruthy();
      expect(screen.getByText('AMRAP reps: 1')).toBeTruthy();
    });
    expect(screen.queryByText('Awaiting result')).toBeNull();
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));

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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));
    expect(await screen.findByText('RPE: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear Squat AMRAP reps' }));
    expect(await screen.findByText('AMRAP reps: -')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Clear Squat RPE' }));

    expect(await screen.findByText('RPE: -')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByRole('button', { name: 'Increase Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat AMRAP reps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Increase Squat RPE' }));

    expect(await screen.findByText('AMRAP reps: 1')).toBeTruthy();
    expect(await screen.findByText('RPE: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat AMRAP reps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat RPE' }));

    expect(await screen.findByText('AMRAP reps: -')).toBeTruthy();
    expect(await screen.findByText('RPE: -')).toBeTruthy();

    const persistedDetail = mockedUpsertProgramDetail.mock.calls.at(-1)?.[0];
    expect(persistedDetail).toBeDefined();
    expect(persistedDetail?.results['0']?.['squat-t1']).toEqual({ result: 'success' });
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
    });
  });

  it('does not create AMRAP or RPE values when decreasing from empty state', async () => {
    mockedGetProgramDetail.mockResolvedValue(TEST_DETAIL);
    mockedGetProgramDefinition.mockResolvedValue(TEST_DEFINITION);
    mockedFetchProgramDetail.mockRejectedValue(new Error('Network request failed'));
    mockedFetchProgramDefinition.mockRejectedValue(new Error('Network request failed'));
    mockedQueueRecordResultMutation.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();

    render(<TrackerScreen programInstanceId="instance-1" onBack={jest.fn()} />);

    expect(await screen.findByText('Squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByRole('button', { name: 'Decrease Squat AMRAP reps' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat AMRAP reps' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Squat RPE' }));

    expect(await screen.findByText('AMRAP reps: -')).toBeTruthy();
    expect(await screen.findByText('RPE: -')).toBeTruthy();
    expect(mockedQueueRecordResultMutation).toHaveBeenCalledTimes(1);
    expect(mockedQueueRecordResultMutation).toHaveBeenLastCalledWith({
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Bench success' }));

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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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

    fireEvent.press(screen.getByRole('button', { name: 'Mark Squat success' }));
    expect(await screen.findByText('Logged success')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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

    expect(await screen.findByText('Logged fail')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Undo latest tracker action' }));

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
