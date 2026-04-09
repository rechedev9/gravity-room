#!/usr/bin/env bun
/**
 * Generates Zod schemas from the Go API's OpenAPI spec.
 *
 * Output: src/lib/api/generated.ts (committed to git)
 * Purpose: drift detection — if the Go API's openapi.json changes without
 *   updating our hand-written Zod schemas, CI will detect the divergence
 *   via `git diff --exit-code src/lib/api/generated.ts`.
 *
 * The generated schemas are NOT imported by app code. Our hand-written schemas
 * in lib/shared/schemas/ are more precisely typed and include coercive defaults.
 * The generated file is the reference layer that proves the hand-written schemas
 * track the real API contract.
 */
import { $ } from 'bun';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(dir, '../../../apps/go-api/internal/swagger/openapi.json');
const tmpPath = '/tmp/gravity-room-generated-raw.ts';
const outputPath = resolve(dir, '../src/lib/api/generated.ts');

// Run openapi-zod-client
await $`bunx openapi-zod-client ${specPath} --output ${tmpPath} --export-schemas --all-readonly`;

let content = await Bun.file(tmpPath).text();

// Fix: use zod/v4 (project standard) instead of zod
content = content.replace(/from 'zod'/g, "from 'zod/v4'");

// Strip Zodios client code — we only want the schema declarations
content = content.replace(
  /^import \{ makeApi, Zodios, type ZodiosOptions \} from '@zodios\/core';\n/m,
  ''
);
const endpointsIdx = content.indexOf('\nconst endpoints =');
if (endpointsIdx !== -1) {
  content = content.slice(0, endpointsIdx).trimEnd() + '\n';
}

// Add header comment
const header = [
  '/**',
  ' * AUTO-GENERATED — do not edit by hand.',
  ' * Source: apps/go-api/internal/swagger/openapi.json',
  ' * Regenerate: bun run api:types (from apps/web/)',
  ' *',
  ' * This file is committed to enable CI drift detection:',
  ' *   bun run api:types && git diff --exit-code src/lib/api/generated.ts',
  ' *',
  ' * DO NOT import from this file in application code.',
  ' * Use the hand-written schemas in lib/shared/schemas/ instead.',
  ' */',
  '',
].join('\n');

await Bun.write(outputPath, header + content);
process.stdout.write(`Generated: ${outputPath}\n`);
