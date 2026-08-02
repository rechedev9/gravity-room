import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enforcePolicy,
  parseAuditExecution,
  parseAuditJson,
  parsePolicyJson,
  type AuditAdvisory,
  type AuditExecution,
  type AuditPolicy,
  type AuditResult,
} from './check-dependency-audit';

const metadata = {
  vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
  dependencies: 1,
  devDependencies: 1,
  optionalDependencies: 0,
  totalDependencies: 2,
};

function auditJson(advisories: Record<string, unknown> = {}): string {
  return JSON.stringify({ advisories, metadata });
}

const cleanExecution: AuditExecution = {
  status: 0,
  stdout: auditJson(),
  stderr: '',
};

const highAdvisory: AuditAdvisory = {
  module_name: 'fixture-package',
  severity: 'high',
  title: 'Fixture advisory',
  url: 'https://example.test/advisory',
  vulnerable_versions: '<2.0.0',
};

describe('dependency audit output parser', () => {
  for (const testCase of [
    {
      name: 'rejects malformed JSON',
      execution: { ...cleanExecution, stdout: '{' },
      message: /valid JSON/,
    },
    {
      name: 'rejects JSON operational errors',
      execution: {
        ...cleanExecution,
        status: 1,
        stdout: JSON.stringify({ error: { code: 'ERR_PNPM_META_FETCH_FAIL' } }),
      },
      message: /operational error/,
    },
    {
      name: 'rejects missing audit schema fields',
      execution: { ...cleanExecution, stdout: JSON.stringify({ advisories: {} }) },
      message: /vulnerability metadata/,
    },
    {
      name: 'rejects non-advisory non-zero exits',
      execution: { ...cleanExecution, status: 2, stderr: 'registry unavailable' },
      message: /failed operationally with exit 2/,
    },
    {
      name: 'rejects advisory exit status without advisories',
      execution: { ...cleanExecution, status: 1 },
      message: /exited 1 but returned no advisories/,
    },
  ]) {
    it(testCase.name, () => {
      assert.throws(() => parseAuditExecution(testCase.execution), testCase.message);
    });
  }

  it('accepts exit 1 specifically when valid advisories are reported', () => {
    const result = parseAuditExecution({
      ...cleanExecution,
      status: 1,
      stdout: auditJson({ '1234': highAdvisory }),
    });
    assert.equal(result.advisories['1234']?.severity, 'high');
  });

  it('rejects malformed advisory records instead of silently skipping them', () => {
    assert.throws(() => parseAuditJson(auditJson({ '1234': { severity: 'high' } })), /module_name/);
  });
});

describe('dependency audit policy parser', () => {
  for (const testCase of [
    {
      name: 'rejects malformed policy JSON',
      source: '{',
      message: /not valid JSON/,
    },
    {
      name: 'rejects duplicate exceptions',
      source: JSON.stringify({
        minimumSeverity: 'high',
        exceptions: [
          {
            advisoryId: '1234',
            expires: '2099-01-01',
            justification: 'A sufficiently detailed fixture reason.',
          },
          {
            advisoryId: '1234',
            expires: '2099-01-02',
            justification: 'A second sufficiently detailed reason.',
          },
        ],
      }),
      message: /duplicate exception/,
    },
    {
      name: 'rejects expired exceptions',
      source: JSON.stringify({
        minimumSeverity: 'high',
        exceptions: [
          {
            advisoryId: '1234',
            expires: '2024-01-01',
            justification: 'A sufficiently detailed fixture reason.',
          },
        ],
      }),
      message: /expired/,
    },
  ]) {
    it(testCase.name, () => {
      assert.throws(
        () => parsePolicyJson(testCase.source, Date.parse('2025-01-01T00:00:00Z')),
        testCase.message
      );
    });
  }
});

describe('dependency advisory policy', () => {
  const policy: AuditPolicy = { minimumSeverity: 'high', exceptions: [] };

  it('blocks an unexcepted advisory at the configured threshold', () => {
    const result: AuditResult = {
      advisories: { '1234': highAdvisory },
    };
    assert.throws(() => enforcePolicy(policy, result), /1 unexcepted advisories/);
  });
});
