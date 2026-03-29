// k6 load test for Gravity Room Go API.
//
// Prerequisites:
//   brew install k6       (macOS)
//   go install go.k6.io/k6@latest  (from source)
//
// Usage:
//   k6 run scripts/loadtest.js                                  # default "load" scenario
//   k6 run scripts/loadtest.js --env SCENARIO=smoke             # single-VU sanity check
//   k6 run scripts/loadtest.js --env SCENARIO=stress            # find breaking point
//   k6 run scripts/loadtest.js --env BASE_URL=https://example.com
//
// Scenarios:
//   smoke   — 1 VU,  30s   (sanity check, all endpoints work)
//   load    — 50 VUs, 2min  (baseline throughput + latency)
//   stress  — ramp to 100 VUs over 1min, hold 2min, ramp down 30s

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const SCENARIO = __ENV.SCENARIO || 'load';

const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '2m',
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '30s', target: 0 },
    ],
  },
};

export const options = {
  scenarios: { default: scenarios[SCENARIO] || scenarios.load },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    read_latency: ['p(95)<200'],
    write_latency: ['p(95)<500'],
  },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const readLatency = new Trend('read_latency', true);
const writeLatency = new Trend('write_latency', true);
const errorRate = new Rate('error_rate');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { 'Content-Type': 'application/json' };

function authHeaders(token) {
  return { ...jsonHeaders, Authorization: `Bearer ${token}` };
}

function trackRead(res) {
  readLatency.add(res.timings.duration);
  errorRate.add(res.status >= 400);
}

function trackWrite(res) {
  writeLatency.add(res.timings.duration);
  errorRate.add(res.status >= 400);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export default function () {
  // 1. Public endpoints (no auth)
  group('public', () => {
    let res = http.get(`${BASE_URL}/health`);
    check(res, { 'health 200': (r) => r.status === 200 });
    trackRead(res);

    res = http.get(`${BASE_URL}/api/catalog`);
    check(res, { 'catalog 200': (r) => r.status === 200 });
    trackRead(res);

    res = http.get(`${BASE_URL}/api/exercises?limit=20`);
    check(res, { 'exercises 200': (r) => r.status === 200 });
    trackRead(res);

    res = http.get(`${BASE_URL}/api/muscle-groups`);
    check(res, { 'muscle-groups 200': (r) => r.status === 200 });
    trackRead(res);

    res = http.get(`${BASE_URL}/api/stats/online`);
    check(res, { 'stats 200': (r) => r.status === 200 });
    trackRead(res);
  });

  sleep(0.5);

  // 2. Auth flow (dev login → me → refresh)
  let accessToken;
  let programId;

  group('auth', () => {
    const email = `loadtest-${__VU}@test.local`;
    const loginRes = http.post(`${BASE_URL}/api/auth/dev`, JSON.stringify({ email }), {
      headers: jsonHeaders,
    });
    check(loginRes, { 'dev-login 201': (r) => r.status === 201 });
    trackWrite(loginRes);

    if (loginRes.status === 201) {
      const body = JSON.parse(loginRes.body);
      accessToken = body.accessToken;

      const meRes = http.get(`${BASE_URL}/api/auth/me`, {
        headers: authHeaders(accessToken),
      });
      check(meRes, { 'me 200': (r) => r.status === 200 });
      trackRead(meRes);
    }
  });

  if (!accessToken) {
    return; // auth failed, skip authenticated tests
  }

  sleep(0.3);

  // 3. Authenticated CRUD (create → record result → get → undo → delete)
  group('programs', () => {
    // Create
    const createRes = http.post(
      `${BASE_URL}/api/programs`,
      JSON.stringify({
        programId: 'gzclp',
        name: `Load Test ${__VU}-${__ITER}`,
        config: { squat: 60, bench: 40, deadlift: 60, ohp: 30, latpulldown: 30, dbrow: 12.5 },
      }),
      { headers: authHeaders(accessToken) }
    );
    check(createRes, { 'create 201': (r) => r.status === 201 });
    trackWrite(createRes);

    if (createRes.status !== 201) return;
    programId = JSON.parse(createRes.body).id;

    // List
    const listRes = http.get(`${BASE_URL}/api/programs?limit=5`, {
      headers: authHeaders(accessToken),
    });
    check(listRes, { 'list 200': (r) => r.status === 200 });
    trackRead(listRes);

    // Record result
    const resultRes = http.post(
      `${BASE_URL}/api/programs/${programId}/results`,
      JSON.stringify({ workoutIndex: 0, slotId: 'day1-t1', result: 'success', amrapReps: 8 }),
      { headers: authHeaders(accessToken) }
    );
    check(resultRes, { 'result 201': (r) => r.status === 201 });
    trackWrite(resultRes);

    // Get detail
    const getRes = http.get(`${BASE_URL}/api/programs/${programId}`, {
      headers: authHeaders(accessToken),
    });
    check(getRes, { 'get 200': (r) => r.status === 200 });
    trackRead(getRes);

    // Undo
    const undoRes = http.post(`${BASE_URL}/api/programs/${programId}/undo`, null, {
      headers: authHeaders(accessToken),
    });
    check(undoRes, { 'undo 200': (r) => r.status === 200 });
    trackWrite(undoRes);

    // Delete
    const delRes = http.del(`${BASE_URL}/api/programs/${programId}`, null, {
      headers: authHeaders(accessToken),
    });
    check(delRes, { 'delete 204': (r) => r.status === 204 });
    trackWrite(delRes);
  });

  sleep(0.5);
}
