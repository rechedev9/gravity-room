import { describe, expect, it } from 'vitest';
import { InvalidApiPathIdentifierError } from './path-identifier';
import {
  catalogDetail,
  completeProgram,
  createProgram,
  deleteProgram,
  deleteResult,
  listPrograms,
  programDetail,
  recordResult,
  toRequestInit,
  undoLastResult,
  updateMetadata,
  updateProgramConfig,
} from './program-requests';

describe('program request builders', () => {
  it('lists plans with an encoded cursor', () => {
    expect(listPrograms()).toEqual({ method: 'GET', path: '/programs' });
    expect(listPrograms('2026-01-01T00:00:00.000Z_p2').path).toBe(
      '/programs?cursor=2026-01-01T00%3A00%3A00.000Z_p2'
    );
  });

  it('encodes every identifier as a single path segment', () => {
    expect(programDetail('a/b').path).toBe('/programs/a%2Fb');
    expect(catalogDetail('custom:x y').path).toBe('/catalog/custom%3Ax%20y');
    expect(deleteResult({ instanceId: 'i/1', workoutIndex: 3, slotId: 's/1' })).toEqual({
      method: 'DELETE',
      path: '/programs/i%2F1/results/3/s%2F1',
    });
  });

  it.each(['', ' ', '.', '..'])('refuses the identifier %j before any request exists', (id) => {
    expect(() => programDetail(id)).toThrow(InvalidApiPathIdentifierError);
    expect(() => deleteProgram(id)).toThrow(InvalidApiPathIdentifierError);
    expect(() => deleteResult({ instanceId: 'i', workoutIndex: 0, slotId: id })).toThrow(
      InvalidApiPathIdentifierError
    );
    expect(() => catalogDetail(id)).toThrow(InvalidApiPathIdentifierError);
  });

  it('builds a result body without the optional fields that are absent', () => {
    expect(
      recordResult({ instanceId: 'i', workoutIndex: 2, slotId: 's', result: 'success' }).body
    ).toEqual({ workoutIndex: 2, slotId: 's', result: 'success' });
    expect(
      recordResult({
        instanceId: 'i',
        workoutIndex: 2,
        slotId: 's',
        result: 'fail',
        amrapReps: 8,
        rpe: 9,
        setLogs: [{ reps: 5, weight: 100 }],
      }).body
    ).toEqual({
      workoutIndex: 2,
      slotId: 's',
      result: 'fail',
      amrapReps: 8,
      rpe: 9,
      setLogs: [{ reps: 5, weight: 100 }],
    });
  });

  it('copies the config so later edits cannot change a built request', () => {
    const config = { squat: 60 };
    const request = createProgram({ programId: 'gzclp', name: 'Plan', config });
    config.squat = 999;
    expect(request.body).toEqual({ programId: 'gzclp', name: 'Plan', config: { squat: 60 } });
  });

  it('serialises only what a request carries', () => {
    expect(toRequestInit(undoLastResult('i'))).toEqual({ method: 'POST' });
    expect(toRequestInit(completeProgram('i'))).toEqual({
      method: 'PATCH',
      body: '{"status":"completed"}',
    });
    expect(toRequestInit(updateProgramConfig('i', { squat: 60 })).body).toBe(
      '{"config":{"squat":60}}'
    );
    expect(toRequestInit(updateMetadata('i', { note: 'x' })).body).toBe(
      '{"metadata":{"note":"x"}}'
    );
  });
});
