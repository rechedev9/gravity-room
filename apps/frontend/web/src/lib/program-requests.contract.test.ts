/**
 * Keeps the shared request builders (@gzclp/api-client/program-requests) tied to the
 * generated OpenAPI endpoint list. Web and mobile both build their program requests
 * from those builders, so a route that moves or a body the API stops accepting fails
 * here instead of in production.
 *
 * generated.ts is read as text: it is a drift artifact whose Zod calls do not run, so
 * it must not be imported.
 */
import { describe, expect, it } from 'vitest';
import * as requests from '@gzclp/api-client/program-requests';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INSTANCE_ID = '0b1c2d3e-4f50-4a60-8b70-0c1d2e3f4a5b';
const SLOT_ID = 'squat-t1';
const PROGRAM_ID = 'gzclp';
const WORKOUT_INDEX = 7;

const PATH_PARAMS: Readonly<Record<string, string>> = {
  [INSTANCE_ID]: 'id',
  [SLOT_ID]: 'slotId',
  [PROGRAM_ID]: 'programId',
  [String(WORKOUT_INDEX)]: 'workoutIndex',
};

interface Case {
  readonly name: string;
  readonly request: requests.ApiRequest;
}

const CASES: readonly Case[] = [
  { name: 'listPrograms', request: requests.listPrograms() },
  { name: 'listPrograms (cursor)', request: requests.listPrograms('2026-01-01T00:00:00.000Z_p2') },
  { name: 'programDetail', request: requests.programDetail(INSTANCE_ID) },
  {
    name: 'createProgram',
    request: requests.createProgram({
      programId: PROGRAM_ID,
      name: 'My plan',
      config: { squat: 60 },
    }),
  },
  {
    name: 'updateProgramConfig',
    request: requests.updateProgramConfig(INSTANCE_ID, { squat: 65 }),
  },
  { name: 'completeProgram', request: requests.completeProgram(INSTANCE_ID) },
  { name: 'deleteProgram', request: requests.deleteProgram(INSTANCE_ID) },
  { name: 'exportProgram', request: requests.exportProgram(INSTANCE_ID) },
  { name: 'updateMetadata', request: requests.updateMetadata(INSTANCE_ID, { note: 'x' }) },
  {
    name: 'recordResult',
    request: requests.recordResult({
      instanceId: INSTANCE_ID,
      workoutIndex: WORKOUT_INDEX,
      slotId: SLOT_ID,
      result: 'success',
      amrapReps: 8,
      rpe: 9,
      setLogs: [{ reps: 5, weight: 100 }],
    }),
  },
  {
    name: 'deleteResult',
    request: requests.deleteResult({
      instanceId: INSTANCE_ID,
      workoutIndex: WORKOUT_INDEX,
      slotId: SLOT_ID,
    }),
  },
  { name: 'undoLastResult', request: requests.undoLastResult(INSTANCE_ID) },
  { name: 'catalogList', request: requests.catalogList() },
  { name: 'catalogDetail', request: requests.catalogDetail(PROGRAM_ID) },
];

interface Endpoint {
  readonly method: string;
  readonly path: string;
  readonly parameters: ReadonlySet<string>;
}

function readEndpoints(): readonly Endpoint[] {
  const source = readFileSync(resolve(__dirname, 'api/generated.ts'), 'utf8');
  const list = source.slice(source.indexOf('export const endpoints'));
  return list
    .split(/\r?\n {2}\{\r?\n {4}method: /)
    .slice(1)
    .map((block) => {
      const method = /^'(\w+)'/.exec(block)?.[1] ?? '';
      const path = /path: '([^']+)'/.exec(block)?.[1] ?? '';
      const parameters = new Set(
        [...block.matchAll(/name: '(\w+)',\s*type: '(\w+)'/g)].map(
          ([, name, type]) => `${type}:${name}`
        )
      );
      return { method, path: path.replace(/\/$/, ''), parameters };
    });
}

const ENDPOINTS = readEndpoints();

function templateOf(request: requests.ApiRequest): { path: string; query: URLSearchParams } {
  const url = new URL(request.path, 'http://api.test');
  const segments = url.pathname
    .split('/')
    .map((segment) => (segment in PATH_PARAMS ? `:${PATH_PARAMS[segment]}` : segment));
  return { path: `/api${segments.join('/')}`, query: url.searchParams };
}

function findEndpoint(request: requests.ApiRequest): Endpoint | undefined {
  const { path } = templateOf(request);
  const method = request.method.toLowerCase();
  return ENDPOINTS.find((endpoint) => endpoint.method === method && endpoint.path === path);
}

describe('program request builders match the generated endpoints', () => {
  it('reads a plausible endpoint list', () => {
    expect(ENDPOINTS.length).toBeGreaterThan(30);
  });

  it.each(CASES)('$name is a declared route', ({ request }) => {
    expect(findEndpoint(request)).toBeDefined();
  });

  it.each(CASES)('$name sends a body only where the endpoint declares one', ({ request }) => {
    expect(findEndpoint(request)?.parameters.has('Body:body')).toBe(request.body !== undefined);
  });

  it.each(CASES)('$name only uses declared path and query parameters', ({ request }) => {
    const endpoint = findEndpoint(request);
    const { path, query } = templateOf(request);

    for (const placeholder of path.split('/').filter((segment) => segment.startsWith(':'))) {
      expect(endpoint?.parameters.has(`Path:${placeholder.slice(1)}`), placeholder).toBe(true);
    }
    for (const name of query.keys()) {
      expect(endpoint?.parameters.has(`Query:${name}`), name).toBe(true);
    }
  });
});
