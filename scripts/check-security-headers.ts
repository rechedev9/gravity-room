import { readFileSync } from 'node:fs';

// Source of truth for the static-SPA security headers moved from the VPS
// Caddyfile (infra/production/Caddyfile, removed in the Vercel migration) to
// vercel.json `headers`. Caddy applied these to the served SPA; on Vercel the
// edge applies them via the headers config. The API function sets its own CSP
// in apps/backend/api/src/app-config.ts, so the vercel.json block is scoped to
// non-/api paths to avoid duplicate headers.

interface VercelHeader {
  key: string;
  value: string;
}
interface VercelHeaderRule {
  source: string;
  headers: VercelHeader[];
}

function fail(message: string): never {
  console.error(`security header check failed: ${message}`);
  process.exit(1);
}

const vercel: { headers?: VercelHeaderRule[] } = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rules = vercel.headers ?? [];

// Flatten every key -> value the SPA security-headers rules set.
const headers = new Map<string, string>();
for (const rule of rules) {
  for (const header of rule.headers ?? []) {
    headers.set(header.key, header.value);
  }
}

const csp = headers.get('Content-Security-Policy');
if (!csp) fail('Content-Security-Policy header is missing from vercel.json headers');

const directives = new Map<string, string[]>();
for (const rawDirective of csp.split(';')) {
  const parts = rawDirective.trim().split(/\s+/).filter(Boolean);
  const name = parts.shift();
  if (!name) continue;
  directives.set(name, parts);
}

function requireDirective(name: string): string[] {
  const values = directives.get(name);
  if (!values) fail(`CSP directive '${name}' is missing`);
  return values;
}

function requireDirectiveValue(name: string, value: string): void {
  const values = requireDirective(name);
  if (!values.includes(value)) fail(`CSP directive '${name}' must include ${value}`);
}

function forbidDirectiveValue(name: string, value: string): void {
  const values = directives.get(name);
  if (values?.includes(value)) fail(`CSP directive '${name}' must not include ${value}`);
}

requireDirectiveValue('default-src', "'self'");
requireDirectiveValue('object-src', "'none'");
requireDirectiveValue('base-uri', "'self'");
requireDirectiveValue('form-action', "'self'");
requireDirectiveValue('frame-ancestors', "'none'");
requireDirectiveValue('script-src-attr', "'none'");
requireDirectiveValue('manifest-src', "'self'");
requireDirectiveValue('worker-src', "'self'");
requireDirective('upgrade-insecure-requests');

forbidDirectiveValue('script-src', "'unsafe-eval'");
forbidDirectiveValue('script-src', 'http:');
forbidDirectiveValue('connect-src', 'http:');

const requiredHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};
for (const [key, value] of Object.entries(requiredHeaders)) {
  if (headers.get(key) !== value) fail(`required header is missing or wrong: ${key} "${value}"`);
}

// Permissions-Policy: assert every powerful feature is denied with an empty
// allowlist. camera/microphone/geolocation/payment/interest-cohort mirror the
// API policy in apps/backend/api/src/app-config.ts (PERMISSIONS_POLICY), plus
// browsing-topics which is SPA-only. Parsed directive-by-directive (not exact
// string match) so directive order can vary, but each MUST resolve to `()`.
const permissionsPolicy = headers.get('Permissions-Policy');
if (!permissionsPolicy) fail('Permissions-Policy header is missing from vercel.json headers');

const permissionsAllowlists = new Map<string, string>();
for (const rawDirective of permissionsPolicy.split(',')) {
  const trimmed = rawDirective.trim();
  if (!trimmed) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) fail(`Permissions-Policy directive is malformed (no '='): "${trimmed}"`);
  permissionsAllowlists.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
}

function requirePermissionDenied(feature: string): void {
  const allowlist = permissionsAllowlists.get(feature);
  if (allowlist === undefined) fail(`Permissions-Policy must deny '${feature}'`);
  if (allowlist !== '()') {
    fail(`Permissions-Policy '${feature}' must have an empty allowlist () but was "${allowlist}"`);
  }
}

for (const feature of [
  'camera',
  'microphone',
  'geolocation',
  'payment',
  'interest-cohort',
  'browsing-topics',
]) {
  requirePermissionDenied(feature);
}

console.log('security headers OK');
