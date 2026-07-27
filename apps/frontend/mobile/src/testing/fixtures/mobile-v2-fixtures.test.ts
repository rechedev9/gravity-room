import {
  GenericProgramDetailSchema,
  GenericResultsSchema,
  ProgramDefinitionSchema,
} from '@gzclp/domain';

import {
  CANONICAL_PROGRAM_DEFINITION,
  CANONICAL_PROGRAM_DETAIL,
  CANONICAL_QUEUED_MUTATION,
  CANONICAL_WORKOUT_RESULTS,
} from './mobile-v2-fixtures';

describe('Mobile v2 canonical fixtures', () => {
  it('keeps the program fixture inside the shared domain contract', () => {
    expect(ProgramDefinitionSchema.parse(CANONICAL_PROGRAM_DEFINITION)).toEqual(
      CANONICAL_PROGRAM_DEFINITION
    );
  });

  it('keeps the workout fixture compatible with existing persisted results', () => {
    expect(GenericResultsSchema.parse(CANONICAL_WORKOUT_RESULTS)).toEqual(
      CANONICAL_WORKOUT_RESULTS
    );
    expect(GenericProgramDetailSchema.parse(CANONICAL_PROGRAM_DETAIL)).toEqual(
      CANONICAL_PROGRAM_DETAIL
    );
  });

  it('freezes the v1 outbox envelope and set-log payload used by the tracker', () => {
    expect(CANONICAL_QUEUED_MUTATION).toMatchObject({
      entityType: 'program-instance',
      operation: 'record-result',
      payload: {
        workoutIndex: 0,
        slotId: 'squat-t1',
        result: 'success',
        setLogs: CANONICAL_WORKOUT_RESULTS['0']['squat-t1'].setLogs,
      },
    });
  });
});
