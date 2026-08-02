import { readFileSync } from 'node:fs';

interface Rewrite {
  source: string;
  destination: string;
}

interface Header {
  key: string;
  value: string;
}

interface HeaderRule {
  source: string;
  headers: Header[];
}

interface VercelConfig {
  cleanUrls?: boolean;
  rewrites?: Rewrite[];
  headers?: HeaderRule[];
}

function fail(message: string): never {
  console.error(`Vercel deployment check failed: ${message}`);
  process.exit(1);
}

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;
if (config.cleanUrls !== true) fail('cleanUrls must remain enabled');

const rewrites = config.rewrites ?? [];
const apiIndex = rewrites.findIndex(
  (rewrite) => rewrite.source === '/api/(.*)' && rewrite.destination === '/api'
);
const spaIndex = rewrites.findIndex(
  (rewrite) => rewrite.source === '/((?!api/).*)' && rewrite.destination === '/'
);
if (apiIndex === -1) fail('the /api/(.*) -> /api function rewrite is missing');
if (spaIndex === -1) {
  fail('the cleanUrls-compatible SPA fallback /((?!api/).*) -> / is missing');
}
if (apiIndex > spaIndex) fail('the API rewrite must run before the SPA fallback');
if (rewrites.some((rewrite) => rewrite.destination === '/index.html')) {
  fail('cleanUrls SPA rewrites must target /, never /index.html');
}

const headers = config.headers ?? [];
const baselineHeaderIndex = headers.findIndex((candidate) => candidate.source === '/((?!api/).*)');
if (baselineHeaderIndex === -1) fail('the baseline non-API header rule is missing');
for (const route of ['/reset-password', '/verify-email']) {
  const ruleIndex = headers.findIndex((candidate) => candidate.source === route);
  const policy = headers[ruleIndex]?.headers.find(
    (header) => header.key.toLowerCase() === 'referrer-policy'
  );
  if (policy?.value !== 'no-referrer') {
    fail(`${route} must override Referrer-Policy with no-referrer`);
  }
  if (ruleIndex < baselineHeaderIndex) {
    fail(`${route} no-referrer override must follow the baseline header rule`);
  }
}

const buildScript = readFileSync('scripts/vercel-build.sh', 'utf8');
const directUrlCheck = buildScript.indexOf('DIRECT_DATABASE_URL:?');
const artifactBuild = buildScript.indexOf('build:no-prerender');
const prerender = buildScript.indexOf('scripts/prerender.ts');
const databaseDeploy = buildScript.lastIndexOf('pnpm --filter api db:deploy');
if (directUrlCheck === -1 || directUrlCheck > artifactBuild) {
  fail('the production direct-URL preflight must run before artifact builds');
}
if (artifactBuild === -1 || prerender === -1 || databaseDeploy === -1) {
  fail('the build, prerender, or database deploy step is missing');
}
if (databaseDeploy < artifactBuild || databaseDeploy < prerender) {
  fail('production database deploy must run only after build and prerender succeed');
}

const migrationScript = readFileSync('apps/backend/api/src/scripts/migrate-deploy.ts', 'utf8');
if (!migrationScript.includes("process.env['VERCEL_ENV'] === 'production'")) {
  fail('migration deploy must distinguish production when resolving its direct URL');
}
if (!migrationScript.includes('pg_advisory_lock(')) {
  fail('migration deploy must serialize with a PostgreSQL advisory lock');
}

console.log('Vercel deployment config OK');
