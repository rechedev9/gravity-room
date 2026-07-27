// k6 load test for Gravity Room API.
//
// Usage:
//   k6 run scripts/loadtest.js --env SCENARIO=smoke \
//     --env BASE_URL=http://localhost:3001 \
//     --env AUTH_DEV_ROUTE_SECRET=<local dev secret>
//
// Scenarios:
//   smoke   — 1 VU, 30s
//   load    — 50 VUs, 2m
//   stress  — ramp to 100 VUs over 1m, hold 2m, ramp down 30s
//
// Durations and VUs may be shortened for bounded local diagnostics:
//   SMOKE_DURATION, LOAD_DURATION, LOAD_VUS,
//   STRESS_RAMP_DURATION, STRESS_HOLD_DURATION, STRESS_RAMP_DOWN_DURATION,
//   STRESS_VUS.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const SCENARIO = __ENV.SCENARIO || 'load';
const DEV_AUTH_SECRET = __ENV.AUTH_DEV_ROUTE_SECRET;
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || '10s';

const scenarioNames = ['smoke', 'load', 'stress'];
if (!scenarioNames.includes(SCENARIO)) {
  throw new Error(`Unknown SCENARIO "${SCENARIO}". Expected smoke, load, or stress.`);
}
if (!DEV_AUTH_SECRET) {
  throw new Error('AUTH_DEV_ROUTE_SECRET is required for authenticated load testing.');
}

function positiveIntegerEnv(name, fallback) {
  const raw = __ENV[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: __ENV.SMOKE_DURATION || '30s',
  },
  load: {
    executor: 'constant-vus',
    vus: positiveIntegerEnv('LOAD_VUS', 50),
    duration: __ENV.LOAD_DURATION || '2m',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      {
        duration: __ENV.STRESS_RAMP_DURATION || '1m',
        target: positiveIntegerEnv('STRESS_VUS', 100),
      },
      {
        duration: __ENV.STRESS_HOLD_DURATION || '2m',
        target: positiveIntegerEnv('STRESS_VUS', 100),
      },
      { duration: __ENV.STRESS_RAMP_DOWN_DURATION || '30s', target: 0 },
    ],
  },
};

export const options = {
  scenarios: { default: scenarios[SCENARIO] },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    read_latency: ['p(95)<200'],
    write_latency: ['p(95)<500'],
  },
};

const readLatency = new Trend('read_latency', true);
const writeLatency = new Trend('write_latency', true);
const errorRate = new Rate('error_rate');

const jsonHeaders = { 'Content-Type': 'application/json' };
const devLoginHeaders = {
  ...jsonHeaders,
  'x-dev-auth-secret': DEV_AUTH_SECRET,
};

function requestParams(headers = jsonHeaders) {
  return { headers, timeout: REQUEST_TIMEOUT };
}

function authHeaders(token) {
  return { ...jsonHeaders, Authorization: `Bearer ${token}` };
}

function responseSucceeded(response) {
  return response.status >= 200 && response.status < 400;
}

function trackRead(response) {
  readLatency.add(response.timings.duration);
  errorRate.add(!responseSucceeded(response));
}

function trackWrite(response) {
  writeLatency.add(response.timings.duration);
  errorRate.add(!responseSucceeded(response));
}

function parseJson(response, operation) {
  try {
    return response.json();
  } catch {
    throw new Error(`${operation} returned invalid JSON (status ${response.status}).`);
  }
}

export function setup() {
  const health = http.get(`${BASE_URL}/api/health`, requestParams());
  if (health.status !== 200) {
    throw new Error(`Health preflight failed with status ${health.status}.`);
  }

  const definitionResponse = http.get(`${BASE_URL}/api/catalog/gzclp`, requestParams());
  if (definitionResponse.status !== 200) {
    throw new Error(`GZCLP catalog preflight failed with status ${definitionResponse.status}.`);
  }
  const definition = parseJson(definitionResponse, 'Catalog preflight');
  const slotId = definition.days?.[0]?.slots?.[0]?.id;
  if (!slotId) {
    throw new Error('GZCLP catalog preflight did not return a first workout slot.');
  }

  return {
    runId: __ENV.RUN_ID || String(Date.now()),
    programId: definition.id,
    slotId,
  };
}

export default function (data) {
  group('public', () => {
    const responses = [
      {
        name: 'catalog',
        response: http.get(`${BASE_URL}/api/catalog/`, requestParams()),
      },
      {
        name: 'exercises',
        response: http.get(`${BASE_URL}/api/exercises?limit=20`, requestParams()),
      },
      {
        name: 'muscle-groups',
        response: http.get(`${BASE_URL}/api/muscle-groups`, requestParams()),
      },
      {
        name: 'stats',
        response: http.get(`${BASE_URL}/api/stats/online`, requestParams()),
      },
    ];

    for (const { name, response } of responses) {
      check(response, { [`${name} 200`]: (value) => value.status === 200 });
      trackRead(response);
    }
  });

  sleep(0.25);

  let accessToken;
  let programId;

  try {
    group('auth', () => {
      const email = `loadtest-${data.runId}-${__VU}@test.local`;
      const loginResponse = http.post(
        `${BASE_URL}/api/auth/dev`,
        JSON.stringify({ email }),
        requestParams(devLoginHeaders)
      );
      check(loginResponse, { 'dev-login 201': (response) => response.status === 201 });
      trackWrite(loginResponse);

      if (loginResponse.status !== 201) return;
      accessToken = parseJson(loginResponse, 'Dev login').accessToken;

      const refreshResponse = http.post(
        `${BASE_URL}/api/auth/refresh`,
        null,
        requestParams(jsonHeaders)
      );
      check(refreshResponse, { 'refresh 200': (response) => response.status === 200 });
      trackWrite(refreshResponse);
      if (refreshResponse.status !== 200) {
        accessToken = undefined;
        return;
      }
      accessToken = parseJson(refreshResponse, 'Refresh').accessToken;

      const meResponse = http.get(
        `${BASE_URL}/api/auth/me`,
        requestParams(authHeaders(accessToken))
      );
      check(meResponse, { 'me 200': (response) => response.status === 200 });
      trackRead(meResponse);
    });

    if (!accessToken) return;

    sleep(0.15);

    group('programs', () => {
      const createResponse = http.post(
        `${BASE_URL}/api/programs`,
        JSON.stringify({
          programId: data.programId,
          name: `Load Test ${data.runId}-${__VU}-${__ITER}`,
          config: {
            squat: 60,
            bench: 40,
            deadlift: 60,
            ohp: 30,
            latpulldown: 30,
            dbrow: 12.5,
          },
        }),
        requestParams(authHeaders(accessToken))
      );
      check(createResponse, { 'create 201': (response) => response.status === 201 });
      trackWrite(createResponse);

      if (createResponse.status !== 201) return;
      programId = parseJson(createResponse, 'Program create').id;

      const listResponse = http.get(
        `${BASE_URL}/api/programs?limit=5`,
        requestParams(authHeaders(accessToken))
      );
      check(listResponse, {
        'list 200': (response) => response.status === 200,
        'list is paginated': (response) => {
          if (response.status !== 200) return false;
          const body = parseJson(response, 'Program list');
          return Array.isArray(body.data) && (body.nextCursor === null || !!body.nextCursor);
        },
      });
      trackRead(listResponse);

      const resultResponse = http.post(
        `${BASE_URL}/api/programs/${programId}/results`,
        JSON.stringify({
          workoutIndex: 0,
          slotId: data.slotId,
          result: 'success',
          amrapReps: 8,
        }),
        requestParams(authHeaders(accessToken))
      );
      check(resultResponse, { 'result 201': (response) => response.status === 201 });
      trackWrite(resultResponse);

      const getResponse = http.get(
        `${BASE_URL}/api/programs/${programId}`,
        requestParams(authHeaders(accessToken))
      );
      check(getResponse, { 'get 200': (response) => response.status === 200 });
      trackRead(getResponse);

      const undoResponse = http.post(
        `${BASE_URL}/api/programs/${programId}/undo`,
        null,
        requestParams(authHeaders(accessToken))
      );
      check(undoResponse, { 'undo 200': (response) => response.status === 200 });
      trackWrite(undoResponse);

      const deleteResponse = http.del(
        `${BASE_URL}/api/programs/${programId}`,
        null,
        requestParams(authHeaders(accessToken))
      );
      check(deleteResponse, { 'delete 204': (response) => response.status === 204 });
      trackWrite(deleteResponse);
      if (deleteResponse.status === 204) programId = undefined;
    });
  } finally {
    if (programId && accessToken) {
      const deleteResponse = http.del(
        `${BASE_URL}/api/programs/${programId}`,
        null,
        requestParams(authHeaders(accessToken))
      );
      trackWrite(deleteResponse);
    }

    const signoutResponse = http.post(
      `${BASE_URL}/api/auth/signout`,
      null,
      requestParams(jsonHeaders)
    );
    check(signoutResponse, { 'signout 204': (response) => response.status === 204 });
    trackWrite(signoutResponse);
  }

  sleep(0.25);
}
