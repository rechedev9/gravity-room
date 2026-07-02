#!/usr/bin/env tsx
/**
 * Generates Zod schemas from the ElysiaJS API's OpenAPI spec.
 *
 * Output: src/lib/api/generated.ts (committed to git)
 * Purpose: drift detection — if the API's OpenAPI spec changes without
 *   updating our hand-written Zod schemas, CI will detect the divergence
 *   via `git diff --exit-code src/lib/api/generated.ts`.
 *
 * Requires the API to be running locally (pnpm run dev:api).
 * The spec is fetched from http://localhost:3001/swagger/json.
 *
 * The generated schemas are NOT imported by app code. Our hand-written schemas
 * in @gzclp/domain/schemas/* are more precisely typed and include coercive defaults.
 * The generated file is the reference layer that proves the hand-written schemas
 * track the real API contract.
 */
import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGeneratedArtifact } from './generate-api-types-lib';

const exec = promisify(execFile);
// On Windows, `pnpm` resolves to pnpm.cmd via PATHEXT, which requires a shell.
const runViaShell = process.platform === 'win32';

const dir = dirname(fileURLToPath(import.meta.url));
const specUrl = process.env.API_SPEC_URL ?? 'http://localhost:3001/swagger/json';
const outputPath = resolve(dir, '../src/lib/api/generated.ts');

// The web package is CJS (no `"type": "module"`), so tsx transforms this file
// to a format without top-level await — everything lives inside main().
async function main(): Promise<void> {
  // Stage the fetched spec and the raw codegen output in a freshly-created,
  // per-run temp directory (unpredictable name) rather than fixed paths under the
  // shared OS temp dir. This is cross-platform (os.tmpdir() vs hardcoded /tmp) and
  // avoids the symlink/pre-creation races a predictable world-writable path invites.
  const tmpDirRoot = await mkdtemp(join(tmpdir(), 'gravity-room-apigen-'));
  const tmpSpecPath = join(tmpDirRoot, 'openapi.json');
  const tmpPath = join(tmpDirRoot, 'generated-raw.ts');

  // Fetch the OpenAPI spec from the running API
  const res = await fetch(specUrl);
  if (!res.ok) {
    process.stderr.write(
      `Failed to fetch OpenAPI spec from ${specUrl} (${res.status}). Is the API running?\n`
    );
    process.exit(1);
  }
  await writeFile(tmpSpecPath, await res.text(), 'utf8');

  // Run openapi-zod-client
  await exec(
    'pnpm',
    [
      'exec',
      'openapi-zod-client',
      tmpSpecPath,
      '--output',
      tmpPath,
      '--export-schemas',
      '--all-readonly',
    ],
    { shell: runViaShell }
  );

  const rawContent = await readFile(tmpPath, 'utf8');
  const content = buildGeneratedArtifact(rawContent);

  // Add header comment
  const header = [
    '/**',
    ' * AUTO-GENERATED — do not edit by hand.',
    ' * Source: ElysiaJS API /swagger/json endpoint',
    ' * Regenerate: pnpm run api:types (from apps/frontend/web/)',
    ' *',
    ' * This file is committed to enable CI drift detection:',
    ' *   pnpm run api:types && git diff --exit-code src/lib/api/generated.ts',
    ' *',
    ' * DO NOT import from this file in application code.',
    ' * Use the hand-written schemas in @gzclp/domain/schemas/* instead.',
    ' */',
    '',
  ].join('\n');

  await writeFile(outputPath, header + content, 'utf8');

  // Normalize formatting so local + CI regenerations produce byte-identical
  // output (drift check would otherwise false-positive on whitespace).
  await exec('pnpm', ['exec', 'prettier', '--write', '--log-level=warn', outputPath], {
    shell: runViaShell,
  });

  // Remove the per-run staging directory; the only artifact we keep is the
  // committed generated.ts at outputPath.
  await rm(tmpDirRoot, { recursive: true, force: true });

  process.stdout.write(`Generated: ${outputPath}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
