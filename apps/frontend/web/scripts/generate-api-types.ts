#!/usr/bin/env bun
/**
 * Generates Zod schemas from the ElysiaJS API's OpenAPI spec.
 *
 * Output: src/lib/api/generated.ts (committed to git)
 * Purpose: drift detection — if the API's OpenAPI spec changes without
 *   updating our hand-written Zod schemas, CI will detect the divergence
 *   via `git diff --exit-code src/lib/api/generated.ts`.
 *
 * Requires the API to be running locally (bun run dev:api).
 * The spec is fetched from http://localhost:3001/swagger/json.
 *
 * The generated schemas are NOT imported by app code. Our hand-written schemas
 * in @gzclp/domain/schemas/* are more precisely typed and include coercive defaults.
 * The generated file is the reference layer that proves the hand-written schemas
 * track the real API contract.
 */
import { $ } from 'bun';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildGeneratedArtifact } from './generate-api-types-lib';

const dir = dirname(fileURLToPath(import.meta.url));
const specUrl = process.env.API_SPEC_URL ?? 'http://localhost:3001/swagger/json';
const tmpSpecPath = '/tmp/gravity-room-openapi.json';
const tmpPath = '/tmp/gravity-room-generated-raw.ts';
const outputPath = resolve(dir, '../src/lib/api/generated.ts');

// Fetch the OpenAPI spec from the running API
const res = await fetch(specUrl);
if (!res.ok) {
  process.stderr.write(
    `Failed to fetch OpenAPI spec from ${specUrl} (${res.status}). Is the API running?\n`
  );
  process.exit(1);
}
await Bun.write(tmpSpecPath, await res.text());

// Run openapi-zod-client
await $`bunx openapi-zod-client ${tmpSpecPath} --output ${tmpPath} --export-schemas --all-readonly`;

const rawContent = await Bun.file(tmpPath).text();
const content = buildGeneratedArtifact(rawContent);

// Add header comment
const header = [
  '/**',
  ' * AUTO-GENERATED — do not edit by hand.',
  ' * Source: ElysiaJS API /swagger/json endpoint',
  ' * Regenerate: bun run api:types (from apps/web/)',
  ' *',
  ' * This file is committed to enable CI drift detection:',
  ' *   bun run api:types && git diff --exit-code src/lib/api/generated.ts',
  ' *',
  ' * DO NOT import from this file in application code.',
  ' * Use the hand-written schemas in @gzclp/domain/schemas/* instead.',
  ' */',
  '',
].join('\n');

await Bun.write(outputPath, header + content);
process.stdout.write(`Generated: ${outputPath}\n`);
