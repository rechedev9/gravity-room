import { captureAuthorizedSession } from '../auth/session';
import { enqueueMutation } from '../sync/mutation-queue-repository';
import { flushQueuedMutations } from '../sync/mutation-sync-service';
import {
  queueDeleteResultMutation,
  queueRecordResultMutation,
  queueUndoRestoreMutation,
  queueUpdateMetadataMutation,
} from './tracker-mutation-service';

jest.mock('../auth/session', () => ({
  captureAuthorizedSession: jest.fn(),
}));

jest.mock('../sync/mutation-queue-repository', () => ({
  enqueueMutation: jest.fn(),
}));

jest.mock('../sync/mutation-sync-service', () => ({
  flushQueuedMutations: jest.fn(),
}));

const mockedCaptureAuthorizedSession = jest.mocked(captureAuthorizedSession);
const mockedEnqueueMutation = jest.mocked(enqueueMutation);
const mockedFlushQueuedMutations = jest.mocked(flushQueuedMutations);

describe('tracker mutation service', () => {
  const ownerUserId = 'user-a';
  const authorizedSession = {
    ownerUserId,
    accessToken: 'test-auth-token',
    generation: 1,
  };
  afterEach(() => {
    mockedCaptureAuthorizedSession.mockReset();
    mockedEnqueueMutation.mockReset();
    mockedFlushQueuedMutations.mockReset();
  });

  it('queues a record-result mutation and flushes it when an access token exists', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueRecordResultMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
      },
    });
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith(authorizedSession);
  });

  it('queues result mutations with optional amrapReps and rpe fields', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueRecordResultMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 8,
      rpe: 9,
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 8,
        rpe: 9,
      },
    });
  });

  it('strips amrapReps and rpe from fail result mutations', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueRecordResultMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'fail',
      amrapReps: 8,
      rpe: 9,
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'fail',
      },
    });
  });

  it('queues metadata updates without flushing when there is no access token yet', async () => {
    mockedCaptureAuthorizedSession.mockImplementation(() => {
      throw new Error('No session');
    });
    mockedEnqueueMutation.mockResolvedValue();

    await queueUpdateMetadataMutation({
      ownerUserId,
      instanceId: 'instance-1',
      metadata: {
        graduationDismissed: true,
      },
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'update-metadata',
      payload: {
        metadata: {
          graduationDismissed: true,
        },
      },
    });
    expect(mockedFlushQueuedMutations).not.toHaveBeenCalled();
  });

  it('queues a delete-result mutation when undo restores an empty slot', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueUndoRestoreMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
      },
    });
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith(authorizedSession);
  });

  it('queues a record-result mutation when undo restores a previous result snapshot', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueUndoRestoreMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 0,
      slotId: 'squat-t1',
      result: 'success',
      amrapReps: 12,
      rpe: 8,
      setLogs: [
        {
          reps: 5,
          weight: 100,
        },
      ],
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        amrapReps: 12,
        rpe: 8,
        setLogs: [
          {
            reps: 5,
            weight: 100,
          },
        ],
      },
    });
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith(authorizedSession);
  });

  it('keeps the queued mutation when opportunistic flush fails', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockRejectedValue(new Error('Network request failed'));

    await expect(
      queueUndoRestoreMutation({
        ownerUserId,
        instanceId: 'instance-1',
        workoutIndex: 0,
        slotId: 'squat-t1',
      })
    ).resolves.toBeUndefined();

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
      },
    });
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith(authorizedSession);
  });

  it('queues delete-result mutations and flushes them when an access token exists', async () => {
    mockedCaptureAuthorizedSession.mockReturnValue(authorizedSession);
    mockedEnqueueMutation.mockResolvedValue();
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 1 });

    await queueDeleteResultMutation({
      ownerUserId,
      instanceId: 'instance-1',
      workoutIndex: 2,
      slotId: 'bench-t2',
    });

    expect(mockedEnqueueMutation).toHaveBeenCalledWith({
      ownerUserId,
      entityType: 'program-instance',
      entityId: 'instance-1',
      operation: 'delete-result',
      payload: {
        workoutIndex: 2,
        slotId: 'bench-t2',
      },
    });
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith(authorizedSession);
  });
});
