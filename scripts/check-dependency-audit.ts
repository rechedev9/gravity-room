import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const POLICY_PATH = '.github/dependency-audit-policy.json';
export const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITY_ORDER)[number];

export interface AuditAdvisory {
  module_name: string;
  severity: Severity;
  title: string;
  url: string;
  vulnerable_versions: string;
}

export interface AuditResult {
  advisories: Record<string, AuditAdvisory>;
}

export interface PolicyException {
  advisoryId: string;
  expires: string;
  justification: string;
}

export interface AuditPolicy {
  minimumSeverity: Severity;
  exceptions: PolicyException[];
}

export interface AuditExecution {
  error?: Error | undefined;
  status: number | null;
  signal?: NodeJS.Signals | null | undefined;
  stdout: string;
  stderr: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return value;
}

export function parsePolicyJson(source: string, now = Date.now()): AuditPolicy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`policy is not valid JSON: ${String(error)}`);
  }
  if (!isRecord(parsed)) throw new Error('policy must be a JSON object');

  const minimumSeverity = parsed['minimumSeverity'];
  if (
    typeof minimumSeverity !== 'string' ||
    !SEVERITY_ORDER.includes(minimumSeverity as Severity)
  ) {
    throw new Error(`minimumSeverity must be one of: ${SEVERITY_ORDER.join(', ')}`);
  }

  const rawExceptions = parsed['exceptions'];
  if (!Array.isArray(rawExceptions)) throw new Error('exceptions must be an array');

  const seen = new Set<string>();
  const exceptions = rawExceptions.map((value, index): PolicyException => {
    if (!isRecord(value)) throw new Error(`exceptions[${index}] must be an object`);
    const advisoryId = requireString(value, 'advisoryId', `exceptions[${index}]`);
    const expires = requireString(value, 'expires', `exceptions[${index}]`);
    const justification = requireString(value, 'justification', `exceptions[${index}]`);

    if (!/^\d+$/.test(advisoryId)) {
      throw new Error(`exception advisoryId must be numeric: ${advisoryId}`);
    }
    if (seen.has(advisoryId)) throw new Error(`duplicate exception: ${advisoryId}`);
    seen.add(advisoryId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      throw new Error(`exception ${advisoryId} must have a YYYY-MM-DD expiry`);
    }
    const expiresAt = Date.parse(`${expires}T23:59:59Z`);
    if (!Number.isFinite(expiresAt) || expiresAt < now) {
      throw new Error(`exception ${advisoryId} expired on ${expires}`);
    }
    if (justification.trim().length < 20) {
      throw new Error(`exception ${advisoryId} needs a specific justification (20+ characters)`);
    }
    return { advisoryId, expires, justification };
  });

  return { minimumSeverity: minimumSeverity as Severity, exceptions };
}

export function parseAuditJson(source: string): AuditResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`pnpm audit did not return valid JSON: ${String(error)}`);
  }
  if (!isRecord(parsed)) throw new Error('pnpm audit output must be a JSON object');
  if ('error' in parsed) {
    throw new Error(`pnpm audit reported an operational error: ${JSON.stringify(parsed['error'])}`);
  }

  const rawAdvisories = parsed['advisories'];
  if (!isRecord(rawAdvisories)) {
    throw new Error('pnpm audit output is missing the advisories object');
  }
  const metadata = parsed['metadata'];
  if (!isRecord(metadata) || !isRecord(metadata['vulnerabilities'])) {
    throw new Error('pnpm audit output is missing vulnerability metadata');
  }
  for (const severity of SEVERITY_ORDER) {
    const count = metadata['vulnerabilities'][severity];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      throw new Error(
        `pnpm audit metadata.vulnerabilities.${severity} must be a non-negative integer`
      );
    }
  }
  if (
    typeof metadata['totalDependencies'] !== 'number' ||
    !Number.isInteger(metadata['totalDependencies']) ||
    metadata['totalDependencies'] < 0
  ) {
    throw new Error('pnpm audit metadata.totalDependencies must be a non-negative integer');
  }

  const advisories: Record<string, AuditAdvisory> = {};
  for (const [id, value] of Object.entries(rawAdvisories)) {
    if (!/^\d+$/.test(id)) throw new Error(`pnpm audit advisory ID must be numeric: ${id}`);
    if (!isRecord(value)) throw new Error(`pnpm audit advisory ${id} must be an object`);
    const severity = value['severity'];
    if (typeof severity !== 'string' || !SEVERITY_ORDER.includes(severity as Severity)) {
      throw new Error(`pnpm audit advisory ${id} has an invalid severity`);
    }
    advisories[id] = {
      module_name: requireString(value, 'module_name', `advisory ${id}`),
      severity: severity as Severity,
      title: requireString(value, 'title', `advisory ${id}`),
      url: requireString(value, 'url', `advisory ${id}`),
      vulnerable_versions: requireString(value, 'vulnerable_versions', `advisory ${id}`),
    };
  }

  return { advisories };
}

export function parseAuditExecution(execution: AuditExecution): AuditResult {
  if (execution.error) throw new Error(`could not execute pnpm audit: ${execution.error.message}`);
  if (execution.status === null) {
    throw new Error(
      `pnpm audit terminated without an exit status${execution.signal ? ` (${execution.signal})` : ''}`
    );
  }
  // pnpm uses 1 specifically to report advisories. Every other non-zero status
  // is operational and must not be mistaken for a clean or policy-excepted run.
  if (execution.status !== 0 && execution.status !== 1) {
    throw new Error(
      `pnpm audit failed operationally with exit ${execution.status}${execution.stderr.trim() ? `: ${execution.stderr.trim()}` : ''}`
    );
  }

  const result = parseAuditJson(execution.stdout);
  if (execution.status === 1 && Object.keys(result.advisories).length === 0) {
    throw new Error('pnpm audit exited 1 but returned no advisories');
  }
  return result;
}

export function enforcePolicy(policy: AuditPolicy, result: AuditResult): void {
  const advisories = Object.entries(result.advisories);
  const activeIds = new Set(advisories.map(([id]) => id));
  for (const exception of policy.exceptions) {
    if (!activeIds.has(exception.advisoryId)) {
      throw new Error(
        `exception ${exception.advisoryId} is no longer reported; remove it from ${POLICY_PATH}`
      );
    }
  }

  const threshold = SEVERITY_ORDER.indexOf(policy.minimumSeverity);
  const exceptions = new Map(
    policy.exceptions.map((exception) => [exception.advisoryId, exception])
  );
  const blocking: Array<[string, AuditAdvisory]> = [];

  for (const [id, advisory] of advisories.sort(([left], [right]) => left.localeCompare(right))) {
    const summary = `${advisory.severity.toUpperCase()} ${id} ${advisory.module_name}: ${advisory.title}`;
    const exception = exceptions.get(id);
    if (exception) {
      console.warn(
        `EXCEPTED ${summary} (expires ${exception.expires}: ${exception.justification})`
      );
      continue;
    }

    if (SEVERITY_ORDER.indexOf(advisory.severity) >= threshold) {
      blocking.push([id, advisory]);
      console.error(`BLOCKING ${summary}\n  ${advisory.url}`);
    } else {
      console.warn(`NON-BLOCKING ${summary}\n  ${advisory.url}`);
    }
  }

  if (blocking.length > 0) {
    throw new Error(
      `${blocking.length} unexcepted advisories meet the ${policy.minimumSeverity} threshold`
    );
  }

  console.log(
    `dependency audit OK: ${advisories.length} advisories, threshold=${policy.minimumSeverity}, exceptions=${policy.exceptions.length}`
  );
}

export function runDependencyAudit(): void {
  const policy = parsePolicyJson(readFileSync(POLICY_PATH, 'utf8'));
  // Audit the complete install used to build and test release artifacts. Build
  // tool vulnerabilities are supply-chain exposure even when absent at runtime.
  const audit = spawnSync('pnpm', ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const result = parseAuditExecution({
    error: audit.error,
    status: audit.status,
    signal: audit.signal,
    stdout: audit.stdout,
    stderr: audit.stderr,
  });
  enforcePolicy(policy, result);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    runDependencyAudit();
  } catch (error) {
    console.error(
      `dependency audit failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  }
}
