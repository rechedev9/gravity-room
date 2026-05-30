import { readFileSync } from 'node:fs';

const caddyfile = readFileSync('infra/production/Caddyfile', 'utf8');

function fail(message: string): never {
  console.error(`security header check failed: ${message}`);
  process.exit(1);
}

const cspMatch = caddyfile.match(/Content-Security-Policy\s+"([^"]+)"/);
if (!cspMatch?.[1]) fail('Content-Security-Policy header is missing from Caddyfile');

const csp = cspMatch[1];
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

const requiredHeaders = [
  'Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"',
  'X-Content-Type-Options "nosniff"',
  'Referrer-Policy "strict-origin-when-cross-origin"',
  'Cross-Origin-Opener-Policy "same-origin-allow-popups"',
];
for (const header of requiredHeaders) {
  if (!caddyfile.includes(header)) fail(`required header is missing: ${header}`);
}

console.log('security headers OK');
